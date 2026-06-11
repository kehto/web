import {
  getInboxes,
  getOutboxes,
  selectOptimalRelays,
  type ProfilePointer,
} from 'applesauce-core/helpers';
import type { NostrEvent, NostrFilter } from '@kehto/shell';
import type { Nip66Aggregator, RelayAttributeGroups } from '@kehto/nip66';

export interface PlaygroundRelaySelectionConfig {
  defaultRelays: readonly string[];
  indexerRelays: readonly string[];
  relayIndexerRelays: readonly string[];
  maxConnections: number;
  maxRelaysPerAuthor: number;
  relayAttributeGroups?: RelayAttributeGroups;
}

export interface RelayDirectory {
  getMailboxes(pubkey: string): NostrEvent | undefined;
  getNip66Group(groupName: string): readonly string[];
}

type RelayHintFilter = NostrFilter & {
  relays?: unknown;
  relayHints?: unknown;
};

export const DEFAULT_PLAYGROUND_RELAY_SELECTION: PlaygroundRelaySelectionConfig = {
  defaultRelays: [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.primal.net',
  ],
  indexerRelays: [
    'wss://purplepag.es',
    'wss://relay.nostr.band',
  ],
  relayIndexerRelays: [
    'wss://relay.nostr.watch',
    'wss://relay.nostr.band',
  ],
  maxConnections: 6,
  maxRelaysPerAuthor: 2,
};

export function selectRelaysForFilters(
  filters: readonly NostrFilter[],
  directory: RelayDirectory,
  config: PlaygroundRelaySelectionConfig = DEFAULT_PLAYGROUND_RELAY_SELECTION,
): string[] {
  const hints = extractFilterRelayHints(filters);
  if (hasAnyKind(filters, [10002])) {
    return uniqueRelays([
      ...hints,
      ...directory.getNip66Group('Indexer'),
      ...config.indexerRelays,
    ]);
  }

  if (hasAnyKind(filters, [30166, 10166])) {
    return uniqueRelays([
      ...hints,
      ...directory.getNip66Group('RelayIndexer'),
      ...config.relayIndexerRelays,
    ]);
  }

  const authorRelays = selectAuthorRelays(collectAuthors(filters), directory, config);
  const inboxRelays = collectPTagPubkeys(filters).flatMap((pubkey) => {
    const mailbox = directory.getMailboxes(pubkey);
    return mailbox ? getInboxes(mailbox) : [];
  });

  return uniqueRelays([
    ...hints,
    ...authorRelays,
    ...inboxRelays,
    ...config.defaultRelays,
  ]);
}

export function selectRelaysForPublish(
  event: NostrEvent,
  directory: RelayDirectory,
  config: PlaygroundRelaySelectionConfig = DEFAULT_PLAYGROUND_RELAY_SELECTION,
): string[] {
  const hints = extractEventRelayHints(event);
  if (event.kind === 10002) {
    return uniqueRelays([
      ...hints,
      ...getOutboxes(event),
      ...directory.getNip66Group('Indexer'),
      ...config.indexerRelays,
    ]);
  }

  if (event.kind === 30166 || event.kind === 10166) {
    return uniqueRelays([
      ...hints,
      ...directory.getNip66Group('RelayIndexer'),
      ...config.relayIndexerRelays,
    ]);
  }

  const authorRelays = selectAuthorRelays([event.pubkey], directory, config);
  const inboxRelays = collectEventPubkeys(event).flatMap((pubkey) => {
    const mailbox = directory.getMailboxes(pubkey);
    return mailbox ? getInboxes(mailbox) : [];
  });

  return uniqueRelays([
    ...hints,
    ...authorRelays,
    ...inboxRelays,
    ...config.defaultRelays,
  ]);
}

export function createNip66RelayDirectory(
  aggregator: Nip66Aggregator | null | undefined,
  mailboxes: ReadonlyMap<string, NostrEvent>,
  relayAttributeGroups?: RelayAttributeGroups,
): RelayDirectory {
  return {
    getMailboxes(pubkey: string): NostrEvent | undefined {
      return mailboxes.get(pubkey);
    },
    getNip66Group(groupName: string): readonly string[] {
      return aggregator?.getRelaysForAttributeGroup(groupName, relayAttributeGroups) ?? [];
    },
  };
}

export function collectMailboxPubkeys(filters: readonly NostrFilter[], publishEvent?: NostrEvent): string[] {
  const pubkeys = new Set<string>();
  for (const pubkey of collectAuthors(filters)) pubkeys.add(pubkey);
  for (const pubkey of collectPTagPubkeys(filters)) pubkeys.add(pubkey);
  if (publishEvent) {
    if (publishEvent.pubkey) pubkeys.add(publishEvent.pubkey);
    for (const pubkey of collectEventPubkeys(publishEvent)) pubkeys.add(pubkey);
  }
  return [...pubkeys];
}

export function filterEvents(events: readonly NostrEvent[], filters: readonly NostrFilter[]): NostrEvent[] {
  const result: NostrEvent[] = [];
  const seen = new Set<string>();
  for (const filter of filters) {
    let count = 0;
    const limit = filter.limit ?? Number.POSITIVE_INFINITY;
    for (const event of events) {
      if (count >= limit) break;
      if (!matchesFilter(event, filter)) continue;
      count++;
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      result.push(event);
    }
  }
  return result;
}

export function matchesFilter(event: NostrEvent, filter: NostrFilter): boolean {
  if (filter.ids && !filter.ids.some((id) => event.id.startsWith(id))) return false;
  if (filter.authors && !filter.authors.some((author) => event.pubkey.startsWith(author))) return false;
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
  if (filter.since !== undefined && event.created_at < filter.since) return false;
  if (filter.until !== undefined && event.created_at > filter.until) return false;

  for (const [key, values] of Object.entries(filter)) {
    if (!key.startsWith('#') || !Array.isArray(values) || values.length === 0) continue;
    const tagName = key.slice(1);
    const eventTagValues = event.tags.filter((tag) => tag[0] === tagName).map((tag) => tag[1]);
    if (!values.some((value) => eventTagValues.includes(value))) return false;
  }
  return true;
}

export function uniqueRelays(relays: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const relay of relays) {
    const normalized = normalizeRelayUrl(relay);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function selectAuthorRelays(
  authors: readonly string[],
  directory: RelayDirectory,
  config: PlaygroundRelaySelectionConfig,
): string[] {
  if (authors.length === 0) return [];
  const pointers: ProfilePointer[] = authors.map((pubkey) => {
    const mailbox = directory.getMailboxes(pubkey);
    return {
      pubkey,
      relays: mailbox ? getOutboxes(mailbox) : [...config.defaultRelays],
    };
  });
  return uniqueRelays(
    selectOptimalRelays(pointers, {
      maxConnections: config.maxConnections,
      maxRelaysPerUser: config.maxRelaysPerAuthor,
    }).flatMap((pointer) => pointer.relays ?? []),
  );
}

function collectAuthors(filters: readonly NostrFilter[]): string[] {
  const authors = new Set<string>();
  for (const filter of filters) {
    for (const pubkey of filter.authors ?? []) authors.add(pubkey);
  }
  return [...authors];
}

function collectPTagPubkeys(filters: readonly NostrFilter[]): string[] {
  const pubkeys = new Set<string>();
  for (const filter of filters) {
    for (const pubkey of filter['#p'] ?? []) pubkeys.add(pubkey);
  }
  return [...pubkeys];
}

function collectEventPubkeys(event: NostrEvent): string[] {
  const pubkeys = new Set<string>();
  for (const tag of event.tags) {
    if (tag[0] === 'p' && tag[1]) pubkeys.add(tag[1]);
  }
  return [...pubkeys];
}

function hasAnyKind(filters: readonly NostrFilter[], kinds: readonly number[]): boolean {
  return filters.some((filter) => filter.kinds?.some((kind) => kinds.includes(kind)));
}

function extractFilterRelayHints(filters: readonly NostrFilter[]): string[] {
  const relays: string[] = [];
  for (const filter of filters) {
    const hinted = filter as RelayHintFilter;
    relays.push(...stringArray(hinted.relays));
    relays.push(...stringArray(hinted.relayHints));
    relays.push(...(filter['#r'] ?? []));
  }
  return uniqueRelays(relays);
}

function extractEventRelayHints(event: NostrEvent): string[] {
  const relays: string[] = [];
  for (const tag of event.tags) {
    if (tag[0] === 'r' && tag[1]) relays.push(tag[1]);
    if ((tag[0] === 'e' || tag[0] === 'a' || tag[0] === 'p') && tag[2]) relays.push(tag[2]);
  }
  return uniqueRelays(relays);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeRelayUrl(value: string): string | null {
  const relay = value.trim();
  if (!/^wss?:\/\//i.test(relay)) return null;
  return relay.replace(/\/+$/, '');
}
