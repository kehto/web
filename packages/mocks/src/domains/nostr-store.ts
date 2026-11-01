/**
 * domains/nostr-store.ts — Shared in-memory Nostr event store for the social
 * mocks (relay, outbox, count, identity, common, lists).
 *
 * One store instance is seeded from `MOCK_EVENTS` plus the NIP-51 list
 * fixtures below. Every social mock creates its own store by default; pass the
 * same `MockNostrStore` to several factories so a publish through one domain
 * (for example `outbox.publish`) fans out to subscriptions held by another
 * (for example `relay.subscribe`).
 *
 * Signing is placeholder-only: ids and signatures derive from a per-store
 * sequence so they are stable across runs but never verifiable.
 */
import type { EventTemplate, NappletMessage, NostrEvent, NostrFilter, RelayEventResult } from '@napplet/core';
import { DEFAULT_CLOCK } from '../core/handler.js';
import { mockEventId, mockPubkey, mockSignature } from '../core/rng.js';
import type { MockClock } from '../core/types.js';
import {
  buildMockEvent,
  findMockAccount,
  MOCK_ACCOUNTS,
  MOCK_EPOCH_SECONDS,
  MOCK_EVENTS,
  MOCK_RELAYS,
  queryNostrEvents,
} from '../fixtures/nostr.js';

/** Pubkey of a muted account that is not part of `MOCK_ACCOUNTS`. */
export const MOCK_SPAM_PUBKEY: string = mockPubkey('spammer');

/** Relays used when an author has no kind-10002 relay list. */
export const MOCK_FALLBACK_RELAYS: readonly string[] = Object.freeze([MOCK_RELAYS.primary, MOCK_RELAYS.discovery]);

function listEvents(): NostrEvent[] {
  const alice = MOCK_ACCOUNTS[0]!;
  const carol = findMockAccount('carol')!;
  const frank = findMockAccount('frank')!;
  const at = (offset: number): number => MOCK_EPOCH_SECONDS + 300 + offset;
  return [
    buildMockEvent('list:alice:mute', { kind: 10000, pubkey: alice.pubkey, created_at: at(0), tags: [['p', MOCK_SPAM_PUBKEY], ['t', 'airdrop'], ['word', 'giveaway']] }),
    buildMockEvent('list:alice:pinned', { kind: 10001, pubkey: alice.pubkey, created_at: at(1), tags: [['e', mockEventId('note:alice:0')]] }),
    buildMockEvent('list:alice:bookmarks', {
      kind: 10003,
      pubkey: alice.pubkey,
      created_at: at(2),
      tags: [['e', mockEventId('note:bob:1'), MOCK_RELAYS.secondary], ['e', mockEventId('note:carol:2'), MOCK_RELAYS.tertiary], ['t', 'linux']],
    }),
    buildMockEvent('list:alice:interests', { kind: 10015, pubkey: alice.pubkey, created_at: at(3), tags: [['t', 'linux'], ['t', 'nixos']] }),
    buildMockEvent('list:alice:follow-set:distro-maintainers', {
      kind: 30000,
      pubkey: alice.pubkey,
      created_at: at(4),
      tags: [['d', 'distro-maintainers'], ['title', 'Distro maintainers'], ['p', carol.pubkey, MOCK_RELAYS.tertiary], ['p', frank.pubkey, MOCK_RELAYS.secondary]],
    }),
  ];
}

/**
 * Alice's NIP-51 list fixtures: kind 10000 mute list, 10001 pinned notes,
 * 10003 bookmarks, 10015 interests, and a kind 30000 follow set
 * (`d` = `distro-maintainers`).
 *
 * @example
 * ```ts
 * const mutes = MOCK_LIST_EVENTS.find((event) => event.kind === 10000);
 * ```
 */
export const MOCK_LIST_EVENTS: readonly NostrEvent[] = Object.freeze(listEvents());

/** Default seed: `MOCK_EVENTS` followed by `MOCK_LIST_EVENTS`. */
export const MOCK_STORE_EVENTS: readonly NostrEvent[] = Object.freeze([...MOCK_EVENTS, ...MOCK_LIST_EVENTS]);

/**
 * One parsed NIP-65 `r` tag.
 *
 * @example
 * ```ts
 * const entry: MockRelayEntry = { url: 'wss://relay-a.example.org', read: true, write: true };
 * ```
 */
export interface MockRelayEntry {
  /** Relay URL. */
  url: string;
  /** Whether the author reads from this relay. */
  read: boolean;
  /** Whether the author writes to this relay. */
  write: boolean;
}

/**
 * Options for `createMockNostrStore`.
 *
 * @example
 * ```ts
 * const store = createMockNostrStore({ events: MOCK_EVENTS, clock: { now: () => 0 } });
 * ```
 */
export interface MockNostrStoreOptions {
  /** Seed events. Default `MOCK_STORE_EVENTS`. */
  events?: readonly NostrEvent[];
  /** Clock used for `created_at` of signed events. Default: `Date.now`. */
  clock?: MockClock;
}

/**
 * In-memory event store shared by the social mocks.
 *
 * @example
 * ```ts
 * const store = createMockNostrStore();
 * const note = store.publish({ kind: 1, content: 'hi', tags: [] }, MOCK_ACCOUNTS[0].pubkey);
 * store.get(note.id) === note;
 * ```
 */
export interface MockNostrStore {
  /** Every stored event, oldest insertion first (live array; treat as read-only). */
  events(): readonly NostrEvent[];
  /** NIP-01 query over the store (OR filters, newest first, smallest `limit`). */
  query(filters: readonly NostrFilter[]): NostrEvent[];
  /** Event by exact id. */
  get(id: string): NostrEvent | undefined;
  /** Newest replaceable/addressable event for an author. */
  latest(kind: number, pubkey: string, identifier?: string): NostrEvent | undefined;
  /**
   * Insert an event. Replaceable kinds (0, 3, 10000-19999) and addressable
   * kinds (30000-39999) replace the author's previous event. Returns `false`
   * when an event with the same id already exists.
   */
  add(event: NostrEvent): boolean;
  /** Build a placeholder-signed event for `pubkey` without storing it. */
  sign(template: MockEventTemplate, pubkey: string): NostrEvent;
  /** `sign` then `add`; listeners fire. */
  publish(template: MockEventTemplate, pubkey: string): NostrEvent;
  /** Parsed kind-10002 relay list of an author, or `undefined` when absent. */
  relayList(pubkey: string): MockRelayEntry[] | undefined;
  /** Relay URLs where an event is "observed": the author's write relays, else `MOCK_FALLBACK_RELAYS`. */
  hintsFor(event: NostrEvent): string[];
  /** Wrap an event as a `RelayEventResult` with `sidecar.relayHints`. */
  toResult(event: NostrEvent): RelayEventResult;
  /** Listen for events inserted by `add`/`publish`. Returns an unsubscribe function. */
  onEvent(listener: (event: NostrEvent) => void): () => void;
  /** Restore the seed events and the signing sequence. Listeners are kept. */
  reset(): void;
}

/**
 * Loosely typed event template: `kind` is required, everything else optional.
 *
 * @example
 * ```ts
 * const template: MockEventTemplate = { kind: 1, content: 'hello' };
 * ```
 */
export interface MockEventTemplate extends Partial<EventTemplate> {
  /** Event kind. */
  kind: number;
}

function isReplaceable(kind: number): boolean {
  return kind === 0 || kind === 3 || (kind >= 10000 && kind < 20000);
}

function isAddressable(kind: number): boolean {
  return kind >= 30000 && kind < 40000;
}

/**
 * `d` tag value of an addressable event (empty string when missing).
 *
 * @param event - Any event.
 * @returns The identifier.
 * @example
 * ```ts
 * eventIdentifier(followSet) === 'distro-maintainers';
 * ```
 */
export function eventIdentifier(event: NostrEvent): string {
  return event.tags.find((tag) => tag[0] === 'd')?.[1] ?? '';
}

/**
 * Parse NIP-65 `r` tags into relay entries.
 *
 * @param event - A kind-10002 event.
 * @returns One entry per `r` tag.
 * @example
 * ```ts
 * parseRelayTags(relayList).every((entry) => entry.url.startsWith('wss://'));
 * ```
 */
export function parseRelayTags(event: NostrEvent): MockRelayEntry[] {
  const entries: MockRelayEntry[] = [];
  for (const tag of event.tags) {
    if (tag[0] !== 'r' || typeof tag[1] !== 'string') continue;
    const marker = tag[2];
    entries.push({ url: tag[1], read: marker !== 'write', write: marker !== 'read' });
  }
  return entries;
}

/**
 * Whether `value` is a lowercase hex string of exactly `length` characters.
 *
 * @param value - Candidate.
 * @param length - Expected length (64 for keys and ids).
 * @returns Type guard result.
 * @example
 * ```ts
 * isHex(MOCK_ACCOUNTS[0].pubkey, 64) === true;
 * ```
 */
export function isHex(value: unknown, length: number): value is string {
  return typeof value === 'string' && value.length === length && /^[0-9a-f]+$/.test(value);
}

/**
 * Narrow an inbound envelope to a NAP request type. This is a plain downcast
 * with no runtime check; routes validate the fields they read.
 *
 * @param message - Envelope matched by exact `type`.
 * @returns The same object typed as `T`.
 * @example
 * ```ts
 * const { subId } = asRequest<RelaySubscribeMessage>(message);
 * ```
 */
export function asRequest<T extends NappletMessage>(message: NappletMessage): T {
  return message as T;
}

/**
 * Normalize a wire `filters` field (one filter or an array) into an array.
 * Returns `null` when nothing usable is present.
 *
 * @param raw - Wire value.
 * @returns Filter array or `null`.
 * @example
 * ```ts
 * normalizeFilters({ kinds: [1] })?.length === 1;
 * ```
 */
export function normalizeFilters(raw: unknown): NostrFilter[] | null {
  if (Array.isArray(raw)) {
    const filters = raw.filter((item): item is NostrFilter => typeof item === 'object' && item !== null && !Array.isArray(item));
    return filters.length > 0 ? filters : null;
  }
  if (typeof raw === 'object' && raw !== null) return [raw as NostrFilter];
  return null;
}

/**
 * Resolve a shell-user option (`alice`, a fixture name, or a hex pubkey) to a
 * hex pubkey. Unknown names fall back to `mockPubkey(name)`.
 *
 * @param user - Account name or pubkey. Default `alice`.
 * @returns Hex pubkey, or `''` when `user` is the empty string (signed out).
 * @example
 * ```ts
 * resolveMockUser('bob') === MOCK_ACCOUNTS[1].pubkey;
 * ```
 */
export function resolveMockUser(user: string | undefined): string {
  if (user === '') return '';
  const key = user ?? 'alice';
  return findMockAccount(key)?.pubkey ?? (isHex(key, 64) ? key : mockPubkey(key));
}

/**
 * Create a seeded in-memory event store.
 *
 * @param options - Seed events and clock.
 * @returns A fresh store.
 * @example
 * ```ts
 * const store = createMockNostrStore();
 * store.query([{ kinds: [1], limit: 5 }]).length === 5;
 * ```
 */
export function createMockNostrStore(options: MockNostrStoreOptions = {}): MockNostrStore {
  const seed = options.events ?? MOCK_STORE_EVENTS;
  const clock = options.clock ?? DEFAULT_CLOCK;
  const listeners = new Set<(event: NostrEvent) => void>();
  let events: NostrEvent[] = [];
  let sequence = 0;

  const indexOfReplaced = (event: NostrEvent): number => {
    if (!isReplaceable(event.kind) && !isAddressable(event.kind)) return -1;
    const identifier = isAddressable(event.kind) ? eventIdentifier(event) : undefined;
    return events.findIndex((item) =>
      item.kind === event.kind && item.pubkey === event.pubkey && (identifier === undefined || eventIdentifier(item) === identifier));
  };

  const store: MockNostrStore = {
    events: () => events,
    query: (filters) => queryNostrEvents(events, filters),
    get: (id) => events.find((event) => event.id === id),
    latest(kind, pubkey, identifier) {
      const candidates = events.filter((event) =>
        event.kind === kind && event.pubkey === pubkey && (identifier === undefined || eventIdentifier(event) === identifier));
      candidates.sort((left, right) => right.created_at - left.created_at);
      return candidates[0];
    },
    add(event) {
      if (events.some((item) => item.id === event.id)) return false;
      const replaced = indexOfReplaced(event);
      if (replaced >= 0) events.splice(replaced, 1);
      events.push(event);
      for (const listener of listeners) listener(event);
      return true;
    },
    sign(template, pubkey) {
      sequence += 1;
      const label = `store:${sequence}`;
      return {
        id: mockEventId(label),
        pubkey,
        created_at: template.created_at ?? Math.floor(clock.now() / 1000),
        kind: template.kind,
        tags: template.tags ?? [],
        content: template.content ?? '',
        sig: mockSignature(label),
      };
    },
    publish(template, pubkey) {
      const event = store.sign(template, pubkey);
      store.add(event);
      return event;
    },
    relayList(pubkey) {
      const list = store.latest(10002, pubkey);
      return list ? parseRelayTags(list) : undefined;
    },
    hintsFor(event) {
      const writes = store.relayList(event.pubkey)?.filter((entry) => entry.write).map((entry) => entry.url) ?? [];
      return writes.length > 0 ? writes : [...MOCK_FALLBACK_RELAYS];
    },
    toResult: (event) => ({ event, sidecar: { relayHints: store.hintsFor(event) } }),
    onEvent(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    reset() {
      events = [...seed];
      sequence = 0;
    },
  };
  store.reset();
  return store;
}
