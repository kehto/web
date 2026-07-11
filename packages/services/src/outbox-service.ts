/**
 * outbox-service.ts — NAP-OUTBOX (outbox-aware relay routing) reference service.
 *
 * Shell-side handler for the NAP-OUTBOX wire protocol. It is a pure envelope
 * router: it validates `outbox.*` envelopes, delegates the actual relay
 * discovery / routing / dedup / publish-fanout work to an injected
 * {@link OutboxRouter}, and posts the correlated result / lifecycle messages
 * (echoing the request `id` or `subId`) back to the napplet.
 *
 * The router is injected (options-as-bridge) so this service has no Nostr
 * dependency and is fully unit-testable. A concrete relay-pool-backed router
 * ships alongside as {@link createRelayPoolOutboxRouter}.
 *
 * ──────────────────────────── Responsibilities ────────────────────────────
 *   Inbound:  outbox.getEvent, outbox.query, outbox.subscribe, outbox.close,
 *             outbox.publish, outbox.resolveRelays
 *   Outbound: outbox.getEvent.result, outbox.query.result, outbox.event,
 *             outbox.closed, outbox.publish.result,
 *             outbox.resolveRelays.result
 *
 * The shell owns relay discovery, routing, fallback, deduplication, signature
 * validation, signing, and publish fanout policy — all of which live behind
 * the {@link OutboxRouter}. This service only marshals the wire protocol.
 *
 * @example
 * ```ts
 * import { createOutboxService, createRelayPoolOutboxRouter } from '@kehto/services';
 *
 * const router = createRelayPoolOutboxRouter({ relayPool, loadRelayLists, fallbackRelays });
 * runtime.registerService('outbox', createOutboxService({ router }));
 * ```
 *
 * @packageDocumentation
 */

import type { EventTemplate, NappletMessage, NostrEvent, NostrFilter } from '@napplet/core';
import type { RelayEventResult, ServiceDescriptor, ServiceHandler } from '@kehto/runtime';

/** Outbox service version — follows semver. */
const OUTBOX_SERVICE_VERSION = '1.0.0';

/** Options for a single-event outbox lookup. */
export interface OutboxEventOptions {
  /** Author hint for routing through the author's outbox relays. */
  author?: string;
  /** Relay hints; treated as a hint subject to shell validation, not a bypass. */
  relays?: string[];
  /** Wall-clock budget for the lookup, in milliseconds. */
  timeoutMs?: number;
}

/** Options for a one-shot outbox query. */
export interface OutboxQueryOptions {
  /** Explicit author hints (augment/override authors derived from filters). */
  authors?: string[];
  /** Relay hints; treated as a hint subject to shell validation, not a bypass. */
  relays?: string[];
  /** Maximum events to collect. */
  limit?: number;
  /** Wall-clock budget for the query, in milliseconds. */
  timeoutMs?: number;
}

/** Options for a live outbox subscription. */
export interface OutboxSubscribeOptions extends OutboxQueryOptions {}

/** Options for an outbox publish. */
export interface OutboxPublishOptions {
  /** Explicit relay URL fanout candidates, subject to shell validation. */
  relays?: string[];
  /** Include the shell user's NIP-65 write relays. Defaults to true. */
  toOutbox?: boolean;
  /** Recipient pubkeys whose NIP-65 read relays are required fanout targets. */
  toInboxes?: string[];
}

/** A read/write target for relay-plan resolution. */
export interface OutboxTarget {
  /** Authors to resolve relays for. */
  authors?: string[];
  /** Single pubkey to resolve relays for. */
  pubkey?: string;
  /** Whether the plan is for reading (their write relays) or writing (their read relays). */
  direction?: 'read' | 'write';
}

/** The relay plan the shell would use for a target. */
export interface OutboxRelayPlan {
  /** Resolved relay URLs. */
  relays: string[];
  /** Where the plan came from. */
  source: 'nip65' | 'cache' | 'policy' | 'fallback';
  /** Authors for which no relay list could be resolved. */
  missingAuthors?: string[];
}

/** Outcome of a single-event outbox lookup. */
export interface OutboxEventResult {
  /** The signature-validated event result matching the requested event id, when found. */
  result?: RelayEventResult;
  /** True when some relay lists or connections failed and the lookup was partial. */
  incomplete?: boolean;
  /** Error reason when the lookup could not complete or did not find the event. */
  error?: string;
}

/** Outcome of an outbox query, as returned by the {@link OutboxRouter}. */
export interface OutboxResult {
  /** Deduplicated, signature-validated event results. */
  events: RelayEventResult[];
  /** True when some relay lists or connections failed and results are partial. */
  incomplete?: boolean;
  /** Error reason when the query could not complete. */
  error?: string;
}

/** Outcome of an outbox publish, as returned by the {@link OutboxRouter}. */
export interface OutboxPublishResult {
  /** Whether the publish succeeded on at least the required relays. */
  ok: boolean;
  /** The signed event returned by the shell. */
  event?: NostrEvent;
  /** The published event id. */
  eventId?: string;
  /** Map of relay URL -> per-relay publish success. */
  relays?: Record<string, boolean>;
  /** Error reason when the publish failed. */
  error?: string;
}

/** Sink an {@link OutboxRouter} streams subscription lifecycle through. */
export interface OutboxSubscriptionSink {
  /** Deliver a matching event result. */
  event(result: RelayEventResult): void;
  /** Signal that the subscription was closed upstream; `reason` is optional. */
  closed(reason?: string): void;
}

/** Handle to a router-owned subscription. */
export interface OutboxRouterSubscription {
  /** Stop the subscription and release its relay connections. */
  close(): void;
}

/**
 * Abstract outbox router. Implementors own relay discovery (NIP-65 / NIP-66),
 * routing, fallback, deduplication, signature validation, signing, and publish
 * fanout. The service translates wire envelopes into these calls and back.
 */
export interface OutboxRouter {
  /** Fetch and validate one event by id through shell-owned outbox routing. */
  getEvent?(eventId: string, options?: OutboxEventOptions): Promise<OutboxEventResult>;
  /** Resolve relays, query them, dedup by id, validate signatures, collect events. */
  query(filters: NostrFilter[], options?: OutboxQueryOptions): Promise<OutboxResult>;
  /** Open a live outbox-aware subscription, streaming through `sink`. */
  subscribe(
    filters: NostrFilter[],
    options: OutboxSubscribeOptions | undefined,
    sink: OutboxSubscriptionSink,
  ): OutboxRouterSubscription;
  /** Sign `template` and fan it out to the relevant write/inbox relays. */
  publish(template: EventTemplate, options?: OutboxPublishOptions): Promise<OutboxPublishResult>;
  /** Return the relay plan the shell would use for a read/write target. */
  resolveRelays(target: OutboxTarget): Promise<OutboxRelayPlan>;
}

/** Options for {@link createOutboxService}. */
export interface OutboxServiceOptions {
  /** The outbox router the shell uses to reach relays. Required. */
  router: OutboxRouter;
}

type Send = (msg: NappletMessage) => void;

const OUTBOX_DESCRIPTOR: ServiceDescriptor = {
  name: 'outbox',
  version: OUTBOX_SERVICE_VERSION,
  description: 'NAP-OUTBOX outbox-aware relay routing — getEvent/query/subscribe/publish/resolveRelays',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === 'string');
  return strings.length > 0 ? strings : undefined;
}

function uint(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function sanitizeEventOptions(raw: unknown): OutboxEventOptions | undefined {
  if (!isRecord(raw)) return undefined;
  const out: OutboxEventOptions = {};
  if (typeof raw.author === 'string') out.author = raw.author;
  const relays = stringArray(raw.relays);
  if (relays) out.relays = relays;
  const timeoutMs = uint(raw.timeoutMs);
  if (timeoutMs !== undefined) out.timeoutMs = timeoutMs;
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeQueryOptions(raw: unknown): OutboxQueryOptions | undefined {
  if (!isRecord(raw)) return undefined;
  const out: OutboxQueryOptions = {};
  const authors = stringArray(raw.authors);
  if (authors) out.authors = authors;
  const relays = stringArray(raw.relays);
  if (relays) out.relays = relays;
  const limit = uint(raw.limit);
  if (limit !== undefined) out.limit = limit;
  const timeoutMs = uint(raw.timeoutMs);
  if (timeoutMs !== undefined) out.timeoutMs = timeoutMs;
  return Object.keys(out).length > 0 ? out : undefined;
}

const sanitizeSubscribeOptions = sanitizeQueryOptions;

function sanitizePublishOptions(raw: unknown): OutboxPublishOptions | undefined {
  if (!isRecord(raw)) return undefined;
  const out: OutboxPublishOptions = {};
  const relays = stringArray(raw.relays);
  if (relays) out.relays = relays;
  if (typeof raw.toOutbox === 'boolean') out.toOutbox = raw.toOutbox;
  const toInboxes = stringArray(raw.toInboxes);
  if (toInboxes) out.toInboxes = toInboxes;
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeTarget(raw: unknown): OutboxTarget | undefined {
  if (!isRecord(raw)) return undefined;
  const out: OutboxTarget = {};
  const authors = stringArray(raw.authors);
  if (authors) out.authors = authors;
  if (typeof raw.pubkey === 'string') out.pubkey = raw.pubkey;
  if (raw.direction === 'read' || raw.direction === 'write') out.direction = raw.direction;
  return out;
}

/**
 * Normalize a wire `filters` field (a single NIP-01 filter or an array) into a
 * filter array. Returns `null` when the input is missing or has no usable
 * filter objects.
 */
function normalizeFilters(raw: unknown): NostrFilter[] | null {
  if (Array.isArray(raw)) {
    const filters = raw.filter((f): f is NostrFilter => typeof f === 'object' && f !== null);
    return filters.length > 0 ? filters : null;
  }
  if (typeof raw === 'object' && raw !== null) return [raw as NostrFilter];
  return null;
}

function buildEventQuery(eventId: string, eventOptions?: OutboxEventOptions): { filter: NostrFilter; queryOptions: OutboxQueryOptions } {
  const filter: NostrFilter = { ids: [eventId] };
  const queryOptions: OutboxQueryOptions = { limit: 1 };
  if (typeof eventOptions?.author === 'string' && eventOptions.author.length > 0) {
    filter.authors = [eventOptions.author];
    queryOptions.authors = [eventOptions.author];
  }
  if (Array.isArray(eventOptions?.relays)) queryOptions.relays = eventOptions.relays;
  if (eventOptions?.timeoutMs !== undefined) queryOptions.timeoutMs = eventOptions.timeoutMs;
  return { filter, queryOptions };
}

function eventResultFromQuery(eventId: string, result: OutboxResult): OutboxEventResult {
  const relayResult = result.events.find((candidate) => candidate.event.id === eventId);
  const eventResult: OutboxEventResult = {};
  if (relayResult) eventResult.result = relayResult;
  if (!relayResult) eventResult.error = result.error ?? 'not found';
  else if (result.error !== undefined) eventResult.error = result.error;
  if (result.incomplete !== undefined) eventResult.incomplete = result.incomplete;
  return eventResult;
}

function fallbackGetEvent(router: OutboxRouter, eventId: string, eventOptions?: OutboxEventOptions): Promise<OutboxEventResult> {
  const { filter, queryOptions } = buildEventQuery(eventId, eventOptions);
  return router.query([filter], queryOptions).then((result) => eventResultFromQuery(eventId, result));
}

function sendEventResult(id: string, eventId: string, result: OutboxEventResult, send: Send): void {
  if (result.result && result.result.event.id !== eventId) {
    send({ type: 'outbox.getEvent.result', id, error: 'not found' } as NappletMessage);
    return;
  }
  send({
    type: 'outbox.getEvent.result',
    id,
    ...(result.result === undefined ? {} : { result: result.result }),
    ...(result.incomplete === undefined ? {} : { incomplete: result.incomplete }),
    ...(result.error === undefined ? {} : { error: result.error }),
  } as NappletMessage);
}

function handleGetEvent(router: OutboxRouter, msg: NappletMessage, send: Send): void {
  const m = msg as NappletMessage & { id?: string; eventId?: unknown; options?: unknown };
  const id = m.id ?? '';
  if (typeof m.eventId !== 'string' || m.eventId.length === 0) {
    send({ type: 'outbox.getEvent.result', id, error: 'invalid filter' } as NappletMessage);
    return;
  }
  const getEvent = router.getEvent ?? ((eventId, eventOptions) => fallbackGetEvent(router, eventId, eventOptions));
  void getEvent(m.eventId, sanitizeEventOptions(m.options))
    .then((result) => sendEventResult(id, m.eventId as string, result, send))
    .catch((err) =>
      send({ type: 'outbox.getEvent.result', id, error: toErrorMessage(err) } as NappletMessage),
    );
}

/**
 * Create the NAP-OUTBOX service handler.
 *
 * @param options - Must provide an {@link OutboxRouter}.
 * @returns A `ServiceHandler` ready for `runtime.registerService('outbox', handler)`.
 * @throws If `options.router` is missing.
 */
export function createOutboxService(options: OutboxServiceOptions): ServiceHandler {
  if (!options || typeof options.router !== 'object' || options.router === null) {
    throw new Error('createOutboxService: options.router is required');
  }
  const { router } = options;

  // Active subscriptions keyed by `windowId:subId` for lifecycle management.
  const subscriptions = new Map<string, OutboxRouterSubscription>();

  function handleQuery(msg: NappletMessage, send: Send): void {
    const m = msg as NappletMessage & { id?: string; filters?: unknown; options?: unknown };
    const id = m.id ?? '';
    const filters = normalizeFilters(m.filters);
    if (!filters) {
      send({ type: 'outbox.query.result', id, events: [], error: 'invalid filter' } as NappletMessage);
      return;
    }
    void router
      .query(filters, sanitizeQueryOptions(m.options))
      .then((result) =>
        send({
          type: 'outbox.query.result',
          id,
          events: result.events,
          ...(result.incomplete === undefined ? {} : { incomplete: result.incomplete }),
          ...(result.error === undefined ? {} : { error: result.error }),
        } as NappletMessage),
      )
      .catch((err) =>
        send({ type: 'outbox.query.result', id, events: [], error: toErrorMessage(err) } as NappletMessage),
      );
  }

  function handleSubscribe(windowId: string, msg: NappletMessage, send: Send): void {
    const m = msg as NappletMessage & { subId?: string; filters?: unknown; options?: unknown };
    const subId = m.subId;
    if (typeof subId !== 'string' || subId.length === 0) return;
    const subKey = `${windowId}:${subId}`;

    // Replace any existing subscription for this key.
    subscriptions.get(subKey)?.close();
    subscriptions.delete(subKey);

    const filters = normalizeFilters(m.filters);
    if (!filters) {
      send({ type: 'outbox.closed', subId, reason: 'invalid filter' } as NappletMessage);
      return;
    }

    const sink: OutboxSubscriptionSink = {
      event: (result) => send({ type: 'outbox.event', subId, result } as NappletMessage),
      closed: (reason) => {
        subscriptions.delete(subKey);
        send({ type: 'outbox.closed', subId, ...(reason === undefined ? {} : { reason }) } as NappletMessage);
      },
    };

    subscriptions.set(subKey, router.subscribe(filters, sanitizeSubscribeOptions(m.options), sink));
  }

  function handleClose(windowId: string, msg: NappletMessage, send: Send): void {
    const m = msg as NappletMessage & { subId?: string };
    const subId = m.subId;
    if (typeof subId !== 'string') return;
    const subKey = `${windowId}:${subId}`;
    subscriptions.get(subKey)?.close();
    subscriptions.delete(subKey);
    send({ type: 'outbox.closed', subId } as NappletMessage);
  }

  function handlePublish(msg: NappletMessage, send: Send): void {
    const m = msg as NappletMessage & { id?: string; event?: EventTemplate; options?: unknown };
    const id = m.id ?? '';
    if (!m.event || typeof m.event !== 'object') {
      send({ type: 'outbox.publish.result', id, ok: false, error: 'invalid filter' } as NappletMessage);
      return;
    }
    void router
      .publish(m.event, sanitizePublishOptions(m.options))
      .then((result) =>
        send({
          type: 'outbox.publish.result',
          id,
          ok: result.ok,
          ...(result.event === undefined ? {} : { event: result.event }),
          ...(result.eventId === undefined ? {} : { eventId: result.eventId }),
          ...(result.relays === undefined ? {} : { relays: result.relays }),
          ...(result.error === undefined ? {} : { error: result.error }),
        } as NappletMessage),
      )
      .catch((err) =>
        send({ type: 'outbox.publish.result', id, ok: false, error: toErrorMessage(err) } as NappletMessage),
      );
  }

  function handleResolveRelays(msg: NappletMessage, send: Send): void {
    const m = msg as NappletMessage & { id?: string; target?: unknown };
    const id = m.id ?? '';
    const target = sanitizeTarget(m.target);
    if (!target) {
      send({ type: 'outbox.resolveRelays.result', id, error: 'invalid filter' } as NappletMessage);
      return;
    }
    void router
      .resolveRelays(target)
      .then((plan) => send({ type: 'outbox.resolveRelays.result', id, plan } as NappletMessage))
      .catch((err) =>
        send({ type: 'outbox.resolveRelays.result', id, error: toErrorMessage(err) } as NappletMessage),
      );
  }

  return {
    descriptor: OUTBOX_DESCRIPTOR,
    handleMessage(windowId: string, message: NappletMessage, send: Send): void {
      switch (message.type) {
        case 'outbox.getEvent':
          handleGetEvent(router, message, send);
          return;
        case 'outbox.query':
          handleQuery(message, send);
          return;
        case 'outbox.subscribe':
          handleSubscribe(windowId, message, send);
          return;
        case 'outbox.close':
          handleClose(windowId, message, send);
          return;
        case 'outbox.publish':
          handlePublish(message, send);
          return;
        case 'outbox.resolveRelays':
          handleResolveRelays(message, send);
          return;
        default:
          // Unknown outbox.* action — silently ignored (forward-compatible).
          return;
      }
    },
    onWindowDestroyed(windowId: string): void {
      const prefix = `${windowId}:`;
      for (const [key, sub] of subscriptions) {
        if (key.startsWith(prefix)) {
          sub.close();
          subscriptions.delete(key);
        }
      }
    },
  };
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'outbox request failed';
}
