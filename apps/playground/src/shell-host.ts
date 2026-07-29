import {
  createShellBridge,
  originRegistry,
  type ShellBridge,
  type ServiceHandler,
  type Capability,
  type NappletMessage,
  type SessionEntry,
  type ShellEnvironment,
} from '@kehto/shell';
import type { IntentDispatchParams, Notification } from '@kehto/services';
import type { Theme } from '@napplet/nap/theme/types';
import type { PlaygroundNapplet } from './napplet-resolver.js';
import { InstalledNappletCatalog, matchesInstalledNappletRecord } from './installed-napplet-catalog.js';
import type { InstalledNappletRecord } from './installed-napplet-catalog.js';
import type {
  PlaygroundIntentControllerOptions,
  PlaygroundIntentGeneration,
} from './playground-intent-controller.js';
import { getSignerConnectionState } from './signer-connection.js';
import { pushAclEvent } from './acl-history.js';
import {
  DEMO_NAPPLETS,
  DEMO_TOPOLOGY_SERVICE_NAMES,
  type DemoNappletDefinition,
} from './demo-definitions.js';
import {
  createDemoHooks,
  setDemoSessionRegistryRef,
} from './demo-hooks.js';
import {
  createMessageTap,
  setMessageTap,
  type MessageTap,
} from './message-tap.js';
import {
  loadPlaygroundNapplet,
  type LoadNappletOptions,
} from './playground-frame-loader.js';
import { PlaygroundAccessControls, type DemoAclAdapter } from './playground-access-controls.js';

// Static ephemeral host identity for shell node display (separate from signer identity)
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
const _hostSecretKey = generateSecretKey();
const _hostPubkey = getPublicKey(_hostSecretKey);

export {
  DEMO_NAPPLETS,
  DEMO_PROTOCOL_PATH_INDEX,
  DEMO_PROTOCOL_PATHS,
  DEMO_SIGNER_MODE,
  DEMO_TOPOLOGY_SERVICE_NAMES,
  STUB_ONLY_SERVICES,
  getDemoHostAuditSummary,
  type DemoNappletDefinition,
  type DemoPathAuditEntry,
  type DemoProtocolPath,
  type DemoSignerMode,
} from './demo-definitions.js';
export type { MessageTap, TappedMessage } from './message-tap.js';
export { getMessageTap, setMessageTap } from './message-tap.js';
export {
  getConfigServiceBundle,
  getIdentityServiceHandler,
  getMissingRequiredNaps,
  getNip66Aggregator,
  getNotificationServiceHandler,
  getPlaygroundRelayActivity,
  getRelayServiceHandler,
  getThemeServiceBundle,
  setDemoConfigValue,
} from './demo-hooks.js';
export type { LoadedNappletIdentity, LoadNappletOptions } from './playground-frame-loader.js';
export type { DemoAclAdapter } from './playground-access-controls.js';

// Inline a simplified message tap since we can't import from tests/helpers in apps/
// (they are not a published package)

const proxyToReal = new WeakMap<object, Window>();
const realToProxy = new WeakMap<Window, Window>();

/**
 * Wrap a trusted iframe window to record host-to-napplet traffic.
 *
 * @internal Exported for host-proxy regression coverage.
 */
export function createPostMessageProxy(realWin: Window, messageTap: MessageTap, windowId?: string): Window {
  const existing = realToProxy.get(realWin);
  if (existing) return existing;
  const proxy = new Proxy(realWin, {
    get(target, prop) {
      if (prop === 'postMessage') {
        return (msg: unknown, targetOrigin: string, transfer?: Transferable[]) => {
          const resolvedWindowId = windowId ?? originRegistry.getWindowId(realWin);
          if (Array.isArray(msg)) {
            messageTap.recordOutbound(msg, resolvedWindowId);
          } else if (
            typeof msg === 'object' &&
            msg !== null &&
            typeof (msg as NappletMessage).type === 'string'
          ) {
            messageTap.recordOutboundEnvelope(msg as NappletMessage, resolvedWindowId);
          }
          return target.postMessage(msg, targetOrigin, transfer);
        };
      }
      try {
        const val = Reflect.get(target, prop, target) as unknown;
        return typeof val === 'function' ? (val as Function).bind(target) : val;
      } catch { return undefined; }
    },
  });
  proxyToReal.set(proxy, realWin);
  realToProxy.set(realWin, proxy);
  return proxy;
}

export interface NappletInfo {
  windowId: string;
  name: string;
  iframe: HTMLIFrameElement;
  pubkey?: string;
  dTag?: string;
  aggregateHash?: string;
  /** Immutable environment captured before the iframe's srcdoc is injected. */
  environment: ShellEnvironment;
  identityBound: boolean;
}

const napplets = new Map<string, NappletInfo>();
const installedNapplets = new InstalledNappletCatalog();
interface IntentGenerationState extends PlaygroundIntentGeneration {
  readonly dTag: string;
  readonly windowId: string;
  /** Exact catalog record selected before this target generation began. */
  readonly selectedRecord: InstalledNappletRecord;
  readonly ready: Promise<void>;
  readonly resolveReady: () => void;
  readonly rejectReady: (reason: Error) => void;
  source?: Window;
}
const intentGenerations = new Map<string, IntentGenerationState>();
const readyIntentSources = new Map<string, Window>();
let intentGenerationCounter = 0;
let stopIntentCatalogChanges: (() => void) | undefined;
let intentCatalogLifecycleBound = false;
const demoServiceNames = new Set<string>(DEMO_TOPOLOGY_SERVICE_NAMES);

export let tap: MessageTap;
export let relay: ShellBridge;
const accessControls = new PlaygroundAccessControls({
  getRelay: () => relay,
  getNapplets: () => napplets,
  registerDemoServiceName: (name) => demoServiceNames.add(name),
});

export function getNapplets(): Map<string, NappletInfo> { return napplets; }
export function getNapplet(windowId: string): NappletInfo | undefined { return napplets.get(windowId); }

/** Return the resolver-verified installed catalog, separate from live frames. */
export function getInstalledNappletCatalog(): InstalledNappletCatalog {
  return installedNapplets;
}

/** Explicitly uninstall an artifact; frame lifecycle never removes catalog authority. */
export function uninstallNapplet(dTag: string): boolean {
  const generation = intentGenerations.get(dTag);
  if (generation) clearPlaygroundIntentGeneration(generation.windowId);
  return installedNapplets.remove(dTag);
}

/**
 * Close a live frame while retaining its resolver-verified catalog authority.
 *
 * A later intent may reopen the handler only through the installed record,
 * which keeps frame lifecycle separate from NIP-5D artifact authority.
 */
export function closeNapplet(windowId: string): boolean {
  const info = napplets.get(windowId);
  if (!info) return false;
  resetPlaygroundIntentWindow(windowId);
  originRegistry.unregister(windowId);
  relay.runtime.sessionRegistry.unregister(windowId);
  napplets.delete(windowId);
  info.iframe.remove();
  return true;
}

/**
 * Record an artifact immediately after `resolvePlaygroundNapplet` succeeds.
 *
 * This narrow host seam makes resolver verification the only production route
 * to installed-handler authority; it intentionally has no iframe dependency.
 */
export function installVerifiedNapplet(
  resolved: PlaygroundNapplet,
  restart: { name: string; containerId: string },
) {
  return installedNapplets.install(resolved, restart);
}

/**
 * Create shell-host callbacks for retained, source-bound intent delivery.
 *
 * Callers create the controller before booting the shell, but these callbacks
 * only open targets or send once the shell has registered a current source.
 */
export function createPlaygroundIntentTargetOptions(): PlaygroundIntentControllerOptions {
  return {
    openOrReuse: openOrReuseIntentTarget,
    waitForReady: (generation) => waitForPlaygroundIntentReady(intentGeneration(generation)),
    isCurrent: (generation) => isCurrentPlaygroundIntentGeneration(intentGeneration(generation)),
    getWindowId: (generation) => intentGeneration(generation).windowId,
    send: sendIntentConvention,
  };
}

/** Clear live generation/session state when a target frame is closed or replaced. */
export function clearPlaygroundIntentGeneration(windowId: string): void {
  const info = napplets.get(windowId);
  if (!info?.dTag) return;
  const generation = intentGenerations.get(info.dTag);
  if (!generation || generation.windowId !== windowId) return;
  intentGenerations.delete(info.dTag);
  generation.rejectReady(new Error('intent target generation replaced'));
}

function resetPlaygroundIntentWindow(windowId: string): void {
  readyIntentSources.delete(windowId);
  clearPlaygroundIntentGeneration(windowId);
}

function intentGeneration(generation: PlaygroundIntentGeneration): IntentGenerationState {
  for (const state of intentGenerations.values()) {
    if (state.id === generation.id) return state;
  }
  throw new Error('intent target generation is no longer available');
}

/** Whether an intent dispatch permits selecting an already-live target frame. */
export function shouldReuseIntentTarget(params: IntentDispatchParams): boolean {
  return params.behavior?.newWindow !== true && params.behavior?.reuse !== false;
}

async function openOrReuseIntentTarget(
  params: IntentDispatchParams,
  _attempt: number,
): Promise<PlaygroundIntentGeneration | null> {
  const record = installedNapplets.get(params.handler);
  if (!record || !recordSupportsDelivery(record, params)) return null;
  const current = intentGenerations.get(params.handler);
  const currentInfo = current ? napplets.get(current.windowId) : undefined;
  if (
    current
    && currentInfo
    && current.selectedRecord === record
    && matchesInstalledNappletRecord(record, currentInfo)
    && isCurrentIntentGeneration(current)
    && shouldReuseIntentTarget(params)
  ) return current;

  // A catalog replacement may retain the same d-tag while changing verified bytes.
  // Never retain a stale artifact as an intent target after that replacement.
  for (const stale of Array.from(napplets.values())) {
    if (stale.dTag === params.handler && !matchesInstalledNappletRecord(record, stale)) {
      closeNapplet(stale.windowId);
    }
  }

  const live = !shouldReuseIntentTarget(params)
    ? undefined
    : [...napplets.values()].find((info) => matchesInstalledNappletRecord(record, info));
  if (live) return replaceIntentGeneration(live, record);

  let info: NappletInfo;
  try {
    info = await loadNapplet(record.restart.name, record.restart.containerId, {
      installInCatalog: false,
      acceptResolved: (identity) => installedNapplets.validateCurrent(record, identity) !== null,
    });
  } catch {
    return null;
  }
  const currentRecord = installedNapplets.validateCurrent(record, info);
  if (!currentRecord || !recordSupportsDelivery(currentRecord, params)) {
    closeNapplet(info.windowId);
    return null;
  }
  return replaceIntentGeneration(info, currentRecord);
}

function recordSupportsDelivery(
  record: ReturnType<InstalledNappletCatalog['get']>,
  params: IntentDispatchParams,
): boolean {
  return record?.archetypes.some((archetype) =>
    archetype.slug === params.archetype
    && archetype.convention === params.convention,
  ) ?? false;
}

function replaceIntentGeneration(
  info: NappletInfo,
  selectedRecord: InstalledNappletRecord,
): IntentGenerationState | null {
  if (!info.dTag) return null;
  clearPlaygroundIntentGeneration(info.windowId);
  let resolveReady!: () => void;
  let rejectReady!: (reason: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const generation: IntentGenerationState = {
    id: `playground-intent-${++intentGenerationCounter}`,
    dTag: info.dTag,
    windowId: info.windowId,
    selectedRecord,
    ready,
    resolveReady,
    rejectReady,
  };
  intentGenerations.set(info.dTag, generation);
  const source = info.iframe.contentWindow;
  if (
    source
    && originRegistry.getWindowId(source) === info.windowId
    && (
      readyIntentSources.get(info.windowId) === source
      || relay.runtime.sessionRegistry.getEntryByWindowId(info.windowId)
    )
  ) {
    generation.source = source;
    generation.resolveReady();
  }
  return generation;
}

function isCurrentIntentGeneration(generation: IntentGenerationState): boolean {
  const info = napplets.get(generation.windowId);
  return intentGenerations.get(generation.dTag)?.id === generation.id
    && info?.dTag === generation.dTag
    && installedNapplets.validateCurrent(generation.selectedRecord, info) !== null
    && info.iframe.contentWindow === (generation.source ?? info.iframe.contentWindow);
}

function invalidatePlaygroundIntentGeneration(generation: IntentGenerationState): void {
  if (napplets.has(generation.windowId)) closeNapplet(generation.windowId);
  else clearPlaygroundIntentGeneration(generation.windowId);
}

/**
 * Keep retained readiness waits live across verified catalog replacements.
 * A catalog listener rejects stale waits immediately, allowing the controller
 * to retry the newly installed target even when the old frame never becomes
 * ready.
 */
function subscribePlaygroundIntentCatalogChanges(): void {
  if (stopIntentCatalogChanges) return;
  stopIntentCatalogChanges = installedNapplets.onChanged(() => {
    for (const generation of Array.from(intentGenerations.values())) {
      if (!isCurrentIntentGeneration(generation)) invalidatePlaygroundIntentGeneration(generation);
    }
  });
  if (intentCatalogLifecycleBound) return;
  intentCatalogLifecycleBound = true;
  window.addEventListener('pagehide', () => {
    stopIntentCatalogChanges?.();
    stopIntentCatalogChanges = undefined;
    intentCatalogLifecycleBound = false;
  }, { once: true });
}

async function waitForPlaygroundIntentReady(generation: IntentGenerationState): Promise<void> {
  if (!isCurrentIntentGeneration(generation)) {
    invalidatePlaygroundIntentGeneration(generation);
    throw new Error('intent target catalog record was replaced');
  }
  await generation.ready;
  if (!isCurrentIntentGeneration(generation)) {
    invalidatePlaygroundIntentGeneration(generation);
    throw new Error('intent target catalog record was replaced');
  }
}

function isCurrentPlaygroundIntentGeneration(generation: IntentGenerationState): boolean {
  if (isCurrentIntentGeneration(generation)) return true;
  invalidatePlaygroundIntentGeneration(generation);
  return false;
}

export function markIntentTargetReady(windowId: string, source: Window): void {
  const info = napplets.get(windowId);
  if (!info?.dTag || info.iframe.contentWindow !== source) return;
  if (originRegistry.getWindowId(source) !== windowId) return;
  readyIntentSources.set(windowId, source);
  const generation = intentGenerations.get(info.dTag);
  if (!generation || generation.windowId !== windowId || generation.source) return;
  if (!isCurrentIntentGeneration(generation)) {
    invalidatePlaygroundIntentGeneration(generation);
    return;
  }
  generation.source = source;
  generation.resolveReady();
}

function sendIntentConvention(
  generation: PlaygroundIntentGeneration,
  params: IntentDispatchParams,
): void {
  const state = intentGeneration(generation);
  if (!state.source || !isCurrentPlaygroundIntentGeneration(state)) {
    throw new Error('intent target generation is not current and ready');
  }
  createPostMessageProxy(state.source, tap, state.windowId).postMessage({
    type: 'inc.event',
    topic: params.convention,
    sender: params.sender,
    ...(params.payload === undefined ? {} : { payload: params.payload }),
  }, '*');
}

/**
 * Look up the windowId for a napplet by its dTag (DEMO_NAPPLETS entry `name`).
 * Returns null if the napplet is not yet loaded or not yet identity-bound.
 *
 * Exposed for apps/playground/src/main.ts test hooks (e.g. __injectNapEnvelopeAsNapplet__).
 * Callers MUST NOT mutate napplet state through this helper — read-only lookup only.
 */
export function findIdentityBoundNappletWindowIdByDTag(dTag: string): string | null {
  for (const [windowId, info] of napplets.entries()) {
    if (info.name === dTag && info.identityBound) {
      return windowId;
    }
  }
  return null;
}
export function getDemoNappletDefinitions(): DemoNappletDefinition[] {
  return DEMO_NAPPLETS.map((napplet) => ({ ...napplet }));
}
export function getDemoServiceNames(): string[] {
  return [...demoServiceNames].sort((left, right) => left.localeCompare(right));
}
export function getDemoTopologyInputs() {
  return {
    hostPubkey: getDemoHostPubkey(),
    napplets: getDemoNappletDefinitions(),
    services: getDemoServiceNames(),
    signerState: getSignerConnectionState(),
  };
}

/**
 * Get the demo host pubkey for display on the shell node.
 * This is the shell's own ephemeral identity, separate from the connected signer.
 */
export function getDemoHostPubkey(): string {
  return _hostPubkey;
}

function createInstalledMessageTap(): MessageTap {
  const messageTap = createMessageTap((source) => {
    for (const [windowId, info] of napplets) {
      if (info.iframe?.contentWindow === source) return windowId;
    }
    return undefined;
  });
  messageTap.install(window);
  return messageTap;
}

/**
 * Add playground logging-proxy support to the shell's source registry.
 *
 * @internal Exported for host-proxy regression coverage.
 */
export function installOriginRegistryProxy(messageTap: MessageTap): void {
  const originalGetIframeWindow = originRegistry.getIframeWindow.bind(originRegistry);
  originRegistry.getIframeWindow = (windowId: string) => {
    const win = originalGetIframeWindow(windowId);
    if (!win) return null;
    return createPostMessageProxy(win, messageTap, windowId);
  };

  const originalGetWindowId = originRegistry.getWindowId.bind(originRegistry);
  originRegistry.getWindowId = (win: Window) => {
    const result = originalGetWindowId(win);
    if (result) return result;
    const real = proxyToReal.get(win);
    if (real) {
      const realResult = originalGetWindowId(real);
      if (realResult) return realResult;
    }
    // srcdoc swaps contentWindow before load; register the new source on first message.
    const target = real ?? win;
    for (const [windowId, info] of napplets) {
      if (info.iframe.contentWindow === target) {
        originRegistry.register(target, windowId, {
          dTag: info.dTag ?? '',
          aggregateHash: info.aggregateHash ?? '',
        });
        originRegistry.setEnvironment(target, info.environment);
        return windowId;
      }
    }
    return undefined;
  };

  const originalGetIdentity = originRegistry.getIdentity.bind(originRegistry);
  originRegistry.getIdentity = (win: Window) =>
    originalGetIdentity(win) ?? originalGetIdentity(proxyToReal.get(win) ?? win);

  const originalGetRegistrationId = originRegistry.getRegistrationId.bind(originRegistry);
  originRegistry.getRegistrationId = (win: Window) =>
    originalGetRegistrationId(win) ?? originalGetRegistrationId(proxyToReal.get(win) ?? win);

  const originalGetEnvironment = originRegistry.getEnvironment.bind(originRegistry);
  originRegistry.getEnvironment = (win: Window) =>
    originalGetEnvironment(win) ?? originalGetEnvironment(proxyToReal.get(win) ?? win);
}

function wrapRelayHandleMessage(messageTap: MessageTap): void {
  const originalHandle = relay.handleMessage;
  relay.handleMessage = (event: MessageEvent) => {
    const isArray = Array.isArray(event.data);
    const isEnvelope =
      !isArray &&
      typeof event.data === 'object' &&
      event.data !== null &&
      typeof (event.data as NappletMessage).type === 'string';

    if (!event.source || (!isArray && !isEnvelope)) {
      originalHandle(event);
      return;
    }
    const sourceWindow = event.source as Window;
    const windowId = originRegistry.getWindowId(sourceWindow);
    const proxiedSource = createPostMessageProxy(sourceWindow, messageTap);
    const syntheticEvent = new Proxy(event, {
      get(target, prop) {
        if (prop === 'source') return proxiedSource;
        const val = Reflect.get(target, prop, target) as unknown;
        return typeof val === 'function' ? (val as Function).bind(target) : val;
      },
    });
    originalHandle(syntheticEvent);
    if (
      windowId
      && typeof event.data === 'object'
      && event.data !== null
      && (event.data as NappletMessage).type === 'shell.ready'
    ) {
      markEnvelopeIdentityBinding(windowId);
      markIntentTargetReady(windowId, sourceWindow);
    }
  };
}

function bindTapIdentityBindings(messageTap: MessageTap): void {
  messageTap.onMessage((msg) => {
    if (msg.verb === 'OK' && msg.parsed.success === true && msg.direction === 'shell->napplet') {
      markLegacyIdentityBindings();
    }
    if (msg.verb === 'ENVELOPE' && msg.direction === 'napplet->shell' && msg.windowId) {
      markEnvelopeIdentityBinding(msg.windowId);
    }
  });
}

function markLegacyIdentityBindings(): void {
  for (const [windowId, info] of napplets) {
    if (info.identityBound) continue;
    const pubkey = relay.runtime.sessionRegistry.getPubkey(windowId);
    const entry = pubkey ? relay.runtime.sessionRegistry.getEntry(pubkey) : undefined;
    if (entry) markNappletIdentityBound(info, entry);
  }
}

function markEnvelopeIdentityBinding(windowId: string): void {
  const info = napplets.get(windowId);
  if (!info || info.identityBound) return;
  const entry = relay.runtime.sessionRegistry.getEntryByWindowId(windowId);
  if (!entry) return;
  markNappletIdentityBound(info, entry);
  window.dispatchEvent(new CustomEvent('napplet:identity-bound', {
    detail: {
      windowId,
      dTag: entry.dTag,
      aggregateHash: entry.aggregateHash,
    },
  }));
}

function markNappletIdentityBound(info: NappletInfo, entry: SessionEntry): void {
  info.identityBound = true;
  info.pubkey = entry.pubkey;
  info.dTag = entry.dTag;
  info.aggregateHash = entry.aggregateHash;
}

/**
 * Boot the shell: create ShellBridge, install tap, wire up proxy.
 *
 * @param notificationOnChange - Called when the notification service state changes.
 *   Used by the demo notification controller to update host-side toast/summary UX.
 */
export function bootShell(
  notificationOnChange?: (notifications: readonly Notification[]) => void,
  initialTheme?: Theme,
  intentService?: ServiceHandler,
): { tap: MessageTap; relay: ShellBridge } {
  const hooks = createDemoHooks(notificationOnChange, {
    getDisabledDomains: () => accessControls.getDisabledDomains(),
    getNappletEntries: () => napplets.entries(),
    onResolvedAclCheck: (event, windowId, nappletName) => {
      pushAclEvent(event, windowId, nappletName);
      accessControls.notifyAclCheckListeners(event, windowId, nappletName);
    },
    onThemeBroadcast: (envelope) => relay.publishTheme(envelope.theme),
  }, initialTheme);
  if (intentService) {
    // Keep the adapter object stable: each frame resolves its frozen shell
    // environment from this instance before srcdoc injection. Replacing the
    // services map here would register the handler but leave `intent` absent
    // from the advertised capability snapshot.
    const services = hooks.services ?? (hooks.services = {});
    services.intent = intentService;
    hooks.intent = { isAvailable: () => true };
  }
  tap = createInstalledMessageTap();
  installOriginRegistryProxy(tap);

  relay = createShellBridge(hooks);
  subscribePlaygroundIntentCatalogChanges();
  setDemoSessionRegistryRef(relay.runtime.sessionRegistry);
  accessControls.populateServiceHandlerStore(hooks.services);
  accessControls.wrapRuntimeServiceRegistration();
  accessControls.applyPersistedServiceState();
  wrapRelayHandleMessage(tap);

  window.addEventListener("message", relay.handleMessage);
  bindTapIdentityBindings(tap);
  setMessageTap(tap);

  return { tap, relay };
}

/**
 * Load a demo napplet into a container element.
 *
 * @param name - Napplet d-tag to resolve.
 * @param containerId - DOM container that receives the iframe.
 * @param options - Admission and pre-render hooks.
 * @returns The live napplet frame record.
 */
export async function loadNapplet(
  name: string,
  containerId: string,
  options: LoadNappletOptions = {},
): Promise<NappletInfo> {
  return loadPlaygroundNapplet({
    napplets,
    clearIntentGeneration: resetPlaygroundIntentWindow,
    installVerifiedNapplet,
  }, name, containerId, options);
}

/**
 * Grant or revoke a capability on a napplet.
 *
 * @param windowId - Live napplet window ID.
 * @param capability - Capability to mutate.
 * @param enabled - Whether the capability should be granted.
 */
export function toggleCapability(windowId: string, capability: Capability, enabled: boolean): void {
  accessControls.toggleCapability(windowId, capability, enabled);
}

/**
 * Enable or disable a service. When disabled, the service handler is unregistered
 * from the runtime (messages to it will fail). When re-enabled, the stored handler
 * reference is re-registered. Changes take effect on the very next message.
 */
export function toggleService(name: string, enabled: boolean): void {
  accessControls.toggleService(name, enabled);
}

/**
 * Check if a service is currently enabled (registered with the runtime).
 */
export function isServiceEnabled(name: string): boolean {
  return accessControls.isServiceEnabled(name);
}

/**
 * Block or unblock a napplet entirely.
 */
export function toggleBlock(windowId: string, blocked: boolean): void {
  accessControls.toggleBlock(windowId, blocked);
}

/**
 * Get the demo ACL adapter — the single seam for all grant/revoke/block/unblock
 * operations in the demo UI. Provides snapshot, check, and onCheck subscription.
 *
 * @returns DemoAclAdapter instance
 */
export function getAclAdapter(): DemoAclAdapter {
  return accessControls.getAclAdapter();
}
