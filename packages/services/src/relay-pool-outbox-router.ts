/**
 * relay-pool-outbox-router.ts — concrete {@link StreamingOutboxRouter} backed by a relay pool.
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
  OutboxQueryStream,
  OutboxQueryStreamSink,
  StreamingOutboxRouter,
} from './outbox-service.js';
import type {
  DiscoveredReadRelays,
  LiveOutboxSubscription,
  OutboxCollector,
  PublishTargetResolution,
  RelayListEntry,
  RelayPoolOutboxRouterOptions,
  RequiredRelayResolution,
  RouterCtx,
} from './relay-pool-outbox-types.js';

export type {
  OutboxRelayPool,
  RelayListEntry,
  RelayPoolOutboxRouterOptions,
} from './relay-pool-outbox-types.js';

// Timer globals available in all JS runtimes.
declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(id: unknown): void;

/** Default per-query wall-clock budget when `options.timeoutMs` is unset. */
const DEFAULT_QUERY_TIMEOUT_MS = 4000;

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

async function resolveRequiredRelays(
  ctx: RouterCtx,
  pubkeys: string[],
  direction: 'read' | 'write',
): Promise<RequiredRelayResolution> {
  const useWrite = direction === 'read';
  const relays = new Set<string>();
  const missingAuthors: string[] = [];
  const deniedAuthors: string[] = [];
  const uniquePubkeys = [...new Set(pubkeys)];

  if (uniquePubkeys.length === 0) return { relays: [], missingAuthors, deniedAuthors };

  const lists = await ctx.loadRelayLists(uniquePubkeys);
  for (const pubkey of uniquePubkeys) {
    const entry = lists.get(pubkey);
    const candidateRelays = entry ? (useWrite ? entry.write : entry.read) : undefined;
    if (!candidateRelays || candidateRelays.length === 0) {
      missingAuthors.push(pubkey);
      continue;
    }

    const allowedRelays = allowed(ctx, candidateRelays);
    if (allowedRelays.length === 0) {
      deniedAuthors.push(pubkey);
      continue;
    }

    for (const url of allowedRelays) relays.add(url);
  }

  return { relays: [...relays], missingAuthors, deniedAuthors };
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

/** Extract policy-allowed author write relays from already-loaded NIP-65 data. */
function discoveredReadRelays(
  ctx: RouterCtx,
  authors: string[],
  lists: Map<string, RelayListEntry>,
): DiscoveredReadRelays {
  const relays = new Set<string>();
  const missingAuthors: string[] = [];
  for (const author of new Set(authors)) {
    const writeRelays = lists.get(author)?.write;
    if (!writeRelays || writeRelays.length === 0) {
      missingAuthors.push(author);
      continue;
    }
    for (const url of allowed(ctx, writeRelays)) relays.add(url);
  }
  return { relays: [...relays], missingAuthors };
}

/** Pick immediate policy hints, falling back only when none survive validation. */
function immediateReadRelays(ctx: RouterCtx, relayHints?: string[]): string[] {
  const hints = allowed(ctx, relayHints ?? []);
  return hints.length > 0 ? hints : allowed(ctx, ctx.fallbackRelays);
}

/** Record that `id` was observed on `relayUrl`. */
function recordRelay(collector: OutboxCollector, id: string, relayUrl: string): void {
  let set = collector.relayMap.get(id);
  if (!set) { set = new Set<string>(); collector.relayMap.set(id, set); }
  set.add(relayUrl);
}

/** Materialize one event using every relay sighting known at call time. */
function collectedEventResult(collector: OutboxCollector, event: NostrEvent): RelayEventResult {
  return createRelayEventResultWithHints(event, [...(collector.relayMap.get(event.id) ?? [])]);
}

/** Verify one event id once, then stream it and wake completion checks. */
function admitEvent(
  ctx: RouterCtx,
  collector: OutboxCollector,
  event: NostrEvent,
  sink: OutboxQueryStreamSink,
  isOpen: () => boolean,
  onSettled: () => void,
): void {
  if (collector.admitted.has(event.id)) return;
  collector.admitted.add(event.id);
  collector.pendingVerifications += 1;
  void ctx.verify(event).then((ok) => {
    if (!isOpen()) return;
    if (!ok) {
      collector.relayMap.delete(event.id);
      return;
    }
    collector.seen.set(event.id, event);
    try {
      sink.event(collectedEventResult(collector, event));
    } catch {
      // A consumer callback cannot poison relay collection or completion.
    }
  }).finally(() => {
    collector.pendingVerifications -= 1;
    onSettled();
  });
}

/** Build the compatibility aggregate without changing its existing limit rule. */
function buildQueryResult(
  collector: OutboxCollector,
  options: OutboxQueryOptions | undefined,
  incomplete: boolean,
  subscribedAny: boolean,
): OutboxResult {
  let events = [...collector.seen.values()].map((event) => collectedEventResult(collector, event));
  if (options?.limit !== undefined && events.length > options.limit) {
    events = [...events].sort((a, b) => b.event.created_at - a.event.created_at).slice(0, options.limit);
  }
  const result: OutboxResult = { events };
  if (incomplete || !subscribedAny) result.incomplete = true;
  if (!subscribedAny) result.error = 'relay list unavailable';
  return result;
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

function startQueryImpl(
  ctx: RouterCtx,
  filters: NostrFilter[],
  options: OutboxQueryOptions | undefined,
  sink: OutboxQueryStreamSink,
): OutboxQueryStream {
  if (!ctx.relayPool.isAvailable()) {
    return {
      result: Promise.resolve({ events: [], incomplete: true, error: 'relay list unavailable' }),
      close(): void { /* no relay handles */ },
    };
  }

  const authors = deriveAuthors(filters, options?.authors);
  const collector: OutboxCollector = {
    seen: new Map(),
    admitted: new Set(),
    relayMap: new Map(),
    pendingVerifications: 0,
  };
  const handles = new Map<string, { unsubscribe(): void }>();
  const activeRelays = new Set<string>();
  const eoseRelays = new Set<string>();
  let discoveryPending = authors.length > 0;
  let incomplete = false;
  let subscribedAny = false;
  let finished = false;
  let resolveResult!: (result: OutboxResult) => void;
  const result = new Promise<OutboxResult>((resolve) => { resolveResult = resolve; });
  let timer: unknown;

  function closeHandles(): void {
    for (const handle of handles.values()) {
      try { handle.unsubscribe(); } catch { /* best-effort */ }
    }
    handles.clear();
  }

  function finalize(forceIncomplete = false): void {
    if (finished) return;
    finished = true;
    incomplete ||= forceIncomplete;
    clearTimeout(timer);
    closeHandles();
    resolveResult(buildQueryResult(collector, options, incomplete, subscribedAny));
  }

  function maybeFinalize(): void {
    if (finished || discoveryPending || collector.pendingVerifications > 0) return;
    if (activeRelays.size === 0 || eoseRelays.size >= activeRelays.size) finalize();
  }

  function attachRelay(relayUrl: string): void {
    if (finished || activeRelays.has(relayUrl)) return;
    activeRelays.add(relayUrl);
    try {
      const handle = relayPoolSubscribe(ctx, filters, relayUrl, (item) => {
        if (finished) return;
        if (item === 'EOSE') {
          eoseRelays.add(relayUrl);
          maybeFinalize();
          return;
        }
        recordRelay(collector, item.id, relayUrl);
        admitEvent(ctx, collector, item, sink, () => !finished, maybeFinalize);
      });
      subscribedAny = true;
      if (finished) {
        try { handle.unsubscribe(); } catch { /* best-effort */ }
      } else {
        handles.set(relayUrl, handle);
      }
    } catch {
      activeRelays.delete(relayUrl);
      incomplete = true;
    }
  }

  function attachMany(relayUrls: Iterable<string>): void {
    for (const relayUrl of relayUrls) attachRelay(relayUrl);
  }

  timer = setTimeout(() => finalize(true), options?.timeoutMs ?? ctx.defaultTimeoutMs);

  if (authors.length === 0) {
    discoveryPending = false;
    attachMany(immediateReadRelays(ctx, options?.relays));
    maybeFinalize();
  } else {
    let loaded: Promise<Map<string, RelayListEntry>> | Map<string, RelayListEntry>;
    try {
      loaded = ctx.loadRelayLists(authors);
    } catch {
      discoveryPending = false;
      incomplete = true;
      attachMany(immediateReadRelays(ctx, options?.relays));
      maybeFinalize();
      return { result, close: () => finalize(true) };
    }

    if (loaded instanceof Map) {
      const discovery = discoveredReadRelays(ctx, authors, loaded);
      discoveryPending = false;
      incomplete ||= discovery.missingAuthors.length > 0;
      const initial = allowed(ctx, [...(options?.relays ?? []), ...discovery.relays]);
      attachMany(initial.length > 0 ? initial : allowed(ctx, ctx.fallbackRelays));
      maybeFinalize();
    } else {
      attachMany(immediateReadRelays(ctx, options?.relays));
      void Promise.resolve(loaded).then((lists) => {
        if (finished) return;
        const discovery = discoveredReadRelays(ctx, authors, lists);
        discoveryPending = false;
        incomplete ||= discovery.missingAuthors.length > 0;
        attachMany(discovery.relays);
        maybeFinalize();
      }).catch(() => {
        if (finished) return;
        discoveryPending = false;
        incomplete = true;
        maybeFinalize();
      });
    }
  }

  return { result, close: () => finalize(true) };
}

function queryImpl(ctx: RouterCtx, filters: NostrFilter[], options?: OutboxQueryOptions): Promise<OutboxResult> {
  return startQueryImpl(ctx, filters, options, { event: () => { /* aggregate only */ } }).result;
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

function closeLiveSub(sub: LiveOutboxSubscription): void {
  for (const handle of sub.handles.values()) {
    try { handle.unsubscribe(); } catch { /* best-effort */ }
  }
  sub.handles.clear();
}

/** Wire one relay's subscription into an outbox subscription's event flow. */
function attachLiveRelay(
  ctx: RouterCtx,
  sub: LiveOutboxSubscription,
  filters: NostrFilter[],
  relayUrl: string,
  sink: OutboxSubscriptionSink,
): boolean {
  if (sub.closed || sub.relays.has(relayUrl)) return false;
  sub.relays.add(relayUrl);
  try {
    const handle = relayPoolSubscribe(ctx, filters, relayUrl, (item) => {
      if (sub.closed || item === 'EOSE' || sub.admitted.has(item.id)) return;
      sub.admitted.add(item.id);
      void ctx.verify(item).then((ok) => {
        if (!ok || sub.closed || sub.seen.has(item.id)) return;
        sub.seen.add(item.id);
        sink.event(createRelayEventResultWithHints(item, [relayUrl]));
      });
    });
    if (sub.closed) {
      try { handle.unsubscribe(); } catch { /* best-effort */ }
    } else {
      sub.handles.set(relayUrl, handle);
    }
    return true;
  } catch {
    sub.relays.delete(relayUrl);
    return false;
  }
}

function startSubscription(
  ctx: RouterCtx,
  filters: NostrFilter[],
  options: OutboxSubscribeOptions | undefined,
  sink: OutboxSubscriptionSink,
): OutboxRouterSubscription {
  const authors = deriveAuthors(filters, options?.authors);
  const sub: LiveOutboxSubscription = {
    handles: new Map(),
    relays: new Set(),
    admitted: new Set(),
    seen: new Set(),
    closed: false,
  };
  let discoveryOpen = authors.length > 0;
  let discoveryTimer: unknown;

  function attachMany(relayUrls: Iterable<string>): void {
    for (const relayUrl of relayUrls) attachLiveRelay(ctx, sub, filters, relayUrl, sink);
  }

  function closeUnavailable(): void {
    if (sub.closed || sub.handles.size > 0) return;
    sub.closed = true;
    sink.closed('relay list unavailable');
  }

  if (!ctx.relayPool.isAvailable()) {
    closeUnavailable();
  } else if (authors.length === 0) {
    discoveryOpen = false;
    attachMany(immediateReadRelays(ctx, options?.relays));
    closeUnavailable();
  } else {
    let loaded: Promise<Map<string, RelayListEntry>> | Map<string, RelayListEntry>;
    try {
      loaded = ctx.loadRelayLists(authors);
    } catch {
      discoveryOpen = false;
      attachMany(immediateReadRelays(ctx, options?.relays));
      closeUnavailable();
      loaded = new Map();
    }

    if (discoveryOpen && loaded instanceof Map) {
      const discovery = discoveredReadRelays(ctx, authors, loaded);
      discoveryOpen = false;
      const initial = allowed(ctx, [...(options?.relays ?? []), ...discovery.relays]);
      attachMany(initial.length > 0 ? initial : allowed(ctx, ctx.fallbackRelays));
      closeUnavailable();
    } else if (discoveryOpen) {
      attachMany(immediateReadRelays(ctx, options?.relays));
      discoveryTimer = setTimeout(() => {
        discoveryOpen = false;
        closeUnavailable();
      }, options?.timeoutMs ?? ctx.defaultTimeoutMs);
      void Promise.resolve(loaded).then((lists) => {
        if (!discoveryOpen || sub.closed) return;
        discoveryOpen = false;
        clearTimeout(discoveryTimer);
        attachMany(discoveredReadRelays(ctx, authors, lists).relays);
        closeUnavailable();
      }).catch(() => {
        if (!discoveryOpen || sub.closed) return;
        discoveryOpen = false;
        clearTimeout(discoveryTimer);
        closeUnavailable();
      });
    }
  }

  return {
    close(): void {
      if (sub.closed) return;
      sub.closed = true;
      discoveryOpen = false;
      clearTimeout(discoveryTimer);
      closeLiveSub(sub);
    },
  };
}

/** Resolve the full write/inbox/hint relay set a publish should fan out to. */
async function resolvePublishTargets(
  ctx: RouterCtx,
  signed: NostrEvent,
  options?: OutboxPublishOptions,
): Promise<PublishTargetResolution> {
  const targets = new Set<string>();
  const requiredTargets = new Set<string>();

  if (options?.toOutbox !== false) {
    // The author's own write relays (outbox model for the user's own event).
    const outboxPlan = await resolveRequiredRelays(ctx, [signed.pubkey], 'read');
    if (outboxPlan.missingAuthors.length > 0) return { relayUrls: [], requiredRelayUrls: [], error: 'relay list unavailable' };
    if (outboxPlan.deniedAuthors.length > 0) return { relayUrls: [], requiredRelayUrls: [], error: 'policy denied' };
    for (const url of outboxPlan.relays) {
      targets.add(url);
      requiredTargets.add(url);
    }
  }

  if (options?.toInboxes && options.toInboxes.length > 0) {
    const inboxPlan = await resolveRequiredRelays(ctx, options.toInboxes, 'write');
    if (inboxPlan.missingAuthors.length > 0) return { relayUrls: [], requiredRelayUrls: [], error: 'relay list unavailable' };
    if (inboxPlan.deniedAuthors.length > 0) return { relayUrls: [], requiredRelayUrls: [], error: 'policy denied' };
    for (const url of inboxPlan.relays) {
      targets.add(url);
      requiredTargets.add(url);
    }
  }

  for (const url of options?.relays ?? []) targets.add(url);
  return {
    relayUrls: allowed(ctx, targets),
    requiredRelayUrls: allowed(ctx, requiredTargets),
  };
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

  const publishTargets = await resolvePublishTargets(ctx, signed, options);
  if (publishTargets.error) {
    return { ok: false, event: signed, eventId: signed.id, error: publishTargets.error };
  }
  const relayUrls = publishTargets.relayUrls;
  if (relayUrls.length === 0) return { ok: false, event: signed, eventId: signed.id, error: 'relay list unavailable' };

  let relays: Record<string, boolean>;
  try {
    relays = normalizePublishResult(await ctx.relayPool.publish(signed, relayUrls), relayUrls);
  } catch (err) {
    return { ok: false, event: signed, eventId: signed.id, error: err instanceof Error ? err.message : 'publish failed' };
  }

  const ok = publishTargets.requiredRelayUrls.length > 0
    ? publishTargets.requiredRelayUrls.every((url) => relays[url] === true)
    : Object.values(relays).some(Boolean);
  const result: OutboxPublishResult = { ok, event: signed, eventId: signed.id, relays };
  if (!ok) result.error = 'publish denied';
  return result;
}

/**
 * Create a relay-pool-backed {@link StreamingOutboxRouter}.
 *
 * @param options - Relay pool, NIP-65 loader, fallback relays, and optional
 *   signer / verifier / relay gate / timeout.
 * @returns A {@link StreamingOutboxRouter} for direct incremental reads and
 *   compatibility use through {@link createOutboxService}.
 * @throws If `relayPool`, `loadRelayLists`, or `fallbackRelays` are missing.
 */
export function createRelayPoolOutboxRouter(options: RelayPoolOutboxRouterOptions): StreamingOutboxRouter {
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
    queryStream: (filters, queryOptions, sink) => startQueryImpl(ctx, filters, queryOptions, sink),
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
