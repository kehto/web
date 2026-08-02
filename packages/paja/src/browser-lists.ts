import type {
  EventTemplate,
  ListItem,
  ListMutationResult,
  ListOptions,
  ListRef,
  ListSupport,
  NostrEvent,
  NostrFilter,
} from '@napplet/core';
import type { Signer } from '@kehto/runtime';
import { verifyEvent } from 'nostr-tools/pure';
import {
  PAJA_LIVE_QUERY_WAIT_MS,
  type PajaRelayBackend,
} from './browser-relay-runtime.js';

const HEX_64 = /^[0-9a-f]{64}$/i;
const ADDRESS = /^\d+:[0-9a-f]{64}:.+$/i;

type RelayMarker = 'read' | 'write' | 'read-write';
type PajaListItem = ListItem & { marker?: RelayMarker };

interface SupportedList extends ListSupport {
  readonly tagByItemType: Readonly<Record<string, string>>;
}

const SUPPORTED_LISTS: readonly SupportedList[] = [
  {
    kind: 10_000,
    type: 'mute-list',
    addressable: false,
    supportedItemTypes: ['pubkey', 'event', 'hashtag', 'word'],
    privateItems: false,
    tagByItemType: { pubkey: 'p', event: 'e', hashtag: 't', word: 'word' },
  },
  {
    kind: 10_002,
    type: 'relay-list-metadata',
    addressable: false,
    supportedItemTypes: ['relay'],
    privateItems: false,
    tagByItemType: { relay: 'r' },
  },
  {
    kind: 10_003,
    type: 'bookmarks',
    addressable: false,
    supportedItemTypes: ['event', 'address'],
    privateItems: false,
    tagByItemType: { event: 'e', address: 'a' },
  },
  {
    kind: 30_000,
    type: 'follow-sets',
    addressable: true,
    supportedItemTypes: ['pubkey'],
    privateItems: false,
    tagByItemType: { pubkey: 'p' },
  },
] as const;

/** Dependencies for Paja's Nostr-backed NAP-LISTS implementation. */
export interface PajaListsBackendOptions {
  /** Relay backend shared with Paja's relay and outbox services. */
  readonly relay: PajaRelayBackend;
  /** Current live relay policy. */
  readonly getRelays: () => string[];
  /** Current shell-user signer. */
  readonly getSigner: () => Signer | null;
}

/** NAP-LISTS hooks backed by verified NIP-51/NIP-65 events. */
export interface PajaListsBackend {
  supported(): readonly ListSupport[];
  add(list: ListRef, items: readonly ListItem[], options?: ListOptions): Promise<ListMutationResult>;
  remove(list: ListRef, items: readonly ListItem[], options?: ListOptions): Promise<ListMutationResult>;
}

interface ResolvedList {
  readonly support: SupportedList;
  readonly identifier?: string;
}

function publicSupport(): ListSupport[] {
  return SUPPORTED_LISTS.map(({ tagByItemType: _tagByItemType, ...support }) => ({
    ...support,
    supportedItemTypes: support.supportedItemTypes ? [...support.supportedItemTypes] : undefined,
  }));
}

function failure(error: string, reason: string): ListMutationResult {
  return { ok: false, error, reason, supported: publicSupport() };
}

function resolveList(ref: ListRef): ResolvedList | ListMutationResult {
  const input = ref as { kind?: unknown; type?: unknown; identifier?: unknown };
  const hasKind = typeof input.kind === 'number';
  const hasType = typeof input.type === 'string' && input.type.length > 0;
  if (hasKind === hasType) return failure('invalid-list-ref', 'exactly one list kind or type is required');
  const candidates = hasKind
    ? SUPPORTED_LISTS.filter((support) => support.kind === input.kind)
    : SUPPORTED_LISTS.filter((support) => support.type === input.type);
  if (candidates.length === 0) return failure('unsupported-list', 'list kind or type is not supported');
  if (candidates.length > 1) return failure('ambiguous-list', 'list type maps to multiple supported kinds');
  const support = candidates[0];
  const identifier = typeof input.identifier === 'string' && input.identifier.length > 0
    ? input.identifier
    : undefined;
  if (support.addressable && !identifier) return failure('missing-identifier', 'addressable lists require an identifier');
  if (!support.addressable && identifier) return failure('invalid-list-ref', 'replaceable list does not accept an identifier');
  return { support, ...(identifier ? { identifier } : {}) };
}

function relayUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:' ? parsed.href : null;
  } catch {
    return null;
  }
}

function itemTag(support: SupportedList, item: PajaListItem): string[] | ListMutationResult {
  if (item.visibility === 'private') return failure('private-items-unsupported', 'private list items require NIP-44 support');
  const tagName = support.tagByItemType[item.itemType];
  if (!tagName) return failure('unsupported-item', `${item.itemType} is not supported by ${support.type}`);
  const value = item.value.trim();
  if (!value) return failure('invalid-item', 'list item value is empty');
  if ((item.itemType === 'pubkey' || item.itemType === 'event') && !HEX_64.test(value)) {
    return failure('invalid-item', `${item.itemType} values must be 32-byte hex`);
  }
  if (item.itemType === 'address' && !ADDRESS.test(value)) {
    return failure('invalid-item', 'address values must use kind:pubkey:identifier');
  }
  if (support.kind === 10_002) {
    const url = relayUrl(value);
    if (!url) return failure('invalid-item', 'relay list items require ws or wss URLs');
    const marker = item.marker ?? 'read-write';
    if (marker !== 'read' && marker !== 'write' && marker !== 'read-write') {
      return failure('invalid-item', 'relay marker must be read, write, or read-write');
    }
    return marker === 'read-write' ? ['r', url] : ['r', url, marker];
  }
  const tag = [tagName, value];
  if (item.relay) tag.push(item.relay);
  if (item.label) tag.push(item.label);
  return tag;
}

function isFailure(value: string[] | ListMutationResult): value is ListMutationResult {
  return !Array.isArray(value);
}

function sameItem(tag: string[], expected: string[]): boolean {
  if (tag[0] !== expected[0] || tag[1] !== expected[1]) return false;
  if (expected.length > 2 && tag[2] !== expected[2]) return false;
  if (expected.length > 3 && tag[3] !== expected[3]) return false;
  return true;
}

function relayCoverage(tag: string[]): Set<'read' | 'write'> {
  if (tag[2] === 'read') return new Set(['read']);
  if (tag[2] === 'write') return new Set(['write']);
  return new Set(['read', 'write']);
}

function relayTag(url: string, coverage: Set<'read' | 'write'>): string[] | null {
  if (coverage.size === 0) return null;
  if (coverage.size === 2) return ['r', url];
  return ['r', url, coverage.has('read') ? 'read' : 'write'];
}

function sameRelay(tag: string[], url: string): boolean {
  return tag[0] === 'r' && typeof tag[1] === 'string' && relayUrl(tag[1]) === url;
}

function addRelayItem(tags: string[][], expected: string[]): { tags: string[][]; changed: boolean } {
  const url = expected[1];
  const matching = tags.filter((tag) => sameRelay(tag, url));
  const coverage = new Set<'read' | 'write'>();
  for (const tag of matching) for (const direction of relayCoverage(tag)) coverage.add(direction);
  const requested = relayCoverage(expected);
  const before = coverage.size;
  for (const direction of requested) coverage.add(direction);
  if (coverage.size === before) return { tags, changed: false };
  const retained = tags.filter((tag) => !sameRelay(tag, url));
  retained.push(relayTag(url, coverage)!);
  return { tags: retained, changed: true };
}

function removeRelayItem(tags: string[][], expected: string[]): { tags: string[][]; changed: boolean } {
  const url = expected[1];
  const matching = tags.filter((tag) => sameRelay(tag, url));
  if (matching.length === 0) return { tags, changed: false };
  const retained = tags.filter((tag) => !sameRelay(tag, url));
  if (expected.length === 2) return { tags: retained, changed: true };
  const coverage = new Set<'read' | 'write'>();
  for (const tag of matching) for (const direction of relayCoverage(tag)) coverage.add(direction);
  coverage.delete(expected[2] as 'read' | 'write');
  const rewritten = relayTag(url, coverage);
  if (rewritten) retained.push(rewritten);
  return { tags: retained, changed: true };
}

function metadataTags(resolved: ResolvedList, options?: ListOptions): string[][] {
  const tags: string[][] = [];
  if (resolved.identifier) tags.push(['d', resolved.identifier]);
  if (options?.title) tags.push(['title', options.title]);
  if (options?.description) tags.push(['description', options.description]);
  if (options?.image) tags.push(['image', options.image]);
  return tags;
}

function listFilter(resolved: ResolvedList, author: string): NostrFilter {
  return {
    kinds: [resolved.support.kind],
    authors: [author],
    limit: 16,
    ...(resolved.identifier ? { ['#d']: [resolved.identifier] } : {}),
  };
}

function newestList(events: NostrEvent[], resolved: ResolvedList, author: string): NostrEvent | null {
  return events
    .filter((event) => event.kind === resolved.support.kind
      && event.pubkey.toLowerCase() === author
      && (!resolved.identifier || event.tags.some((tag) => tag[0] === 'd' && tag[1] === resolved.identifier))
      && verifyEvent(event as Parameters<typeof verifyEvent>[0]))
    .sort((left, right) => right.created_at - left.created_at || left.id.localeCompare(right.id))[0]
    ?? null;
}

/**
 * Create Paja's public-item implementation of NAP-LISTS.
 *
 * @param options - Relay policy and current signer dependencies.
 * @returns Host hooks consumed by `createListsService`.
 */
export function createPajaListsBackend(options: PajaListsBackendOptions): PajaListsBackend {
  const activeSigner = async (): Promise<{ signer: Signer; pubkey: string }> => {
    const signer = options.getSigner();
    if (!signer?.getPublicKey || !signer.signEvent) throw new Error('not-signed-in');
    const pubkey = (await signer.getPublicKey()).toLowerCase();
    if (!HEX_64.test(pubkey)) throw new Error('not-signed-in');
    return { signer, pubkey };
  };

  const mutation = async (
    operation: 'add' | 'remove',
    ref: ListRef,
    items: readonly ListItem[],
    mutationOptions?: ListOptions,
  ): Promise<ListMutationResult> => {
    const resolved = resolveList(ref);
    if ('ok' in resolved) return resolved;
    if (items.length === 0) return { ok: true, [operation === 'add' ? 'added' : 'removed']: 0, skipped: 0 };
    const itemTags: string[][] = [];
    for (const item of items as readonly PajaListItem[]) {
      const tag = itemTag(resolved.support, item);
      if (isFailure(tag)) return tag;
      itemTags.push(tag);
    }
    let active: { signer: Signer; pubkey: string };
    try {
      active = await activeSigner();
    } catch {
      return failure('not-signed-in', 'list mutations require an active signer');
    }
    let current: NostrEvent | null;
    try {
      const events = await options.relay.query(
        options.getRelays(),
        [listFilter(resolved, active.pubkey)],
        PAJA_LIVE_QUERY_WAIT_MS,
      );
      current = newestList(events, resolved, active.pubkey);
    } catch {
      return failure('list-unavailable', 'current list could not be loaded');
    }
    if (!current && !(operation === 'add' && mutationOptions?.create)) {
      return failure('list-not-found', 'list does not exist and creation was not requested');
    }
    if (operation === 'remove'
      && current?.content
      && (items as readonly PajaListItem[]).some((item) => item.visibility !== 'public')) {
      return failure('private-items-unsupported', 'cannot safely remove private items without NIP-44 support');
    }

    let tags = current ? current.tags.map((tag) => [...tag]) : metadataTags(resolved, mutationOptions);
    let changed = 0;
    for (const expected of itemTags) {
      if (resolved.support.kind === 10_002) {
        const result = operation === 'add' ? addRelayItem(tags, expected) : removeRelayItem(tags, expected);
        tags = result.tags;
        if (result.changed) changed += 1;
        continue;
      }
      if (operation === 'add') {
        if (!tags.some((tag) => sameItem(tag, expected))) {
          tags.push(expected);
          changed += 1;
        }
      } else {
        const before = tags.length;
        tags = tags.filter((tag) => !sameItem(tag, expected));
        if (tags.length < before) changed += 1;
      }
    }
    const skipped = items.length - changed;
    if (changed === 0) {
      return {
        ok: true,
        ...(current ? { eventId: current.id, event: { ...current } as Record<string, unknown> } : {}),
        [operation === 'add' ? 'added' : 'removed']: 0,
        skipped,
      };
    }

    try {
      const template: EventTemplate = {
        kind: resolved.support.kind,
        created_at: Math.floor(Date.now() / 1_000),
        tags,
        content: current?.content ?? '',
      };
      const event = await active.signer.signEvent!(template);
      if (event.pubkey.toLowerCase() !== active.pubkey
        || !verifyEvent(event as Parameters<typeof verifyEvent>[0])) {
        return failure('publish-failed', 'signer returned an invalid list event');
      }
      await options.relay.publish(options.getRelays(), event);
      return {
        ok: true,
        eventId: event.id,
        event: { ...event } as Record<string, unknown>,
        [operation === 'add' ? 'added' : 'removed']: changed,
        skipped,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return failure(message.includes('denied') ? 'user-denied' : 'publish-failed', message);
    }
  };

  return {
    supported: publicSupport,
    add: (list, items, mutationOptions) => mutation('add', list, items, mutationOptions),
    remove: (list, items, mutationOptions) => mutation('remove', list, items, mutationOptions),
  };
}
