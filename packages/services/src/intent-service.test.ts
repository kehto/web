import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import type { ServiceRuntimeContext } from '@kehto/runtime';
import { createIntentService } from './intent-service.js';

const request = { archetype: 'profile', action: 'open', convention: 'napplet:profile/open' };

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('createIntentService', () => {
  it('does not retain an invocation when exact action approval is denied', async () => {
    const invoke = vi.fn(async () => ({ ok: true as const, ...request, handler: 'target' }));
    const service = createIntentService({ resolveSender: () => 'source', resolver: { invoke, available: () => ({ archetype: 'profile', available: false, candidates: [], hasDefault: false }), handlers: () => [] } });
    service.onRegistered?.({ authorizeOperation: async () => ({ status: 'denied' }) } as unknown as ServiceRuntimeContext);
    const sent: NappletMessage[] = [];
    service.handleMessage('trusted', { type: 'intent.invoke', id: 'denied', request } as NappletMessage, (message) => sent.push(message));
    await flush();
    expect(invoke).not.toHaveBeenCalled();
    expect(sent).toEqual([{ type: 'intent.invoke.result', id: 'denied', result: { ok: false, error: 'invoke rejected' } }]);
  });
  it('derives sender only from the authenticated window lookup and rejects forged sender input', async () => {
    const invoke = vi.fn(async () => ({ ok: true as const, ...request, handler: 'nip5d:35129:publisher:profile' }));
    const service = createIntentService({
      resolveSender: (windowId) => windowId === 'trusted' ? 'nip5d:35129:publisher:source' : undefined,
      resolver: { invoke, available: () => ({ archetype: 'profile', available: false, candidates: [], hasDefault: false }), handlers: () => [] },
    });
    const sent: NappletMessage[] = [];
    service.handleMessage('trusted', { type: 'intent.invoke', id: 'one', request: { ...request, sender: 'forged' } } as unknown as NappletMessage, (message) => sent.push(message));
    await flush();
    expect(invoke).not.toHaveBeenCalled();
    expect(sent).toEqual([{ type: 'intent.invoke.result', id: 'one', result: { ok: false, error: 'invalid convention' } }]);

    service.handleMessage('trusted', { type: 'intent.invoke', id: 'two', request } as unknown as NappletMessage, (message) => sent.push(message));
    await flush();
    expect(invoke).toHaveBeenCalledWith(request, { sender: 'nip5d:35129:publisher:source', sourceWindowId: 'trusted' });
    expect(sent[1]).toEqual(expect.objectContaining({ result: expect.not.objectContaining({ handled: expect.anything(), windowId: expect.anything() }) }));
  });

  it('accepts only named 35129 recommendation coordinates', async () => {
    const invoke = vi.fn(async () => ({ ok: false as const, error: 'no handler' }));
    const service = createIntentService({ resolveSender: () => 'source', resolver: { invoke, available: () => ({ archetype: 'profile', available: false, candidates: [], hasDefault: false }), handlers: () => [] } });
    const sent: NappletMessage[] = [];
    service.handleMessage('trusted', { type: 'intent.invoke', id: 'bad', request: { ...request, handlerHint: { address: `1:${'a'.repeat(64)}:profile` } } } as unknown as NappletMessage, (message) => sent.push(message));
    await flush();
    expect(invoke).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
  });

  it('returns one rejection when a resolver callback throws synchronously', async () => {
    const service = createIntentService({
      resolveSender: () => 'nip5d:35129:publisher:source',
      resolver: {
        invoke: () => { throw new Error('synchronous policy failure'); },
        available: () => ({ archetype: 'profile', available: false, candidates: [], hasDefault: false }),
        handlers: () => [],
      },
    });
    const sent: NappletMessage[] = [];
    service.handleMessage('trusted', { type: 'intent.invoke', id: 'sync', request } as unknown as NappletMessage, (message) => sent.push(message));
    await flush();
    expect(sent).toEqual([{ type: 'intent.invoke.result', id: 'sync', result: { ok: false, error: 'invoke rejected' } }]);
  });

  // kehto/web#518: NAP-INTENT master @ 377bf939 wire table: `intent.available.result`
  // is `id`, `availability`, `error`?; `intent.handlers.result` is `id`, `handlers`, `error`?.
  it('keeps the required availability and handlers fields on every failure', async () => {
    const service = createIntentService({
      resolveSender: () => 'source',
      resolver: {
        invoke: async () => ({ ok: false as const, error: 'no handler' }),
        available: () => { throw new Error('catalog down'); },
        handlers: async () => { throw new Error('catalog down'); },
      },
    });
    const sent: NappletMessage[] = [];
    const send = (message: NappletMessage) => sent.push(message);
    service.handleMessage('w', { type: 'intent.available', id: 'a0' } as NappletMessage, send);
    service.handleMessage('w', { type: 'intent.available', id: 'a1', archetype: 7 } as unknown as NappletMessage, send);
    service.handleMessage('w', { type: 'intent.available', id: 'a2', archetype: 'profile' } as NappletMessage, send);
    service.handleMessage('w', { type: 'intent.handlers', id: 'h1' } as NappletMessage, send);
    await flush();
    const empty = (archetype: string) => ({ archetype, available: false, candidates: [], hasDefault: false });
    expect(sent).toEqual([
      { type: 'intent.available.result', id: 'a0', availability: empty(''), error: 'invalid archetype' },
      { type: 'intent.available.result', id: 'a1', availability: empty(''), error: 'invalid archetype' },
      { type: 'intent.available.result', id: 'a2', availability: empty('profile'), error: 'catalog unavailable' },
      { type: 'intent.handlers.result', id: 'h1', handlers: [], error: 'catalog unavailable' },
    ]);
  });
});
