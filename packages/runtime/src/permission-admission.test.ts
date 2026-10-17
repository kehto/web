import { describe, expect, it, vi } from 'vitest';
import { createRuntime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import type { ApprovalAnswer, ApprovalCancellation, ApprovalPrompt } from './approval-coordinator.js';
import type { PermissionAdapter } from './permission-runtime.js';

declare const AbortController: { new(): ApprovalCancellation };
declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(handle: unknown): void;

function fixture(overrides: Partial<PermissionAdapter> = {}) {
  const prompt = vi.fn(async (_prompt: ApprovalPrompt): Promise<ApprovalAnswer> => ({ effect: 'allow', lifetime: 'session' }));
  const hooks = createMockRuntimeAdapter({
    // Before script execution, no namespace is exposed. Admission must not
    // depend on an environment that it is responsible for creating.
    isDomainAllowed: () => false,
    permissions: { now: () => 0, prompt, createCancellation: () => new AbortController(),
      schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); }, ...overrides },
  });
  const runtime = createRuntime(hooks.hooks);
  const entry = { ...createNip5dSessionEntry('window', 'app', 'a'.repeat(64)),
    permissionPrincipal: { kind: 'development' as const, target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) } };
  runtime.sessionRegistry.register('window', entry);
  const admit = (required: string[], optional: string[] = [], available = ['link', 'resource', 'theme']) =>
    runtime.permissions!.admit('window', { required, optional, available });
  return { runtime, prompt, entry, admit, hooks: hooks.hooks };
}

describe('pre-execution interface admission', () => {
  it('binds exact launch authority and interfaces into one current admission', async () => {
    const f = fixture();
    const launchRequirement = {
      category: 'network' as const,
      domain: 'network',
      operation: 'network.connect',
      scope: { kind: 'origin' as const, value: 'https://EXAMPLE.test:443' },
    };
    const admission = await f.runtime.permissions!.admit('window', {
      available: ['theme'], required: ['theme'], optional: [], launchRequirements: [launchRequirement],
    });
    expect(admission.status).toBe('admitted');
    expect(f.prompt).toHaveBeenCalledTimes(1);
    expect(f.prompt.mock.calls[0][0].missing).toEqual([
      { category: 'interface', domain: 'theme', operation: 'access', scope: { kind: 'exact', value: 'theme' } },
      { ...launchRequirement, scope: { kind: 'origin', value: 'https://example.test' } },
      { category: 'interface', domain: 'network', operation: 'access', scope: { kind: 'exact', value: 'network' } },
    ]);
    expect(f.prompt.mock.calls[0][0].allowLifetimes).toEqual(['session']);
    expect(f.runtime.permissions!.isAdmissionCurrent('window', admission)).toBe(true);
    const launchGrant = f.runtime.permissions!.grants.find((grant) => grant.permission.category === 'network');
    expect(launchGrant).toBeDefined();
    f.runtime.permissions!.revoke(launchGrant!.id);
    expect(f.runtime.permissions!.isAdmissionCurrent('window', admission)).toBe(false);
    f.runtime.destroy();
  });

  it('rejects malformed or interface-shaped launch requirements before prompting', async () => {
    const f = fixture();
    const base = { available: ['theme'], required: ['theme'], optional: [] };
    expect((await f.runtime.permissions!.admit('window', {
      ...base, launchRequirements: [{ category: 'interface', domain: 'theme', operation: 'access', scope: { kind: 'exact', value: 'theme' } }],
    })).status).toBe('denied');
    expect((await f.runtime.permissions!.admit('window', {
      ...base, launchRequirements: [{ category: 'network', domain: 'network', operation: 'network.connect', scope: { kind: 'origin', value: 'https://*.example.test' } }],
    })).status).toBe('denied');
    expect(f.prompt).not.toHaveBeenCalled();
    f.runtime.destroy();
  });

  it('approves required interfaces before namespace exposure and retains session authority', async () => {
    const f = fixture();
    expect(await f.admit(['link', 'resource'])).toEqual({ status: 'admitted', domains: ['link', 'resource'], deniedRequired: [] });
    expect(f.prompt).toHaveBeenCalledTimes(1);
    expect(f.prompt.mock.calls[0][0].allowLifetimes).toEqual(['session']);
    expect(f.runtime.permissions!.grants.map((grant) => grant.lifetime)).toEqual(['session', 'session']);
    await f.admit(['link']);
    expect(f.prompt).toHaveBeenCalledTimes(1);
    f.runtime.destroy();
  });

  it('uses startup approval for later declared extension dispatch', async () => {
    const f = fixture();
    const action = vi.fn();
    f.runtime.registerService('example', { descriptor: { name: 'example', version: '1' },
      messageCapabilities: { 'example.run': null }, handleMessage: action });
    f.runtime.handleMessage('window', { type: 'example.run', id: 'before-admission' });
    expect(action).not.toHaveBeenCalled();
    const admission = await f.admit(['example'], [], ['example']);
    expect(admission.status).toBe('admitted');
    f.hooks.isDomainAllowed = (_windowId, domain) => admission.domains.includes(domain);
    f.runtime.handleMessage('window', { type: 'example.run', id: 'after-admission' });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(action).toHaveBeenCalledTimes(1);
    expect(f.prompt).toHaveBeenCalledTimes(1);
    f.runtime.destroy();
  });

  it('requires a real grant behind a host-exposed built-in interface', async () => {
    const f = fixture();
    const action = vi.fn();
    f.runtime.registerService('theme', { descriptor: { name: 'theme', version: '1' }, handleMessage: action });
    f.hooks.isDomainAllowed = () => true;
    f.runtime.handleMessage('window', { type: 'theme.get', id: 'before' });
    expect(action).not.toHaveBeenCalled();
    expect((await f.admit(['theme'])).status).toBe('admitted');
    f.runtime.handleMessage('window', { type: 'theme.get', id: 'after' });
    expect(action).toHaveBeenCalledTimes(1);
    f.runtime.permissions!.revoke(f.runtime.permissions!.grants[0].id);
    f.runtime.handleMessage('window', { type: 'theme.get', id: 'revoked' });
    expect(action).toHaveBeenCalledTimes(1);
    f.runtime.destroy();
  });

  it('never treats a once choice as a lasting startup grant', async () => {
    const f = fixture({ prompt: async () => ({ effect: 'allow', lifetime: 'once' }) });
    expect(await f.admit(['link'])).toEqual({ status: 'unavailable', domains: [], deniedRequired: ['link'] });
    expect(f.runtime.permissions!.grants).toEqual([]);
    f.runtime.destroy();
  });

  it('required denial prevents admission without prompting for optional scopes', async () => {
    const prompt = vi.fn(async (): Promise<ApprovalAnswer> => ({ effect: 'deny', lifetime: 'once' }));
    const f = fixture({ prompt });
    expect(await f.admit(['link'], ['theme'])).toEqual({ status: 'denied', domains: [], deniedRequired: ['link'] });
    expect(prompt).toHaveBeenCalledTimes(1);
    f.runtime.destroy();
  });

  it('omits denied optional interfaces and keeps approved required interfaces', async () => {
    const f = fixture({ prompt: async ({ missing }) => ({ effect: missing[0].domain === 'theme' ? 'deny' : 'allow', lifetime: 'session' }) });
    expect(await f.admit(['link'], ['theme', 'resource', 'missing'])).toEqual({ status: 'admitted', domains: ['link', 'resource'], deniedRequired: [] });
    f.runtime.destroy();
  });

  it('does not grant undeclared available interfaces or silently add shell', async () => {
    const f = fixture();
    expect(await f.admit([], [], ['shell', 'link'])).toEqual({ status: 'admitted', domains: [], deniedRequired: [] });
    expect(f.prompt).not.toHaveBeenCalled();
    f.runtime.destroy();
  });

  it('revalidates the issued admission after async host work without accepting forged results', async () => {
    const f = fixture();
    const admission = await f.admit(['link']);
    expect(f.runtime.permissions!.isAdmissionCurrent('window', admission)).toBe(true);
    expect(f.runtime.permissions!.isAdmissionCurrent('other', admission)).toBe(false);
    expect(f.runtime.permissions!.isAdmissionCurrent('window', { ...admission })).toBe(false);
    f.runtime.permissions!.revoke(f.runtime.permissions!.grants[0].id);
    expect(f.runtime.permissions!.isAdmissionCurrent('window', admission)).toBe(false);
    const replacement = await f.admit(['link']);
    expect(f.runtime.permissions!.isAdmissionCurrent('window', replacement)).toBe(true);
    expect(f.runtime.permissions!.isAdmissionCurrent('window', admission)).toBe(false);
    f.runtime.destroyWindow('window');
    expect(f.runtime.permissions!.isAdmissionCurrent('window', replacement)).toBe(false);
    f.runtime.destroy();
  });

  it('requires fresh registration after destroying even a zero-interface source', async () => {
    const f = fixture();
    const empty = await f.admit([]);
    expect(f.runtime.permissions!.isAdmissionCurrent('window', empty)).toBe(true);
    f.runtime.destroyWindow('window');
    expect(f.runtime.permissions!.isAdmissionCurrent('window', empty)).toBe(false);
    expect((await f.admit(['link'])).status).toBe('cancelled');
    f.runtime.sessionRegistry.register('window', { ...f.entry });
    expect((await f.admit(['link'])).status).toBe('admitted');
    f.runtime.destroy();
  });

  it('refuses unavailable required interfaces before prompting', async () => {
    const f = fixture();
    expect(await f.admit(['link', 'missing'])).toEqual({ status: 'denied', domains: [], deniedRequired: ['missing'] });
    expect(f.prompt).not.toHaveBeenCalled();
    f.runtime.destroy();
  });

  it('retains ACL blocking before any startup approval', async () => {
    const f = fixture();
    f.runtime.aclState.block('', 'app', 'a'.repeat(64));
    expect((await f.admit(['link'])).status).toBe('denied');
    expect(f.prompt).not.toHaveBeenCalled();
    f.runtime.destroy();
  });

  it('captures declarations and cancels admission when its source is replaced', async () => {
    let resolve!: (answer: ApprovalAnswer) => void;
    let shown!: () => void;
    const visible = new Promise<void>((done) => { shown = done; });
    const f = fixture({ prompt: () => { shown(); return new Promise((done) => { resolve = done; }); } });
    const required = ['link'];
    const admission = f.admit(required, ['theme']);
    await visible;
    required[0] = 'resource';
    f.runtime.sessionRegistry.register('window', { ...f.entry });
    resolve({ effect: 'allow', lifetime: 'session' });
    expect(await admission).toEqual({ status: 'cancelled', domains: [], deniedRequired: ['link'] });
    expect(f.runtime.permissions!.grants).toEqual([]);
    f.runtime.destroy();
  });

  it.each([[''], ['link.open'], ['LINK'], Array(129).fill('link')])('rejects malformed declarations %j', async (required) => {
    const f = fixture();
    expect((await f.admit(required)).status).toBe('denied');
    expect(f.prompt).not.toHaveBeenCalled();
    f.runtime.destroy();
  });
});
