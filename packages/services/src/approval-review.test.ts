import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage, NostrEvent } from '@napplet/core';
import type { ApprovalSignal, ServiceRuntimeContext } from '@kehto/runtime';
import { createOutboxService, type StreamingOutboxRouter } from './outbox-service.js';
import { createRelayPoolService } from './relay-pool-service.js';
import { createCoordinatedRelay } from './coordinated-relay.js';
import { createRelayPoolOutboxRouter } from './relay-pool-outbox-router.js';
import { createThemeService } from './theme-service.js';
import { createIdentityService } from './identity-service.js';

const event: NostrEvent = { id: 'a'.repeat(64), pubkey: 'b'.repeat(64), kind: 1, tags: [], content: '', created_at: 1, sig: 'c'.repeat(128) };
const context = (authorizeOperation: unknown): ServiceRuntimeContext => ({ authorizeOperation } as ServiceRuntimeContext);
function router(): StreamingOutboxRouter {
  return {
    getEvent: vi.fn(async () => ({ result: { event } })),
    query: vi.fn(async () => ({ events: [{ event }] })),
    subscribe: vi.fn(() => ({ close: vi.fn() })),
    publish: vi.fn(async () => ({ ok: true })),
    resolveRelays: vi.fn(async () => ({ relays: ['wss://approved.test'], source: 'policy' as const })),
    queryStream: vi.fn(() => ({ result: Promise.resolve({ events: [] }), close: vi.fn() })),
    planRead: vi.fn(async () => ({ relays: ['wss://approved.test'], source: 'policy' as const })),
    queryWithPlan: vi.fn(async () => ({ events: [{ event }] })),
  };
}

describe('reviewed service approval boundaries', () => {
  it('authorizes getEvent against its selected relay plan before executing', async () => {
    const backend = router();
    const service = createOutboxService({ router: backend });
    const authorize = vi.fn(async () => ({ status: 'denied' }));
    service.onRegistered?.(context(authorize));
    const send = vi.fn();
    service.handleMessage('a', { type: 'outbox.getEvent', id: 'get', eventId: event.id, options: { relays: ['wss://hint.test'] } } as NappletMessage, send);
    await vi.waitFor(() => expect(send).toHaveBeenCalled());
    expect(authorize).toHaveBeenCalledWith('a', 'outbox.getEvent', expect.arrayContaining([
      expect.objectContaining({ category: 'network', scope: { kind: 'origin', value: 'wss://approved.test' } }),
    ]), expect.any(Function));
    expect(backend.getEvent).not.toHaveBeenCalled();
    expect(backend.queryWithPlan).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith({ type: 'outbox.getEvent.result', id: 'get', error: 'policy denied' });
  });

  it('uses the approved plan for getEvent without rerouting and ignores wrong events', async () => {
    const backend = router();
    backend.queryWithPlan = vi.fn(async () => ({ events: [{ event: { ...event, id: 'd'.repeat(64) } }, { event }] }));
    const signal = new AbortController().signal;
    const authorize = vi.fn(async (_w, _op, _requirements, execute: (signal: ApprovalSignal) => unknown) => ({ status: 'executed', value: await execute(signal) }));
    const service = createOutboxService({ router: backend });
    service.onRegistered?.(context(authorize));
    const send = vi.fn();
    service.handleMessage('a', { type: 'outbox.getEvent', id: 'get', eventId: event.id, options: { author: event.pubkey, relays: ['wss://hint.test'], timeoutMs: 20 } } as NappletMessage, send);
    await vi.waitFor(() => expect(send).toHaveBeenCalled());
    expect(backend.queryWithPlan).toHaveBeenCalledWith([{ ids: [event.id], authors: [event.pubkey] }], { authors: [event.pubkey], relays: ['wss://hint.test'], limit: 1, timeoutMs: 20 }, { relays: ['wss://approved.test'], source: 'policy' }, signal);
    expect(backend.getEvent).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith({ type: 'outbox.getEvent.result', id: 'get', result: { event } });
  });

  it.each(['getEvent', 'query', 'subscribe', 'publish'] as const)('fails closed for %s with an unplannable authorized router', async (operation) => {
    const backend = router();
    delete backend.planRead;
    const service = createOutboxService({ router: backend });
    service.onRegistered?.(context(vi.fn()));
    const send = vi.fn();
    service.handleMessage('a', { type: `outbox.${operation}`, id: 'request', subId: 'stream', eventId: event.id, filters: [{ kinds: [1] }], event } as NappletMessage, send);
    await vi.waitFor(() => expect(send).toHaveBeenCalled());
    expect(backend.getEvent).not.toHaveBeenCalled();
    expect(backend.query).not.toHaveBeenCalled();
    expect(backend.subscribe).not.toHaveBeenCalled();
    expect(backend.publish).not.toHaveBeenCalled();
    expect(send.mock.calls[0]?.[0]).toMatchObject(operation === 'subscribe' ? { type: 'outbox.closed', reason: 'policy denied' } : { type: `outbox.${operation}.result`, error: 'policy denied' });
  });

  it('warns exactly once per standalone OUTBOX service while preserving legacy calls', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const backend = router();
      const service = createOutboxService({ router: backend });
      const send = vi.fn();
      for (const id of ['one', 'two']) service.handleMessage('a', { type: 'outbox.query', id, filters: [{ kinds: [1] }] } as NappletMessage, send);
      await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
      expect(backend.query).toHaveBeenCalledTimes(2);
      expect(warning).toHaveBeenCalledExactlyOnceWith('[FW-OUTBOX-LEGACY-001] Configure RuntimeAdapter.permissions and immutable OUTBOX relay planning; unapproved router execution is deprecated. Warning once per service instance.');
    } finally { warning.mockRestore(); }
  });

  it('aborts a planned OUTBOX read and suppresses late verification', async () => {
    const controller = new AbortController();
    const unsubscribe = vi.fn();
    let verify!: (value: boolean) => void;
    const backend = createRelayPoolOutboxRouter({
      relayPool: { isAvailable: () => true, publish: vi.fn(), subscribe: (_filters, _relays, callback) => { callback(event); return { unsubscribe }; } },
      loadRelayLists: () => new Map(), fallbackRelays: [],
      verifyEvent: () => new Promise<boolean>((resolve) => { verify = resolve; }),
    });
    const result = backend.queryWithPlan!([{ ids: [event.id] }], { timeoutMs: 10_000 }, { relays: ['wss://approved.test'], source: 'policy' }, controller.signal);
    controller.abort();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    verify(true);
    expect(await result).toEqual({ events: [], error: 'policy denied' });
  });

  it.each(['pool', 'coordinated'] as const)('rejects %s planned publish when exact destinations cannot be enforced', async (kind) => {
    const publish = vi.fn();
    const pool = { subscribe: vi.fn(() => ({ unsubscribe() {} })), publish, selectRelayTier: () => ['wss://approved.test'], isAvailable: () => true };
    const service = kind === 'pool' ? createRelayPoolService(pool) : createCoordinatedRelay({ relayPool: pool, cache: { query: async () => [], store: vi.fn(), isAvailable: () => false } });
    const send = vi.fn();
    service.executeRelayOperation('a', { type: 'relay.publish', id: 'publish', event } as NappletMessage, { operation: 'publish', relayUrls: ['wss://approved.test'], localOnly: false }, new AbortController().signal, send);
    await Promise.resolve();
    expect(publish).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'relay.publish.result', id: 'publish', ok: false }));
  });

  it.each(['theme', 'identity'] as const)('sends only one terminal %s result when completion races cancellation', async (domain) => {
    const service = domain === 'theme' ? createThemeService().handler : createIdentityService({ getSigner: () => null });
    service.onRegistered?.(context(async (_window: string, _operation: string, _requirements: readonly unknown[], execute: (signal: ApprovalSignal) => unknown) => {
      await execute(new AbortController().signal);
      return { status: 'cancelled' };
    }));
    const send = vi.fn();
    service.handleMessage('a', { type: domain === 'theme' ? 'theme.get' : 'identity.getPublicKey', id: 'race' } as NappletMessage, send);
    await vi.waitFor(() => expect(send).toHaveBeenCalled());
    await Promise.resolve();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('closes every planned OUTBOX subscription even when one cleanup throws', async () => {
    const controller = new AbortController();
    const closeFirst = vi.fn(() => { throw new Error('already disconnected'); });
    const closeSecond = vi.fn();
    const backend = createRelayPoolOutboxRouter({
      relayPool: { isAvailable: () => true, publish: vi.fn(), subscribe: (_filters, relays) => ({ unsubscribe: relays[0] === 'wss://first.test' ? closeFirst : closeSecond }) },
      loadRelayLists: () => new Map(), fallbackRelays: [],
    });
    const result = backend.queryWithPlan!([{ ids: [event.id] }], { timeoutMs: 10_000 }, { relays: ['wss://first.test', 'wss://second.test'], source: 'policy' }, controller.signal);
    controller.abort();
    expect(closeFirst).toHaveBeenCalledTimes(1);
    expect(closeSecond).toHaveBeenCalledTimes(1);
    expect(await result).toEqual({ events: [], error: 'policy denied' });
  });

  it.each(['destroy', 'unregister'] as const)('suppresses pending theme denial after %s and source replacement', async (lifecycle) => {
    const service = createThemeService().handler;
    let rejectOld!: () => void;
    service.onRegistered?.(context(() => new Promise((resolve) => { rejectOld = () => resolve({ status: 'denied' }); })));
    const oldSend = vi.fn();
    service.handleMessage('a', { type: 'theme.get', id: 'old' } as NappletMessage, oldSend);
    if (lifecycle === 'destroy') service.onWindowDestroyed?.('a'); else service.onUnregistered?.();
    service.onRegistered?.(context(async () => ({ status: 'denied' })));
    const newSend = vi.fn();
    service.handleMessage('a', { type: 'theme.get', id: 'new' } as NappletMessage, newSend);
    rejectOld();
    await vi.waitFor(() => expect(newSend).toHaveBeenCalledExactlyOnceWith({ type: 'theme.get.result', id: 'new', error: 'policy denied' }));
    expect(oldSend).not.toHaveBeenCalled();
  });

  it.each(['denied', 'rate-limited', 'cancelled', 'error'])('completes denied theme.get for %s', async (status) => {
    const service = createThemeService();
    service.handler.onRegistered?.(context(async () => ({ status })));
    const send = vi.fn();
    service.handler.handleMessage('a', { type: 'theme.get', id: 'theme' } as NappletMessage, send);
    await vi.waitFor(() => expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'theme.get.result', id: 'theme', error: 'policy denied' }));
  });

  it.each([
    ['getPublicKey', { pubkey: '' }], ['getRelays', { relays: {}, error: 'policy denied' }],
    ['getProfile', { profile: null, error: 'policy denied' }], ['getFollows', { pubkeys: [], error: 'policy denied' }],
    ['getList', { entries: [], error: 'policy denied' }], ['getZaps', { zaps: [], error: 'policy denied' }],
    ['getMutes', { pubkeys: [], error: 'policy denied' }], ['getBlocked', { pubkeys: [], error: 'policy denied' }],
    ['getBadges', { badges: [], error: 'policy denied' }],
  ])('completes denied identity.%s with its canonical empty shape', async (action, payload) => {
    const service = createIdentityService({ getSigner: () => null });
    service.onRegistered?.(context(async () => ({ status: 'denied' })));
    const send = vi.fn();
    service.handleMessage('a', { type: `identity.${action}`, id: 'identity' } as NappletMessage, send);
    await vi.waitFor(() => expect(send).toHaveBeenCalledExactlyOnceWith({ type: `identity.${action}.result`, id: 'identity', ...payload }));
  });
});
