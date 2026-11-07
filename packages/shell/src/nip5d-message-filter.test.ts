import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShellBridge, MAX_DEFERRED_MESSAGES, originRegistry } from './index.js';
import type { NappletMessage, NappletMessageDecision, NappletRevocation, ShellAdapter } from './index.js';
import { deliverFromNapplet } from './test-utils.js';

const identity = { dTag: 'example', aggregateHash: 'a'.repeat(64) };
const windowId = 'filter-window';

type Filter = NonNullable<ShellAdapter['filterNappletMessage']>;

function setup(filter?: Filter) {
  const handled: unknown[] = [];
  const observed: string[] = [];
  const revocations: NappletRevocation[] = [];
  const hooks: ShellAdapter = {
    services: {
      example: {
        descriptor: { name: 'example', version: '1' },
        messageCapabilities: { 'example.read': null },
        handleMessage: (_windowId, message) => {
          handled.push((message as { id?: unknown }).id);
        },
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
    filterNappletMessage: filter,
    onNappletMessage: (_windowId, message) => observed.push(message.type),
    onNappletRevoked: (revocation) => revocations.push(revocation),
  };
  const bridge = createShellBridge(hooks);
  bridge.runtime.firewallState.setPolicy(identity.dTag, 'allow');
  const postMessage = vi.fn();
  const win = { postMessage } as unknown as Window;
  originRegistry.register(win, windowId, identity);
  originRegistry.setEnvironment(win, { capabilities: { domains: ['shell', 'example'] }, services: [] });
  const deliver = (data: Record<string, unknown>) => deliverFromNapplet(bridge, { source: win, origin: 'null', data });
  const read = (id: string) => deliver({ type: 'example.read', id });
  return { bridge, handled, observed, revocations, postMessage, deliver, read };
}

/** A filter whose decision tests can change between messages. */
function switchable(initial: NappletMessageDecision) {
  const control = { decision: initial };
  return { control, filter: (): NappletMessageDecision => control.decision };
}

describe('filterNappletMessage (#399)', () => {
  beforeEach(() => originRegistry.clear());
  afterEach(() => originRegistry.clear());

  it('dispatches as before when the host has no filter', () => {
    const { bridge, handled, read } = setup();
    read('a');
    expect(handled).toEqual(['a']);
    bridge.destroy();
  });

  it('passes the window and envelope to the filter', () => {
    const filter = vi.fn<Filter>(() => 'dispatch');
    const { bridge, handled, read } = setup(filter);
    read('a');
    expect(filter).toHaveBeenCalledWith(windowId, { type: 'example.read', id: 'a' });
    expect(handled).toEqual(['a']);
    bridge.destroy();
  });

  it('drops one envelope without revoking the binding', () => {
    const filter = (_windowId: string, message: NappletMessage): NappletMessageDecision =>
      (message as { id?: string }).id === 'big' ? 'drop' : 'dispatch';
    const { bridge, handled, observed, revocations, read } = setup(filter);
    read('big');
    read('small');
    expect(handled).toEqual(['small']);
    expect(observed).toEqual(['example.read', 'example.read']);
    expect(revocations).toEqual([]);
    bridge.destroy();
  });

  it.each([
    ['throws', (): NappletMessageDecision => { throw new Error('boom'); }],
    ['returns an unknown value', () => 'allow' as unknown as NappletMessageDecision],
    ['returns nothing', () => undefined as unknown as NappletMessageDecision],
  ])('drops the envelope when the filter %s', (_label, filter) => {
    const { bridge, handled, revocations, read } = setup(filter);
    read('a');
    expect(handled).toEqual([]);
    expect(revocations).toEqual([]);
    bridge.destroy();
  });

  it('holds deferred envelopes and releases them in arrival order', () => {
    const { control, filter } = switchable('defer');
    const { bridge, handled, read } = setup(filter);
    read('a');
    read('b');
    expect(handled).toEqual([]);

    control.decision = 'dispatch';
    expect(bridge.releaseDeferred(windowId)).toBe(2);
    expect(handled).toEqual(['a', 'b']);
    expect(bridge.releaseDeferred(windowId)).toBe(0);

    read('c');
    expect(handled).toEqual(['a', 'b', 'c']);
    bridge.destroy();
  });

  it('does not let a later dispatch overtake deferred envelopes', () => {
    const { control, filter } = switchable('defer');
    const { bridge, handled, read } = setup(filter);
    read('a');
    control.decision = 'dispatch';
    read('b');
    expect(handled).toEqual([]);

    bridge.releaseDeferred(windowId);
    expect(handled).toEqual(['a', 'b']);
    bridge.destroy();
  });

  it('still discards a dropped envelope while others are deferred', () => {
    const { control, filter } = switchable('defer');
    const { bridge, handled, read } = setup(filter);
    read('a');
    control.decision = 'drop';
    read('b');
    bridge.releaseDeferred(windowId);
    expect(handled).toEqual(['a']);
    bridge.destroy();
  });

  it('applies the firewall at release, not at arrival', () => {
    const { filter } = switchable('defer');
    const { bridge, handled, read } = setup(filter);
    read('a');
    bridge.runtime.firewallState.setPolicy(identity.dTag, 'deny');
    bridge.releaseDeferred(windowId);
    expect(handled).toEqual([]);
    bridge.destroy();
  });

  it.each(['drop', 'defer'] as const)('answers shell.ready without consulting a filter set to %s', (decision) => {
    const filter = vi.fn<Filter>(() => decision);
    const { bridge, postMessage, deliver } = setup(filter);
    deliver({ type: 'shell.ready' });
    expect(filter).not.toHaveBeenCalled();
    expect(postMessage.mock.calls.filter(([message]) => message.type === 'shell.init')).toHaveLength(1);
    bridge.destroy();
  });

  it('binds the session even when the first envelope is dropped', () => {
    const { bridge, read } = setup(() => 'drop');
    read('a');
    expect(bridge.runtime.sessionRegistry.getEntryByWindowId(windowId)).toMatchObject(identity);
    bridge.destroy();
  });

  it('does not dispatch when the filter revokes the binding from its callback', () => {
    const holder: { revoke?: () => void } = {};
    const { bridge, handled, revocations, read } = setup(() => {
      holder.revoke?.();
      return 'dispatch';
    });
    holder.revoke = () => bridge.revokeNapplet(windowId);
    read('a');
    expect(handled).toEqual([]);
    expect(revocations.map((revocation) => revocation.reason)).toEqual(['host']);
    bridge.destroy();
  });

  it('discards deferred envelopes when the binding is revoked', () => {
    const { bridge, handled, read } = setup(() => 'defer');
    read('a');
    bridge.revokeNapplet(windowId);
    expect(bridge.releaseDeferred(windowId)).toBe(0);
    expect(handled).toEqual([]);
    bridge.destroy();
  });

  it('returns zero for a window with no binding', () => {
    const { bridge } = setup();
    expect(bridge.releaseDeferred('nobody')).toBe(0);
    bridge.destroy();
  });

  it('revokes with deferred-overflow past the bound and keeps what fits until then', () => {
    const { bridge, handled, revocations, read } = setup(() => 'defer');
    for (let i = 0; i < MAX_DEFERRED_MESSAGES; i += 1) read(`m${i}`);
    expect(revocations).toEqual([]);

    read('one-too-many');
    expect(revocations).toEqual([expect.objectContaining({ windowId, reason: 'deferred-overflow' })]);
    expect(bridge.releaseDeferred(windowId)).toBe(0);
    expect(handled).toEqual([]);
    bridge.destroy();
  });
});
