import { describe, expect, it } from 'vitest';
import type { NostrEvent } from 'nostr-tools';
import { decode, naddrEncode, neventEncode } from 'nostr-tools/nip19';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import type { Filter } from 'nostr-tools/filter';

import type { PajaPointerRelayPool } from './runtime-resolver.js';
import { findPajaPointerReplacements } from './runtime-pointer-replacements.js';

const SK = new Uint8Array(32).fill(21);
const OTHER = new Uint8Array(32).fill(22);
const RELAY = 'wss://relay.example';

function manifest(dTag: string, createdAt: number, key = SK, kind = 35129): NostrEvent {
  return finalizeEvent({ kind, created_at: createdAt, content: '', tags: [['d', dTag], ['x', 'a'.repeat(64)], ['title', `Title ${dTag}`]] }, key) as NostrEvent;
}

function pool(events: readonly NostrEvent[]): PajaPointerRelayPool & { filters: Filter[] } {
  const filters: Filter[] = [];
  return {
    filters,
    async querySync() { throw new Error('querySync fallback should not run'); },
    subscribeManyEose(_relays, filter, params) {
      filters.push(filter);
      const timer = setTimeout(() => {
        for (const event of events) params.onevent(event);
        params.onclose(['closed automatically on eose']);
      }, 0);
      return { close: () => clearTimeout(timer) };
    },
  };
}

function goneNevent(old: NostrEvent, options: { author?: boolean; kind?: boolean } = {}): string {
  return neventEncode({
    id: old.id,
    ...(options.author === false ? {} : { author: old.pubkey }),
    ...(options.kind === false ? {} : { kind: old.kind }),
    relays: [RELAY],
  });
}

describe('findPajaPointerReplacements (#471)', () => {
  it('offers the current coordinate when the author has one napplet of the kind, without picking for them', async () => {
    const old = manifest('feed', 1_700_000_000);
    const current = manifest('feed', 1_700_000_500);
    const relays = pool([old, current]);

    const offers = await findPajaPointerReplacements(goneNevent(old), { relays: [RELAY], pool: relays });

    expect(relays.filters).toEqual([{ kinds: [35129], authors: [getPublicKey(SK)], limit: 50 }]);
    expect(offers).toEqual([{
      naddr: naddrEncode({ kind: 35129, pubkey: getPublicKey(SK), identifier: 'feed', relays: [RELAY] }),
      dTag: 'feed',
      createdAt: 1_700_000_500,
      title: 'Title feed',
    }]);
    expect(decode(offers[0]!.naddr)).toMatchObject({ type: 'naddr', data: { identifier: 'feed', kind: 35129 } });
  });

  it('lists every current d-tag newest first when the nevent cannot say which one it was', async () => {
    const old = manifest('feed', 1_700_000_000);
    const offers = await findPajaPointerReplacements(goneNevent(old), {
      relays: [RELAY],
      pool: pool([manifest('profile', 1_700_000_100), manifest('feed', 1_700_000_300), manifest('feed', 1_700_000_200)]),
    });
    expect(offers.map((entry) => [entry.dTag, entry.createdAt])).toEqual([['feed', 1_700_000_300], ['profile', 1_700_000_100]]);
  });

  it('ignores other authors, other kinds, forged signatures, and the gone id itself', async () => {
    const old = manifest('feed', 1_700_000_000);
    const forged = { ...JSON.parse(JSON.stringify(manifest('forged', 1_700_000_900))) as NostrEvent, content: 'tampered' };
    const offers = await findPajaPointerReplacements(goneNevent(old), {
      relays: [RELAY],
      pool: pool([old, forged, manifest('other', 1_700_000_800, OTHER), manifest('kind', 1_700_000_700, SK, 30023)]),
    });
    expect(offers).toEqual([]);
  });

  it('offers nothing for snapshots, non-napplet kinds, or a nevent without author or kind', async () => {
    const old = manifest('feed', 1_700_000_000);
    const relays = pool([manifest('feed', 1_700_000_500)]);
    const snapshot = finalizeEvent({ kind: 5129, created_at: 1, content: '', tags: [] }, SK) as NostrEvent;
    const article = manifest('post', 1, SK, 30023);
    for (const value of [goneNevent(old, { author: false }), goneNevent(old, { kind: false }), goneNevent(snapshot), goneNevent(article)]) {
      expect(await findPajaPointerReplacements(value, { relays: [RELAY], pool: relays })).toEqual([]);
    }
    expect(relays.filters).toEqual([]);
    expect(await findPajaPointerReplacements(naddrEncode({ kind: 35129, pubkey: old.pubkey, identifier: 'feed' }), { relays: [RELAY], pool: relays })).toEqual([]);
  });
});
