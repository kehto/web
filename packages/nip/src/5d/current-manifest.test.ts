import { describe, expect, it, vi } from 'vitest';
import { finalizeEvent } from 'nostr-tools/pure';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { computeAggregateHash } from '../5a/index.js';
import { parseNappletManifest, resolveNapplet, type NappletArtifactCache } from './index.js';

const bytes = new TextEncoder().encode('<html><head><meta name="napplet-requires" content="keys"></head><body>Verified</body></html>');
const hash = bytesToHex(sha256(bytes));
const key = hexToBytes('11'.repeat(32));
function event(tags: string[][], kind = 35129, content = '<b>Plain text description</b>') {
  return JSON.parse(JSON.stringify(finalizeEvent({ kind, created_at: 1, content, tags }, key)));
}
const current = [['d', 'test'], ['x', hash], ['R', 'relay'], ['O', 'theme'], ['z', 'feed'], ['i', 'napplet:feed/open', 'filters']];
const legacy = [['d', 'test'], ['path', '/index.html', hash], ['x', computeAggregateHash([{ path: '/index.html', sha256: hash }]), 'aggregate'], ['requires', 'relay'], ['archetype', 'feed', 'napplet:note/open']];

describe('current NIP-5D manifest', () => {
  it('normalizes independent advertisements and preserves description as plain text', () => {
    expect(parseNappletManifest(event(current))).toMatchObject({
      format: 'current', artifactHash: hash, aggregateHash: hash,
      paths: [{ path: '/index.html', sha256: hash }], requires: ['relay'], optional: ['theme'],
      archetypeSlugs: ['feed'], intents: [{ identity: 'napplet:feed/open', parameters: ['filters'] }],
      archetypes: [{ slug: 'feed', convention: 'napplet:feed/open', params: ['filters'] }],
      description: '<b>Plain text description</b>',
    });
  });
  it('projects only same-role z/i contracts and preserves parameters', () => {
    const parsed = parseNappletManifest(event([...current, ['z', 'bookmark'], ['i', 'napplet:bookmark/edit', 'folder']]));
    expect(parsed.archetypes).toEqual([
      { slug: 'feed', convention: 'napplet:feed/open', params: ['filters'] },
      { slug: 'bookmark', convention: 'napplet:bookmark/edit', params: ['folder'] },
    ]);
    expect(parseNappletManifest(event(current.filter((tag) => tag[0] !== 'i'))).archetypes).toEqual([]);
  });
  it.each([
    current.filter((tag) => tag[0] !== 'x'), [...current, ['x', hash]],
    [...current, ['d', 'duplicate']], current.filter((tag) => tag[0] !== 'd'),
    current.map((tag) => tag[0] === 'x' ? ['x', hash.toUpperCase()] : tag),
    [...current, ['R', 'NAP-RELAY']], [...current, ['O', 'relay.subscribe']],
    [...current, ['a', `35129:${'ab'.repeat(32)}:parent`]],
  ].map((tags) => ({ tags })))('rejects malformed current declarations: $tags', ({ tags }) => {
    expect(() => parseNappletManifest(event(tags))).toThrow();
  });
  it('requires a nonempty description without retrying legacy parsing', () => {
    expect(() => parseNappletManifest(event([...current, ['path', '/index.html', hash]], 35129, '  '))).toThrow(/description/);
  });
  it.each([5129, 15129])('accepts kind %i without d, rejects it with d', (kind) => {
    expect(parseNappletManifest(event([['x', hash]], kind)).dTag).toBe('');
    expect(() => parseNappletManifest(event(current, kind))).toThrow(/d tag/);
  });
  it('ignores malformed current advertisements and old declarations without widening authority', () => {
    const parsed = parseNappletManifest(event([...current, ['requires', 'keys'], ['description', 'wrong'], ['archetype', 'admin', 'napplet:keys/open'], ['path', '/evil', 'bad']]));
    expect(parsed.requires).toEqual(['relay']);
    expect(parsed.description).toBe('<b>Plain text description</b>');
    expect(parsed.paths).toEqual([{ path: '/index.html', sha256: hash }]);
    expect(parsed.archetypes).toEqual([{ slug: 'feed', convention: 'napplet:feed/open', params: ['filters'] }]);
  });
  it.each([['icon', hash, 'image/svg+xml'], ['icon', 'bad', 'image/png'], ['icon']])('keeps malformed icons nonfatal: %j', (...icon) => {
    expect(parseNappletManifest(event([...current, icon])).icon).toBeUndefined();
  });
  it('retains supported icon metadata but does not fetch it as executable content', async () => {
    const fetchBlob = vi.fn(async () => bytes);
    const result = await resolveNapplet({ event: event([...current, ['icon', 'aa'.repeat(32), 'image/png']]), fetchBlob });
    expect(result.manifest.icon).toEqual({ sha256: 'aa'.repeat(32), mimeType: 'image/png' });
    expect(fetchBlob).toHaveBeenCalledExactlyOnceWith(hash, []);
  });
  it('never resolves snapshot lineage on its behalf', async () => {
    const fetchBlob = vi.fn(async () => bytes);
    const parent = `35129:${'ab'.repeat(32)}:parent`;
    const result = await resolveNapplet({ event: event([['x', hash], ['a', parent], ['A', parent]], 5129), fetchBlob });
    expect(result.manifest.parent).toBe(parent);
    expect(result.artifactHash).toBe(hash);
    expect(fetchBlob).toHaveBeenCalledExactlyOnceWith(hash, []);
  });
});

describe.each([['current', current], ['legacy', legacy]] as const)('%s verification parity', (format, tags) => {
  it('verifies bytes and rechecks corrupt cache entries before use', async () => {
    const cache = { readBlob: vi.fn(async () => new Uint8Array([1])), deleteBlob: vi.fn(), writeVerifiedResolution: vi.fn() };
    const fetchBlob = vi.fn(async () => bytes);
    const resolved = await resolveNapplet({ event: event(tags.map((tag) => [...tag])), fetchBlob, cache: cache as unknown as NappletArtifactCache });
    expect(resolved.manifest.format).toBe(format);
    expect(resolved.indexHtml).toBe(new TextDecoder().decode(bytes));
    expect(resolved.manifest.requires).toEqual(['relay']); // HTML metadata grants nothing.
    expect(cache.deleteBlob).toHaveBeenCalledWith(hash);
    expect(cache.writeVerifiedResolution).toHaveBeenCalledOnce();
    expect(fetchBlob).toHaveBeenCalledOnce();
  });
  it('uses verified warm blobs without a network fetch', async () => {
    const cache = { readBlob: vi.fn(async () => bytes), writeVerifiedResolution: vi.fn() };
    const fetchBlob = vi.fn();
    await resolveNapplet({ event: event(tags.map((tag) => [...tag])), fetchBlob, cache: cache as unknown as NappletArtifactCache });
    expect(fetchBlob).not.toHaveBeenCalled();
  });
  it('rejects signature tampering before fetching bytes', async () => {
    const forged = event(tags.map((tag) => [...tag])); forged.content = 'tampered';
    const fetchBlob = vi.fn(async () => bytes);
    await expect(resolveNapplet({ event: forged, fetchBlob })).rejects.toMatchObject({ code: 'invalid-signature' });
    expect(fetchBlob).not.toHaveBeenCalled();
  });
  it('rejects wrong gateway bytes and never caches them', async () => {
    const writeVerifiedResolution = vi.fn();
    await expect(resolveNapplet({ event: event(tags.map((tag) => [...tag])), fetchBlob: async () => new Uint8Array([1]), cache: { readBlob: async () => undefined, writeVerifiedResolution } as unknown as NappletArtifactCache })).rejects.toMatchObject({ code: 'blob-hash-mismatch' });
    expect(writeVerifiedResolution).not.toHaveBeenCalled();
  });
});

it('warns once for verified legacy manifests and stays quiet for current or invalid artifacts', async () => {
  vi.resetModules();
  const { resolveNapplet: resolve } = await import('./index.js');
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    await resolve({ event: event(current), fetchBlob: async () => bytes });
    await expect(resolve({ event: event(legacy), fetchBlob: async () => new Uint8Array([1]) })).rejects.toMatchObject({ code: 'blob-hash-mismatch' });
    expect(warn).not.toHaveBeenCalled();
    await resolve({ event: event(legacy), fetchBlob: async () => bytes });
    await resolve({ event: event(legacy), fetchBlob: async () => bytes });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[KEHTO_COMPAT_LEGACY_MANIFEST]'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('@napplet/vite-plugin >=0.15'));
  } finally { warn.mockRestore(); }
});
