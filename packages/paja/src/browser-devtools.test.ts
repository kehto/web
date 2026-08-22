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
  redactPajaMessageForLog,
  renderPajaDevtools,
  type PajaDevtoolsState,
} from './browser-devtools.js';
import { createPajaRuntimeHostConfig } from './options.js';

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

class FakeAclButton {
  readonly dataset: Record<string, string> = {};
  private clickListener: (() => void) | undefined;
  type = '';
  className = '';
  textContent = '';
  title = '';

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type !== 'click') return;
    this.clickListener = typeof listener === 'function'
      ? () => listener({} as Event)
      : () => listener.handleEvent({} as Event);
  }

  click(): void {
    this.clickListener?.();
  }
}

class FakeAclContainer {
  children: FakeAclButton[] = [];

  replaceChildren(...children: FakeAclButton[]): void {
    this.children = children;
  }

  button(capability: string): FakeAclButton {
    const button = this.children.find((candidate) => candidate.dataset.aclCapability === capability);
    if (!button) throw new Error(`Missing ACL control for ${capability}`);
    return button;
  }
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

describe('Paja message-log redaction', () => {
  it('never retains NAP-CONFIG values', () => {
    expect(redactPajaMessageForLog({
      type: 'config.values',
      id: 'get-1',
      values: { apiKey: 'cleartext-secret' },
    })).toEqual({
      type: 'config.values',
      id: 'get-1',
      values: '[redacted by host]',
    });
    const relay = { type: 'relay.eose', subId: 'sub-1' };
    expect(redactPajaMessageForLog(relay)).toBe(relay);
  });
});

describe('Paja ACL controls', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders and toggles the active resolved napplet identity', () => {
    const hooks = makeHooks(() => []);
    const bridge = createShellBridge(hooks);
    const config = createPajaRuntimeHostConfig();
    const resolvedTarget = {
      dTag: 'gbc-emulator',
      aggregateHash: 'a219066f98db62c1c6c5dde9d99fa4a5f7f990d0b0cf830b9aed60b2a5f05b3b',
    };
    const container = new FakeAclContainer();
    vi.stubGlobal('document', {
      getElementById: (id: string) => id === 'acl-controls' ? container : null,
      createElement: (tag: string) => {
        if (tag !== 'button') throw new Error(`Unexpected element: ${tag}`);
        return new FakeAclButton();
      },
    });

    let state: PajaDevtoolsState;
    state = {
      config,
      simulation: config.simulation,
      signer: { method: 'none', status: 'disconnected', pubkey: null, relay: null, error: null },
      signerConsentCount: 0,
      resolvedTarget: resolvedTarget as PajaDevtoolsState['resolvedTarget'],
      messageFilter: '',
      messageLog: [],
      setDomainEnabled: vi.fn(),
      setAclCapability(capability, enabled) {
        if (enabled) {
          bridge.runtime.aclState.grant('', resolvedTarget.dTag, resolvedTarget.aggregateHash, capability);
        } else {
          bridge.runtime.aclState.revoke('', resolvedTarget.dTag, resolvedTarget.aggregateHash, capability);
        }
        renderPajaDevtools(state, { bridge, devSignerPubkey: '' });
      },
      useDevSigner: vi.fn(),
      connectNip07: vi.fn(async () => {}),
      connectBunker: vi.fn(async () => {}),
      clearSignerConsent: vi.fn(),
    };

    renderPajaDevtools(state, { bridge, devSignerPubkey: '' });
    expect(container.button('outbox:read').dataset.enabled).toBe('true');

    container.button('outbox:read').click();
    expect(bridge.runtime.aclState.check(
      '',
      resolvedTarget.dTag,
      resolvedTarget.aggregateHash,
      'outbox:read',
    )).toBe(false);
    expect(container.button('outbox:read').dataset.enabled).toBe('false');

    container.button('outbox:read').click();
    expect(bridge.runtime.aclState.check(
      '',
      resolvedTarget.dTag,
      resolvedTarget.aggregateHash,
      'outbox:read',
    )).toBe(true);
    expect(container.button('outbox:read').dataset.enabled).toBe('true');

    bridge.destroy();
  });
});
