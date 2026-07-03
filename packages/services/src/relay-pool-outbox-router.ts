/**
 * relay-pool-outbox-router.ts — concrete {@link OutboxRouter} backed by a relay pool.
 *
 * Implements the outbox-model routing that NAP-OUTBOX centralizes so napplets
 * don't each reinvent it: derive authors, resolve their NIP-65 relays, fan a
 * per-relay subscription out across the plan, deduplicate by event id (while
 * recording every relay an event was observed on), validate signatures, and —
 * for publish — sign the template and fan it out to the relevant write/inbox
 * relays.
 *
 * NIP-65 relay-list *fetching* is the host's concern (it may come from a
 * kind-10002 cache, a NIP-66 indexer via `@kehto/nip/66`, or a live query), so
 * it is injected via {@link RelayPoolOutboxRouterOptions.loadRelayLists}. The
 * relay pool, signer, and signature verifier are injected too — keeping this
 * router browser-agnostic and unit-testable with mocks.
 *
 * Relay-selection model (per the outbox model):
 * - reading an author's events  → their **write** relays (where they publish)
 * - writing to reach an author   → their **read**  relays (their inbox)
 *
 * @example
 * ```ts
 * import { createOutboxService, createRelayPoolOutboxRouter } from '@kehto/services';
 *
 * const router = createRelayPoolOutboxRouter({
 *   relayPool: myOutboxPool,
 *   loadRelayLists: (pubkeys) => relayListCache.getMany(pubkeys),
 *   fallbackRelays: ['wss://relay.damus.io', 'wss://nos.lol'],
 *   signEvent: (tmpl) => signer.signEvent(tmpl),
 *   verifyEvent: (ev) => verifyEvent(ev),
 * });
 * runtime.registerService('outbox', createOutboxService({ router }));
 * ```
 *
 * @packageDocumentation
 */

import type { EventTemplate, NostrEvent, NostrFilter } from '@napplet/core';
import { createRelayEventResultWithHints } from '@kehto/runtime';
import type { RelayEventResult } from '@kehto/runtime';
import type {
  OutboxRouter,
  OutboxResult,
  OutboxPublishResult,
  OutboxRelayPlan,
  OutboxEventOptions,
  OutboxEventResult,
  OutboxQueryOptions,
  OutboxSubscribeOptions,
  OutboxPublishOptions,
  OutboxTarget,
  OutboxSubscriptionSink,
  OutboxRouterSubscription,
} from './outbox-service.js';

// Timer globals available in all JS runtimes.
declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(id: unknown): void;

/** Default per-query wall-clock budget when `options.timeoutMs` is unset. */
const DEFAULT_QUERY_TIMEOUT_MS = 4000;

/** A NIP-65 relay list for a single pubkey. */
export interface RelayListEntry {
  /** Relays the author reads from (their inbox). */
  read: string[];
  /** Relays the author writes to (where their events land). */
  write: string[];
}

/**
 * Relay pool contract the router drives. Implementors adapt their pool library
 * (nostr-tools SimplePool, applesauce-relay, etc.). Unlike the lower-level
 * relay NAP pool, both methods take an explicit relay-URL set so the router
 * controls outbox routing and can attribute events to the relay they arrived on.
 */
export interface OutboxRelayPool {
  /**
   * Subscribe to `filters` on exactly `relayUrls`. The callback receives each
   * matching event or the literal `'EOSE'` once stored events are exhausted.
   * Returns a handle to cancel the subscription.
   */
  subscribe(
    filters: NostrFilter[],
    relayUrls: string[],
    callback: (item: NostrEvent | 'EOSE') => void,
  ): { unsubscribe(): void };
  /**
   * Publish `event` to `relayUrls`. May return a per-relay success map; a
   * `void`/missing return is treated as optimistic success on every target.
   */
  publish(
    event: NostrEvent,
    relayUrls: string[],
  ): Promise<Record<string, boolean>> | Record<string, boolean> | void;
  /** Whether the relay pool is connected and able to handle requests. */
  isAvailable(): boolean;
}

/** Options for {@link createRelayPoolOutboxRouter}. */
export interface RelayPoolOutboxRouterOptions {
  /** Relay pool the router subscribes/publishes through. Required. */
  relayPool: OutboxRelayPool;
  /**
   * Resolve NIP-65 relay lists for a set of pubkeys. Pubkeys with no known
   * list are simply omitted from the returned map (they become `missingAuthors`).
   */
  loadRelayLists(pubkeys: string[]): Promise<Map<string, RelayListEntry>> | Map<string, RelayListEntry>;
  /** Relays to fall back to when NIP-65 data is absent, stale, or empty. Required. */
  fallbackRelays: string[];
  /**
   * Sign a template before publish (shell-mediated; napplets never sign). When
   * omitted, `publish` resolves with `{ ok: false, error: 'publish denied' }`.
   */
  signEvent?(template: EventTemplate): Promise<NostrEvent>;
  /**
   * Validate an event signature before delivering it to a napplet. May be sync
   * or async. Defaults to accepting every event (host pools often pre-verify).
   */
  verifyEvent?(event: NostrEvent): Promise<boolean> | boolean;
  /**
   * Gate relay URLs (e.g. block private-network hosts). Defaults to allowing
   * only `ws://` / `wss://` URLs — `options.relays` hints pass through this too.
   */
  isRelayAllowed?(url: string): boolean;
  /** Default query timeout when `options.timeoutMs` is unset. Default 4000ms. */
  defaultTimeoutMs?: number;
}

/** Resolved router dependencies threaded into the module-level helpers. */
interface RouterCtx {
  relayPool: OutboxRelayPool;
  loadRelayLists: RelayPoolOutboxRouterOptions['loadRelayLists'];
  fallbackRelays: string[];
  signEvent?: RelayPoolOutboxRouterOptions['signEvent'];
  isRelayAllowed: (url: string) => boolean;
  defaultTimeoutMs: number;
  verify(event: NostrEvent): Promise<boolean>;
}

/** Default relay gate: only ws(s):// URLs are permitted. */
function defaultRelayAllowed(url: string): boolean {
  return typeof url === 'string' && (url.startsWith('wss://') || url.startsWith('ws://'));
}

/** Collect a deduplicated author set from filters + explicit option hints. */
function deriveAuthors(filters: NostrFilter[], optionAuthors?: string[]): string[] {
  const authors = new Set<string>();
  for (const filter of filters) {
    for (const author of filter.authors ?? []) authors.add(author);
  }
  for (const author of optionAuthors ?? []) authors.add(author);
  return [...authors];
}

/** Apply the relay gate to a candidate set, deduplicating. */
function allowed(ctx: RouterCtx, urls: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const url of urls) {
    if (ctx.isRelayAllowed(url)) out.add(url);
  }
  return [...out];
}

/**
 * Resolve the relay plan for a set of pubkeys. Returns the allowed relay set,
 * its provenance, and any pubkeys whose relay list was unavailable.
 */
async function resolvePlan(
  ctx: RouterCtx,
  pubkeys: string[],
  direction: 'read' | 'write',
  relayHints?: string[],
): Promise<OutboxRelayPlan> {
  const useWrite = direction === 'read';
  const collected = new Set<string>();
  const missingAuthors: string[] = [];
  let sawNip65 = false;

  if (pubkeys.length > 0) {
    const lists = await ctx.loadRelayLists(pubkeys);
    for (const pubkey of pubkeys) {
      const entry = lists.get(pubkey);
      const relays = entry ? (useWrite ? entry.write : entry.read) : undefined;
      if (relays && relays.length > 0) {
        sawNip65 = true;
        for (const url of relays) collected.add(url);
      } else {
        missingAuthors.push(pubkey);
      }
    }
  }

  // Relay hints from the napplet augment the plan, subject to the relay gate.
  for (const url of relayHints ?? []) collected.add(url);

  let relays = allowed(ctx, collected);
  let source: OutboxRelayPlan['source'];
  if (relays.length === 0) {
    relays = allowed(ctx, ctx.fallbackRelays);
    source = 'fallback';
  } else {
    // nip65 if any author list contributed; otherwise only hints did (policy).
    source = sawNip65 ? 'nip65' : 'policy';
  }

  const plan: OutboxRelayPlan = { relays, source };
  if (missingAuthors.length > 0) plan.missingAuthors = missingAuthors;
  return plan;
}

/** Mutable accumulator for a one-shot fan-out collection. */
interface Collector {
  seen: Map<string, NostrEvent>;
  relayMap: Map<string, Set<string>>;
  verifications: Promise<void>[];
}

/** Record that `id` was observed on `relayUrl`. */
function recordRelay(collector: Collector, id: string, relayUrl: string): void {
  let set = collector.relayMap.get(id);
  if (!set) { set = new Set<string>(); collector.relayMap.set(id, set); }
  set.add(relayUrl);
}

/** Verify a freshly-seen event and admit it (or drop its sightings) once settled. */
function admitEvent(ctx: RouterCtx, collector: Collector, event: NostrEvent): void {
  if (collector.seen.has(event.id)) return;
  collector.verifications.push(
    ctx.verify(event).then((ok) => {
      if (ok && !collector.seen.has(event.id)) collector.seen.set(event.id, event);
      else if (!ok) collector.relayMap.delete(event.id);
    }),
  );
}

/** Build the final query outcome from a settled collector. */
function buildCollectResult(
  collector: Collector,
  timedOut: boolean,
): { events: RelayEventResult[]; incomplete: boolean } {
  const events = [...collector.seen.values()].map((event) =>
    createRelayEventResultWithHints(event, [...(collector.relayMap.get(event.id) ?? [])]),
  );
  return { events, incomplete: timedOut };
}

/**
 * Fan a one-shot query out across `relayUrls` (one subscription per relay so
 * events can be attributed to their source relay), dedup by id, validate
 * signatures, and finalize on all-EOSE or timeout.
 */
function collectFromRelays(
  ctx: RouterCtx,
  filters: NostrFilter[],
  relayUrls: string[],
  timeoutMs: number,
): Promise<{ events: RelayEventResult[]; incomplete: boolean }> {
  return new Promise((resolve) => {
    const collector: Collector = { seen: new Map(), relayMap: new Map(), verifications: [] };
    const handles: { unsubscribe(): void }[] = [];
    let eoseCount = 0;
    let finished = false;
    let timedOut = false;

    function finalize(): void {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      for (const handle of handles) {
        try { handle.unsubscribe(); } catch { /* best-effort */ }
      }
      void Promise.all(collector.verifications).then(() => resolve(buildCollectResult(collector, timedOut)));
    }

    const timer = setTimeout(() => { timedOut = true; finalize(); }, timeoutMs);

    for (const relayUrl of relayUrls) {
      handles.push(relayPoolSubscribe(ctx, filters, relayUrl, (item) => {
        if (finished) return;
        if (item === 'EOSE') {
          eoseCount += 1;
          if (eoseCount >= relayUrls.length) finalize();
          return;
        }
        recordRelay(collector, item.id, relayUrl);
        admitEvent(ctx, collector, item);
      }));
    }

    if (relayUrls.length === 0) finalize();
  });
}

/** Thin wrapper so callers read as a single-relay subscribe. */
function relayPoolSubscribe(
  ctx: RouterCtx,
  filters: NostrFilter[],
  relayUrl: string,
  cb: (item: NostrEvent | 'EOSE') => void,
): { unsubscribe(): void } {
  return ctx.relayPool.subscribe(filters, [relayUrl], cb);
}

async function queryImpl(ctx: RouterCtx, filters: NostrFilter[], options?: OutboxQueryOptions): Promise<OutboxResult> {
  if (!ctx.relayPool.isAvailable()) {
    return { events: [], incomplete: true, error: 'relay list unavailable' };
  }
  const authors = deriveAuthors(filters, options?.authors);
  const plan = await resolvePlan(ctx, authors, 'read', options?.relays);
  if (plan.relays.length === 0) {
    return { events: [], incomplete: true, error: 'relay list unavailable' };
  }

  const timeoutMs = options?.timeoutMs ?? ctx.defaultTimeoutMs;
  const collected = await collectFromRelays(ctx, filters, plan.relays, timeoutMs);

  const incomplete = collected.incomplete || (plan.missingAuthors?.length ?? 0) > 0;
  let events = collected.events;
  if (options?.limit !== undefined && events.length > options.limit) {
    events = [...events].sort((a, b) => b.event.created_at - a.event.created_at).slice(0, options.limit);
  }
  const result: OutboxResult = { events };
  if (incomplete) result.incomplete = true;
  return result;
}

async function getEventImpl(ctx: RouterCtx, eventId: string, options?: OutboxEventOptions): Promise<OutboxEventResult> {
  if (typeof eventId !== 'string' || eventId.length === 0) {
    return { error: 'invalid filter' };
  }

  const filter: NostrFilter = { ids: [eventId] };
  const queryOptions: OutboxQueryOptions = { limit: 1 };
  if (typeof options?.author === 'string' && options.author.length > 0) {
    filter.authors = [options.author];
    queryOptions.authors = [options.author];
  }
  if (Array.isArray(options?.relays)) queryOptions.relays = options.relays;
  if (options?.timeoutMs !== undefined) queryOptions.timeoutMs = options.timeoutMs;

  const queryResult = await queryImpl(ctx, [filter], queryOptions);
  const eventResult = queryResult.events.find((candidate) => candidate.event.id === eventId);
  const result: OutboxEventResult = {};
  if (eventResult) result.result = eventResult;
  if (!eventResult) result.error = queryResult.error ?? 'not found';
  else if (queryResult.error !== undefined) result.error = queryResult.error;
  if (queryResult.incomplete !== undefined) result.incomplete = queryResult.incomplete;
  return result;
}

/** Tracks an outbox subscription across its per-relay fan-out. */
interface LiveSub {
  handles: { unsubscribe(): void }[];
  seen: Set<string>;
  closed: boolean;
}

function closeLiveSub(sub: LiveSub): void {
  for (const handle of sub.handles) {
    try { handle.unsubscribe(); } catch { /* best-effort */ }
  }
  sub.handles.length = 0;
}

/** Wire one relay's subscription into an outbox subscription's event flow. */
function attachLiveRelay(
  ctx: RouterCtx,
  sub: LiveSub,
  filters: NostrFilter[],
  relayUrl: string,
  sink: OutboxSubscriptionSink,
): void {
  sub.handles.push(relayPoolSubscribe(ctx, filters, relayUrl, (item) => {
    if (sub.closed) return;
    if (item === 'EOSE') return;
    if (sub.seen.has(item.id)) return;
    void ctx.verify(item).then((ok) => {
      if (!ok || sub.closed || sub.seen.has(item.id)) return;
      sub.seen.add(item.id);
      sink.event(createRelayEventResultWithHints(item, [relayUrl]));
    });
  }));
}

function startSubscription(
  ctx: RouterCtx,
  filters: NostrFilter[],
  options: OutboxSubscribeOptions | undefined,
  sink: OutboxSubscriptionSink,
): OutboxRouterSubscription {
  const authors = deriveAuthors(filters, options?.authors);
  const sub: LiveSub = { handles: [], seen: new Set(), closed: false };

  void resolvePlan(ctx, authors, 'read', options?.relays)
    .then((plan) => {
      if (sub.closed) return;
      if (plan.relays.length === 0) { sink.closed('relay list unavailable'); return; }
      for (const relayUrl of plan.relays) attachLiveRelay(ctx, sub, filters, relayUrl, sink);
    })
    .catch((err) => {
      if (!sub.closed) sink.closed(err instanceof Error ? err.message : 'subscribe failed');
    });

  return {
    close(): void {
      if (sub.closed) return;
      sub.closed = true;
      closeLiveSub(sub);
    },
  };
}

/** Resolve the full write/inbox/hint relay set a publish should fan out to. */
async function resolvePublishTargets(
  ctx: RouterCtx,
  signed: NostrEvent,
  options?: OutboxPublishOptions,
): Promise<string[]> {
  const targets = new Set<string>();

  // The author's own write relays (outbox model for the user's own event).
  const authorPlan = await resolvePlan(ctx, [signed.pubkey], 'read');
  for (const url of authorPlan.relays) targets.add(url);

  // Directed events: include recipients' read relays (their inbox).
  if (options?.targetAuthors && options.targetAuthors.length > 0) {
    const inboxPlan = await resolvePlan(ctx, options.targetAuthors, 'write');
    for (const url of inboxPlan.relays) targets.add(url);
  }

  for (const url of options?.relays ?? []) targets.add(url);
  return allowed(ctx, targets);
}

async function publishImpl(ctx: RouterCtx, template: EventTemplate, options?: OutboxPublishOptions): Promise<OutboxPublishResult> {
  if (!ctx.signEvent) return { ok: false, error: 'publish denied' };
  if (!ctx.relayPool.isAvailable()) return { ok: false, error: 'relay list unavailable' };

  let signed: NostrEvent;
  try {
    signed = await ctx.signEvent(template);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'sign failed' };
  }

  const relayUrls = await resolvePublishTargets(ctx, signed, options);
  if (relayUrls.length === 0) return { ok: false, event: signed, eventId: signed.id, error: 'relay list unavailable' };

  let relays: Record<string, boolean>;
  try {
    relays = normalizePublishResult(await ctx.relayPool.publish(signed, relayUrls), relayUrls);
  } catch (err) {
    return { ok: false, event: signed, eventId: signed.id, error: err instanceof Error ? err.message : 'publish failed' };
  }

  const ok = Object.values(relays).some(Boolean);
  const result: OutboxPublishResult = { ok, event: signed, eventId: signed.id, relays };
  if (!ok) result.error = 'publish denied';
  return result;
}

/**
 * Create a relay-pool-backed {@link OutboxRouter}.
 *
 * @param options - Relay pool, NIP-65 loader, fallback relays, and optional
 *   signer / verifier / relay gate / timeout.
 * @returns An {@link OutboxRouter} for {@link createOutboxService}.
 * @throws If `relayPool`, `loadRelayLists`, or `fallbackRelays` are missing.
 */
export function createRelayPoolOutboxRouter(options: RelayPoolOutboxRouterOptions): OutboxRouter {
  if (!options || typeof options.relayPool !== 'object' || options.relayPool === null) {
    throw new Error('createRelayPoolOutboxRouter: options.relayPool is required');
  }
  if (typeof options.loadRelayLists !== 'function') {
    throw new Error('createRelayPoolOutboxRouter: options.loadRelayLists is required');
  }
  if (!Array.isArray(options.fallbackRelays)) {
    throw new Error('createRelayPoolOutboxRouter: options.fallbackRelays is required');
  }

  const verifyEvent = options.verifyEvent;
  const ctx: RouterCtx = {
    relayPool: options.relayPool,
    loadRelayLists: options.loadRelayLists,
    fallbackRelays: options.fallbackRelays,
    signEvent: options.signEvent,
    isRelayAllowed: options.isRelayAllowed ?? defaultRelayAllowed,
    defaultTimeoutMs: options.defaultTimeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS,
    async verify(event: NostrEvent): Promise<boolean> {
      if (!verifyEvent) return true;
      try {
        return await verifyEvent(event);
      } catch {
        return false;
      }
    },
  };

  return {
    getEvent: (eventId, eventOptions) => getEventImpl(ctx, eventId, eventOptions),
    query: (filters, queryOptions) => queryImpl(ctx, filters, queryOptions),
    subscribe: (filters, subscribeOptions, sink) => startSubscription(ctx, filters, subscribeOptions, sink),
    publish: (template, publishOptions) => publishImpl(ctx, template, publishOptions),
    resolveRelays: (target: OutboxTarget) => {
      const pubkeys = target.authors ?? (target.pubkey ? [target.pubkey] : []);
      return resolvePlan(ctx, pubkeys, target.direction ?? 'read');
    },
  };
}

/** Normalize a pool publish return into a per-relay success map. */
function normalizePublishResult(
  res: Record<string, boolean> | void,
  relayUrls: string[],
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (res && typeof res === 'object') {
    for (const url of relayUrls) out[url] = res[url] ?? false;
  } else {
    // void return → optimistic success on every targeted relay.
    for (const url of relayUrls) out[url] = true;
  }
  return out;
}
