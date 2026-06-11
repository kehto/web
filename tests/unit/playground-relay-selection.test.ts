import { describe, expect, it } from 'vitest';
import type { NostrEvent, NostrFilter } from '@kehto/shell';
import {
  collectMailboxPubkeys,
  createNip66RelayDirectory,
  filterEvents,
  selectRelaysForFilters,
  selectRelaysForPublish,
  type PlaygroundRelaySelectionConfig,
} from '../../apps/playground/src/playground-relay-selection.js';

const CONFIG: PlaygroundRelaySelectionConfig = {
  defaultRelays: ['wss://fallback.one', 'wss://fallback.two'],
  indexerRelays: ['wss://fallback.indexer'],
  relayIndexerRelays: ['wss://fallback.relay-indexer'],
  maxConnections: 4,
  maxRelaysPerAuthor: 2,
};

function event(partial: Partial<NostrEvent>): NostrEvent {
  return {
    id: '0'.repeat(64),
    pubkey: 'author',
    created_at: 1_700_000_000,
    kind: 1,
    tags: [],
    content: '',
    sig: '0'.repeat(128),
    ...partial,
  };
}

function mailbox(pubkey: string, relays: Array<[string, 'read' | 'write' | undefined]>): NostrEvent {
  return event({
    id: pubkey.slice(0, 1).repeat(64),
    pubkey,
    kind: 10002,
    tags: relays.map(([relay, mode]) => mode ? ['r', relay, mode] : ['r', relay]),
  });
}

function directory(mailboxes: NostrEvent[] = []) {
  return createNip66RelayDirectory(
    {
      getRelaysForAttributeGroup(groupName: string) {
        if (groupName === 'Indexer') return ['wss://nip66.indexer'];
        if (groupName === 'RelayIndexer') return ['wss://nip66.relay-indexer'];
        return [];
      },
    } as never,
    new Map(mailboxes.map((item) => [item.pubkey, item])),
  );
}

describe('playground relay selection', () => {
  it('routes NIP-65 bootstrap filters to Indexer relays', () => {
    const relays = selectRelaysForFilters(
      [{ kinds: [10002], relays: ['wss://hint.indexer'] } as NostrFilter],
      directory(),
      CONFIG,
    );

    expect(relays).toEqual(['wss://hint.indexer', 'wss://nip66.indexer', 'wss://fallback.indexer']);
  });

  it('routes NIP-66 filters to RelayIndexer relays', () => {
    const relays = selectRelaysForFilters([{ kinds: [30166] }], directory(), CONFIG);

    expect(relays).toEqual(['wss://nip66.relay-indexer', 'wss://fallback.relay-indexer']);
  });

  it('uses cached NIP-65 author outboxes for author filters', () => {
    const authorMailbox = mailbox('alice', [
      ['wss://alice.write', 'write'],
      ['wss://alice.read', 'read'],
    ]);

    const relays = selectRelaysForFilters([{ kinds: [1], authors: ['alice'] }], directory([authorMailbox]), CONFIG);

    expect(relays).toContain('wss://alice.write');
    expect(relays).not.toContain('wss://alice.read');
  });

  it('publishes to author outboxes, recipient inboxes, and relay hints', () => {
    const authorMailbox = mailbox('alice', [['wss://alice.write', 'write']]);
    const recipientMailbox = mailbox('bob', [['wss://bob.inbox', 'read']]);

    const relays = selectRelaysForPublish(
      event({
        id: '1'.repeat(64),
        pubkey: 'alice',
        tags: [['p', 'bob', 'wss://hint.from-p-tag']],
      }),
      directory([authorMailbox, recipientMailbox]),
      CONFIG,
    );

    expect(relays).toEqual([
      'wss://hint.from-p-tag',
      'wss://alice.write',
      'wss://bob.inbox',
      'wss://fallback.one',
      'wss://fallback.two',
    ]);
  });

  it('collects mailbox pubkeys needed for outbox/inbox resolution', () => {
    expect(collectMailboxPubkeys([{ authors: ['alice'], '#p': ['bob'] }], event({ pubkey: 'carol' }))).toEqual([
      'alice',
      'bob',
      'carol',
    ]);
  });

  it('filters local cache events with NIP-01 fields and tag filters', () => {
    const matching = event({ id: 'a'.repeat(64), pubkey: 'alice', kind: 1, tags: [['t', 'kehto']] });
    const wrongTag = event({ id: 'b'.repeat(64), pubkey: 'alice', kind: 1, tags: [['t', 'other']] });
    const wrongAuthor = event({ id: 'c'.repeat(64), pubkey: 'mallory', kind: 1, tags: [['t', 'kehto']] });

    expect(filterEvents([matching, wrongTag, wrongAuthor], [{ authors: ['alice'], kinds: [1], '#t': ['kehto'] }])).toEqual([
      matching,
    ]);
  });
});
