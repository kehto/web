import type { NostrEvent } from 'nostr-tools';

/**
 * Minimal relay-pool contract `@kehto/nip66` depends on. Consumers implement
 * this against their pool library of choice (nostr-tools SimplePool,
 * applesauce-relay, @snort/worker-relay, etc.). Intentionally smaller than
 * RxJS-style observable pools — one callback, one unsubscribe handle.
 *
 * @example
 * ```ts
 * import { SimplePool } from 'nostr-tools/pool';
 * const pool = new SimplePool();
 * const adapter: Nip66RelayPool = {
 *   subscribe: (relays, filter, onEvent) => {
 *     const sub = pool.subscribeMany(relays, [filter], { onevent: onEvent });
 *     return () => sub.close();
 *   },
 * };
 * ```
 */
export interface Nip66RelayPool {
  /**
   * Open a kind-30166 subscription against a set of monitor relays.
   *
   * @param relays - WebSocket URLs to subscribe against (the aggregator passes its bootstrap list)
   * @param filter - A kind-30166 filter, optionally narrowed with `#n` network tags
   * @param onEvent - Called synchronously with every matching event; the aggregator parses each one
   * @returns An unsubscribe handle the aggregator calls on `resync()` or teardown
   */
  subscribe(
    relays: ReadonlyArray<string>,
    filter: Nip66Filter,
    onEvent: (event: NostrEvent) => void,
  ): () => void;
}

/**
 * Minimal filter shape for kind-30166 subscriptions. `#n` optionally narrows
 * by network type (e.g. `['clearnet']`, `['clearnet', 'tor']`).
 *
 * @example
 * ```ts
 * const filter: Nip66Filter = { kinds: [30166], '#n': ['clearnet'] };
 * ```
 */
export type Nip66Filter = { kinds: [30166]; '#n'?: ReadonlyArray<string> };

/**
 * Options for {@link createNip66Aggregator}.
 *
 * @example
 * ```ts
 * const options: Nip66AggregatorOptions = {
 *   pool: myPoolAdapter,
 *   bootstrap: ['wss://monitor1.example.com', 'wss://monitor2.example.com'],
 *   networks: ['clearnet'],
 * };
 * ```
 */
export interface Nip66AggregatorOptions {
  /** A {@link Nip66RelayPool} adapter supplied by the consumer. */
  pool: Nip66RelayPool;
  /** Required non-empty list of monitor relay URLs to subscribe against. No default ships in the package. */
  bootstrap: ReadonlyArray<string>;
  /** Optional network-type narrowing passed to the filter as `#n` (e.g. `['clearnet', 'tor']`). Omit to receive every network. */
  networks?: ReadonlyArray<string>;
}

/**
 * Aggregator handle returned by {@link createNip66Aggregator}. Each call
 * returns a fresh instance with its own closure-scoped state — multi-instance
 * safe (unlike a module-globals pattern).
 *
 * @example
 * ```ts
 * const aggregator = createNip66Aggregator({ pool, bootstrap: ['wss://monitor.example.com'] });
 * aggregator.start();
 * const relays = aggregator.getRelaySet();
 * ```
 */
export interface Nip66Aggregator {
  /** Begin subscribing against the bootstrap relay set. Idempotent — calling twice is a no-op. */
  start(): void;
  /** Tear down the current subscription, clear accumulated state, and re-subscribe. Call when `networks` semantics change upstream. */
  resync(): void;
  /** The current set of relay URLs discovered from kind-30166 `d`-tags. Empty until `start()` fires at least one event. */
  getRelaySet(): ReadonlySet<string>;
  /**
   * Relay URLs whose `N`-tags declare support for the given NIP number.
   *
   * @param nip - NIP number to query support for (e.g. 44 for NIP-44 encrypted DMs)
   * @returns Array of relay URLs supporting that NIP
   */
  getRelaysSupportingNip(nip: number): string[];
  /**
   * Whether the relay at `url` has been seen with an `N`-tag declaring support for `nip`.
   *
   * @param url - Relay WebSocket URL to check
   * @param nip - NIP number to query support for
   * @returns `true` iff the relay has been observed with a matching `N`-tag
   */
  relaySupportsNip(url: string, nip: number): boolean;
}

/**
 * Create a fresh {@link Nip66Aggregator} with closure-scoped state.
 *
 * NOTE: The implementation is deferred to Plan 34-02. This stub throws
 * immediately so downstream type-checks against the package resolve against
 * the locked public surface without the real logic port blocking scaffolding.
 *
 * @param _options - See {@link Nip66AggregatorOptions}
 * @returns A {@link Nip66Aggregator} handle (once implemented)
 * @throws Error — always, until Plan 34-02 lands the implementation
 *
 * @example
 * ```ts
 * import { createNip66Aggregator } from '@kehto/nip66';
 * import { SimplePool } from 'nostr-tools/pool';
 *
 * const pool = new SimplePool();
 * const aggregator = createNip66Aggregator({
 *   pool: {
 *     subscribe: (relays, filter, onEvent) => {
 *       const sub = pool.subscribeMany(relays, [filter], { onevent: onEvent });
 *       return () => sub.close();
 *     },
 *   },
 *   bootstrap: ['wss://monitor1.example.com'],
 * });
 * aggregator.start();
 * ```
 */
export function createNip66Aggregator(_options: Nip66AggregatorOptions): Nip66Aggregator {
  throw new Error('createNip66Aggregator: not implemented — see Plan 34-02');
}
