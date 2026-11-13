import { describe, expect, it, vi } from 'vitest';
import { createRuntime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import type { ApprovalCancellation } from './approval-coordinator.js';
import { createRateLimiter, defaultRateLimitConfig, defaultPromptRateLimitConfig } from '@kehto/rate-limit';

declare const AbortController: { new(): ApprovalCancellation };
declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(handle: unknown): void;

describe('optional temporal protection', () => {
  it('finishes sibling and service cleanup when a supplied limiter retirement throws', async () => {
    const retire = vi.fn(() => { throw new Error('host cleanup failed'); });
    const promptRetire = vi.fn();
    const onUnregistered = vi.fn();
    const evaluate = () => ({ allowed: true, action: 'ignore' as const, reason: 'within-budget' as const });
    const ctx = createMockRuntimeAdapter({ permissions: {
      now: () => 0, prompt: async () => ({ effect: 'allow', lifetime: 'session' }),
      rateLimiter: { evaluate, retire }, promptRateLimiter: { evaluate, retire: promptRetire },
      createCancellation: () => new AbortController(),
      schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
    } });
    const runtime = createRuntime(ctx.hooks);
    runtime.registerService('example', { descriptor: { name: 'example', version: '1' }, handleMessage: vi.fn(), onUnregistered });
    for (const windowId of ['first', 'second']) {
      runtime.sessionRegistry.register(windowId, {
        ...createNip5dSessionEntry(windowId, 'app', 'a'.repeat(64)),
        permissionPrincipal: { kind: 'development', target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) },
      });
      await runtime.permissions!.admit(windowId, { required: ['storage'], optional: [], available: ['storage'] });
    }
    expect(() => runtime.destroy()).not.toThrow();
    expect(retire).toHaveBeenCalledTimes(2);
    expect(promptRetire).toHaveBeenCalledTimes(2);
    expect(onUnregistered).toHaveBeenCalledOnce();
    expect(runtime.permissions!.grants).toEqual([]);
  });

  it.each(['legacy', 'permissions', 'prompts'])('does not throttle storage without an operation limiter (%s)', async (mode) => {
    const ctx = createMockRuntimeAdapter(mode !== 'legacy' ? { permissions: {
      now: () => 0,
      prompt: async () => ({ effect: 'allow', lifetime: 'session' }),
      ...(mode === 'prompts' ? { promptRateLimiter: createRateLimiter(defaultPromptRateLimitConfig()) } : {}),
      createCancellation: () => new AbortController(),
      schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
    } } : {});
    const runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register('window', {
      ...createNip5dSessionEntry('window', 'app', 'a'.repeat(64)),
      permissionPrincipal: { kind: 'development', target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) },
    });
    await runtime.permissions?.admit('window', { required: ['storage'], optional: [], available: ['storage'] });
    for (let i = 0; i < 100; i++) runtime.handleMessage('window', { type: 'storage.set', id: String(i), key: String(i), value: 'value' });
    expect(ctx.stateStore.size).toBe(100);
    runtime.destroy();
  });

  it.each(['none', 'operations', 'prompts'])('only throttles prompts when explicitly installed (%s)', async (policy) => {
    const prompt = vi.fn(async () => ({ effect: 'allow' as const, lifetime: 'once' as const }));
    const ctx = createMockRuntimeAdapter({ permissions: {
      now: () => 0, prompt, createCancellation: () => new AbortController(),
      ...(policy === 'operations' ? { rateLimiter: createRateLimiter(defaultRateLimitConfig()) } : {}),
      ...(policy === 'prompts' ? { promptRateLimiter: createRateLimiter(defaultPromptRateLimitConfig()) } : {}),
      schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
    } });
    const runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register('window', {
      ...createNip5dSessionEntry('window', 'app', 'a'.repeat(64)),
      permissionPrincipal: { kind: 'development', target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) },
    });
    for (let i = 0; i < 20; i++) {
      await runtime.permissions!.admit('window', { required: ['storage'], optional: [], available: ['storage'] });
    }
    expect(prompt).toHaveBeenCalledTimes(policy === 'prompts' ? 8 : 20);
    runtime.destroy();
  });
});
