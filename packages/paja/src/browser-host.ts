import {
  buildShellCapabilities,
  createShellBridge,
  originRegistry,
  type Capability,
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
  activateRuntimeTab,
  addRuntimeTab,
  closeRuntimeTab,
  getActiveTab,
  PAJA_RUNTIME_TABS_STORAGE_KEY,
  parseRuntimeTabsSnapshot,
  reloadActiveRuntimeTab,
  renderRuntimeTabs,
  resolvedTargetKey,
  setEmptyStageVisible,
  showDuplicatePointerDialog,
  snapshotRuntimeTabs,
  type PajaRuntimeTabsSnapshot,
  type PajaRuntimeTab,
  type PajaRuntimeTabContext,
  type PajaRuntimeTabRuntime,
} from './browser-runtime-tabs.js';
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
  getTargetIdentity,
  navigateFrame,
  registerFrameForGeneration,
  renderTargetErrorHtml,
} from './browser-target-frame.js';
import {
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
  tabs: PajaRuntimeTab[];
  activeTabId: string | null;
  generation: number;
  status: 'booting' | 'ready' | 'reloading' | 'error';
  messageFilter: string;
  messageLog: PajaMessageLogEntry[];
  reload(): void;
  activateTab(tabId: string): void;
  closeTab(tabId: string): void;
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
    activeTabId: string | null;
    tabs: Array<{
      id: string;
      title: string;
      pointerValue: string;
      windowId: string | null;
      status: PajaBrowserState['status'];
      initSent: boolean;
    }>;
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

interface PajaHostRuntimeState extends PajaRuntimeTabRuntime {
  currentSimulation: PajaSimulation;
  themeService: PajaThemeService | null;
}

interface PajaBrowserStateContext extends PajaRuntimeTabContext {
  config: PajaHostConfig;
  frame: HTMLIFrameElement | null;
  stage: HTMLElement;
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

function setTargetUrlDisplay(config: PajaHostConfig, frame?: HTMLIFrameElement | null): void {
  const label = getTargetLabel(config);
  const targetEl = document.querySelector('.target');
  if (targetEl) {
    targetEl.textContent = label;
    targetEl.setAttribute('title', label);
  }
  if (frame) frame.dataset.targetUrl = label;
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

function getRuntimeTabsStorage(config: PajaHostConfig): Storage | null {
  if (config.target.mode !== 'runtime-pointer') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readPersistedRuntimeTabs(config: PajaHostConfig): PajaRuntimeTabsSnapshot | null {
  const storage = getRuntimeTabsStorage(config);
  if (!storage) return null;
  try {
    return parseRuntimeTabsSnapshot(storage.getItem(PAJA_RUNTIME_TABS_STORAGE_KEY));
  } catch {
    return null;
  }
}

function persistRuntimeTabs(state: PajaBrowserState): void {
  const storage = getRuntimeTabsStorage(state.config);
  if (!storage) return;
  const snapshot = snapshotRuntimeTabs(state);
  try {
    if (snapshot) storage.setItem(PAJA_RUNTIME_TABS_STORAGE_KEY, JSON.stringify(snapshot));
    else storage.removeItem(PAJA_RUNTIME_TABS_STORAGE_KEY);
  } catch {
    // Storage persistence is best-effort; Paja runtime loading must keep working.
  }
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

function getStage(): HTMLElement {
  const stage = document.getElementById('napplet-stage');
  if (!(stage instanceof HTMLElement)) {
    throw new Error('Missing Kehto Paja stage.');
  }
  return stage;
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
  if (request.action === 'upload') {
    const filename = request.filename ?? '(unnamed blob)';
    const mimeType = request.mimeType ?? 'application/octet-stream';
    const allowed = window.confirm([
      'Paja upload request',
      `napplet: ${request.napplet.dTag} (${request.windowId})`,
      `file: ${filename}`,
      `size: ${request.size} bytes`,
      `type: ${mimeType}`,
      `server: ${request.server}`,
      request.warning,
    ].join('\n'));
    appendPajaMessageLog(state, 'paja', {
      type: `paja.upload.${allowed ? 'confirmed' : 'denied'}`,
      windowId: request.windowId,
      dTag: request.napplet.dTag,
      aggregateHash: request.napplet.aggregateHash,
      filename,
      size: request.size,
      mimeType,
      server: request.server,
      warning: request.warning,
    });
    return allowed;
  }
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

function unregisterSingleFrameWindow(
  bridge: ShellBridge,
  runtime: PajaHostRuntimeState,
  windowId: string | null,
): void {
  if (!windowId) return;
  bridge.runtime.destroyWindow(windowId);
  bridge.runtime.sessionRegistry.unregister(windowId);
  originRegistry.unregister(windowId);
  runtime.readyWindowIds.delete(windowId);
  if (runtime.currentWindowId === windowId) runtime.currentWindowId = null;
}

function startFrameNavigation(
  state: PajaBrowserState,
  context: PajaBrowserStateContext,
): void {
  const { config, frame, bridge, capabilities, runtime } = context;
  if (!frame) return;
  const generation = state.generation;
  const isCurrentGeneration = () => state.generation === generation;
  void navigateFrame(
    bridge,
    frame,
    config,
    generation,
    capabilities,
    runtime.currentSimulation,
    state.resolvedTarget,
    undefined,
    isCurrentGeneration,
  ).then((windowId) => {
    if (!isCurrentGeneration()) {
      unregisterSingleFrameWindow(bridge, runtime, windowId);
      return;
    }
    runtime.currentWindowId = windowId;
  }).catch((error) => {
    if (!isCurrentGeneration()) return;
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

function hasNip07Signer(): boolean {
  const signer = (globalThis as { nostr?: unknown }).nostr;
  return typeof signer === 'object' && signer !== null;
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

function reloadPajaTarget(state: PajaBrowserState, context: PajaBrowserStateContext): void {
  const { config, bridge, runtime } = context;
  if (config.target.mode === 'runtime-pointer') {
    reloadActiveRuntimeTab(state, context);
    return;
  }
  if (runtime.currentWindowId) {
    unregisterSingleFrameWindow(bridge, runtime, runtime.currentWindowId);
  }
  state.generation += 1;
  setStatus(state, 'reloading');
  startFrameNavigation(state, context);
}

function setRuntimeDomainEnabled(
  state: PajaBrowserState,
  context: PajaBrowserStateContext,
  domain: PajaCapabilityDomain,
  enabled: boolean,
): void {
  const { adapter, runtime } = context;
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
  state.simulation = runtime.currentSimulation;
  state.services = Object.keys(adapter.services ?? {})
    .filter((name) => runtime.currentSimulation.capabilities.domains[name as PajaCapabilityDomain] !== false)
    .sort();
  setSimulationStatus(state);
  appendPajaMessageLog(state, 'paja', { type: `paja.interface.${enabled ? 'enabled' : 'disabled'}`, domain });
  state.reload();
}

async function loadRuntimePointer(
  state: PajaBrowserState,
  context: PajaBrowserStateContext,
  value: string,
  options: { readonly skipDuplicatePrompt?: boolean; readonly persist?: boolean } = {},
): Promise<void> {
  const { config } = context;
  if (config.target.mode !== 'runtime-pointer') return;
  const pointer = value.trim();
  const input = document.getElementById('runtime-pointer-input');
  if (input instanceof HTMLInputElement) input.value = pointer;
  state.pointerValue = pointer;
  if (!pointer) {
    setPointerStatus(state, 'idle');
    return;
  }
  setPointerStatus(state, 'resolving');
  setStatus(state, 'booting');
  appendPajaMessageLog(state, 'paja', { type: 'paja.pointer.resolve', pointer });
  try {
    const resolvedTarget = await resolvePajaPointer(pointer, {
      relays: config.target.pointer?.relays ?? [],
      blossomServers: config.target.pointer?.blossomServers ?? [],
      maxWaitMs: config.target.pointer?.maxWaitMs,
    });
    const pointerStatus = `${resolvedTarget.dTag}:${resolvedTarget.aggregateHash.slice(0, 12)}`;
    setPointerStatus(state, pointerStatus);
    appendPajaMessageLog(state, 'paja', {
      type: 'paja.pointer.resolved',
      dTag: resolvedTarget.dTag,
      aggregateHash: resolvedTarget.aggregateHash,
    });
    const duplicate = options.skipDuplicatePrompt ? undefined : state.tabs.find((tab) => tab.key === resolvedTargetKey(resolvedTarget));
    if (duplicate) {
      const choice = await showDuplicatePointerDialog();
      if (choice === 'cancel') {
        setStatus(state, getActiveTab(state)?.status ?? 'ready');
        setPointerStatus(state, `already running: ${duplicate.title}`);
        appendPajaMessageLog(state, 'paja', { type: 'paja.pointer.duplicate.cancelled', tabId: duplicate.id });
        return;
      }
      if (choice === 'open-tab') {
        activateRuntimeTab(state, context, duplicate.id);
        if (options.persist !== false) persistRuntimeTabs(state);
        appendPajaMessageLog(state, 'paja', { type: 'paja.pointer.duplicate.opened', tabId: duplicate.id });
        return;
      }
    }
    addRuntimeTab(state, context, pointer, resolvedTarget);
    if (options.persist !== false) persistRuntimeTabs(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.resolvedTarget = null;
    setPointerStatus(state, message);
    setStatus(state, 'error');
    appendPajaMessageLog(state, 'paja', { type: 'paja.pointer.error', error: message });
  }
}

async function restorePersistedRuntimeTabs(
  state: PajaBrowserState,
  context: PajaBrowserStateContext,
  snapshot: PajaRuntimeTabsSnapshot,
): Promise<void> {
  for (const pointer of snapshot.pointers) {
    await loadRuntimePointer(state, context, pointer, { skipDuplicatePrompt: true, persist: false });
  }
  const activeTab = state.tabs[snapshot.activeIndex] ?? state.tabs[0];
  if (activeTab) activateRuntimeTab(state, context, activeTab.id);
  persistRuntimeTabs(state);
}

function snapshotPajaBrowserState(state: PajaBrowserState, runtime: PajaHostRuntimeState): ReturnType<PajaBrowserState['getState']> {
  return {
    generation: state.generation,
    status: state.status,
    iframeCount: document.querySelectorAll('iframe').length,
    initSent: runtime.currentWindowId ? runtime.readyWindowIds.has(runtime.currentWindowId) : false,
    services: state.services,
    simulation: runtime.currentSimulation,
    signer: state.signer,
    resolvedTarget: state.resolvedTarget,
    pointerStatus: state.pointerStatus,
    activeTabId: state.activeTabId,
    tabs: state.tabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      pointerValue: tab.pointerValue,
      windowId: tab.windowId,
      status: tab.status,
      initSent: tab.windowId ? runtime.readyWindowIds.has(tab.windowId) : false,
    })),
    messageLog: [...state.messageLog],
  };
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
    tabs: [],
    activeTabId: null,
    generation: 0,
    status: 'booting',
    messageFilter: '',
    messageLog: [],
    reload() {
      reloadPajaTarget(this, context);
    },
    activateTab(tabId) {
      activateRuntimeTab(this, context, tabId);
      persistRuntimeTabs(this);
    },
    closeTab(tabId) {
      closeRuntimeTab(this, context, tabId);
      persistRuntimeTabs(this);
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
      setRuntimeDomainEnabled(this, context, domain, enabled);
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
      await loadRuntimePointer(this, context, value);
    },
    clearLog() {
      this.messageLog.length = 0;
      renderPajaMessageLog(this);
    },
    getState() {
      return snapshotPajaBrowserState(this, runtime);
    },
  };
}

async function installPajaHost(): Promise<void> {
  const config = await readLatestConfig(readConfig());
  const stage = getStage();
  const frame = config.target.mode === 'runtime-pointer' ? null : getFrame();
  setTargetUrlDisplay(config, frame);
  const runtime: PajaHostRuntimeState = {
    currentSimulation: config.simulation,
    themeService: null,
    currentWindowId: null,
    readyWindowIds: new Set(),
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
  const context: PajaBrowserStateContext = {
    config,
    frame,
    stage,
    bridge,
    adapter,
    signerController,
    capabilities,
    runtime,
    navigateFrame,
    registerFrameForGeneration,
    renderTargetErrorHtml,
    setPointerStatus: (state, message) => setPointerStatus(state as PajaBrowserState, message),
    setStatus: (state, status) => setStatus(state as PajaBrowserState, status),
  };
  const state = createPajaBrowserState(context);
  stateRef = state;

  window.__KEHTO_PAJA__ = state;

  window.addEventListener('message', (event) => {
    const source = event.source as Window | null;
    const sourceTab = source ? state.tabs.find((tab) => tab.frame.contentWindow === source) ?? null : null;
    const isSingleFrameMessage = frame ? event.source === frame.contentWindow : false;
    if (!sourceTab && !isSingleFrameMessage) return;
    const registeredWindowId = source ? originRegistry.getWindowId(source) : null;
    const sourceWindowId = sourceTab?.windowId ?? registeredWindowId ?? undefined;
    if (isSingleFrameMessage && (!sourceWindowId || sourceWindowId !== runtime.currentWindowId)) return;
    appendPajaMessageLog(state, 'napplet->shell', event.data, sourceWindowId);
    const proxiedSource = createPajaPostMessageProxy(event.source as Window, state, sourceWindowId);
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
      if (sourceWindowId) runtime.readyWindowIds.add(sourceWindowId);
      if (sourceTab) {
        sourceTab.status = 'ready';
        if (state.activeTabId === sourceTab.id) setStatus(state, 'ready');
        renderRuntimeTabs(state);
      } else {
        setStatus(state, 'ready');
      }
    }
  });

  frame?.addEventListener('load', () => {
    if (!frame) return;
    if (state.status === 'booting' || state.status === 'reloading') {
      runtime.currentWindowId = registerFrameForGeneration(bridge, frame, config, state.generation, state.resolvedTarget);
    }
  });

  frame?.addEventListener('error', () => {
    setStatus(state, 'error');
  });

  installPajaControlListeners(state);

  setStatus(state, 'booting');
  setSimulationStatus(state);
  setPointerStatus(state, state.pointerStatus);
  if (config.target.mode === 'runtime-pointer') {
    const persistedTabs = readPersistedRuntimeTabs(config);
    const input = document.getElementById('runtime-pointer-input');
    if (input instanceof HTMLInputElement) input.value = state.pointerValue;
    if (state.pointerValue) void state.loadPointer(state.pointerValue);
    else if (persistedTabs) void restorePersistedRuntimeTabs(state, context, persistedTabs);
    else {
      setStatus(state, 'ready');
      setEmptyStageVisible(true);
      renderRuntimeTabs(state);
    }
  } else {
    startFrameNavigation(state, context);
  }
  if (hasNip07Signer()) void state.connectNip07();
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
