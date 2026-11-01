/**
 * domains/lists.ts — Mock NAP-LISTS service.
 *
 * Spec: naps/NAP-LISTS.md @ napplet/naps PR #68 head 7cf00cdb7bca (draft)
 * Routes: lists.supported, lists.add, lists.remove
 * Spec gaps / decisions:
 * - Supported lists are the NIP-51 kinds in `MOCK_LIST_SUPPORT` plus NIP-65
 *   kind 10002 (`relay-list-metadata`; the NIP-51 table-derived name
 *   `read-write-relays` is accepted as an alias for the same kind). Type-only
 *   `curation-sets` is ambiguous (30004 and 30005) and answers
 *   `ambiguous-list` with both candidates in `supported`, as the NAP requires.
 * - Private items need NIP-44, which a mock cannot perform honestly, so every
 *   row reports `privateItems: false` and `visibility: "private"` answers
 *   `private-items-unsupported`.
 * - Mutations run the full read-modify-publish flow over the shared store:
 *   unrelated tags and content are preserved, added items append after the
 *   existing ones, exact (tag name + value) matches are deduplicated into
 *   `skipped`, and a no-op mutation publishes nothing but still answers
 *   `ok: true` with the current list's `eventId`.
 * - NIP-65 marker rules follow the NAP: removing `read` from an unmarked tag
 *   rewrites it to `write` (and vice versa); omitted/`read-write` removes
 *   every matching `r` tag.
 * - `@napplet/core` 0.32.0 `ListMutationResult` lacks the `error`/`reason`
 *   fields the NAP defines; the mock writes them anyway (NAP is authoritative).
 */
import type { ListItem, ListItemType, ListOptions, ListRef, ListSupport, NostrEvent } from '@napplet/core';
import type { ListsAddMessage, ListsRemoveMessage } from '@napplet/nap/lists/types';
import { defineMockService, type MockRouteContext } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { asRequest, createMockNostrStore, resolveMockUser, type MockNostrStore } from './nostr-store.js';

/** Spec document the mock was written against. */
export const LISTS_SPEC_REF: NapSpecRef = {
  nap: 'NAP-LISTS',
  status: 'draft',
  source: 'pr',
  pr: 68,
  sha: '7cf00cdb7bca',
  path: 'naps/NAP-LISTS.md',
};

function support(kind: number, type: string, addressable: boolean, supportedItemTypes: ListItemType[]): ListSupport {
  return { kind, type, addressable, supportedItemTypes, privateItems: false };
}

/**
 * NIP-51 / NIP-65 lists the mock supports, in kind order.
 *
 * @example
 * ```ts
 * MOCK_LIST_SUPPORT.find((row) => row.type === 'mute-list')?.kind === 10000;
 * ```
 */
export const MOCK_LIST_SUPPORT: readonly ListSupport[] = Object.freeze([
  support(10000, 'mute-list', false, ['pubkey', 'event', 'hashtag', 'word']),
  support(10001, 'pinned-notes', false, ['event']),
  support(10002, 'relay-list-metadata', false, ['relay']),
  support(10003, 'bookmarks', false, ['event', 'address', 'hashtag', 'url']),
  support(10006, 'blocked-relays', false, ['relay']),
  support(10007, 'search-relays', false, ['relay']),
  support(10015, 'interests', false, ['hashtag', 'address']),
  support(10050, 'dm-relays', false, ['relay']),
  support(30000, 'follow-sets', true, ['pubkey']),
  support(30002, 'relay-sets', true, ['relay']),
  support(30003, 'bookmark-sets', true, ['event', 'address', 'hashtag', 'url']),
  support(30004, 'curation-sets', true, ['address', 'event']),
  support(30005, 'curation-sets', true, ['address']),
  support(30007, 'kind-mute-sets', true, ['pubkey']),
  support(30015, 'interest-sets', true, ['hashtag']),
]);

/** Alternate type names accepted for a kind. */
const TYPE_ALIASES: Readonly<Record<string, number>> = Object.freeze({ 'read-write-relays': 10002 });

/**
 * In-memory state of the lists mock.
 *
 * @example
 * ```ts
 * const state = createMockListsService().mock.state();
 * state.published.length === 0;
 * ```
 */
export interface MockListsState {
  /** Shared event store. */
  store: MockNostrStore;
  /** Current shell-user pubkey, or `''` when signed out. */
  user: string;
  /** List events published by mutations, oldest first. */
  published: NostrEvent[];
}

/**
 * Options for `createMockListsService`.
 *
 * @example
 * ```ts
 * const lists = createMockListsService({ store, user: 'alice' });
 * ```
 */
export interface MockListsOptions extends MockServiceOptions {
  /** Shared store; a fresh seeded one is created when omitted. */
  store?: MockNostrStore;
  /** Shell user (fixture name or hex pubkey); `''` starts signed out. Default `alice`. */
  user?: string;
}

/**
 * Lists mock with sign-in controls.
 *
 * @example
 * ```ts
 * const lists = createMockListsService();
 * lists.signOut(); // mutations now answer not-signed-in
 * ```
 */
export type MockListsService = MockService<MockListsState> & {
  /** Switch the shell user used as list author. */
  signIn(user: string): void;
  /** Clear the shell user; mutations answer `not-signed-in`. */
  signOut(): void;
};

/**
 * `ListItem` plus the NIP-65 `marker` field from NAP-LISTS PR #68.
 * `@napplet/core` 0.32.0 predates the marker; the NAP document is authoritative.
 *
 * @example
 * ```ts
 * const item: MockListItem = { itemType: 'relay', value: 'wss://relay-a.example.org', marker: 'read' };
 * ```
 */
export interface MockListItem extends ListItem {
  /** NIP-65 relay read/write marker. */
  marker?: 'read' | 'write' | 'read-write';
}

type ListsContext = MockRouteContext<MockListsState>;
type Failure = { error: string; reason: string; supported?: ListSupport[] };
type Resolved = { row: ListSupport; identifier?: string };

const RELAY_URL = /^wss?:\/\/\S+$/i;
const MARKERS = ['read', 'write', 'read-write'] as const;

function resolveList(ref: unknown): Resolved | Failure {
  if (typeof ref !== 'object' || ref === null) return { error: 'invalid-list-ref', reason: 'list must be an object with kind or type' };
  const { kind, type, identifier } = ref as Partial<ListRef>;
  const hasKind = kind !== undefined;
  const hasType = type !== undefined;
  if (hasKind === hasType) return { error: 'invalid-list-ref', reason: 'exactly one of kind or type is required' };
  let candidates: ListSupport[];
  if (hasKind) {
    if (!Number.isInteger(kind)) return { error: 'invalid-list-ref', reason: 'kind must be an integer' };
    candidates = MOCK_LIST_SUPPORT.filter((row) => row.kind === kind);
  } else if (typeof type !== 'string') {
    return { error: 'invalid-list-ref', reason: 'type must be a string' };
  } else {
    const alias = Object.hasOwn(TYPE_ALIASES, type) ? TYPE_ALIASES[type] : undefined;
    candidates = MOCK_LIST_SUPPORT.filter((row) => row.type === type || row.kind === alias);
  }
  if (candidates.length === 0) return { error: 'unsupported-list', reason: `list ${hasKind ? `kind ${String(kind)}` : `type ${String(type)}`} is not supported`, supported: [...MOCK_LIST_SUPPORT] };
  if (candidates.length > 1) return { error: 'ambiguous-list', reason: `type ${String(type)} maps to several kinds; retry with kind`, supported: candidates };
  const row = candidates[0]!;
  if (row.addressable && (typeof identifier !== 'string' || identifier.length === 0)) return { error: 'missing-identifier', reason: `${row.type} is addressable and requires identifier` };
  return row.addressable ? { row, identifier: identifier as string } : { row };
}

function tagName(row: ListSupport, itemType: ListItemType): string {
  switch (itemType) {
    case 'pubkey': return 'p';
    case 'event': return 'e';
    case 'address': return 'a';
    case 'hashtag': return 't';
    case 'url': return 'r';
    case 'relay': return row.kind === 10002 ? 'r' : 'relay';
    default: return itemType;
  }
}

function validateItem(row: ListSupport, item: unknown): MockListItem | Failure {
  if (typeof item !== 'object' || item === null) return { error: 'invalid-item', reason: 'item must be an object' };
  const { itemType, value, relay, marker, visibility } = item as Partial<MockListItem>;
  if (typeof itemType !== 'string' || !row.supportedItemTypes?.includes(itemType)) {
    return { error: 'unsupported-item', reason: `${row.type} does not accept itemType ${String(itemType)}` };
  }
  if (typeof value !== 'string' || value.length === 0) return { error: 'invalid-item', reason: 'value must be a non-empty string' };
  if (visibility === 'private') return { error: 'private-items-unsupported', reason: 'the mock cannot NIP-44 encrypt private items' };
  if (visibility !== undefined && visibility !== 'public') return { error: 'invalid-item', reason: 'visibility must be public or private' };
  if (itemType === 'relay' && !RELAY_URL.test(value)) return { error: 'invalid-item', reason: 'relay items must be ws:// or wss:// URLs' };
  if (marker !== undefined && (itemType !== 'relay' || !MARKERS.includes(marker))) return { error: 'invalid-item', reason: 'marker is only valid for relay items' };
  if (relay !== undefined && typeof relay !== 'string') return { error: 'invalid-item', reason: 'relay hint must be a string' };
  return { itemType, value, ...(relay ? { relay } : {}), ...(marker ? { marker } : {}) };
}

function itemTag(row: ListSupport, item: MockListItem): string[] {
  const name = tagName(row, item.itemType);
  if (row.kind === 10002) return item.marker === 'read' || item.marker === 'write' ? [name, item.value, item.marker] : [name, item.value];
  return item.relay && (name === 'p' || name === 'e' || name === 'a') ? [name, item.value, item.relay] : [name, item.value];
}

function newListTags(resolved: Resolved, options: ListOptions | undefined): string[][] {
  const tags: string[][] = [];
  if (resolved.identifier !== undefined) tags.push(['d', resolved.identifier]);
  if (typeof options?.title === 'string') tags.push(['title', options.title]);
  if (typeof options?.description === 'string') tags.push(['description', options.description]);
  if (typeof options?.image === 'string') tags.push(['image', options.image]);
  return tags;
}

function addItems(tags: string[][], row: ListSupport, items: MockListItem[]): { added: number; skipped: number } {
  let added = 0;
  let skipped = 0;
  for (const item of items) {
    const tag = itemTag(row, item);
    if (tags.some((existing) => existing[0] === tag[0] && existing[1] === tag[1])) {
      skipped += 1;
      continue;
    }
    tags.push(tag);
    added += 1;
  }
  return { added, skipped };
}

function removeRelayMarker(tags: string[][], url: string, marker: 'read' | 'write'): boolean {
  const opposite = marker === 'read' ? 'write' : 'read';
  let removed = false;
  for (let index = tags.length - 1; index >= 0; index -= 1) {
    const tag = tags[index]!;
    if (tag[0] !== 'r' || tag[1] !== url) continue;
    if (tag[2] === marker) { tags.splice(index, 1); removed = true; }
    else if (tag[2] === undefined) { tags[index] = ['r', url, opposite]; removed = true; }
  }
  return removed;
}

function removeItems(tags: string[][], row: ListSupport, items: MockListItem[]): { removed: number; skipped: number } {
  let removed = 0;
  let skipped = 0;
  for (const item of items) {
    const [name, value] = itemTag(row, item);
    let hit: boolean;
    if (row.kind === 10002 && (item.marker === 'read' || item.marker === 'write')) {
      hit = removeRelayMarker(tags, value!, item.marker);
    } else {
      const before = tags.length;
      for (let index = tags.length - 1; index >= 0; index -= 1) if (tags[index]![0] === name && tags[index]![1] === value) tags.splice(index, 1);
      hit = tags.length !== before;
    }
    if (hit) removed += 1;
    else skipped += 1;
  }
  return { removed, skipped };
}

function fail(context: ListsContext, failure: Failure): void {
  context.reply({ ok: false, error: failure.error, reason: failure.reason, ...(failure.supported ? { supported: failure.supported } : {}) });
}

function prepare(context: ListsContext): { resolved: Resolved; items: MockListItem[]; current: NostrEvent | undefined } | undefined {
  const { message, state } = context;
  const { list, items: rawItems } = asRequest<ListsAddMessage | ListsRemoveMessage>(message);
  if (state.user === '') { fail(context, { error: 'not-signed-in', reason: 'no shell user is connected' }); return undefined; }
  const resolved = resolveList(list);
  if ('error' in resolved) { fail(context, resolved); return undefined; }
  if (!Array.isArray(rawItems) || rawItems.length === 0) { fail(context, { error: 'invalid-item', reason: 'items must be a non-empty array' }); return undefined; }
  const items: MockListItem[] = [];
  for (const raw of rawItems) {
    const item = validateItem(resolved.row, raw);
    if ('error' in item) { fail(context, item); return undefined; }
    items.push(item);
  }
  return { resolved, items, current: state.store.latest(resolved.row.kind, state.user, resolved.identifier) };
}

function publishList(state: MockListsState, kind: number, tags: string[][], content: string): NostrEvent {
  const event = state.store.publish({ kind, tags, content }, state.user);
  state.published.push(event);
  return event;
}

function handleAdd(context: ListsContext): void {
  const prepared = prepare(context);
  if (!prepared) return;
  const { resolved, items, current } = prepared;
  const { options } = asRequest<ListsAddMessage>(context.message);
  if (!current && options?.create !== true) {
    fail(context, { error: 'list-not-found', reason: `${resolved.row.type} does not exist; pass options.create to create it` });
    return;
  }
  const tags = current ? current.tags.map((tag) => [...tag]) : newListTags(resolved, options);
  const { added, skipped } = addItems(tags, resolved.row, items);
  if (added === 0 && current) {
    context.reply({ ok: true, eventId: current.id, event: current, added, skipped });
    return;
  }
  const event = publishList(context.state, resolved.row.kind, tags, current?.content ?? '');
  context.reply({ ok: true, eventId: event.id, event, added, skipped });
}

function handleRemove(context: ListsContext): void {
  const prepared = prepare(context);
  if (!prepared) return;
  const { resolved, items, current } = prepared;
  if (!current) {
    fail(context, { error: 'list-not-found', reason: `${resolved.row.type} does not exist` });
    return;
  }
  const tags = current.tags.map((tag) => [...tag]);
  const { removed, skipped } = removeItems(tags, resolved.row, items);
  if (removed === 0) {
    context.reply({ ok: true, eventId: current.id, event: current, removed, skipped });
    return;
  }
  const event = publishList(context.state, resolved.row.kind, tags, current.content);
  context.reply({ ok: true, eventId: event.id, event, removed, skipped });
}

/**
 * Create the NAP-LISTS mock.
 *
 * @param options - Store, shell user, and shared mock options.
 * @returns A lists `ServiceHandler` with `mock` controls.
 * @example
 * ```ts
 * const lists = createMockListsService();
 * lists.handleMessage('w1', { type: 'lists.supported', id: 's1' }, console.log);
 * ```
 */
export function createMockListsService(options: MockListsOptions = {}): MockListsService {
  const store = options.store ?? createMockNostrStore(options.clock ? { clock: options.clock } : {});
  const ownsStore = options.store === undefined;

  const base = defineMockService<MockListsState>({
    domain: 'lists',
    version: '1.0.0',
    description: 'Mock NAP-LISTS: NIP-51/NIP-65 list mutations over nostr fixtures',
    kind: 'service',
    initialState: () => {
      if (ownsStore) store.reset();
      return { store, user: resolveMockUser(options.user), published: [] };
    },
    routes: {
      'lists.supported': ({ reply }) => reply({ lists: [...MOCK_LIST_SUPPORT] }),
      'lists.add': handleAdd,
      'lists.remove': handleRemove,
    },
  }, options);

  const service: MockListsService = Object.assign(base, {
    signIn(user: string): void { service.mock.state().user = resolveMockUser(user); },
    signOut(): void { service.mock.state().user = ''; },
  });
  return service;
}

/** Registry row for the lists domain. */
export const LISTS_MOCK_ENTRY: MockDomainEntry = {
  domain: 'lists',
  kind: 'service',
  spec: LISTS_SPEC_REF,
  create: (options) => createMockListsService(options),
};
