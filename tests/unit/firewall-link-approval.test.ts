import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRuntime, defaultRateLimitConfig } from '@kehto/runtime';
import type { ApprovalAnswer, ApprovalPrompt, PermissionAdapter } from '@kehto/runtime';
import { createLinkService } from '@kehto/services';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from '../../packages/runtime/src/test-utils.js';

const artifactHash = 'a'.repeat(64);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function flush() { await new Promise((resolve) => setTimeout(resolve, 0)); }

function fixture(overrides: Partial<PermissionAdapter> = {}) {
  const prompt = vi.fn(async (): Promise<ApprovalAnswer> => ({ effect: 'allow', lifetime: 'once' }));
  const open = vi.fn(async () => ({ status: 'opened' as const }));
  const service = createLinkService({ open });
  const hooks = createMockRuntimeAdapter({ services: { link: service }, permissions: {
    prompt, now: Date.now, createCancellation: () => new AbortController(),
    schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
    ...overrides,
  } });
  const runtime = createRuntime(hooks.hooks);
  const entry = { ...createNip5dSessionEntry('window', 'app', artifactHash),
    permissionPrincipal: { kind: 'verified' as const, manifestKey: `nip5d:15129:${'b'.repeat(64)}`, artifactHash } };
  runtime.sessionRegistry.register('window', entry);
  const send = (id = 'one', url = 'https://example.com/post/123') => runtime.handleMessage('window', { type: 'link.open', id, url });
  return { runtime, entry, service, prompt, open, sent: hooks.sent, send };
}

afterEach(() => vi.restoreAllMocks());

describe('runtime Firewall LINK integration', () => {
  it('holds an exact immutable request, opens once, and preserves correlation', async () => {
    const decision = deferred<ApprovalAnswer>();
    const shown = deferred<ApprovalPrompt>();
    const f = fixture({ prompt: (value) => { shown.resolve(value); return decision.promise; } });
    const message = { type: 'link.open', id: 'one', url: 'https://example.com/post/123', options: { label: 'Original' } };
    f.runtime.handleMessage('window', message);
    const prompt = await shown.promise;
    message.id = 'changed'; message.url = 'https://attacker.invalid/'; message.options.label = 'Changed';
    expect(prompt.request.principal).toEqual(f.entry.permissionPrincipal);
    expect(prompt.missing.map((item) => item.category)).toEqual(['resource', 'interface']);
    expect(prompt.request.requestId).not.toBe('one');
    expect(f.open).not.toHaveBeenCalled();
    decision.resolve({ effect: 'allow', lifetime: 'once' });
    await flush();
    expect(f.open).toHaveBeenCalledTimes(1);
    expect(f.open.mock.calls[0][0]).toMatchObject({ url: new URL('https://example.com/post/123'), options: { label: 'Original' } });
    expect(f.sent).toEqual([{ windowId: 'window', message: { type: 'link.open.result', id: 'one', status: 'opened' } }]);
    f.send(); await flush();
    expect(f.open).toHaveBeenCalledTimes(1);
    f.runtime.destroy();
  });

  it('sends a canonical denial without invoking the opener', async () => {
    const f = fixture({ prompt: async () => ({ effect: 'deny', lifetime: 'once' }) });
    f.send(); await flush();
    expect(f.open).not.toHaveBeenCalled();
    expect(f.sent[0].message).toEqual({ type: 'link.open.result', id: 'one', status: 'denied', error: 'blocked-by-policy' });
    f.runtime.destroy();
  });

  it.each(['replace', 'unregister', 'destroy', 'replace-service', 'unregister-service'] as const)('invalidates pending approval on %s', async (change) => {
    const decision = deferred<ApprovalAnswer>();
    const shown = deferred<ApprovalPrompt>();
    const f = fixture({ prompt: (value) => { shown.resolve(value); return decision.promise; } });
    f.send(); const prompt = await shown.promise;
    if (change === 'replace') f.runtime.sessionRegistry.register('window', { ...f.entry });
    else if (change === 'unregister') f.runtime.sessionRegistry.unregister('window');
    else if (change === 'replace-service') f.runtime.registerService('link', f.service);
    else if (change === 'unregister-service') f.runtime.unregisterService('link');
    else f.runtime.destroyWindow('window');
    expect(prompt.signal.aborted).toBe(true);
    decision.resolve({ effect: 'allow', lifetime: 'session' });
    await flush();
    expect(f.open).not.toHaveBeenCalled();
    expect(f.runtime.permissions?.grants).toEqual([]);
    expect(f.sent).toEqual([]);
    f.runtime.destroy();
  });

  it('does not accept app-supplied principals when the host has none', async () => {
    const f = fixture();
    f.runtime.sessionRegistry.register('window', createNip5dSessionEntry('window', 'app', artifactHash));
    f.runtime.handleMessage('window', { type: 'link.open', id: 'one', url: 'https://example.com/', permissionPrincipal: f.entry.permissionPrincipal });
    await flush();
    expect(f.prompt).not.toHaveBeenCalled();
    expect(f.open).not.toHaveBeenCalled();
    f.runtime.destroy();
  });

  it('rate limits even a previously approved operation', async () => {
    const rateLimit = { ...defaultRateLimitConfig(), capacity: 1, action: 'block' as const, unfocusedMultiplier: 1 };
    const onRateLimit = vi.fn();
    const f = fixture({ rateLimit, onRateLimit, now: () => 0, prompt: async () => ({ effect: 'allow', lifetime: 'session' }) });
    f.send('one'); await flush();
    f.send('two'); await flush();
    expect(f.open).toHaveBeenCalledTimes(1);
    expect(f.sent[1].message).toMatchObject({ type: 'link.open.result', id: 'two', status: 'denied' });
    expect(onRateLimit).toHaveBeenCalledWith({ windowId: 'window', operation: 'link.open', action: 'block', reason: 'rate-exceeded' });
    f.runtime.destroy();
  });

  it('persists approved scopes before opening and reports failed writes', async () => {
    const onStorageError = vi.fn();
    const f = fixture({ prompt: async () => ({ effect: 'allow', lifetime: 'persistent' }), onStorageError,
      persistence: { load: () => null, persist: () => { throw new Error('disk full'); } } });
    f.send(); await flush();
    expect(f.open).not.toHaveBeenCalled();
    expect(onStorageError).toHaveBeenCalledWith('save-failed');
    expect(f.runtime.permissions?.grants).toEqual([]);
    f.runtime.destroy();
  });

  it('restores only the approved artifact and exact destination across runtimes', async () => {
    let document: string | null = null;
    const persistence = { load: () => document, persist: (value: string) => { document = value; } };
    const first = fixture({ persistence, prompt: async () => ({ effect: 'allow', lifetime: 'persistent' }) });
    first.send(); await flush();
    expect(first.open).toHaveBeenCalledTimes(1);
    first.runtime.destroy();
    const restored = fixture({ persistence });
    restored.send(); await flush();
    expect(restored.prompt).not.toHaveBeenCalled();
    expect(restored.open).toHaveBeenCalledTimes(1);
    restored.send('different', 'https://example.com/other'); await flush();
    expect(restored.prompt).toHaveBeenCalledTimes(1);
    restored.runtime.sessionRegistry.register('window', { ...restored.entry, aggregateHash: 'c'.repeat(64),
      permissionPrincipal: { ...restored.entry.permissionPrincipal, artifactHash: 'c'.repeat(64) } });
    restored.send(); await flush();
    expect(restored.prompt).toHaveBeenCalledTimes(2);
    restored.runtime.destroy();
  });

  it('does not reset the operation budget when a source is replaced', async () => {
    const f = fixture({ now: () => 0, rateLimit: { ...defaultRateLimitConfig(), capacity: 1, action: 'block' } });
    f.send(); await flush();
    f.runtime.sessionRegistry.register('window', { ...f.entry });
    f.send(); await flush();
    expect(f.open).toHaveBeenCalledTimes(1);
    expect(f.prompt).toHaveBeenCalledTimes(1);
    f.runtime.destroy();
  });

  it('keeps the canonical shared-policy path quiet', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = fixture();
    f.send(); await flush();
    expect(warn).not.toHaveBeenCalled();
    f.runtime.destroy();
  });

  it('cannot override ACL blocking with a Firewall approval', async () => {
    const decision = deferred<ApprovalAnswer>();
    const shown = deferred<ApprovalPrompt>();
    const f = fixture({ prompt: (value) => { shown.resolve(value); return decision.promise; } });
    f.send(); const prompt = await shown.promise;
    f.runtime.aclState.block('', 'app', artifactHash);
    expect(prompt.signal.aborted).toBe(true);
    decision.resolve({ effect: 'allow', lifetime: 'session' });
    await flush();
    expect(f.open).not.toHaveBeenCalled();
    expect(f.sent[0].message).toMatchObject({ type: 'link.open.result', status: 'denied' });
    f.runtime.destroy();
  });

  it('revocation cancels pending work without losing replay history or response correlation', async () => {
    const decision = deferred<ApprovalAnswer>();
    const shown = deferred<ApprovalPrompt>();
    let count = 0;
    const f = fixture({ prompt: (value) => {
      if (++count === 1) return Promise.resolve({ effect: 'allow', lifetime: 'session' });
      shown.resolve(value); return decision.promise;
    } });
    f.send(); await flush();
    f.send('two', 'https://example.com/other');
    const prompt = await shown.promise;
    const access = f.runtime.permissions!.grants.find((grant) => grant.permission.category === 'interface')!;
    expect(f.runtime.permissions!.revoke(access.id)).toBe(true);
    expect(prompt.signal.aborted).toBe(true);
    decision.resolve({ effect: 'allow', lifetime: 'session' });
    await flush();
    expect(f.open).toHaveBeenCalledTimes(1);
    expect(f.sent[1].message).toMatchObject({ type: 'link.open.result', id: 'two', status: 'denied' });
    f.send('two', 'https://example.com/other'); await flush();
    expect(count).toBe(2);
    expect(f.open).toHaveBeenCalledTimes(1);
    f.runtime.destroy();
  });

  it('warns only on actual legacy opener use, once per service instance', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const open = vi.fn(() => ({ status: 'opened' as const }));
    const service = createLinkService({ open });
    const send = vi.fn();
    expect(warn).not.toHaveBeenCalled();
    service.handleMessage('legacy', { type: 'link.open', id: 'one', url: 'https://example.com/' }, send);
    service.handleMessage('legacy', { type: 'link.open', id: 'two', url: 'https://example.com/' }, send);
    await flush();
    expect(open).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('FW-LINK-LEGACY-001');
    expect(warn.mock.calls[0][0]).toContain('RuntimeAdapter.permissions');
    expect(warn.mock.calls[0][0]).toContain('once per service instance');
  });

  it('never lets configured protocols override forbidden schemes', async () => {
    const open = vi.fn(() => ({ status: 'opened' as const }));
    const service = createLinkService({ allowedProtocols: ['javascript:', 'file:', 'data:', 'blob:'], open });
    const send = vi.fn();
    for (const [id, url] of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,hello', 'blob:https://example.com/id'].entries()) {
      service.handleMessage('window', { type: 'link.open', id: String(id), url }, send);
    }
    await flush();
    expect(open).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(4);
  });
});
