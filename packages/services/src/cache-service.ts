/**
 * cache-service.ts — Local event cache as a ServiceHandler.
 *
 * Wraps an existing cache implementation (query, store, isAvailable)
 * as a ServiceHandler that receives relay NUB envelope messages. Cache
 * subscriptions are one-shot queries — relay.subscribe triggers a query
 * and immediate EOSE, unlike relay pool subscriptions which stay open.
 */

import type { NostrEvent, NostrFilter, NappletMessage } from '@napplet/core';
import type { ServiceHandler } from '@kehto/runtime';

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
  return {
    descriptor: {
      name: 'cache',
      version: '1.0.0',
      description: 'Local event cache (IndexedDB, worker relay, etc.)',
    },

    handleMessage(_windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
      if (message.type === 'relay.subscribe') {
        const subId = (message as any).subId as string;
        if (typeof subId !== 'string') return;
        const filters = (message as any).filters as NostrFilter[];

        if (!options.isAvailable()) {
          send({ type: 'relay.eose', subId } as NappletMessage);
          return;
        }

        options
          .query(filters)
          .then((events) => {
            for (const event of events) {
              send({ type: 'relay.event', subId, event } as NappletMessage);
            }
            send({ type: 'relay.eose', subId } as NappletMessage);
          })
          .catch(() => {
            // Cache query is best-effort — send EOSE even on failure
            send({ type: 'relay.eose', subId } as NappletMessage);
          });
        return;
      }

      if (message.type === 'relay.publish') {
        const event = (message as any).event as NostrEvent | undefined;
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

    // Cache has no per-window state to clean up
    onWindowDestroyed(_windowId: string): void {
      /* no-op */
    },
  };
}
