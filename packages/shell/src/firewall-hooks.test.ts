import type { FirewallPersistence } from '@kehto/rate-limit/legacy';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { originRegistry } from './index.js';
import { createLegacyShellBridge as createShellBridge } from './legacy-test-utils.js';
import type { FirewallEvent, ShellAdapter } from './index.js';
import { deliverFromNapplet } from './test-utils.js';

const identity = { dTag: 'example', aggregateHash: 'a'.repeat(64) };
const windowId = 'firewall-window';

function createHooks(overrides: Partial<ShellAdapter> & { firewallPersistence?: FirewallPersistence }): ShellAdapter & { firewallPersistence?: FirewallPersistence } {
  return {
    services: {
      example: {
        descriptor: { name: 'example', version: '1' },
        messageCapabilities: { 'example.read': null },
        handleMessage: vi.fn(),
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
    ...overrides,
  };
}

function connect(hooks: ShellAdapter) {
  const bridge = createShellBridge(hooks);
  const win = { postMessage: vi.fn() } as unknown as Window;
  originRegistry.register(win, windowId, identity);
  originRegistry.setEnvironment(win, { capabilities: { domains: ['shell', 'example'] }, services: [] });
  const send = () => deliverFromNapplet(bridge, {
    source: win,
    origin: 'null',
    data: { type: 'example.read', id: 'q1' },
  });
  return { bridge, send };
}

describe('firewall hooks on ShellAdapter (#397)', () => {
  beforeEach(() => originRegistry.clear());
  afterEach(() => originRegistry.clear());

  it('feeds getFocusContext into the firewall observation for that window', () => {
    const getFocusContext = vi.fn(() => ({ focused: false, msSinceFocusGain: 1234 }));
    const { bridge, send } = connect(createHooks({ getFocusContext }));
    const evaluate = vi.spyOn(bridge.runtime.firewallState, 'evaluate');

    send();

    expect(getFocusContext).toHaveBeenCalledWith(windowId);
    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ focused: false, msSinceFocusGain: 1234 }));
    bridge.destroy();
  });

  it('treats a window as focused when the host has no getFocusContext', () => {
    const { bridge, send } = connect(createHooks({}));
    const evaluate = vi.spyOn(bridge.runtime.firewallState, 'evaluate');

    send();

    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ focused: true }));
    bridge.destroy();
  });

  it('reports a firewall rejection through onFirewallEvent', () => {
    const events: FirewallEvent[] = [];
    const { bridge, send } = connect(createHooks({ onFirewallEvent: (event) => events.push(event) }));
    bridge.runtime.firewallState.setPolicy(identity.dTag, 'deny');

    send();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      windowId,
      napplet: identity.dTag,
      decision: 'reject',
      message: { type: 'example.read', id: 'q1' },
    });
    bridge.destroy();
  });

  it('keeps firewall config across bridges through firewallPersistence', () => {
    let stored: string | null = null;
    const firewallPersistence: FirewallPersistence = {
      persist: (raw) => { stored = raw; },
      load: () => stored,
    };

    const first = createShellBridge(createHooks({ firewallPersistence }));
    first.runtime.firewallState.setPolicy(identity.dTag, 'deny');
    first.runtime.firewallState.persist();
    first.destroy();
    expect(stored).not.toBeNull();

    const events: FirewallEvent[] = [];
    const { bridge, send } = connect(createHooks({
      firewallPersistence,
      onFirewallEvent: (event) => events.push(event),
    }));
    send();

    expect(events).toEqual([expect.objectContaining({ decision: 'reject', napplet: identity.dTag })]);
    bridge.destroy();
  });
});
