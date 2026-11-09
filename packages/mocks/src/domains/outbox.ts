/**
 * domains/outbox.ts — Mock NAP-OUTBOX service.
 *
 * Spec: naps/NAP-OUTBOX.md @ napplet/naps PR #32 head 8865f73d52a4 (draft)
 * Routes: outbox.getEvent, outbox.query, outbox.subscribe, outbox.close,
 *         outbox.publish, outbox.resolveRelays
 * Spec gaps / decisions:
 * - Relay plans come from the kind-10002 fixtures in the shared store:
 *   `direction: "read"` (default) resolves an author's write relays,
 *   `direction: "write"` resolves their read relays. Authors without a relay
 *   list land in `missingAuthors`; when nothing resolves the plan uses
 *   `MOCK_FALLBACK_RELAYS` with `source: "fallback"`.
 * - Read surfaces mark `incomplete: true` whenever a hinted/derived author has
 *   no relay list, mirroring a shell that fell back to policy relays.
 * - `outbox.publish` fans out to the shell-user's write relays (unless
 *   `toOutbox: false`), every `toInboxes` author's read relays (a missing list
 *   fails the publish with `"relay list unavailable"`), and validated explicit
 *   `relays`. Explicit URLs that are not `ws(s)://` or point at private hosts
 *   are reported `false` in the per-relay map rather than silently dropped.
 * - Malformed templates/targets/filters answer `"invalid filter"`, matching
 *   the kehto reference service; the NAP lists it among common errors.
 * - `outbox.close` for an unknown `subId` still answers `outbox.closed`
 *   (idempotent close; the NAP defines no close error).
 * - Subscriptions have no EOSE in NAP-OUTBOX; the mock backfills stored
 *   matches as `outbox.event` and stays live.
 */
import type { NappletMessage, NostrEvent, NostrFilter } from '@napplet/core';
import type {
  OutboxCloseMessage,
  OutboxEventOptions,
  OutboxGetEventMessage,
  OutboxPublishMessage,
  OutboxQueryMessage,
  OutboxQueryOptions,
  OutboxRelayPlan,
  OutboxResolveRelaysMessage,
  OutboxSubscribeMessage,
  OutboxTarget,
} from '@napplet/nap/outbox/types';
import { defineMockService, pushToWindow, type MockRouteContext } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { matchesNostrFilter } from '../fixtures/nostr.js';
import {
  asRequest,
  createMockNostrStore,
  isHex,
  MOCK_FALLBACK_RELAYS,
  normalizeFilters,
  resolveMockUser,
  type MockEventTemplate,
  type MockNostrStore,
} from './nostr-store.js';

/** Spec document the mock was written against. */
export const OUTBOX_SPEC_REF: NapSpecRef = {
  nap: 'NAP-OUTBOX',
  status: 'draft',
  source: 'pr',
  pr: 32,
  sha: '8865f73d52a4',
  path: 'naps/NAP-OUTBOX.md',
};

/**
 * One live outbox subscription.
 *
 * @example
 * ```ts
 * const sub: MockOutboxSubscription = { windowId: 'w1', subId: 'sub-1', filters: [{ kinds: [1] }] };
 * ```
 */
export interface MockOutboxSubscription {
  /** Owning window. */
  windowId: string;
  /** Napplet-chosen subscription id. */
  subId: string;
  /** NIP-01 filters (OR). */
  filters: NostrFilter[];
}

/**
 * In-memory state of the outbox mock.
 *
 * @example
 * ```ts
 * const state = createMockOutboxService().mock.state();
 * state.user.length === 64;
 * ```
 */
export interface MockOutboxState {
  /** Shared event store. */
  store: MockNostrStore;
  /** Shell-user pubkey used to sign publishes (`''` when signed out). */
  user: string;
  /** Live subscriptions keyed by `windowId:subId`. */
  subscriptions: Map<string, MockOutboxSubscription>;
  /** Events published through this mock, oldest first. */
  published: NostrEvent[];
}

/**
 * Options for `createMockOutboxService`.
 *
 * @example
 * ```ts
 * const outbox = createMockOutboxService({ store, user: 'alice' });
 * ```
 */
export interface MockOutboxOptions extends MockServiceOptions {
  /** Shared store; a fresh seeded one is created when omitted. */
  store?: MockNostrStore;
  /** Shell user (fixture name or hex pubkey). Default `alice`. */
  user?: string;
}

/**
 * Outbox mock with control helpers.
 *
 * @example
 * ```ts
 * const outbox = createMockOutboxService();
 * outbox.inject({ kind: 1, content: 'observed' }, 'carol');
 * ```
 */
export type MockOutboxService = MockService<MockOutboxState> & {
  /** Store an event as if observed from the network and fan it out to live subscriptions. */
  inject(template: MockEventTemplate, author: string): NostrEvent;
  /** Terminate a subscription from the shell side with `outbox.closed`. */
  closeSubscription(windowId: string, subId: string, reason?: string): boolean;
};

type OutboxContext = MockRouteContext<MockOutboxState>;

/**
 * Resolve the relay plan for a set of authors from kind-10002 fixtures.
 *
 * @param store - Event store holding relay lists.
 * @param authors - Author pubkeys.
 * @param direction - `read` resolves write relays, `write` resolves read relays.
 * @returns The plan, with `missingAuthors` when some lists are absent.
 * @example
 * ```ts
 * resolveMockRelayPlan(store, [MOCK_ACCOUNTS[1].pubkey], 'read').source === 'nip65';
 * ```
 */
export function resolveMockRelayPlan(store: MockNostrStore, authors: readonly string[], direction: 'read' | 'write'): OutboxRelayPlan {
  const relays = new Set<string>();
  const missingAuthors: string[] = [];
  for (const author of authors) {
    const list = store.relayList(author);
    if (!list) {
      missingAuthors.push(author);
      continue;
    }
    for (const entry of list) if (direction === 'read' ? entry.write : entry.read) relays.add(entry.url);
  }
  const plan: OutboxRelayPlan = relays.size > 0
    ? { relays: [...relays], source: 'nip65' }
    : { relays: [...MOCK_FALLBACK_RELAYS], source: 'fallback' };
  if (missingAuthors.length > 0) plan.missingAuthors = missingAuthors;
  return plan;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function queryAuthors(filters: readonly NostrFilter[], options: OutboxQueryOptions | undefined): string[] {
  const authors = new Set<string>();
  for (const filter of filters) for (const author of stringList(filter.authors)) authors.add(author);
  for (const author of stringList(options?.authors)) authors.add(author);
  return [...authors];
}

function handleGetEvent({ message, state, reply }: OutboxContext): void {
  const { eventId, options } = asRequest<OutboxGetEventMessage>(message);
  if (!isHex(eventId, 64)) {
    reply({ error: 'invalid filter' });
    return;
  }
  const event = state.store.get(eventId);
  if (!event) {
    reply({ error: 'not found' });
    return;
  }
  const author = (options as OutboxEventOptions | undefined)?.author;
  const plan = resolveMockRelayPlan(state.store, typeof author === 'string' ? [author] : [], 'read');
  reply({ result: state.store.toResult(event), ...(plan.missingAuthors ? { incomplete: true } : {}) });
}

function handleQuery({ message, state, reply }: OutboxContext): void {
  const { filters: rawFilters, options } = asRequest<OutboxQueryMessage>(message);
  const filters = normalizeFilters(rawFilters);
  if (!filters) {
    reply({ events: [], error: 'invalid filter' });
    return;
  }
  const plan = resolveMockRelayPlan(state.store, queryAuthors(filters, options), 'read');
  let events = state.store.query(filters);
  const limit = options?.limit;
  if (typeof limit === 'number' && Number.isInteger(limit) && limit >= 0) events = events.slice(0, limit);
  reply({ events: events.map((event) => state.store.toResult(event)), ...(plan.missingAuthors ? { incomplete: true } : {}) });
}

function handleSubscribe({ message, state, windowId, push }: OutboxContext): void {
  const { subId, filters: rawFilters, options } = asRequest<OutboxSubscribeMessage>(message);
  if (typeof subId !== 'string' || subId.length === 0) return;
  const filters = normalizeFilters(rawFilters);
  if (!filters) {
    push({ type: 'outbox.closed', subId, reason: 'invalid filter' } as NappletMessage);
    return;
  }
  state.subscriptions.set(`${windowId}:${subId}`, { windowId, subId, filters });
  let backfill = state.store.query(filters);
  const limit = options?.limit;
  if (typeof limit === 'number' && Number.isInteger(limit) && limit >= 0) backfill = backfill.slice(0, limit);
  for (const event of backfill) push({ type: 'outbox.event', subId, result: state.store.toResult(event) } as NappletMessage);
}

function handleClose({ message, state, windowId, push }: OutboxContext): void {
  const { subId } = asRequest<OutboxCloseMessage>(message);
  if (typeof subId !== 'string' || subId.length === 0) return;
  state.subscriptions.delete(`${windowId}:${subId}`);
  push({ type: 'outbox.closed', subId } as NappletMessage);
}

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0|\[::1\])/i;

/**
 * Whether an explicit relay URL passes the mock's publish policy.
 *
 * @param url - Candidate relay URL.
 * @returns `true` for public `ws(s)://` URLs.
 * @example
 * ```ts
 * isAllowedMockRelay('wss://relay-a.example.org') === true;
 * isAllowedMockRelay('ws://127.0.0.1:7777') === false;
 * ```
 */
export function isAllowedMockRelay(url: string): boolean {
  const match = /^wss?:\/\/([^/:]+)/i.exec(url);
  return match !== null && !PRIVATE_HOST.test(match[1] ?? '');
}

function publishTargets(state: MockOutboxState, options: OutboxPublishMessage['options']): { relays: Record<string, boolean>; error?: string } {
  const relays: Record<string, boolean> = {};
  if (options?.toOutbox !== false) {
    for (const url of resolveMockRelayPlan(state.store, [state.user], 'read').relays) relays[url] = true;
  }
  for (const author of stringList(options?.toInboxes)) {
    const list = state.store.relayList(author);
    if (!list) return { relays, error: 'relay list unavailable' };
    for (const entry of list) if (entry.read) relays[entry.url] = true;
  }
  for (const url of stringList(options?.relays)) relays[url] = relays[url] ?? isAllowedMockRelay(url);
  return { relays };
}

function handlePublish({ message, state, reply }: OutboxContext): void {
  const { event: raw, options } = asRequest<OutboxPublishMessage>(message);
  if (typeof raw !== 'object' || raw === null || !Number.isInteger((raw as { kind?: unknown }).kind)) {
    reply({ ok: false, error: 'invalid filter' });
    return;
  }
  if (state.user === '') {
    reply({ ok: false, error: 'publish denied' });
    return;
  }
  const targets = publishTargets(state, options);
  if (targets.error) {
    reply({ ok: false, error: targets.error });
    return;
  }
  const event = state.store.sign(raw as MockEventTemplate, state.user);
  state.published.push(event);
  state.store.add(event);
  reply({ ok: true, event, eventId: event.id, relays: targets.relays });
}

function handleResolveRelays({ message, state, reply }: OutboxContext): void {
  const { target } = asRequest<OutboxResolveRelaysMessage>(message);
  if (typeof target !== 'object' || target === null) {
    reply({ plan: { relays: [...MOCK_FALLBACK_RELAYS], source: 'fallback' }, error: 'invalid filter' });
    return;
  }
  const { authors, pubkey, direction } = target as OutboxTarget;
  const targets = stringList(authors);
  if (typeof pubkey === 'string') targets.push(pubkey);
  const plan = resolveMockRelayPlan(state.store, targets, direction === 'write' ? 'write' : 'read');
  reply({ plan, ...(targets.length === 0 ? { error: 'no authors' } : {}) });
}

/**
 * Create the NAP-OUTBOX mock.
 *
 * @param options - Store, shell user, and shared mock options.
 * @returns An outbox `ServiceHandler` with `mock` controls.
 * @example
 * ```ts
 * const outbox = createMockOutboxService();
 * outbox.handleMessage('w1', { type: 'outbox.resolveRelays', id: 'r1', target: { pubkey: MOCK_ACCOUNTS[1].pubkey } }, console.log);
 * ```
 */
export function createMockOutboxService(options: MockOutboxOptions = {}): MockOutboxService {
  const store = options.store ?? createMockNostrStore(options.clock ? { clock: options.clock } : {});
  const ownsStore = options.store === undefined;

  const base = defineMockService<MockOutboxState>({
    domain: 'outbox',
    version: '1.0.0',
    description: 'Mock NAP-OUTBOX: NIP-65 relay planning over nostr fixtures',
    kind: 'service',
    initialState: () => {
      if (ownsStore) store.reset();
      return { store, user: resolveMockUser(options.user), subscriptions: new Map(), published: [] };
    },
    routes: {
      'outbox.getEvent': handleGetEvent,
      'outbox.query': handleQuery,
      'outbox.subscribe': handleSubscribe,
      'outbox.close': handleClose,
      'outbox.publish': handlePublish,
      'outbox.resolveRelays': handleResolveRelays,
    },
    onWindowDestroyed: (windowId, state) => {
      for (const key of state.subscriptions.keys()) if (key.startsWith(`${windowId}:`)) state.subscriptions.delete(key);
    },
    onCapabilityRevoked: (windowId, capability, state) => {
      if (capability !== null && capability !== 'relay:read') return;
      for (const [key, sub] of state.subscriptions) {
        if (sub.windowId !== windowId) continue;
        state.subscriptions.delete(key);
        pushToWindow(service, windowId, { type: 'outbox.closed', subId: sub.subId, reason: 'policy denied' } as NappletMessage);
      }
    },
  }, options);

  store.onEvent((event) => {
    const state = service.mock.state();
    for (const sub of state.subscriptions.values()) {
      if (!sub.filters.some((filter) => matchesNostrFilter(event, filter))) continue;
      pushToWindow(service, sub.windowId, { type: 'outbox.event', subId: sub.subId, result: state.store.toResult(event) } as NappletMessage);
    }
  });

  const service: MockOutboxService = Object.assign(base, {
    inject(template: MockEventTemplate, author: string): NostrEvent {
      return store.publish(template, resolveMockUser(author));
    },
    closeSubscription(windowId: string, subId: string, reason?: string): boolean {
      if (!service.mock.state().subscriptions.delete(`${windowId}:${subId}`)) return false;
      return pushToWindow(service, windowId, { type: 'outbox.closed', subId, ...(reason ? { reason } : {}) } as NappletMessage);
    },
  });
  return service;
}

/** Registry row for the outbox domain. */
export const OUTBOX_MOCK_ENTRY: MockDomainEntry = {
  domain: 'outbox',
  kind: 'service',
  spec: OUTBOX_SPEC_REF,
  create: (options) => createMockOutboxService(options),
};
