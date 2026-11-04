import { describe, expect, it, vi } from 'vitest';
import { createBrowserMediaStreamFetch } from './browser-media-stream-fetch.js';
import type { ApprovalSignal, PermissionRequirement, ServiceRuntimeContext } from '@kehto/runtime';
import { createResourceService, type ResourceFetchInit } from './resource-service.js';

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

  it('requires the same resource and network approvals as atomic resources and keeps playback cancellation', async () => {
    const stream = vi.fn(async (_url: string, _init: ResourceFetchInit) => new Response('audio'));
    const resource = createResourceService({ fetch: vi.fn(), stream });
    const operations: string[] = [];
    resource.onRegistered?.({
      authorizeOperation: async (_windowId: string, operation: string, requirements: readonly PermissionRequirement[], execute: (signal: ApprovalSignal) => Promise<unknown>) => {
        operations.push(operation);
        if (requirements.some((item) => item.category === 'network' && item.scope.value !== 'https://radio.example')) return { status: 'denied' };
        return { status: 'executed', value: await execute(new AbortController().signal as unknown as ApprovalSignal) };
      },
    } as unknown as ServiceRuntimeContext);
    const controller = new AbortController();
    await expect(resource.openStream('owner', 'https://blocked.example/stream', controller.signal)).rejects.toThrow();
    expect(stream).not.toHaveBeenCalled();
    await resource.openStream('owner', 'https://radio.example/stream', controller.signal);
    expect(operations).toEqual(['resource.bytes', 'resource.network', 'resource.bytes', 'resource.network']);
    expect(stream).toHaveBeenCalledOnce();
    const init = stream.mock.calls[0][1];
    expect(init).toMatchObject({ method: 'GET', windowId: 'owner' });
    expect(init.signal.aborted).toBe(false);
    controller.abort();
    expect(init.signal.aborted).toBe(true);
    await expect(resource.openStream('owner', 'https://radio.example/stream', controller.signal)).rejects.toThrow('cancelled');
    expect(stream).toHaveBeenCalledOnce();
  });

  it('warns once on the legacy stream path and stays quiet once a runtime approves it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stream = vi.fn(async () => new Response('audio'));
    const legacy = createResourceService({ fetch: vi.fn(), stream });
    const signal = new AbortController().signal;
    await legacy.openStream('owner', 'https://radio.example/stream', signal);
    await legacy.openStream('owner', 'https://radio.example/stream', signal);
    expect(warn.mock.calls.filter(([text]) => String(text).includes('FW-RESOURCE-LEGACY-001'))).toHaveLength(1);
    warn.mockClear();
    const canonical = createResourceService({ fetch: vi.fn(), stream });
    canonical.onRegistered?.({
      authorizeOperation: async (_windowId: string, _operation: string, _requirements: unknown, execute: (signal: ApprovalSignal) => Promise<unknown>) => ({
        status: 'executed', value: await execute(new AbortController().signal as unknown as ApprovalSignal),
      }),
    } as unknown as ServiceRuntimeContext);
    await canonical.openStream('owner', 'https://radio.example/stream', signal);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
