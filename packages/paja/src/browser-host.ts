/**
 * Browser host initialization owns one tab/runtime lifecycle and its cleanup.
 * The setup closure keeps those authority-bearing handles private.
 * aislop-ignore-file complexity/file-too-large complexity/function-too-long
 */
import { installPajaResourceSettings } from './browser-resource-settings.js';
import { createPajaPermissionAdapter } from './browser-permission-adapter.js';
import { permissionPrincipalKey } from '@kehto/firewall';
import { revokedPajaTabIds } from './browser-grant-retirement.js';
import {
  buildShellCapabilities,
  createShellBridge,
  originRegistry,
  type Capability,
  type ShellBridge,
  type ShellCapabilities,
  type SessionEntry,
} from '@kehto/shell';

import { installPajaConsolePanel } from './browser-console-panel.js';
import { installPajaSidebarSections } from './browser-sidebar-sections.js';
import {
  createDevTheme,
  createPajaAdapter,
  PAJA_DEV_SIGNER_PUBKEY,
} from './browser-adapter.js';
import {
  createPajaConfirmationController,
  createHostSignerController,
  hasNip07Signer,
} from './browser-host-signer.js';
import { unregisterSingleFrameWindow } from './browser-host-runtime.js';
import { installLocalFileControls, loadLocalRuntimeFile } from './browser-local-loader.js';
import { BrowserIntentController } from './browser-intent-controller.js';
import {
  clearRuntimeTabGeneration,
  createPajaIntentTargetOptions,
  markRuntimeTabReady,
  pajaPointerResolverOptions,
  recordInstalledIntentSurface,
  subscribePajaIntentCatalogChanges,
} from './browser-intent-host.js';
import { InstalledNappletCatalog } from './installed-napplet-catalog.js';
import { createPajaThemeBroadcastLink } from './theme-broadcast.js';
import {
  type PajaSignerState,
} from './browser-signers.js';
import {
  activateRuntimeTab,
  addRuntimeTab,
  closeRuntimeTab,
  getActiveTab,
  reloadActiveRuntimeTab,
  renderRuntimeTabs,
  resolvedTargetKey,
  setEmptyStageVisible,
  showDuplicatePointerDialog,
  type PajaRuntimeTabsSnapshot,
  type PajaRuntimeTab,
  type PajaRuntimeTabContext,
  type PajaRuntimeTabRuntime,
} from './browser-runtime-tabs.js';
import {
  persistRuntimeTabs as persistStoredRuntimeTabs,
  readInitialRuntimePointer,
  readPajaIntentDefaults,
  readPajaIntentCatalogPointers,
  readPersistedRuntimeTabs,
  writePajaIntentDefaults,
  writePajaIntentCatalogPointers,
} from './browser-host-storage.js';
import {
  displayPajaTargetUrl,
  readLatestPajaHostConfig,
  readPajaHostConfig,
} from './browser-host-config.js';
import type { BrowserIntentGeneration } from './browser-intent-controller.js';
import type { PajaRelayBackend } from './browser-relay-runtime.js';
import {
  appendPajaMessageLog,
  createPajaPostMessageProxy,
  installPajaOriginRegistryProxy,
  renderPajaDevtools,
  renderPajaMessageLog,
  type PajaMessageLogEntry,
} from './browser-devtools.js';
import {
  createPajaRelayEventCounter,
  installPajaEventCounterReset,
  renderPajaEventKindCounts,
  type PajaRelayEventCounter,
  type PajaRelayBox,
  type PajaRelayInventory,
} from './browser-relay-panel.js';
import type { PajaHostConfig } from './options.js';
import {
  getTargetIdentity,
  navigateFrame,
  renderTargetErrorHtml,
} from './browser-target-frame.js';
import { isPajaLocalTarget, type PajaRuntimeTarget } from './local-target.js';
import { resolvePajaPointer } from './runtime-resolver.js';
import { parsePajaIntentLink } from './intent-link.js';
import {
  createPajaIntentLinkController,
  type PajaIntentLinkProgress,
} from './browser-intent-links.js';
import { createPajaIntentLinkBuilder } from './browser-intent-builder.js';
import { launchPajaSharedIntent } from './browser-intent-launcher-host.js';
import { reportTargetCorsDiagnostic } from './browser-target-diagnostics.js';
import { createPajaNotifyController } from './browser-notify.js';
import { createPajaConfigController } from './browser-config.js';
import {
  PAJA_SIMULATION_DOMAINS,
  summarizePajaSimulation,
  type PajaSimulation,
  type PajaCapabilityDomain,
} from './simulation.js';

export interface PajaBrowserState {
  readonly config: PajaHostConfig;
  readonly capabilities: ShellCapabilities;
  services: string[];
  simulation: PajaSimulation;
  signer: PajaSignerState;
  signerConsentCount: number;
  resolvedTarget: PajaRuntimeTarget | null;
  pointerValue: string;
  pointerStatus: string;
  tabs: PajaRuntimeTab[];
  activeTabId: string | null;
  generation: number;
  status: 'booting' | 'ready' | 'reloading' | 'error';
  messageFilter: string;
  messageLog: PajaMessageLogEntry[];
  /** Cumulative relay receipts by routing box and relay. */
  relayEventCounts: PajaRelayEventCounter;
  /** Configured relays per box, read at render time so idle relays show. */
  relayInventory(): PajaRelayInventory;
  reload(): void;
  activateTab(tabId: string): void;
  closeTab(tabId: string): void;
  setThemeMode(mode: PajaSimulation['theme']['mode']): void;
  setDomainEnabled(domain: PajaCapabilityDomain, enabled: boolean): void;
  getActiveIdentity(): Pick<SessionEntry, 'pubkey' | 'dTag' | 'aggregateHash'>;
  setAclCapability(capability: Capability, enabled: boolean): void;
  useDevSigner(): void;
  connectNip07(): Promise<void>;
  connectBunker(uri: string): Promise<void>;
  clearSignerConsent(): void;
  loadPointer(value: string): Promise<void>;
  /** Open a local single-file `index.html` in a new runtime tab (runtime-pointer mode only). */
  loadLocalFile(file: File): Promise<void>;
  clearLog(): void;
  createIntentLink(tab: PajaRuntimeTab): void;
  getState(): {
    generation: number;
    status: PajaBrowserState['status'];
    iframeCount: number;
    initSent: boolean;
    services: string[];
    simulation: PajaSimulation;
    signer: PajaSignerState;
    signerConsentCount: number;
    resolvedTarget: PajaRuntimeTarget | null;
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
    relayEventCounts: PajaRelayBox[];
    relayInventory: PajaRelayInventory;
  };
}

declare global {
  interface Window {
    __KEHTO_PAJA__?: PajaBrowserState;
  }
}

let bridgeRef: ShellBridge | null = null;
const frameAdmissions = new WeakMap<HTMLIFrameElement, AbortController>();

type PajaThemeService = { publishTheme(theme: ReturnType<typeof createDevTheme>): unknown };
type PajaSignerController = ReturnType<typeof createHostSignerController>;
type PajaConfirmationController = ReturnType<typeof createPajaConfirmationController>;

function persistRuntimeTabs(state: PajaBrowserState): void {
  persistStoredRuntimeTabs(state);
}

export interface PajaHostRuntimeState extends PajaRuntimeTabRuntime {
  currentSimulation: PajaSimulation;
  themeService: PajaThemeService | null;
  catalog: InstalledNappletCatalog;
  readonly readyWaiters: Map<BrowserIntentGeneration, Set<{
    resolve(): void;
    reject(reason: Error): void;
  }>>;
  /** Immutable selected catalog record for each in-flight intent generation. */
  readonly intentRecords: WeakMap<BrowserIntentGeneration, ReturnType<InstalledNappletCatalog['get']>>;
  /** Ephemeral verified launcher identities, never persisted as runtime tabs. */
  readonly intentSenderIds: Map<string, string>;
  /** Explicit target grants are scoped to one authenticated launcher invocation. */
  readonly explicitIntentHandlers: Map<string, string>;
  readonly intentDefaults: Map<string, string>;
  readonly launcherFrames: Map<Window, { readonly windowId: string; readonly frame: HTMLIFrameElement; readonly progress: PajaIntentLinkProgress; ready(): void; result(correlation: string, value: unknown): void }>;
}

export interface PajaBrowserStateContext extends PajaRuntimeTabContext {
  config: PajaHostConfig;
  frame: HTMLIFrameElement | null;
  stage: HTMLElement;
  bridge: ShellBridge;
  adapter: ReturnType<typeof createPajaAdapter>;
  signerController: PajaSignerController;
  confirmationController: PajaConfirmationController;
  capabilities: ShellCapabilities;
  runtime: PajaHostRuntimeState;
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

function startFrameNavigation(
  state: PajaBrowserState,
  context: PajaBrowserStateContext,
): void {
  const { config, frame, bridge, adapter, runtime } = context;
  if (!frame) return;
  frameAdmissions.get(frame)?.abort();
  const admissionController = new AbortController();
  frameAdmissions.set(frame, admissionController);
  const generation = state.generation;
  const isCurrentGeneration = () => state.generation === generation && frameAdmissions.get(frame) === admissionController;
  void navigateFrame(
    frame,
    config,
    generation,
    adapter,
    bridge.runtime,
    state.resolvedTarget,
    undefined,
    isCurrentGeneration,
    (windowId) => {
      if (isCurrentGeneration()) runtime.currentWindowId = windowId;
    },
    admissionController.signal,
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

  if (state.config.target.mode === 'runtime-pointer') {
    installLocalFileControls((file) => state.loadLocalFile(file));
  }
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
  const { config, runtime } = context;
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
    const resolvedTarget = await resolvePajaPointer(pointer, pajaPointerResolverOptions(context));
    runtime.catalog.install(resolvedTarget);
    const pointerStatus = `${resolvedTarget.dTag}:${resolvedTarget.aggregateHash.slice(0, 12)}`;
    setPointerStatus(state, pointerStatus);
    recordInstalledIntentSurface(state, resolvedTarget);
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

/**
 * Re-verify saved pointer facts for incoming-link policy without restoring a
 * runtime tab or navigating an iframe. A bad saved pointer is isolated so it
 * cannot prevent other saved handlers from participating in selection.
 */
async function hydratePersistedIntentCatalog(
  state: PajaBrowserState,
  context: PajaBrowserStateContext,
  snapshot: PajaRuntimeTabsSnapshot | null,
): Promise<void> {
  const pointers = new Set([...readPajaIntentCatalogPointers(), ...(snapshot?.pointers ?? [])]);
  await Promise.all([...pointers].map(async (pointer) => {
    try {
      const resolved = await resolvePajaPointer(pointer, pajaPointerResolverOptions(context));
      context.runtime.catalog.install(resolved);
      recordInstalledIntentSurface(state, resolved);
    } catch (error) {
      appendPajaMessageLog(state, 'paja', {
        type: 'paja.intent.catalog-hydration.error',
        pointer,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }));
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
    signerConsentCount: state.signerConsentCount,
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
    relayEventCounts: state.relayEventCounts.snapshot(state.relayInventory()),
    relayInventory: state.relayInventory(),
  };
}

function createPajaBrowserState(
  context: PajaBrowserStateContext,
  relayEventCounts: PajaRelayEventCounter,
  relayInventory: () => PajaRelayInventory,
): PajaBrowserState {
  const {
    config,
    bridge,
    adapter,
    signerController,
    confirmationController,
    capabilities,
    runtime,
  } = context;
  return {
    config,
    capabilities,
    services: Object.keys(adapter.services ?? {}).sort(),
    simulation: runtime.currentSimulation,
    signer: signerController.getState(),
    signerConsentCount: confirmationController.getSignerConsentCount(),
    resolvedTarget: null,
    pointerValue: readInitialRuntimePointer(config),
    pointerStatus: config.target.mode === 'runtime-pointer' ? 'idle' : '',
    tabs: [],
    activeTabId: null,
    generation: 0,
    status: 'booting',
    messageFilter: '',
    messageLog: [],
    relayEventCounts,
    relayInventory,
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
    getActiveIdentity() {
      const active = runtime.currentWindowId
        ? bridge.runtime.sessionRegistry.getEntryByWindowId(runtime.currentWindowId) : undefined;
      return active ?? getTargetIdentity(config, this.resolvedTarget);
    },
    setAclCapability(capability, enabled) {
      const identity = this.getActiveIdentity?.() ?? getTargetIdentity(config, this.resolvedTarget);
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
    clearSignerConsent() {
      const cleared = confirmationController.clearSignerConsent();
      appendPajaMessageLog(this, 'paja', {
        type: cleared
          ? 'paja.signer-consent.cleared'
          : 'paja.signer-consent.clear-failed',
      });
    },
    async loadPointer(value) {
      await loadRuntimePointer(this, context, value);
    },
    async loadLocalFile(file) {
      await loadLocalRuntimeFile(this, context, file, {
        persistTabs: (current) => persistRuntimeTabs(current as PajaBrowserState),
      });
    },
    clearLog() {
      this.messageLog.length = 0;
      renderPajaMessageLog(this);
    },
    createIntentLink() {
      // Assigned after host dialogs exist.
    },
    getState() {
      return snapshotPajaBrowserState(this, runtime);
    },
  };
}

async function installPajaHost(): Promise<void> {
  const disposeConsolePanel = installPajaConsolePanel();
  const disposeSidebarSections = installPajaSidebarSections();
  window.addEventListener('pagehide', disposeSidebarSections, { once: true });
  const resourceSettings = installPajaResourceSettings();
  const config = await readLatestPajaHostConfig(readPajaHostConfig());
  const stage = getStage();
  const frame = config.target.mode === 'runtime-pointer' ? null : getFrame();
  displayPajaTargetUrl(config, frame);
  const runtime: PajaHostRuntimeState = {
    currentSimulation: config.simulation,
    themeService: null,
    catalog: new InstalledNappletCatalog(),
    readyWaiters: new Map(),
    intentRecords: new WeakMap(),
    intentSenderIds: new Map(),
    explicitIntentHandlers: new Map(),
    intentDefaults: readPajaIntentDefaults(),
    launcherFrames: new Map(),
    currentWindowId: null,
    readyWindowIds: new Set(),
  };
  const getSimulation = () => runtime.currentSimulation;
  const themeBroadcast = createPajaThemeBroadcastLink();
  let stateRef: PajaBrowserState | null = null;
  let contextRef: PajaBrowserStateContext | null = null;
  let intentLinks: ReturnType<typeof createPajaIntentLinkController> = null;
  const intentController = new BrowserIntentController(createPajaIntentTargetOptions(
    () => stateRef,
    () => contextRef,
    {
      persistTabs: persistRuntimeTabs,
      onAccepted(params, acceptance) {
        const sourceWindowId = params.sourceWindowId;
        if (!sourceWindowId) return;
        const launcher = [...runtime.launcherFrames.values()].find((entry) => entry.windowId === sourceWindowId);
        if (!launcher) return;
        const progress = launcher.progress;
        void acceptance.completion.then(
          () => progress.delivered(),
          (error) => progress.failed(error),
        );
      },
    },
  ));
  const confirmationController = createPajaConfirmationController(
    () => stateRef,
    {
      sharedFirewall: true,
      onSignerConsentChange(count) {
        if (!stateRef) return;
        stateRef.signerConsentCount = count;
        setSimulationStatus(stateRef);
      },
    },
  );
  const signerController = createHostSignerController(
    () => stateRef,
    setSimulationStatus,
    confirmationController.confirm,
  );
  const getWindowIdentity = (windowId?: string) => {
    const active = bridge.runtime.sessionRegistry.getEntryByWindowId(windowId ?? runtime.currentWindowId ?? '');
    if (active) return active;
    const tabTarget = stateRef?.tabs.find((tab) => tab.windowId === windowId)?.resolvedTarget;
    return getTargetIdentity(config, tabTarget ?? stateRef?.resolvedTarget);
  };
  const notifyController = createPajaNotifyController({
    confirm: confirmationController.confirm,
    getIdentity: getWindowIdentity,
    isEnabled: () => getSimulation().notifications.enabled && getSimulation().notifications.grant,
  });
  const configController = createPajaConfigController({
    getIdentity: getWindowIdentity,
    getInitialValues: () => ({ ...getSimulation().config.values }),
  });
  // Live-relay counters are created before the adapter so background fetches
  // that start during adapter construction are counted, not dropped.
  const relayEventCounts = createPajaRelayEventCounter(() => {
    if (stateRef) renderPajaEventKindCounts(stateRef.relayEventCounts, stateRef.relayInventory());
  });
  // The Events reset button clears those counters, so it is wired to the same
  // instance the observation hooks feed.
  const disposeEventCounterReset = installPajaEventCounterReset(relayEventCounts);
  // Configured relays are the host's fallback set, so they render in the
  // fallback box even before they serve anything. Nothing is configured for the
  // other boxes: author-routed relays are discovered per read, and Paja's own
  // reads and napplet-pinned reads only exist once they happen.
  const relayInventory = (): PajaRelayInventory => ({
    fallback: adapter.relayConfig.getRelayConfig().outbox,
  });
  const adapter = createPajaAdapter(config, getSimulation, (theme) => {
    runtime.themeService = theme;
  }, themeBroadcast.onBroadcast, confirmationController.confirm, signerController, getWindowIdentity, () => stateRef?.reload(), {
      catalog: runtime.catalog,
      controller: intentController,
      resolveSender(windowId) {
        const launcher = runtime.intentSenderIds.get(windowId);
        if (launcher) return launcher;
        const target = stateRef?.tabs.find((tab) => tab.windowId === windowId)?.resolvedTarget;
        return target && !isPajaLocalTarget(target) ? target.manifest.catalogId : undefined;
      },
      authorizeExplicitHandler(sender, handler, _request, _candidate, resolverContext) {
        const sourceWindowId = resolverContext?.sourceWindowId;
        return sourceWindowId !== undefined
          && runtime.intentSenderIds.get(sourceWindowId) === sender
          && runtime.explicitIntentHandlers.get(sourceWindowId) === handler;
      },
      getDefaultHandler(archetype) {
        return runtime.intentDefaults.get(archetype);
      },
      async chooseHandler(archetype, candidates) {
        return intentLinks?.chooseHandler(archetype, candidates);
      },
      resolveHandlerHint(hint, candidates) {
        const id = `nip5d:${hint.address}`;
        return candidates.some((candidate) => candidate.id === id) ? id : undefined;
      },
    }, confirmationController.activation, notifyController?.serviceOptions, configController?.serviceOptions, resourceSettings.getServers);
  const permissionMount = document.getElementById('paja-permission-ui');
  if (!permissionMount) throw new Error('Paja Firewall permission mount is missing');
  let permissionBridge: ShellBridge | null = null;
  const permissionController = createPajaPermissionAdapter({
    mount: permissionMount,
    getPermissions: () => permissionBridge?.runtime.permissions,
    onGrantRevoked(grant) {
      if (!stateRef) return;
      const revoked = permissionPrincipalKey(grant.principal);
      if (config.target.mode === 'runtime-pointer') {
        for (const tabId of revokedPajaTabIds(config, stateRef.tabs, grant)) stateRef.closeTab(tabId);
      } else {
        const source = frame?.contentWindow;
        const principal = source ? originRegistry.getIdentity(source)?.permissionPrincipal : undefined;
        if (principal && permissionPrincipalKey(principal) === revoked) stateRef.reload();
      }
    },
  });
  adapter.permissions = permissionController.adapter;
  const relayBackend = adapter.relayPool.getRelayPool() as PajaRelayBackend | null;
  relayBackend?.setRelayEventObserver((sighting) => {
    relayEventCounts.recordEvent(sighting.reason, sighting.event, sighting.sightedOn, sighting.origin);
  });
  relayBackend?.setRelayRequestObserver((request) => {
    relayEventCounts.recordRead(request.reason, request.relayUrls, request.origin);
  });
  await adapter.ready;
  const bridge = createShellBridge(adapter);
  permissionBridge = bridge;
  permissionController.ui.refresh();
  const stopIdentityChanges = signerController.subscribe(() => {
    bridge.publishIdentityChanged(adapter.auth.getUserPubkey() ?? '');
  });
  themeBroadcast.attach(bridge);
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
    confirmationController,
    capabilities,
    runtime,
    navigateFrame,
    renderTargetErrorHtml,
    onTabDestroyed: (tab) => clearRuntimeTabGeneration(tab, runtime),
    onTabNavigationFailed: (tab) => clearRuntimeTabGeneration(tab, runtime),
    setPointerStatus: (state, message) => setPointerStatus(state as PajaBrowserState, message),
    setStatus: (state, status) => setStatus(state as PajaBrowserState, status),
  };
  contextRef = context;
  const state = createPajaBrowserState(context, relayEventCounts, relayInventory);
  stateRef = state;

  const stopIntentCatalogChanges = subscribePajaIntentCatalogChanges(state, context);
  window.addEventListener('pagehide', stopIntentCatalogChanges, { once: true });
  const catalogPointers = new Map<string, string>();
  const stopCatalogPersistence = runtime.catalog.onChanged((id) => {
    const pointers = new Set(readPajaIntentCatalogPointers());
    const previous = catalogPointers.get(id);
    if (previous) pointers.delete(previous);
    const record = runtime.catalog.get(id);
    if (record) { pointers.add(record.pointer.value); catalogPointers.set(id, record.pointer.value); }
    else catalogPointers.delete(id);
    writePajaIntentCatalogPointers([...pointers]);
  });
  window.addEventListener('pagehide', stopCatalogPersistence, { once: true });
  window.addEventListener('pagehide', stopIdentityChanges, { once: true });
  window.addEventListener('pagehide', () => confirmationController.dispose(), { once: true });
  window.addEventListener('pagehide', () => notifyController?.dispose(), { once: true });
  window.addEventListener('pagehide', () => configController?.dispose(), { once: true });
  window.addEventListener('pagehide', disposeConsolePanel, { once: true });
  window.addEventListener('pagehide', disposeEventCounterReset, { once: true });
  window.addEventListener('pagehide', resourceSettings.dispose, { once: true });
  window.addEventListener('pagehide', permissionController.destroy, { once: true });

  window.__KEHTO_PAJA__ = state;

  window.addEventListener('message', (event) => {
    const source = event.source as Window | null;
    const sourceTab = source ? state.tabs.find((tab) => tab.frame.contentWindow === source) ?? null : null;
    const launcher = source ? runtime.launcherFrames.get(source) : undefined;
    const isSingleFrameMessage = frame ? event.source === frame.contentWindow : false;
    if (!sourceTab && !isSingleFrameMessage && !launcher) return;
    const registeredWindowId = source ? originRegistry.getWindowId(source) ?? null : null;
    const sourceWindowId = launcher?.windowId ?? sourceTab?.windowId ?? registeredWindowId ?? undefined;
    if (launcher && (!source || registeredWindowId !== launcher.windowId)) return;
    if (sourceTab && (!source || !sourceWindowId || registeredWindowId !== sourceWindowId)) return;
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
    if (launcher && data && typeof data === 'object' && data.type === 'paja.intent.launcher.ready') {
      launcher.ready();
    }
    if (data && typeof data === 'object' && data.type === 'shell.ready') {
      if (sourceTab) {
        if (source && !markRuntimeTabReady(
          state,
          context,
          sourceTab,
          source,
          registeredWindowId,
          { setReadyStatus: (current) => setStatus(current, 'ready') },
        )) return;
      } else {
        if (sourceWindowId) runtime.readyWindowIds.add(sourceWindowId);
        setStatus(state, 'ready');
      }
      renderPajaDevtools(state, { bridge, devSignerPubkey: PAJA_DEV_SIGNER_PUBKEY });
    }
    if (launcher && data && typeof data === 'object' && data.type === 'paja.intent.launcher.result'
      && typeof (data as { correlation?: unknown }).correlation === 'string') {
      launcher.result((data as { correlation: string }).correlation, (data as { result?: unknown }).result);
    }
  });

  frame?.addEventListener('error', () => {
    setStatus(state, 'error');
  });

  installPajaControlListeners(state);
  const links = createPajaIntentLinkController(undefined, {
    setDefault(archetype, id) {
      runtime.intentDefaults.set(archetype, id);
      writePajaIntentDefaults(runtime.intentDefaults);
    },
    onAccepted() {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('intent')) return;
      url.search = '';
      window.history.replaceState(window.history.state, '', url);
    },
  });
  intentLinks = links;
  const builder = createPajaIntentLinkBuilder({
    onTest(link) {
      if (!links) return;
      links.open(link, (intent, progress) => launchPajaSharedIntent(state, context, intent, progress, setPointerStatus));
    },
  });
  state.createIntentLink = (tab) => {
    if (isPajaLocalTarget(tab.resolvedTarget) || tab.resolvedTarget.manifest.archetypes.length === 0) return;
    builder.open(tab.resolvedTarget);
  };
  window.addEventListener('pagehide', () => links?.dispose(), { once: true });
  window.addEventListener('pagehide', () => builder.dispose(), { once: true });
  window.addEventListener('pagehide', () => {
    for (const [source, launcher] of runtime.launcherFrames) {
      context.bridge.runtime.destroyWindow(launcher.windowId);
      context.bridge.runtime.sessionRegistry.unregister(launcher.windowId);
      originRegistry.unregister(launcher.windowId);
      launcher.frame.remove();
      runtime.launcherFrames.delete(source);
      runtime.intentSenderIds.delete(launcher.windowId);
    }
  }, { once: true });

  setStatus(state, 'booting');
  setSimulationStatus(state);
  setPointerStatus(state, state.pointerStatus);
  if (config.target.mode === 'runtime-pointer') {
    let incomingIntent: ReturnType<typeof parsePajaIntentLink> = null;
    try {
      incomingIntent = parsePajaIntentLink(window.location.href);
    } catch (error) {
      setStatus(state, 'error');
      setPointerStatus(state, error instanceof Error ? error.message : String(error));
      links?.showError(error);
      return;
    }
    const persistedTabs = readPersistedRuntimeTabs(config);
    const input = document.getElementById('runtime-pointer-input');
    if (input instanceof HTMLInputElement) input.value = state.pointerValue;
    if (incomingIntent && links) {
      void hydratePersistedIntentCatalog(state, context, persistedTabs).then(() => {
        setStatus(state, 'ready');
        setEmptyStageVisible(true);
        renderRuntimeTabs(state);
        links.open(incomingIntent!, (intent, progress) => launchPajaSharedIntent(state, context, intent, progress, setPointerStatus));
      }).catch((error) => links.showError(error));
    } else if (state.pointerValue) void state.loadPointer(state.pointerValue);
    else if (persistedTabs) void restorePersistedRuntimeTabs(state, context, persistedTabs);
    else {
      setStatus(state, 'ready');
      setEmptyStageVisible(true);
      renderRuntimeTabs(state);
    }
  } else {
    startFrameNavigation(state, context);
    void reportTargetCorsDiagnostic(state);
  }
  if (hasNip07Signer()) void state.connectNip07();
}

if (typeof document !== 'undefined') {
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
}

export {
  createPajaIntentTargetOptions,
  markRuntimeTabReady,
  subscribePajaIntentCatalogChanges,
};
