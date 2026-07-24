import { describe, it, expect } from 'vitest';
import { finalizeEvent } from 'nostr-tools/pure';
import type { NostrEvent } from 'nostr-tools';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { computeAggregateHash, type PathEntry } from '../5a/index.js';
import {
  NAPPLET_KIND_NAMED,
  NAPPLET_KIND_ROOT,
  NAPPLET_KIND_SNAPSHOT,
  NAPPLET_KINDS,
  isNappletManifestKind,
  parseNappletManifest,
  verifyManifestSignature,
  verifyBlobHash,
  fetchBlob,
  resolveNapplet,
  NappletResolutionError,
} from './index.js';

const SK = hexToBytes('11'.repeat(32));
const enc = new TextEncoder();

// Events arriving from relays are plain JSON. nostr-tools memoizes a "verified"
// marker on objects it signs/verifies, so clone through JSON before tampering to
// faithfully model a relay-delivered event (and defeat the memoization).
const fromRelay = (event: NostrEvent): NostrEvent => JSON.parse(JSON.stringify(event)) as NostrEvent;

function blob(content: string): { bytes: Uint8Array; hash: string } {
  const bytes = enc.encode(content);
  return { bytes, hash: bytesToHex(sha256(bytes)) };
}

interface BuildOpts {
  kind?: number;
  dTag?: string;
  /** Override the aggregate x tag value (to forge a valid-sig / bad-aggregate manifest). */
  aggregateOverride?: string;
  /** Omit the /index.html path entry. */
  noIndex?: boolean;
  /** Omit the aggregate x tag entirely. */
  noAggregateTag?: boolean;
  /** Archetype tags to emit: `[slug]` or `[slug, nap]`. */
  archetypes?: Array<[string] | [string, string]>;
  /** Emit a `source` tag with this value. */
  source?: string;
}

function buildManifest(opts: BuildOpts = {}) {
  const index = blob('<!doctype html><title>chat</title><body>chat</body>');
  const asset = blob('console.log("chat napplet")');
  const entries: PathEntry[] = [];
  if (!opts.noIndex) entries.push({ path: '/index.html', sha256: index.hash });
  entries.push({ path: '/app.js', sha256: asset.hash });

  const aggregate = opts.aggregateOverride ?? computeAggregateHash(entries);
  const tags: string[][] = [['d', opts.dTag ?? 'chat']];
  for (const e of entries) tags.push(['path', e.path, e.sha256]);
  if (!opts.noAggregateTag) tags.push(['x', aggregate, 'aggregate']);
  tags.push(['server', 'https://blossom.example']);
  tags.push(['requires', 'relay']);
  tags.push(['requires', 'storage']);
  tags.push(['title', 'Chat']);
  tags.push(['description', 'A chat napplet']);
  for (const a of opts.archetypes ?? []) tags.push(['archetype', ...a]);
  if (opts.source !== undefined) tags.push(['source', opts.source]);

  const event = finalizeEvent(
    { kind: opts.kind ?? NAPPLET_KIND_NAMED, created_at: 1_700_000_000, tags, content: '' },
    SK,
  );
  const blobs = new Map<string, Uint8Array>([[index.hash, index.bytes], [asset.hash, asset.bytes]]);
  return { event, blobs, aggregate, index, asset };
}

/** Resolve fetcher backed by an in-memory blob store (the "Blossom" stand-in). */
const fetcherFor = (blobs: Map<string, Uint8Array>) =>
  async (sha256Hex: string): Promise<Uint8Array> => {
    const bytes = blobs.get(sha256Hex);
    if (!bytes) throw new Error(`missing ${sha256Hex}`);
    return bytes;
  };

describe('NIP-5D kind constants', () => {
  it('exposes the branch-HEAD kinds', () => {
    expect(NAPPLET_KIND_SNAPSHOT).toBe(5129);
    expect(NAPPLET_KIND_ROOT).toBe(15129);
    expect(NAPPLET_KIND_NAMED).toBe(35129);
    expect([...NAPPLET_KINDS].sort((a, b) => a - b)).toEqual([5129, 15129, 35129]);
  });

  it('isNappletManifestKind recognizes only the three kinds', () => {
    expect(isNappletManifestKind(35129)).toBe(true);
    expect(isNappletManifestKind(15129)).toBe(true);
    expect(isNappletManifestKind(5129)).toBe(true);
    expect(isNappletManifestKind(35128)).toBe(false);
    expect(isNappletManifestKind(1)).toBe(false);
  });
});

describe('parseNappletManifest', () => {
  it('parses a well-formed named manifest', () => {
    const { event, aggregate } = buildManifest();
    const m = parseNappletManifest(event);
    expect(m.kind).toBe(NAPPLET_KIND_NAMED);
    expect(m.dTag).toBe('chat');
    expect(m.aggregateHash).toBe(aggregate);
    expect(m.paths).toEqual([
      { path: '/index.html', sha256: expect.any(String) },
      { path: '/app.js', sha256: expect.any(String) },
    ]);
    expect(m.servers).toEqual(['https://blossom.example']);
    expect(m.requires).toEqual(['relay', 'storage']);
    expect(m.title).toBe('Chat');
    expect(m.description).toBe('A chat napplet');
    expect(m.archetypes).toEqual([]);
    expect(m.pubkey).toBe(event.pubkey);
  });

  it('rejects a non-napplet kind', () => {
    const { event } = buildManifest({ kind: 35128 });
    expect(() => parseNappletManifest(event)).toThrow(NappletResolutionError);
  });

  it('rejects a manifest with no path tags', () => {
    const bad = finalizeEvent(
      { kind: NAPPLET_KIND_NAMED, created_at: 1, tags: [['d', 'x'], ['x', 'aa', 'aggregate']], content: '' },
      SK,
    );
    expect(() => parseNappletManifest(bad)).toThrow(/path/i);
  });

  it('rejects a manifest with no aggregate x tag', () => {
    const { event } = buildManifest({ noAggregateTag: true });
    expect(() => parseNappletManifest(event)).toThrow(/aggregate/i);
  });
});

describe('archetype + source parsing', () => {
  it('parses a single archetype tag with a stable convention', () => {
    const { event } = buildManifest({ archetypes: [['profile', 'NAP-1']] });
    const m = parseNappletManifest(event);
    expect(m.archetypes).toEqual([{ slug: 'profile', convention: 'NAP-1' }]);
  });

  it('parses multiple archetype tags in declared order', () => {
    const { event } = buildManifest({ archetypes: [['profile', 'NAP-1'], ['feed', 'NAP-2']] });
    const m = parseNappletManifest(event);
    expect(m.archetypes).toEqual([
      { slug: 'profile', convention: 'NAP-1' },
      { slug: 'feed', convention: 'NAP-2' },
    ]);
  });

  it('yields an empty array when no archetype tag is present', () => {
    const { event } = buildManifest();
    const m = parseNappletManifest(event);
    expect(m.archetypes).toEqual([]);
  });

  it('omits nap when the archetype tag has no 3rd element', () => {
    const { event } = buildManifest({ archetypes: [['feed']] });
    const m = parseNappletManifest(event);
    expect(m.archetypes).toEqual([{ slug: 'feed' }]);
    expect('nap' in m.archetypes[0]).toBe(false);
  });

  it('parses the source tag when present', () => {
    const { event } = buildManifest({ source: 'https://example.com/src' });
    const m = parseNappletManifest(event);
    expect(m.source).toBe('https://example.com/src');
  });

  it('leaves source undefined when absent', () => {
    const { event } = buildManifest();
    const m = parseNappletManifest(event);
    expect(m.source).toBeUndefined();
  });
});

describe('verifyManifestSignature', () => {
  it('accepts a validly-signed manifest', () => {
    const { event } = buildManifest();
    expect(verifyManifestSignature(event)).toBe(true);
  });

  it('rejects a manifest with a tampered signature', () => {
    const { event } = buildManifest();
    const forged = fromRelay(event);
    forged.sig = '0'.repeat(128);
    expect(verifyManifestSignature(forged)).toBe(false);
  });

  it('rejects a manifest whose content was changed after signing', () => {
    const { event } = buildManifest();
    const forged = fromRelay(event);
    forged.content = 'tampered';
    expect(verifyManifestSignature(forged)).toBe(false);
  });
});

describe('verifyBlobHash', () => {
  it('accepts bytes whose sha256 matches', () => {
    const { bytes, hash } = blob('hello');
    expect(verifyBlobHash(bytes, hash)).toBe(true);
  });

  it('rejects bytes whose sha256 does not match', () => {
    const { bytes } = blob('hello');
    expect(verifyBlobHash(bytes, '0'.repeat(64))).toBe(false);
  });
});

describe('fetchBlob', () => {
  it('returns verified bytes from the first server that serves a matching blob', async () => {
    const { hash, bytes } = blob('payload');
    const calls: string[] = [];
    const got = await fetchBlob(['https://a.example', 'https://b.example/'], hash, async (url) => {
      calls.push(url);
      if (url.startsWith('https://b.example')) return bytes;
      throw new Error('404');
    });
    expect(verifyBlobHash(got, hash)).toBe(true);
    expect(calls).toEqual([`https://a.example/${hash}`, `https://b.example/${hash}`]);
  });

  it('rejects a server that returns bytes with the wrong hash, then tries the next', async () => {
    const { hash, bytes } = blob('payload');
    const got = await fetchBlob(['https://evil.example', 'https://good.example'], hash, async (url) =>
      url.includes('evil') ? enc.encode('forged') : bytes,
    );
    expect(verifyBlobHash(got, hash)).toBe(true);
  });

  it('throws when no server serves a matching blob', async () => {
    const { hash } = blob('payload');
    await expect(
      fetchBlob(['https://a.example'], hash, async () => enc.encode('forged')),
    ).rejects.toMatchObject({ code: 'blob-unavailable' });
  });
});

describe('resolveNapplet', () => {
  it('resolves verified bytes end-to-end and returns computed identity', async () => {
    const { event, blobs, aggregate, index } = buildManifest();
    const resolved = await resolveNapplet({ event, fetchBlob: fetcherFor(blobs) });
    expect(resolved.dTag).toBe('chat');
    expect(resolved.aggregateHash).toBe(aggregate);
    expect(resolved.indexHtml).toBe(new TextDecoder().decode(index.bytes));
    expect(resolved.files.size).toBe(2);
  });

  it('rejects an invalid signature', async () => {
    const { event, blobs } = buildManifest();
    const forged = fromRelay(event);
    forged.sig = '0'.repeat(128);
    await expect(resolveNapplet({ event: forged, fetchBlob: fetcherFor(blobs) }))
      .rejects.toMatchObject({ code: 'invalid-signature' });
  });

  it('rejects when the aggregate x tag does not match the path tags (forged but signed)', async () => {
    const { event, blobs } = buildManifest({ aggregateOverride: '0'.repeat(64) });
    await expect(resolveNapplet({ event, fetchBlob: fetcherFor(blobs) }))
      .rejects.toMatchObject({ code: 'aggregate-mismatch' });
  });

  it('rejects when a fetched blob hash does not match (gateway not trusted)', async () => {
    const { event } = buildManifest();
    const lyingFetcher = async () => enc.encode('not the real bytes');
    await expect(resolveNapplet({ event, fetchBlob: lyingFetcher }))
      .rejects.toMatchObject({ code: 'blob-hash-mismatch' });
  });

  it('rejects when there is no /index.html entry', async () => {
    const { event, blobs } = buildManifest({ noIndex: true });
    await expect(resolveNapplet({ event, fetchBlob: fetcherFor(blobs) }))
      .rejects.toMatchObject({ code: 'missing-index' });
  });
});
