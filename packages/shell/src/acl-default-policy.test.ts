import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShellBridge, originRegistry } from './index.js';
import type { ShellAdapter } from './index.js';
import { deliverFromNapplet } from './test-utils.js';

const identity = { dTag: 'example', aggregateHash: 'a'.repeat(64) };

function connect(aclDefaultPolicy?: ShellAdapter['aclDefaultPolicy']) {
  const handler = vi.fn();
  const hooks: ShellAdapter = {
    services: {
      example: {
        descriptor: { name: 'example', version: '1' },
        messageCapabilities: { 'example.read': 'relay:read' },
        handleMessage: handler,
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
    aclDefaultPolicy,
  };
  const bridge = createShellBridge(hooks);
  bridge.runtime.firewallState.setPolicy(identity.dTag, 'allow');
  const win = { postMessage: vi.fn() } as unknown as Window;
  originRegistry.register(win, 'acl-window', identity);
  originRegistry.setEnvironment(win, { capabilities: { domains: ['shell', 'example'] }, services: [] });
  const send = () => deliverFromNapplet(bridge, {
    source: win,
    origin: 'null',
    data: { type: 'example.read', id: 'q1' },
  });
  return { bridge, handler, send };
}

describe('aclDefaultPolicy on ShellAdapter (#398)', () => {
  beforeEach(() => originRegistry.clear());
  afterEach(() => originRegistry.clear());

  it('dispatches for an unknown identity when the host leaves the policy out', () => {
    const { bridge, handler, send } = connect();
    send();
    expect(handler).toHaveBeenCalledTimes(1);
    bridge.destroy();
  });

  it('refuses an unknown identity under restrictive until the host grants the capability', () => {
    const { bridge, handler, send } = connect('restrictive');
    send();
    expect(handler).not.toHaveBeenCalled();

    bridge.runtime.aclState.grant('', identity.dTag, identity.aggregateHash, 'relay:read');
    send();
    expect(handler).toHaveBeenCalledTimes(1);
    bridge.destroy();
  });
});
