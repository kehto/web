/**
 * fixtures/nostr.ts — Deterministic Nostr accounts, relays, and events shared
 * by the social mocks (relay, outbox, count, identity, common, lists, dm).
 *
 * Events carry placeholder ids and signatures; they are shaped like NIP-01
 * events but are not verifiable and must never be published to a real relay.
 */
import type { NostrEvent, NostrFilter } from '@napplet/core';
import { mockEventId, mockPubkey, mockSignature } from '../core/rng.js';

/**
 * A named mock account.
 *
 * @example
 * ```ts
 * const alice = MOCK_ACCOUNTS[0];
 * alice.pubkey.length === 64;
 * ```
 */
export interface MockAccount {
  /** Short handle, e.g. `alice`. */
  name: string;
  /** Deterministic 64-hex pubkey. */
  pubkey: string;
  /** Kind-0 display name. */
  displayName: string;
  /** Kind-0 about text. */
  about: string;
  /** Relays this account writes to (NIP-65). */
  writeRelays: readonly string[];
  /** Relays this account reads from (NIP-65). */
  readRelays: readonly string[];
}

/** Example relay URLs used throughout the fixtures. */
export const MOCK_RELAYS = Object.freeze({
  primary: 'wss://relay-a.example.org',
  secondary: 'wss://relay-b.example.net',
  tertiary: 'wss://relay-c.example.com',
  discovery: 'wss://discovery.example.org',
} as const);

/** Every relay URL in `MOCK_RELAYS`, in a stable order. */
export const MOCK_RELAY_URLS: readonly string[] = Object.freeze(Object.values(MOCK_RELAYS));

function account(name: string, displayName: string, about: string, writeRelays: readonly string[], readRelays: readonly string[]): MockAccount {
  return { name, pubkey: mockPubkey(name), displayName, about, writeRelays, readRelays };
}

/**
 * Six deterministic accounts. The first (`alice`) is the default shell user.
 *
 * @example
 * ```ts
 * const bob = MOCK_ACCOUNTS.find((a) => a.name === 'bob');
 * ```
 */
export const MOCK_ACCOUNTS: readonly MockAccount[] = Object.freeze([
  account('alice', 'Alice', 'Shell user of the mock environment.', [MOCK_RELAYS.primary, MOCK_RELAYS.secondary], [MOCK_RELAYS.primary, MOCK_RELAYS.tertiary]),
  account('bob', 'Bob', 'Posts about kernel builds.', [MOCK_RELAYS.secondary], [MOCK_RELAYS.secondary, MOCK_RELAYS.primary]),
  account('carol', 'Carol', 'Maintains a distro mirror.', [MOCK_RELAYS.tertiary], [MOCK_RELAYS.tertiary]),
  account('dave', 'Dave', 'Writes release notes.', [MOCK_RELAYS.primary], [MOCK_RELAYS.primary]),
  account('erin', 'Erin', 'Runs a community relay.', [MOCK_RELAYS.discovery], [MOCK_RELAYS.discovery, MOCK_RELAYS.primary]),
  account('frank', 'Frank', 'Packages desktop environments.', [MOCK_RELAYS.secondary, MOCK_RELAYS.tertiary], [MOCK_RELAYS.secondary]),
]);

/**
 * Look up a fixture account by name or pubkey.
 *
 * @param key - Account name or 64-hex pubkey.
 * @returns The account or `undefined`.
 * @example
 * ```ts
 * findMockAccount('alice')?.pubkey;
 * ```
 */
export function findMockAccount(key: string): MockAccount | undefined {
  return MOCK_ACCOUNTS.find((item) => item.name === key || item.pubkey === key);
}

/** Base timestamp (seconds) for fixture events: 2026-01-01T00:00:00Z. */
export const MOCK_EPOCH_SECONDS = 1_767_225_600;

/**
 * Build a deterministic, placeholder-signed event.
 *
 * @param label - Stable label that seeds `id` and `sig`.
 * @param fields - Event fields; `created_at` defaults to `MOCK_EPOCH_SECONDS`.
 * @returns A NIP-01 shaped event.
 * @example
 * ```ts
 * const note = buildMockEvent('note:alice:hello', { kind: 1, pubkey: alice.pubkey, content: 'hi' });
 * ```
 */
export function buildMockEvent(
  label: string,
  fields: { kind: number; pubkey: string; content?: string; tags?: string[][]; created_at?: number },
): NostrEvent {
  return {
    id: mockEventId(label),
    pubkey: fields.pubkey,
    created_at: fields.created_at ?? MOCK_EPOCH_SECONDS,
    kind: fields.kind,
    tags: fields.tags ?? [],
    content: fields.content ?? '',
    sig: mockSignature(label),
  };
}

function profileEvent(item: MockAccount, index: number): NostrEvent {
  return buildMockEvent(`profile:${item.name}`, {
    kind: 0,
    pubkey: item.pubkey,
    content: JSON.stringify({ name: item.name, display_name: item.displayName, about: item.about, picture: `https://avatars.example.org/${item.name}.png` }),
    created_at: MOCK_EPOCH_SECONDS + index,
  });
}

function relayListEvent(item: MockAccount, index: number): NostrEvent {
  const tags: string[][] = [];
  for (const url of new Set([...item.writeRelays, ...item.readRelays])) {
    const write = item.writeRelays.includes(url);
    const read = item.readRelays.includes(url);
    tags.push(write && read ? ['r', url] : write ? ['r', url, 'write'] : ['r', url, 'read']);
  }
  return buildMockEvent(`relays:${item.name}`, { kind: 10002, pubkey: item.pubkey, tags, created_at: MOCK_EPOCH_SECONDS + 100 + index });
}

function contactsEvent(item: MockAccount, index: number): NostrEvent {
  const tags = MOCK_ACCOUNTS.filter((other) => other.name !== item.name).map((other) => ['p', other.pubkey, other.writeRelays[0] ?? '', other.name]);
  return buildMockEvent(`contacts:${item.name}`, { kind: 3, pubkey: item.pubkey, tags, created_at: MOCK_EPOCH_SECONDS + 200 + index });
}

const NOTE_TEXTS: readonly string[] = Object.freeze([
  'Fresh Debian netinst image mirrored tonight.',
  'Kernel 6.12 builds clean on the test box.',
  'Reminder: verify checksums before flashing a USB stick.',
  'Trying NixOS for the lab workstation this week.',
  'Alpine fits on the tiniest edge devices.',
  'Who else runs Tumbleweed on a laptop?',
]);

function noteEvents(): NostrEvent[] {
  const events: NostrEvent[] = [];
  MOCK_ACCOUNTS.forEach((item, accountIndex) => {
    NOTE_TEXTS.forEach((text, noteIndex) => {
      const created = MOCK_EPOCH_SECONDS + 1000 + accountIndex * 60 + noteIndex * 600;
      events.push(buildMockEvent(`note:${item.name}:${noteIndex}`, {
        kind: 1,
        pubkey: item.pubkey,
        content: `${text} (#${noteIndex + 1})`,
        tags: [['t', 'linux']],
        created_at: created,
      }));
    });
  });
  return events;
}

/**
 * Full fixture event set: kind 0 profiles, kind 3 contacts, kind 10002 relay
 * lists, and 36 kind-1 notes tagged `#linux`.
 *
 * @example
 * ```ts
 * const notes = MOCK_EVENTS.filter((e) => e.kind === 1);
 * ```
 */
export const MOCK_EVENTS: readonly NostrEvent[] = Object.freeze([
  ...MOCK_ACCOUNTS.map(profileEvent),
  ...MOCK_ACCOUNTS.map(contactsEvent),
  ...MOCK_ACCOUNTS.map(relayListEvent),
  ...noteEvents(),
]);

/**
 * NIP-01 filter match (ids, authors, kinds, since, until, `#tag`, limit is
 * ignored here).
 *
 * @param event - Candidate event.
 * @param filter - A NIP-01 filter.
 * @returns Whether the event satisfies the filter.
 * @example
 * ```ts
 * matchesNostrFilter(note, { kinds: [1] });
 * ```
 */
export function matchesNostrFilter(event: NostrEvent, filter: NostrFilter): boolean {
  if (filter.ids && !filter.ids.some((id) => event.id.startsWith(id))) return false;
  if (filter.authors && !filter.authors.some((author) => event.pubkey.startsWith(author))) return false;
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
  if (filter.since !== undefined && event.created_at < filter.since) return false;
  if (filter.until !== undefined && event.created_at > filter.until) return false;
  for (const [key, values] of Object.entries(filter)) {
    if (!key.startsWith('#') || !Array.isArray(values)) continue;
    const tagValues = event.tags.filter((tag) => tag[0] === key.slice(1)).map((tag) => tag[1]);
    if (!(values as string[]).some((value) => tagValues.includes(value))) return false;
  }
  return true;
}

/**
 * Query a list of events with one or more filters (OR semantics), newest
 * first, honoring the smallest `limit` present.
 *
 * @param events - Candidate events.
 * @param filters - NIP-01 filters.
 * @returns Matching events sorted by `created_at` descending.
 * @example
 * ```ts
 * queryNostrEvents(MOCK_EVENTS, [{ kinds: [0], limit: 2 }]).length === 2;
 * ```
 */
export function queryNostrEvents(events: readonly NostrEvent[], filters: readonly NostrFilter[]): NostrEvent[] {
  const matched = events.filter((event) => filters.some((filter) => matchesNostrFilter(event, filter)));
  matched.sort((left, right) => right.created_at - left.created_at || left.id.localeCompare(right.id));
  const limits = filters.map((filter) => filter.limit).filter((limit): limit is number => typeof limit === 'number');
  return limits.length > 0 ? matched.slice(0, Math.min(...limits)) : matched;
}
