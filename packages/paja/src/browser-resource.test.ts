import type { NappletMessage } from '@napplet/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPajaAdapter } from './browser-adapter.js';
import {
  createPajaResourceFetch,
  PAJA_RESOURCE_MAX_BYTES,
  PAJA_RESOURCE_MAX_SERVERS,
  PAJA_RESOURCE_MAX_URLS,
  pajaResourceInfo,
} from './browser-resource.js';
import type { PajaHostConfig } from './options.js';
import { normalizePajaSimulation } from './simulation.js';

const CONFIG = {
  window: { id: 'resource-window', dTag: 'resource-napplet', aggregateHash: 'resource-hash' },
} as PajaHostConfig;

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function gameBoyRomVector(): Uint8Array {
  const bytes = new Uint8Array(32 * 1024);
  bytes.set([
    0xce, 0xed, 0x66, 0x66, 0xcc, 0x0d, 0x00, 0x0b,
    0x03, 0x73, 0x00, 0x83, 0x00, 0x0c, 0x00, 0x0d,
    0x00, 0x08, 0x11, 0x1f, 0x88, 0x89, 0x00, 0x0e,
    0xdc, 0xcc, 0x6e, 0xe6, 0xdd, 0xdd, 0xd9, 0x99,
    0xbb, 0xbb, 0x67, 0x63, 0x6e, 0x0e, 0xec, 0xcc,
    0xdd, 0xdc, 0x99, 0x9f, 0xbb, 0xb9, 0x33, 0x3e,
  ], 0x104);
  bytes.set(new TextEncoder().encode('KEHTO TEST'), 0x134);
  bytes[0x143] = 0x80;
  let checksum = 0;
  for (let index = 0x134; index <= 0x14c; index += 1) {
    checksum = (checksum - (bytes[index] ?? 0) - 1) & 0xff;
  }
  bytes[0x14d] = checksum;
  return bytes;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Paja resource backend', () => {
  it('delivers hash-verified opaque Blossom bytes with a runtime-owned MIME', async () => {
    const bytes = new Uint8Array([0x80, 0xff, 0x00, 0x42]);
    const hash = await sha256Hex(bytes);
    const fetchResource = createPajaResourceFetch({
      getBlossomServers: () => ['https://blossom.example'],
      fetch: vi.fn(async () => new Response(bytes, { headers: { 'content-type': 'text/html' } })),
    });

    const response = await fetchResource(`blossom:sha256:${hash}`, {
      signal: new AbortController().signal,
    });

    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  it('routes opaque Blossom bytes through the actual adapter resource service', async () => {
    const bytes = new Uint8Array([0x80, 0xff, 0x00, 0x42]);
    const hash = await sha256Hex(bytes);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(bytes)));
    const adapter = createPajaAdapter(
      CONFIG,
      () => normalizePajaSimulation({ relay: { mode: 'disabled' } }),
      () => {},
      () => {},
      () => true,
    );
    try {
      const sent: NappletMessage[] = [];
      adapter.services?.resource?.handleMessage('resource-window', {
        type: 'resource.bytes',
        id: 'opaque-1',
        url: `blossom:sha256:${hash}`,
        servers: ['https://blossom.example'],
      } as NappletMessage, (message) => sent.push(message));
      await vi.waitFor(() => expect(sent).toHaveLength(1));

      const result = sent[0] as NappletMessage & { blob: Blob; mime: string };
      expect(result).toMatchObject({
        type: 'resource.bytes.result', id: 'opaque-1', mime: 'application/octet-stream',
      });
      expect(result.blob.type).toBe('application/octet-stream');
      expect(new Uint8Array(await result.blob.arrayBuffer())).toEqual(bytes);
    } finally {
      (adapter.relayPool.getRelayPool() as unknown as { close(): void }).close();
    }
  });

  it('discloses permissive browser network schemes and request-hinted Blossom support', () => {
    expect(pajaResourceInfo()).toEqual({
      schemes: [
        { scheme: 'data', enabled: true },
        { scheme: 'https', enabled: true },
        { scheme: 'http', enabled: true },
        { scheme: 'blossom', enabled: true },
      ],
      maxBytes: PAJA_RESOURCE_MAX_BYTES,
      maxUrls: PAJA_RESOURCE_MAX_URLS,
      maxServers: PAJA_RESOURCE_MAX_SERVERS,
    });
  });

  it.each([
    ['invalid UTF-8', new Uint8Array([0x80, 0xff, 0x42])],
    ['NUL-bearing binary', new Uint8Array([0x42, 0x00, 0x43])],
  ])('limits opaque %s delivery to verified Blossom', async (_name, bytes) => {
    const hash = await sha256Hex(bytes);
    const fetchResource = createPajaResourceFetch({
      getBlossomServers: () => ['https://blossom.example'],
      fetch: vi.fn(async () => new Response(bytes, { headers: { 'content-type': 'image/png' } })),
    });
    const signal = new AbortController().signal;
    const response = await fetchResource(`blossom:sha256:${hash}`, { signal });
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);

    const encoded = btoa(String.fromCharCode(...bytes));
    for (const url of [
      `data:image/png;base64,${encoded}`,
      'http://media.example/binary',
      'https://media.example/binary',
    ]) {
      await expect(fetchResource(url, { signal })).rejects.toMatchObject({ code: 'decode-failed' });
    }
  });

  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    ' \n\t<SvG></SvG>',
    '<?xml version="1.0"?><svg></svg>',
    '\ufeff <?XML version="1.0"?><document/>',
    ' \n<!DOCTYPE HTML><html></html>',
    '\t<HtMl></HtMl>',
    ' <ScRiPt>alert(1)</ScRiPt>',
    '<svg>\u0000</svg>',
    '<html>\u0000</html>',
    '<?xml\u0000 version="1.0"?>',
    '<script>\u0000</script>',
  ])('rejects matching-hash markup %j despite opaque suffixes', async (markup) => {
    // Both NUL and invalid UTF-8 must not bypass the active-prefix check.
    for (const suffix of [new Uint8Array(), new Uint8Array([0xff])]) {
      const prefix = new TextEncoder().encode(markup);
      const bytes = new Uint8Array([...prefix, ...suffix]);
      const hash = await sha256Hex(bytes);
      const fetchResource = createPajaResourceFetch({
        getBlossomServers: () => ['https://blossom.example'],
        fetch: vi.fn(async () => new Response(bytes, { headers: { 'content-type': 'image/png' } })),
      });
      await expect(fetchResource(`blossom:sha256:${hash}`, {
        signal: new AbortController().signal,
      })).rejects.toMatchObject({ code: 'decode-failed' });
    }
  });

  it.each([
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png'],
    [new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg'],
    [new TextEncoder().encode('GIF87a'), 'image/gif'],
    [new TextEncoder().encode('GIF89a'), 'image/gif'],
    [new TextEncoder().encode('RIFF0000WEBP'), 'image/webp'],
    [new TextEncoder().encode('RIFF0000WAVE'), 'audio/wav'],
    [new TextEncoder().encode('OggS'), 'audio/ogg'],
    [new TextEncoder().encode('ID3'), 'audio/mpeg'],
    [new Uint8Array([0xff, 0xfb]), 'audio/mpeg'],
    [new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), 'video/webm'],
    [new TextEncoder().encode('0000ftyp'), 'video/mp4'],
    [new TextEncoder().encode('wOFF'), 'font/woff'],
    [new TextEncoder().encode('wOF2'), 'font/woff2'],
    [gameBoyRomVector(), 'application/vnd.nintendo.gb-rom'],
    [new TextEncoder().encode('{"json":true}'), 'application/json'],
    [new TextEncoder().encode('[1,2]'), 'application/json'],
    [new TextEncoder().encode('plain UTF-8 café'), 'text/plain'],
    [new TextEncoder().encode('{not json'), 'text/plain'],
  ])('preserves recognized byte MIME vector %# despite upstream headers', async (bytes, mime) => {
    const hash = await sha256Hex(bytes);
    const fetchResource = createPajaResourceFetch({
      getBlossomServers: () => ['https://blossom.example'],
      fetch: vi.fn(async () => new Response(bytes, { headers: { 'content-type': 'text/html' } })),
    });
    const response = await fetchResource(`blossom:sha256:${hash}`, {
      signal: new AbortController().signal,
    });
    expect(response.headers.get('content-type')).toBe(mime);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  it('rejects opaque hash mismatch but permits a later matching server response', async () => {
    const bytes = new Uint8Array([0x80, 0xff, 0x00]);
    const hash = await sha256Hex(bytes);
    const fetchFn = vi.fn(async () => new Response(new Uint8Array([0xff, 0x00])));
    const fetchResource = createPajaResourceFetch({
      getBlossomServers: () => ['https://one.example', 'https://two.example'],
      fetch: fetchFn,
    });
    const signal = new AbortController().signal;
    await expect(fetchResource(`blossom:sha256:${hash}`, { signal }))
      .rejects.toMatchObject({ code: 'decode-failed' });
    fetchFn.mockResolvedValueOnce(new Response(new Uint8Array([0xff])))
      .mockResolvedValueOnce(new Response(bytes));
    const response = await fetchResource(`blossom:sha256:${hash}`, { signal });
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it.each([undefined, '1'])('caps streamed opaque bytes with content-length %s', async (length) => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(PAJA_RESOURCE_MAX_BYTES).fill(0xff));
        controller.enqueue(new Uint8Array([0xff]));
      },
      cancel,
    });
    const fetchResource = createPajaResourceFetch({
      getBlossomServers: () => ['https://blossom.example'],
      fetch: vi.fn(async () => new Response(body, {
        headers: length ? { 'content-length': length } : {},
      })),
    });
    await expect(fetchResource(`blossom:sha256:${'b'.repeat(64)}`, {
      signal: new AbortController().signal,
    })).rejects.toMatchObject({ code: 'too-large' });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each(['markup', 'mismatch', 'oversize'])('returns one adapter bytes error for %s', async (failure) => {
    const bytes = failure === 'markup'
      ? new TextEncoder().encode(' <SVG>\u0000</SVG>')
      : new Uint8Array([0x80, 0xff]);
    const hash = await sha256Hex(bytes);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      failure === 'mismatch' ? new Uint8Array([0xff]) : bytes,
      { headers: failure === 'oversize' ? { 'content-length': String(PAJA_RESOURCE_MAX_BYTES + 1) } : {} },
    )));
    const adapter = createPajaAdapter(
      CONFIG,
      () => normalizePajaSimulation({ relay: { mode: 'disabled' } }),
      () => {},
      () => {},
      () => true,
    );
    try {
      const sent: NappletMessage[] = [];
      adapter.services?.resource?.handleMessage('resource-window', {
        type: 'resource.bytes', id: `failure-${failure}`, url: `blossom:sha256:${hash}`,
        servers: ['https://blossom.example'],
      } as NappletMessage, (message) => sent.push(message));
      await vi.waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]).toMatchObject({
        type: 'resource.bytes.error', id: `failure-${failure}`,
        error: failure === 'oversize' ? 'too-large' : 'decode-failed',
      });
      expect(sent[0]).not.toHaveProperty('blob');
    } finally {
      (adapter.relayPool.getRelayPool() as unknown as { close(): void }).close();
    }
  });

  it('preserves mixed adapter bulk order, byte fidelity and sibling errors across delayed fetches', async () => {
    const vectors = [
      new Uint8Array([0x80, 0xff]),
      new Uint8Array([0x42, 0x00, 0x43]),
      gameBoyRomVector(),
      new TextEncoder().encode('{"bulk":true}'),
      new TextEncoder().encode(' <SVG>\u0000</SVG>'),
      new Uint8Array([0xff, 0x01]),
      new Uint8Array([0xff, 0x02]),
    ];
    const hashes = await Promise.all(vectors.map(sha256Hex));
    const urls = hashes.map((hash) => `blossom:sha256:${hash}`);
    let releaseFirst!: (response: Response) => void;
    const firstResponse = new Promise<Response>((resolve) => { releaseFirst = resolve; });
    const completed: number[] = [];
    const fetchFn = vi.fn(async (value: string) => {
      const index = hashes.indexOf(value.split('/').at(-1) ?? '');
      expect(index).toBeGreaterThanOrEqual(0);
      const response = index === 0 ? await firstResponse : new Response(
        index === 5 ? new Uint8Array([0xff]) : vectors[index],
        { headers: {
          'content-type': 'text/html',
          ...(index === 6 ? { 'content-length': String(PAJA_RESOURCE_MAX_BYTES + 1) } : {}),
        } },
      );
      completed.push(index);
      return response;
    });
    vi.stubGlobal('fetch', fetchFn);
    const adapter = createPajaAdapter(
      CONFIG,
      () => normalizePajaSimulation({ relay: { mode: 'disabled' } }),
      () => {},
      () => {},
      () => true,
    );
    try {
      const sent: NappletMessage[] = [];
      // Keep installed per-resource hints; PR #80's URLs-only wire drift is out of scope.
      adapter.services?.resource?.handleMessage('resource-window', {
        type: 'resource.bytesMany', id: 'mixed-bulk',
        requests: urls.map((url) => ({ url, servers: ['https://blossom.example'] })),
      } as unknown as NappletMessage, (message) => sent.push(message));
      // The existing service fetches bulk items serially, not concurrently.
      await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledOnce());
      expect(completed).toHaveLength(0);
      expect(sent).toHaveLength(0);
      releaseFirst(new Response(vectors[0], { headers: { 'content-type': 'image/svg+xml' } }));
      await vi.waitFor(() => expect(sent).toHaveLength(1));
      expect(completed).toEqual(vectors.map((_bytes, index) => index));
      const result = sent[0] as NappletMessage & {
        items: { url: string; ok: boolean; blob?: Blob; mime?: string; error?: string }[];
      };
      expect(result).toMatchObject({ type: 'resource.bytesMany.result', id: 'mixed-bulk' });
      expect(result.items.map((item) => item.url)).toEqual(urls);
      const mimes = [
        'application/octet-stream', 'application/octet-stream',
        'application/vnd.nintendo.gb-rom', 'application/json',
      ];
      for (const [index, mime] of mimes.entries()) {
        const item = result.items[index];
        expect(item).toMatchObject({ ok: true, mime });
        expect(item?.blob?.type).toBe(mime);
        expect(new Uint8Array(await item!.blob!.arrayBuffer())).toEqual(vectors[index]);
      }
      for (const [offset, error] of ['decode-failed', 'decode-failed', 'too-large'].entries()) {
        const item = result.items[offset + mimes.length];
        expect(item).toMatchObject({ ok: false, error });
        expect(item).not.toHaveProperty('blob');
      }
      await flushPromises();
      expect(sent).toHaveLength(1);

      adapter.services?.resource?.handleMessage('resource-window', {
        type: 'resource.bytesMany', id: 'over-cap',
        requests: Array.from({ length: PAJA_RESOURCE_MAX_URLS + 1 }, () => ({ url: urls[0] })),
      } as unknown as NappletMessage, (message) => sent.push(message));
      await vi.waitFor(() => expect(sent).toHaveLength(2));
      expect(sent[1]).toMatchObject({ type: 'resource.bytesMany.error', id: 'over-cap', error: 'too-large' });
      expect(fetchFn).toHaveBeenCalledTimes(vectors.length);
    } finally {
      releaseFirst(new Response(vectors[0]));
      (adapter.relayPool.getRelayPool() as unknown as { close(): void }).close();
    }
  });

  it('resolves Blossom bytes from accepted request hints before configured defaults', async () => {
    const bytes = new TextEncoder().encode('{"from":"request-hint"}');
    const hash = await sha256Hex(bytes);
    const fetchFn = vi.fn(async () => new Response(bytes));
    const fetchResource = createPajaResourceFetch({
      getBlossomServers: () => ['https://default.example'],
      fetch: fetchFn,
    });

    const response = await fetchResource(`blossom:sha256:${hash}`, {
      signal: new AbortController().signal,
      servers: [
        'http://public.example',
        'https://localhost',
        'https://hint.example/',
        'https://HINT.example',
      ],
    });

    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn).toHaveBeenCalledWith(`https://hint.example/${hash}`, expect.objectContaining({
      redirect: 'error',
    }));
    expect(await response.text()).toBe('{"from":"request-hint"}');
  });

  it('awaits source-scoped event defaults for a canonical Blossom request', async () => {
    const bytes = new TextEncoder().encode('{"from":"publisher-list"}');
    const hash = await sha256Hex(bytes);
    const getBlossomServers = vi.fn(async () => ['https://publisher.example']);
    const fetchFn = vi.fn(async () => new Response(bytes));
    const fetchResource = createPajaResourceFetch({ getBlossomServers, fetch: fetchFn });

    const response = await fetchResource(`blossom:sha256:${hash}`, {
      signal: new AbortController().signal,
      windowId: 'rom-window',
    });

    expect(getBlossomServers).toHaveBeenCalledWith({
      url: `blossom:sha256:${hash}`,
      windowId: 'rom-window',
    });
    expect(fetchFn).toHaveBeenCalledWith(
      `https://publisher.example/${hash}`,
      expect.objectContaining({ redirect: 'error' }),
    );
    expect(await response.text()).toBe('{"from":"publisher-list"}');
  });

  it('caps request hints and reports an inconclusive fallback as network-error', async () => {
    const servers = Array.from(
      { length: PAJA_RESOURCE_MAX_SERVERS + 2 },
      (_, index) => `https://hint-${index}.example`,
    );
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockRejectedValue(new TypeError('transport failed'));
    const fetchResource = createPajaResourceFetch({
      getBlossomServers: () => ['https://default.example'],
      fetch: fetchFn,
    });

    await expect(fetchResource(`blossom:sha256:${'d'.repeat(64)}`, {
      signal: new AbortController().signal,
      servers,
    })).rejects.toMatchObject({ code: 'network-error' });

    expect(fetchFn).toHaveBeenCalledTimes(PAJA_RESOURCE_MAX_SERVERS);
    expect(fetchFn).not.toHaveBeenCalledWith(
      `https://default.example/${'d'.repeat(64)}`,
      expect.anything(),
    );
  });

  it('classifies decoded bytes instead of trusting the declared media type', async () => {
    const fetchResource = createPajaResourceFetch();
    const response = await fetchResource(
      'data:image/png,%7B%22actual%22%3A%22json%22%7D',
      { signal: new AbortController().signal },
    );

    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.text()).toBe('{"actual":"json"}');
  });

  it('fetches canonical Blossom bytes from HTTPS or loopback HTTP servers and verifies the hash', async () => {
    const bytes = new TextEncoder().encode('{"from":"blossom"}');
    const hash = await sha256Hex(bytes);
    const fetchFn = vi.fn()
      .mockRejectedValueOnce(new TypeError('first server unavailable'))
      .mockResolvedValueOnce(new Response(bytes, { headers: { 'content-type': 'image/svg+xml' } }));
    const fetchResource = createPajaResourceFetch({
      getBlossomServers: () => ['https://one.example/', 'http://localhost:3000'],
      fetch: fetchFn,
    });

    const response = await fetchResource(`blossom:sha256:${hash}`, {
      method: 'GET',
      signal: new AbortController().signal,
    });

    expect(fetchFn).toHaveBeenNthCalledWith(1, `https://one.example/${hash}`, expect.objectContaining({
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
    }));
    expect(fetchFn).toHaveBeenNthCalledWith(2, `http://localhost:3000/${hash}`, expect.objectContaining({
      method: 'GET',
      redirect: 'error',
    }));
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  it('classifies a checksum-valid Game Boy ROM from its canonical header bytes', async () => {
    const bytes = gameBoyRomVector();
    const hash = await sha256Hex(bytes);
    const fetchResource = createPajaResourceFetch({
      getBlossomServers: () => ['https://roms.example'],
      fetch: vi.fn(async () => new Response(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        {
          headers: { 'content-type': 'text/html' },
        },
      )),
    });

    const response = await fetchResource(`blossom:sha256:${hash}`, {
      signal: new AbortController().signal,
    });

    expect(response.headers.get('content-type')).toBe('application/vnd.nintendo.gb-rom');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  it('resolves arbitrary HTTP(S) origins through the browser and classifies returned bytes', async () => {
    const fetchFn = vi.fn(async () => new Response('{"network":true}', {
      headers: { 'content-type': 'image/svg+xml' },
    }));
    const fetchResource = createPajaResourceFetch({ fetch: fetchFn });
    const signal = new AbortController().signal;

    const httpsResponse = await fetchResource('https://media.example/avatar', { signal });
    const httpResponse = await fetchResource('http://localhost:3000/avatar', { signal });

    expect(fetchFn).toHaveBeenNthCalledWith(1, 'https://media.example/avatar', expect.objectContaining({
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    }));
    expect(fetchFn).toHaveBeenNthCalledWith(2, 'http://localhost:3000/avatar', expect.any(Object));
    expect(httpsResponse.headers.get('content-type')).toBe('application/json');
    expect(httpResponse.headers.get('content-type')).toBe('application/json');
  });

  it('maps browser CORS rejection to the canonical network error', async () => {
    const fetchResource = createPajaResourceFetch({
      fetch: vi.fn(async () => { throw new TypeError('Failed to fetch'); }),
    });

    await expect(fetchResource('https://media.example/avatar', {
      signal: new AbortController().signal,
    })).rejects.toMatchObject({ code: 'network-error', message: 'Failed to fetch' });
  });

  it('rejects malformed identifiers, hash mismatches, oversize responses, raw SVG, and unknown schemes', async () => {
    const fetchResource = createPajaResourceFetch();
    const signal = new AbortController().signal;

    await expect(fetchResource('data:image/svg+xml,%3Csvg%3E%3C/svg%3E', { signal }))
      .rejects.toMatchObject({ code: 'decode-failed' });
    await expect(fetchResource('ftp://example.com/image.png', { signal }))
      .rejects.toMatchObject({ code: 'unsupported-scheme' });

    const blossomFetch = createPajaResourceFetch({
      getBlossomServers: () => ['https://blossom.example'],
      fetch: vi.fn(async () => new Response('wrong bytes')),
    });
    await expect(blossomFetch('blossom:sha256:not-a-hash', { signal }))
      .rejects.toMatchObject({ code: 'invalid-request' });
    await expect(blossomFetch(`blossom:sha256:${'a'.repeat(64)}`, { signal }))
      .rejects.toMatchObject({ code: 'decode-failed' });

    const oversizeFetch = createPajaResourceFetch({
      getBlossomServers: () => ['https://blossom.example'],
      fetch: vi.fn(async () => new Response('', {
        headers: { 'content-length': String(PAJA_RESOURCE_MAX_BYTES + 1) },
      })),
    });
    await expect(oversizeFetch(`blossom:sha256:${'b'.repeat(64)}`, { signal }))
      .rejects.toMatchObject({ code: 'too-large' });

    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const svgHash = await sha256Hex(svg);
    const svgFetch = createPajaResourceFetch({
      getBlossomServers: () => ['https://blossom.example'],
      fetch: vi.fn(async () => new Response(svg)),
    });
    await expect(svgFetch(`blossom:sha256:${svgHash}`, { signal }))
      .rejects.toMatchObject({ code: 'decode-failed' });
  });

  it('maps missing Blossom blobs and preserves cancellation', async () => {
    const fetchResource = createPajaResourceFetch({
      getBlossomServers: () => ['https://blossom.example'],
      fetch: vi.fn(async () => new Response(null, { status: 404 })),
    });
    const signal = new AbortController().signal;
    await expect(fetchResource(`blossom:sha256:${'c'.repeat(64)}`, { signal }))
      .rejects.toMatchObject({ code: 'not-found' });

    const controller = new AbortController();
    controller.abort();
    await expect(fetchResource(`blossom:sha256:${'c'.repeat(64)}`, { signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
  });

  it('routes data and arbitrary HTTPS bytes through the service', async () => {
    const adapter = createPajaAdapter(
      CONFIG,
      () => normalizePajaSimulation({ relay: { mode: 'disabled' } }),
      () => {},
      () => {},
      () => true,
    );
    const service = adapter.services?.resource;
    expect(service?.descriptor.name).toBe('resource');

    const sent: NappletMessage[] = [];
    service?.handleMessage('resource-window', {
      type: 'resource.bytes',
      id: 'data-1',
      url: 'data:text/html,hello%20world',
    } as NappletMessage, (message) => sent.push(message));
    await flushPromises();

    const result = sent[0] as NappletMessage & { blob: Blob; mime: string };
    expect(result).toMatchObject({
      type: 'resource.bytes.result',
      id: 'data-1',
      mime: 'text/plain',
    });
    expect(await result.blob.text()).toBe('hello world');

    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"remote":true}', {
      headers: { 'content-type': 'text/html' },
    })));
    service?.handleMessage('resource-window', {
      type: 'resource.bytes',
      id: 'https-1',
      url: 'https://example.com/tracker.png',
    } as NappletMessage, (message) => sent.push(message));
    await flushPromises();
    const httpsResult = sent[1] as NappletMessage & { blob: Blob; mime: string };
    expect(httpsResult).toMatchObject({
      type: 'resource.bytes.result',
      id: 'https-1',
      mime: 'application/json',
    });
    expect(await httpsResult.blob.text()).toBe('{"remote":true}');

    (adapter.relayPool.getRelayPool() as unknown as { close(): void }).close();
  });

  it('routes a napplet-provided Blossom server hint through the service without a host default', async () => {
    const bytes = new TextEncoder().encode('hello from blossom');
    const hash = await sha256Hex(bytes);
    const fetchFn = vi.fn(async () => new Response(bytes));
    vi.stubGlobal('fetch', fetchFn);
    const adapter = createPajaAdapter(
      CONFIG,
      () => normalizePajaSimulation({ relay: { mode: 'disabled' } }),
      () => {},
      () => {},
      () => true,
    );
    const service = adapter.services?.resource;
    const sent: NappletMessage[] = [];

    service?.handleMessage('resource-window', {
      type: 'resource.bytes',
      id: 'blossom-1',
      url: `blossom:sha256:${hash}`,
      servers: ['https://blossom.example'],
    } as NappletMessage, (message) => sent.push(message));
    await flushPromises();

    const result = sent[0] as NappletMessage & { blob: Blob; mime: string };
    expect(result).toMatchObject({
      type: 'resource.bytes.result',
      id: 'blossom-1',
      mime: 'text/plain',
    });
    expect(await result.blob.text()).toBe('hello from blossom');
    expect(fetchFn).toHaveBeenCalledWith(`https://blossom.example/${hash}`, expect.objectContaining({
      redirect: 'error',
    }));

    (adapter.relayPool.getRelayPool() as unknown as { close(): void }).close();
  });
});
