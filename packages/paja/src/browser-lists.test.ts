import type { EventTemplate, ListItem, NostrEvent, NostrFilter } from '@napplet/core';
import type { Signer } from '@kehto/runtime';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { describe, expect, it } from 'vitest';
import { createPajaListsBackend } from './browser-lists.js';
import type { PajaRelayBackend } from './browser-relay-runtime.js';

const RELAYS = ['wss://relay.example/'];

function matches(event: NostrEvent, filter: NostrFilter): boolean {
  return (!filter.kinds || filter.kinds.includes(event.kind))
    && (!filter.authors || filter.authors.includes(event.pubkey))
    && (!filter['#d'] || filter['#d'].some((identifier) =>
      event.tags.some((tag) => tag[0] === 'd' && tag[1] === identifier)));
}

function relayBackend(initialEvents: NostrEvent[] = []) {
  const events = [...initialEvents];
  const published: NostrEvent[] = [];
  const backend = {
    async query(_relays: string[], filters: NostrFilter[]) {
      return events.filter((event) => filters.some((filter) => matches(event, filter)));
    },
    async publish(_relays: string[], event: NostrEvent) {
      published.push(event);
      events.push(event);
    },
  } as unknown as PajaRelayBackend;
  return { backend, published };
}

function signer(secretKey = generateSecretKey()): Signer {
  return {
    getPublicKey: () => getPublicKey(secretKey),
    signEvent: async (template) => finalizeEvent(template as EventTemplate, secretKey) as NostrEvent,
  };
}

function signedEvent(secretKey: Uint8Array, template: EventTemplate): NostrEvent {
  return finalizeEvent(template, secretKey) as NostrEvent;
}

describe('createPajaListsBackend', () => {
  it('advertises only the public list kinds it fully implements', () => {
    const { backend } = relayBackend();
    const lists = createPajaListsBackend({ relay: backend, getRelays: () => RELAYS, getSigner: () => null });

    expect(lists.supported()).toEqual([
      expect.objectContaining({ kind: 10_000, type: 'mute-list', privateItems: false }),
      expect.objectContaining({ kind: 10_002, type: 'relay-list-metadata', privateItems: false }),
      expect.objectContaining({ kind: 10_003, type: 'bookmarks', privateItems: false }),
      expect.objectContaining({ kind: 30_000, type: 'follow-sets', privateItems: false }),
    ]);
  });

  it('preserves unrelated tags and content while adding and removing bookmarks', async () => {
    const ownerKey = generateSecretKey();
    const active = signer(ownerKey);
    const firstId = '1'.repeat(64);
    const secondId = '2'.repeat(64);
    const current = signedEvent(ownerKey, {
      kind: 10_003,
      created_at: 10,
      tags: [['e', firstId, 'wss://hint.example'], ['alt', 'bookmarks']],
      content: 'preserved private payload',
    });
    const { backend, published } = relayBackend([current]);
    const lists = createPajaListsBackend({ relay: backend, getRelays: () => RELAYS, getSigner: () => active });

    const added = await lists.add({ type: 'bookmarks' }, [{ itemType: 'event', value: secondId }]);
    expect(added).toEqual(expect.objectContaining({ ok: true, added: 1, skipped: 0 }));
    expect(published[0].content).toBe('preserved private payload');
    expect(published[0].tags).toEqual([
      ['e', firstId, 'wss://hint.example'],
      ['alt', 'bookmarks'],
      ['e', secondId],
    ]);

    const removed = await lists.remove(
      { kind: 10_003 },
      [{ itemType: 'event', value: firstId, visibility: 'public' }],
    );
    expect(removed).toEqual(expect.objectContaining({ ok: true, removed: 1, skipped: 0 }));
    expect(published[1].content).toBe('preserved private payload');
    expect(published[1].tags).toContainEqual(['alt', 'bookmarks']);
    expect(published[1].tags.some((tag) => tag[0] === 'e' && tag[1] === firstId)).toBe(false);
  });

  it('creates an addressable follow set with its metadata and d tag', async () => {
    const { backend, published } = relayBackend();
    const lists = createPajaListsBackend({ relay: backend, getRelays: () => RELAYS, getSigner: () => signer() });
    const followed = getPublicKey(generateSecretKey());

    const result = await lists.add(
      { type: 'follow-sets', identifier: 'work' },
      [{ itemType: 'pubkey', value: followed }],
      { create: true, title: 'Work' },
    );

    expect(result).toEqual(expect.objectContaining({ ok: true, added: 1 }));
    expect(published[0]).toEqual(expect.objectContaining({ kind: 30_000 }));
    expect(published[0].tags).toEqual([
      ['d', 'work'],
      ['title', 'Work'],
      ['p', followed],
    ]);
  });

  it('applies NIP-65 relay marker coverage rules', async () => {
    const ownerKey = generateSecretKey();
    const url = 'wss://shared.example/';
    const current = signedEvent(ownerKey, {
      kind: 10_002,
      created_at: 10,
      tags: [['r', url]],
      content: '',
    });
    const { backend, published } = relayBackend([current]);
    const lists = createPajaListsBackend({ relay: backend, getRelays: () => RELAYS, getSigner: () => signer(ownerKey) });
    const readItem = { itemType: 'relay', value: url, marker: 'read' } as ListItem;

    const removedRead = await lists.remove({ type: 'relay-list-metadata' }, [readItem]);
    expect(removedRead).toEqual(expect.objectContaining({ ok: true, removed: 1 }));
    expect(published[0].tags).toEqual([['r', url, 'write']]);

    const restoredRead = await lists.add({ kind: 10_002 }, [readItem]);
    expect(restoredRead).toEqual(expect.objectContaining({ ok: true, added: 1 }));
    expect(published[1].tags).toEqual([['r', url]]);
  });

  it('rejects private items and unsafe private-content removal', async () => {
    const ownerKey = generateSecretKey();
    const eventId = '3'.repeat(64);
    const current = signedEvent(ownerKey, {
      kind: 10_003,
      created_at: 10,
      tags: [['e', eventId]],
      content: 'encrypted-private-items',
    });
    const { backend, published } = relayBackend([current]);
    const lists = createPajaListsBackend({ relay: backend, getRelays: () => RELAYS, getSigner: () => signer(ownerKey) });

    await expect(lists.add(
      { type: 'bookmarks' },
      [{ itemType: 'event', value: eventId, visibility: 'private' }],
    )).resolves.toEqual(expect.objectContaining({ ok: false, error: 'private-items-unsupported' }));
    await expect(lists.remove(
      { type: 'bookmarks' },
      [{ itemType: 'event', value: eventId }],
    )).resolves.toEqual(expect.objectContaining({ ok: false, error: 'private-items-unsupported' }));
    expect(published).toHaveLength(0);
  });
});
