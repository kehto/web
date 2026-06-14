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
 * `strategy` overrides the direction default: `outbox` forces write relays,
 * `inbox` forces read relays, `auto` (default) follows the read/write direction.
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
import type {
  OutboxRouter,
  OutboxResult,
  OutboxPublishResult,
  OutboxRelayPlan,
  OutboxQueryOptions,
  OutboxSubscribeOptions,
  OutboxPublishOptions,
  OutboxStrategy,
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
 * relay NUB pool, both methods take an explicit relay-URL set so the router
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

/**
 * Whether a resolved plan should use authors' write relays (true) or read
 * relays (false), given the read/write direction and an explicit strategy.
 */
function wantsWriteRelays(direction: 'read' | 'write', strategy: OutboxStrategy): boolean {
  if (strategy === 'outbox') return true;
  if (strategy === 'inbox') return false;
  return direction === 'read'; // auto: reading → author write relays
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

  const {
    relayPool,
    loadRelayLists,
    fallbackRelays,
    signEvent,
    verifyEvent,
    isRelayAllowed = defaultRelayAllowed,
    defaultTimeoutMs = DEFAULT_QUERY_TIMEOUT_MS,
  } = options;

  function allowedRelays(urls: Iterable<string>): string[] {
    const out = new Set<string>();
    for (const url of urls) {
      if (isRelayAllowed(url)) out.add(url);
    }
    return [...out];
  }

  async function verify(event: NostrEvent): Promise<boolean> {
    if (!verifyEvent) return true;
    try {
      return await verifyEvent(event);
    } catch {
      return false;
    }
  }

  /**
   * Resolve the relay plan for a set of pubkeys. Returns the allowed relay set,
   * its provenance, and any pubkeys whose relay list was unavailable.
   */
  async function resolvePlan(
    pubkeys: string[],
    direction: 'read' | 'write',
    strategy: OutboxStrategy,
    relayHints?: string[],
  ): Promise<OutboxRelayPlan> {
    const useWrite = wantsWriteRelays(direction, strategy);
    const collected = new Set<string>();
    const missingAuthors: string[] = [];
    let sawNip65 = false;

    if (pubkeys.length > 0) {
      const lists = await loadRelayLists(pubkeys);
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

    let relays = allowedRelays(collected);
    let source: OutboxRelayPlan['source'];
    if (relays.length === 0) {
      relays = allowedRelays(fallbackRelays);
      source = 'fallback';
    } else if (sawNip65) {
      source = 'nip65';
    } else {
      // Only relay hints contributed — treat as a policy-derived plan.
      source = 'policy';
    }

    const plan: OutboxRelayPlan = { relays, source };
    if (missingAuthors.length > 0) plan.missingAuthors = missingAuthors;
    return plan;
  }

  async function query(filters: NostrFilter[], queryOptions?: OutboxQueryOptions): Promise<OutboxResult> {
    if (!relayPool.isAvailable()) {
      return { events: [], relays: {}, incomplete: true, error: 'relay list unavailable' };
    }
    const strategy = queryOptions?.strategy ?? 'auto';
    const authors = deriveAuthors(filters, queryOptions?.authors);
    const plan = await resolvePlan(authors, 'read', strategy, queryOptions?.relays);
    if (plan.relays.length === 0) {
      return { events: [], relays: {}, incomplete: true, error: 'relay list unavailable' };
    }

    const timeoutMs = queryOptions?.timeoutMs ?? defaultTimeoutMs;
    const collected = await collectFromRelays(filters, plan.relays, timeoutMs);

    const incomplete = collected.incomplete || (plan.missingAuthors?.length ?? 0) > 0;
    let events = collected.events;
    if (queryOptions?.limit !== undefined && events.length > queryOptions.limit) {
      events = [...events].sort((a, b) => b.created_at - a.created_at).slice(0, queryOptions.limit);
    }
    const result: OutboxResult = { events, relays: collected.relayMap };
    if (incomplete) result.incomplete = true;
    return result;
  }

  /**
   * Fan a one-shot query out across `relayUrls` (one subscription per relay so
   * events can be attributed to their source relay), dedup by id, validate
   * signatures, and finalize on all-EOSE or timeout.
   */
  function collectFromRelays(
    filters: NostrFilter[],
    relayUrls: string[],
    timeoutMs: number,
  ): Promise<{ events: NostrEvent[]; relayMap: Record<string, string[]>; incomplete: boolean }> {
    return new Promise((resolve) => {
      const seen = new Map<string, NostrEvent>();
      const relayMap = new Map<string, Set<string>>();
      const verifications: Promise<void>[] = [];
      const handles: { unsubscribe(): void }[] = [];
      let eoseCount = 0;
      let finished = false;
      let timedOut = false;

      function recordRelay(id: string, relayUrl: string): void {
        let set = relayMap.get(id);
        if (!set) { set = new Set<string>(); relayMap.set(id, set); }
        set.add(relayUrl);
      }

      function finalize(): void {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        for (const handle of handles) {
          try { handle.unsubscribe(); } catch { /* best-effort */ }
        }
        void Promise.all(verifications).then(() => {
          const events = [...seen.values()];
          const relayObj: Record<string, string[]> = {};
          for (const event of events) relayObj[event.id] = [...(relayMap.get(event.id) ?? [])];
          resolve({ events, relayMap: relayObj, incomplete: timedOut });
        });
      }

      const timer = setTimeout(() => { timedOut = true; finalize(); }, timeoutMs);

      for (const relayUrl of relayUrls) {
        const handle = relayPool.subscribe(filters, [relayUrl], (item) => {
          if (finished) return;
          if (item === 'EOSE') {
            eoseCount += 1;
            if (eoseCount >= relayUrls.length) finalize();
            return;
          }
          // Always record the relay sighting; only the first valid copy is kept.
          recordRelay(item.id, relayUrl);
          if (seen.has(item.id)) return;
          const pending = verify(item).then((ok) => {
            if (ok && !seen.has(item.id)) seen.set(item.id, item);
            else if (!ok) relayMap.delete(item.id); // drop sightings for rejected events
          });
          verifications.push(pending);
        });
        handles.push(handle);
      }

      // No relays to subscribe to (shouldn't happen — guarded by callers).
      if (relayUrls.length === 0) finalize();
    });
  }

  function subscribe(
    filters: NostrFilter[],
    subscribeOptions: OutboxSubscribeOptions | undefined,
    sink: OutboxSubscriptionSink,
  ): OutboxRouterSubscription {
    const live = subscribeOptions?.live ?? true;
    const strategy = subscribeOptions?.strategy ?? 'auto';
    const authors = deriveAuthors(filters, subscribeOptions?.authors);
    const handles: { unsubscribe(): void }[] = [];
    const seen = new Set<string>();
    let closed = false;
    let eoseCount = 0;
    let relayCount = 0;
    let eoseSent = false;

    function closeAll(): void {
      for (const handle of handles) {
        try { handle.unsubscribe(); } catch { /* best-effort */ }
      }
      handles.length = 0;
    }

    void resolvePlan(authors, 'read', strategy, subscribeOptions?.relays).then((plan) => {
      if (closed) return;
      if (plan.relays.length === 0) {
        sink.closed('relay list unavailable');
        return;
      }
      relayCount = plan.relays.length;
      for (const relayUrl of plan.relays) {
        const handle = relayPool.subscribe(filters, [relayUrl], (item) => {
          if (closed) return;
          if (item === 'EOSE') {
            eoseCount += 1;
            if (!eoseSent && eoseCount >= relayCount) {
              eoseSent = true;
              sink.eose();
              if (!live) { closed = true; closeAll(); sink.closed(); }
            }
            return;
          }
          if (seen.has(item.id)) return;
          void verify(item).then((ok) => {
            if (!ok || closed || seen.has(item.id)) return;
            seen.add(item.id);
            sink.event(item, relayUrl);
          });
        });
        handles.push(handle);
      }
    }).catch((err) => {
      if (!closed) sink.closed(err instanceof Error ? err.message : 'subscribe failed');
    });

    return {
      close(): void {
        if (closed) return;
        closed = true;
        closeAll();
      },
    };
  }

  async function publish(template: EventTemplate, publishOptions?: OutboxPublishOptions): Promise<OutboxPublishResult> {
    if (!signEvent) return { ok: false, error: 'publish denied' };
    if (!relayPool.isAvailable()) return { ok: false, error: 'relay list unavailable' };

    let signed: NostrEvent;
    try {
      signed = await signEvent(template);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'sign failed' };
    }

    const strategy = publishOptions?.strategy ?? 'auto';
    const targets = new Set<string>();

    // The author's own write relays (outbox model for the user's own event).
    const authorPlan = await resolvePlan([signed.pubkey], 'read', strategy === 'inbox' ? 'auto' : 'outbox');
    for (const url of authorPlan.relays) targets.add(url);

    // Directed events: include recipients' read relays (their inbox).
    if (publishOptions?.targetAuthors && publishOptions.targetAuthors.length > 0) {
      const inboxPlan = await resolvePlan(publishOptions.targetAuthors, 'write', 'inbox');
      for (const url of inboxPlan.relays) targets.add(url);
    }

    for (const url of publishOptions?.relays ?? []) targets.add(url);

    const relayUrls = allowedRelays(targets);
    if (relayUrls.length === 0) return { ok: false, event: signed, eventId: signed.id, error: 'relay list unavailable' };

    let relays: Record<string, boolean>;
    try {
      const res = await relayPool.publish(signed, relayUrls);
      relays = normalizePublishResult(res, relayUrls);
    } catch (err) {
      return { ok: false, event: signed, eventId: signed.id, error: err instanceof Error ? err.message : 'publish failed' };
    }

    const ok = Object.values(relays).some(Boolean);
    const result: OutboxPublishResult = { ok, event: signed, eventId: signed.id, relays };
    if (!ok) result.error = 'publish denied';
    return result;
  }

  async function resolveRelays(target: OutboxTarget): Promise<OutboxRelayPlan> {
    const pubkeys = target.authors ?? (target.pubkey ? [target.pubkey] : []);
    const direction = target.direction ?? 'read';
    const strategy = target.strategy ?? 'auto';
    return resolvePlan(pubkeys, direction, strategy);
  }

  return { query, subscribe, publish, resolveRelays };
}

/** Normalize a pool publish return into a per-relay success map. */
function normalizePublishResult(
  res: Record<string, boolean> | void,
  relayUrls: string[],
): Record<string, boolean> {
  if (res && typeof res === 'object') {
    const out: Record<string, boolean> = {};
    for (const url of relayUrls) out[url] = res[url] ?? false;
    return out;
  }
  // void return → optimistic success on every targeted relay.
  const out: Record<string, boolean> = {};
  for (const url of relayUrls) out[url] = true;
  return out;
}
