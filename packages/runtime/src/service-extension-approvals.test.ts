import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createRuntime } from './runtime.js';
import { defaultPromptRateLimitConfig, defaultRateLimitConfig } from './rate-limit.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import type { PermissionAdapter } from './permission-runtime.js';
import type { ApprovalAnswer, ApprovalCancellation, ApprovalPrompt } from './approval-coordinator.js';
import type { ServiceHandler, ServiceRuntimeContext } from './types.js';

declare const AbortController: { new(): ApprovalCancellation };
declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(handle: unknown): void;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function flush() { await new Promise<void>((resolve) => setTimeout(resolve, 0)); }

function fixture(overrides: Partial<PermissionAdapter> = {}, changes: Partial<ServiceHandler> = {}) {
  const prompt = vi.fn(async (): Promise<ApprovalAnswer> => ({ effect: 'allow', lifetime: 'session' }));
  const handler: ServiceHandler = {
    descriptor: { name: 'example', version: '1' },
    messageCapabilities: { 'example.run': null, 'example.read': 'state:read' },
    handleMessage: vi.fn((_windowId, msg, send) => send({ type: 'example.result', id: (msg as { id: string }).id } as NappletMessage)),
    ...changes,
  };
  const adapter = createMockRuntimeAdapter({ services: { example: handler }, isDomainAllowed: () => true,
    permissions: { prompt, now: () => 0, createCancellation: () => new AbortController(),
      schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); }, ...overrides },
  });
  const runtime = createRuntime(adapter.hooks);
  const entry = { ...createNip5dSessionEntry('window', 'app', 'a'.repeat(64)),
    permissionPrincipal: { kind: 'development' as const, target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) } };
  runtime.sessionRegistry.register('window', entry);
  return { runtime, handler, prompt, entry, ...adapter,
    send: (id: string) => runtime.handleMessage('window', { type: 'example.run', id }) };
}

describe('registered extension scoped approvals', () => {
  it('propagates service request cancellation through the runtime without granting a late answer', async () => {
    const answer = deferred<ApprovalAnswer>();
    const shown = deferred<ApprovalPrompt>();
    let context!: ServiceRuntimeContext;
    const f = fixture({ prompt: (value) => { shown.resolve(value); return answer.promise; } }, {
      onRegistered: (value) => { context = value; },
    });
    const request = new AbortController();
    const action = vi.fn();
    const result = context.authorizeOperation!('window', 'example.run', [{
      category: 'interface', domain: 'example', operation: 'access', scope: { kind: 'exact', value: 'example' },
    }], action, request.signal);
    const prompt = await shown.promise;
    request.abort();
    expect(await result).toEqual({ status: 'cancelled' });
    expect(prompt.signal.aborted).toBe(true);
    answer.resolve({ effect: 'allow', lifetime: 'session' });
    await flush();
    expect(action).not.toHaveBeenCalled();
    expect(f.runtime.permissions?.grants).toEqual([]);
    f.runtime.destroy();
  });

  it('holds a detached request and dispatches only the approved payload once', async () => {
    const answer = deferred<ApprovalAnswer>();
    const shown = deferred<ApprovalPrompt>();
    const f = fixture({ prompt: (prompt) => { shown.resolve(prompt); return answer.promise; } });
    const request = { type: 'example.run', id: 'one', payload: { value: 'approved' } };
    f.runtime.handleMessage('window', request);
    const prompt = await shown.promise;
    request.payload.value = 'changed'; request.id = 'other';
    expect(prompt.missing).toEqual([{ category: 'interface', domain: 'example', operation: 'access', scope: { kind: 'exact', value: 'example' } }]);
    expect(f.handler.handleMessage).not.toHaveBeenCalled();
    answer.resolve({ effect: 'allow', lifetime: 'once' }); await flush();
    expect(f.handler.handleMessage).toHaveBeenCalledWith('window', { type: 'example.run', id: 'one', payload: { value: 'approved' } }, expect.any(Function));
    expect(f.sent).toEqual([{ windowId: 'window', message: { type: 'example.result', id: 'one' } }]);
    f.send('one'); await flush();
    expect(f.handler.handleMessage).toHaveBeenCalledTimes(1);
    f.runtime.destroy();
  });

  it.each([['once', 2], ['session', 1]] as const)('honors %s grant lifetime for equivalent concurrent calls', async (lifetime, count) => {
    const prompt = vi.fn(async (): Promise<ApprovalAnswer> => ({ effect: 'allow', lifetime }));
    const f = fixture({ prompt });
    f.send('one'); f.send('two'); await flush();
    expect(prompt).toHaveBeenCalledTimes(count);
    expect(f.handler.handleMessage).toHaveBeenCalledTimes(2);
    f.runtime.destroy();
  });

  it('lets the host project a denial without invoking its operation handler', async () => {
    const denied = vi.fn((_windowId, message, reason, send) => send({ type: 'example.refused', id: message.id, reason }));
    const f = fixture({ prompt: async () => ({ effect: 'deny', lifetime: 'once' }) }, { onPermissionDenied: denied });
    f.send('one'); await flush();
    expect(f.handler.handleMessage).not.toHaveBeenCalled();
    expect(denied).toHaveBeenCalledTimes(1);
    expect(f.sent).toEqual([{ windowId: 'window', message: { type: 'example.refused', id: 'one', reason: 'denied' } }]);
    f.runtime.destroy();
  });

  it('does not invent errors when the extension has no denial projection', async () => {
    const f = fixture({ prompt: async () => ({ effect: 'deny', lifetime: 'once' }) });
    f.send('one'); await flush();
    expect(f.sent).toEqual([]);
    expect(f.handler.handleMessage).not.toHaveBeenCalled();
    f.runtime.destroy();
  });

  it('keeps unknown, malformed, and ACL-denied requests out of prompting', async () => {
    const f = fixture();
    f.runtime.handleMessage('window', { type: 'example.unknown', id: 'one' });
    f.runtime.handleMessage('window', { type: 'example.run', id: 'two', callback: () => {} });
    f.runtime.aclState.revoke('', 'app', 'a'.repeat(64), 'state:read');
    f.runtime.handleMessage('window', { type: 'example.read', id: 'three' });
    await flush();
    expect(f.prompt).not.toHaveBeenCalled();
    expect(f.handler.handleMessage).not.toHaveBeenCalled();
    expect(f.sent).toEqual([]);
    f.runtime.destroy();
  });

  it('revalidates declared capabilities while the approval is pending', async () => {
    const answer = deferred<ApprovalAnswer>();
    const shown = deferred<ApprovalPrompt>();
    const f = fixture({ prompt: (prompt) => { shown.resolve(prompt); return answer.promise; } });
    f.runtime.handleMessage('window', { type: 'example.read', id: 'one' });
    const prompt = await shown.promise;
    f.runtime.aclState.revoke('', 'app', 'a'.repeat(64), 'state:read');
    expect(prompt.signal.aborted).toBe(true);
    answer.resolve({ effect: 'allow', lifetime: 'session' }); await flush();
    expect(f.handler.handleMessage).not.toHaveBeenCalled();
    f.runtime.destroy();
  });

  it.each(['source', 'service', 'teardown'] as const)('invalidates pending approvals after %s replacement', async (change) => {
    const answer = deferred<ApprovalAnswer>();
    const shown = deferred<ApprovalPrompt>();
    const f = fixture({ prompt: (prompt) => { shown.resolve(prompt); return answer.promise; } });
    f.send('one'); const prompt = await shown.promise;
    if (change === 'source') f.runtime.sessionRegistry.register('window', { ...f.entry });
    else if (change === 'service') f.runtime.registerService('example', f.handler);
    else f.runtime.destroyWindow('window');
    expect(prompt.signal.aborted).toBe(true);
    answer.resolve({ effect: 'allow', lifetime: 'session' }); await flush();
    expect(f.handler.handleMessage).not.toHaveBeenCalled();
    expect(f.sent).toEqual([]);
    f.runtime.destroy();
  });

  it('revokes deferred replies without clearing replay history', async () => {
    let later!: (message: NappletMessage) => void;
    const action = vi.fn((_windowId, _message, send) => { later = send; });
    const f = fixture({}, { handleMessage: action });
    f.send('one'); await flush();
    f.runtime.permissions!.revoke(f.runtime.permissions!.grants[0].id);
    later({ type: 'example.result', id: 'one' } as NappletMessage);
    f.send('one'); await flush();
    expect(action).toHaveBeenCalledTimes(1);
    expect(f.sent).toEqual([]);
    f.runtime.destroy();
  });

  it('enforces independent rates despite legacy broad allow and a scoped grant', async () => {
    const f = fixture({ rateLimit: { ...defaultRateLimitConfig(), capacity: 1, action: 'block' } });
    f.runtime.firewallState.setPolicy('app', 'allow');
    f.send('one'); await flush();
    f.send('two'); await flush();
    expect(f.prompt).toHaveBeenCalledTimes(1);
    expect(f.handler.handleMessage).toHaveBeenCalledTimes(1);
    f.runtime.destroy();
  });

  it('blocks prompt spam independently of operation audit settings', async () => {
    const prompt = vi.fn(async (): Promise<ApprovalAnswer> => ({ effect: 'deny', lifetime: 'once' }));
    const onRateLimit = vi.fn();
    const f = fixture({ prompt, onRateLimit, promptRateLimit: { ...defaultPromptRateLimitConfig(), capacity: 2 } });
    for (const id of ['one', 'two', 'three']) { f.send(id); await flush(); }
    expect(prompt).toHaveBeenCalledTimes(2);
    expect(f.handler.handleMessage).not.toHaveBeenCalled();
    expect(onRateLimit).toHaveBeenCalledWith({ windowId: 'window', operation: 'permission.prompt', action: 'block', reason: 'rate-exceeded' });
    f.runtime.destroy();
  });

  it('does not charge the prompt budget for existing grants', async () => {
    const f = fixture({ promptRateLimit: { ...defaultPromptRateLimitConfig(), capacity: 1 } });
    f.send('one'); await flush(); f.send('two'); await flush();
    expect(f.prompt).toHaveBeenCalledTimes(1);
    expect(f.handler.handleMessage).toHaveBeenCalledTimes(2);
    f.runtime.destroy();
  });

  it('does not reopen a destroyed source before a fresh host registration', async () => {
    const f = fixture();
    f.send('one'); await flush();
    f.runtime.destroyWindow('window');
    f.send('two'); await flush();
    expect(f.handler.handleMessage).toHaveBeenCalledTimes(1);
    expect(f.prompt).toHaveBeenCalledTimes(1);
    f.runtime.sessionRegistry.register('window', { ...f.entry });
    f.send('two'); await flush();
    expect(f.handler.handleMessage).toHaveBeenCalledTimes(2);
    f.runtime.destroy();
  });
});
