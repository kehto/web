/**
 * domains/relay.ts — Mock NAP-RELAY service.
 *
 * Spec: naps/NAP-RELAY.md @ napplet/naps PR #2 head 9f30b3505335 (draft)
 * Routes: relay.subscribe, relay.close, relay.publish, relay.publishEncrypted, relay.query
 * Spec gaps / decisions:
 * - The mock owns the whole relay domain: `relay.subscribe` replays matching
 *   store events as `relay.event` (with `sidecar.relayHints`), then `relay.eose`,
 *   and keeps the subscription live so later publishes fan out.
 * - `relay.close` answers `relay.closed { subId }` even for unknown ids (the
 *   NAP defines no close error; close is idempotent). The runtime's relay
 *   handler swallows that reply and emits its own `relay.closed`.
 * - `relay.publish` accepts either an `EventTemplate` (the mock "signs" it as
 *   the shell user with placeholder id/sig) or an already signed event (the
 *   runtime signs before delegating). Events are stored and fanned out to
 *   every live subscription whose filters and relay scope match, the
 *   publisher's own included, exactly as a relay echoes an accepted event.
 * - Delivery ownership under a runtime: the registered relay service owns
 *   storage and fan-out, and the runtime's ring buffer stays out of it. Each
 *   `relay.event` goes through the `send` of its own `relay.subscribe`, the
 *   same path the reference relay services use, so the runtime's liveness and
 *   `relay:read` checks apply and `relay.event` never needs a recipient entry
 *   in the ACL map (`sendToEligibleNapplet` has none for it).
 * - `relay.publishEncrypted` cannot run NIP-44/NIP-04. The stored event
 *   carries a placeholder ciphertext; subscriptions and queries deliver the
 *   plaintext, honoring "napplets receive plaintext".
 * - `relay` on subscribe/query scopes results to events observed at that
 *   relay (the author's kind-10002 write relays, else `MOCK_FALLBACK_RELAYS`).
 * - Sidecar `resources` pre-resolution is default OFF per the NAP; the mock
 *   never emits `sidecar.resources`.
 */
import type { NappletMessage, NostrEvent, NostrFilter } from '@napplet/core';
import type { RelayCloseMessage, RelayPublishEncryptedMessage, RelayPublishMessage, RelayQueryMessage, RelaySubscribeMessage } from '@napplet/nap/relay/types';
import { defineMockService, pushThrough, pushToWindow, type MockRouteContext } from '../core/handler.js';
import { mockHex } from '../core/rng.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { matchesNostrFilter, queryNostrEvents } from '../fixtures/nostr.js';
import {
  asRequest,
  createMockNostrStore,
  isHex,
  normalizeFilters,
  resolveMockUser,
  type MockEventTemplate,
  type MockNostrStore,
} from './nostr-store.js';

/** Spec document the mock was written against. */
export const RELAY_SPEC_REF: NapSpecRef = {
  nap: 'NAP-RELAY',
  status: 'draft',
  source: 'pr',
  pr: 2,
  sha: '9f30b3505335',
  path: 'naps/NAP-RELAY.md',
};

/**
 * One live subscription.
 *
 * @example
 * ```ts
 * const sub: MockRelaySubscription = { windowId: 'w1', subId: 'sub-1', filters: [{ kinds: [1] }], send: console.log };
 * ```
 */
export interface MockRelaySubscription {
  /** Owning window. */
  windowId: string;
  /** Napplet-chosen subscription id. */
  subId: string;
  /** NIP-01 filters (OR). */
  filters: NostrFilter[];
  /** Scoped relay URL when the request carried `relay`. */
  relay?: string;
  /** Delivery callback of the `relay.subscribe` request; live events go through it. */
  send: (message: NappletMessage) => void;
}

/**
 * In-memory state of the relay mock.
 *
 * @example
 * ```ts
 * const state = createMockRelayService().mock.state();
 * state.subscriptions.size === 0;
 * ```
 */
export interface MockRelayState {
  /** Shared event store. */
  store: MockNostrStore;
  /** Shell-user pubkey used to "sign" templates. */
  user: string;
  /** Live subscriptions keyed by `windowId:subId`. */
  subscriptions: Map<string, MockRelaySubscription>;
  /** Plaintext of events published through `relay.publishEncrypted`, by event id. */
  plaintext: Map<string, string>;
  /** Events published through this mock, oldest first. */
  published: NostrEvent[];
}

/**
 * Options for `createMockRelayService`.
 *
 * @example
 * ```ts
 * const relay = createMockRelayService({ store, user: 'alice' });
 * ```
 */
export interface MockRelayOptions extends MockServiceOptions {
  /** Shared store; a fresh seeded one is created when omitted. */
  store?: MockNostrStore;
  /** Shell user (fixture name or hex pubkey). Default `alice`. */
  user?: string;
}

/**
 * Relay mock with control helpers.
 *
 * @example
 * ```ts
 * const relay = createMockRelayService();
 * relay.inject({ kind: 1, content: 'from the network' }, 'bob');
 * ```
 */
export type MockRelayService = MockService<MockRelayState> & {
  /**
   * Store an event as if observed from the network and fan it out to live
   * subscriptions. `author` is a fixture name or hex pubkey.
   */
  inject(template: MockEventTemplate, author: string): NostrEvent;
  /** Terminate a subscription from the shell side with `relay.closed`. */
  closeSubscription(windowId: string, subId: string, reason?: string): boolean;
};

type RelayContext = MockRouteContext<MockRelayState>;

function deliverable(state: MockRelayState, event: NostrEvent): NostrEvent {
  const plaintext = state.plaintext.get(event.id);
  return plaintext === undefined ? event : { ...event, content: plaintext };
}

function observedAt(state: MockRelayState, event: NostrEvent, relay: string | undefined): string[] | null {
  const hints = state.store.hintsFor(event);
  if (relay === undefined) return hints;
  return hints.includes(relay) ? [relay] : null;
}

function matchingEvents(state: MockRelayState, filters: NostrFilter[], relay: string | undefined): NostrEvent[] {
  return queryNostrEvents(state.store.events(), filters).filter((event) => observedAt(state, event, relay) !== null);
}

function eventMessage(state: MockRelayState, subId: string, event: NostrEvent, relay: string | undefined): NappletMessage {
  const relayHints = observedAt(state, event, relay) ?? [];
  return { type: 'relay.event', subId, result: { event: deliverable(state, event), sidecar: { relayHints } } } as NappletMessage;
}

function handleSubscribe({ message, state, windowId, push, send }: RelayContext): void {
  const { subId, filters: rawFilters, relay } = asRequest<RelaySubscribeMessage>(message);
  if (typeof subId !== 'string' || subId.length === 0) return;
  const filters = normalizeFilters(rawFilters);
  if (!filters) {
    push({ type: 'relay.closed', subId, reason: 'invalid filters' } as NappletMessage);
    return;
  }
  const scoped = typeof relay === 'string' && relay.length > 0 ? relay : undefined;
  const subscription: MockRelaySubscription = { windowId, subId, filters, send, ...(scoped ? { relay: scoped } : {}) };
  state.subscriptions.set(`${windowId}:${subId}`, subscription);
  for (const event of matchingEvents(state, filters, scoped)) push(eventMessage(state, subId, event, scoped));
  push({ type: 'relay.eose', subId } as NappletMessage);
}

function handleClose({ message, state, windowId, push }: RelayContext): void {
  const { subId } = asRequest<RelayCloseMessage>(message);
  if (typeof subId !== 'string' || subId.length === 0) return;
  state.subscriptions.delete(`${windowId}:${subId}`);
  push({ type: 'relay.closed', subId } as NappletMessage);
}

function isSignedEvent(value: Record<string, unknown>): value is NostrEvent & Record<string, unknown> {
  return isHex(value.id, 64) && isHex(value.pubkey, 64) && typeof value.sig === 'string';
}

function validTemplate(value: unknown): value is MockEventTemplate & Record<string, unknown> {
  return typeof value === 'object' && value !== null && Number.isInteger((value as { kind?: unknown }).kind);
}

function storeEvent({ state }: RelayContext, event: NostrEvent): void {
  state.published.push(event);
  state.store.add(event);
}

function handlePublish(context: RelayContext): void {
  const { message, state, reply } = context;
  const raw = (asRequest<RelayPublishMessage>(message)).event as unknown;
  if (!validTemplate(raw)) {
    reply({ ok: false, error: 'invalid event template' });
    return;
  }
  if (state.user === '' && !isSignedEvent(raw)) {
    reply({ ok: false, error: 'no signer configured' });
    return;
  }
  const event = isSignedEvent(raw) ? raw : state.store.sign(raw, state.user);
  storeEvent(context, event);
  reply({ ok: true, event, eventId: event.id });
}

function handlePublishEncrypted(context: RelayContext): void {
  const { message, state, reply } = context;
  const { event: raw, recipient, encryption = 'nip44' } = asRequest<RelayPublishEncryptedMessage>(message);
  if (!isHex(recipient, 64)) {
    reply({ ok: false, error: 'missing recipient' });
    return;
  }
  if (encryption !== 'nip44' && encryption !== 'nip04') {
    reply({ ok: false, error: `unsupported encryption scheme: ${String(encryption)}` });
    return;
  }
  if (!validTemplate(raw)) {
    reply({ ok: false, error: 'invalid event template' });
    return;
  }
  if (state.user === '') {
    reply({ ok: false, error: 'no signer configured' });
    return;
  }
  const plaintext = String(raw.content ?? '');
  const ciphertext = `${encryption}:${mockHex(`cipher:${recipient}:${plaintext}`, 64)}`;
  const event = state.store.sign({ ...raw, content: ciphertext }, state.user);
  state.plaintext.set(event.id, plaintext);
  storeEvent(context, event);
  reply({ ok: true, event, eventId: event.id });
}

function handleQuery({ message, state, reply }: RelayContext): void {
  const { filters: rawFilters } = asRequest<RelayQueryMessage>(message);
  const filters = normalizeFilters(rawFilters);
  if (!filters) {
    reply({ events: [], error: 'invalid filters' });
    return;
  }
  const relay = (message as { relay?: unknown }).relay;
  const scoped = typeof relay === 'string' && relay.length > 0 ? relay : undefined;
  const events = matchingEvents(state, filters, scoped).map((event) => ({
    event: deliverable(state, event),
    sidecar: { relayHints: observedAt(state, event, scoped) ?? [] },
  }));
  reply({ events });
}

/**
 * Create the NAP-RELAY mock.
 *
 * @param options - Store, shell user, and shared mock options.
 * @returns A relay `ServiceHandler` with `mock` controls.
 * @example
 * ```ts
 * const relay = createMockRelayService({ seed: 3 });
 * relay.handleMessage('w1', { type: 'relay.subscribe', id: 'r1', subId: 's1', filters: [{ kinds: [1], limit: 5 }] }, console.log);
 * ```
 */
export function createMockRelayService(options: MockRelayOptions = {}): MockRelayService {
  const store = options.store ?? createMockNostrStore(options.clock ? { clock: options.clock } : {});
  const ownsStore = options.store === undefined;

  const base = defineMockService<MockRelayState>({
    domain: 'relay',
    version: '1.0.0',
    description: 'Mock NAP-RELAY: in-memory relay pool over nostr fixtures',
    kind: 'service',
    initialState: () => {
      if (ownsStore) store.reset();
      return { store, user: resolveMockUser(options.user), subscriptions: new Map(), plaintext: new Map(), published: [] };
    },
    routes: {
      'relay.subscribe': handleSubscribe,
      'relay.close': handleClose,
      'relay.publish': handlePublish,
      'relay.publishEncrypted': handlePublishEncrypted,
      'relay.query': handleQuery,
    },
    onWindowDestroyed: (windowId, state) => {
      for (const key of state.subscriptions.keys()) if (key.startsWith(`${windowId}:`)) state.subscriptions.delete(key);
    },
    onCapabilityRevoked: (windowId, capability, state) => {
      if (capability !== null && capability !== 'relay:read') return;
      for (const [key, sub] of state.subscriptions) {
        if (sub.windowId !== windowId) continue;
        state.subscriptions.delete(key);
        pushToWindow(service, windowId, { type: 'relay.closed', subId: sub.subId, reason: `denied: ${capability ?? 'relay:read'}` } as NappletMessage);
      }
    },
  }, options);

  const fanOut = (event: NostrEvent): void => {
    const state = service.mock.state();
    for (const sub of state.subscriptions.values()) {
      if (!sub.filters.some((filter) => matchesNostrFilter(event, filter))) continue;
      if (observedAt(state, event, sub.relay) === null) continue;
      pushThrough(service, sub.windowId, eventMessage(state, sub.subId, event, sub.relay), sub.send);
    }
  };
  store.onEvent(fanOut);

  const service: MockRelayService = Object.assign(base, {
    inject(template: MockEventTemplate, author: string): NostrEvent {
      return store.publish(template, resolveMockUser(author));
    },
    closeSubscription(windowId: string, subId: string, reason?: string): boolean {
      const state = service.mock.state();
      if (!state.subscriptions.delete(`${windowId}:${subId}`)) return false;
      return pushToWindow(service, windowId, { type: 'relay.closed', subId, ...(reason ? { reason } : {}) } as NappletMessage);
    },
  });
  return service;
}

/** Registry row for the relay domain. */
export const RELAY_MOCK_ENTRY: MockDomainEntry = {
  domain: 'relay',
  kind: 'service',
  spec: RELAY_SPEC_REF,
  create: (options) => createMockRelayService(options),
};
