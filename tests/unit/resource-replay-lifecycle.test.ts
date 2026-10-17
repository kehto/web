import { expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import type { ServiceRuntimeContext } from '@kehto/runtime';
import { createResourceService } from '@kehto/services';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const url = 'https://example.com/resource';

function fixture(fetch = vi.fn(async () => new Response('bytes'))) {
  const service = createResourceService({ fetch });
  service.onRegistered?.({
    authorizeOperation: async (_window: string, _operation: string, _requirements: unknown,
      execute: (signal: AbortSignal) => Promise<unknown>) => ({
      status: 'executed', value: await execute(new AbortController().signal),
    }),
  } as unknown as ServiceRuntimeContext);
  const send = vi.fn();
  return { service, fetch, send,
    request: (message: unknown, windowId = 'w') => service.handleMessage(windowId, message as NappletMessage, send),
  };
}

// NAP-RESOURCE ae5b9c64 requires cancelled IDs to drop late terminals. The
// bounded completed-ID ledger is Kehto's additional replay policy (113-01).
it('does not repeat a completed request or emit a second terminal for malformed reuse', async () => {
  const f = fixture();
  f.request({ type: 'resource.bytes', id: 'one', url });
  await flush();
  expect(f.send).toHaveBeenCalledOnce();
  f.request({ type: 'resource.bytes', id: 'one', url });
  f.request({ type: 'resource.bytesMany', id: 'one', urls: [url] });
  f.request({ type: 'resource.bytes', id: 'one' });
  await flush();
  expect(f.fetch).toHaveBeenCalledOnce();
  expect(f.send).toHaveBeenCalledOnce();
});

it('retains cancelled IDs after asynchronous cleanup', async () => {
  let release!: (response: Response) => void;
  const fetch = vi.fn(() => new Promise<Response>((resolve) => { release = resolve; }));
  const f = fixture(fetch);
  f.request({ type: 'resource.bytes', id: 'cancelled', url });
  await flush();
  f.request({ type: 'resource.cancel', id: 'cancelled' });
  release(new Response('late'));
  await flush();
  f.request({ type: 'resource.bytes', id: 'cancelled', url });
  await flush();
  expect(f.fetch).toHaveBeenCalledOnce();
  expect(f.send).not.toHaveBeenCalled();
});

it('isolates replay history by window and resets it when that source is destroyed', async () => {
  const f = fixture();
  const message = { type: 'resource.bytes', id: 'one', url };
  f.request(message, 'first');
  f.request(message, 'second');
  await flush();
  expect(f.fetch).toHaveBeenCalledTimes(2);
  f.service.onWindowDestroyed?.('first');
  f.request(message, 'first');
  f.request(message, 'second');
  await flush();
  expect(f.fetch).toHaveBeenCalledTimes(3);
  expect(f.send).toHaveBeenCalledTimes(3);
});

it('retains only the latest 1024 completed IDs without forgetting live requests', async () => {
  let release!: (response: Response) => void;
  const fetch = vi.fn(() => new Promise<Response>((resolve) => { release = resolve; }));
  const f = fixture(fetch);
  f.request({ type: 'resource.bytes', id: 'live', url });
  await flush();
  for (let id = 0; id <= 1024; id++) f.request({ type: 'resource.info', id: String(id) });
  await flush();
  expect(f.send).toHaveBeenCalledTimes(1025);
  f.request({ type: 'resource.bytes', id: 'live', url });
  f.request({ type: 'resource.info', id: '1024' });
  f.request({ type: 'resource.info', id: '0' });
  await flush();
  expect(f.fetch).toHaveBeenCalledOnce();
  expect(f.send).toHaveBeenCalledTimes(1026);
  f.request({ type: 'resource.cancel', id: 'live' });
  release(new Response('late'));
  await flush();
  expect(f.send).toHaveBeenCalledTimes(1026);
});

it('reserves malformed terminal IDs and clears replay history on detach', async () => {
  const f = fixture();
  f.request({ type: 'resource.bytes', id: 'invalid' });
  f.request({ type: 'resource.bytesMany', id: 'bulk', urls: [] });
  f.request({ type: 'resource.bytes', id: 'invalid', url });
  f.request({ type: 'resource.bytesMany', id: 'bulk', urls: [url] });
  await flush();
  expect(f.fetch).not.toHaveBeenCalled();
  expect(f.send).toHaveBeenCalledTimes(2);
  f.service.onUnregistered?.();
  // info exercises detached cleanup without entering the legacy resolver path.
  f.request({ type: 'resource.info', id: 'invalid' });
  await flush();
  expect(f.send).toHaveBeenCalledTimes(3);
});
