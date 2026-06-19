import { describe, it, expect } from 'vitest';
import { finalizeEvent } from 'nostr-tools/pure';
import type { NostrEvent } from 'nostr-tools';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { computeAggregateHash, type PathEntry } from '../5a/index.js';
import {
  CacheStorageNappletArtifactCache,
  coordinateKey,
  isCoordinateFresh,
  openNappletArtifactCache,
} from './artifact-cache.js';
import {
  NAPPLET_KIND_NAMED,
  resolveNapplet,
  type NappletArtifactCache,
} from './index.js';

const SK = hexToBytes('11'.repeat(32));
const enc = new TextEncoder();

class MemoryCache {
  readonly entries = new Map<string, Response>();

  async match(input: RequestInfo | URL): Promise<Response | undefined> {
    return this.entries.get(this.key(input))?.clone();
  }

  async put(input: RequestInfo | URL, response: Response): Promise<void> {
    this.entries.set(this.key(input), response.clone());
  }

  async delete(input: RequestInfo | URL): Promise<boolean> {
    return this.entries.delete(this.key(input));
  }

  private key(input: RequestInfo | URL): string {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    return input.url;
  }
}

class MemoryCacheStorage {
  readonly caches = new Map<string, MemoryCache>();

  async open(name: string): Promise<MemoryCache> {
    const existing = this.caches.get(name);
    if (existing) return existing;
    const cache = new MemoryCache();
    this.caches.set(name, cache);
    return cache;
  }
}

function blob(content: string): { bytes: Uint8Array; hash: string } {
  const bytes = enc.encode(content);
  return { bytes, hash: bytesToHex(sha256(bytes)) };
}

function buildManifest(dTag = 'chat', body = 'chat') {
  const index = blob(`<!doctype html><title>${dTag}</title><body>${body}</body>`);
  const asset = blob(`console.log("${dTag}")`);
  const entries: PathEntry[] = [
    { path: '/index.html', sha256: index.hash },
    { path: '/app.js', sha256: asset.hash },
  ];
  const aggregate = computeAggregateHash(entries);
  const event = finalizeEvent(
    {
      kind: NAPPLET_KIND_NAMED,
      created_at: 1_700_000_000,
      tags: [
        ['d', dTag],
        ['path', '/index.html', index.hash],
        ['path', '/app.js', asset.hash],
        ['x', aggregate, 'aggregate'],
        ['server', 'https://blossom.example'],
      ],
      content: '',
    },
    SK,
  );
  const blobs = new Map<string, Uint8Array>([
    [index.hash, index.bytes],
    [asset.hash, asset.bytes],
  ]);
  return { event, blobs, aggregate, index, asset };
}

function fetcherFor(blobs: Map<string, Uint8Array>, calls: string[] = []) {
  return async (sha256Hex: string): Promise<Uint8Array> => {
    calls.push(sha256Hex);
    const bytes = blobs.get(sha256Hex);
    if (!bytes) throw new Error(`missing ${sha256Hex}`);
    return bytes;
  };
}

function createCache(options: {
  now?: () => number;
  unknownBudgetBytes?: number;
  hardCeilingBytes?: number;
} = {}) {
  return new CacheStorageNappletArtifactCache({
    cacheStorage: new MemoryCacheStorage() as unknown as CacheStorage,
    baseUrl: 'https://cache.test/',
    now: options.now,
    unknownBudgetBytes: options.unknownBudgetBytes,
    hardCeilingBytes: options.hardCeilingBytes,
  });
}

describe('CacheStorageNappletArtifactCache', () => {
  it('populates blob, aggregate, coordinate, and index records after verified resolution', async () => {
    const cache = createCache();
    const { event, blobs, aggregate, index, asset } = buildManifest();

    await resolveNapplet({ event, fetchBlob: fetcherFor(blobs), cache });

    await expect(cache.readBlob(index.hash)).resolves.toEqual(index.bytes);
    await expect(cache.readBlob(asset.hash)).resolves.toEqual(asset.bytes);
    const snapshot = await cache.snapshotIndex();
    expect(snapshot.aggregates[`chat:${aggregate}`]).toMatchObject({
      dTag: 'chat',
      aggregateHash: aggregate,
      blobHashes: [index.hash, asset.hash],
    });
    expect(snapshot.coordinates[coordinateKey(NAPPLET_KIND_NAMED, event.pubkey, 'chat')]).toMatchObject({
      aggregateHash: aggregate,
      dTag: 'chat',
    });
  });

  it('serves cached blob hits without network fetches while preserving signature and aggregate checks', async () => {
    const cache = createCache();
    const { event, blobs, aggregate } = buildManifest();
    await resolveNapplet({ event, fetchBlob: fetcherFor(blobs), cache });

    const calls: string[] = [];
    const resolved = await resolveNapplet({
      event,
      cache,
      fetchBlob: async (sha256Hex) => {
        calls.push(sha256Hex);
        throw new Error('network should not be used on blob cache hit');
      },
    });

    expect(resolved.aggregateHash).toBe(aggregate);
    expect(resolved.indexHtml).toContain('<body>chat</body>');
    expect(calls).toEqual([]);
  });

  it('rejects an invalid manifest signature even when matching blobs are cached', async () => {
    const cache = createCache();
    const { event, blobs } = buildManifest();
    await resolveNapplet({ event, fetchBlob: fetcherFor(blobs), cache });

    const forged: NostrEvent = JSON.parse(JSON.stringify(event)) as NostrEvent;
    forged.sig = '0'.repeat(128);
    await expect(resolveNapplet({ event: forged, fetchBlob: fetcherFor(blobs), cache }))
      .rejects.toMatchObject({ code: 'invalid-signature' });
  });

  it('does not accept a corrupted cached blob as verified content', async () => {
    const { event } = buildManifest();
    const deleted: string[] = [];
    const fakeCache: NappletArtifactCache = {
      readBlob: async () => enc.encode('forged cached bytes'),
      deleteBlob: async (sha256Hex) => {
        deleted.push(sha256Hex);
      },
      writeVerifiedResolution: async () => {},
      writeCoordinate: async () => {},
      getCoordinate: async () => undefined,
      touchAggregate: async () => {},
      markAggregateActive: () => {},
      releaseAggregateActive: () => {},
      prune: async () => {},
    };

    await expect(resolveNapplet({
      event,
      cache: fakeCache,
      fetchBlob: async () => enc.encode('forged network bytes'),
    })).rejects.toMatchObject({ code: 'blob-hash-mismatch' });
    expect(deleted.length).toBeGreaterThan(0);
  });

  it('tracks coordinate freshness separately from immutable aggregate retention', async () => {
    const now = 1_000_000;
    const cache = createCache({ now: () => now });
    await cache.writeCoordinate({
      kind: NAPPLET_KIND_NAMED,
      pubkey: 'pub',
      dTag: 'chat',
      aggregateHash: 'a'.repeat(64),
      lastResolvedAt: now,
    });

    await expect(cache.getCoordinate(
      { kind: NAPPLET_KIND_NAMED, pubkey: 'pub', dTag: 'chat' },
      { now: now + 14 * 60 * 1000 },
    )).resolves.toMatchObject({ fresh: true });
    await expect(cache.getCoordinate(
      { kind: NAPPLET_KIND_NAMED, pubkey: 'pub', dTag: 'chat' },
      { now: now + 16 * 60 * 1000 },
    )).resolves.toMatchObject({ fresh: false });
    await expect(cache.getCoordinate(
      { kind: NAPPLET_KIND_NAMED, pubkey: 'pub', dTag: 'chat' },
      { now: now + 45 * 60 * 1000, background: true },
    )).resolves.toMatchObject({ fresh: true });
  });

  it('exposes pure coordinate freshness checks for hosts that keep their own coordinate index', () => {
    expect(isCoordinateFresh({
      key: 'k',
      kind: NAPPLET_KIND_NAMED,
      pubkey: 'pub',
      dTag: 'chat',
      aggregateHash: 'a'.repeat(64),
      lastResolvedAt: 100,
      foregroundTtlMs: 50,
      backgroundTtlMs: 500,
    }, { now: 140 })).toBe(true);
    expect(isCoordinateFresh({
      key: 'k',
      kind: NAPPLET_KIND_NAMED,
      pubkey: 'pub',
      dTag: 'chat',
      aggregateHash: 'a'.repeat(64),
      lastResolvedAt: 100,
      foregroundTtlMs: 50,
      backgroundTtlMs: 500,
    }, { now: 200 })).toBe(false);
  });

  it('prunes older aggregates and their unreferenced blobs by LRU when over budget', async () => {
    let now = 10_000;
    const cache = createCache({ now: () => now, unknownBudgetBytes: 1_000 });
    const first = buildManifest('chat', 'first');
    const second = buildManifest('feed', 'second');

    await resolveNapplet({ event: first.event, fetchBlob: fetcherFor(first.blobs), cache });
    now += 1_000;
    await resolveNapplet({ event: second.event, fetchBlob: fetcherFor(second.blobs), cache });

    const snapshot = await cache.snapshotIndex();
    expect(snapshot.aggregates[`chat:${first.aggregate}`]).toBeUndefined();
    expect(snapshot.aggregates[`feed:${second.aggregate}`]).toBeDefined();
    expect(snapshot.blobs[first.index.hash]).toBeUndefined();
    expect(snapshot.blobs[second.index.hash]).toBeDefined();
  });

  it('does not prune an active aggregate unless the hard ceiling is exceeded', async () => {
    let now = 10_000;
    const cache = createCache({ now: () => now, unknownBudgetBytes: 1_000, hardCeilingBytes: 10_000 });
    const first = buildManifest('chat', 'first');
    const second = buildManifest('feed', 'second');

    await resolveNapplet({ event: first.event, fetchBlob: fetcherFor(first.blobs), cache });
    cache.markAggregateActive('chat', first.aggregate);
    now += 1_000;
    await resolveNapplet({ event: second.event, fetchBlob: fetcherFor(second.blobs), cache });

    const snapshot = await cache.snapshotIndex();
    expect(snapshot.aggregates[`chat:${first.aggregate}`]).toBeDefined();
    expect(snapshot.aggregates[`feed:${second.aggregate}`]).toBeUndefined();
  });

  it('returns undefined so callers can stay network-only when Cache Storage or estimates are unavailable', async () => {
    await expect(openNappletArtifactCache({ cacheStorage: undefined })).resolves.toBeUndefined();
    await expect(openNappletArtifactCache({
      cacheStorage: new MemoryCacheStorage() as unknown as CacheStorage,
      storage: undefined,
      requireStorageEstimate: true,
    })).resolves.toBeUndefined();
  });
});
