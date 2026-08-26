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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Paja resource backend', () => {
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
