import type { NostrEvent } from '@napplet/core';
import type { ApprovalSignal, RelayEventResult } from '@kehto/runtime';
import type {
  OutboxResult,
  OutboxRouter,
  StreamingOutboxRouter,
} from '@kehto/services';

import { matchesAnyFilter } from './browser-relay-runtime.js';

/** Dependencies Paja supplies to its private active-account social snapshot. */
export interface PajaSocialCacheOptions {
  /** The one host-owned router used for profile warming. */
  readonly baseRouter: OutboxRouter;
  /** Reads raw contact-list candidates through Paja's existing bootstrap relays. */
  readonly loadContactList: (pubkey: string, signal?: AbortSignal) => Promise<NostrEvent[]>;
  /** Verifies an untrusted contact-list candidate before it is used. */
  readonly verifyEvent: (event: NostrEvent) => boolean | Promise<boolean>;
  /** Returns the active Paja account, if present. */
  readonly getActivePubkey: () => string | null;
  /** Observes signer transitions without exposing cache state to napplets. */
  readonly subscribeSignerChange?: (listener: () => void) => () => void;
}

/** Paja-private social-cache operations used only by browser adapter composition. */
export interface PajaSocialCache {
  /** Returns a copied, normalized follow list for the request-start account key. */
  getFollows(pubkey: string): Promise<string[]>;
  /** Refreshes the active account without delaying adapter construction. */
  refreshActiveIdentity(): Promise<void>;
  /**
   * Decorates the existing router while preserving its non-query operations.
   *
   * @param canReadIdentity - Source-bound authorization for private cache augmentation.
   */
  decorate(router: OutboxRouter, canReadIdentity?: () => boolean): OutboxRouter & Partial<StreamingOutboxRouter>;
  /** Removes the signer-change observer. */
  dispose(): void;
}

interface SocialSnapshot {
  readonly follows: string[];
  readonly profiles: Map<string, RelayEventResult>;
}

// Authority: NAP-IDENTITY master 5ac0490 and NAP-OUTBOX draft PR #32
// 4589a8f9a16d8aa29b3740e2b3b0cdca11e0976e. Outbox remains draft-scoped,
// so this implementation makes no current-master OUTBOX conformance claim.
const HEX_PUBKEY = /^[0-9a-f]{64}$/i;
/** Bounds synchronous follow-tag processing before yielding to the event loop. */
const FOLLOW_PARSE_YIELD_EVERY = 64;
/** Bounds sequential profile queries before yielding to the event loop. */
const PROFILE_WARM_YIELD_EVERY = 64;

/**
 * Creates Paja's memory-only, account-scoped social cache.
 *
 * The cache is intentionally not re-exported from Paja's package entrypoint.
 * NAPplets use ordinary identity and outbox messages; Paja retains relay,
 * verification, and cache authority behind those standard services.
 */
export function createPajaSocialCache(options: PajaSocialCacheOptions): PajaSocialCache {
  let generation = 0;
  let activeRefreshController: AbortController | undefined;
  const snapshots = new Map<string, SocialSnapshot>();

  async function loadFollows(capturedPubkey: string): Promise<string[]> {
    const normalizedPubkey = normalizePubkey(capturedPubkey);
    if (!normalizedPubkey) return [];
    const existing = snapshots.get(normalizedPubkey);
    if (existing) return [...existing.follows];

    const capturedGeneration = generation;
    const follows = await verifiedFollows(normalizedPubkey);
    const warmed = snapshots.get(normalizedPubkey);
    if (warmed) return [...warmed.follows];
    if (generation === capturedGeneration) {
      snapshots.set(normalizedPubkey, { follows, profiles: new Map() });
    }
    return [...follows];
  }

  async function verifiedFollows(
    capturedPubkey: string,
    isStillCurrent?: () => boolean,
    signal?: AbortSignal,
  ): Promise<string[]> {
    const candidates = await options.loadContactList(capturedPubkey, signal);
    const verified: NostrEvent[] = [];
    for (const candidate of candidates) {
      if (isStillCurrent && !isStillCurrent()) return [];
      if (!isContactCandidate(candidate, capturedPubkey)) continue;
      try {
        if (await options.verifyEvent(candidate)) verified.push(candidate);
      } catch {
        // An unverifiable relay event cannot influence the active social graph.
      }
    }
    return contactPubkeys(selectReplacement(verified), isStillCurrent);
  }

  async function refreshActiveIdentity(): Promise<void> {
    activeRefreshController?.abort();
    activeRefreshController = undefined;
    const currentGeneration = ++generation;
    const capturedPubkey = normalizePubkey(options.getActivePubkey() ?? '');
    if (!capturedPubkey) return;
    const controller = new AbortController();
    activeRefreshController = controller;
    const isStillCurrent = () => !controller.signal.aborted && isCurrent(capturedPubkey, currentGeneration);

    try {
      const follows = await verifiedFollows(capturedPubkey, isStillCurrent, controller.signal);
      if (!isStillCurrent()) return;
      const snapshot: SocialSnapshot = { follows, profiles: new Map() };
      snapshots.set(capturedPubkey, snapshot);
      for (let index = 0; index < follows.length; index += 1) {
        if (!isStillCurrent()) return;
        const author = follows[index]!;
        let warmed: OutboxResult | undefined;
        try {
          warmed = await options.baseRouter.query(
            [{ kinds: [0], authors: [author], limit: 1 }],
            { authors: [author], limit: 1 },
          );
        } catch {
          // One relay failure must not prevent later verified follows from warming.
        }
        if (!isStillCurrent()) return;
        if (warmed) {
          const profile = profileResult(warmed, author);
          if (profile) snapshot.profiles.set(author, profile);
        }
        if ((index + 1) % PROFILE_WARM_YIELD_EVERY === 0 && index + 1 < follows.length) {
          if (!isStillCurrent()) return;
          await yieldToEventLoop();
          if (!isStillCurrent()) return;
        }
      }
    } catch {
      // Background warming is best-effort and must never delay Paja startup.
    } finally {
      if (activeRefreshController === controller) activeRefreshController = undefined;
    }
  }

  function isCurrent(capturedPubkey: string, currentGeneration: number): boolean {
    return generation === currentGeneration
      && normalizePubkey(options.getActivePubkey() ?? '') === capturedPubkey;
  }

  function decorate(router: OutboxRouter, canReadIdentity?: () => boolean): OutboxRouter & Partial<StreamingOutboxRouter> {
    const planned = router as Partial<StreamingOutboxRouter>;
    async function augmentQuery(
      filters: Parameters<OutboxRouter['query']>[0],
      queryOptions: Parameters<OutboxRouter['query']>[1],
      execute: () => Promise<OutboxResult>,
      signal?: ApprovalSignal,
    ): Promise<OutboxResult> {
      const canAugmentAtStart = canReadIdentity?.() ?? true;
      const activePubkey = normalizePubkey(options.getActivePubkey() ?? '');
      const snapshot = canAugmentAtStart && activePubkey ? snapshots.get(activePubkey) : undefined;
      const base = await execute();
      if (signal?.aborted || !canAugmentAtStart || !(canReadIdentity?.() ?? true)) return base;
      return mergeResult(base, matchingCachedProfiles(snapshot?.profiles, filters), filters, queryOptions);
    }
    return {
      ...(router.getEvent ? { getEvent: router.getEvent.bind(router) } : {}),
      query: (filters, queryOptions) => augmentQuery(filters, queryOptions, () => router.query(filters, queryOptions)),
      ...(planned.planRead ? { planRead: planned.planRead.bind(router) } : {}),
      ...(planned.queryWithPlan ? { queryWithPlan: ((filters, queryOptions, plan, signal) =>
        augmentQuery(filters, queryOptions, () => planned.queryWithPlan!(filters, queryOptions, plan, signal), signal)
      ) as StreamingOutboxRouter['queryWithPlan'] } : {}),
      ...(planned.subscribeWithPlan ? { subscribeWithPlan: planned.subscribeWithPlan.bind(router) } : {}),
      ...(planned.planPublish ? { planPublish: planned.planPublish.bind(router) } : {}),
      ...(planned.publishWithPlan ? { publishWithPlan: planned.publishWithPlan.bind(router) } : {}),
      subscribe: router.subscribe.bind(router),
      publish: router.publish.bind(router),
      resolveRelays: router.resolveRelays.bind(router),
    };
  }

  const unsubscribe = options.subscribeSignerChange?.(() => {
    void refreshActiveIdentity();
  });

  return {
    getFollows: loadFollows,
    refreshActiveIdentity,
    decorate,
    dispose: () => {
      activeRefreshController?.abort();
      unsubscribe?.();
    },
  };
}

function normalizePubkey(value: unknown): string | null {
  return typeof value === 'string' && HEX_PUBKEY.test(value) ? value.toLowerCase() : null;
}

function isContactCandidate(candidate: unknown, capturedPubkey: string): candidate is NostrEvent {
  if (typeof candidate !== 'object' || candidate === null) return false;
  const event = candidate as Partial<NostrEvent>;
  return event.kind === 3 && normalizePubkey(event.pubkey) === capturedPubkey;
}

function selectReplacement(events: NostrEvent[]): NostrEvent | undefined {
  return [...events].sort((left, right) => {
    const timestampOrder = right.created_at - left.created_at;
    if (timestampOrder !== 0) return timestampOrder;
    if (left.id === right.id) return 0;
    return left.id < right.id ? -1 : 1;
  })[0];
}

async function contactPubkeys(event: NostrEvent | undefined, isStillCurrent?: () => boolean): Promise<string[]> {
  if (!event || !Array.isArray(event.tags)) return [];
  const follows = new Set<string>();
  for (let index = 0; index < event.tags.length; index += 1) {
    if (isStillCurrent && !isStillCurrent()) return [];
    const tag = event.tags[index];
    if (Array.isArray(tag) && tag[0] === 'p') {
      const pubkey = normalizePubkey(tag[1]);
      if (pubkey) follows.add(pubkey);
    }
    if ((index + 1) % FOLLOW_PARSE_YIELD_EVERY === 0 && index + 1 < event.tags.length) {
      await yieldToEventLoop();
      if (isStillCurrent && !isStillCurrent()) return [];
    }
  }
  return [...follows];
}

function profileResult(result: OutboxResult, author: string): RelayEventResult | undefined {
  let newest: RelayEventResult | undefined;
  for (const entry of result.events) {
    if (entry.event.kind !== 0 || normalizePubkey(entry.event.pubkey) !== author) continue;
    if (!newest || isNewerProfile(entry, newest)) newest = entry;
  }
  return newest;
}

function isNewerProfile(candidate: RelayEventResult, existing: RelayEventResult): boolean {
  if (candidate.event.created_at !== existing.event.created_at) {
    return candidate.event.created_at > existing.event.created_at;
  }
  return candidate.event.id < existing.event.id;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function matchingCachedProfiles(profiles: ReadonlyMap<string, RelayEventResult> | undefined, filters: Parameters<OutboxRouter['query']>[0]): RelayEventResult[] {
  const readyProfiles = profiles ? [...profiles.values()] : [];
  if (filters.length === 0) return readyProfiles;
  const matched = new Map<string, RelayEventResult>();
  for (const filter of filters) {
    const limit = typeof filter.limit === 'number' && filter.limit >= 0 ? filter.limit : undefined;
    let count = 0;
    for (const entry of readyProfiles) {
      if (!matchesAnyFilter(entry.event, [filter])) continue;
      if (limit !== undefined && count >= limit) continue;
      count += 1;
      if (!matched.has(entry.event.id)) matched.set(entry.event.id, entry);
    }
  }
  return [...matched.values()];
}

function mergeResult(
  base: OutboxResult,
  cached: RelayEventResult[],
  filters: Parameters<OutboxRouter['query']>[0],
  queryOptions: Parameters<OutboxRouter['query']>[1],
): OutboxResult {
  const events = new Map<string, RelayEventResult>();
  for (const entry of base.events) events.set(entry.event.id, entry);
  for (const entry of cached) {
    if (!events.has(entry.event.id)) events.set(entry.event.id, entry);
  }
  return {
    events: applyFinalLimits([...events.values()], filters, queryOptions),
    ...(base.incomplete === undefined ? {} : { incomplete: base.incomplete }),
    ...(base.error === undefined ? {} : { error: base.error }),
  };
}

function applyFinalLimits(
  entries: RelayEventResult[],
  filters: Parameters<OutboxRouter['query']>[0],
  queryOptions: Parameters<OutboxRouter['query']>[1],
): RelayEventResult[] {
  const aggregateLimit = typeof queryOptions?.limit === 'number' && queryOptions.limit >= 0
    ? queryOptions.limit
    : undefined;
  const aggregateCapped = aggregateLimit === undefined ? entries : entries.slice(0, aggregateLimit);
  if (filters.length === 0) return aggregateCapped;

  const counts = filters.map(() => 0);
  return aggregateCapped.filter((entry) => {
    const matching = filters.flatMap((filter, index) =>
      matchesAnyFilter(entry.event, [filter]) ? [index] : []);
    const allowed = matching.some((index) => {
      const limit = filters[index]?.limit;
      return typeof limit !== 'number' || limit < 0 || counts[index]! < limit;
    });
    if (!allowed) return false;
    for (const index of matching) counts[index]! += 1;
    return true;
  });
}
