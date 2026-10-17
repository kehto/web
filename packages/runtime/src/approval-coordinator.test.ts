import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPermissionState, putPermissionGrant } from '@kehto/firewall';
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
  it('rejects a pre-cancelled request without prompting or reserving queue capacity', async () => {
    const f = fixture();
    const request = new AbortController();
    request.abort();
    const result = await f.coordinator.run(principal, 'session-1', [requirement], () => true, f.action, undefined, request.signal);
    expect(result).toEqual({ status: 'cancelled' });
    expect(f.prompt).not.toHaveBeenCalled();
    expect(f.action).not.toHaveBeenCalled();
    expect(f.coordinator.pendingCount).toBe(0);
  });

  it('cancels one prompt without cancelling its queued sibling or accepting a late grant', async () => {
    const answer = deferred<ApprovalAnswer>();
    const shown = deferred<ApprovalPrompt>();
    const prompt = vi.fn().mockImplementationOnce((value: ApprovalPrompt) => {
      shown.resolve(value); return answer.promise;
    }).mockResolvedValue(once);
    const f = fixture({ prompt });
    const request = new AbortController();
    const first = f.coordinator.run(principal, 'session-1', [requirement], () => true, f.action, undefined, request.signal);
    const second = f.run();
    const displayed = await shown.promise;
    request.abort();
    expect(await first).toEqual({ status: 'cancelled' });
    expect(displayed.signal.aborted).toBe(true);
    expect(await second).toEqual({ status: 'executed', value: 'opened' });
    answer.resolve(session);
    await Promise.resolve();
    expect(f.state().grants).toEqual([]);
    expect(f.action).toHaveBeenCalledTimes(1);
    expect(f.coordinator.pendingCount).toBe(0);
  });

  it('settles cancellation while queued without waiting for the preceding prompt', async () => {
    const answer = deferred<ApprovalAnswer>();
    const shown = deferred<ApprovalPrompt>();
    const f = fixture({ prompt: (value) => { shown.resolve(value); return answer.promise; } });
    const first = f.run();
    await shown.promise;
    const request = new AbortController();
    const second = f.coordinator.run(principal, 'session-1', [requirement], () => true, f.action, undefined, request.signal);
    request.abort();
    expect(await second).toEqual({ status: 'cancelled' });
    answer.resolve(once);
    expect(await first).toEqual({ status: 'executed', value: 'opened' });
    expect(f.action).toHaveBeenCalledTimes(1);
  });

  it('keeps later equivalents behind the active prompt when a queued request cancels', async () => {
    const answer = deferred<ApprovalAnswer>();
    const shown = deferred<ApprovalPrompt>();
    const prompt = vi.fn((value: ApprovalPrompt) => { shown.resolve(value); return answer.promise; });
    const f = fixture({ prompt });
    const first = f.run();
    await shown.promise;
    const request = new AbortController();
    const second = f.coordinator.run(principal, 'session-1', [requirement], () => true, f.action, undefined, request.signal);
    request.abort();
    expect(await second).toEqual({ status: 'cancelled' });
    const third = f.run();
    await Promise.resolve();
    await Promise.resolve();
    expect(prompt).toHaveBeenCalledTimes(1);
    answer.resolve(session);
    expect((await first).status).toBe('executed');
    expect((await third).status).toBe('executed');
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(f.action).toHaveBeenCalledTimes(2);
  });

  it('aborts the active callback and releases its request listener', async () => {
    const f = fixture();
    const request = new AbortController();
    const remove = vi.spyOn(request.signal, 'removeEventListener');
    const started = deferred<ApprovalSignal>();
    const done = deferred<string>();
    const result = f.coordinator.run(principal, 'session-1', [requirement], () => true, (signal) => {
      started.resolve(signal); return done.promise;
    }, undefined, request.signal);
    const active = await started.promise;
    request.abort();
    expect(await result).toEqual({ status: 'cancelled' });
    expect(active.aborted).toBe(true);
    expect(remove).toHaveBeenCalledTimes(1);
    done.resolve('late');
  });

  it('bounds cancelled queue placeholders retained behind a pending prompt', async () => {
    const shown = deferred<ApprovalPrompt>();
    const f = fixture({ maxPending: 2, prompt: (value) => {
      shown.resolve(value); return new Promise(() => {});
    } });
    const first = f.run();
    await shown.promise;
    const request = new AbortController();
    const second = f.coordinator.run(principal, 'session-1', [requirement], () => true, f.action, undefined, request.signal);
    request.abort();
    expect(await second).toEqual({ status: 'cancelled' });
    expect(await f.run()).toEqual({ status: 'busy' });
    f.coordinator.dispose();
    expect(await first).toEqual({ status: 'cancelled' });
  });

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
    else f.replace(putPermissionGrant(f.state(), { id: 'deny', principal, permission: requirement,
      effect: 'deny', lifetime: 'session', sessionId: 'session-1' }));
    answer.resolve(session);
    expect(await result).toEqual({ status: change === 'identity' ? 'cancelled' : 'denied' });
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

  it('preserves both approvals when different sessions prompt concurrently', async () => {
    const answers = [deferred<ApprovalAnswer>(), deferred<ApprovalAnswer>()];
    const shown = deferred<void>();
    let count = 0;
    const f = fixture({ prompt: () => {
      const answer = answers[count++];
      if (count === 2) shown.resolve();
      return answer.promise;
    } });
    const first = f.run();
    const second = f.coordinator.run(principal, 'session-2', [requirement], () => true, f.action);
    await shown.promise;
    answers[0].resolve(session);
    expect((await first).status).toBe('executed');
    answers[1].resolve(session);
    expect((await second).status).toBe('executed');
    expect(new Set(f.state().grants.map((grant) => grant.sessionId))).toEqual(new Set(['session-1', 'session-2']));
    expect(f.action).toHaveBeenCalledTimes(2);
  });

  it('does not approve a prerequisite removed after the prompt was shown', async () => {
    const answer = deferred<ApprovalAnswer>();
    const shown = deferred<ApprovalPrompt>();
    const f = fixture({ prompt: (value) => { shown.resolve(value); return answer.promise; } });
    f.replace(putPermissionGrant(f.state(), { id: 'resource', principal, permission: requirement,
      effect: 'allow', lifetime: 'session', sessionId: 'session-1' }));
    const result = f.run();
    expect((await shown.promise).missing.map((item) => item.category)).toEqual(['interface']);
    f.replace(createPermissionState());
    answer.resolve(session);
    expect(await result).toEqual({ status: 'cancelled' });
    expect(f.state().grants).toEqual([]);
    expect(f.action).not.toHaveBeenCalled();
  });

  it.each(['unrelated', 'relevant'] as const)('revalidates %s policy changes during an action', async (change) => {
    const done = deferred<string>();
    const started = deferred<void>();
    const f = fixture({ prompt: async () => session });
    const result = f.coordinator.run(principal, 'session-1', [requirement], () => true, () => {
      started.resolve(); return done.promise;
    });
    await started.promise;
    f.replace(change === 'relevant' ? createPermissionState() : putPermissionGrant(f.state(), {
      id: 'other-session', principal, permission: requirement, effect: 'allow', lifetime: 'session', sessionId: 'other',
    }));
    done.resolve('opened');
    expect(await result).toEqual(change === 'relevant' ? { status: 'cancelled' } : { status: 'executed', value: 'opened' });
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
