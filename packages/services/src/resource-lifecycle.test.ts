import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import type { ResourceInfo } from '@napplet/nap/resource/types';
import type { ServiceRuntimeContext } from '@kehto/runtime';
import { createResourceService } from './resource-service.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const url = 'https://example.com/image.png';

describe('resource lifecycle before asynchronous metadata resolution', () => {
  it('authorizes the immutable resource URL and every actual network destination', async () => {
    const authorizeOperation = vi.fn(async (
      _windowId: string,
      _operation: string,
      _requirements: unknown,
      execute: (signal: AbortSignal) => Promise<unknown>,
    ) => ({ status: 'executed' as const, value: await execute(new AbortController().signal) }));
    const fetch = vi.fn(async (_url: string, init: { authorizeNetwork?: (destination: string, execute: (signal: AbortSignal) => Promise<Response>) => Promise<Response> }) => {
      return init.authorizeNetwork!('https://cdn.example/asset.png', async () => new Response('approved bytes'));
    });
    const service = createResourceService({ fetch });
    service.onRegistered?.({ authorizeOperation } as unknown as ServiceRuntimeContext);
    const send = vi.fn();

    service.handleMessage('w', { type: 'resource.bytes', id: 'r', url } as NappletMessage, send);
    await flush();

    expect(authorizeOperation).toHaveBeenCalledTimes(2);
    expect(authorizeOperation.mock.calls[0]?.slice(0, 3)).toEqual([
      'w', 'resource.bytes', [{
        category: 'resource', domain: 'resource', operation: 'resource.bytes',
        scope: { kind: 'exact', value: url },
      }],
    ]);
    expect(authorizeOperation.mock.calls[1]?.slice(0, 3)).toEqual([
      'w', 'resource.network', [{
        category: 'network', domain: 'resource', operation: 'resource.network',
        scope: { kind: 'origin', value: 'https://cdn.example' },
      }],
    ]);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'resource.bytes.result', id: 'r', blob: btoa('approved bytes'),
    }));
  });

  it('projects a denied indirect destination as blocked-by-policy', async () => {
    const authorizeOperation = vi.fn(async (
      _windowId: string,
      operation: string,
      _requirements: unknown,
      execute: (signal: AbortSignal) => Promise<unknown>,
    ) => operation === 'resource.network'
      ? { status: 'denied' as const }
      : { status: 'executed' as const, value: await execute(new AbortController().signal) });
    const fetch = vi.fn(async (_url: string, init: { authorizeNetwork?: (destination: string, execute: (signal: AbortSignal) => Promise<Response>) => Promise<Response> }) => {
      return init.authorizeNetwork!('https://private.example/asset.png', async () => new Response('must not run'));
    });
    const service = createResourceService({ fetch });
    service.onRegistered?.({ authorizeOperation } as unknown as ServiceRuntimeContext);
    const send = vi.fn();

    service.handleMessage('w', { type: 'resource.bytes', id: 'r', url } as NappletMessage, send);
    await flush();

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'resource.bytes.error', id: 'r', error: 'blocked-by-policy',
    }));
  });

  it('emits exactly one blocked-by-policy terminal for a live bulk request on revocation', async () => {
    const body = deferred<Response>();
    const service = createResourceService({ fetch: vi.fn(async () => body.promise) });
    const send = vi.fn();
    service.handleMessage('w', { type: 'resource.bytesMany', id: 'r', urls: [url] } as NappletMessage, send);
    await flush();
    service.onPermissionRevoked?.('w');
    body.resolve(new Response('late'));
    await flush();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'resource.bytesMany.error', id: 'r', error: 'blocked-by-policy',
    }));
  });

  it('ignores retired requestId cancellation and leaves the matching canonical request live', async () => {
    const body = deferred<Response>();
    const service = createResourceService({ fetch: vi.fn(async () => body.promise) });
    const send = vi.fn();
    service.handleMessage('w', { type: 'resource.bytes', id: 'live', url } as NappletMessage, send);
    await flush();
    service.handleMessage('w', { type: 'resource.cancel', requestId: 'live' } as unknown as NappletMessage, send);
    body.resolve(new Response('still live'));
    await flush();

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'resource.bytes.result', id: 'live', blob: btoa('still live'),
    }));
  });

  it('rejects retired bulk requests/server hints without passing them to the resolver', async () => {
    const fetch = vi.fn(async () => new Response('bytes'));
    const service = createResourceService({ fetch });
    const send = vi.fn();
    service.handleMessage('w', {
      type: 'resource.bytesMany', id: 'old-bulk', requests: [{ url }],
    } as unknown as NappletMessage, send);
    await flush();
    expect(fetch).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'resource.bytesMany.error', id: 'old-bulk', error: 'invalid-request',
    }));

    service.handleMessage('w', {
      type: 'resource.bytes', id: 'canonical', url, servers: ['https://attacker.example'],
    } as unknown as NappletMessage, send);
    await flush();
    expect(fetch).toHaveBeenLastCalledWith(url, expect.not.objectContaining({ servers: expect.anything() }));
  });

  it.each(['resource.bytes', 'resource.bytesMany'] as const)('cancels %s before any fetch', async (type) => {
    const info = deferred<ResourceInfo>();
    const fetch = vi.fn(async () => new Response('bytes'));
    const service = createResourceService({ fetch, resourceInfo: () => info.promise });
    const send = vi.fn();
    service.handleMessage('w', { type, id: 'r', url, urls: [url] } as NappletMessage, send);
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
    service.handleMessage('w', { type, id: 'r', url, urls: [url] } as NappletMessage, send);
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
    const urls = [original];
    service.handleMessage('w', { type: 'resource.bytesMany', id: 'r', urls } as NappletMessage, vi.fn());
    urls[0] = 'https://attacker.invalid';
    urls.push(url);
    info.resolve({ schemes: [] });
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(original, expect.anything());
  });

  it('keeps duplicate in-flight IDs bound to the original cancellation', async () => {
    const info = deferred<ResourceInfo>();
    const fetch = vi.fn(async () => new Response('bytes'));
    const provider = vi.fn(() => info.promise);
    const service = createResourceService({ fetch, resourceInfo: provider });
    const send = vi.fn();
    service.handleMessage('w', { type: 'resource.bytes', id: 'r', url } as NappletMessage, send);
    service.handleMessage('w', { type: 'resource.bytesMany', id: 'r', urls: [url] } as NappletMessage, send);
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
