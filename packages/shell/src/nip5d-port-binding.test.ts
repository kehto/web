/**
 * NIP-5D port-bound identity (nostr-protocol/nips#2303 @ 51ef0cd, packaged in
 * napplet/web#302 / @napplet/core 0.37.0): the shell binds a napplet's
 * verified identity to the MessagePort from its single `napplet.hello`, uses
 * only that port for NAP traffic, and revokes + removes the frame on any
 * evidence that the verified document was replaced.
 *
 * These tests use real MessageChannels (asynchronous delivery).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShellBridge, NAPPLET_HELLO } from './shell-bridge.js';
import { originRegistry } from './origin-registry.js';
import type { NappletRevocation, ShellAdapter } from './types.js';

const identity = { dTag: 'port-napp', aggregateHash: 'a'.repeat(64) };

function makeHooks(onNappletRevoked: (revocation: NappletRevocation) => void): ShellAdapter {
  return {
    relayPool: {
      getRelayPool: () => null,
      trackSubscription: () => {},
      untrackSubscription: () => {},
      openScopedRelay: () => {},
      closeScopedRelay: () => {},
      publishToScopedRelay: () => false,
      selectRelayTier: () => [],
    },
    relayConfig: {
      addRelay: () => {},
      removeRelay: () => {},
      getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }),
      getNip66Suggestions: () => null,
    },
    windowManager: { createWindow: () => null },
    auth: { getUserPubkey: () => null, getSigner: () => null },
    config: { getNappUpdateBehavior: () => 'banner' },
    hotkeys: { executeHotkeyFromForward: () => {} },
    workerRelay: { getWorkerRelay: () => null },
    crypto: { verifyEvent: async () => true },
    capabilities: { resolveEnvironment: () => ({ domains: ['shell', 'relay'], services: [] }) },
    onNappletRevoked,
  };
}

/** A fake iframe Window: any window-level post to it is a NIP-5D violation. */
function makeFrameWindow(): Window & { postMessage: ReturnType<typeof vi.fn> } {
  return { postMessage: vi.fn() } as unknown as Window & { postMessage: ReturnType<typeof vi.fn> };
}

function nextMessage(port: MessagePort): Promise<unknown> {
  return new Promise((resolve) => {
    port.addEventListener('message', (event) => resolve(event.data), { once: true });
    port.start();
  });
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));

function setup(windowId = 'port-window') {
  const revocations: NappletRevocation[] = [];
  const bridge = createShellBridge(makeHooks((revocation) => revocations.push(revocation)));
  const win = makeFrameWindow();
  originRegistry.register(win, windowId, identity);
  const channel = new MessageChannel();
  const hello = (ports: MessagePort[] = [channel.port2], data: unknown = { type: NAPPLET_HELLO }) => {
    bridge.handleMessage({ source: win, origin: 'null', data, ports } as unknown as MessageEvent);
  };
  const windowLevel = (data: unknown) => {
    bridge.handleMessage({ source: win, origin: 'null', data, ports: [] } as unknown as MessageEvent);
  };
  return { bridge, win, windowId, napplet: channel.port1, hello, windowLevel, revocations };
}

describe('NIP-5D port-bound identity', () => {
  beforeEach(() => originRegistry.clear());
  afterEach(() => originRegistry.clear());

  it('binds the hello port and carries NAP traffic in both directions only over it', async () => {
    const { bridge, win, windowId, napplet, hello, revocations } = setup();
    hello();
    expect(originRegistry.getPort(windowId)).toBeDefined();

    const reply = nextMessage(napplet);
    napplet.postMessage({ type: 'shell.ready' });
    await expect(reply).resolves.toEqual({ type: 'shell.init', capabilities: { domains: ['shell', 'relay'] }, services: [] });
    expect(bridge.runtime.sessionRegistry.getEntryByWindowId(windowId)).toMatchObject(identity);

    const eose = nextMessage(napplet);
    napplet.postMessage({ type: 'relay.subscribe', subId: 's1', filters: [] });
    await expect(eose).resolves.toMatchObject({ type: 'relay.eose', subId: 's1' });

    // Shells MUST NOT send NAP messages via iframeWindow.postMessage.
    expect(win.postMessage).not.toHaveBeenCalled();
    expect(revocations).toEqual([]);
    bridge.destroy();
    napplet.close();
  });

  it.each([
    ['a NAP envelope', { type: 'shell.ready' }, 'window-message'],
    ['a second napplet.hello', { type: NAPPLET_HELLO }, 'second-hello'],
  ] as const)('revokes and asks the host to remove the frame on %s at window level after the handoff', async (_label, data, reason) => {
    const { bridge, win, windowId, napplet, hello, windowLevel, revocations } = setup();
    hello();
    napplet.postMessage({ type: 'shell.ready' });
    await flush();
    expect(bridge.runtime.sessionRegistry.getEntryByWindowId(windowId)).toBeDefined();

    windowLevel(data);

    expect(revocations).toEqual([expect.objectContaining({ windowId, reason })]);
    expect(originRegistry.getPort(windowId)).toBeUndefined();
    expect(originRegistry.getWindowId(win)).toBeUndefined();
    expect(bridge.runtime.sessionRegistry.getEntryByWindowId(windowId)).toBeUndefined();
    // The shell MUST NOT re-bind a napplet identity to an existing iframe.
    expect(() => originRegistry.register(win, windowId, identity)).toThrow(/fresh iframe/);

    // The revoked document's port is closed: nothing it sends is processed.
    napplet.postMessage({ type: 'relay.subscribe', subId: 'after', filters: [] });
    await flush();
    expect(bridge.runtime.sessionRegistry.getEntryByWindowId(windowId)).toBeUndefined();
    expect(revocations).toHaveLength(1);
    bridge.destroy();
  });

  it('revokes a legacy window-level envelope that arrives instead of the hello', () => {
    const { bridge, win, windowId, windowLevel, revocations } = setup();
    windowLevel({ type: 'shell.ready' });
    expect(revocations).toEqual([expect.objectContaining({ windowId, reason: 'window-message' })]);
    expect(bridge.runtime.sessionRegistry.getEntryByWindowId(windowId)).toBeUndefined();
    expect(win.postMessage).not.toHaveBeenCalled();
    bridge.destroy();
  });

  it.each([
    ['no port', []],
    ['two ports', 'two'],
  ] as const)('revokes a napplet.hello carrying %s', (_label, ports) => {
    const { bridge, windowId, hello, revocations } = setup();
    const extra = new MessageChannel();
    hello(ports === 'two' ? [extra.port1, extra.port2] : []);
    expect(revocations).toEqual([expect.objectContaining({ windowId, reason: 'invalid-hello' })]);
    expect(originRegistry.getPort(windowId)).toBeUndefined();
    bridge.destroy();
  });

  it('revokes on a second iframe load observed by the host', () => {
    const { bridge, windowId, hello, revocations } = setup();
    const frame = new EventTarget();
    bridge.observeFrame(frame as unknown as HTMLIFrameElement, windowId);
    hello();
    frame.dispatchEvent(new Event('load'));
    expect(revocations).toEqual([]);
    frame.dispatchEvent(new Event('load'));
    expect(revocations).toEqual([expect.objectContaining({ windowId, reason: 'second-load' })]);
    expect(originRegistry.getPort(windowId)).toBeUndefined();
    bridge.destroy();
  });

  it('revokes when the napplet side of the port closes', async () => {
    const { bridge, windowId, napplet, hello, revocations } = setup();
    hello();
    napplet.close();
    await flush();
    expect(revocations).toEqual([expect.objectContaining({ windowId, reason: 'port-closed' })]);
    bridge.destroy();
  });

  it('does not report a revocation when the host retires the window itself', async () => {
    const { bridge, windowId, napplet, hello, revocations } = setup();
    hello();
    originRegistry.unregister(windowId);
    await flush();
    expect(revocations).toEqual([]);
    napplet.close();
    bridge.destroy();
  });

  it('drops window-level messages from sources the shell did not create', () => {
    const { bridge, revocations } = setup();
    const channel = new MessageChannel();
    bridge.handleMessage({
      source: makeFrameWindow(),
      origin: 'null',
      data: { type: NAPPLET_HELLO },
      ports: [channel.port2],
    } as unknown as MessageEvent);
    expect(revocations).toEqual([]);
    expect(originRegistry.getAllWindowIds()).toEqual(['port-window']);
    bridge.destroy();
    channel.port1.close();
  });

  it('lets the host revoke a binding explicitly and keeps revocation idempotent', () => {
    const { bridge, windowId, hello, revocations } = setup();
    hello();
    bridge.revokeNapplet(windowId);
    bridge.revokeNapplet(windowId);
    expect(revocations).toEqual([expect.objectContaining({ windowId, reason: 'host' })]);
    bridge.destroy();
  });
});
