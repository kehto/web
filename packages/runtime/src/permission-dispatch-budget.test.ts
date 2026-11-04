import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createRuntime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import { defaultRateLimitConfig } from './rate-limit.js';
import type { ApprovalCancellation } from './approval-coordinator.js';
import type { ServiceRuntimeContext } from './types.js';

declare const AbortController: { new(): ApprovalCancellation };
declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(handle: unknown): void;

async function fixture(domains: string[]) {
  const onRateLimit = vi.fn();
  const base = defaultRateLimitConfig();
  const ctx = createMockRuntimeAdapter({ permissions: {
    now: () => 0, prompt: async () => ({ effect: 'allow', lifetime: 'session' }),
    createCancellation: () => new AbortController(), onRateLimit,
    schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
    rateLimit: { ...base, burst: { ...base.burst, maxOperations: 2 } },
  } });
  const runtime = createRuntime(ctx.hooks);
  const entry = { ...createNip5dSessionEntry('window', 'app', 'a'.repeat(64)),
    permissionPrincipal: { kind: 'development' as const, target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) } };
  runtime.sessionRegistry.register('window', entry);
  await runtime.permissions!.admit('window', { required: domains, optional: [], available: domains });
  return { runtime, ctx, onRateLimit };
}

describe('dispatch budgets without service coordination', () => {
  it('bounds storage persistence after interface admission', async () => {
    const f = await fixture(['storage']);
    const set = vi.spyOn(f.ctx.hooks.statePersistence, 'set');
    for (let i = 0; i < 3; i++) f.runtime.handleMessage('window', { type: 'storage.set', id: `set-${i}`, key: `key-${i}`, value: String(i) });
    expect(set).toHaveBeenCalledTimes(2);
    expect(f.onRateLimit).toHaveBeenCalledWith({ windowId: 'window', operation: 'storage.set', action: 'block', reason: 'burst-exceeded' });
    f.runtime.destroy();
  });

  it.each(['get', 'set', 'remove', 'keys'])('returns a correlated storage.%s denial when its budget is exhausted', async (action) => {
    const f = await fixture(['storage']);
    for (let i = 0; i < 2; i++) f.runtime.handleMessage('window', { type: 'storage.set', id: `seed-${i}`, key: `key-${i}`, value: String(i) });
    f.ctx.sent.length = 0;
    f.runtime.handleMessage('window', { type: `storage.${action}`, id: 'throttled', key: 'key-0', value: 'blocked' });
    expect(f.ctx.sent).toEqual([{ windowId: 'window', message: {
      type: `storage.${action}.result`, id: 'throttled', error: 'rate limit exceeded',
    } }]);
    expect([...f.ctx.stateStore.values()]).toEqual(['0', '1']);
    f.runtime.destroy();
  });

  it.each(['subscribe', 'channel.open'])('returns a correlated inc.%s denial without creating state', async (action) => {
    const f = await fixture(['inc']);
    for (let i = 0; i < 2; i++) f.runtime.handleMessage('window', { type: 'inc.broadcast', topic: 'test', payload: {} });
    f.runtime.handleMessage('window', { type: `inc.${action}`, id: 'throttled', topic: 'test', target: 'other' });
    expect(f.ctx.sent).toEqual([{ windowId: 'window', message: {
      type: `inc.${action}.result`, id: 'throttled', error: 'rate limit exceeded',
    } }]);
    f.runtime.destroy();
  });

  it('does not project a throttled request response into a replacement source', async () => {
    const f = await fixture(['storage']);
    for (let i = 0; i < 2; i++) f.runtime.handleMessage('window', { type: 'storage.get', id: `read-${i}`, key: 'key' });
    const entry = f.runtime.sessionRegistry.getEntryByWindowId('window')!;
    f.onRateLimit.mockImplementation(() => f.runtime.sessionRegistry.register('window', { ...entry }));
    f.ctx.sent.length = 0;
    f.runtime.handleMessage('window', { type: 'storage.get', id: 'old-source', key: 'key' });
    expect(f.ctx.sent).toEqual([]);
    f.runtime.destroy();
  });

  it('does not invent replies for throttled fire-and-forget messages', async () => {
    const f = await fixture(['inc', 'config']);
    const config = vi.fn();
    f.runtime.registerService('config', { descriptor: { name: 'config', version: '1' }, handleMessage: config });
    for (let i = 0; i < 2; i++) f.runtime.handleMessage('window', { type: 'inc.broadcast', topic: 'test', payload: {} });
    for (const type of ['inc.emit', 'inc.broadcast', 'inc.channel.emit', 'inc.channel.broadcast', 'config.openSettings']) {
      f.runtime.handleMessage('window', { type, id: 'fake-correlation', topic: 'test', payload: {} });
    }
    expect(f.ctx.sent).toEqual([]);
    expect(config).not.toHaveBeenCalled();
    f.runtime.destroy();
  });

  it('still lists actual active channels and closes them after exhausting the budget', async () => {
    const f = await fixture(['inc']);
    const entry = f.runtime.sessionRegistry.getEntryByWindowId('window')!;
    f.runtime.sessionRegistry.register('other', { ...entry, windowId: 'other', dTag: 'peer',
      permissionPrincipal: { kind: 'development', target: 'http://localhost:5174', artifactHash: 'a'.repeat(64) } });
    await f.runtime.permissions!.admit('other', { required: ['inc'], optional: [], available: ['inc'] });
    f.runtime.handleMessage('window', { type: 'inc.channel.open', id: 'open', target: 'peer' });
    const opened = f.ctx.sent.find(({ message }) => !Array.isArray(message) && message.type === 'inc.channel.open.result')?.message as NappletMessage & { channelId: string };
    expect(opened.channelId).toBeTypeOf('string');
    f.runtime.handleMessage('window', { type: 'inc.broadcast', topic: 'test', payload: {} });
    f.ctx.sent.length = 0;
    f.runtime.handleMessage('window', { type: 'inc.channel.list', id: 'list' });
    expect(f.ctx.sent).toEqual([{ windowId: 'window', message: {
      type: 'inc.channel.list.result', id: 'list', channels: [{ id: opened.channelId, peer: 'peer' }],
    } }]);
    f.runtime.handleMessage('window', { type: 'inc.channel.close', channelId: opened.channelId });
    expect(f.ctx.sent.filter(({ message }) => !Array.isArray(message) && message.type === 'inc.channel.closed')).toHaveLength(2);
    f.runtime.destroy();
  });

  it('still removes INC topic subscriptions after exhausting the budget', async () => {
    const f = await fixture(['inc']);
    const entry = f.runtime.sessionRegistry.getEntryByWindowId('window')!;
    f.runtime.sessionRegistry.register('other', { ...entry, windowId: 'other', dTag: 'peer',
      permissionPrincipal: { kind: 'development', target: 'http://localhost:5174', artifactHash: 'a'.repeat(64) } });
    await f.runtime.permissions!.admit('other', { required: ['inc'], optional: [], available: ['inc'] });
    f.runtime.handleMessage('window', { type: 'inc.subscribe', id: 'subscribe', topic: 'test' });
    f.runtime.handleMessage('window', { type: 'inc.broadcast', topic: 'test', payload: {} });
    f.ctx.sent.length = 0;
    f.runtime.handleMessage('window', { type: 'inc.unsubscribe', topic: 'test' });
    f.runtime.handleMessage('other', { type: 'inc.emit', topic: 'test', payload: {} });
    expect(f.ctx.sent).toEqual([]);
    f.runtime.destroy();
  });

  it('still dispatches CONFIG unsubscribe without inventing a reply after exhaustion', async () => {
    const f = await fixture(['config']);
    const config = vi.fn();
    f.runtime.registerService('config', { descriptor: { name: 'config', version: '1' }, handleMessage: config });
    for (let i = 0; i < 2; i++) f.runtime.handleMessage('window', { type: 'config.openSettings' });
    config.mockClear();
    f.runtime.handleMessage('window', { type: 'config.unsubscribe' });
    expect(config).toHaveBeenCalledOnce();
    expect(f.ctx.sent).toEqual([]);
    f.runtime.destroy();
  });

  it('bounds config settings opens and shares the burst with INC', async () => {
    const f = await fixture(['config', 'inc']);
    const config = vi.fn();
    f.runtime.registerService('config', { descriptor: { name: 'config', version: '1' }, handleMessage: config });
    f.runtime.handleMessage('window', { type: 'config.openSettings' });
    f.runtime.handleMessage('window', { type: 'inc.broadcast', id: 'two', topic: 'test', payload: {} });
    f.runtime.handleMessage('window', { type: 'config.openSettings' });
    expect(config).toHaveBeenCalledTimes(1);
    expect(f.onRateLimit).toHaveBeenCalledWith({ windowId: 'window', operation: 'config.openSettings', action: 'block', reason: 'burst-exceeded' });
    f.runtime.destroy();
  });

  it('bounds INC broadcasts before fanout', async () => {
    const f = await fixture(['inc']);
    for (let i = 0; i < 3; i++) f.runtime.handleMessage('window', { type: 'inc.broadcast', id: `broadcast-${i}`, topic: 'test', payload: {} });
    expect(f.onRateLimit).toHaveBeenCalledTimes(1);
    expect(f.onRateLimit).toHaveBeenCalledWith({ windowId: 'window', operation: 'inc.broadcast', action: 'block', reason: 'burst-exceeded' });
    f.runtime.destroy();
  });

  it.each(['config.get', 'config.subscribe', 'config.registerSchema'])('diagnoses %s floods while preserving its mandatory service response', async (type) => {
    // NAP-CONFIG bed9cb5b has mandatory snapshots/schema ACKs but no budget
    // denial code. Keep the source-owned service response, not an invented error.
    const f = await fixture(['config']);
    const config = vi.fn((_windowId: string, message: NappletMessage, send: (result: NappletMessage) => void) => {
      const id = (message as NappletMessage & { id: string }).id;
      if (type === 'config.registerSchema') send({ type: 'config.registerSchema.result', id, ok: true } as NappletMessage);
      else send({ type: 'config.values', ...(type === 'config.get' ? { id } : {}), values: { density: 'compact' } } as NappletMessage);
    });
    f.runtime.registerService('config', { descriptor: { name: 'config', version: '1' }, handleMessage: config });
    for (let i = 0; i < 3; i++) f.runtime.handleMessage('window', { type, id: `config-${i}` });
    expect(config).toHaveBeenCalledTimes(3);
    expect(f.onRateLimit).toHaveBeenCalledWith({ windowId: 'window', operation: type, action: 'flag', reason: 'burst-exceeded' });
    expect(f.ctx.sent).toEqual([0, 1, 2].map((i) => ({ windowId: 'window', message: type === 'config.registerSchema'
      ? { type: 'config.registerSchema.result', id: `config-${i}`, ok: true }
      : { type: 'config.values', ...(type === 'config.get' ? { id: `config-${i}` } : {}), values: { density: 'compact' } },
    })));
    f.runtime.destroy();
  });

  it('charges coordinated built-in services once, not again at dispatch', async () => {
    const f = await fixture(['theme']);
    let context!: ServiceRuntimeContext;
    const execute = vi.fn();
    f.runtime.registerService('theme', { descriptor: { name: 'theme', version: '1' },
      onRegistered(value) { context = value; },
      handleMessage(windowId) {
        void context.authorizeOperation!(windowId, 'theme.get', [{ category: 'interface', domain: 'theme', operation: 'access', scope: { kind: 'exact', value: 'theme' } }], execute);
      },
    });
    for (let i = 0; i < 3; i++) f.runtime.handleMessage('window', { type: 'theme.get', id: `theme-${i}` });
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    expect(f.onRateLimit).toHaveBeenCalledTimes(1);
    f.runtime.destroy();
  });
});
