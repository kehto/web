import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import {
  ShellExtensionError, buildShellCapabilities, createShellBridge, defineShellExtension, getShellDomainState,
  getShellExtensionBindings, listShellExtensionCapabilities, originRegistry, prepareNappletSrcdoc,
  renderNappletNamespacePrelude, resolveShellEnvironment,
} from './index.js';
import type { ServiceHandler, ServiceRuntimeContext, ShellAdapter, ShellExtension } from './index.js';
import { resetShellEnvironmentOverrideWarning } from './shell-ready.js';

// Kehto spec-gap policy for experimental x- NAPs, bounded by napplet/naps master
// 43cb3a4 (NAP-SHELL capabilities.domains, projections/web.md discovery).
const identity = { dTag: 'x-probe', aggregateHash: 'b'.repeat(64) };
const windowId = 'x-probe-window';

function echoService(): ServiceHandler & { context?: ServiceRuntimeContext } {
  const service: ServiceHandler & { context?: ServiceRuntimeContext } = {
    descriptor: { name: 'x-echo', version: '0.1.0' },
    messageCapabilities: { 'x-echo.say': 'x-echo:send' },
    pushCapabilities: { 'x-echo.heard': 'x-echo:send' },
    onRegistered(context) { service.context = context; },
    handleMessage: vi.fn((_w, message, send) => {
      send({ type: 'x-echo.say.result', id: (message as { id?: string }).id, text: (message as { text?: string }).text } as NappletMessage);
    }),
  };
  return service;
}

function echoExtension(overrides: Partial<ShellExtension> = {}): ShellExtension {
  return {
    domain: 'x-echo',
    service: echoService(),
    capabilities: [{ capability: 'x-echo:send', label: 'Echo' }],
    binding: (kit) => ({ say: (text: string) => kit.request('say', { text }) }),
    ...overrides,
  };
}

function baseHooks(extra: Partial<ShellAdapter> = {}): ShellAdapter {
  return {
    auth: { getUserPubkey: () => 'user-secret-pubkey', getSigner: () => ({ secret: 'nsec-never-leaves' }) as never },
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
    ...extra,
  };
}

function frame() {
  const postMessage = vi.fn();
  return { win: { postMessage } as unknown as Window, postMessage };
}

function bridgeWith(hooks: ShellAdapter) {
  const bridge = createShellBridge(hooks);
  bridge.runtime.firewallState.setPolicy(identity.dTag, 'allow');
  const target = frame();
  originRegistry.register(target.win, windowId, identity);
  const dispatch = (data: Record<string, unknown>) => bridge.handleMessage({ source: target.win, origin: 'null', data } as MessageEvent);
  return { bridge, target, dispatch };
}

describe('extension declaration policy', () => {
  it('accepts a well-formed x- extension', () => {
    expect(defineShellExtension(echoExtension()).domain).toBe('x-echo');
  });

  it.each([
    ['llm', /reserved NAP domain/],
    ['relay', /reserved NAP domain/],
    ['x-llm', /aliases the reserved NAP domain llm/],
    ['echo', /x- prefix/],
  ])('rejects the colliding domain %s', (domain, reason) => {
    const service = { ...echoService(), descriptor: { name: domain, version: '1' }, messageCapabilities: {}, pushCapabilities: {} };
    expect(() => defineShellExtension({ domain, service })).toThrow(reason);
  });

  it('rejects borrowed, redefined and undeclared capabilities', () => {
    const borrow = (map: Record<string, string>) => echoExtension({ service: { ...echoService(), messageCapabilities: map as never } });
    expect(() => defineShellExtension(borrow({ 'x-echo.say': 'llm:generate' }))).toThrow(/borrowing llm:generate/);
    expect(() => defineShellExtension(borrow({ 'x-echo.say': 'x-echo:other' }))).toThrow(/declared x-echo capability/);
    expect(() => defineShellExtension(borrow({ 'llm.generate': 'x-echo:send' }))).toThrow(/x-echo.<action> type/);
    expect(() => defineShellExtension(echoExtension({ capabilities: [{ capability: 'llm:generate' as never }] }))).toThrow(/built-in capability/);
    expect(() => defineShellExtension(echoExtension({ capabilities: [{ capability: 'x-other:send' }] }))).toThrow(/cannot borrow/);
  });

  it('rejects descriptor mismatch, unsafe binding source, duplicates and service overrides', () => {
    expect(() => defineShellExtension(echoExtension({ service: { ...echoService(), descriptor: { name: 'x-other', version: '1' } } }))).toThrow(/descriptor name/);
    expect(() => defineShellExtension(echoExtension({ binding: { source: '() => "</script>"' } }))).toThrow(/script or comment markup/);
    expect(() => createShellBridge(baseHooks({ extensions: [echoExtension(), echoExtension()] }))).toThrow(ShellExtensionError);
    expect(() => createShellBridge(baseHooks({ services: { 'x-echo': echoService() }, extensions: [echoExtension()] }))).toThrow(/cannot override/);
  });
});

describe('extension advertisement and state', () => {
  it('advertises x- domains like built-ins and reports tri-state', () => {
    let configured = false;
    const hooks = baseHooks({ extensions: [echoExtension({ state: () => (configured ? 'supported' : 'unconfigured') })] });
    expect(buildShellCapabilities(hooks).domains).toContain('x-echo');
    expect(resolveShellEnvironment(hooks, identity).services).toContain('x-echo');
    expect(getShellDomainState(hooks, 'x-echo')).toBe('unconfigured');
    configured = true;
    expect(getShellDomainState(hooks, 'x-echo')).toBe('supported');
    expect(getShellDomainState({ ...hooks, capabilities: { disabledDomains: ['x-echo'] } }, 'x-echo')).toBe('disabled');
    expect(getShellDomainState(baseHooks({ extensions: [echoExtension({ state: () => 'disabled' })] }), 'x-echo')).toBe('disabled');
    expect(listShellExtensionCapabilities(hooks.extensions)).toEqual([{ capability: 'x-echo:send', label: 'Echo', domain: 'x-echo' }]);
  });

  it('keeps built-in domains, NAP-LLM included, unchanged without extension config', () => {
    const llm: ServiceHandler = { descriptor: { name: 'llm', version: '1' }, handleMessage() {} };
    const without = baseHooks({ services: { llm } });
    const withExtensions = baseHooks({ services: { llm }, extensions: [echoExtension()] });
    expect(buildShellCapabilities(withExtensions).domains.filter((d) => d !== 'x-echo')).toEqual(buildShellCapabilities(without).domains);
    expect(getShellDomainState(without, 'llm')).toBe('supported');
    expect(getShellDomainState(withExtensions, 'llm')).toBe('supported');
  });
});

describe('extension routing through the shell bridge', () => {
  beforeEach(() => originRegistry.clear());
  afterEach(() => originRegistry.clear());

  it('routes request/response and pushes for a granted frame', () => {
    const extension = echoExtension();
    const { bridge, target, dispatch } = bridgeWith(baseHooks({ extensions: [extension] }));
    dispatch({ type: 'x-echo.say', id: 'r1', text: 'hi' });
    expect(target.postMessage).toHaveBeenCalledWith({ type: 'x-echo.say.result', id: 'r1', text: 'hi' }, '*');
    const context = (extension.service as ReturnType<typeof echoService>).context!;
    expect(context.sendToEligibleNapplet(windowId, { type: 'x-echo.heard', text: 'pushed' } as NappletMessage)).toBe(true);
    expect(target.postMessage).toHaveBeenLastCalledWith({ type: 'x-echo.heard', text: 'pushed' }, '*');
    bridge.destroy();
  });

  it('denies a frame whose resolveEnvironment withholds the domain', () => {
    const extension = echoExtension();
    const hooks = baseHooks({
      extensions: [extension],
      capabilities: { resolveEnvironment: (_id, available) => ({ domains: available.domains.filter((d) => d !== 'x-echo'), services: available.services }) },
    });
    const { bridge, target, dispatch } = bridgeWith(hooks);
    dispatch({ type: 'x-echo.say', id: 'r1', text: 'hi' });
    expect(extension.service.handleMessage).not.toHaveBeenCalled();
    const context = (extension.service as ReturnType<typeof echoService>).context!;
    expect(context.sendToEligibleNapplet(windowId, { type: 'x-echo.heard' } as NappletMessage)).toBe(false);
    expect(target.postMessage).not.toHaveBeenCalled();
    bridge.destroy();
  });

  it('denies on ACL revoke and firewall block without inventing envelopes', () => {
    const extension = echoExtension();
    const { bridge, target, dispatch } = bridgeWith(baseHooks({ extensions: [extension] }));
    bridge.runtime.aclState.revoke('', identity.dTag, identity.aggregateHash, 'x-echo:send');
    dispatch({ type: 'x-echo.say', id: 'denied' });
    bridge.runtime.aclState.grant('', identity.dTag, identity.aggregateHash, 'x-echo:send');
    bridge.runtime.firewallState.setPolicy(identity.dTag, 'deny');
    dispatch({ type: 'x-echo.say', id: 'blocked' });
    expect(extension.service.handleMessage).not.toHaveBeenCalled();
    expect(target.postMessage).not.toHaveBeenCalled();
    bridge.destroy();
  });

  it('never hands an extension credentials, signer secrets or other domains\' data', () => {
    const seen: unknown[] = [];
    const service: ServiceHandler = {
      descriptor: { name: 'x-spy', version: '1' },
      messageCapabilities: { 'x-spy.probe': null },
      onRegistered(context) { seen.push(context); },
      handleMessage(w, message) { seen.push(w, message); },
    };
    const llmService: ServiceHandler = { descriptor: { name: 'llm', version: '1' }, handleMessage: vi.fn() };
    const { bridge, dispatch } = bridgeWith(baseHooks({ services: { llm: llmService }, extensions: [{ domain: 'x-spy', service }] }));
    dispatch({ type: 'llm.generate', id: 'other-domain', request: { prompt: 'vault-secret' } });
    dispatch({ type: 'x-spy.probe', id: 'p' });
    const context = seen[0] as Record<string, unknown>;
    expect(Object.keys(context).sort()).toEqual(['hasCapability', 'listWindowIds', 'resolveDTag', 'sendToEligibleNapplet']);
    const serialized = JSON.stringify(seen);
    for (const secret of ['nsec-never-leaves', 'user-secret-pubkey', 'vault-secret', 'llm.generate']) expect(serialized).not.toContain(secret);
    expect(seen).toContainEqual({ type: 'x-spy.probe', id: 'p' });
    bridge.destroy();
  });
});

describe('extension bindings in the prelude', () => {
  type Listener = (event: { source: unknown; data: unknown }) => void;
  function runFrame(html: string) {
    const listeners = new Set<Listener>();
    const posted: Record<string, unknown>[] = [];
    const parent = { postMessage: (message: Record<string, unknown>) => posted.push(message) };
    const win: Record<string, unknown> = {
      parent, crypto: { randomUUID: () => `id-${posted.length}` },
      document: { addEventListener() {}, removeEventListener() {} },
      addEventListener: (_t: string, l: Listener) => listeners.add(l),
      removeEventListener: (_t: string, l: Listener) => listeners.delete(l),
    };
    const source = html.match(/<script data-kehto-nip5d-injection>([\s\S]*?)<\/script>/)?.[1] ?? '';
    new Function('window', source)(win);
    const deliver = (data: unknown, from: unknown = parent) => { for (const l of [...listeners]) l({ source: from, data }); };
    return { win, posted, deliver };
  }

  it('builds window.napplet[x-echo] outside the artifact bytes and stays host-owned', async () => {
    const extension = echoExtension({
      binding: (kit) => ({
        say: (text: string) => kit.request('say', { text }),
        onHeard: (cb: (m: Record<string, unknown>) => void) => kit.on('heard', cb),
      }),
    });
    const artifact = '<!doctype html><html><head><title>t</title></head><body><script>window.authored = 1;</script></body></html>';
    const domains = ['shell', 'x-echo'];
    const srcdoc = prepareNappletSrcdoc(artifact, { domains, extensions: getShellExtensionBindings([extension], domains) });
    expect(srcdoc.replace(/<meta[^>]*>|<script data-kehto-nip5d-injection>[\s\S]*?<\/script>/g, '')).toBe(artifact);
    const { win, posted, deliver } = runFrame(srcdoc);
    const napplet = win.napplet as Record<string, Record<string, (...args: never[]) => unknown>>;
    expect(Object.isFrozen(napplet['x-echo'])).toBe(true);
    const reply = napplet['x-echo'].say('hi' as never) as Promise<Record<string, unknown>>;
    expect(posted.at(-1)).toMatchObject({ type: 'x-echo.say', text: 'hi' });
    deliver({ type: 'x-echo.say.result', id: 'forged' }, {});
    deliver({ type: 'x-echo.say.result', id: posted.at(-1)!.id, text: 'hi' });
    await expect(reply).resolves.toEqual({ text: 'hi' });
    const heard = vi.fn();
    napplet['x-echo'].onHeard(heard as never);
    deliver({ type: 'x-echo.heard', text: 'push' });
    deliver({ type: 'x-echo.heard', text: 'spoof' }, {});
    expect(heard).toHaveBeenCalledExactlyOnceWith({ text: 'push' });
    const original = napplet['x-echo'];
    const hijack = { say: () => 'hijacked' };
    (win.napplet as Record<string, unknown>)['x-echo'] = hijack;
    delete (win.napplet as Record<string, unknown>)['x-echo'];
    expect((win.napplet as Record<string, unknown>)['x-echo']).toBe(original);
  });

  it('renders no binding for domains the frame does not expose', () => {
    const html = renderNappletNamespacePrelude({ domains: ['shell'], extensions: { 'x-echo': echoExtension().binding! } });
    expect(html).not.toContain('x-echo');
  });
});

describe('originRegistry.setEnvironment compatibility (KEHTO_COMPAT_SHELL_ENV_OVERRIDE)', () => {
  beforeEach(() => { originRegistry.clear(); resetShellEnvironmentOverrideWarning(); });
  afterEach(() => { originRegistry.clear(); vi.restoreAllMocks(); });

  it('still widens a frame environment and warns once with an actionable message', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handler = vi.fn((_w, m, send) => send({ type: 'example.result', id: m.id }));
    const hooks = baseHooks({ services: { example: { descriptor: { name: 'example', version: '1' }, messageCapabilities: { 'example.read': null }, handleMessage: handler } } });
    for (const run of [1, 2]) {
      const bridge = createShellBridge(hooks);
      bridge.runtime.firewallState.setPolicy(identity.dTag, 'allow');
      const target = frame();
      originRegistry.register(target.win, `${windowId}-${run}`, identity);
      const live = resolveShellEnvironment(hooks, identity);
      originRegistry.setEnvironment(target.win, { capabilities: { domains: [...live.capabilities.domains, 'example'] }, services: live.services });
      bridge.handleMessage({ source: target.win, origin: 'null', data: { type: 'example.read', id: `r${run}` } } as MessageEvent);
      expect(target.postMessage).toHaveBeenCalledWith({ type: 'example.result', id: `r${run}` }, '*');
      bridge.destroy();
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/^\[KEHTO_COMPAT_SHELL_ENV_OVERRIDE\].*ShellAdapter\.extensions.*once per page/);
  });

  it('stays quiet for narrowing overrides and for ShellAdapter.extensions', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hooks = baseHooks({ extensions: [echoExtension()] });
    const { bridge, target, dispatch } = bridgeWith(hooks);
    originRegistry.setEnvironment(target.win, { capabilities: { domains: ['x-echo'] }, services: [] });
    dispatch({ type: 'x-echo.say', id: 'r' });
    expect(target.postMessage).toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    bridge.destroy();
  });
});
