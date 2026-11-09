import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createRuntime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import type { ServiceHandler, ServiceRuntimeContext } from './types.js';
import type { AclCapability } from './acl-state.js';

// Regressions for review findings CR-01, CR-02 and WR-01..WR-04 (quick task 261031-ia2).
const windowId = 'x-window';
const other = 'other-window';
const dTag = 'x-probe';
const hash = 'a'.repeat(64);

function setup(services: Record<string, ServiceHandler>, granted: (w: string, d: string) => boolean = () => true) {
  const ctx = createMockRuntimeAdapter({ isDomainAllowed: vi.fn(granted), services });
  const runtime = createRuntime(ctx.hooks);
  runtime.sessionRegistry.register(windowId, createNip5dSessionEntry(windowId, dTag, hash));
  runtime.sessionRegistry.register(other, createNip5dSessionEntry(other, 'other', 'b'.repeat(64)));
  return { ...ctx, runtime };
}

describe('x- reply callback is not a push channel (CR-01)', () => {
  it('accepts exactly one <type>.result and nothing else', () => {
    let keep: ((m: NappletMessage) => void) | undefined;
    const echo: ServiceHandler = {
      descriptor: { name: 'x-echo', version: '1' },
      messageCapabilities: { 'x-echo.say': null },
      handleMessage(_w, message, send) {
        keep = send;
        send({ type: 'x-echo.undeclared-push' } as NappletMessage);
        send({ type: 'x-echo.say.result', id: (message as { id?: string }).id } as NappletMessage);
        send({ type: 'x-echo.say.result', id: 'again' } as NappletMessage);
      },
    };
    const { runtime, sent } = setup({ 'x-echo': echo });
    runtime.handleMessage(windowId, { type: 'x-echo.say', id: '1' });
    keep?.({ type: 'x-echo.later' } as NappletMessage);
    expect(sent).toEqual([{ windowId, message: { type: 'x-echo.say.result', id: '1' } }]);
  });
});

describe('invalid x- names never reach built-in paths (CR-02)', () => {
  it.each(['x-llm', 'x-shell', 'x-Echo'])('a service registered as %s routes nothing and pushes nothing', (name) => {
    let context: ServiceRuntimeContext | undefined;
    const rogue: ServiceHandler = {
      descriptor: { name, version: '1' },
      messageCapabilities: { [`${name}.go`]: null },
      onRegistered(c) { context = c; },
      handleMessage: vi.fn(),
    };
    const { runtime, sent } = setup({ [name]: rogue });
    runtime.handleMessage(windowId, { type: `${name}.go`, id: '1' });
    expect(rogue.handleMessage).not.toHaveBeenCalled();
    for (const type of ['theme.changed', 'gamepad.state', `${name}.go`]) expect(context?.sendToEligibleNapplet(windowId, { type } as NappletMessage)).toBe(false);
    expect(sent).toEqual([]);
  });
});

describe('x- policies and context stay in their own domain (WR-01..WR-03)', () => {
  it('refuses built-in capabilities as x- gates', () => {
    const echo: ServiceHandler = {
      descriptor: { name: 'x-echo', version: '1' },
      messageCapabilities: { 'x-echo.read': 'relay:read' },
      pushCapabilities: { 'x-echo.heard': 'relay:read' },
      handleMessage: vi.fn(),
    };
    let context: ServiceRuntimeContext | undefined;
    echo.onRegistered = (c) => { context = c; };
    const { runtime, sent } = setup({ 'x-echo': echo });
    runtime.handleMessage(windowId, { type: 'x-echo.read', id: '1' });
    expect(echo.handleMessage).not.toHaveBeenCalled();
    expect(context?.sendToEligibleNapplet(windowId, { type: 'x-echo.heard' } as NappletMessage)).toBe(false);
    expect(sent).toEqual([]);
  });

  it('scopes listWindowIds, resolveDTag and hasCapability to its granted windows and own capabilities', () => {
    let context: ServiceRuntimeContext | undefined;
    const echo: ServiceHandler = { descriptor: { name: 'x-echo', version: '1' }, onRegistered(c) { context = c; }, handleMessage() {} };
    setup({ 'x-echo': echo }, (w, d) => d === 'x-echo' && w === windowId);
    expect(context?.listWindowIds()).toEqual([windowId]);
    expect(context?.resolveDTag(other)).toBeUndefined();
    expect(context?.hasCapability(windowId, 'relay:write')).toBe(false);
    expect(context?.hasCapability(windowId, 'x-echo:send')).toBe(true);
  });

  it('hears only blocks and its own revocations', () => {
    const revoked: unknown[] = [];
    const echo: ServiceHandler = { descriptor: { name: 'x-echo', version: '1' }, handleMessage() {}, onCapabilityRevoked: (_w, c) => revoked.push(c) };
    const { runtime } = setup({ 'x-echo': echo });
    runtime.aclState.revoke('', dTag, hash, 'relay:write');
    runtime.aclState.revoke('', dTag, hash, 'identity:read');
    runtime.aclState.revoke('', dTag, hash, 'x-echo:send');
    runtime.aclState.block('', dTag, hash);
    expect(revoked).toEqual(['x-echo:send', null]);
  });
});

describe('x- pushes and the firewall (WR-04)', () => {
  function pusher() {
    let context: ServiceRuntimeContext | undefined;
    const echo: ServiceHandler = {
      descriptor: { name: 'x-echo', version: '1' },
      messageCapabilities: { 'x-echo.say': 'x-echo:send' },
      pushCapabilities: { 'x-echo.heard': 'x-echo:listen' },
      onRegistered(c) { context = c; },
      handleMessage(_w, m, send) { send({ type: 'x-echo.say.result', id: (m as { id?: string }).id } as NappletMessage); },
    };
    return { echo, context: () => context! };
  }

  it('does not spend the napplet request budget', () => {
    const { echo, context } = pusher();
    const { runtime, sent } = setup({ 'x-echo': echo });
    runtime.firewallState.setGlobalRate(dTag, { capacity: 1, windowMs: 60_000, action: 'block' });
    for (let i = 0; i < 5; i += 1) expect(context().sendToEligibleNapplet(windowId, { type: 'x-echo.heard' } as NappletMessage)).toBe(true);
    runtime.handleMessage(windowId, { type: 'x-echo.say', id: 'req' });
    expect(sent.at(-1)).toEqual({ windowId, message: { type: 'x-echo.say.result', id: 'req' } });
  });

  it('drops pushes under deny or ask policy without raising consent', () => {
    const { echo, context } = pusher();
    const { runtime, sent } = setup({ 'x-echo': echo });
    const consent = vi.fn();
    runtime.registerConsentHandler(consent);
    for (const policy of ['deny', 'ask'] as const) {
      runtime.firewallState.setPolicy(dTag, policy);
      expect(context().sendToEligibleNapplet(windowId, { type: 'x-echo.heard' } as NappletMessage)).toBe(false);
    }
    expect(consent).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });
});

describe('unknown capability strings (IN-02)', () => {
  it('hasCapability denies non-capability strings under the permissive default', () => {
    let probeContext: ServiceRuntimeContext | undefined;
    let echoContext: ServiceRuntimeContext | undefined;
    const probe: ServiceHandler = { descriptor: { name: 'probe', version: '1' }, onRegistered(c) { probeContext = c; }, handleMessage() {} };
    const echo: ServiceHandler = { descriptor: { name: 'x-echo', version: '1' }, onRegistered(c) { echoContext = c; }, handleMessage() {} };
    setup({ probe, 'x-echo': echo });
    const notACapability: string = 'not:a-cap';
    const badAction: string = 'x-echo:Bad_Action';
    expect(probeContext?.hasCapability(windowId, notACapability as AclCapability)).toBe(false);
    expect(probeContext?.hasCapability(windowId, 'relay:read')).toBe(true);
    expect(echoContext?.hasCapability(windowId, badAction as AclCapability)).toBe(false);
    expect(echoContext?.hasCapability(windowId, 'x-echo:send')).toBe(true);
  });
});
