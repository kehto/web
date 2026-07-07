import type { NostrEvent } from 'nostr-tools';

/**
 * `@kehto/nip/51` — NIP-51 list & set parsing.
 *
 * NIP-51 organizes user data into two families of events whose items live in
 * tags (public) and, optionally, in NIP-44-encrypted content (private):
 *
 * - **Standard lists** — replaceable, kinds `10000`–`10101`. One per user per
 *   kind (e.g. mute list, bookmarks, blocked relays, DM relays).
 * - **Sets** — addressable / parameterized-replaceable, kinds `30000`–`30030`.
 *   Many per user, distinguished by a `d` identifier (e.g. follow sets, relay
 *   sets, emoji sets, curation sets).
 *
 * `nostr-tools` ships no NIP-51 helper. This module provides a single
 * widely-compatible parser that turns either family into a structured
 * {@link Nip51List}, plus item accessors and an injected-decryptor path for
 * private items (so the package stays crypto-free and framework-agnostic).
 *
 * @module
 */

/** Canonical NIP-51 **standard list** kinds (replaceable, one per author). */
export const LIST_KINDS: Readonly<Record<number, string>> = {
  10000: 'mute',
  10001: 'pinned-notes',
  10003: 'bookmarks',
  10004: 'communities',
  10005: 'public-chats',
  10006: 'blocked-relays',
  10007: 'search-relays',
  10009: 'simple-groups',
  10012: 'relay-feeds',
  10015: 'interests',
  10020: 'media-follows',
  10030: 'emojis',
  10050: 'dm-relays',
  10101: 'good-wiki-authors',
  10102: 'good-wiki-relays',
};

/** Canonical NIP-51 **set** kinds (addressable, many per author by `d`). */
export const SET_KINDS: Readonly<Record<number, string>> = {
  30000: 'follow-sets',
  30002: 'relay-sets',
  30003: 'bookmark-sets',
  30004: 'curation-sets',
  30005: 'video-curation-sets',
  30007: 'kind-mute-sets',
  30015: 'interest-sets',
  30019: 'release-sets',
  30020: 'release-artifact-sets',
  30030: 'emoji-sets',
  30063: 'release-artifact-sets',
  30267: 'app-curation-sets',
};

/**
 * Item-bearing NIP-51 tag names — the tags that carry list *content* (as
 * opposed to metadata tags like `d`, `title`, `image`, `description`).
 */
export const ITEM_TAGS = ['e', 'p', 'a', 't', 'r', 'word', 'emoji', 'relay', 'g', 'i', 'k'] as const;

/** Whether `kind` is a NIP-51 standard list kind (`10000`–`10101`). */
export function isListKind(kind: number): boolean {
  return Object.prototype.hasOwnProperty.call(LIST_KINDS, kind);
}

/** Whether `kind` is a NIP-51 set kind (`30000`–`30030`). */
export function isSetKind(kind: number): boolean {
  return Object.prototype.hasOwnProperty.call(SET_KINDS, kind);
}

/**
 * Friendly name for a NIP-51 list/set kind (e.g. `10000` → `'mute'`,
 * `30030` → `'emoji-sets'`), or `undefined` if `kind` is not a known NIP-51 kind.
 */
export function listKindName(kind: number): string | undefined {
  return LIST_KINDS[kind] ?? SET_KINDS[kind];
}

/**
 * A parsed NIP-51 list or set.
 *
 * `publicItems` holds the item-bearing tags verbatim. `privateItems` is
 * populated only after {@link decryptPrivateItems} runs; until then it is
 * `undefined` (the encrypted payload is left untouched in {@link Nip51List.encryptedContent}).
 *
 * @example
 * ```ts
 * const list = parseList(kind10000MuteEvent);
 * list.kind;        // 10000
 * list.type;        // 'mute'
 * list.family;      // 'list'
 * getTagValues(list.publicItems, 'p'); // muted pubkeys (public portion)
 * ```
 */
export interface Nip51List {
  /** Event kind. */
  kind: number;
  /** `'list'` for standard lists (10000–10101), `'set'` for sets (30000–30030), `'unknown'` otherwise. */
  family: 'list' | 'set' | 'unknown';
  /** Friendly kind name from {@link listKindName}, or `undefined` for unknown kinds. */
  type: string | undefined;
  /** Author pubkey. */
  pubkey: string;
  /** Set identifier from the `d` tag (sets only; `''` for standard lists / missing). */
  identifier: string;
  /** Addressable coordinate `kind:pubkey:d` for sets; `undefined` for standard lists. */
  address: string | undefined;
  /** Optional `title` tag (sets). */
  title: string | undefined;
  /** Optional `image` tag (sets). */
  image: string | undefined;
  /** Optional `description` tag (sets). */
  description: string | undefined;
  /** Item-bearing tags verbatim (the public portion of the list). */
  publicItems: string[][];
  /** Raw NIP-44-encrypted content, if any (the private portion). */
  encryptedContent: string | undefined;
  /** Decrypted private item tags — `undefined` until {@link decryptPrivateItems} succeeds. */
  privateItems: string[][] | undefined;
}

const META_TAGS = new Set(['d', 'title', 'image', 'description', 'name', 'summary', 'alt']);

/**
 * Parse a NIP-51 list or set event into a structured {@link Nip51List}.
 *
 * Works for any kind: known list/set kinds get a `type` and correct `family`;
 * unknown kinds still parse (`family: 'unknown'`) so forward-compatible callers
 * can handle new list kinds before this table is updated.
 *
 * Item-bearing tags (see {@link ITEM_TAGS}) become {@link Nip51List.publicItems};
 * metadata tags (`d`, `title`, `image`, `description`, …) are lifted into named
 * fields. The encrypted `content` is preserved verbatim in
 * {@link Nip51List.encryptedContent} — call {@link decryptPrivateItems} with a
 * NIP-44 decryptor to populate {@link Nip51List.privateItems}.
 *
 * @param event - A NIP-51 list or set event
 * @returns The structured list/set
 *
 * @example
 * ```ts
 * import { parseList, getTagValues } from '@kehto/nip/51';
 * const bookmarks = parseList(kind10003Event);
 * const notes = getTagValues(bookmarks.publicItems, 'e');
 * ```
 */
export function parseList(event: NostrEvent): Nip51List {
  const family: Nip51List['family'] = isListKind(event.kind)
    ? 'list'
    : isSetKind(event.kind)
      ? 'set'
      : 'unknown';

  const itemTagSet = new Set<string>(ITEM_TAGS);
  const publicItems: string[][] = [];
  let identifier = '';
  let title: string | undefined;
  let image: string | undefined;
  let description: string | undefined;

  for (const tag of event.tags) {
    const name = tag[0];
    if (name === 'd') identifier = tag[1] ?? '';
    else if (name === 'title') title = tag[1];
    else if (name === 'image') image = tag[1];
    else if (name === 'description') description = tag[1];
    else if (itemTagSet.has(name) && !META_TAGS.has(name)) publicItems.push([...tag]);
  }

  const isSet = family === 'set';
  const address = isSet ? `${event.kind}:${event.pubkey}:${identifier}` : undefined;
  const encryptedContent = event.content && event.content.length > 0 ? event.content : undefined;

  return {
    kind: event.kind,
    family,
    type: listKindName(event.kind),
    pubkey: event.pubkey,
    identifier,
    address,
    title,
    image,
    description,
    publicItems,
    encryptedContent,
    privateItems: undefined,
  };
}

/**
 * Collect the values (`tag[1]`) of every item tag with the given name.
 *
 * @param items - Item tags ({@link Nip51List.publicItems} or {@link Nip51List.privateItems})
 * @param tagName - Tag name to filter on (e.g. `'p'`, `'e'`, `'a'`, `'t'`, `'word'`)
 * @returns The second element of each matching tag (missing values skipped)
 *
 * @example
 * ```ts
 * const mutedPubkeys = getTagValues(list.publicItems, 'p');
 * const mutedWords = getTagValues(list.publicItems, 'word');
 * ```
 */
export function getTagValues(items: ReadonlyArray<ReadonlyArray<string>>, tagName: string): string[] {
  const out: string[] = [];
  for (const tag of items) {
    if (tag[0] === tagName && typeof tag[1] === 'string') out.push(tag[1]);
  }
  return out;
}

/**
 * A NIP-44 decryptor: takes the event's `content` and the author pubkey and
 * returns the plaintext (a JSON array of tags). Inject your signer's
 * `nip44.decrypt` (e.g. a NIP-07 `window.nostr.nip44`, a bunker, or
 * `nostr-tools/nip44`) so this package carries no crypto dependency.
 *
 * @example
 * ```ts
 * const decrypt: Nip44Decryptor = (content, author) =>
 *   window.nostr!.nip44!.decrypt(author, content);
 * ```
 */
export type Nip44Decryptor = (content: string, authorPubkey: string) => string | Promise<string>;

/**
 * Decrypt the private portion of a list/set and populate
 * {@link Nip51List.privateItems}.
 *
 * NIP-51 stores private items as a NIP-44-encrypted JSON array of tags in the
 * event `content`, encrypted to the author's own key. This helper runs the
 * injected {@link Nip44Decryptor}, parses the plaintext as `string[][]`, and
 * returns a **new** {@link Nip51List} with `privateItems` set (the input is not
 * mutated). Lists with no encrypted content return a copy with
 * `privateItems: []`.
 *
 * Throws if the decryptor throws or the plaintext is not a JSON tag array — so
 * callers can distinguish "no private items" from "couldn't read private items".
 *
 * @param list - A parsed list from {@link parseList}
 * @param decrypt - Injected NIP-44 decryptor
 * @returns A copy of `list` with `privateItems` populated
 *
 * @example
 * ```ts
 * const withPrivate = await decryptPrivateItems(list, (c, a) => signer.nip44.decrypt(a, c));
 * const privatelyMuted = getTagValues(withPrivate.privateItems!, 'p');
 * ```
 */
export async function decryptPrivateItems(list: Nip51List, decrypt: Nip44Decryptor): Promise<Nip51List> {
  if (!list.encryptedContent) {
    return { ...list, privateItems: [] };
  }
  const plaintext = await decrypt(list.encryptedContent, list.pubkey);
  const parsed: unknown = JSON.parse(plaintext);
  if (!Array.isArray(parsed) || !parsed.every((t) => Array.isArray(t) && t.every((s) => typeof s === 'string'))) {
    throw new Error('NIP-51: decrypted private items are not a string[][] tag array');
  }
  return { ...list, privateItems: parsed as string[][] };
}
