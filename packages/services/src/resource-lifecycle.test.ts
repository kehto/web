import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import type { ResourceInfo } from '@napplet/nap/resource/types';
import { createResourceService } from './resource-service.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const url = 'https://example.com/image.png';

describe('resource lifecycle before asynchronous metadata resolution', () => {
  it.each(['resource.bytes', 'resource.bytesMany'] as const)('cancels %s before any fetch', async (type) => {
    const info = deferred<ResourceInfo>();
    const fetch = vi.fn(async () => new Response('bytes'));
    const service = createResourceService({ fetch, resourceInfo: () => info.promise });
    const send = vi.fn();
    service.handleMessage('w', { type, id: 'r', url, requests: [{ url }] } as NappletMessage, send);
    service.handleMessage('w', { type: 'resource.cancel', id: 'r' } as NappletMessage, send);
    info.resolve({ schemes: [] });
    await flush();
    expect(fetch).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it.each(['resource.info', 'resource.bytes', 'resource.bytesMany'] as const)('drops %s work on teardown', async (type) => {
    const info = deferred<ResourceInfo>();
    const fetch = vi.fn(async () => new Response('bytes'));
    const service = createResourceService({ fetch, resourceInfo: () => info.promise });
    const send = vi.fn();
    service.handleMessage('w', { type, id: 'r', url, requests: [{ url }] } as NappletMessage, send);
    service.onWindowDestroyed?.('w');
    info.resolve({ schemes: [] });
    await flush();
    expect(fetch).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('captures bulk URLs and server hints before awaiting host metadata', async () => {
    const info = deferred<ResourceInfo>();
    const fetch = vi.fn(async () => new Response('bytes'));
    const service = createResourceService({ fetch, resourceInfo: () => info.promise });
    const original = `blossom:${'a'.repeat(64)}.png`;
    const request = { url: original, servers: ['https://blossom.example'] };
    const requests = [request];
    service.handleMessage('w', { type: 'resource.bytesMany', id: 'r', requests } as NappletMessage, vi.fn());
    request.url = 'https://attacker.invalid';
    request.servers[0] = 'https://attacker.invalid';
    requests.push({ url, servers: [] });
    info.resolve({ schemes: [] });
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(original, expect.objectContaining({ servers: ['https://blossom.example'] }));
  });

  it('keeps duplicate in-flight IDs bound to the original cancellation', async () => {
    const info = deferred<ResourceInfo>();
    const fetch = vi.fn(async () => new Response('bytes'));
    const provider = vi.fn(() => info.promise);
    const service = createResourceService({ fetch, resourceInfo: provider });
    const send = vi.fn();
    service.handleMessage('w', { type: 'resource.bytes', id: 'r', url } as NappletMessage, send);
    service.handleMessage('w', { type: 'resource.bytesMany', id: 'r', requests: [{ url }] } as NappletMessage, send);
    service.handleMessage('w', { type: 'resource.cancel', id: 'r' } as NappletMessage, send);
    info.resolve({ schemes: [] });
    await flush();
    expect(provider).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('does not let old cleanup erase a new source request with the same ID', async () => {
    const oldInfo = deferred<ResourceInfo>();
    const newInfo = deferred<ResourceInfo>();
    const provider = vi.fn().mockReturnValueOnce(oldInfo.promise).mockReturnValueOnce(newInfo.promise);
    const fetch = vi.fn(async () => new Response('bytes'));
    const service = createResourceService({ fetch, resourceInfo: provider });
    const send = vi.fn();
    const message = { type: 'resource.bytes', id: 'r', url } as NappletMessage;
    service.handleMessage('w', message, send);
    service.onWindowDestroyed?.('w');
    service.handleMessage('w', message, send);
    oldInfo.resolve({ schemes: [] });
    await flush();
    service.handleMessage('w', { type: 'resource.cancel', id: 'r' } as NappletMessage, send);
    newInfo.resolve({ schemes: [] });
    await flush();
    expect(fetch).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('cancels all windows when the service is detached', async () => {
    const info = deferred<ResourceInfo>();
    const fetch = vi.fn(async () => new Response('bytes'));
    const service = createResourceService({ fetch, resourceInfo: () => info.promise });
    const send = vi.fn();
    for (const windowId of ['a', 'b']) {
      service.handleMessage(windowId, { type: 'resource.bytes', id: 'r', url } as NappletMessage, send);
    }
    service.onUnregistered?.();
    info.resolve({ schemes: [] });
    await flush();
    expect(fetch).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
