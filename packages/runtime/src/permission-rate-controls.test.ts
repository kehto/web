import { createRateLimiter } from '@kehto/rate-limit';
import { describe, expect, it, vi } from 'vitest';
import { createRuntime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import { defaultRateLimitConfig } from '@kehto/rate-limit';
import type { RateLimitConfig } from '@kehto/rate-limit';
import type { ApprovalCancellation } from './approval-coordinator.js';
import type { PermissionAdapter } from './permission-runtime.js';
import type { RuntimeAdapter } from './types.js';

declare const AbortController: { new(): ApprovalCancellation };
declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(handle: unknown): void;

const LATE = 60_000;

function permissionAdapter(overrides: Partial<PermissionAdapter> = {}): PermissionAdapter {
  return {
    now: () => 0,
    prompt: async () => ({ effect: 'allow', lifetime: 'session' }),
    createCancellation: () => new AbortController(),
    schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
    ...overrides,
  };
}

/** A runtime with storage admitted. `at` moves the clock past or inside the burst window. */
async function fixture(rateLimit: RateLimitConfig, hooks: Partial<RuntimeAdapter> = {}, at = 0) {
  const onRateLimit = vi.fn();
  const limiter = createRateLimiter(rateLimit);
  let now = 0;
  const ctx = createMockRuntimeAdapter({
    permissions: permissionAdapter({ now: () => now, onRateLimit, rateLimiter: limiter }),
    ...hooks,
  });
  const runtime = createRuntime(ctx.hooks);
  runtime.sessionRegistry.register('window', {
    ...createNip5dSessionEntry('window', 'app', 'a'.repeat(64)),
    permissionPrincipal: { kind: 'development', target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) },
  });
  await runtime.permissions!.admit('window', { required: ['storage'], optional: [], available: ['storage'] });
  now = at;
  let sequence = 0;
  const store = (count: number): number => {
    for (let i = 0; i < count; i++) {
      sequence += 1;
      runtime.handleMessage('window', { type: 'storage.set', id: `set-${sequence}`, key: `key-${sequence}`, value: 'v' });
    }
    return ctx.stateStore.size;
  };
  return { runtime, ctx, onRateLimit, store, limiter, permissions: runtime.permissions! };
}

/** A generous startup budget, so these tests can isolate the part they change. */
function budget(overrides: Partial<RateLimitConfig> = {}): RateLimitConfig {
  return { ...defaultRateLimitConfig(), capacity: 100, action: 'block', ...overrides };
}

describe('host-owned limiter configuration', () => {
  it('tightens the startup burst guard from the next operation', async () => {
    const f = await fixture(budget());
    expect(f.store(1)).toBe(1);
    f.limiter.setConfig({ ...f.limiter.config, burst: { windowMs: 3_000, maxOperations: 2, action: 'block' } });
    expect(f.store(3)).toBe(2);
    expect(f.onRateLimit).toHaveBeenCalledWith({ windowId: 'window', operation: 'storage.set', action: 'block', reason: 'burst-exceeded' });
    f.runtime.destroy();
  });

  it('turns the burst guard off with a zero window', async () => {
    const f = await fixture(budget({ burst: { windowMs: 3_000, maxOperations: 1, action: 'block' } }));
    f.limiter.setConfig({ ...f.limiter.config, burst: { windowMs: 0, maxOperations: 0, action: 'block' } });
    expect(f.store(5)).toBe(5);
    f.runtime.destroy();
  });

  it('keeps counters already running when the budget changes', async () => {
    const f = await fixture(budget({ capacity: 3 }), {}, LATE);
    expect(f.store(2)).toBe(2);
    f.limiter.setConfig({ ...f.limiter.config, windowMs: 120_000 });
    expect(f.store(5)).toBe(3);
    f.runtime.destroy();
  });

  it.each([
    ['multiplier of zero', { unfocusedMultiplier: 0 }],
    ['nonfinite multiplier', { unfocusedMultiplier: NaN }],
    ['negative burst window', { burst: { windowMs: -1, maxOperations: 1, action: 'block' as const } }],
    ['fractional burst limit', { burst: { windowMs: 1, maxOperations: 1.5, action: 'block' as const } }],
    ['unknown action', { action: 'allow' as never }],
  ])('throws on a %s and leaves the budget working', async (_name, override) => {
    const f = await fixture(budget());
    const before = f.limiter.config;
    expect(() => f.limiter.setConfig({ ...before, ...override })).toThrow(RangeError);
    expect(f.limiter.config).toBe(before);
    expect(f.store(1)).toBe(1);
    f.runtime.destroy();
  });

  it('detaches the applied budget from the caller', async () => {
    const f = await fixture(budget());
    const mine = { ...budget(), burst: { windowMs: 3_000, maxOperations: 1, action: 'block' as const } };
    f.limiter.setConfig(mine);
    mine.burst.maxOperations = 100;
    expect(f.store(3)).toBe(1);
    f.runtime.destroy();
  });

  it('leaves the blocking prompt budget alone', async () => {
    const prompt = vi.fn(async () => ({ effect: 'allow' as const, lifetime: 'session' as const }));
    const ctx = createMockRuntimeAdapter({ permissions: permissionAdapter({ prompt, rateLimiter: createRateLimiter(budget({ capacity: 1, burst: { windowMs: 3_000, maxOperations: 0, action: 'block' } })) }) });
    const runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register('window', {
      ...createNip5dSessionEntry('window', 'app', 'a'.repeat(64)),
      permissionPrincipal: { kind: 'development', target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) },
    });
    await runtime.permissions!.admit('window', { required: ['storage'], optional: [], available: ['storage'] });
    expect(prompt).toHaveBeenCalledTimes(1);
    runtime.destroy();
  });
});

describe('getFocusContext on configured hosts (#397)', () => {
  it.each([
    ['tightens', 0.5, 2],
    ['loosens past the focused budget', 2, 8],
  ])('%s an unfocused budget with the multiplier', async (_name, unfocusedMultiplier, expected) => {
    const f = await fixture(budget({ capacity: 4, unfocusedMultiplier }), { getFocusContext: () => ({ focused: false }) }, LATE);
    expect(f.store(20)).toBe(expected);
    f.runtime.destroy();
  });

  it('applies a multiplier changed after creation', async () => {
    const f = await fixture(budget({ capacity: 4, unfocusedMultiplier: 1 }), { getFocusContext: () => ({ focused: false }) }, LATE);
    f.limiter.setConfig({ ...f.limiter.config, unfocusedMultiplier: 0.5 });
    expect(f.store(20)).toBe(2);
    f.runtime.destroy();
  });

  it('keeps the full budget for a focused window', async () => {
    const f = await fixture(budget({ capacity: 4, unfocusedMultiplier: 0.5 }), { getFocusContext: () => ({ focused: true }) }, LATE);
    expect(f.store(20)).toBe(4);
    f.runtime.destroy();
  });
});
