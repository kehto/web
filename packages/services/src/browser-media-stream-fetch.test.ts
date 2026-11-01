import { describe, expect, it, vi } from 'vitest';
import { createBrowserMediaStreamFetch } from './browser-media-stream-fetch.js';
import { createResourceService } from './resource-service.js';

describe('host-only live audio resolution', () => {
  it('starts from split MP3 bytes without EOF and cancels its upstream reader', async () => {
    const cancel = vi.fn();
    const fetcher = vi.fn(async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array([0xff])); controller.enqueue(new Uint8Array([0xfb, 0x90, 0x64])); }, cancel,
    }), { headers: { 'content-type': 'text/html' } }));
    const signal = new AbortController().signal;
    const response = await createBrowserMediaStreamFetch(fetcher)('https://radio.example/stream', { signal });
    expect(response.headers.get('content-type')).toBe('audio/mpeg');
    expect(fetcher).toHaveBeenCalledWith('https://radio.example/stream', expect.objectContaining({ signal, redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer' }));
    const reader = response.body!.getReader();
    expect((await reader.read()).value).toEqual(new Uint8Array([0xff]));
    await reader.cancel();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('ignores MIME hints and cancels non-audio responses', async () => {
    const cancel = vi.fn();
    const fetcher = vi.fn(async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('<html>not audio')); }, cancel,
    }), { headers: { 'content-type': 'audio/mpeg' } }));
    await expect(createBrowserMediaStreamFetch(fetcher)('https://radio.example/stream', { signal: new AbortController().signal })).rejects.toThrow('unsupported live audio bytes');
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('rejects local, credentialed and non-HTTPS sources before network access', async () => {
    const fetcher = vi.fn();
    const resolve = createBrowserMediaStreamFetch(fetcher);
    for (const url of ['http://radio.example/stream', 'https://user:pass@radio.example/stream', 'https://127.0.0.1/stream', 'https://10.1.1.1/stream', 'https://[::1]/stream', 'https://radio.local/stream', 'data:audio/mpeg,test']) {
      await expect(resolve(url, { signal: new AbortController().signal })).rejects.toThrow();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('enforces the same live endpoint grants as atomic resources and passes cancellation identity', async () => {
    const stream = vi.fn(async () => new Response('audio'));
    const resource = createResourceService({
      fetch: vi.fn(), stream,
      resolveIdentity: id => id === 'owner' ? { dTag: 'radio', aggregateHash: 'a'.repeat(64) } : null,
      getConnectGrants: () => ['https://radio.example'], isOriginGranted: (origin, grants) => grants.includes(origin),
    });
    const controller = new AbortController();
    await expect(resource.openStream('owner', 'https://blocked.example/stream', controller.signal)).rejects.toThrow('not granted');
    await expect(resource.openStream('stranger', 'https://radio.example/stream', controller.signal)).rejects.toThrow('identity not resolvable');
    expect(stream).not.toHaveBeenCalled();
    await resource.openStream('owner', 'https://radio.example/stream', controller.signal);
    expect(stream).toHaveBeenCalledWith('https://radio.example/stream', { method: 'GET', signal: controller.signal, windowId: 'owner' });
    controller.abort();
    await expect(resource.openStream('owner', 'https://radio.example/stream', controller.signal)).rejects.toThrow('cancelled');
    expect(stream).toHaveBeenCalledOnce();
  });
});
