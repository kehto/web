import type { NostrEvent } from 'nostr-tools';

/**
 * `@kehto/nip/65` — NIP-65 relay-list (kind 10002) parsing and outbox-model
 * relay resolution.
 *
 * NIP-65 defines kind-10002 replaceable events whose `r` tags declare which
 * relays an author reads from and writes to — the "outbox model" (a.k.a.
 * "gossip"). A client that wants to *reach* an author publishes to (or reads
 * from) that author's advertised relays instead of a fixed relay set.
 *
 * `nostr-tools` ships no NIP-65 helper, so this module fills the gap with a
 * pure parser plus a closure-scoped registry (no module-global state, so
 * multiple runtimes in one process never alias each other — same multi-instance
 * contract as `@kehto/nip/66`).
 *
 * Tag grammar:
 * ```text
 * ["r", "wss://relay.example.com"]          → read AND write
 * ["r", "wss://relay.example.com", "read"]  → read-only
 * ["r", "wss://relay.example.com", "write"] → write-only
 * ```
 */

/**
 * A single relay entry parsed from a NIP-65 kind-10002 `r` tag.
 *
 * @example
 * ```ts
 * const entry: RelayEntry = { url: 'wss://relay.example.com', read: true, write: false };
 * ```
 */
export interface RelayEntry {
  /** Relay WebSocket URL from the `r` tag's second element. */
  url: string;
  /** Whether the author reads (receives events) from this relay. */
  read: boolean;
  /** Whether the author writes (publishes events) to this relay. */
  write: boolean;
}

/**
 * Parse a NIP-65 kind-10002 relay-list event into structured {@link RelayEntry}
 * objects.
 *
 * Keeps tags where `tag[0] === 'r'` and `tag[1]` is a string URL. The optional
 * third element is the marker (`'read'`, `'write'`, or absent for both). Any
 * marker other than the two canonical strings is treated as "unmarked" (read +
 * write), matching how lenient NIP-65 consumers behave in practice.
 *
 * No URL normalization or hostname de-duplication is performed — the relay URL
 * is preserved verbatim. Normalize with a NIP-66 dataset (`@kehto/nip/66`) or a
 * dedicated relay-URL normalizer if you need canonical hostnames.
 *
 * @param event - A kind-10002 relay-list event (kind is not re-validated; pass the right event)
 * @returns Array of relay entries in tag order; duplicate URLs are preserved
 *
 * @example
 * ```ts
 * import { parseNip65RelayList } from '@kehto/nip/65';
 * const entries = parseNip65RelayList(kind10002Event);
 * // [{ url: 'wss://a', read: true, write: true }, { url: 'wss://b', read: true, write: false }]
 * ```
 */
export function parseNip65RelayList(event: NostrEvent): RelayEntry[] {
  return event.tags.flatMap((tag) => {
    if (tag[0] !== 'r' || typeof tag[1] !== 'string' || tag[1].length === 0) return [];
    const marker = tag[2];
    // Canonical markers are 'read' and 'write'; anything else (absent or a
    // typo) is treated as unmarked → both, so a listed relay is never silently
    // dropped from the outbox/inbox set.
    const read = marker !== 'write';
    const write = marker !== 'read';
    return [{ url: tag[1], read, write }];
  });
}

/**
 * Select the write (outbox) relay URLs from one author's parsed relay list,
 * de-duplicated and in first-seen order.
 *
 * @param entries - Parsed entries from {@link parseNip65RelayList}
 * @returns De-duplicated write-relay URLs
 *
 * @example
 * ```ts
 * const outbox = selectWriteRelays(parseNip65RelayList(event));
 * ```
 */
export function selectWriteRelays(entries: ReadonlyArray<RelayEntry>): string[] {
  return dedupe(entries.filter((e) => e.write).map((e) => e.url));
}

/**
 * Select the read (inbox) relay URLs from one author's parsed relay list,
 * de-duplicated and in first-seen order.
 *
 * @param entries - Parsed entries from {@link parseNip65RelayList}
 * @returns De-duplicated read-relay URLs
 */
export function selectReadRelays(entries: ReadonlyArray<RelayEntry>): string[] {
  return dedupe(entries.filter((e) => e.read).map((e) => e.url));
}

/**
 * A closure-scoped registry of parsed NIP-65 relay lists keyed by author
 * pubkey. Returned by {@link createNip65Registry}. Each registry owns its own
 * `Map` — two registries never share state (unlike a module-globals pattern).
 *
 * @example
 * ```ts
 * const registry = createNip65Registry();
 * registry.ingest(event);                       // store by event.pubkey
 * const outbox = registry.resolveOutboxRelays([authorA, authorB]);
 * ```
 */
export interface Nip65Registry {
  /**
   * Parse and store a kind-10002 event under its own `pubkey`. Overwrites any
   * previously stored list for that author (kind-10002 is replaceable).
   *
   * @param event - A kind-10002 relay-list event
   * @returns The parsed entries that were stored
   */
  ingest(event: NostrEvent): RelayEntry[];
  /**
   * Store an already-parsed relay list for an explicit pubkey. Use when you
   * parsed elsewhere or want to seed the registry without an event object.
   *
   * @param pubkey - Author hex public key
   * @param entries - Parsed relay entries
   */
  setRelayList(pubkey: string, entries: ReadonlyArray<RelayEntry>): void;
  /**
   * Get the stored relay list for an author, or `undefined` if none seen.
   *
   * @param pubkey - Author hex public key
   */
  getRelayList(pubkey: string): RelayEntry[] | undefined;
  /** Whether a relay list has been stored for `pubkey`. */
  has(pubkey: string): boolean;
  /**
   * Resolve write (outbox) relay URLs across the given authors, de-duplicated.
   * Authors with no stored list contribute nothing. Empty input or all-unknown
   * authors yield `[]`.
   *
   * @param pubkeys - Author hex public keys
   * @returns De-duplicated outbox relay URLs in first-seen order
   */
  resolveOutboxRelays(pubkeys: ReadonlyArray<string>): string[];
  /**
   * Resolve read (inbox) relay URLs across the given authors, de-duplicated.
   *
   * @param pubkeys - Author hex public keys
   * @returns De-duplicated inbox relay URLs in first-seen order
   */
  resolveReadRelays(pubkeys: ReadonlyArray<string>): string[];
  /** Drop a single author's stored relay list. Returns `true` if one existed. */
  delete(pubkey: string): boolean;
  /** Clear every stored relay list. */
  clear(): void;
}

/**
 * Create a closure-scoped {@link Nip65Registry} for accumulating kind-10002
 * relay lists and resolving outbox/inbox relays.
 *
 * Framework-agnostic: it knows nothing about relay pools, subscriptions, or
 * storage. Feed it kind-10002 events (e.g. from your pool's `onevent`
 * callback) via {@link Nip65Registry.ingest} and query the outbox model with
 * {@link Nip65Registry.resolveOutboxRelays}.
 *
 * @returns A fresh registry with its own state
 *
 * @example
 * ```ts
 * import { createNip65Registry } from '@kehto/nip/65';
 * import { SimplePool } from 'nostr-tools/pool';
 *
 * const registry = createNip65Registry();
 * const pool = new SimplePool();
 * pool.subscribeMany(discoveryRelays, [{ kinds: [10002], authors }], {
 *   onevent: (e) => registry.ingest(e),
 * });
 * // Later, before publishing on behalf of `author`:
 * const outbox = registry.resolveOutboxRelays([author]);
 * ```
 */
export function createNip65Registry(): Nip65Registry {
  const lists = new Map<string, RelayEntry[]>();

  function setRelayList(pubkey: string, entries: ReadonlyArray<RelayEntry>): void {
    lists.set(pubkey, entries.map((e) => ({ ...e })));
  }

  function ingest(event: NostrEvent): RelayEntry[] {
    const entries = parseNip65RelayList(event);
    setRelayList(event.pubkey, entries);
    return entries;
  }

  function getRelayList(pubkey: string): RelayEntry[] | undefined {
    const entries = lists.get(pubkey);
    return entries ? entries.map((e) => ({ ...e })) : undefined;
  }

  function resolve(pubkeys: ReadonlyArray<string>, want: 'read' | 'write'): string[] {
    const urls: string[] = [];
    const seen = new Set<string>();
    for (const pubkey of pubkeys) {
      const entries = lists.get(pubkey);
      if (!entries) continue;
      for (const entry of entries) {
        if (entry[want] && !seen.has(entry.url)) {
          seen.add(entry.url);
          urls.push(entry.url);
        }
      }
    }
    return urls;
  }

  return {
    ingest,
    setRelayList,
    getRelayList,
    has: (pubkey) => lists.has(pubkey),
    resolveOutboxRelays: (pubkeys) => resolve(pubkeys, 'write'),
    resolveReadRelays: (pubkeys) => resolve(pubkeys, 'read'),
    delete: (pubkey) => lists.delete(pubkey),
    clear: () => lists.clear(),
  };
}

function dedupe(urls: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (!seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}
