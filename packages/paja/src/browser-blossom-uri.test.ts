import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parsePajaBlossomUri } from './browser-blossom-uri.js';

const bytes = new Uint8Array([0, 1, 2, 255]);
const hash = createHash('sha256').update(bytes).digest('hex');

afterEach(() => vi.restoreAllMocks());

describe('Blossom canonical references and migration', () => {
  it.each(['blossom:', 'blossom:sha256:'])('normalizes %s references without losing request hints', (prefix) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parsePajaBlossomUri(`${prefix}${hash}.bin?xs=cdn.example&sz=4`)).toEqual({
      hash, canonical: `blossom:${hash}`, extension: 'bin',
      servers: ['cdn.example'], authors: [], expectedSize: 4,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps canonical/invalid/aborted requests quiet and warns once for actual alias reads', async () => {
    vi.resetModules();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { createPajaResourceFetch } = await import('./browser-resource.js');
    const options = {
      getBlossomServers: () => ['https://cdn.example'],
      fetch: vi.fn(async () => new Response(bytes)),
    };
    const fetchResource = createPajaResourceFetch(options);
    const signal = new AbortController().signal;
    const canonical = await fetchResource(`blossom:${hash}.bin`, { signal });
    expect(new Uint8Array(await canonical.arrayBuffer())).toEqual(bytes);
    await expect(fetchResource('blossom:sha256:invalid', { signal })).rejects.toThrow('invalid Blossom URI');
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(fetchResource(`blossom:sha256:${hash}`, { signal: cancelled.signal })).rejects.toThrow();
    expect(warn).not.toHaveBeenCalled();
    const alias = await fetchResource(`blossom:sha256:${hash}.bin`, { signal });
    expect(new Uint8Array(await alias.arrayBuffer())).toEqual(bytes);
    await createPajaResourceFetch(options)(`blossom:sha256:${hash}`, { signal });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[KEHTO_COMPAT_BLOSSOM_SHA256] Replace blossom:sha256:<hash> with blossom:<hash>'));
    expect(warn.mock.calls[0]?.[0]).toContain('once per host module lifetime');
    expect(warn.mock.calls[0]?.[0]).not.toContain(hash);
  });

  it('shares the warning lifetime between server resolution and resource reads', async () => {
    vi.resetModules();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { createPajaBlossomEventResolver } = await import('./browser-blossom-events.js');
    const { createPajaResourceFetch } = await import('./browser-resource.js');
    const resolver = createPajaBlossomEventResolver({
      baseRouter: {
        query: async () => ({ events: [] }), subscribe: () => ({ close() {} }),
        publish: async () => ({ ok: true }), resolveRelays: async () => ({ relays: [], source: 'fallback' }),
      },
      getConfiguredServers: () => ['https://cdn.example'],
    });
    await resolver.getServers(`blossom:${hash}`);
    await resolver.getServers('blossom:sha256:invalid');
    expect(warn).not.toHaveBeenCalled();
    expect(await resolver.getServers(`blossom:sha256:${hash}`)).toEqual(['https://cdn.example']);
    const fetchResource = createPajaResourceFetch({
      getBlossomServers: ({ url }) => resolver.getServers(url),
      fetch: async () => new Response(bytes),
    });
    await fetchResource(`blossom:sha256:${hash}`, { signal: new AbortController().signal });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
