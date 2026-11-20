import { describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from 'nostr-tools';
import type { Filter } from 'nostr-tools/filter';
import { decode } from 'nostr-tools/nip19';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { getNappletCatalogId } from '@kehto/nip/5d';

import { findPajaIntentHandlers, PajaIntentDiscoveryError } from './intent-handler-discovery.js';
import type { PajaPointerRelayPool } from './runtime-resolver.js';

// NAP-INTENT napplet/naps master 377bf939 ("Recommended handler resolution") and
// NIP-5D nostr-protocol/nips#2303 f60550c3 (`z`/`i` manifest tags), kehto/web#523.
const NOTE_OPEN = { archetype: 'note', convention: 'napplet:note/open' };
const PUBLISHER = generateSecretKey();
const OTHER = generateSecretKey();
const HASH = 'a'.repeat(64);

function manifest(key: Uint8Array, dTag: string, tags: string[][], createdAt = 100, kind = 35129): NostrEvent {
  const base = kind === 35129 ? [['d', dTag]] : [];
  return finalizeEvent({ kind, created_at: createdAt, content: `${dTag} napplet`, tags: [...base, ['x', HASH], ['title', `Title ${dTag}`], ...tags] }, key) as NostrEvent;
}

const READER = manifest(PUBLISHER, 'note-viewer', [['z', 'note'], ['i', 'napplet:note/open']]);

function poolReturning(byFilter: (filter: Filter) => NostrEvent[], seen: Filter[] = []): PajaPointerRelayPool {
  return {
    async querySync(_relays, filter) { seen.push(filter); return byFilter(filter); },
  };
}

describe('findPajaIntentHandlers', () => {
  it('asks relays for the exact convention in every manifest kind and offers verified matches', async () => {
    const seen: Filter[] = [];
    const offers = await findPajaIntentHandlers(NOTE_OPEN, { relays: ['wss://relay.example'], pool: poolReturning(() => [READER], seen) });
    expect(seen).toEqual([{ kinds: [5129, 15129, 35129], '#i': ['napplet:note/open'], limit: 20 }]);
    expect(offers).toEqual([{
      catalogId: getNappletCatalogId(READER),
      pointer: expect.stringMatching(/^naddr1/u),
      title: 'Title note-viewer',
      publisher: expect.stringMatching(/^npub1/u),
      convention: 'napplet:note/open',
      createdAt: 100,
      recommended: false,
    }]);
    const pointer = decode(offers[0].pointer);
    expect(pointer).toMatchObject({ type: 'naddr', data: { kind: 35129, pubkey: getPublicKey(PUBLISHER), identifier: 'note-viewer' } });
  });

  it('drops forged, mismatched, and undeclared advertisements', async () => {
    // Relays deliver plain JSON, without nostr-tools' cached verification flag.
    const wire = (event: NostrEvent): NostrEvent => JSON.parse(JSON.stringify(event)) as NostrEvent;
    const unrelated = manifest(OTHER, 'unrelated', [['z', 'profile'], ['i', 'napplet:profile/open']]);
    const forged = wire({ ...unrelated, tags: [...unrelated.tags, ['z', 'note'], ['i', 'napplet:note/open']] });
    const tampered = wire({ ...manifest(OTHER, 'tampered', [['z', 'note'], ['i', 'napplet:note/open']]), content: 'changed after signing' });
    const roleMissing = manifest(OTHER, 'no-role', [['i', 'napplet:note/open']]);
    const editOnly = manifest(OTHER, 'editor', [['z', 'note'], ['i', 'napplet:note/edit']]);
    const otherRole = manifest(OTHER, 'profile', [['z', 'profile'], ['i', 'napplet:profile/open']]);
    const offers = await findPajaIntentHandlers(NOTE_OPEN, {
      relays: ['wss://relay.example'],
      pool: poolReturning(() => [forged, tampered, roleMissing, editOnly, otherRole]),
    });
    expect(offers).toEqual([]);
  });

  it('keeps the newest event per identity, skips installed ones, and sorts newest first', async () => {
    const older = manifest(PUBLISHER, 'note-viewer', [['z', 'note'], ['i', 'napplet:note/open']], 50);
    const longform = manifest(OTHER, 'longform', [['z', 'note'], ['i', 'napplet:note/open']], 300);
    const installedOne = manifest(OTHER, 'chronofeed', [['z', 'note'], ['i', 'napplet:note/open']], 400);
    const offers = await findPajaIntentHandlers(NOTE_OPEN, {
      relays: ['wss://relay.example'],
      pool: poolReturning(() => [older, READER, longform, installedOne]),
      installed: (id) => id === getNappletCatalogId(installedOne),
    });
    expect(offers.map((offer) => [offer.title, offer.createdAt])).toEqual([['Title longform', 300], ['Title note-viewer', 100]]);
  });

  it('looks up the handlerHint coordinate in the same search and lists it first', async () => {
    const newer = manifest(OTHER, 'longform', [['z', 'note'], ['i', 'napplet:note/open']], 900);
    const seen: Filter[] = [];
    const querySync = vi.fn(async (relays: string[], filter: Filter) => {
      seen.push(filter);
      return filter['#d'] ? (relays.includes('wss://hint.example') ? [READER] : []) : [newer];
    });
    const offers = await findPajaIntentHandlers(NOTE_OPEN, {
      relays: ['wss://relay.example'],
      pool: { querySync },
      hint: { address: `35129:${getPublicKey(PUBLISHER)}:note-viewer`, relays: ['wss://hint.example'] },
    });
    expect(seen).toContainEqual({ kinds: [35129], authors: [getPublicKey(PUBLISHER)], '#d': ['note-viewer'] });
    expect(offers.map((offer) => [offer.title, offer.recommended])).toEqual([['Title note-viewer', true], ['Title longform', false]]);
    expect(decode(offers[0].pointer)).toMatchObject({ data: { relays: ['wss://hint.example'] } });
  });

  it('drops a hint answer that is not the exact hinted coordinate', async () => {
    const impostor = manifest(OTHER, 'note-viewer', [['z', 'note'], ['i', 'napplet:note/open']], 900);
    const offers = await findPajaIntentHandlers(NOTE_OPEN, {
      relays: ['wss://relay.example'],
      pool: poolReturning((filter) => filter['#d'] ? [impostor, READER] : []),
      hint: { address: `35129:${getPublicKey(PUBLISHER)}:note-viewer`, relays: ['wss://hint.example'] },
    });
    expect(offers.map((offer) => [offer.catalogId, offer.recommended])).toEqual([[getNappletCatalogId(READER), true]]);
  });

  it('ignores a hint that does not support the requested convention', async () => {
    const editor = manifest(PUBLISHER, 'editor', [['z', 'note'], ['i', 'napplet:note/edit']]);
    const offers = await findPajaIntentHandlers(NOTE_OPEN, {
      relays: ['wss://relay.example'],
      pool: poolReturning((filter) => filter['#d'] ? [editor] : []),
      hint: { address: `35129:${getPublicKey(PUBLISHER)}:editor` },
    });
    expect(offers).toEqual([]);
  });

  it('offers a snapshot as a nevent', async () => {
    const snapshot = manifest(PUBLISHER, 'snap', [['z', 'note'], ['i', 'napplet:note/open']], 100, 5129);
    const [offer] = await findPajaIntentHandlers(NOTE_OPEN, { relays: ['wss://relay.example'], pool: poolReturning(() => [snapshot]) });
    expect(decode(offer.pointer)).toMatchObject({ type: 'nevent', data: { id: snapshot.id } });
  });

  it('reports unreachable relays as a discovery failure, not as no handler', async () => {
    await expect(findPajaIntentHandlers(NOTE_OPEN, { relays: [] })).rejects.toBeInstanceOf(PajaIntentDiscoveryError);
    const down: PajaPointerRelayPool = { async querySync() { throw new Error('socket closed'); } };
    await expect(findPajaIntentHandlers(NOTE_OPEN, { relays: ['wss://relay.example'], pool: down })).rejects.toThrow('No relay could be reached');
    const quiet = await findPajaIntentHandlers(NOTE_OPEN, { relays: ['wss://relay.example'], pool: poolReturning(() => []) });
    expect(quiet).toEqual([]);
  });
});
