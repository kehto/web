import {
  buildShellCapabilities,
  createShellBridge,
  injectNappletNamespacePrelude,
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
  injectPajaRuntimeCsp,
  resolvePajaPointer,
  type PajaResolvedPointer,
} from './runtime-resolver.js';
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
  resolvedTarget: PajaResolvedPointer | null;
  pointerValue: string;
  pointerStatus: string;
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
  loadPointer(value: string): Promise<void>;
  clearLog(): void;
  getState(): {
    generation: number;
    status: PajaBrowserState['status'];
    iframeCount: number;
    initSent: boolean;
    services: string[];
    simulation: PajaSimulation;
    signer: PajaSignerState;
    resolvedTarget: PajaResolvedPointer | null;
    pointerStatus: string;
    messageLog: PajaMessageLogEntry[];
  };
}

declare global {
  interface Window {
    __KEHTO_PAJA__?: PajaBrowserState;
  }
}

let bridgeRef: ShellBridge | null = null;

type PajaThemeService = { publishTheme(theme: ReturnType<typeof createDevTheme>): unknown };
type PajaSignerController = ReturnType<typeof createHostSignerController>;

interface PajaHostRuntimeState {
  currentSimulation: PajaSimulation;
  themeService: PajaThemeService | null;
  currentWindowId: string | null;
  initReceivedGeneration: number;
}

interface PajaBrowserStateContext {
  config: PajaHostConfig;
  frame: HTMLIFrameElement;
  bridge: ShellBridge;
  adapter: ReturnType<typeof createPajaAdapter>;
  signerController: PajaSignerController;
  capabilities: ShellCapabilities;
  runtime: PajaHostRuntimeState;
}

function readConfig(): PajaHostConfig {
  const script = document.getElementById('kehto-paja-config');
  if (!script?.textContent) {
    throw new Error('Missing Kehto Paja config.');
  }
  return JSON.parse(script.textContent) as PajaHostConfig;
}

async function readLatestConfig(fallback: PajaHostConfig): Promise<PajaHostConfig> {
  try {
    const response = await fetch(new URL('./__kehto/config.json', window.location.href), { cache: 'no-store' });
    if (!response.ok) return fallback;
    return await response.json() as PajaHostConfig;
  } catch (error) {
    console.warn('[paja] config refresh failed; using embedded config', error);
    return fallback;
  }
}

function setTargetUrlDisplay(config: PajaHostConfig, frame: HTMLIFrameElement): void {
  const label = getTargetLabel(config);
  const targetEl = document.querySelector('.target');
  if (targetEl) {
    targetEl.textContent = label;
    targetEl.setAttribute('title', label);
  }
  frame.dataset.targetUrl = label;
}

function getTargetLabel(config: PajaHostConfig): string {
  if (config.target.mode === 'runtime-pointer') return config.target.pointer?.value ?? 'runtime pointer';
  return config.target.url;
}

function readInitialPointerValue(config: PajaHostConfig): string {
  if (config.target.mode !== 'runtime-pointer') return '';
  const params = new URLSearchParams(window.location.search);
  return params.get('naddr')
    ?? params.get('nevent')
    ?? params.get('pointer')
    ?? config.target.pointer?.value
    ?? '';
}

function connectOrigins(urls: readonly string[]): string[] {
  const out = new Set<string>();
  for (const value of urls) {
    try {
      const url = new URL(value);
      if (url.protocol === 'wss:' || url.protocol === 'ws:') {
        out.add(value.replace(/\/$/, ''));
      } else {
        out.add(url.origin);
      }
    } catch {
      // Ignore malformed origin hints; the resolver already validates fetches.
    }
  }
  return [...out];
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

function setPointerStatus(state: PajaBrowserState, message: string): void {
  state.pointerStatus = message;
  const statusEl = document.getElementById('runtime-pointer-status');
  if (statusEl) statusEl.textContent = message;
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

function getTargetIdentity(
  config: PajaHostConfig,
  resolvedTarget?: PajaResolvedPointer | null,
): Pick<SessionEntry, 'pubkey' | 'dTag' | 'aggregateHash'> {
  return {
    pubkey: '',
    dTag: resolvedTarget?.dTag ?? config.window.dTag,
    aggregateHash: resolvedTarget?.aggregateHash ?? config.window.aggregateHash,
  };
}

function registerFrameForGeneration(
  bridge: ShellBridge,
  frame: HTMLIFrameElement,
  config: PajaHostConfig,
  generation: number,
  resolvedTarget?: PajaResolvedPointer | null,
): string | null {
  const win = frame.contentWindow;
  if (!win) return null;
  const windowId = `${config.window.id}:${generation}`;
  const identity = getTargetIdentity(config, resolvedTarget);
  originRegistry.register(win, windowId, {
    dTag: identity.dTag,
    aggregateHash: identity.aggregateHash,
  });
  bridge.runtime.sessionRegistry.register(windowId, {
    ...identity,
    windowId,
    origin: 'null',
    type: 'napplet',
    registeredAt: Date.now(),
    instanceId: `${windowId}:${Date.now()}`,
    provenance: 'nip-5d',
  });
  return windowId;
}

function getInjectedDomains(
  capabilities: ShellCapabilities,
  simulation: PajaSimulation,
  resolvedTarget?: PajaResolvedPointer | null,
): string[] {
  const available = capabilities.domains.filter((domain) => {
    const knownDomain = domain as PajaCapabilityDomain;
    return simulation.capabilities.domains[knownDomain] !== false;
  });
  const required = resolvedTarget?.manifest.requires ?? [];
  if (required.length === 0) return available;
  const availableSet = new Set(available);
  return required.filter((domain) => availableSet.has(domain));
}

async function fetchTargetHtml(): Promise<string> {
  const response = await fetch(new URL('./__kehto/target.html', window.location.href), {
    cache: 'no-store',
    headers: {
      accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.8',
    },
  });
  if (!response.ok) {
    throw new Error(`Paja target fetch failed: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function injectBaseHref(html: string, targetUrl: string): string {
  const base = `<base href="${escapeAttribute(targetUrl)}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (open) => `${open}${base}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (open) => `${open}<head>${base}</head>`);
  }
  return `${base}${html}`;
}

function renderTargetErrorHtml(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `<!doctype html><html><body><pre>${escapeHtml(message)}</pre></body></html>`;
}

async function navigateFrame(
  bridge: ShellBridge,
  frame: HTMLIFrameElement,
  config: PajaHostConfig,
  generation: number,
  capabilities: ShellCapabilities,
  simulation: PajaSimulation,
  resolvedTarget?: PajaResolvedPointer | null,
): Promise<string | null> {
  const domains = getInjectedDomains(capabilities, simulation, resolvedTarget);
  if (config.target.mode === 'runtime-pointer') {
    if (!resolvedTarget) {
      frame.removeAttribute('src');
      frame.srcdoc = '<!doctype html><html><body></body></html>';
      return null;
    }
    const windowId = registerFrameForGeneration(bridge, frame, config, generation, resolvedTarget);
    frame.removeAttribute('src');
    frame.srcdoc = injectNappletNamespacePrelude(
      injectPajaRuntimeCsp(
        resolvedTarget.indexHtml,
        connectOrigins([...resolvedTarget.relays, ...resolvedTarget.blossomServers]),
      ),
      { domains },
    );
    return windowId;
  }
  const html = await fetchTargetHtml();
  const windowId = registerFrameForGeneration(bridge, frame, config, generation, resolvedTarget);
  frame.removeAttribute('src');
  frame.srcdoc = injectNappletNamespacePrelude(
    injectBaseHref(html, config.target.url),
    { domains },
  );
  return windowId;
}

function startFrameNavigation(
  state: PajaBrowserState,
  context: PajaBrowserStateContext,
): void {
  const { config, frame, bridge, capabilities, runtime } = context;
  const generation = state.generation;
  void navigateFrame(
    bridge,
    frame,
    config,
    generation,
    capabilities,
    runtime.currentSimulation,
    state.resolvedTarget,
  ).then((windowId) => {
    if (state.generation !== generation) return;
    runtime.currentWindowId = windowId;
  }).catch((error) => {
    if (state.generation !== generation) return;
    frame.removeAttribute('src');
    frame.srcdoc = renderTargetErrorHtml(error);
    setStatus(state, 'error');
    appendPajaMessageLog(state, 'paja', {
      type: 'paja.target.error',
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(error);
  });
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

  document.getElementById('runtime-pointer-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('runtime-pointer-input');
    if (!(input instanceof HTMLInputElement)) return;
    void state.loadPointer(input.value);
  });
}

function createPajaBrowserState(context: PajaBrowserStateContext): PajaBrowserState {
  const { config, bridge, adapter, signerController, capabilities, runtime } = context;
  return {
    config,
    capabilities,
    services: Object.keys(adapter.services ?? {}).sort(),
    simulation: runtime.currentSimulation,
    signer: signerController.getState(),
    resolvedTarget: null,
    pointerValue: readInitialPointerValue(config),
    pointerStatus: config.target.mode === 'runtime-pointer' ? 'idle' : '',
    generation: 0,
    status: 'booting',
    messageFilter: '',
    messageLog: [],
    reload() {
      if (runtime.currentWindowId) {
        bridge.runtime.destroyWindow(runtime.currentWindowId);
        bridge.runtime.sessionRegistry.unregister(runtime.currentWindowId);
        originRegistry.unregister(runtime.currentWindowId);
      }
      this.generation += 1;
      runtime.initReceivedGeneration = -1;
      setStatus(this, 'reloading');
      startFrameNavigation(this, context);
    },
    setThemeMode(mode) {
      runtime.currentSimulation = {
        ...runtime.currentSimulation,
        theme: {
          ...runtime.currentSimulation.theme,
          mode,
        },
      };
      this.simulation = runtime.currentSimulation;
      runtime.themeService?.publishTheme(createDevTheme(runtime.currentSimulation.theme.mode, runtime.currentSimulation.theme.values));
      setSimulationStatus(this);
    },
    setDomainEnabled(domain, enabled) {
      runtime.currentSimulation = {
        ...runtime.currentSimulation,
        capabilities: {
          domains: {
            ...runtime.currentSimulation.capabilities.domains,
            [domain]: enabled,
          },
          disabledDomains: PAJA_SIMULATION_DOMAINS.filter((entry) =>
            entry === domain ? !enabled : !runtime.currentSimulation.capabilities.domains[entry],
          ),
        },
      };
      this.simulation = runtime.currentSimulation;
      this.services = Object.keys(adapter.services ?? {})
        .filter((name) => runtime.currentSimulation.capabilities.domains[name as PajaCapabilityDomain] !== false)
        .sort();
      setSimulationStatus(this);
      appendPajaMessageLog(this, 'paja', { type: `paja.interface.${enabled ? 'enabled' : 'disabled'}`, domain });
      this.reload();
    },
    setAclCapability(capability, enabled) {
      const identity = getTargetIdentity(config, this.resolvedTarget);
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
    async loadPointer(value) {
      if (config.target.mode !== 'runtime-pointer') return;
      const pointer = value.trim();
      const input = document.getElementById('runtime-pointer-input');
      if (input instanceof HTMLInputElement) input.value = pointer;
      this.pointerValue = pointer;
      if (!pointer) {
        setPointerStatus(this, 'idle');
        return;
      }
      setPointerStatus(this, 'resolving');
      setStatus(this, 'booting');
      appendPajaMessageLog(this, 'paja', { type: 'paja.pointer.resolve', pointer });
      try {
        this.resolvedTarget = await resolvePajaPointer(pointer, {
          relays: config.target.pointer?.relays ?? [],
          blossomServers: config.target.pointer?.blossomServers ?? [],
          maxWaitMs: config.target.pointer?.maxWaitMs,
        });
        setPointerStatus(this, `${this.resolvedTarget.dTag}:${this.resolvedTarget.aggregateHash.slice(0, 12)}`);
        appendPajaMessageLog(this, 'paja', {
          type: 'paja.pointer.resolved',
          dTag: this.resolvedTarget.dTag,
          aggregateHash: this.resolvedTarget.aggregateHash,
        });
        this.reload();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.resolvedTarget = null;
        setPointerStatus(this, message);
        setStatus(this, 'error');
        appendPajaMessageLog(this, 'paja', { type: 'paja.pointer.error', error: message });
      }
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
        initSent: runtime.initReceivedGeneration === this.generation,
        services: this.services,
        simulation: runtime.currentSimulation,
        signer: this.signer,
        resolvedTarget: this.resolvedTarget,
        pointerStatus: this.pointerStatus,
        messageLog: [...this.messageLog],
      };
    },
  };
}

async function installPajaHost(): Promise<void> {
  const config = await readLatestConfig(readConfig());
  const frame = getFrame();
  setTargetUrlDisplay(config, frame);
  const runtime: PajaHostRuntimeState = {
    currentSimulation: config.simulation,
    themeService: null,
    currentWindowId: null,
    initReceivedGeneration: -1,
  };
  const getSimulation = () => runtime.currentSimulation;
  let stateRef: PajaBrowserState | null = null;
  const signerController = createHostSignerController(() => stateRef);
  const adapter = createPajaAdapter(config, getSimulation, (theme) => {
    runtime.themeService = theme;
  }, (request) => confirmPajaRequest(stateRef, request), signerController, () =>
    getTargetIdentity(config, stateRef?.resolvedTarget));
  const bridge = createShellBridge(adapter);
  bridgeRef = bridge;
  installPajaOriginRegistryProxy(originRegistry, () => stateRef);
  const capabilities = buildShellCapabilities(adapter);
  const state = createPajaBrowserState({
    config,
    frame,
    bridge,
    adapter,
    signerController,
    capabilities,
    runtime,
  });
  stateRef = state;

  window.__KEHTO_PAJA__ = state;

  window.addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow) return;
    appendPajaMessageLog(state, 'napplet->shell', event.data, runtime.currentWindowId ?? undefined);
    const proxiedSource = createPajaPostMessageProxy(event.source as Window, state, runtime.currentWindowId ?? undefined);
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
      runtime.initReceivedGeneration = state.generation;
      setStatus(state, 'ready');
    } else if (
      data
      && typeof data === 'object'
      && typeof data.type === 'string'
      && (state.status === 'booting' || state.status === 'reloading')
    ) {
      setStatus(state, 'ready');
    }
  });

  frame.addEventListener('load', () => {
    if (state.status === 'booting' || state.status === 'reloading') {
      runtime.currentWindowId = registerFrameForGeneration(bridge, frame, config, state.generation, state.resolvedTarget);
    }
  });

  frame.addEventListener('error', () => {
    setStatus(state, 'error');
  });

  installPajaControlListeners(state);

  setStatus(state, 'booting');
  setSimulationStatus(state);
  setPointerStatus(state, state.pointerStatus);
  if (config.target.mode === 'runtime-pointer') {
    const input = document.getElementById('runtime-pointer-input');
    if (input instanceof HTMLInputElement) input.value = state.pointerValue;
    if (state.pointerValue) void state.loadPointer(state.pointerValue);
    else startFrameNavigation(state, {
      config,
      frame,
      bridge,
      adapter,
      signerController,
      capabilities,
      runtime,
    });
  } else {
    startFrameNavigation(state, {
      config,
      frame,
      bridge,
      adapter,
      signerController,
      capabilities,
      runtime,
    });
  }
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll('"', '&quot;');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
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
