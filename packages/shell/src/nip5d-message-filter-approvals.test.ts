import { createRateLimiter } from '@kehto/rate-limit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApprovalCancellation, PermissionAdapter } from '@kehto/runtime';
import { createShellBridge, originRegistry } from './index.js';
import type { NappletMessageDecision, ShellAdapter } from './index.js';
import { deliverFromNapplet } from './test-utils.js';

declare const AbortController: { new(): ApprovalCancellation };

const identity = {
  dTag: 'example',
  aggregateHash: 'a'.repeat(64),
  permissionPrincipal: { kind: 'verified' as const, manifestKey: `nip5d:15129:${'b'.repeat(64)}`, artifactHash: 'a'.repeat(64) },
};
const windowId = 'filter-window';
const flush = () => new Promise((resolve) => { setTimeout(resolve, 0); });

/** A configured shell whose `example` extension needs a declared interface grant. */
async function setup(options: { permissions?: Partial<PermissionAdapter>; hooks?: Partial<ShellAdapter> } = {}) {
  const handled: unknown[] = [];
  const control = { decision: 'defer' as NappletMessageDecision };
  const prompt = vi.fn(async () => ({ effect: 'allow' as const, lifetime: 'session' as const }));
  const onRateLimit = vi.fn();
  const hooks: ShellAdapter = {
    permissions: {
      now: () => 0, prompt, onRateLimit,
      createCancellation: () => new AbortController(),
      schedule: () => () => undefined,
      ...options.permissions,
    },
    services: {
      example: {
        descriptor: { name: 'example', version: '1' },
        messageCapabilities: { 'example.read': null },
        handleMessage: (_windowId, message) => { handled.push((message as { id?: unknown }).id); },
      },
    },
    auth: { getUserPubkey: () => null, getSigner: () => null },
    config: { getNappUpdateBehavior: () => 'banner' },
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
    filterNappletMessage: () => control.decision,
    ...options.hooks,
  };
  const bridge = createShellBridge(hooks);
  const win = { postMessage: vi.fn() } as unknown as Window;
  originRegistry.register(win, windowId, identity);
  originRegistry.setEnvironment(win, { capabilities: { domains: ['shell', 'example', 'storage'] }, services: ['example'] });
  const deliver = (data: Record<string, unknown>) => deliverFromNapplet(bridge, { source: win, origin: 'null', data });
  const read = (id: string) => deliver({ type: 'example.read', id });
  // The session binds on the first envelope, so the host admits after it.
  deliver({ type: 'shell.ready' });
  await bridge.runtime.permissions!.admit(windowId, { required: ['example'], optional: [], available: ['example'] });
  return { bridge, control, handled, prompt, onRateLimit, deliver, read };
}

describe('filterNappletMessage on a configured host (#399)', () => {
  beforeEach(() => originRegistry.clear());
  afterEach(() => originRegistry.clear());

  it('runs a deferred request under its grant when released, in arrival order', async () => {
    const f = await setup();
    f.read('a');
    f.read('b');
    await flush();
    expect(f.handled).toEqual([]);
    expect(f.bridge.releaseDeferred(windowId)).toBe(2);
    await flush();
    expect(f.handled).toEqual(['a', 'b']);
    f.bridge.destroy();
  });

  it('does not charge the budget for a dropped or held envelope', async () => {
    const f = await setup({ permissions: { rateLimiter: createRateLimiter({ capacity: 1, windowMs: 60_000, action: 'block', unfocusedMultiplier: 1, burst: { windowMs: 0, maxOperations: 0, action: 'block' } }) } });
    f.control.decision = 'drop';
    f.read('dropped');
    f.control.decision = 'defer';
    f.read('held');
    await flush();
    expect(f.onRateLimit).not.toHaveBeenCalled();
    f.bridge.releaseDeferred(windowId);
    await flush();
    expect(f.handled).toEqual(['held']);
    f.bridge.destroy();
  });

  it('charges the budget at release and refuses what it no longer covers', async () => {
    const f = await setup({ permissions: { rateLimiter: createRateLimiter({ capacity: 1, windowMs: 60_000, action: 'block', unfocusedMultiplier: 1, burst: { windowMs: 0, maxOperations: 0, action: 'block' } }) } });
    f.read('first');
    f.read('second');
    f.bridge.releaseDeferred(windowId);
    await flush();
    expect(f.handled).toEqual(['first']);
    expect(f.onRateLimit).toHaveBeenCalledWith(expect.objectContaining({ operation: 'example.read', reason: 'rate-exceeded' }));
    f.bridge.destroy();
  });

  it('asks again at release when the grant was revoked, and honours a denial', async () => {
    const f = await setup();
    f.read('held');
    const permissions = f.bridge.runtime.permissions!;
    for (const grant of permissions.grants) permissions.revoke(grant.id);
    f.prompt.mockClear();
    f.prompt.mockImplementation((async () => ({ effect: 'deny', lifetime: 'once' })) as never);
    await flush();
    expect(f.prompt).not.toHaveBeenCalled();
    f.bridge.releaseDeferred(windowId);
    await flush();
    expect(f.prompt).toHaveBeenCalledTimes(1);
    expect(f.handled).toEqual([]);
    f.bridge.destroy();
  });

  it('discards what a retired source held', async () => {
    const f = await setup();
    f.read('held');
    f.bridge.runtime.destroyWindow(windowId);
    f.bridge.runtime.sessionRegistry.unregister(windowId);
    originRegistry.unregister(windowId);
    expect(f.bridge.releaseDeferred(windowId)).toBe(0);
    await flush();
    expect(f.handled).toEqual([]);
    f.bridge.destroy();
  });
});

describe('ShellAdapter firewall hooks on a configured host (#397)', () => {
  beforeEach(() => originRegistry.clear());
  afterEach(() => originRegistry.clear());

  it('forwards getFocusContext to the approval budgets', async () => {
    const f = await setup({
      hooks: { filterNappletMessage: undefined, getFocusContext: () => ({ focused: false }) },
      permissions: { rateLimiter: createRateLimiter({ capacity: 4, windowMs: 60_000, action: 'block', unfocusedMultiplier: 0.5, burst: { windowMs: 0, maxOperations: 0, action: 'block' } }) },
    });
    for (let i = 0; i < 6; i++) f.read(`m${i}`);
    await flush();
    expect(f.handled).toHaveLength(2);
    f.bridge.destroy();
  });

  it('warns that the legacy hooks do nothing here', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const f = await setup({ hooks: { onFirewallEvent: () => undefined } });
    expect(warn.mock.calls.some(([text]) => String(text).startsWith('FW-RUNTIME-LEGACY-IGNORED-001'))).toBe(true);
    f.bridge.destroy();
    warn.mockRestore();
  });

  it('uses configuration changed on the host-owned limiter', async () => {
    const limiter = createRateLimiter({ capacity: 60, windowMs: 60_000, action: 'block', unfocusedMultiplier: 1, burst: { windowMs: 3000, maxOperations: 20, action: 'block' } });
    const f = await setup({ hooks: { filterNappletMessage: undefined }, permissions: { rateLimiter: limiter } });
    limiter.setConfig({ ...limiter.config, capacity: 7 });
    expect(limiter.config.capacity).toBe(7);
    f.bridge.destroy();
  });
});
