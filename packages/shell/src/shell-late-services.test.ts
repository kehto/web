import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildShellCapabilities, createShellBridge, getShellDomainState, originRegistry, resolveShellEnvironment,
} from './index.js';
import type { ShellAdapter } from './index.js';
import type { ServiceHandler } from '@kehto/runtime';
import type { NappletMessage } from '@napplet/core';
import { deliverFromNapplet } from './test-utils.js';

const identity = { dTag: 'example', aggregateHash: 'a'.repeat(64) };
const NOT_REGISTERED = '[KEHTO_SERVICE_NOT_REGISTERED]';

function webrtcService() {
  const handleMessage = vi.fn<ServiceHandler['handleMessage']>((_windowId, message, send) => {
    send({ type: 'webrtc.open.result', id: (message as { id?: string }).id, error: 'signaling unavailable' } as NappletMessage);
  });
  const service: ServiceHandler = {
    descriptor: { name: 'webrtc', version: '1.0.0' },
    handleMessage, onRegistered: vi.fn(), onUnregistered: vi.fn(),
  };
  return { service, handleMessage };
}

function createAdapter(services: Record<string, ServiceHandler> = {}): ShellAdapter {
  return {
    services,
    webrtc: { isAvailable: () => true },
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
  } as ShellAdapter;
}

/** Admit a frame the way a host does: snapshot the environment, then bind it. */
function admit(hooks: ShellAdapter, windowId: string) {
  const postMessage = vi.fn();
  const win = { postMessage } as unknown as Window;
  originRegistry.register(win, windowId, identity);
  originRegistry.setEnvironment(win, resolveShellEnvironment(hooks, identity));
  return { win, postMessage };
}

function advertised(hooks: ShellAdapter) {
  const environment = resolveShellEnvironment(hooks, identity);
  return {
    domain: environment.capabilities.domains.includes('webrtc'),
    service: environment.services.includes('webrtc'),
    capability: buildShellCapabilities(hooks).domains.includes('webrtc'),
  };
}

// kehto/web#428. Checked NIP-5D nostr-protocol/nips#2303 at
// dskvr/nips@f60550c3409d6d81a875088ec83e660571e10504 (domain presence means
// available; unrecognized types are silently ignored), NAP-SHELL at
// napplet/naps@377bf939c6c906817084b43dd21d424de646dbc2 (the environment
// describes only exposed domains), and NAP-WEBRTC draft PR #59 at
// napplet/naps@fb4dd6f0e6294e1837733d2af61931e3e114bd97 (every request on an
// exposed domain gets a result with the same id).
describe('late service registration keeps advertisement and routing aligned (#428)', () => {
  const warn = vi.fn<(message: string) => void>();
  beforeEach(() => {
    originRegistry.clear();
    vi.spyOn(console, 'warn').mockImplementation(warn);
  });
  afterEach(() => {
    originRegistry.clear();
    vi.restoreAllMocks();
    warn.mockClear();
  });

  const notRegisteredWarnings = () => warn.mock.calls.filter(([text]) => text.startsWith(NOT_REGISTERED));
  const dispatch = (bridge: ReturnType<typeof createShellBridge>, source: Window, data: Record<string, unknown>) =>
    deliverFromNapplet(bridge, { source, origin: 'null', data } as MessageEvent);

  it('does not advertise an adapter entry added after the bridge until the runtime routes it', () => {
    const hooks = createAdapter();
    const bridge = createShellBridge(hooks);
    const { service, handleMessage } = webrtcService();
    try {
      // The reporter's host: the signer connects later and the service lands
      // on the adapter object only.
      hooks.services!.webrtc = service;
      expect(bridge.runtime.hasService('webrtc')).toBe(false);
      expect(advertised(hooks)).toEqual({ domain: false, service: false, capability: false });
      expect(getShellDomainState(hooks, 'webrtc')).toBe('disabled');
      const frame = admit(hooks, 'before-registration');
      dispatch(bridge, frame.win, { type: 'shell.ready' });
      const init = frame.postMessage.mock.calls.find(([message]) => message.type === 'shell.init')?.[0];
      expect(init.capabilities.domains).not.toContain('webrtc');
      expect(init.services).not.toContain('webrtc');
      expect(service.onRegistered).not.toHaveBeenCalled();

      const warnings = notRegisteredWarnings();
      expect(warnings).toHaveLength(1);
      expect(warnings[0][0]).toContain('ShellAdapter.services.webrtc');
      expect(warnings[0][0]).toContain('bridge.runtime.registerService("webrtc", handler)');
      expect(warnings[0][0]).toContain('Warned once per service per bridge');

      bridge.runtime.registerService('webrtc', service);
      expect(service.onRegistered).toHaveBeenCalledTimes(1);
      expect(advertised(hooks)).toEqual({ domain: true, service: true, capability: true });
      expect(getShellDomainState(hooks, 'webrtc')).toBe('supported');
      const replacement = admit(hooks, 'after-registration');
      dispatch(bridge, replacement.win, { type: 'shell.ready' });
      dispatch(bridge, replacement.win, {
        type: 'webrtc.open', id: 'open-1', scope: { type: 'room', room: 'x' }, channel: 'c', protocol: 'p',
      });
      expect(replacement.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'shell.init', services: expect.arrayContaining(['webrtc']) }), '*');
      expect(handleMessage).toHaveBeenCalledTimes(1);
      expect(replacement.postMessage).toHaveBeenCalledWith(
        { type: 'webrtc.open.result', id: 'open-1', error: 'signaling unavailable' }, '*');
      expect(notRegisteredWarnings()).toHaveLength(1);
    } finally {
      bridge.destroy();
    }
  });

  it('stops advertising a service once the runtime no longer routes it', () => {
    const { service, handleMessage } = webrtcService();
    const hooks = createAdapter({ webrtc: service });
    const bridge = createShellBridge(hooks);
    try {
      // Declared at creation: canonical wiring advertises and stays quiet.
      expect(advertised(hooks)).toEqual({ domain: true, service: true, capability: true });
      const frame = admit(hooks, 'admitted-early');
      dispatch(bridge, frame.win, { type: 'shell.ready' });
      expect(notRegisteredWarnings()).toHaveLength(0);

      bridge.runtime.unregisterService('webrtc');
      expect(service.onUnregistered).toHaveBeenCalledTimes(1);
      expect(advertised(hooks)).toEqual({ domain: false, service: false, capability: false });
      expect(notRegisteredWarnings()).toHaveLength(1);

      // The already-admitted frame keeps its namespace; NIP-5D has the shell
      // ignore the now-unrecognized type instead of answering a probe.
      frame.postMessage.mockClear();
      dispatch(bridge, frame.win, { type: 'webrtc.open', id: 'open-late' });
      expect(handleMessage).not.toHaveBeenCalled();
      expect(frame.postMessage).not.toHaveBeenCalled();

      delete hooks.services!.webrtc;
      expect(advertised(hooks)).toEqual({ domain: false, service: false, capability: false });
      expect(notRegisteredWarnings()).toHaveLength(1);
    } finally {
      bridge.destroy();
    }
  });

  it('keeps declared-service advertisement for adapters without a live bridge', () => {
    const hooks = createAdapter();
    hooks.services!.webrtc = webrtcService().service;
    expect(advertised(hooks)).toEqual({ domain: true, service: true, capability: true });

    const late = createAdapter();
    const bridge = createShellBridge(late);
    late.services!.webrtc = webrtcService().service;
    expect(advertised(late).domain).toBe(false);
    bridge.destroy();
    expect(advertised(late)).toEqual({ domain: true, service: true, capability: true });
  });

  it('holds back late extension services by name as well', () => {
    const hooks = createAdapter();
    const bridge = createShellBridge(hooks);
    const extension: ServiceHandler = {
      descriptor: { name: 'x-example', version: '1.0.0' },
      messageCapabilities: { 'x-example.read': null },
      handleMessage: vi.fn(),
    };
    try {
      hooks.services!['x-example'] = extension;
      expect(resolveShellEnvironment(hooks, identity).services).not.toContain('x-example');
      bridge.runtime.registerService('x-example', extension);
      expect(resolveShellEnvironment(hooks, identity).services).toContain('x-example');
    } finally {
      bridge.destroy();
    }
  });
});
