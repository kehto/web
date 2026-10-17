import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPermissionState } from '@kehto/firewall';
import type { PermissionPrincipal, PermissionRequirement, PermissionState } from '@kehto/firewall';
import { createApprovalCoordinator } from './approval-coordinator.js';
import type { ApprovalAnswer, ApprovalCancellation, ApprovalCoordinatorOptions, ApprovalPrompt, ApprovalSignal } from './approval-coordinator.js';

// Host primitives exist in the test runtime; production injects these adapters.
declare const AbortController: { new(): ApprovalCancellation };
declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(handle: unknown): void;

const principal: PermissionPrincipal = { kind: 'development', target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) };
const requirement: PermissionRequirement = { category: 'resource', domain: 'link', operation: 'link.open', scope: { kind: 'exact', value: 'https://example.com/post/123' } };
const once: ApprovalAnswer = { effect: 'allow', lifetime: 'once' };
const session: ApprovalAnswer = { effect: 'allow', lifetime: 'session' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function fixture(overrides: Partial<ApprovalCoordinatorOptions> = {}) {
  let state = createPermissionState();
  let sequence = 0;
  const prompt = vi.fn(async (): Promise<ApprovalAnswer> => once);
  const coordinator = createApprovalCoordinator({ createId: () => `test-${++sequence}`,
    createCancellation: () => new AbortController(),
    schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
    getState: () => state, commit: (next) => { state = next; }, prompt, ...overrides });
  const action = vi.fn(() => 'opened');
  return { coordinator, prompt, action, state: () => state,
    replace: (next: PermissionState) => { state = next; },
    run: (current = () => true) => coordinator.run(principal, 'session-1', [requirement], current, action) };
}

afterEach(() => vi.useRealTimers());

describe('approval coordination', () => {
  it('holds the action, shows composed immutable scopes, and consumes once grants', async () => {
    const answer = deferred<ApprovalAnswer>();
    const shown = deferred<ApprovalPrompt>();
    const f = fixture({ prompt: (value) => { shown.resolve(value); return answer.promise; } });
    const result = f.run();
    const prompt = await shown.promise;
    expect(f.action).not.toHaveBeenCalled();
    expect(prompt.missing.map((item) => item.category)).toEqual(['resource', 'interface']);
    expect(Object.isFrozen(prompt.request.principal)).toBe(true);
    expect(Object.isFrozen(prompt.request.requirements[0].scope)).toBe(true);
    answer.resolve(once);
    expect(await result).toEqual({ status: 'executed', value: 'opened' });
    expect(f.action).toHaveBeenCalledTimes(1);
    expect(f.state().grants).toEqual([]);
    expect(f.coordinator.pendingCount).toBe(0);
  });

  it.each([['once', 2], ['session', 1]] as const)('deduplicates presentation without widening %s approval', async (lifetime, prompts) => {
    const prompt = vi.fn(async () => ({ effect: 'allow', lifetime } as ApprovalAnswer));
    const active = fixture({ prompt });
    const results = await Promise.all([active.run(), active.run()]);
    expect(results.map((item) => item.status)).toEqual(['executed', 'executed']);
    expect(prompt).toHaveBeenCalledTimes(prompts);
    expect(active.action).toHaveBeenCalledTimes(2);
  });

  it('cancels a hung prompt immediately and ignores its late approval', async () => {
    const answer = deferred<ApprovalAnswer>();
    const shown = deferred<ApprovalPrompt>();
    const f = fixture({ prompt: (value) => { shown.resolve(value); return answer.promise; } });
    const result = f.run();
    const prompt = await shown.promise;
    f.coordinator.cancel('session-1');
    expect(await result).toEqual({ status: 'cancelled' });
    expect(prompt.signal.aborted).toBe(true);
    answer.resolve(session);
    await Promise.resolve();
    expect(f.state().grants).toEqual([]);
    expect(f.action).not.toHaveBeenCalled();
  });

  it('bounds pending work and times out a host that never settles', async () => {
    vi.useFakeTimers();
    const f = fixture({ maxPending: 1, timeoutMs: 25, prompt: () => new Promise(() => {}) });
    const first = f.run();
    expect(await f.run()).toEqual({ status: 'busy' });
    await vi.advanceTimersByTimeAsync(25);
    expect(await first).toEqual({ status: 'cancelled' });
    expect(f.coordinator.pendingCount).toBe(0);
    expect(f.action).not.toHaveBeenCalled();
  });

  it.each(['identity', 'policy'])('rechecks %s after asynchronous approval', async (change) => {
    const answer = deferred<ApprovalAnswer>();
    const shown = deferred<ApprovalPrompt>();
    const f = fixture({ prompt: (value) => { shown.resolve(value); return answer.promise; } });
    let current = true;
    const result = f.run(() => current);
    await shown.promise;
    if (change === 'identity') current = false;
    else f.replace(createPermissionState());
    answer.resolve(session);
    expect(await result).toEqual({ status: 'cancelled' });
    expect(f.action).not.toHaveBeenCalled();
  });

  it('does not inherit the caller’s mutable scopes', async () => {
    const answer = deferred<ApprovalAnswer>();
    const shown = deferred<ApprovalPrompt>();
    const f = fixture({ prompt: (value) => { shown.resolve(value); return answer.promise; } });
    const mutable = { ...requirement, scope: { ...requirement.scope } };
    const result = f.coordinator.run(principal, 's', [mutable], () => true, f.action);
    mutable.scope.value = 'https://attacker.invalid/';
    const prompt = await shown.promise;
    expect(prompt.missing[0].scope.value).toBe(requirement.scope.value);
    answer.resolve(once);
    expect((await result).status).toBe('executed');
  });

  it.each(['missing', 'throwing', 'commit'] as const)('fails closed on %s host support', async (failure) => {
    const f = fixture(failure === 'missing' ? { prompt: undefined }
      : failure === 'throwing' ? { prompt: async () => { throw new Error('UI failed'); } }
        : { commit: () => { throw new Error('storage failed'); } });
    expect(await f.run()).toEqual({ status: 'unavailable' });
    expect(f.action).not.toHaveBeenCalled();
  });

  it('remembers a session denial and isolates other sessions', async () => {
    const prompt = vi.fn(async (): Promise<ApprovalAnswer> => ({ effect: 'deny', lifetime: 'session' }));
    const f = fixture({ prompt });
    expect(await f.run()).toEqual({ status: 'denied' });
    expect(await f.run()).toEqual({ status: 'denied' });
    expect(prompt).toHaveBeenCalledTimes(1);
    await f.coordinator.run(principal, 'other-session', [requirement], () => true, f.action);
    expect(prompt).toHaveBeenCalledTimes(2);
    expect(f.action).not.toHaveBeenCalled();
  });

  it('rejects persistent development grants', async () => {
    const f = fixture({ prompt: async () => ({ effect: 'allow', lifetime: 'persistent' }) });
    expect(await f.run()).toEqual({ status: 'unavailable' });
    expect(f.action).not.toHaveBeenCalled();
  });

  it('drops a late action result after cancellation and aborts its signal', async () => {
    const action = deferred<string>();
    const started = deferred<ApprovalSignal>();
    const f = fixture();
    const result = f.coordinator.run(principal, 's', [requirement], () => true, (signal) => {
      started.resolve(signal); return action.promise;
    });
    const signal = await started.promise;
    f.coordinator.cancel('s');
    expect(await result).toEqual({ status: 'cancelled' });
    expect(signal.aborted).toBe(true);
    action.resolve('late');
  });

  it('does not poison the queue when an action throws', async () => {
    const f = fixture({ prompt: async () => session });
    const first = f.coordinator.run(principal, 'session-1', [requirement], () => true, () => { throw new Error('backend failed'); });
    const next = f.run();
    await expect(first).rejects.toThrow('backend failed');
    expect((await next).status).toBe('executed');
  });

  it('disposes queued operations and refuses further work', async () => {
    const f = fixture();
    const first = f.run();
    f.coordinator.dispose();
    expect(await first).toEqual({ status: 'cancelled' });
    expect(await f.run()).toEqual({ status: 'cancelled' });
    expect(f.action).not.toHaveBeenCalled();
  });
});
