import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createShellBridge,
  originRegistry,
  resolveShellEnvironment,
  type ShellAdapter,
} from '@kehto/shell';
import {
  createPajaPostMessageProxy,
  installPajaOriginRegistryProxy,
} from './browser-devtools.js';

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

describe('Paja origin-registry proxy', () => {
  beforeEach(() => {
    originRegistry.clear();
  });

  afterEach(() => {
    Object.assign(originRegistry, originalRegistryMethods);
    originRegistry.clear();
  });

  it('keeps the captured environment through a proxied shell.ready and later dispatch', () => {
    let disabledDomains: readonly string[] = [];
    const hooks = makeHooks(() => disabledDomains);
    const realWindow = { postMessage: vi.fn() } as unknown as Window;
    const identity = { dTag: 'paja-proxy', aggregateHash: 'paja-proxy-hash' };
    const environment = resolveShellEnvironment(hooks, identity);
    originRegistry.register(realWindow, 'paja-proxy-window', identity);
    originRegistry.setEnvironment(realWindow, environment);
    installPajaOriginRegistryProxy(originRegistry, () => null);
    const proxiedWindow = createPajaPostMessageProxy(realWindow, null, 'paja-proxy-window');

    disabledDomains = ['relay'];
    const bridge = createShellBridge(hooks);
    bridge.handleMessage({ source: proxiedWindow, origin: 'https://paja.example', data: { type: 'shell.ready' } } as MessageEvent);

    expect((realWindow as unknown as { postMessage: ReturnType<typeof vi.fn> }).postMessage).toHaveBeenCalledWith({
      type: 'shell.init',
      capabilities: environment.capabilities,
      services: environment.services,
    }, '*', undefined);

    (realWindow as unknown as { postMessage: ReturnType<typeof vi.fn> }).postMessage.mockClear();
    bridge.handleMessage({
      source: proxiedWindow,
      origin: 'https://paja.example',
      data: { type: 'relay.subscribe', subId: 'paja-proxy-subscription', filters: [] },
    } as MessageEvent);
    expect((realWindow as unknown as { postMessage: ReturnType<typeof vi.fn> }).postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'relay.eose', subId: 'paja-proxy-subscription' }),
      '*',
      undefined,
    );

    bridge.destroy();
  });
});
