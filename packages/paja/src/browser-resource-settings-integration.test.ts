import type { NappletMessage } from '@napplet/core';
import { afterEach, expect, it, vi } from 'vitest';
import { createPajaAdapter } from './browser-adapter.js';
import { createPajaRuntimeHostConfig } from './options.js';
import { normalizePajaSimulation } from './simulation.js';
import { createPajaResourceSettings } from './browser-resource-settings.js';

afterEach(() => vi.unstubAllGlobals());

it('uses live extra servers after existing defaults across windows and clears only extras', async () => {
  const bytes = new TextEncoder().encode('verified extra server bytes');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const settings = createPajaResourceSettings(() => { throw new Error('Storage blocked'); });
  expect(settings.save('extra.example')).toMatchObject({ ok: true, message: expect.stringContaining('session-only') });
  const fetchFn = vi.fn(async (url: string) => url.startsWith(settings.getServers()[0] ?? 'https://absent.example')
    ? new Response(bytes) : new Response(null, { status: 404 }));
  vi.stubGlobal('fetch', fetchFn);
  const simulation = normalizePajaSimulation({ relay: { mode: 'disabled' }, upload: { servers: ['https://default.example'] } });
  const config = createPajaRuntimeHostConfig({ blossomServers: ['https://pointer.example'] });
  const adapter = createPajaAdapter(config, () => simulation, () => {}, () => {}, () => true,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, settings.getServers);
  adapter.setWindowBlossomServers('one', ['https://window-one.example']);
  adapter.setWindowBlossomServers('two', ['https://window-two.example']);
  const read = (windowId: string, id: string) => new Promise<NappletMessage & { blob: Blob }>((resolve) => {
    adapter.services!.resource!.handleMessage(windowId, {
      type: 'resource.bytes', id, url: `blossom:sha256:${hash}`, servers: ['https://request.example'],
    } as NappletMessage, (message) => resolve(message as NappletMessage & { blob: Blob }));
  });
  try {
    for (const windowId of ['one', 'two']) {
      fetchFn.mockClear();
      const result = await read(windowId, windowId);
      expect(result).toMatchObject({ type: 'resource.bytes.result', id: windowId });
      expect(await result.blob.text()).toBe('verified extra server bytes');
      expect(fetchFn.mock.calls.map(([url]) => url)).toEqual([
        'https://request.example', `https://window-${windowId}.example`,
        'https://pointer.example', 'https://default.example', 'https://extra.example',
      ].map((origin) => `${origin}/${hash}`));
    }
    settings.save('replacement.example');
    for (const windowId of ['one', 'two']) {
      expect(await read(windowId, `replace-${windowId}`)).toMatchObject({ type: 'resource.bytes.result' });
      expect(fetchFn).toHaveBeenLastCalledWith(`https://replacement.example/${hash}`, expect.anything());
    }
    settings.save('');
    fetchFn.mockClear();
    expect(await read('two', 'clear')).toMatchObject({ type: 'resource.bytes.error', error: 'not-found' });
    expect(fetchFn.mock.calls.map(([url]) => url)).toEqual([
      'https://request.example', 'https://window-two.example', 'https://pointer.example', 'https://default.example',
    ].map((origin) => `${origin}/${hash}`));
    expect(simulation.upload.servers).toEqual(['https://default.example']);
    expect(config.target.pointer?.blossomServers).toEqual(['https://pointer.example']);
    settings.save(Array.from({ length: 10 }, (_, index) => `extra-${index}.example`).join('\n'));
    fetchFn.mockClear();
    expect(await read('one', 'capped')).toMatchObject({ type: 'resource.bytes.result' });
    // A failed candidate cannot extend the existing combined eight-server budget.
    fetchFn.mockImplementation(async () => new Response(null, { status: 404 }));
    fetchFn.mockClear();
    expect(await read('one', 'all-miss')).toMatchObject({ type: 'resource.bytes.error' });
    expect(fetchFn).toHaveBeenCalledTimes(8);
    expect(fetchFn.mock.calls.at(-1)?.[0]).toBe(`https://extra-3.example/${hash}`);
    fetchFn.mockClear();
    fetchFn.mockResolvedValueOnce(new Response(bytes));
    const direct = await new Promise<NappletMessage & { blob: Blob }>((resolve) => {
      adapter.services!.resource!.handleMessage('one', {
        type: 'resource.bytes', id: 'direct', url: 'https://direct.example/file',
      } as NappletMessage, (message) => resolve(message as NappletMessage & { blob: Blob }));
    });
    expect(await direct.blob.text()).toBe('verified extra server bytes');
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn).toHaveBeenCalledWith('https://direct.example/file', expect.anything());
  } finally {
    (adapter.relayPool.getRelayPool() as unknown as { close(): void }).close();
  }
});
