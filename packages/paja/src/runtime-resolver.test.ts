import { describe, expect, it } from 'vitest';
import { finalizeEvent } from 'nostr-tools/pure';
import { naddrEncode, neventEncode } from 'nostr-tools/nip19';
import type { NostrEvent } from 'nostr-tools';
import { computeAggregateHash } from '@kehto/nip/5a';
import {
  NAPPLET_KIND_NAMED,
  NAPPLET_KIND_ROOT,
  NAPPLET_KIND_SNAPSHOT,
} from '@kehto/nip/5d';

import {
  PAJA_NAPPLET_MANIFEST_KIND,
  PAJA_NAPPLET_MANIFEST_KINDS,
  decodePajaPointer,
  resolvePajaPointer,
  type PajaPointerRelayPool,
} from './runtime-resolver.js';

const SK = Uint8Array.from('11'.repeat(32).match(/.{2}/g)!.map((part) => parseInt(part, 16)));
const enc = new TextEncoder();
const RELAY = 'wss://relay.example';
const BLOSSOM = 'https://blossom.example';

async function sha256hex(bytes: Uint8Array): Promise<string> {
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', input);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

interface BuildManifestOptions {
  readonly dTag?: string;
  readonly kind?: number;
}

async function buildManifest(options: BuildManifestOptions = {}) {
  const dTag = options.dTag ?? 'runtime-target';
  const kind = options.kind ?? NAPPLET_KIND_NAMED;
  const bytes = enc.encode('<!doctype html><html><head><title>runtime</title></head><body>ok</body></html>');
  const hash = await sha256hex(bytes);
  const aggregateHash = computeAggregateHash([{ path: '/index.html', sha256: hash }]);
  const event = finalizeEvent({
    kind,
    created_at: 1_700_000_000,
    tags: [
      ...(kind === NAPPLET_KIND_NAMED ? [['d', dTag]] : []),
      ['path', '/index.html', hash],
      ['x', aggregateHash, 'aggregate'],
      ['server', BLOSSOM],
    ],
    content: '',
  }, SK);
  return { event: event as NostrEvent, bytes, hash, aggregateHash, dTag };
}

function fakePool(events: readonly NostrEvent[]): PajaPointerRelayPool & { filters: unknown[] } {
  const filters: unknown[] = [];
  return {
    filters,
    async querySync(_relays, filter) {
      filters.push(filter);
      return events.filter((event) => {
        const ids = filter.ids as string[] | undefined;
        const authors = filter.authors as string[] | undefined;
        const kinds = filter.kinds as number[] | undefined;
        const dTags = filter['#d'] as string[] | undefined;
        if (ids && !ids.includes(event.id)) return false;
        if (authors && !authors.includes(event.pubkey)) return false;
        if (kinds && !kinds.includes(event.kind)) return false;
        if (dTags && !event.tags.some((tag) => tag[0] === 'd' && dTags.includes(tag[1] ?? ''))) return false;
        return true;
      });
    },
  };
}

function fakeFetcher(hash: string, bytes: Uint8Array) {
  return async (url: string): Promise<Response> => {
    if (url === `${BLOSSOM}/${hash}`) {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => bytes.buffer,
      } as Response;
    }
    return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) } as Response;
  };
}

describe('Paja runtime pointer resolver', () => {
  it('exports the NIP-5D napplet manifest kinds', () => {
    expect(PAJA_NAPPLET_MANIFEST_KIND).toBe(NAPPLET_KIND_NAMED);
    expect([...PAJA_NAPPLET_MANIFEST_KINDS].sort((a, b) => a - b)).toEqual([
      NAPPLET_KIND_SNAPSHOT,
      NAPPLET_KIND_ROOT,
      NAPPLET_KIND_NAMED,
    ].sort((a, b) => a - b));
  });

  it('decodes and resolves an naddr napplet manifest pointer', async () => {
    const manifest = await buildManifest();
    const pointer = naddrEncode({
      identifier: manifest.dTag,
      pubkey: manifest.event.pubkey,
      kind: PAJA_NAPPLET_MANIFEST_KIND,
      relays: [RELAY],
    });
    const pool = fakePool([manifest.event]);

    expect(decodePajaPointer(pointer)).toMatchObject({
      type: 'naddr',
      identifier: manifest.dTag,
      pubkey: manifest.event.pubkey,
      kind: PAJA_NAPPLET_MANIFEST_KIND,
      relays: [RELAY],
    });

    const resolved = await resolvePajaPointer(pointer, {
      pool,
      fetcher: fakeFetcher(manifest.hash, manifest.bytes),
    });

    expect(resolved.dTag).toBe(manifest.dTag);
    expect(resolved.aggregateHash).toBe(manifest.aggregateHash);
    expect(resolved.indexHtml).toContain('<body>ok</body>');
    expect(pool.filters[0]).toMatchObject({
      kinds: [PAJA_NAPPLET_MANIFEST_KIND],
      authors: [manifest.event.pubkey],
      '#d': [manifest.dTag],
    });
  });

  it('decodes and resolves a nevent napplet snapshot pointer by event id', async () => {
    const manifest = await buildManifest({ dTag: 'snapshot-target' });
    const pointer = neventEncode({
      id: manifest.event.id,
      author: manifest.event.pubkey,
      kind: PAJA_NAPPLET_MANIFEST_KIND,
      relays: [RELAY],
    });
    const pool = fakePool([manifest.event]);

    expect(decodePajaPointer(pointer)).toMatchObject({
      type: 'nevent',
      id: manifest.event.id,
      author: manifest.event.pubkey,
      kind: PAJA_NAPPLET_MANIFEST_KIND,
      relays: [RELAY],
    });

    const resolved = await resolvePajaPointer(pointer, {
      pool,
      fetcher: fakeFetcher(manifest.hash, manifest.bytes),
    });

    expect(resolved.dTag).toBe('snapshot-target');
    expect(resolved.event.id).toBe(manifest.event.id);
    expect(pool.filters[0]).toMatchObject({ ids: [manifest.event.id] });
  });

  it('resolves NIP-5D snapshot manifest nevent pointers', async () => {
    const manifest = await buildManifest({ kind: NAPPLET_KIND_SNAPSHOT });
    const pointer = neventEncode({
      id: manifest.event.id,
      author: manifest.event.pubkey,
      kind: NAPPLET_KIND_SNAPSHOT,
      relays: [RELAY],
    });
    const pool = fakePool([manifest.event]);

    const resolved = await resolvePajaPointer(pointer, {
      pool,
      fetcher: fakeFetcher(manifest.hash, manifest.bytes),
    });

    expect(resolved.event.kind).toBe(NAPPLET_KIND_SNAPSHOT);
    expect(resolved.dTag).toBe('');
    expect(pool.filters[0]).toMatchObject({
      ids: [manifest.event.id],
      kinds: [NAPPLET_KIND_SNAPSHOT],
    });
  });

  it('resolves NIP-5D root manifest nevent pointers', async () => {
    const manifest = await buildManifest({ kind: NAPPLET_KIND_ROOT });
    const pointer = neventEncode({
      id: manifest.event.id,
      author: manifest.event.pubkey,
      kind: NAPPLET_KIND_ROOT,
      relays: [RELAY],
    });
    const pool = fakePool([manifest.event]);

    const resolved = await resolvePajaPointer(pointer, {
      pool,
      fetcher: fakeFetcher(manifest.hash, manifest.bytes),
    });

    expect(resolved.event.kind).toBe(NAPPLET_KIND_ROOT);
    expect(resolved.dTag).toBe('');
    expect(pool.filters[0]).toMatchObject({
      ids: [manifest.event.id],
      kinds: [NAPPLET_KIND_ROOT],
    });
  });

  it('rejects non-napplet naddr kinds before rendering', async () => {
    const manifest = await buildManifest();
    const pointer = naddrEncode({
      identifier: manifest.dTag,
      pubkey: manifest.event.pubkey,
      kind: 30023,
      relays: [RELAY],
    });

    await expect(resolvePajaPointer(pointer, { pool: fakePool([manifest.event]) }))
      .rejects.toThrow(/not a named NIP-5D napplet manifest kind/);
  });

  it('rejects NIP-5A nsite event kinds', async () => {
    const manifest = await buildManifest({ kind: 35128 });
    const pointer = neventEncode({
      id: manifest.event.id,
      author: manifest.event.pubkey,
      kind: 35128,
      relays: [RELAY],
    });

    await expect(resolvePajaPointer(pointer, { pool: fakePool([manifest.event]) }))
      .rejects.toThrow(/expected 5129 \/ 15129 \/ 35129/);
  });
});
