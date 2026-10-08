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
  it.each(['blossom:', 'blossom:sha256:'])('validates %s URI syntax and sz before I/O', async (prefix) => {
    const fetchFn = vi.fn();
    const getBlossomServers = vi.fn();
    const read = createPajaResourceFetch({ fetch: fetchFn, getBlossomServers });
    const hash = 'a'.repeat(64);
    const signal = new AbortController().signal;
    for (const suffix of [
      '.png/other', '.png\\other', '.png.jpg', '.%2f', '.png%5cother', '.png#',
      '?sz=', '?sz=0', '?sz=-1', '?sz=%2B1', '?sz=1.5', '?sz=1e3',
      '?sz=9007199254740992', '?sz=1&sz=1', '?as=bad', '?xs=%zz', '?unknown=%FF',
      '?xs=bad host', `?xs=${'x'.repeat(8192)}`, '?sz=1%00',
    ]) {
      await expect(read(`${prefix}${hash}${suffix}`, { signal })).rejects.toMatchObject({ code: 'invalid-request' });
    }
    await expect(read(`${prefix}${hash}?sz=${PAJA_RESOURCE_MAX_BYTES + 1}`, { signal }))
      .rejects.toMatchObject({ code: 'too-large' });
    expect(getBlossomServers).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('cancels a size-mismatched header and falls back without trusting extension or MIME', async () => {
    const bytes = new TextEncoder().encode('{"size":"verified"}');
    const hash = await sha256Hex(bytes);
    const cancel = vi.fn();
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), {
        headers: { 'content-length': String(bytes.length + 1) },
      }))
      .mockResolvedValueOnce(new Response(bytes, { headers: { 'content-type': 'image/png' } }));
    const read = createPajaResourceFetch({ fetch: fetchFn });
    const response = await read(`blossom:${hash}.png?xs=one.example&xs=two.example&sz=${bytes.length}`, {
      signal: new AbortController().signal,
    });
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetchFn.mock.calls.map(([url]) => url)).toEqual([
      `https://one.example/${hash}.png`, `https://two.example/${hash}.png`,
    ]);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.text()).toBe('{"size":"verified"}');
  });

  it.each([undefined, 'invalid'])('rejects actual size mismatch when Content-Length is %s', async (length) => {
    const bytes = new TextEncoder().encode('exact bytes');
    const hash = await sha256Hex(bytes);
    const read = createPajaResourceFetch({
      fetch: vi.fn(async () => new Response(bytes, { headers: length ? { 'content-length': length } : {} })),
    });
    await expect(read(`blossom:${hash}.txt?xs=cdn.example&sz=${bytes.length + 1}`, {
      signal: new AbortController().signal,
    })).rejects.toMatchObject({ code: 'decode-failed' });
  });

  it('never upgrades unsafe URI hints into trusted loopback config', async () => {
    const bytes = new TextEncoder().encode('public policy');
    const hash = await sha256Hex(bytes);
    const fetchFn = vi.fn(async () => new Response(bytes));
    const read = createPajaResourceFetch({ fetch: fetchFn });
    const hints = ['http://public.example', 'http://localhost:3000', 'https://127.0.0.1',
      'https://user:pass@cdn.example', 'https://cdn.example/path', 'https://cdn.example?key=value'];
    await expect(read(`blossom:${hash}.txt?${hints.map((hint) => `xs=${encodeURIComponent(hint)}`).join('&')}`, {
      signal: new AbortController().signal,
    })).rejects.toMatchObject({ code: 'blocked-by-policy' });
    expect(fetchFn).not.toHaveBeenCalled();
    const trusted = createPajaResourceFetch({ fetch: fetchFn, getBlossomServers: () => ['http://localhost:3000'] });
    await trusted(`blossom:${hash}.txt?xs=http://localhost:3000`, { signal: new AbortController().signal });
    expect(fetchFn).toHaveBeenCalledWith(`http://localhost:3000/${hash}.txt`, expect.anything());
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

  it.each(['blossom:', 'blossom:sha256:'])('resolves %s bytes from accepted request hints before configured defaults', async (prefix) => {
    const bytes = new TextEncoder().encode('{"from":"request-hint"}');
    const hash = await sha256Hex(bytes);
    const fetchFn = vi.fn(async () => new Response(bytes));
    const fetchResource = createPajaResourceFetch({
      getBlossomServers: () => ['https://default.example'],
      fetch: fetchFn,
    });

    const response = await fetchResource(`${prefix}${hash}`, {
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

  it.each(['blossom:', 'blossom:sha256:'])('awaits source-scoped event defaults for a %s request', async (prefix) => {
    const bytes = new TextEncoder().encode('{"from":"publisher-list"}');
    const hash = await sha256Hex(bytes);
    const getBlossomServers = vi.fn(async () => ['https://publisher.example']);
    const fetchFn = vi.fn(async () => new Response(bytes));
    const fetchResource = createPajaResourceFetch({ getBlossomServers, fetch: fetchFn });

    const response = await fetchResource(`${prefix}${hash}`, {
      signal: new AbortController().signal,
      windowId: 'rom-window',
    });

    expect(getBlossomServers).toHaveBeenCalledWith({
      url: `${prefix}${hash}`,
      windowId: 'rom-window',
    });
    expect(fetchFn).toHaveBeenCalledWith(
      `https://publisher.example/${hash}`,
      expect.objectContaining({ redirect: 'error' }),
    );
    expect(await response.text()).toBe('{"from":"publisher-list"}');
  });

  it.each(['blossom:', 'blossom:sha256:'])('caps %s request hints and reports an inconclusive fallback as network-error', async (prefix) => {
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

    await expect(fetchResource(`${prefix}${'d'.repeat(64)}`, {
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

  it.each(['blossom:', 'blossom:sha256:'])('fetches %s bytes from HTTPS or loopback HTTP servers and verifies the hash', async (prefix) => {
    const bytes = new TextEncoder().encode('{"from":"blossom"}');
    const hash = await sha256Hex(bytes);
    const fetchFn = vi.fn()
      .mockRejectedValueOnce(new TypeError('first server unavailable'))
      .mockResolvedValueOnce(new Response(bytes, { headers: { 'content-type': 'image/svg+xml' } }));
    const fetchResource = createPajaResourceFetch({
      getBlossomServers: () => ['https://one.example/', 'http://localhost:3000'],
      fetch: fetchFn,
    });

    const mixedCaseHash = hash.replace(/[a-f]/g, (letter, index) => index % 2 ? letter.toUpperCase() : letter);
    const response = await fetchResource(`${prefix}${mixedCaseHash}`, {
      method: 'GET',
      signal: new AbortController().signal,
    });

    expect(fetchFn).toHaveBeenNthCalledWith(1, `https://one.example/${hash}`, expect.objectContaining({
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
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

  it.each(['blossom:', 'blossom:sha256:'])('rejects malformed %s identifiers, hash mismatches, oversize responses, raw SVG, and unknown schemes', async (prefix) => {
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
    await expect(blossomFetch(`${prefix}not-a-hash`, { signal }))
      .rejects.toMatchObject({ code: 'invalid-request' });
    await expect(blossomFetch(`${prefix}${'a'.repeat(64)}`, { signal }))
      .rejects.toMatchObject({ code: 'decode-failed' });

    const oversizeFetch = createPajaResourceFetch({
      getBlossomServers: () => ['https://blossom.example'],
      fetch: vi.fn(async () => new Response('', {
        headers: { 'content-length': String(PAJA_RESOURCE_MAX_BYTES + 1) },
      })),
    });
    await expect(oversizeFetch(`${prefix}${'b'.repeat(64)}`, { signal }))
      .rejects.toMatchObject({ code: 'too-large' });

    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const svgHash = await sha256Hex(svg);
    const svgFetch = createPajaResourceFetch({
      getBlossomServers: () => ['https://blossom.example'],
      fetch: vi.fn(async () => new Response(svg)),
    });
    await expect(svgFetch(`${prefix}${svgHash}`, { signal }))
      .rejects.toMatchObject({ code: 'decode-failed' });
  });

  it.each(['blossom:', 'blossom:sha256:'])('maps missing %s blobs and preserves cancellation', async (prefix) => {
    const fetchResource = createPajaResourceFetch({
      getBlossomServers: () => ['https://blossom.example'],
      fetch: vi.fn(async () => new Response(null, { status: 404 })),
    });
    const signal = new AbortController().signal;
    await expect(fetchResource(`${prefix}${'c'.repeat(64)}`, { signal }))
      .rejects.toMatchObject({ code: 'not-found' });

    const controller = new AbortController();
    controller.abort();
    await expect(fetchResource(`${prefix}${'c'.repeat(64)}`, { signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
  });

  it.each(['blossom:', 'blossom:sha256:'])('rejects malformed %s hashes and suffixes before discovery or fetch', async (prefix) => {
    const fetchFn = vi.fn();
    const getBlossomServers = vi.fn();
    const fetchResource = createPajaResourceFetch({ fetch: fetchFn, getBlossomServers });
    const signal = new AbortController().signal;
    const hash = 'a'.repeat(64);
    for (const identifier of [
      'a'.repeat(63), 'a'.repeat(65), `${'a'.repeat(63)}g`,
      `sha512:${hash}`, `${hash}.`, `${hash}.png/other`, `${hash}#fragment`,
    ]) {
      await expect(fetchResource(`${prefix}${identifier}`, { signal }))
        .rejects.toMatchObject({ code: 'invalid-request' });
    }
    expect(getBlossomServers).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each(['blossom:', 'blossom:sha256:'])('caps streamed %s bytes without a declared size', async (prefix) => {
    const fetchResource = createPajaResourceFetch({
      getBlossomServers: () => ['https://blossom.example'],
      fetch: vi.fn(async () => new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(PAJA_RESOURCE_MAX_BYTES));
          controller.enqueue(new Uint8Array(1));
          controller.close();
        },
      }))),
    });
    await expect(fetchResource(`${prefix}${'a'.repeat(64)}`, {
      signal: new AbortController().signal,
    })).rejects.toMatchObject({ code: 'too-large' });
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

  it.each(['blossom:', 'blossom:sha256:'])('routes a %s server hint through the service without a host default', async (prefix) => {
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
      url: `${prefix}${hash}`,
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
