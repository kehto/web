import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { createRuntime } from './runtime.js';
import { createFirewallState } from './firewall-state.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import { defaultRateLimitConfig } from './rate-limit.js';
import type { RateLimitConfig } from './rate-limit.js';
import type { ApprovalCancellation } from './approval-coordinator.js';
import type { PermissionAdapter } from './permission-runtime.js';
import type { RuntimeAdapter } from './types.js';

declare const AbortController: { new(): ApprovalCancellation };
declare const console: { warn(message: string): void };
declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(handle: unknown): void;

const WARNING = 'FW-RUNTIME-LEGACY-IGNORED-001';
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
  let now = 0;
  const ctx = createMockRuntimeAdapter({
    permissions: permissionAdapter({ now: () => now, onRateLimit, rateLimit }),
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
  return { runtime, ctx, onRateLimit, store, permissions: runtime.permissions! };
}

/** A generous startup budget, so these tests can isolate the part they change. */
function budget(overrides: Partial<RateLimitConfig> = {}): RateLimitConfig {
  return { ...defaultRateLimitConfig(), capacity: 100, action: 'block', ...overrides };
}

describe('RuntimePermissions.setRateLimit (#400 on configured hosts)', () => {
  it('reports the adapter budget, then the default when the adapter sets none', async () => {
    const f = await fixture(budget());
    expect(f.permissions.rateLimit.capacity).toBe(100);
    const bare = createRuntime(createMockRuntimeAdapter({ permissions: permissionAdapter() }).hooks);
    expect(bare.permissions!.rateLimit).toEqual(defaultRateLimitConfig());
    f.runtime.destroy();
    bare.destroy();
  });

  it('tightens the startup burst guard from the next operation', async () => {
    const f = await fixture(budget());
    expect(f.store(1)).toBe(1);
    f.permissions.setRateLimit({ ...f.permissions.rateLimit, burst: { windowMs: 3_000, maxOperations: 2, action: 'block' } });
    expect(f.store(3)).toBe(2);
    expect(f.onRateLimit).toHaveBeenCalledWith({ windowId: 'window', operation: 'storage.set', action: 'block', reason: 'burst-exceeded' });
    f.runtime.destroy();
  });

  it('turns the burst guard off with a zero window', async () => {
    const f = await fixture(budget({ burst: { windowMs: 3_000, maxOperations: 1, action: 'block' } }));
    f.permissions.setRateLimit({ ...f.permissions.rateLimit, burst: { windowMs: 0, maxOperations: 0, action: 'block' } });
    expect(f.store(5)).toBe(5);
    f.runtime.destroy();
  });

  it('keeps counters already running when the budget changes', async () => {
    const f = await fixture(budget({ capacity: 3 }), {}, LATE);
    expect(f.store(2)).toBe(2);
    f.permissions.setRateLimit({ ...f.permissions.rateLimit, windowMs: 120_000 });
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
    const before = f.permissions.rateLimit;
    expect(() => f.permissions.setRateLimit({ ...before, ...override })).toThrow(RangeError);
    expect(f.permissions.rateLimit).toBe(before);
    expect(f.store(1)).toBe(1);
    f.runtime.destroy();
  });

  it('detaches the applied budget from the caller', async () => {
    const f = await fixture(budget());
    const mine = { ...budget(), burst: { windowMs: 3_000, maxOperations: 1, action: 'block' as const } };
    f.permissions.setRateLimit(mine);
    mine.burst.maxOperations = 100;
    expect(f.store(3)).toBe(1);
    f.runtime.destroy();
  });

  it('leaves the blocking prompt budget alone', async () => {
    const prompt = vi.fn(async () => ({ effect: 'allow' as const, lifetime: 'session' as const }));
    const ctx = createMockRuntimeAdapter({ permissions: permissionAdapter({ prompt }) });
    const runtime = createRuntime(ctx.hooks);
    runtime.permissions!.setRateLimit(budget({ capacity: 1, burst: { windowMs: 3_000, maxOperations: 0, action: 'block' } }));
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
    f.permissions.setRateLimit({ ...f.permissions.rateLimit, unfocusedMultiplier: 0.5 });
    expect(f.store(20)).toBe(2);
    f.runtime.destroy();
  });

  it('keeps the full budget for a focused window', async () => {
    const f = await fixture(budget({ capacity: 4, unfocusedMultiplier: 0.5 }), { getFocusContext: () => ({ focused: true }) }, LATE);
    expect(f.store(20)).toBe(4);
    f.runtime.destroy();
  });
});

describe(`${WARNING}`, () => {
  let warn: MockInstance<(message: string) => void>;
  const warnings = (): string[] => warn.mock.calls.map(([text]) => String(text)).filter((text) => text.startsWith(WARNING));

  beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined); });
  afterEach(() => { warn.mockRestore(); });

  it('names every replacement in one warning without request data', async () => {
    const f = await fixture(budget(), { onFirewallEvent: () => undefined });
    f.store(1);
    expect(warnings()).toEqual([expect.stringContaining('warns once per runtime instance')]);
    for (const replacement of ['permissions.onRateLimit', 'permissions.persistence', 'runtime.permissions.setRateLimit']) {
      expect(warnings()[0]).toContain(replacement);
    }
    expect(warnings()[0]).not.toContain('key-1');
    f.runtime.destroy();
  });

  it.each([
    ['onFirewallEvent', { onFirewallEvent: () => undefined }],
    ['firewallPersistence', { firewallPersistence: { persist: () => undefined, load: () => null } }],
  ])('warns at creation when %s is set on a configured runtime', async (_name, hooks) => {
    const runtime = createRuntime(createMockRuntimeAdapter({ permissions: permissionAdapter(), ...hooks }).hooks);
    expect(warnings()).toHaveLength(1);
    runtime.destroy();
  });

  it.each([
    ['setUnfocusedMultiplier', (r: ReturnType<typeof createRuntime>) => r.firewallState.setUnfocusedMultiplier(0.5)],
    ['setBurstGuard', (r: ReturnType<typeof createRuntime>) => r.firewallState.setBurstGuard({ windowMs: 1, maxOps: 1, action: 'block' })],
    ['setPolicy', (r: ReturnType<typeof createRuntime>) => r.firewallState.setPolicy('app', 'deny')],
    ['setRateLimit', (r: ReturnType<typeof createRuntime>) => r.firewallState.setRateLimit('app', 'relay:read', { capacity: 1, windowMs: 1, action: 'block' } as never)],
    ['setGlobalRate', (r: ReturnType<typeof createRuntime>) => r.firewallState.setGlobalRate('app', { capacity: 1, windowMs: 1, action: 'block' } as never)],
    ['addMatcher', (r: ReturnType<typeof createRuntime>) => r.firewallState.addMatcher({ id: 'm', kind: 'word', value: 'x', action: 'block' } as never)],
  ])('warns once when %s is called on a configured runtime', (_name, call) => {
    const runtime = createRuntime(createMockRuntimeAdapter({ permissions: permissionAdapter() }).hooks);
    call(runtime);
    call(runtime);
    expect(warnings()).toHaveLength(1);
    runtime.destroy();
  });

  it('does not let the legacy setters change a configured budget', async () => {
    const f = await fixture(budget({ burst: { windowMs: 3_000, maxOperations: 2, action: 'block' } }));
    f.runtime.firewallState.setBurstGuard({ windowMs: 0, maxOps: 0, action: 'block' });
    f.runtime.firewallState.setUnfocusedMultiplier(4);
    expect(f.store(5)).toBe(2);
    f.runtime.destroy();
  });

  it('stays quiet for canonical configured use', async () => {
    const f = await fixture(budget());
    f.permissions.setRateLimit(budget());
    f.store(2);
    expect(warnings()).toEqual([]);
    f.runtime.destroy();
  });

  it('stays quiet on a legacy runtime, where these inputs still work', () => {
    const events = vi.fn();
    const runtime = createRuntime(createMockRuntimeAdapter({ onFirewallEvent: events }).hooks);
    runtime.firewallState.setBurstGuard({ windowMs: 1, maxOps: 1, action: 'block' });
    expect(runtime.firewallState.getConfig().burstGuard.maxOps).toBe(1);
    expect(warnings()).toEqual([]);
    runtime.destroy();
  });

  it('tells a validation failure from a mutation', () => {
    const onMutation = vi.fn();
    const state = createFirewallState(undefined, onMutation);
    expect(() => state.setUnfocusedMultiplier(0)).toThrow(RangeError);
    expect(onMutation).not.toHaveBeenCalled();
  });
});
