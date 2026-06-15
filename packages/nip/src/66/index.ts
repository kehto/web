import type { NostrEvent } from 'nostr-tools';

/**
 * Minimal relay-pool contract `@kehto/nip/66` depends on. Consumers implement
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
  /**
   * Optional named relay-attribute groups for interpreting ad hoc kind-30166 tags.
   * Omit to use {@link DEFAULT_RELAY_ATTRIBUTE_GROUPS}.
   */
  relayAttributeGroups?: RelayAttributeGroups;
}

/** A tag/value matcher for ad hoc relay attributes carried on kind-30166 events. */
export interface RelayAttributeMatcher {
  /** Tag name to match, for example `T`, `t`, or `k`. */
  tag: string;
  /** Optional accepted values. If omitted, any value for the tag matches. */
  values?: ReadonlyArray<string>;
}

/** Named groups of relay-attribute matchers. Matchers within a group are OR-ed. */
export type RelayAttributeGroups = Readonly<Record<string, ReadonlyArray<RelayAttributeMatcher>>>;

/** Parsed attributes observed for one NIP-66 relay URL. */
export interface Nip66RelayAttributes {
  /** Raw tag copies from the latest observed kind-30166 event for the relay. */
  tags: ReadonlyArray<ReadonlyArray<string>>;
  /** Tag-value index, keyed by tag name. */
  values: ReadonlyMap<string, ReadonlySet<string>>;
  /** Parsed uppercase `N` tag support for convenience. */
  supportedNips: ReadonlySet<number>;
}

export const DEFAULT_RELAY_ATTRIBUTE_GROUPS: RelayAttributeGroups = {
  Indexer: [
    { tag: 'T', values: ['Indexer', 'indexer'] },
    { tag: 't', values: ['Indexer', 'indexer'] },
    { tag: 'k', values: ['10002'] },
  ],
  RelayIndexer: [
    { tag: 'T', values: ['RelayIndexer', 'relay-indexer', 'relay_indexer'] },
    { tag: 't', values: ['RelayIndexer', 'relay-indexer', 'relay_indexer'] },
    { tag: 'k', values: ['30166', '10166'] },
  ],
};

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
  /**
   * Tear down the current subscription. Idempotent — calling without a prior
   * `start()` is a safe no-op. Preserves accumulated state (`getRelaySet`,
   * `relaySupportsNip`) — use `resync()` if you need to clear state AND
   * re-subscribe in one step. A subsequent `start()` re-subscribes against
   * the bootstrap relays (identical contract to the first start).
   *
   * Wire this to your consumer's teardown path (browser: `beforeunload`;
   * React: effect cleanup; Electron: `app.before-quit`) — the aggregator
   * holds a pool subscription that otherwise lives for the tab lifetime
   * (PITFALLS.md M-03).
   */
  stop(): void;
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
  /**
   * Return parsed relay attributes for a relay URL, if that relay has been
   * observed in a kind-30166 event.
   */
  getRelayAttributes(url: string): Nip66RelayAttributes | undefined;
  /**
   * Return relays matching any supplied ad hoc attribute matcher.
   *
   * @param matchers - Tag/value matchers, OR semantics
   */
  getRelaysMatchingAttributes(matchers: ReadonlyArray<RelayAttributeMatcher>): string[];
  /**
   * Return relays in a named attribute group. Uses the group table passed to
   * `createNip66Aggregator`, or {@link DEFAULT_RELAY_ATTRIBUTE_GROUPS}.
   */
  getRelaysForAttributeGroup(groupName: string, groups?: RelayAttributeGroups): string[];
}

/**
 * Create a NIP-66 kind-30166 relay-discovery aggregator with closure-scoped state.
 *
 * Subscribes to kind-30166 events via the injected {@link Nip66RelayPool},
 * extracts relay URLs from `d`-tags, and parses `N`-tags to track which NIP
 * numbers each relay supports. Multi-instance safe — each factory call owns
 * its own `Set` + `Map`; multiple aggregators share nothing at module scope.
 *
 * The aggregator is framework-agnostic: it knows nothing about negentropy
 * (NIP-77), OPFS caching, worker relays, or network-type config stores.
 * Consumers inject those concerns through their {@link Nip66RelayPool}
 * implementation. `start()` is synchronous and idempotent — consumers
 * schedule their own cadence (delayed start, retry, etc.).
 *
 * @param options - Pool adapter + bootstrap monitor relays (+ optional network filter)
 * @returns A fresh {@link Nip66Aggregator} handle
 *
 * @example
 * ```ts
 * import { createNip66Aggregator } from '@kehto/nip/66';
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
 * // Later — inside a ShellAdapter hook:
 * const suggestions = Array.from(aggregator.getRelaySet());
 * ```
 */
export function createNip66Aggregator(options: Nip66AggregatorOptions): Nip66Aggregator {
  const relaySet = new Set<string>();
  const relaySupportedNips = new Map<string, Set<number>>();
  const relayAttributeTags = new Map<string, string[][]>();
  const relayAttributeValues = new Map<string, Map<string, Set<string>>>();
  const relayAttributeGroups = options.relayAttributeGroups ?? DEFAULT_RELAY_ATTRIBUTE_GROUPS;
  let unsubscribe: (() => void) | null = null;

  function buildFilter(): Nip66Filter {
    const filter: Nip66Filter = { kinds: [30166] };
    if (options.networks && options.networks.length > 0) {
      filter['#n'] = options.networks;
    }
    return filter;
  }

  function processEvent(event: NostrEvent): void {
    const dTag = event.tags.find((t) => t[0] === 'd');
    const relayUrl = dTag?.[1];
    if (!relayUrl) return;
    relaySet.add(relayUrl);
    captureRelayAttributes(relayUrl, event.tags);

    const nips = new Set<number>();
    for (const tag of event.tags) {
      if (tag[0] === 'N' && tag[1]) {
        const nipNum = parseInt(tag[1], 10);
        if (!Number.isNaN(nipNum)) nips.add(nipNum);
      }
    }
    if (nips.size > 0) relaySupportedNips.set(relayUrl, nips);
  }

  function captureRelayAttributes(relayUrl: string, tags: string[][]): void {
    const tagCopies = tags.map((tag) => [...tag]);
    const values = new Map<string, Set<string>>();
    for (const tag of tags) {
      const [name, value] = tag;
      if (!name || value === undefined) continue;
      let bucket = values.get(name);
      if (!bucket) {
        bucket = new Set<string>();
        values.set(name, bucket);
      }
      bucket.add(value);
    }
    relayAttributeTags.set(relayUrl, tagCopies);
    relayAttributeValues.set(relayUrl, values);
  }

  function start(): void {
    if (unsubscribe) return; // idempotent — already subscribed
    unsubscribe = options.pool.subscribe(options.bootstrap, buildFilter(), processEvent);
  }

  function resync(): void {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    relaySet.clear();
    relaySupportedNips.clear();
    relayAttributeTags.clear();
    relayAttributeValues.clear();
    unsubscribe = options.pool.subscribe(options.bootstrap, buildFilter(), processEvent);
  }

  function stop(): void {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  function getRelaySet(): ReadonlySet<string> {
    return relaySet;
  }

  function getRelaysSupportingNip(nip: number): string[] {
    const result: string[] = [];
    for (const [url, nips] of relaySupportedNips) {
      if (nips.has(nip)) result.push(url);
    }
    return result;
  }

  function relaySupportsNip(url: string, nip: number): boolean {
    return relaySupportedNips.get(url)?.has(nip) ?? false;
  }

  function getRelayAttributes(url: string): Nip66RelayAttributes | undefined {
    const tagCopies = relayAttributeTags.get(url);
    const values = relayAttributeValues.get(url);
    if (!tagCopies || !values) return undefined;
    return {
      tags: tagCopies.map((tag) => [...tag]),
      values: new Map(Array.from(values, ([tag, tagValues]) => [tag, new Set(tagValues)])),
      supportedNips: new Set(relaySupportedNips.get(url) ?? []),
    };
  }

  function matcherMatches(url: string, matcher: RelayAttributeMatcher): boolean {
    const values = relayAttributeValues.get(url)?.get(matcher.tag);
    if (!values || values.size === 0) return false;
    if (!matcher.values || matcher.values.length === 0) return true;
    const accepted = new Set(matcher.values.map((value) => value.toLowerCase()));
    for (const value of values) {
      if (accepted.has(value.toLowerCase())) return true;
    }
    return false;
  }

  function getRelaysMatchingAttributes(matchers: ReadonlyArray<RelayAttributeMatcher>): string[] {
    const result: string[] = [];
    for (const url of relaySet) {
      if (matchers.some((matcher) => matcherMatches(url, matcher))) result.push(url);
    }
    return result;
  }

  function getRelaysForAttributeGroup(groupName: string, groups?: RelayAttributeGroups): string[] {
    const group = (groups ?? relayAttributeGroups)[groupName] ?? [];
    return getRelaysMatchingAttributes(group);
  }

  return {
    start,
    resync,
    stop,
    getRelaySet,
    getRelaysSupportingNip,
    relaySupportsNip,
    getRelayAttributes,
    getRelaysMatchingAttributes,
    getRelaysForAttributeGroup,
  };
}
