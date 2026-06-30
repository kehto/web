import {
  buildShellCapabilities,
  createShellBridge,
  originRegistry,
  type Capability,
  type SessionEntry,
  type ShellBridge,
  type ShellCapabilities,
} from '@kehto/shell';

import {
  createDevTheme,
  createPajaAdapter,
  PAJA_DEV_SIGNER_PUBKEY,
  type PajaConfirmationRequest,
} from './browser-adapter.js';
import {
  createPajaSignerController,
  type PajaSignerState,
} from './browser-signers.js';
import {
  appendPajaMessageLog,
  createPajaPostMessageProxy,
  installPajaOriginRegistryProxy,
  renderPajaDevtools,
  renderPajaMessageLog,
  type PajaMessageLogEntry,
} from './browser-devtools.js';
import type { PajaHostConfig } from './options.js';
import {
  PAJA_SIMULATION_DOMAINS,
  summarizePajaSimulation,
  type PajaSimulation,
  type PajaCapabilityDomain,
} from './simulation.js';

interface PajaBrowserState {
  readonly config: PajaHostConfig;
  readonly capabilities: ShellCapabilities;
  services: string[];
  simulation: PajaSimulation;
  signer: PajaSignerState;
  generation: number;
  status: 'booting' | 'ready' | 'reloading' | 'error';
  messageFilter: string;
  messageLog: PajaMessageLogEntry[];
  reload(): void;
  setThemeMode(mode: PajaSimulation['theme']['mode']): void;
  setDomainEnabled(domain: PajaCapabilityDomain, enabled: boolean): void;
  setAclCapability(capability: Capability, enabled: boolean): void;
  useDevSigner(): void;
  connectNip07(): Promise<void>;
  connectBunker(uri: string): Promise<void>;
  clearLog(): void;
  getState(): {
    generation: number;
    status: PajaBrowserState['status'];
    iframeCount: number;
    initSent: boolean;
    services: string[];
    simulation: PajaSimulation;
    signer: PajaSignerState;
    messageLog: PajaMessageLogEntry[];
  };
}

declare global {
  interface Window {
    __KEHTO_PAJA__?: PajaBrowserState;
  }
}

let bridgeRef: ShellBridge | null = null;

function readConfig(): PajaHostConfig {
  const script = document.getElementById('kehto-paja-config');
  if (!script?.textContent) {
    throw new Error('Missing Kehto Paja config.');
  }
  return JSON.parse(script.textContent) as PajaHostConfig;
}

async function readLatestConfig(fallback: PajaHostConfig): Promise<PajaHostConfig> {
  try {
    const response = await fetch('/__kehto/config.json', { cache: 'no-store' });
    if (!response.ok) return fallback;
    return await response.json() as PajaHostConfig;
  } catch (error) {
    console.warn('[paja] config refresh failed; using embedded config', error);
    return fallback;
  }
}

function setTargetUrlDisplay(config: PajaHostConfig, frame: HTMLIFrameElement): void {
  const targetEl = document.querySelector('.target');
  if (targetEl) {
    targetEl.textContent = config.target.url;
    targetEl.setAttribute('title', config.target.url);
  }
  frame.dataset.targetUrl = config.target.url;
}

function setStatus(state: PajaBrowserState, status: PajaBrowserState['status']): void {
  state.status = status;
  const statusEl = document.getElementById('lifecycle-status');
  if (statusEl) statusEl.textContent = status;
}

function setSimulationStatus(state: PajaBrowserState): void {
  const statusEl = document.getElementById('simulation-status');
  if (statusEl) statusEl.textContent = summarizePajaSimulation(state.simulation);
  const themeSelect = document.getElementById('simulation-theme');
  if (themeSelect instanceof HTMLSelectElement) themeSelect.value = state.simulation.theme.mode;
  renderPajaDevtools(state, { bridge: bridgeRef, devSignerPubkey: PAJA_DEV_SIGNER_PUBKEY });
}

function getFrame(): HTMLIFrameElement {
  const frame = document.getElementById('napplet-frame');
  if (!(frame instanceof HTMLIFrameElement)) {
    throw new Error('Missing Kehto Paja iframe.');
  }
  frame.sandbox.add('allow-scripts');
  frame.sandbox.remove('allow-same-origin');
  return frame;
}

function confirmPajaRequest(
  state: PajaBrowserState | null,
  request: PajaConfirmationRequest,
): boolean {
  const event = request.event as { kind?: unknown; content?: unknown };
  const kind = typeof event.kind === 'number' ? event.kind : 'unknown';
  const content = typeof event.content === 'string' && event.content.length > 0
    ? `\n\n${event.content.slice(0, 240)}`
    : '';
  const allowed = window.confirm(`Paja ${request.action} request\nkind: ${kind}${content}`);
  appendPajaMessageLog(state, 'paja', {
    type: `paja.${request.action}.${allowed ? 'confirmed' : 'denied'}`,
    kind,
  });
  return allowed;
}

function getTargetIdentity(config: PajaHostConfig): Pick<SessionEntry, 'pubkey' | 'dTag' | 'aggregateHash'> {
  return {
    pubkey: '',
    dTag: config.window.dTag,
    aggregateHash: config.window.aggregateHash,
  };
}

function registerFrameForGeneration(bridge: ShellBridge, frame: HTMLIFrameElement, config: PajaHostConfig, generation: number): string | null {
  const win = frame.contentWindow;
  if (!win) return null;
  const windowId = `${config.window.id}:${generation}`;
  originRegistry.register(win, windowId, {
    dTag: config.window.dTag,
    aggregateHash: config.window.aggregateHash,
  });
  bridge.runtime.sessionRegistry.register(windowId, {
    ...getTargetIdentity(config),
    windowId,
    origin: 'null',
    type: 'napplet',
    registeredAt: Date.now(),
    instanceId: `${windowId}:${Date.now()}`,
    provenance: 'nip-5d',
  });
  return windowId;
}

function navigateFrame(bridge: ShellBridge, frame: HTMLIFrameElement, config: PajaHostConfig, generation: number): string | null {
  const windowId = registerFrameForGeneration(bridge, frame, config, generation);
  frame.src = config.target.url;
  return windowId;
}

function createHostSignerController(getState: () => PajaBrowserState | null) {
  return createPajaSignerController({
    confirmRequest: (request) => confirmPajaRequest(getState(), request),
    onChange(signer) {
      const state = getState();
      if (!state) return;
      state.signer = signer;
      appendPajaMessageLog(state, 'paja', {
        type: `paja.signer.${signer.method}.${signer.status}`,
        pubkey: signer.pubkey,
        relay: signer.relay,
        error: signer.error,
      });
      setSimulationStatus(state);
      if (signer.status === 'connected') state.reload();
    },
  });
}

function installPajaControlListeners(state: PajaBrowserState): void {
  document.getElementById('reload-target')?.addEventListener('click', () => {
    state.reload();
  });

  document.getElementById('simulation-theme')?.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (target.value === 'dark' || target.value === 'light') {
      state.setThemeMode(target.value);
    }
  });

  document.getElementById('message-filter')?.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    state.messageFilter = target.value;
    renderPajaMessageLog(state);
  });

  document.getElementById('clear-log')?.addEventListener('click', () => {
    state.clearLog();
  });
}

async function installPajaHost(): Promise<void> {
  const config = await readLatestConfig(readConfig());
  const frame = getFrame();
  setTargetUrlDisplay(config, frame);
  let currentSimulation = config.simulation;
  const getSimulation = () => currentSimulation;
  let themeService: { publishTheme(theme: ReturnType<typeof createDevTheme>): unknown } | null = null;
  let stateRef: PajaBrowserState | null = null;
  const signerController = createHostSignerController(() => stateRef);
  const adapter = createPajaAdapter(config, getSimulation, (theme) => {
    themeService = theme;
  }, (request) => confirmPajaRequest(stateRef, request), signerController);
  const bridge = createShellBridge(adapter);
  bridgeRef = bridge;
  installPajaOriginRegistryProxy(originRegistry, () => stateRef);
  const capabilities = buildShellCapabilities(adapter);
  const services = Object.keys(adapter.services ?? {}).sort();
  let currentWindowId: string | null = null;
  let initReceivedGeneration = -1;

  const state: PajaBrowserState = {
    config,
    capabilities,
    services,
    simulation: currentSimulation,
    signer: signerController.getState(),
    generation: 0,
    status: 'booting',
    messageFilter: '',
    messageLog: [],
    reload() {
      if (currentWindowId) {
        bridge.runtime.destroyWindow(currentWindowId);
        bridge.runtime.sessionRegistry.unregister(currentWindowId);
        originRegistry.unregister(currentWindowId);
      }
      this.generation += 1;
      initReceivedGeneration = -1;
      setStatus(this, 'reloading');
      currentWindowId = navigateFrame(bridge, frame, config, this.generation);
    },
    setThemeMode(mode) {
      currentSimulation = {
        ...currentSimulation,
        theme: {
          ...currentSimulation.theme,
          mode,
        },
      };
      this.simulation = currentSimulation;
      themeService?.publishTheme(createDevTheme(currentSimulation.theme.mode, currentSimulation.theme.values));
      setSimulationStatus(this);
    },
    setDomainEnabled(domain, enabled) {
      currentSimulation = {
        ...currentSimulation,
        capabilities: {
          domains: {
            ...currentSimulation.capabilities.domains,
            [domain]: enabled,
          },
          disabledDomains: PAJA_SIMULATION_DOMAINS.filter((entry) =>
            entry === domain ? !enabled : !currentSimulation.capabilities.domains[entry],
          ),
        },
      };
      this.simulation = currentSimulation;
      this.services = Object.keys(adapter.services ?? {})
        .filter((name) => currentSimulation.capabilities.domains[name as PajaCapabilityDomain] !== false)
        .sort();
      setSimulationStatus(this);
      appendPajaMessageLog(this, 'paja', { type: `paja.interface.${enabled ? 'enabled' : 'disabled'}`, domain });
      this.reload();
    },
    setAclCapability(capability, enabled) {
      const identity = getTargetIdentity(config);
      if (enabled) bridge.runtime.aclState.grant(identity.pubkey, identity.dTag, identity.aggregateHash, capability);
      else bridge.runtime.aclState.revoke(identity.pubkey, identity.dTag, identity.aggregateHash, capability);
      bridge.runtime.aclState.persist();
      appendPajaMessageLog(this, 'paja', { type: `paja.acl.${enabled ? 'grant' : 'revoke'}`, capability });
      renderPajaDevtools(this, { bridge, devSignerPubkey: PAJA_DEV_SIGNER_PUBKEY });
    },
    useDevSigner() {
      signerController.useDevSigner();
    },
    connectNip07() {
      return signerController.connectNip07();
    },
    connectBunker(uri) {
      return signerController.connectBunker(uri);
    },
    clearLog() {
      this.messageLog.length = 0;
      renderPajaMessageLog(this);
    },
    getState() {
      return {
        generation: this.generation,
        status: this.status,
        iframeCount: document.querySelectorAll('iframe').length,
        initSent: initReceivedGeneration === this.generation,
        services: this.services,
        simulation: currentSimulation,
        signer: this.signer,
        messageLog: [...this.messageLog],
      };
    },
  };
  stateRef = state;

  window.__KEHTO_PAJA__ = state;

  window.addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow) return;
    appendPajaMessageLog(state, 'napplet->shell', event.data, currentWindowId ?? undefined);
    const proxiedSource = createPajaPostMessageProxy(event.source as Window, state, currentWindowId ?? undefined);
    const syntheticEvent = new Proxy(event, {
      get(target, prop) {
        if (prop === 'source') return proxiedSource;
        const val = Reflect.get(target, prop, target) as unknown;
        return typeof val === 'function' ? (val as Function).bind(target) : val;
      },
    }) as MessageEvent;
    bridge.handleMessage(syntheticEvent);
    const data = event.data as { type?: unknown } | null;
    if (data && typeof data === 'object' && data.type === 'shell.ready') {
      initReceivedGeneration = state.generation;
      setStatus(state, 'ready');
    }
  });

  frame.addEventListener('load', () => {
    if (state.status === 'booting' || state.status === 'reloading') {
      registerFrameForGeneration(bridge, frame, config, state.generation);
    }
  });

  frame.addEventListener('error', () => {
    setStatus(state, 'error');
  });

  installPajaControlListeners(state);

  setStatus(state, 'booting');
  setSimulationStatus(state);
  currentWindowId = navigateFrame(bridge, frame, config, state.generation);
}

try {
  void installPajaHost().catch((error) => {
    const statusEl = document.getElementById('lifecycle-status');
    if (statusEl) statusEl.textContent = 'error';
    console.error(error);
  });
} catch (error) {
  const statusEl = document.getElementById('lifecycle-status');
  if (statusEl) statusEl.textContent = 'error';
  console.error(error);
}
