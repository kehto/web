import { describe, expect, it, vi } from 'vitest';
import type { ApprovalAnswer, ApprovalPrompt } from '@kehto/runtime';
import type { ShellAdapter } from './index.js';
import { createShellBridge } from './index.js';
import { admitBrowserDocument } from './browser-admission.js';

function fixture(prompt: (prompt: ApprovalPrompt) => Promise<ApprovalAnswer> = async () => ({ effect: 'allow', lifetime: 'session' })) {
  const ask = vi.fn(prompt);
  const hooks: ShellAdapter = {
    services: {},
    auth: { getUserPubkey: () => null, getSigner: () => null },
    config: { getNappUpdateBehavior: () => 'auto-grant' },
    crypto: { verifyEvent: async () => false },
    hotkeys: { executeHotkeyFromForward() {} },
    windowManager: { createWindow: () => null },
    relayConfig: {
      addRelay() {}, removeRelay() {},
      getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }),
      getNip66Suggestions: () => [],
    },
    relayPool: {
      getRelayPool: () => null, trackSubscription() {}, untrackSubscription() {},
      openScopedRelay() {}, closeScopedRelay() {}, publishToScopedRelay: () => false,
      selectRelayTier: () => [],
    },
    workerRelay: { getWorkerRelay: () => null },
    permissions: {
    now: () => 0, prompt: ask, createCancellation: () => new AbortController(),
    schedule(callback, delay) { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
    },
  };
  const bridge = createShellBridge(hooks);
  const runtime = bridge.runtime;
  const entry = {
    pubkey: '', windowId: 'frame', origin: 'null', type: 'nip5d', dTag: 'app',
    aggregateHash: 'a'.repeat(64), registeredAt: 0, instanceId: 'frame-1', provenance: 'nip-5d' as const,
    permissionPrincipal: { kind: 'verified' as const, manifestKey: `nip5d:15129:${'b'.repeat(64)}`, artifactHash: 'a'.repeat(64) },
  };
  const commit = vi.fn();
  const onRetire = vi.fn();
  const options = {
    runtime, entry, verifiedHtml: '<html><head></head><body><script>window.booted=true</script></body></html>',
    available: ['theme', 'resource'], required: ['theme'], optional: [] as string[], remoteSources: [],
    isCurrentSource: () => true, commit, onRetire,
  };
  return { runtime, entry, ask, commit, onRetire, options };
}

describe('shared browser admission transaction', () => {
  it('holds executable bytes until one current launch decision commits exact namespace and CSP', async () => {
    let answer!: (value: ApprovalAnswer) => void;
    let shown!: () => void;
    const visible = new Promise<void>((resolve) => { shown = resolve; });
    const f = fixture(() => { shown(); return new Promise((resolve) => { answer = resolve; }); });
    const pending = admitBrowserDocument({ ...f.options, required: ['theme', 'resource'] });
    await visible;
    expect(f.commit).not.toHaveBeenCalled();
    expect(f.runtime.sessionRegistry.getEntryByWindowId('frame')?.permissionPrincipal).toEqual(f.entry.permissionPrincipal);
    answer({ effect: 'allow', lifetime: 'session' });
    const result = await pending;
    expect(result.status).toBe('committed');
    if (result.status !== 'committed') throw new Error('admission failed');
    expect(result.mode).toBe('mediated-resource');
    expect(result.domains).toEqual(['theme', 'resource']);
    expect(f.commit).toHaveBeenCalledOnce();
    const srcdoc = f.commit.mock.calls[0][0] as string;
    expect(srcdoc.indexOf('Content-Security-Policy')).toBeLessThan(srcdoc.indexOf('window.booted=true'));
    expect(srcdoc).toContain("connect-src 'none'");
    expect(srcdoc).toContain('data-kehto-nip5d-injection');
    result.retire();
    expect(f.onRetire).toHaveBeenCalledOnce();
    f.runtime.destroy();
  });

  it('denies required interfaces without frame commit and omits declined optional domains', async () => {
    const denied = fixture(async () => ({ effect: 'deny', lifetime: 'once' }));
    expect((await admitBrowserDocument(denied.options)).status).toBe('denied');
    expect(denied.commit).not.toHaveBeenCalled();
    expect(denied.runtime.sessionRegistry.getEntryByWindowId('frame')).toBeUndefined();
    denied.runtime.destroy();

    const optional = fixture(async ({ missing }) => ({ effect: missing[0].domain === 'resource' ? 'deny' : 'allow', lifetime: 'session' }));
    const result = await admitBrowserDocument({ ...optional.options, optional: ['resource'] });
    expect(result.status).toBe('committed');
    if (result.status !== 'committed') throw new Error('admission failed');
    expect(result.domains).toEqual(['theme']);
    expect(result.mode).toBe('isolated');
    result.retire();
    optional.runtime.destroy();
  });

  it('rejects required resource with direct authority before any prompt and reports optional omission', async () => {
    const f = fixture();
    const direct = [{ directive: 'connect-src' as const, origin: 'https://api.example.test' }];
    const incompatible = await admitBrowserDocument({ ...f.options, required: ['resource'], remoteSources: direct });
    expect(incompatible).toMatchObject({ status: 'incompatible', deniedRequired: ['resource'] });
    expect(f.ask).not.toHaveBeenCalled();
    expect(f.commit).not.toHaveBeenCalled();

    const result = await admitBrowserDocument({ ...f.options, optional: ['resource'], remoteSources: direct });
    expect(result.status).toBe('committed');
    if (result.status !== 'committed') throw new Error('admission failed');
    expect(result.mode).toBe('direct-network');
    expect(result.domains).toEqual(['theme']);
    expect(result.omittedOptional).toEqual([{ domain: 'resource', reason: 'direct-network-excludes-resource' }]);
    expect(f.ask.mock.calls[0][0].missing).toContainEqual({
      category: 'network', domain: 'network', operation: 'network.connect-src',
      scope: { kind: 'origin', value: 'https://api.example.test' },
    });
    expect(f.commit.mock.calls[0][0]).toContain('connect-src https://api.example.test');
    result.retire();
    f.runtime.destroy();
  });

  it('retires a committed direct frame synchronously when its exact grant is revoked', async () => {
    const f = fixture();
    const result = await admitBrowserDocument({ ...f.options,
      remoteSources: [{ directive: 'img-src', origin: 'https://images.example.test' }],
    });
    expect(result.status).toBe('committed');
    const grant = f.runtime.permissions!.grants.find((item) => item.permission.operation === 'network.img-src');
    expect(grant).toBeDefined();
    f.runtime.permissions!.revoke(grant!.id);
    expect(f.onRetire).toHaveBeenCalledOnce();
    expect(f.runtime.sessionRegistry.getEntryByWindowId('frame')).toBeUndefined();
    f.runtime.destroy();
  });

  it('drops a late approval after replacement without deleting the replacement source', async () => {
    let answer!: (value: ApprovalAnswer) => void;
    let shown!: () => void;
    const visible = new Promise<void>((resolve) => { shown = resolve; });
    const f = fixture(() => { shown(); return new Promise((resolve) => { answer = resolve; }); });
    const pending = admitBrowserDocument(f.options);
    await visible;
    const replacement = { ...f.entry, instanceId: 'replacement' };
    f.runtime.sessionRegistry.register('frame', replacement);
    answer({ effect: 'allow', lifetime: 'session' });
    expect((await pending).status).toBe('cancelled');
    expect(f.commit).not.toHaveBeenCalled();
    expect(f.runtime.sessionRegistry.getEntryByWindowId('frame')?.instanceId).toBe('replacement');
    f.runtime.destroy();
  });

  it('cancels an unresolved prompt on navigation abort before bytes execute', async () => {
    let shown!: () => void;
    const visible = new Promise<void>((resolve) => { shown = resolve; });
    const f = fixture(() => { shown(); return new Promise(() => undefined); });
    const controller = new AbortController();
    const pending = admitBrowserDocument({ ...f.options, signal: controller.signal });
    await visible;
    controller.abort();
    expect((await pending).status).toBe('cancelled');
    expect(f.commit).not.toHaveBeenCalled();
    f.runtime.destroy();
  });
});
