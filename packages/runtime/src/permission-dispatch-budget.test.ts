import { describe, expect, it, vi } from 'vitest';
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
    for (let i = 0; i < 3; i++) f.runtime.handleMessage('window', { type: 'storage.set', id: `set-${i}`, key: `key-${i}`, value: i });
    expect(set).toHaveBeenCalledTimes(2);
    expect(f.onRateLimit).toHaveBeenCalledWith({ windowId: 'window', operation: 'storage.set', action: 'block', reason: 'burst-exceeded' });
    f.runtime.destroy();
  });

  it('bounds config callbacks and shares the burst with INC', async () => {
    const f = await fixture(['config', 'inc']);
    const config = vi.fn();
    f.runtime.registerService('config', { descriptor: { name: 'config', version: '1' }, handleMessage: config });
    f.runtime.handleMessage('window', { type: 'config.get', id: 'one' });
    f.runtime.handleMessage('window', { type: 'inc.broadcast', id: 'two', topic: 'test', payload: {} });
    f.runtime.handleMessage('window', { type: 'config.get', id: 'three' });
    expect(config).toHaveBeenCalledTimes(1);
    expect(f.onRateLimit).toHaveBeenCalledWith({ windowId: 'window', operation: 'config.get', action: 'block', reason: 'burst-exceeded' });
    f.runtime.destroy();
  });

  it('bounds INC broadcasts before fanout', async () => {
    const f = await fixture(['inc']);
    for (let i = 0; i < 3; i++) f.runtime.handleMessage('window', { type: 'inc.broadcast', id: `broadcast-${i}`, topic: 'test', payload: {} });
    expect(f.onRateLimit).toHaveBeenCalledTimes(1);
    expect(f.onRateLimit).toHaveBeenCalledWith({ windowId: 'window', operation: 'inc.broadcast', action: 'block', reason: 'burst-exceeded' });
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
