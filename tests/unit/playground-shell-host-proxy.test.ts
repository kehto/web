import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createShellBridge,
  originRegistry,
  resolveShellEnvironment,
  type ShellAdapter,
} from '@kehto/shell';
import {
  createPostMessageProxy,
  getNapplets,
  installOriginRegistryProxy,
  type NappletInfo,
} from '../../apps/playground/src/shell-host.js';
import type { MessageTap } from '../../apps/playground/src/message-tap.js';

const originalRegistryMethods = {
  getIframeWindow: originRegistry.getIframeWindow,
  getWindowId: originRegistry.getWindowId,
  getIdentity: originRegistry.getIdentity,
  getEnvironment: originRegistry.getEnvironment,
  getRegistrationId: originRegistry.getRegistrationId,
};

function makeHooks(disabledDomains: () => readonly string[]): ShellAdapter {
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
    capabilities: {
      get disabledDomains(): readonly string[] {
        return disabledDomains();
      },
    },
  };
}

describe('playground origin-registry proxy', () => {
  beforeEach(() => {
    originRegistry.clear();
    getNapplets().clear();
  });

  afterEach(() => {
    Object.assign(originRegistry, originalRegistryMethods);
    originRegistry.clear();
    getNapplets().clear();
  });

  it('restores the captured environment after a source swap and proxied shell.ready', () => {
    let disabledDomains: readonly string[] = [];
    const hooks = makeHooks(() => disabledDomains);
    const initialWindow = { postMessage: vi.fn() } as unknown as Window;
    const swappedWindow = { postMessage: vi.fn() } as unknown as Window;
    const identity = { dTag: 'playground-proxy', aggregateHash: 'playground-proxy-hash' };
    const environment = resolveShellEnvironment(hooks, identity);
    const iframe = { contentWindow: swappedWindow } as HTMLIFrameElement;
    const info: NappletInfo = {
      windowId: 'playground-proxy-window',
      name: 'playground-proxy',
      iframe,
      dTag: identity.dTag,
      aggregateHash: identity.aggregateHash,
      environment,
      identityBound: false,
    };
    getNapplets().set(info.windowId, info);
    originRegistry.register(initialWindow, info.windowId, identity);
    originRegistry.setEnvironment(initialWindow, environment);
    installOriginRegistryProxy({
      recordOutbound: vi.fn(),
      recordOutboundEnvelope: vi.fn(),
    } as unknown as MessageTap);
    const proxiedWindow = createPostMessageProxy(
      swappedWindow,
      { recordOutbound: vi.fn(), recordOutboundEnvelope: vi.fn() } as unknown as MessageTap,
      info.windowId,
    );

    disabledDomains = ['relay'];
    const bridge = createShellBridge(hooks);
    bridge.handleMessage({ source: proxiedWindow, origin: 'https://playground.example', data: { type: 'shell.ready' } } as MessageEvent);

    expect((swappedWindow as unknown as { postMessage: ReturnType<typeof vi.fn> }).postMessage).toHaveBeenCalledWith({
      type: 'shell.init',
      capabilities: environment.capabilities,
      services: environment.services,
    }, '*', undefined);

    (swappedWindow as unknown as { postMessage: ReturnType<typeof vi.fn> }).postMessage.mockClear();
    bridge.handleMessage({
      source: proxiedWindow,
      origin: 'https://playground.example',
      data: { type: 'relay.subscribe', subId: 'playground-proxy-subscription', filters: [] },
    } as MessageEvent);
    expect((swappedWindow as unknown as { postMessage: ReturnType<typeof vi.fn> }).postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'relay.eose', subId: 'playground-proxy-subscription' }),
      '*',
      undefined,
    );

    bridge.destroy();
  });
});
