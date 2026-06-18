/**
 * relay-pool-service.ts — Relay pool as a ServiceHandler.
 *
 * Wraps an existing relay pool implementation (subscribe, publish,
 * selectRelayTier, isAvailable) as a ServiceHandler that receives
 * relay NAP envelope messages and manages subscription lifecycle.
 *
 * Handles: relay.subscribe, relay.close, relay.publish, relay.publishEncrypted.
 *
 * Note on `relay.publishEncrypted`: the canonical napplet→shell path routes
 * through @kehto/runtime handleRelayMessage, which performs shell-internal
 * NIP-44/NIP-04 encryption via the signer, then synthesizes a relay.publish
 * envelope handed to this service. The publishEncrypted branch here is a
 * fallback for alternate wirings; by the time the service sees the
 * envelope, content MUST already be ciphertext (the service never encrypts
 * or decrypts).
 */

import type { NostrEvent, NostrFilter, NappletMessage } from '@napplet/core';
import type { ServiceHandler } from '@kehto/runtime';

// Timer globals available in all JS runtimes
declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(id: unknown): void;

/** EOSE fallback timeout in milliseconds. */
const EOSE_FALLBACK_MS = 15_000;

/**
 * Options for creating a relay pool service.
 *
 * @example
 * ```ts
 * const relayPoolService = createRelayPoolService({
 *   subscribe: (filters, cb, urls) => myPool.subscribe(filters, cb, urls),
 *   publish: (event) => myPool.publish(event),
 *   selectRelayTier: (filters) => myPool.selectRelays(filters),
 *   isAvailable: () => myPool.connected,
 * });
 * ```
 */
export interface RelayPoolServiceOptions {
  /**
   * Subscribe to events matching filters. Returns handle with unsubscribe().
   *
   * @param filters - NIP-01 filter objects
   * @param callback - Receives matching events or 'EOSE'
   * @param relayUrls - Optional relay URL hints
   * @returns Handle to cancel the subscription
   */
  subscribe(
    filters: NostrFilter[],
    callback: (item: NostrEvent | 'EOSE') => void,
    relayUrls?: string[],
  ): { unsubscribe(): void };

  /**
   * Publish an event to relays.
   *
   * @param event - The event to publish
   */
  publish(event: NostrEvent): void;

  /**
   * Select relay URLs appropriate for the given filters.
   *
   * @param filters - NIP-01 filter objects
   * @returns Array of relay URLs
   */
  selectRelayTier(filters: NostrFilter[]): string[];

  /**
   * Whether the relay pool is available and connected.
   *
   * @returns true if the relay pool can handle requests
   */
  isAvailable(): boolean;
}

/** Internal subscription tracking entry. */
interface TrackedSubscription {
  handle: { unsubscribe(): void };
  eoseTimer: unknown;
}

type RelayServiceMessage = NappletMessage & {
  subId?: unknown;
  filters?: unknown;
  event?: unknown;
  relay?: unknown;
};

/**
 * Create a relay pool service that wraps an existing relay pool
 * implementation as a ServiceHandler.
 *
 * Handles relay.subscribe, relay.close, and relay.publish envelopes.
 * Tracks subscriptions per windowId:subId for lifecycle management.
 * Sets a 15-second EOSE fallback timer on each subscription.
 *
 * @param options - Relay pool implementation to wrap
 * @returns A ServiceHandler ready for runtime.registerService('relay', handler)
 *
 * @example
 * ```ts
 * import { createRelayPoolService } from '@kehto/services';
 *
 * const pool = createRelayPoolService({
 *   subscribe: (f, cb, urls) => applesauce.subscribe(f, cb, urls),
 *   publish: (e) => applesauce.publish(e),
 *   selectRelayTier: (f) => applesauce.getRelays(f),
 *   isAvailable: () => applesauce.connected,
 * });
 * runtime.registerService('relay', pool);
 * ```
 */
export function createRelayPoolService(options: RelayPoolServiceOptions): ServiceHandler {
  const tracked = new Map<string, TrackedSubscription>();

  return {
    descriptor: {
      name: 'relay-pool',
      version: '1.0.0',
      description: 'Relay pool subscription and publishing',
    },

    handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
      const relayMessage = message as RelayServiceMessage;
      if (message.type === 'relay.subscribe') {
        const subId = relayMessage.subId;
        if (typeof subId !== 'string') return;
        const filters = Array.isArray(relayMessage.filters)
          ? relayMessage.filters as NostrFilter[]
          : [];
        const subKey = `${windowId}:${subId}`;

        // Cancel existing subscription for this key if any
        const existing = tracked.get(subKey);
        if (existing) {
          existing.handle.unsubscribe();
          clearTimeout(existing.eoseTimer);
          tracked.delete(subKey);
        }

        if (!options.isAvailable()) {
          send({ type: 'relay.eose', subId } as NappletMessage);
          return;
        }

        const relayHint = typeof relayMessage.relay === 'string' && relayMessage.relay.length > 0
          ? relayMessage.relay
          : undefined;
        const relayUrls = relayHint ? [relayHint] : options.selectRelayTier(filters);
        let eoseSent = false;

        const eoseTimer = setTimeout(() => {
          if (!eoseSent) {
            eoseSent = true;
            send({ type: 'relay.eose', subId } as NappletMessage);
          }
        }, EOSE_FALLBACK_MS);

        const handle = options.subscribe(filters, (item) => {
          if (item === 'EOSE') {
            clearTimeout(eoseTimer);
            if (!eoseSent) {
              eoseSent = true;
              send({ type: 'relay.eose', subId } as NappletMessage);
            }
            return;
          }
          send({ type: 'relay.event', subId, event: item } as NappletMessage);
        }, relayUrls);

        tracked.set(subKey, { handle, eoseTimer });
        return;
      }

      if (message.type === 'relay.close') {
        const subId = relayMessage.subId;
        if (typeof subId !== 'string') return;
        const subKey = `${windowId}:${subId}`;
        const entry = tracked.get(subKey);
        if (entry) {
          entry.handle.unsubscribe();
          clearTimeout(entry.eoseTimer);
          tracked.delete(subKey);
        }
        return;
      }

      if (message.type === 'relay.publish') {
        const event = relayMessage.event as NostrEvent | undefined;
        if (event && typeof event === 'object' && options.isAvailable()) {
          options.publish(event);
        }
        return;
      }

      if (message.type === 'relay.publishEncrypted') {
        const event = relayMessage.event as NostrEvent | undefined;
        if (event && typeof event === 'object' && options.isAvailable()) {
          options.publish(event);
        }
        return;
      }
    },

    onWindowDestroyed(windowId: string): void {
      const prefix = `${windowId}:`;
      for (const [key, entry] of tracked) {
        if (key.startsWith(prefix)) {
          entry.handle.unsubscribe();
          clearTimeout(entry.eoseTimer);
          tracked.delete(key);
        }
      }
    },
  };
}
