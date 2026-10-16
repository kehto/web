import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShellBridge, originRegistry, resolveShellEnvironment } from './index.js';
import type { ShellAdapter } from './index.js';

const identity = { dTag: 'example', aggregateHash: 'a'.repeat(64) };
const windowId = 'example-window';

function createHarness() {
  const handler = vi.fn((_windowId, message, send) => {
    send({ type: 'example.result', id: message.id });
  });
  const hooks: ShellAdapter = {
    services: {
      example: {
        descriptor: { name: 'example', version: '1' },
        messageCapabilities: { 'example.read': null },
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
  };
  const bridge = createShellBridge(hooks);
  const defaults = resolveShellEnvironment(hooks, identity);
  const explicit = {
    capabilities: { domains: [...defaults.capabilities.domains, 'example'] },
    services: [...defaults.services, 'private-example'],
  };
  const dispatch = (source: Window, data: Record<string, unknown>) => {
    bridge.handleMessage({ source, origin: 'null', data } as MessageEvent);
  };
  bridge.runtime.firewallState.setPolicy(identity.dTag, 'allow');
  return { bridge, defaults, explicit, dispatch, handler };
}

function createFrame() {
  const postMessage = vi.fn();
  return { win: { postMessage } as unknown as Window, postMessage };
}

// NAP-SHELL and web projection at napplet/naps@19de5ce: an environment belongs
// to its authenticated endpoint; readiness is optional for other domain calls.
describe('source environment lifetime (#320)', () => {
  beforeEach(() => originRegistry.clear());
  afterEach(() => originRegistry.clear());

  it.each([
    { reuseSource: true, unregisterSession: true, readyFirst: true },
    { reuseSource: false, unregisterSession: true, readyFirst: true },
    { reuseSource: true, unregisterSession: true, readyFirst: false },
    { reuseSource: false, unregisterSession: true, readyFirst: false },
    { reuseSource: true, unregisterSession: false, readyFirst: true },
    { reuseSource: false, unregisterSession: false, readyFirst: true },
  ])('resolves defaults after retirement: %j', ({ reuseSource, unregisterSession, readyFirst }) => {
    const { bridge, defaults, explicit, dispatch, handler } = createHarness();
    const first = createFrame();
    const replacement = reuseSource ? first : createFrame();
    try {
      expect(defaults.capabilities.domains).not.toContain('example');
      originRegistry.register(first.win, windowId, identity);
      dispatch(first.win, { type: 'shell.ready' });
      dispatch(first.win, { type: 'example.read', id: 'initial-denied' });
      expect(handler).not.toHaveBeenCalled();

      originRegistry.setEnvironment(first.win, explicit);
      dispatch(first.win, { type: 'example.read', id: 'approved' });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(first.postMessage).toHaveBeenCalledWith({ type: 'example.result', id: 'approved' }, '*');

      bridge.runtime.destroyWindow(windowId);
      if (unregisterSession) bridge.runtime.sessionRegistry.unregister(windowId);
      originRegistry.unregister(windowId);
      first.postMessage.mockClear();
      dispatch(first.win, { type: 'example.read', id: 'retired' });
      expect(handler).toHaveBeenCalledTimes(1);

      originRegistry.register(replacement.win, windowId, identity);
      expect(originRegistry.getEnvironment(replacement.win)).toBeUndefined();
      if (readyFirst) dispatch(replacement.win, { type: 'shell.ready' });
      dispatch(replacement.win, { type: 'example.read', id: 'replacement-denied' });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(replacement.postMessage).not.toHaveBeenCalledWith(
        { type: 'example.result', id: 'replacement-denied' }, '*',
      );

      dispatch(replacement.win, { type: 'shell.ready' });
      dispatch(replacement.win, { type: 'shell.ready', capabilities: explicit.capabilities });
      const inits = replacement.postMessage.mock.calls.filter(([message]) => message.type === 'shell.init');
      expect(inits).toEqual([[{ type: 'shell.init', ...defaults }, '*']]);
      if (!reuseSource) {
        dispatch(first.win, { type: 'shell.ready' });
        dispatch(first.win, { type: 'example.read', id: 'old-source' });
        expect(first.postMessage).not.toHaveBeenCalled();
      }
    } finally {
      bridge.destroy();
    }
  });

  it('honors a replacement snapshot and keeps it across duplicate ready messages', () => {
    const { bridge, defaults, explicit, dispatch, handler } = createHarness();
    const frame = createFrame();
    try {
      originRegistry.register(frame.win, windowId, identity);
      dispatch(frame.win, { type: 'shell.ready' });
      bridge.runtime.destroyWindow(windowId);
      bridge.runtime.sessionRegistry.unregister(windowId);
      originRegistry.unregister(windowId);

      originRegistry.register(frame.win, windowId, identity);
      originRegistry.setEnvironment(frame.win, explicit);
      frame.postMessage.mockClear();
      dispatch(frame.win, { type: 'example.read', id: 'before-ready' });
      dispatch(frame.win, { type: 'shell.ready' });
      dispatch(frame.win, { type: 'shell.ready', capabilities: defaults.capabilities });
      dispatch(frame.win, { type: 'example.read', id: 'after-ready' });

      expect(handler).toHaveBeenCalledTimes(2);
      expect(frame.postMessage.mock.calls).toEqual([
        [{ type: 'example.result', id: 'before-ready' }, '*'],
        [{ type: 'shell.init', ...explicit }, '*'],
        [{ type: 'example.result', id: 'after-ready' }, '*'],
      ]);
    } finally {
      bridge.destroy();
    }
  });
});
