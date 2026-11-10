
import type { NostrEvent, NostrFilter, NappletMessage } from '@napplet/core';
import type { ServiceHandler } from '@kehto/runtime';
import { createRelayEventResult } from '@kehto/runtime';

type RelayServiceMessage = NappletMessage & {
  subId?: unknown;
  filters?: unknown;
  event?: unknown;
};

/**
 * Options for creating a cache service.
 *
 * @example
 * ```ts
 * const cacheService = createCacheService({
 *   query: (filters) => myIndexedDB.query(filters),
 *   store: (event) => myIndexedDB.store(event),
 *   isAvailable: () => true,
 * });
 * ```
 */
export interface CacheServiceOptions {
  /**
   * Query cached events matching the given filters.
   *
   * @param filters - NIP-01 filter objects
   * @returns Promise resolving to matching cached events
   */
  query(filters: NostrFilter[]): Promise<NostrEvent[]>;

  /**
   * Store an event in cache. Best-effort, may silently fail.
   *
   * @param event - The event to store
   */
  store(event: NostrEvent): void;

  /**
   * Whether the cache is available.
   *
   * @returns true if the cache can handle requests
   */
  isAvailable(): boolean;
}

/**
 * @kehto/services cross-package naming-parity alias for {@link CacheServiceOptions}.
 *
 * `HostCacheBridge` matches the v1.4 `HostKeysBridge` / `HostMediaBridge`
 * convention — it is a pure type alias for `CacheServiceOptions`, NOT a new
 * type. Existing consumers of `CacheServiceOptions` continue to work
 * unchanged; new consumers may prefer `HostCacheBridge` for consistency
 * with the other Host*Bridge names in `@kehto/services`.
 *
 * Anti-feature note (PITFALLS.md M-02): `CacheServiceOptions` MUST remain
 * the primary export. This alias is additive; do not rename or delete
 * `CacheServiceOptions` when other Host*Bridge names eventually
 * stabilize.
 *
 * @example
 * ```ts
 * import type { HostCacheBridge } from '@kehto/services';
 * const cache: HostCacheBridge = {
 *   query: (filters) => myIndexedDB.query(filters),
 *   store: (event) => myIndexedDB.store(event),
 *   isAvailable: () => true,
 * };
 * ```
 */
export type HostCacheBridge = CacheServiceOptions;

/**
 * Create a cache service that wraps an existing cache implementation
 * as a ServiceHandler.
 *
 * Cache relay.subscribe subscriptions are one-shot — they query, deliver
 * results, send EOSE, and are done. No long-lived subscription tracking needed.
 * Cache query failures are best-effort: EOSE is sent even on failure.
 *
 * @param options - Cache implementation to wrap
 * @returns A ServiceHandler ready for runtime.registerService('cache', handler)
 *
 * @example
 * ```ts
 * import { createCacheService } from '@kehto/services';
 *
 * const cache = createCacheService({
 *   query: (f) => workerRelay.query(f),
 *   store: (e) => workerRelay.store(e),
 *   isAvailable: () => workerRelay.ready,
 * });
 * runtime.registerService('cache', cache);
 * ```
 */
export function createCacheService(options: CacheServiceOptions): ServiceHandler {
  const generations = new Map<string, symbol>();
  const subscriptions = new Map<string, symbol>();
  const generationFor = (windowId: string): symbol => {
    let generation = generations.get(windowId);
    if (!generation) { generation = Symbol(windowId); generations.set(windowId, generation); }
    return generation;
  };
  const subscriptionKey = (windowId: string, subId: string): string => `${windowId}:${subId}`;
  const current = (windowId: string, subId: string, generation: symbol): boolean =>
    generations.get(windowId) === generation && subscriptions.get(subscriptionKey(windowId, subId)) === generation;
  const clearWindow = (windowId: string): void => {
    generations.delete(windowId);
    for (const key of subscriptions.keys()) if (key.startsWith(`${windowId}:`)) subscriptions.delete(key);
  };
  return {
    descriptor: {
      name: 'cache',
      version: '1.0.0',
      description: 'Local event cache (IndexedDB, worker relay, etc.)',
    },

    handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
      const generation = generationFor(windowId);
      const relayMessage = message as RelayServiceMessage;
      if (message.type === 'relay.subscribe') {
        const subId = relayMessage.subId;
        if (typeof subId !== 'string') return;
        subscriptions.set(subscriptionKey(windowId, subId), generation);
        const filters = Array.isArray(relayMessage.filters)
          ? relayMessage.filters as NostrFilter[]
          : [];

        if (!options.isAvailable()) {
          if (current(windowId, subId, generation)) send({ type: 'relay.eose', subId } as NappletMessage);
          return;
        }

        options
          .query(filters)
          .then((events) => {
            if (!current(windowId, subId, generation)) return;
            for (const event of events) {
              if (!current(windowId, subId, generation)) return;
              send({ type: 'relay.event', subId, result: createRelayEventResult(event) } as NappletMessage);
            }
            if (current(windowId, subId, generation)) send({ type: 'relay.eose', subId } as NappletMessage);
          })
          .catch(() => {
            // Cache query is best-effort — send EOSE even on failure.
            if (current(windowId, subId, generation)) send({ type: 'relay.eose', subId } as NappletMessage);
          });
        return;
      }

      if (message.type === 'relay.publish') {
        const event = relayMessage.event as NostrEvent | undefined;
        if (event && typeof event === 'object' && options.isAvailable()) {
          try {
            options.store(event);
          } catch {
            /* Cache write is best-effort */
          }
        }
        return;
      }
    },

    onWindowDestroyed(windowId: string): void { clearWindow(windowId); },
    onPermissionRevoked(windowId: string): void { clearWindow(windowId); },
  };
}
