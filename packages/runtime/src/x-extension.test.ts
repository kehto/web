import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createRuntime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import type { ServiceHandler, ServiceRuntimeContext } from './types.js';

// Kehto spec-gap policy: experimental x- domains and x-<domain>:<action>
// capabilities (no napplet/naps convention at master 43cb3a4).
const windowId = 'x-window';
const dTag = 'x-probe';
const hash = 'f'.repeat(64);

function echoService(overrides: Partial<ServiceHandler> = {}): ServiceHandler & { context?: ServiceRuntimeContext } {
  const handler: ServiceHandler & { context?: ServiceRuntimeContext } = {
    descriptor: { name: 'x-echo', version: '0.1.0' },
    messageCapabilities: { 'x-echo.say': 'x-echo:send', 'x-echo.state': null },
    pushCapabilities: { 'x-echo.heard': 'x-echo:receive' },
    onRegistered(context) { handler.context = context; },
    handleMessage: vi.fn((_w, message, send) => send({ type: 'x-echo.say.result', id: (message as { id?: string }).id } as NappletMessage)),
    ...overrides,
  };
  return handler;
}

function setup(handler: ServiceHandler, policy: 'permissive' | 'restrictive' = 'permissive', firewallAllow = true) {
  const allowed = vi.fn((_w: string, domain: string) => domain === 'x-echo');
  const ctx = createMockRuntimeAdapter({ isDomainAllowed: allowed, services: { 'x-echo': handler } });
  const runtime = createRuntime(ctx.hooks);
  runtime.sessionRegistry.register(windowId, createNip5dSessionEntry(windowId, dTag, hash));
  if (firewallAllow) runtime.firewallState.setPolicy(dTag, 'allow');
  if (policy === 'restrictive') {
    runtime.aclState.revoke('', dTag, hash, 'x-echo:send');
    runtime.aclState.revoke('', dTag, hash, 'x-echo:receive');
  }
  return { ...ctx, runtime, allowed };
}

const heard = { type: 'x-echo.heard', text: 'hi' } as NappletMessage;

describe('x- extension capabilities on inbound routes', () => {
  it('routes with an own-domain extension grant and denies after revoke', () => {
    const handler = echoService();
    const { runtime, sent, aclChecks } = setup(handler);
    runtime.handleMessage(windowId, { type: 'x-echo.say', id: '1' });
    expect(sent).toEqual([{ windowId, message: { type: 'x-echo.say.result', id: '1' } }]);
    runtime.aclState.revoke('', dTag, hash, 'x-echo:send');
    runtime.handleMessage(windowId, { type: 'x-echo.say', id: '2' });
    expect(sent).toHaveLength(1);
    expect(aclChecks.at(-1)).toMatchObject({ capability: 'x-echo:send', decision: 'deny' });
    runtime.aclState.grant('', dTag, hash, 'x-echo:send');
    runtime.handleMessage(windowId, { type: 'x-echo.say', id: '3' });
    expect(sent).toHaveLength(2);
  });

  it('refuses borrowed or invented capabilities as undeclared routes', () => {
    const handler = echoService({ messageCapabilities: { 'x-echo.say': 'x-other:send' as never, 'x-echo.llm': 'x-llm:generate' as never } });
    const { runtime, sent } = setup(handler);
    runtime.handleMessage(windowId, { type: 'x-echo.say', id: '1' });
    runtime.handleMessage(windowId, { type: 'x-echo.llm', id: '2' });
    expect(handler.handleMessage).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it('applies firewall opClass rules to the extension capability', () => {
    const handler = echoService();
    const { runtime, sent, hooks } = setup(handler, 'permissive', false);
    hooks.onFirewallEvent = vi.fn();
    runtime.firewallState.addMatcher({ id: 'block-echo', opClass: 'x-echo:send', action: 'block' });
    runtime.handleMessage(windowId, { type: 'x-echo.say', id: '1' });
    expect(handler.handleMessage).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
    expect(hooks.onFirewallEvent).toHaveBeenCalledWith(expect.objectContaining({ opClass: 'x-echo:send', decision: 'reject' }));
  });
});

describe('x- extension push through sendToEligibleNapplet', () => {
  it('delivers a declared push to an eligible live session', () => {
    const handler = echoService();
    const { sent } = setup(handler);
    expect(handler.context?.sendToEligibleNapplet(windowId, heard)).toBe(true);
    expect(sent).toEqual([{ windowId, message: heard }]);
  });

  it.each([
    'undeclared type', 'other domain', 'unknown window', 'domain not granted', 'blocked identity',
    'capability revoked', 'firewall deny', 'unregistered handler', 'non-owner handler',
  ])('drops a push for %s without an invented envelope', (reason) => {
    const handler = echoService();
    const { runtime, sent, allowed } = setup(handler);
    let message: NappletMessage = heard;
    let target = windowId;
    let context = handler.context!;
    if (reason === 'undeclared type') message = { type: 'x-echo.secret' } as NappletMessage;
    if (reason === 'other domain') message = { type: 'x-other.heard' } as NappletMessage;
    if (reason === 'unknown window') target = 'nobody';
    if (reason === 'domain not granted') allowed.mockReturnValue(false);
    if (reason === 'blocked identity') runtime.aclState.block('', dTag, hash);
    if (reason === 'capability revoked') runtime.aclState.revoke('', dTag, hash, 'x-echo:receive');
    if (reason === 'firewall deny') runtime.firewallState.setPolicy(dTag, 'deny');
    if (reason === 'unregistered handler') runtime.unregisterService('x-echo');
    if (reason === 'non-owner handler') {
      const other = echoService({ descriptor: { name: 'x-other', version: '0.1.0' } });
      runtime.registerService('x-other', other);
      context = other.context!;
    }
    expect(context.sendToEligibleNapplet(target, message)).toBe(false);
    expect(sent).toEqual([]);
  });

  it('never lets an extension push a built-in domain, even with every domain granted', () => {
    const handler = echoService();
    const { sent, allowed } = setup(handler);
    allowed.mockReturnValue(true);
    for (const type of ['theme.changed', 'identity.changed', 'llm.delta', 'gamepad.state', 'notify.clicked', 'inc.event', 'x-other.heard']) {
      expect(handler.context?.sendToEligibleNapplet(windowId, { type, requestId: 'r', sequence: 0, text: 'forged' } as NappletMessage), type).toBe(false);
    }
    expect(sent).toEqual([]);
  });

  it('keeps built-in services on their existing push path', () => {
    let context: ServiceRuntimeContext | undefined;
    const theme: ServiceHandler = { descriptor: { name: 'theme', version: '1' }, onRegistered(c) { context = c; }, handleMessage() {} };
    const ctx = createMockRuntimeAdapter({ isDomainAllowed: () => true, services: { theme } });
    const runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register(windowId, createNip5dSessionEntry(windowId, dTag, hash));
    expect(context?.sendToEligibleNapplet(windowId, { type: 'theme.changed' } as NappletMessage)).toBe(true);
    expect(ctx.sent).toHaveLength(1);
  });

  it('honors restrictive policy until the extension capability is granted', () => {
    const handler = echoService();
    const { runtime, sent } = setup(handler, 'restrictive');
    expect(handler.context?.sendToEligibleNapplet(windowId, heard)).toBe(false);
    runtime.aclState.grant('', dTag, hash, 'x-echo:receive');
    expect(handler.context?.sendToEligibleNapplet(windowId, heard)).toBe(true);
    expect(sent).toHaveLength(1);
    expect(runtime.aclState.getEntry('', dTag, hash)?.extensions).toEqual({ 'x-echo:send': false, 'x-echo:receive': true });
  });
});
