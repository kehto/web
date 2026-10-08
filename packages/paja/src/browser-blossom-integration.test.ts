import type { NappletMessage, NostrEvent } from '@napplet/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

const outboxQuery = vi.hoisted(() => vi.fn());

vi.mock('@kehto/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@kehto/services')>();
  return {
    ...actual,
    createRelayPoolOutboxRouter: () => ({
      query: (...args: unknown[]) => outboxQuery(...args),
      subscribe: () => ({ close() {} }),
      publish: async () => ({ ok: true }),
      resolveRelays: async () => ({ relays: [], source: 'fallback' }),
    }),
  };
});

import { createPajaAdapter } from './browser-adapter.js';
import type { PajaHostConfig } from './options.js';
import { normalizePajaSimulation } from './simulation.js';

const PUBLISHER = 'a'.repeat(64);
const SHELL_SIGNER = 'b'.repeat(64);
const HASH = '10781f7ca417dd1d0a3de2e664d65c5c1dfefb86f3d355cf493739f6c404ad58';
const RESOURCE_URL = `blossom:sha256:${HASH}`;
const CONFIG = {
  window: { id: 'rom-window', dTag: 'gbcolor', aggregateHash: 'gbcolor-hash' },
} as PajaHostConfig;

function event(
  id: string,
  kind: number,
  tags: string[][],
  content = '',
  pubkey = PUBLISHER,
): NostrEvent {
  return {
    id: id.repeat(64).slice(0, 64),
    pubkey,
    kind,
    tags,
    content,
    created_at: 1,
    sig: 'c'.repeat(128),
  };
}

afterEach(() => {
  outboxQuery.mockReset();
  vi.unstubAllGlobals();
});

describe('Paja OUTBOX-to-RESOURCE Blossom wiring', () => {
  it.each(['blossom:', 'blossom:sha256:'])('falls through repeated %s URI xs to requested author lists without OUTBOX observation', async (prefix) => {
    const bytes = new TextEncoder().encode('request author fixture');
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
    outboxQuery.mockImplementation(async (filters: Array<{ authors?: string[] }>) => ({
      events: [{ event: event('1', 10_063, [['server', filters[0]?.authors?.[0] === PUBLISHER
        ? 'https://author-one.example' : 'https://author-two.example']], '', filters[0]?.authors?.[0]) }],
    }));
    const fetcher = vi.fn(async (url: string) => url.startsWith('https://author-two.example/')
      ? new Response(bytes) : new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetcher);
    const adapter = createPajaAdapter(CONFIG,
      () => normalizePajaSimulation({ relay: { mode: 'live' }, upload: { mode: 'memory', servers: [], discoverServers: false } }),
      () => {}, () => {}, () => true);
    try {
      const sent: NappletMessage[] = [];
      adapter.services?.resource?.handleMessage('rom-window', {
        type: 'resource.bytes', id: 'author-uri',
        url: `${prefix}${hash}.gbc?xs=one.example&xs=two.example&as=${PUBLISHER}&as=${SHELL_SIGNER}&sz=${bytes.length}`,
      } as NappletMessage, (message) => sent.push(message));
      await vi.waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]).toMatchObject({ type: 'resource.bytes.result', id: 'author-uri', mime: 'text/plain' });
      expect(await (sent[0] as NappletMessage & { blob: Blob }).blob.text()).toBe('request author fixture');
      expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
        `https://one.example/${hash}.gbc`, `https://two.example/${hash}.gbc`,
        `https://author-one.example/${hash}.gbc`, `https://author-two.example/${hash}.gbc`,
      ]);
      expect(outboxQuery).toHaveBeenCalledTimes(2);
    } finally {
      (adapter.relayPool.getRelayPool() as unknown as { close(): void }).close();
    }
  });

  it.each(['blossom:', 'blossom:sha256:'])('reads an extension-bearing %s URI with xs and exact sz without an observed event', async (prefix) => {
    const bytes = new TextEncoder().encode('{"fixture":"BUD-10"}');
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const fetcher = vi.fn(async () => new Response(bytes, {
      headers: { 'content-type': 'image/png', 'content-length': String(bytes.length) },
    }));
    vi.stubGlobal('fetch', fetcher);
    const adapter = createPajaAdapter(CONFIG,
      () => normalizePajaSimulation({ relay: { mode: 'disabled' } }),
      () => {}, () => {}, () => true);
    try {
      const sent: NappletMessage[] = [];
      adapter.services?.resource?.handleMessage('rom-window', {
        type: 'resource.bytes', id: 'uri-bytes',
        url: `${prefix}${hash.toUpperCase()}.gbc?xs=cdn.example&sz=${bytes.length}`,
      } as NappletMessage, (message) => sent.push(message));
      await vi.waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]).toMatchObject({ type: 'resource.bytes.result', id: 'uri-bytes', mime: 'application/json' });
      expect(await (sent[0] as NappletMessage & { blob: Blob }).blob.text()).toBe('{"fixture":"BUD-10"}');
      expect(fetcher).toHaveBeenCalledWith(`https://cdn.example/${hash}.gbc`, expect.objectContaining({ redirect: 'error' }));
    } finally {
      (adapter.relayPool.getRelayPool() as unknown as { close(): void }).close();
    }
  });

  it.each(['blossom:', 'blossom:sha256:'])('uses event hints before the event publisher list with upload disabled (%s)', async (prefix) => {
    const bytes = new TextEncoder().encode('publisher ROM bytes');
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const rom = event('1', 32_560, [
      ['resource', `blossom:${hash}.gbc?xs=event.example`, 'blossom'],
    ]);
    const serverList = event('2', 10_063, [
      ['server', 'https://publisher.example'],
    ]);
    outboxQuery.mockImplementation(async (filters: Array<{ kinds?: number[] }>) => ({
      events: filters[0]?.kinds?.includes(10_063)
        ? [{ event: serverList }]
        : [{ event: rom }],
    }));

    const fetcher = vi.fn(async (url: string) => url.startsWith('https://event.example/')
      ? new Response(null, { status: 404 })
      : new Response(bytes));
    vi.stubGlobal('fetch', fetcher);

    const adapter = createPajaAdapter(
      CONFIG,
      () => normalizePajaSimulation({
        relay: { mode: 'live' },
        upload: { mode: 'memory', servers: [], discoverServers: false },
      }),
      () => {},
      () => {},
      () => true,
    );
    const outbox = adapter.services?.outbox;
    const outboxMessages: NappletMessage[] = [];
    outbox?.handleMessage('rom-window', {
      type: 'outbox.query',
      id: 'rom-query',
      filters: [{ kinds: [32_560], authors: [PUBLISHER] }],
    } as NappletMessage, (message) => outboxMessages.push(message));
    await vi.waitFor(() => expect(outboxMessages).toHaveLength(1));

    const resource = adapter.services?.resource;
    const resourceMessages: NappletMessage[] = [];
    resource?.handleMessage('rom-window', {
      type: 'resource.bytes',
      id: 'rom-bytes',
      url: `${prefix}${hash}`,
    } as NappletMessage, (message) => resourceMessages.push(message));
    await vi.waitFor(() => expect(resourceMessages).toHaveLength(1));

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      `https://event.example/${hash}`,
      expect.objectContaining({ redirect: 'error' }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      `https://publisher.example/${hash}`,
      expect.objectContaining({ redirect: 'error' }),
    );
    const result = resourceMessages[0] as NappletMessage & { blob: Blob };
    expect(result).toMatchObject({ type: 'resource.bytes.result', id: 'rom-bytes' });
    expect(await result.blob.text()).toBe('publisher ROM bytes');

    expect(outboxQuery).toHaveBeenCalledWith(
      [{ kinds: [10_063], authors: [PUBLISHER], limit: 1 }],
      { authors: [PUBLISHER], limit: 1 },
    );
    expect(adapter.upload).toBeUndefined();
    (adapter.relayPool.getRelayPool() as unknown as { close(): void }).close();
  });

  it('falls through request, ROM, publisher, user, and runtime candidates in order', async () => {
    const rom = event('3', 32_560, [
      ['resource', `blossom:${HASH}.gbc?xs=event.example`, 'blossom'],
    ]);
    const serverList = event('4', 10_063, [
      ['server', 'https://publisher.example'],
    ]);
    const userServerList = event('5', 10_063, [
      ['server', 'https://user-list.example'],
    ], '', SHELL_SIGNER);
    outboxQuery.mockImplementation(async (filters: Array<{ kinds?: number[]; authors?: string[] }>) => {
      if (!filters[0]?.kinds?.includes(10_063)) return { events: [{ event: rom }] };
      return {
        events: filters[0]?.authors?.[0] === SHELL_SIGNER
          ? [{ event: userServerList }]
          : [{ event: serverList }],
      };
    });

    const bytes = new TextEncoder().encode('publisher ROM bytes');
    const fetcher = vi.fn(async (url: string) => url.startsWith('https://runtime.example/')
      ? new Response(bytes)
      : new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetcher);

    const adapter = createPajaAdapter(
      CONFIG,
      () => normalizePajaSimulation({
        identity: { mode: 'fixed', pubkey: SHELL_SIGNER },
        relay: { mode: 'live' },
        upload: {
          mode: 'memory',
          servers: ['https://runtime.example'],
          discoverServers: false,
        },
      }),
      () => {},
      () => {},
      () => true,
    );
    adapter.setWindowBlossomServers('rom-window', ['https://pointer.example']);
    const outboxMessages: NappletMessage[] = [];
    adapter.services?.outbox?.handleMessage('rom-window', {
      type: 'outbox.query',
      id: 'rom-query-all-tiers',
      filters: [{ kinds: [32_560], authors: [PUBLISHER] }],
    } as NappletMessage, (message) => outboxMessages.push(message));
    await vi.waitFor(() => expect(outboxMessages).toHaveLength(1));

    const resourceMessages: NappletMessage[] = [];
    adapter.services?.resource?.handleMessage('rom-window', {
      type: 'resource.bytes',
      id: 'rom-bytes-all-tiers',
      url: RESOURCE_URL,
      servers: ['https://request.example'],
    } as NappletMessage, (message) => resourceMessages.push(message));
    await vi.waitFor(() => expect(resourceMessages).toHaveLength(1));

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      `https://request.example/${HASH}`,
      `https://event.example/${HASH}`,
      `https://publisher.example/${HASH}`,
      `https://user-list.example/${HASH}`,
      `https://pointer.example/${HASH}`,
      `https://runtime.example/${HASH}`,
    ]);
    const result = resourceMessages[0] as NappletMessage & { blob: Blob };
    expect(result).toMatchObject({
      type: 'resource.bytes.result',
      id: 'rom-bytes-all-tiers',
    });
    expect(await result.blob.text()).toBe('publisher ROM bytes');
    expect(adapter.upload).toBeUndefined();
    (adapter.relayPool.getRelayPool() as unknown as { close(): void }).close();
  });

  it('uses verified pointer servers anonymously when the ROM and publisher have no hints', async () => {
    const rom = event('6', 32_560, [
      ['resource', RESOURCE_URL, 'blossom'],
    ]);
    outboxQuery.mockImplementation(async (filters: Array<{ kinds?: number[] }>) => ({
      events: filters[0]?.kinds?.includes(10_063) ? [] : [{ event: rom }],
    }));

    const bytes = new TextEncoder().encode('publisher ROM bytes');
    const fetcher = vi.fn(async (url: string) => url.startsWith('https://pointer.example/')
      ? new Response(bytes)
      : new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetcher);

    const adapter = createPajaAdapter(
      CONFIG,
      () => normalizePajaSimulation({
        relay: { mode: 'live' },
        upload: { mode: 'memory', servers: [], discoverServers: false },
      }),
      () => {},
      () => {},
      () => true,
    );
    adapter.setWindowBlossomServers('rom-window', ['https://pointer.example']);

    const outboxMessages: NappletMessage[] = [];
    adapter.services?.outbox?.handleMessage('rom-window', {
      type: 'outbox.query',
      id: 'anonymous-rom-query',
      filters: [{ kinds: [32_560] }],
    } as NappletMessage, (message) => outboxMessages.push(message));
    await vi.waitFor(() => expect(outboxMessages).toHaveLength(1));

    const resourceMessages: NappletMessage[] = [];
    adapter.services?.resource?.handleMessage('rom-window', {
      type: 'resource.bytes',
      id: 'anonymous-rom-bytes',
      url: RESOURCE_URL,
    } as NappletMessage, (message) => resourceMessages.push(message));
    await vi.waitFor(() => expect(resourceMessages).toHaveLength(1));

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      `https://pointer.example/${HASH}`,
    ]);
    const result = resourceMessages[0] as NappletMessage & { blob: Blob };
    expect(result).toMatchObject({
      type: 'resource.bytes.result',
      id: 'anonymous-rom-bytes',
    });
    expect(await result.blob.text()).toBe('publisher ROM bytes');
    expect(adapter.upload).toBeUndefined();
    (adapter.relayPool.getRelayPool() as unknown as { close(): void }).close();
  });
});
