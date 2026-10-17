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
import type { RelayOperationPlan, RelayPlanningServiceHandler, ApprovalSignal } from '@kehto/runtime';
import { createRelayEventResultWithHints } from '@kehto/runtime';

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
   * @param callback - Receives matching events or 'EOSE' plus optional observed relay URLs
   * @param relayUrls - Relay URLs the subscription must use: the request's own hint when
   *   `fromHint` is true, otherwise the host tier selected for `filters`
   * @param fromHint - True when `relayUrls` came from an explicit relay hint on the
   *   request, which bypasses host relay selection
   * @returns Handle to cancel the subscription
   */
  subscribe(
    filters: NostrFilter[],
    callback: (item: NostrEvent | 'EOSE', observedRelayUrls?: string[]) => void,
    relayUrls?: string[],
    fromHint?: boolean,
  ): { unsubscribe(): void };

  /**
   * Publish an event to relays.
   *
   * @param event - The event to publish
   * @returns Nothing, or a promise that settles when the publish request completes
   */
  publish(event: NostrEvent): void | Promise<void>;

  /** Execute a publish against the supplied, pre-approved destinations. */
  publishToRelays?(relayUrls: readonly string[], event: NostrEvent): void | Promise<void>;

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
  id?: unknown;
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
export function createRelayPoolService(options: RelayPoolServiceOptions): RelayPlanningServiceHandler {
  const tracked = new Map<string, TrackedSubscription>();

  function planRelayOperation(_windowId: string, message: NappletMessage): RelayOperationPlan {
    const relayMessage = message as RelayServiceMessage;
    const filters = Array.isArray(relayMessage.filters) ? relayMessage.filters as NostrFilter[] : [];
    const hint = typeof relayMessage.relay === 'string' && relayMessage.relay.length > 0
      ? relayMessage.relay : undefined;
    const operation = message.type === 'relay.query' ? 'query'
      : message.type === 'relay.publishEncrypted' ? 'publishEncrypted'
      : message.type === 'relay.publish' ? 'publish' : 'subscribe';
    const selected = hint ? [hint] : options.selectRelayTier(operation === 'publish' || operation === 'publishEncrypted' ? [] : filters);
    const relayUrls = [...new Set(selected.map((url) => String(url).trim()).filter(Boolean))];
    return Object.freeze({ operation, relayUrls: Object.freeze(relayUrls), localOnly: relayUrls.length === 0 });
  }

  function publishEvent(
    relayMessage: RelayServiceMessage,
    resultType: 'relay.publish.result' | 'relay.publishEncrypted.result',
    send: (msg: NappletMessage) => void,
    plan: RelayOperationPlan,
    signal: ApprovalSignal,
  ): void {
    const id = typeof relayMessage.id === 'string' ? relayMessage.id : '';
    const event = relayMessage.event as NostrEvent | undefined;
    if (!event || typeof event !== 'object') {
      send({ type: resultType, id, ok: false, error: 'invalid event' } as NappletMessage);
      return;
    }
    if (!options.isAvailable()) {
      send({ type: resultType, id, ok: false, error: 'no relay pool available' } as NappletMessage);
      return;
    }

    void (async (): Promise<void> => {
      try {
        if (signal.aborted) return;
        await (options.publishToRelays
          ? options.publishToRelays(plan.relayUrls, event)
          : options.publish(event));
        if (signal.aborted) return;
        send({
          type: resultType,
          id,
          ok: true,
          event,
          eventId: event.id,
        } as NappletMessage);
      } catch (error) {
        send({
          type: resultType,
          id,
          ok: false,
          error: error instanceof Error && error.message ? error.message : 'publish failed',
        } as NappletMessage);
      }
    })();
  }

  const service: RelayPlanningServiceHandler = {
    descriptor: {
      name: 'relay-pool',
      version: '1.0.0',
      description: 'Relay pool subscription and publishing',
    },

    planRelayOperation,

    executeRelayOperation(windowId: string, message: NappletMessage, plan: RelayOperationPlan, signal: ApprovalSignal,
      send: (msg: NappletMessage) => void): void {
      if (signal.aborted) return;
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

        const relayUrls = [...plan.relayUrls];
        let eoseSent = false;

        const eoseTimer = setTimeout(() => {
          if (!eoseSent) {
            eoseSent = true;
            send({ type: 'relay.eose', subId } as NappletMessage);
          }
        }, EOSE_FALLBACK_MS);

        const entry: TrackedSubscription = { handle: { unsubscribe() {} }, eoseTimer };
        tracked.set(subKey, entry);
        const handle = options.subscribe(filters, (item, observedRelayUrls) => {
          if (signal.aborted || tracked.get(subKey) !== entry) return;
          if (item === 'EOSE') {
            clearTimeout(eoseTimer);
            if (!eoseSent) {
              eoseSent = true;
              send({ type: 'relay.eose', subId } as NappletMessage);
            }
            return;
          }
          send({
            type: 'relay.event',
            subId,
            result: createRelayEventResultWithHints(item, observedRelayUrls ?? relayUrls),
          } as NappletMessage);
        }, relayUrls, typeof relayMessage.relay === 'string' && relayMessage.relay.length > 0);

        entry.handle = handle;
        // A synchronous backend event can revoke its owner before subscribe()
        // returns. The exact-entry check prevents that retired generation from
        // retaining a physical handle after a replacement took its key.
        if (tracked.get(subKey) !== entry) {
          handle.unsubscribe();
          clearTimeout(eoseTimer);
        }
        signal.addEventListener('abort', () => {
          if (tracked.get(subKey) !== entry) return;
          entry.handle.unsubscribe();
          clearTimeout(entry.eoseTimer);
          tracked.delete(subKey);
        }, { once: true });
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
        publishEvent(relayMessage, 'relay.publish.result', send, plan, signal);
        return;
      }

      if (message.type === 'relay.publishEncrypted') {
        publishEvent(relayMessage, 'relay.publishEncrypted.result', send, plan, signal);
        return;
      }
    },

    handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
      service.executeRelayOperation(windowId, message, service.planRelayOperation(windowId, message),
        { aborted: false, addEventListener() {}, removeEventListener() {} }, send);
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
  return service;
}
