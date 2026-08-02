import type { EventTemplate, NostrEvent, NostrFilter } from '@napplet/core';
import type { Signer } from '@kehto/runtime';
import { nprofileEncode, npubEncode } from 'nostr-tools/nip19';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { describe, expect, it } from 'vitest';
import { createPajaCommonBackend } from './browser-common.js';
import type { PajaRelayBackend } from './browser-relay-runtime.js';

const RELAYS = ['wss://relay.example/'];

function matches(event: NostrEvent, filter: NostrFilter): boolean {
  return (!filter.kinds || filter.kinds.includes(event.kind))
    && (!filter.authors || filter.authors.includes(event.pubkey))
    && (!filter.ids || filter.ids.includes(event.id));
}

function relayBackend(initialEvents: NostrEvent[] = []) {
  const events = [...initialEvents];
  const queries: Array<{ relays: string[]; filters: NostrFilter[] }> = [];
  const published: NostrEvent[] = [];
  const backend = {
    async query(relays: string[], filters: NostrFilter[]) {
      queries.push({ relays, filters });
      return events.filter((event) => filters.some((filter) => matches(event, filter)));
    },
    async publish(_relays: string[], event: NostrEvent) {
      published.push(event);
      events.push(event);
    },
  } as unknown as PajaRelayBackend;
  return { backend, queries, published };
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

describe('createPajaCommonBackend', () => {
  it('normalizes nprofile targets and returns the latest verified kind-0 event', async () => {
    const profileKey = generateSecretKey();
    const profilePubkey = getPublicKey(profileKey);
    const profile = signedEvent(profileKey, {
      kind: 0,
      created_at: 10,
      tags: [],
      content: JSON.stringify({ name: 'alice', display_name: 'Alice' }),
    });
    const { backend, queries } = relayBackend([profile]);
    const common = createPajaCommonBackend({ relay: backend, getRelays: () => RELAYS, getSigner: () => null });
    const target = nprofileEncode({ pubkey: profilePubkey, relays: ['wss://profile.example'] });

    const result = await common.getProfile(target);

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      pubkey: profilePubkey,
      profile: expect.objectContaining({ name: 'alice', displayName: 'Alice' }),
      result: expect.objectContaining({ event: profile }),
    }));
    expect(queries[0].relays).toEqual(['wss://profile.example/', 'wss://relay.example/']);
  });

  it('reads, merges, signs, and publishes idempotent NIP-02 follow lists', async () => {
    const ownerKey = generateSecretKey();
    const owner = signer(ownerKey);
    const existingKey = getPublicKey(generateSecretKey());
    const addedKey = getPublicKey(generateSecretKey());
    const contactList = signedEvent(ownerKey, {
      kind: 3,
      created_at: 10,
      tags: [['p', existingKey, 'wss://hint.example'], ['alt', 'contacts']],
      content: 'preserved relay map',
    });
    const { backend, published } = relayBackend([contactList]);
    const common = createPajaCommonBackend({ relay: backend, getRelays: () => RELAYS, getSigner: () => owner });

    await expect(common.follows()).resolves.toEqual({ ok: true, pubkeys: [existingKey] });
    const added = await common.follow([npubEncode(addedKey)]);
    expect(added.ok).toBe(true);
    expect(published[0]).toEqual(expect.objectContaining({ kind: 3, content: 'preserved relay map' }));
    expect(published[0].tags).toEqual(expect.arrayContaining([
      ['p', existingKey, 'wss://hint.example'],
      ['p', addedKey],
      ['alt', 'contacts'],
    ]));

    const duplicate = await common.follow([npubEncode(addedKey)]);
    expect(duplicate.ok).toBe(true);
    expect(published).toHaveLength(1);

    const removed = await common.unfollow([npubEncode(existingKey)]);
    expect(removed.ok).toBe(true);
    expect(published[1].tags.some((tag) => tag[0] === 'p' && tag[1] === existingKey)).toBe(false);
    expect(published[1].tags).toContainEqual(['alt', 'contacts']);
  });

  it('resolves a native event and publishes a NIP-25 custom emoji reaction', async () => {
    const targetKey = generateSecretKey();
    const target = signedEvent(targetKey, { kind: 1, created_at: 10, tags: [], content: 'hello' });
    const { backend, published } = relayBackend([target]);
    const common = createPajaCommonBackend({ relay: backend, getRelays: () => RELAYS, getSigner: () => signer() });

    const result = await common.react(target.id, ':wave:', 'https://emoji.example/wave.png');

    expect(result.ok).toBe(true);
    expect(published[0]).toEqual(expect.objectContaining({ kind: 7, content: ':wave:' }));
    expect(published[0].tags).toEqual(expect.arrayContaining([
      ['e', target.id],
      ['p', target.pubkey],
      ['emoji', 'wave', 'https://emoji.example/wave.png'],
    ]));
  });

  it('resolves a missing report author and publishes a NIP-56 report', async () => {
    const target = signedEvent(generateSecretKey(), { kind: 1, created_at: 10, tags: [], content: 'spam' });
    const { backend, published } = relayBackend([target]);
    const common = createPajaCommonBackend({ relay: backend, getRelays: () => RELAYS, getSigner: () => signer() });

    const result = await common.report({ type: 'event', id: target.id }, 'spam', 'Repeated unsolicited posts');

    expect(result.ok).toBe(true);
    expect(published[0]).toEqual(expect.objectContaining({ kind: 1_984, content: 'Repeated unsolicited posts' }));
    expect(published[0].tags).toEqual([
      ['e', target.id, '', 'spam'],
      ['p', target.pubkey, '', 'spam'],
    ]);
  });

  it('rejects mutations without an active signing boundary', async () => {
    const { backend } = relayBackend();
    const common = createPajaCommonBackend({ relay: backend, getRelays: () => RELAYS, getSigner: () => null });

    await expect(common.follow([npubEncode(getPublicKey(generateSecretKey()))])).resolves.toEqual({
      ok: false,
      error: 'not-signed-in',
    });
  });
});
