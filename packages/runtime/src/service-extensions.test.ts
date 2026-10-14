import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createRuntime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import type { ServiceHandler } from './types.js';

const windowId = 'disposable-window';
const dTag = 'disposable-routing';
const hash = '0'.repeat(64);
const ping = { type: 'example.ping', id: 'extension-probe' };
const reply = { type: 'example.ping.result', id: ping.id } as NappletMessage;

function service(): ServiceHandler {
  return {
    descriptor: { name: 'example', version: '1.0.0' },
    messageCapabilities: { 'example.ping': null, 'example.read': 'state:read' },
    onRegistered: vi.fn(), onUnregistered: vi.fn(), onWindowDestroyed: vi.fn(),
    handleMessage: vi.fn((_windowId, _message, send) => send(reply)),
  };
}

function setup(initial?: ServiceHandler) {
  const allowed = vi.fn(() => true);
  const ctx = createMockRuntimeAdapter({ isDomainAllowed: allowed, services: initial ? { example: initial } : {} });
  const runtime = createRuntime(ctx.hooks);
  runtime.sessionRegistry.register(windowId, createNip5dSessionEntry(windowId, dTag, hash));
  runtime.firewallState.setPolicy(dTag, 'allow');
  return { ...ctx, runtime, allowed };
}

describe('registered service extension routing (issue #303)', () => {
  it.each(['initial', 'dynamic'])('routes recognized messages from %s registration with live identity', (mode) => {
    const handler = service();
    const { runtime, sent, allowed } = setup(mode === 'initial' ? handler : undefined);
    if (mode === 'dynamic') runtime.registerService('example', handler);
    const context = vi.mocked(handler.onRegistered!).mock.calls[0][0];
    expect(context.resolveDTag(windowId)).toBe(dTag);
    runtime.handleMessage(windowId, { ...ping, dTag: 'forged', windowId: 'forged' });
    expect(handler.handleMessage).toHaveBeenCalledWith(windowId, expect.objectContaining(ping), expect.any(Function));
    expect(sent).toEqual([{ windowId, message: reply }]);
    expect(allowed).toHaveBeenCalledWith(windowId, 'example');
    runtime.destroy();
    expect(handler.onUnregistered).toHaveBeenCalledOnce();
  });

  it('keeps undeclared extension types silent even under a denying firewall', () => {
    const handler = service();
    const { runtime, sent, hooks } = setup(handler);
    hooks.onFirewallEvent = vi.fn();
    runtime.firewallState.setPolicy(dTag, 'deny');
    for (const type of ['example.unknown', 'example.ping.result', 'other.ping', 'constructor.ping', '.ping', 'example.', 'example', 'example.ping?x=1']) {
      expect(() => runtime.handleMessage(windowId, { type, id: 'unknown' })).not.toThrow();
    }
    expect(handler.handleMessage).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
    expect(hooks.onFirewallEvent).not.toHaveBeenCalled();
  });

  it.each(['absent declaration', 'absent domain hook', 'denied domain', 'unknown source', 'blocked identity', 'firewall deny'])('denies %s without inventing an extension error envelope', (reason) => {
    const handler = service();
    if (reason === 'absent declaration') delete handler.messageCapabilities;
    const { runtime, hooks, sent, allowed } = setup(handler);
    if (reason === 'absent domain hook') delete hooks.isDomainAllowed;
    if (reason === 'denied domain') allowed.mockReturnValue(false);
    if (reason === 'blocked identity') runtime.aclState.block('', dTag, hash);
    if (reason === 'firewall deny') runtime.firewallState.setPolicy(dTag, 'deny');
    runtime.handleMessage(reason === 'unknown source' ? 'unregistered' : windowId, ping);
    expect(handler.handleMessage).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it('checks the declared capability against the actual source and retains firewall audit', () => {
    const handler = service();
    const { runtime, aclChecks, sent, hooks } = setup(handler);
    runtime.aclState.revoke('', dTag, hash, 'state:read');
    runtime.handleMessage(windowId, { type: 'example.read', dTag: 'forged' });
    expect(handler.handleMessage).not.toHaveBeenCalled();
    expect(aclChecks.at(-1)).toMatchObject({ identity: { dTag, hash }, capability: 'state:read', decision: 'deny' });
    expect(sent).toEqual([]);
    runtime.aclState.grant('', dTag, hash, 'state:read');
    hooks.onFirewallEvent = vi.fn();
    runtime.firewallState.setPolicy(dTag, 'deny');
    runtime.handleMessage(windowId, { type: 'example.read' });
    expect(handler.handleMessage).not.toHaveBeenCalled();
    expect(hooks.onFirewallEvent).toHaveBeenCalledWith(expect.objectContaining({ windowId, napplet: dTag, opClass: 'state:read', decision: 'reject' }));
    expect(sent).toEqual([]);
    runtime.firewallState.setPolicy(dTag, 'allow');
    runtime.handleMessage(windowId, { type: 'example.read' });
    expect(handler.handleMessage).toHaveBeenCalledOnce();
  });

  it('replaces and removes live routes with their attachment lifecycle', () => {
    const first = service();
    const second = service();
    const { runtime } = setup(first);
    runtime.handleMessage(windowId, ping);
    runtime.registerService('example', second);
    runtime.handleMessage(windowId, ping);
    expect(first.handleMessage).toHaveBeenCalledOnce();
    expect(first.onUnregistered).toHaveBeenCalledOnce();
    expect(second.handleMessage).toHaveBeenCalledOnce();
    runtime.unregisterService('example');
    runtime.unregisterService('example');
    runtime.handleMessage(windowId, ping);
    expect(second.handleMessage).toHaveBeenCalledOnce();
    expect(second.onUnregistered).toHaveBeenCalledOnce();
  });

  it.each(['replace', 'unregister', 'destroy'])('invalidates pending replies before %s cleanup hooks run', (action) => {
    const handler = service();
    let sendLater: (message: NappletMessage) => void = () => { throw new Error('handler was not invoked'); };
    handler.handleMessage = (_windowId, _message, send) => { sendLater = send; };
    handler.onUnregistered = () => sendLater(reply);
    const { runtime, sent } = setup(handler);
    runtime.handleMessage(windowId, ping);
    if (action === 'replace') runtime.registerService('example', service());
    if (action === 'unregister') runtime.unregisterService('example');
    if (action === 'destroy') runtime.destroy();
    expect(sent).toEqual([]);
  });

  it.each(['unregister', 'replace', 'same handler re-register', 'destroy', 'destroy window', 'remove source', 'replace source', 'same source re-register', 'domain revoke', 'ACL block', 'capability revoke'])('suppresses a delayed reply after %s', (change) => {
    const handler = service();
    let sendLater: (message: NappletMessage) => void = () => { throw new Error('handler was not invoked'); };
    handler.handleMessage = vi.fn((_windowId, _message, send) => { sendLater = send; });
    const { runtime, sent, allowed } = setup(handler);
    runtime.handleMessage(windowId, { type: 'example.read' });
    expect(handler.handleMessage).toHaveBeenCalledOnce();
    if (change === 'unregister') runtime.unregisterService('example');
    if (change === 'replace') runtime.registerService('example', service());
    if (change === 'same handler re-register') runtime.registerService('example', handler);
    if (change === 'destroy') runtime.destroy();
    if (change === 'destroy window') runtime.destroyWindow(windowId);
    if (change === 'remove source') runtime.sessionRegistry.unregister(windowId);
    if (change === 'replace source') runtime.sessionRegistry.register(windowId, createNip5dSessionEntry(windowId, 'other', hash));
    if (change === 'same source re-register') runtime.sessionRegistry.register(windowId, runtime.sessionRegistry.getEntryByWindowId(windowId)!);
    if (change === 'domain revoke') allowed.mockReturnValue(false);
    if (change === 'ACL block') runtime.aclState.block('', dTag, hash);
    if (change === 'capability revoke') runtime.aclState.revoke('', dTag, hash, 'state:read');
    sendLater(reply);
    expect(sent).toEqual([]);
  });

  it('does not let extension declarations override fixed NAP routes or revive signer/shell routing', () => {
    const { runtime, sent } = setup();
    for (const domain of ['identity', 'inc', 'shell', 'signer']) {
      const handler = service();
      handler.messageCapabilities = { [`${domain}.probe`]: null };
      runtime.registerService(domain, handler);
      runtime.handleMessage(windowId, { type: `${domain}.probe` });
      expect(handler.handleMessage).not.toHaveBeenCalled();
    }
    expect(sent).toEqual([]);
  });

  it('rejects inherited route declarations and cross-domain replies', () => {
    const handler = service();
    handler.messageCapabilities = Object.create({ 'example.ping': null });
    const { runtime, sent } = setup(handler);
    runtime.handleMessage(windowId, ping);
    expect(handler.handleMessage).not.toHaveBeenCalled();
    handler.messageCapabilities = { 'example.ping': null };
    handler.handleMessage = vi.fn((_windowId, _message, send) => send({ type: 'theme.changed' } as NappletMessage));
    runtime.handleMessage(windowId, ping);
    expect(handler.handleMessage).toHaveBeenCalledOnce();
    expect(sent).toEqual([]);
  });

  it('requires each source grant independently, without deriving authority from envelope fields', () => {
    const handler = service();
    const { runtime, sent, allowed } = setup(handler);
    runtime.sessionRegistry.register('other-window', createNip5dSessionEntry('other-window', 'other-app', hash));
    allowed.mockImplementation((source?: string) => source === windowId);
    runtime.handleMessage('other-window', { ...ping, windowId, dTag });
    expect(handler.handleMessage).not.toHaveBeenCalled();
    runtime.handleMessage(windowId, ping);
    expect(sent).toEqual([{ windowId, message: reply }]);
  });

  it('retains fixed-domain service routing without an extension declaration', () => {
    const common = service();
    delete common.messageCapabilities;
    const { runtime } = setup();
    runtime.registerService('common', common);
    runtime.handleMessage(windowId, { type: 'common.probe' });
    expect(common.handleMessage).toHaveBeenCalledOnce();
  });

  it.each([undefined, false, 'example:admin', {}, []])('fails closed for an invalid capability declaration: %j', (value) => {
    const handler = service();
    Object.defineProperty(handler.messageCapabilities!, 'example.ping', { value });
    const { runtime, sent } = setup(handler);
    runtime.handleMessage(windowId, ping);
    expect(handler.handleMessage).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it('does not dispatch after unregistering the source or destroying the runtime', () => {
    const handler = service();
    const { runtime, sent } = setup(handler);
    runtime.sessionRegistry.unregister(windowId);
    runtime.handleMessage(windowId, ping);
    runtime.sessionRegistry.register(windowId, createNip5dSessionEntry(windowId, dTag, hash));
    runtime.destroy();
    runtime.handleMessage(windowId, ping);
    expect(handler.handleMessage).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it('keeps firewall consent host-local and retries only a subsequent message', () => {
    const handler = service();
    const { runtime, sent } = setup(handler);
    runtime.firewallState.setPolicy(dTag, 'ask');
    const consent = vi.fn((request: Parameters<Parameters<typeof runtime.registerConsentHandler>[0]>[0]) => request.resolve(true));
    runtime.registerConsentHandler(consent);
    runtime.handleMessage(windowId, ping);
    expect(consent).toHaveBeenCalledOnce();
    expect(handler.handleMessage).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
    runtime.handleMessage(windowId, ping);
    expect(handler.handleMessage).toHaveBeenCalledOnce();
  });

  it('does not weaken a built-in ACL mapping through extension metadata', () => {
    const theme = service();
    theme.messageCapabilities = { 'theme.get': null };
    const { runtime } = setup();
    runtime.registerService('theme', theme);
    runtime.aclState.revoke('', dTag, hash, 'theme:read');
    runtime.handleMessage(windowId, { type: 'theme.get', id: 'read' });
    expect(theme.handleMessage).not.toHaveBeenCalled();
  });

  it('applies the existing firewall startup budget to extension operations', () => {
    const handler = service();
    const { runtime, sent } = setup(handler);
    runtime.firewallState.clear();
    for (let i = 0; i < 21; i++) runtime.handleMessage(windowId, ping);
    expect(handler.handleMessage).toHaveBeenCalledTimes(20);
    expect(sent).toHaveLength(20);
  });
});
