/**
 * shell-host.ts -- Demo shell host.
 *
 * Boots @napplet/shell with mock hooks, installs message tap,
 * loads demo napplet iframes, and exposes control APIs for the UI.
 */

import {
  createShellBridge,
  originRegistry,
  type ShellBridge,
  type ServiceHandler,
  type Capability,
  type NappletMessage,
  type AclCheckEvent,
  type SessionEntry,
} from '@kehto/shell';
import type { Notification } from '@kehto/services';
import { getSignerConnectionState } from './signer-connection.js';
import { pushAclEvent } from './acl-history.js';
import { createDemoDecryptFixtures } from './demo-decrypt.js';
import {
  CLASS_BY_DTAG,
  DEMO_NAPPLETS,
  DEMO_TOPOLOGY_SERVICE_NAMES,
  type DemoNappletDefinition,
} from './demo-definitions.js';
import {
  createDemoHooks,
  getMissingRequiredNaps,
  setDemoSessionRegistryRef,
} from './demo-hooks.js';
import { createMessageTap, type MessageTap } from './message-tap.js';

// Static ephemeral host identity for shell node display (separate from signer identity)
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
const _hostSecretKey = generateSecretKey();
const _hostPubkey = getPublicKey(_hostSecretKey);

export {
  DEMO_DECRYPT_PUBKEY,
  getDemoDecryptBridgeCallCount,
  resetDemoDecryptBridgeCallCount,
  type DemoDecryptFixtures,
} from './demo-decrypt.js';
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
export {
  getConfigServiceBundle,
  getIdentityServiceHandler,
  getMissingRequiredNaps,
  getNip66Aggregator,
  getNotificationServiceHandler,
  getPlaygroundRelayActivity,
  getShellCapabilities,
  getThemeServiceBundle,
  setDemoConfigValue,
} from './demo-hooks.js';

// Inline a simplified message tap since we can't import from tests/helpers in apps/
// (they are not a published package)

const proxyToReal = new WeakMap<object, Window>();

function createPostMessageProxy(realWin: Window, messageTap: MessageTap, windowId?: string): Window {
  const proxy = new Proxy(realWin, {
    get(target, prop) {
      if (prop === 'postMessage') {
        return (msg: unknown, targetOrigin: string, transfer?: Transferable[]) => {
          if (Array.isArray(msg)) {
            messageTap.recordOutbound(msg, windowId);
          } else if (
            typeof msg === 'object' &&
            msg !== null &&
            typeof (msg as NappletMessage).type === 'string'
          ) {
            messageTap.recordOutboundEnvelope(msg as NappletMessage, windowId);
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
  return proxy;
}

export interface NappletInfo {
  windowId: string;
  name: string;
  iframe: HTMLIFrameElement;
  pubkey?: string;
  dTag?: string;
  aggregateHash?: string;
  identityBound: boolean;
}

export interface GatewayNappletMetadata {
  dTag: string;
  aggregateHash: string;
  htmlUrl: string;
  requires: string[];
}

export interface LoadNappletOptions {
  beforeNavigate?: (metadata: GatewayNappletMetadata) => void | Promise<void>;
}

const napplets = new Map<string, NappletInfo>();
const demoServiceNames = new Set<string>(DEMO_TOPOLOGY_SERVICE_NAMES);
let nappletCounter = 0;

const serviceHandlerStore = new Map<string, ServiceHandler>();
const disabledServices = new Set<string>();
const SERVICE_STATE_STORAGE_KEY = 'kehto.playground.disabledServices.v1';

export let tap: MessageTap;
export let relay: ShellBridge;

export function getNapplets(): Map<string, NappletInfo> { return napplets; }
export function getNapplet(windowId: string): NappletInfo | undefined { return napplets.get(windowId); }

/**
 * Look up the windowId for a napplet by its dTag (DEMO_NAPPLETS entry `name`).
 * Returns null if the napplet is not yet loaded or not yet identity-bound.
 *
 * Exposed for apps/playground/src/main.ts __setNappletClass__ test hook (D9).
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

function getCurrentUserIdentityPubkey(): string {
  const state = getSignerConnectionState();
  if (state.method === 'none' || state.isConnecting || state.error) return '';
  return state.pubkey ?? '';
}

function publishCurrentUserIdentityToNapplet(info: NappletInfo): void {
  const targetWindow = info.iframe.contentWindow;
  if (!targetWindow) return;
  targetWindow.postMessage(
    { type: 'identity.changed', pubkey: getCurrentUserIdentityPubkey() } as NappletMessage,
    '*',
  );
}

function publishCurrentUserIdentityToWindowId(windowId: string): void {
  const info = napplets.get(windowId);
  if (info) publishCurrentUserIdentityToNapplet(info);
}

function scheduleCurrentUserIdentitySync(info: NappletInfo): void {
  window.setTimeout(() => publishCurrentUserIdentityToNapplet(info), 0);
  window.setTimeout(() => publishCurrentUserIdentityToNapplet(info), 100);
}

export async function publishDecryptFixturesToNapplet(dTag = 'decrypt-demo'): Promise<boolean> {
  const info = [...napplets.values()].find((entry) => entry.name === dTag) ?? null;
  if (!info?.iframe.contentWindow) {
    console.warn(`[demo] publishDecryptFixturesToNapplet: iframe missing for ${dTag}`);
    return false;
  }
  const fixtures = await createDemoDecryptFixtures();
  info.iframe.contentWindow.postMessage(
    { type: 'demo.decrypt.fixtures', fixtures },
    '*',
  );
  return true;
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

function installOriginRegistryProxy(messageTap: MessageTap): void {
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
    if (real) return originalGetWindowId(real);
    return undefined;
  };
}

function populateServiceHandlerStore(services: Record<string, ServiceHandler> | undefined): void {
  if (!services) return;
  for (const [name, handler] of Object.entries(services)) {
    serviceHandlerStore.set(name, handler);
  }
}

function wrapRuntimeServiceRegistration(): void {
  const originalRegisterService = relay.runtime.registerService.bind(relay.runtime);
  relay.runtime.registerService = (name, handler) => {
    demoServiceNames.add(name);
    serviceHandlerStore.set(name, handler);
    originalRegisterService(name, handler);
  };
  const originalUnregisterService = relay.runtime.unregisterService.bind(relay.runtime);
  relay.runtime.unregisterService = (name) => {
    originalUnregisterService(name);
  };
}

function readPersistedDisabledServices(): string[] {
  try {
    const raw = localStorage.getItem(SERVICE_STATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((name): name is string => typeof name === 'string' && name.length > 0);
  } catch {
    return [];
  }
}

function persistDisabledServices(): void {
  try {
    localStorage.setItem(SERVICE_STATE_STORAGE_KEY, JSON.stringify([...disabledServices].sort()));
  } catch {
    // Storage can be unavailable; service toggles still apply for this session.
  }
}

function applyPersistedServiceState(): void {
  for (const name of readPersistedDisabledServices()) {
    if (!serviceHandlerStore.has(name)) continue;
    disabledServices.add(name);
    relay.runtime.unregisterService(name);
  }
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
    const proxiedSource = createPostMessageProxy(event.source as Window, messageTap);
    const syntheticEvent = new Proxy(event, {
      get(target, prop) {
        if (prop === 'source') return proxiedSource;
        const val = Reflect.get(target, prop, target) as unknown;
        return typeof val === 'function' ? (val as Function).bind(target) : val;
      },
    });
    originalHandle(syntheticEvent);
  };
}

function bindTapIdentityUpdates(messageTap: MessageTap): void {
  messageTap.onMessage((msg) => {
    if (msg.verb === 'OK' && msg.parsed.success === true && msg.direction === 'shell->napplet') {
      markLegacyIdentityBindings();
    }
    if (msg.verb === 'ENVELOPE' && msg.direction === 'napplet->shell' && msg.windowId) {
      markEnvelopeIdentityBinding(msg.windowId);
      if (msg.envelopeType === 'identity.getPublicKey') {
        publishCurrentUserIdentityToWindowId(msg.windowId);
      }
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
  if (entry) markNappletIdentityBound(info, entry);
}

function markNappletIdentityBound(info: NappletInfo, entry: SessionEntry): void {
  info.identityBound = true;
  info.pubkey = entry.pubkey;
  info.dTag = entry.dTag;
  info.aggregateHash = entry.aggregateHash;
}

function findNappletByName(name: string): { windowId: string; info: NappletInfo } | null {
  for (const [windowId, info] of napplets.entries()) {
    if (info.name === name) return { windowId, info };
  }
  return null;
}

function grantLoadedNappletCapability(name: string, capability: Capability): boolean {
  const entry = findNappletByName(name);
  if (!entry) {
    console.warn(`[demo] grant helper: ${name} napplet not loaded yet`);
    return false;
  }
  if (!entry.info.identityBound) {
    console.warn(`[demo] grant helper: ${name} not yet identity-bound`);
    return false;
  }
  relay.runtime.aclState.grant(
    entry.info.pubkey ?? '',
    entry.info.dTag ?? '',
    entry.info.aggregateHash ?? '',
    capability,
  );
  relay.runtime.aclState.persist();
  return true;
}

function installGrantHooks(): void {
  (window as Window & { __grantKeysForward__?: () => boolean }).__grantKeysForward__ = (): boolean =>
    grantLoadedNappletCapability('hotkey-chord', 'keys:forward');
  (window as Window & { __grantMediaControl__?: () => boolean }).__grantMediaControl__ = (): boolean =>
    grantLoadedNappletCapability('media-controller', 'media:control');
}

function installReservedChordSentinel(): void {
  const reservedChordSentinel = document.createElement('div');
  reservedChordSentinel.id = 'reserved-chord-last-fired';
  reservedChordSentinel.setAttribute('data-testid', 'reserved-chord-last-fired');
  reservedChordSentinel.style.cssText = [
    'position: fixed',
    'bottom: 4px',
    'right: 4px',
    'padding: 2px 8px',
    'font: 11px/1.4 monospace',
    'color: var(--nap-theme-muted, #888)',
    'background: var(--nap-theme-overlay, rgba(0,0,0,0.4))',
    'border-radius: 3px',
    'z-index: 9999',
    'pointer-events: none',
  ].join('; ');
  reservedChordSentinel.textContent = '';
  document.body.appendChild(reservedChordSentinel);
}

/**
 * Boot the shell: create ShellBridge, install tap, wire up proxy.
 *
 * @param notificationOnChange - Called when the notification service state changes.
 *   Used by the demo notification controller to update host-side toast/summary UX.
 */
export function bootShell(notificationOnChange?: (notifications: readonly Notification[]) => void): { tap: MessageTap; relay: ShellBridge } {
  const hooks = createDemoHooks(notificationOnChange, {
    getNappletEntries: () => napplets.entries(),
    onResolvedAclCheck: (event, windowId, nappletName) => {
      pushAclEvent(event, windowId, nappletName);
      _notifyAclCheckListeners(event, windowId, nappletName);
    },
  });
  tap = createInstalledMessageTap();
  installOriginRegistryProxy(tap);

  relay = createShellBridge(hooks);
  setDemoSessionRegistryRef(relay.runtime.sessionRegistry);
  populateServiceHandlerStore(hooks.services);
  wrapRuntimeServiceRegistration();
  applyPersistedServiceState();
  wrapRelayHandleMessage(tap);

  window.addEventListener("message", relay.handleMessage);
  bindTapIdentityUpdates(tap);
  setMessageTap(tap);
  installGrantHooks();
  installReservedChordSentinel();

  return { tap, relay };
}

/**
 * Load a demo napplet into a container element.
 */
export async function loadNapplet(
  name: string,
  containerId: string,
  options: LoadNappletOptions = {},
): Promise<NappletInfo> {
  const metadata = await fetchGatewayMetadata(name);
  const missingRequiredNaps = getMissingRequiredNaps(metadata.requires);
  if (missingRequiredNaps.length > 0) {
    throw new Error(
      `[demo] ${metadata.dTag} requires unsupported NAP capabilities: ${missingRequiredNaps.join(', ')}`,
    );
  }

  const windowId = `demo-${name}-${++nappletCounter}`;

  const iframe = document.createElement('iframe');
  iframe.id = windowId;
  iframe.className = 'w-full h-full border-0';
  iframe.sandbox.add('allow-scripts');

  const container = document.getElementById(containerId);
  if (container) container.appendChild(iframe);

  const info: NappletInfo = {
    windowId,
    name,
    iframe,
    dTag: metadata.dTag,
    aggregateHash: metadata.aggregateHash,
    identityBound: false,
  };
  napplets.set(windowId, info);

  function markSourceDerivedIdentity(entry: SessionEntry): void {
    const wasBound = info.identityBound;
    info.identityBound = true;
    info.pubkey = entry.pubkey;
    info.dTag = entry.dTag;
    info.aggregateHash = entry.aggregateHash;
    if (!wasBound) {
      window.dispatchEvent(new CustomEvent('napplet:identity-bound', {
        detail: {
          windowId,
          dTag: entry.dTag,
          aggregateHash: entry.aggregateHash,
        },
      }));
    }
    scheduleCurrentUserIdentitySync(info);
  }

  // NIP-5D session entry — registered immediately so storage.* and notify.* NUB
  // handlers can resolve the napplet's identity without any runtime negotiation.
  // dTag and aggregateHash come from the local gateway manifest metadata so the
  // playground exercises the same identity tuple as production NIP-5A loading.
  function registerSessionEntry(): SessionEntry {
    const entry: SessionEntry = {
      pubkey: '',
      windowId,
      origin: 'null',
      type: 'napplet',
      dTag: metadata.dTag,
      aggregateHash: metadata.aggregateHash,
      registeredAt: Date.now(),
      instanceId: crypto.randomUUID(),
      provenance: 'nip-5d',
      // CLASS-04 (Plan 38-03): data-driven class from CLASS_BY_DTAG map (D3).
      // Defaults to null (permissive, D2) if the dTag has no explicit entry —
      // defensive fallback; the module-load assertion above guarantees every
      // DEMO_NAPPLETS name has an entry, so the ?? null is defensive only.
      class: CLASS_BY_DTAG.get(metadata.dTag) ?? null,
    };
    relay.runtime.sessionRegistry.register(windowId, entry);
    return entry;
  }

  // Register origin immediately — contentWindow is available after appendChild.
  // This must happen before the hosted artifact bootstrap can send shell.ready.
  if (iframe.contentWindow) {
    originRegistry.register(iframe.contentWindow, windowId);
    markSourceDerivedIdentity(registerSessionEntry());
  }

  iframe.addEventListener('load', () => {
    if (iframe.contentWindow) {
      // Re-register origin and session in case contentWindow reference changed during load.
      originRegistry.register(iframe.contentWindow, windowId);
      markSourceDerivedIdentity(registerSessionEntry());
    }
  });

  await options.beforeNavigate?.(metadata);
  iframe.src = metadata.htmlUrl;

  return info;
}

function playgroundPath(pathname: string): string {
  const cleanPath = pathname.replace(/^\/+/, '');
  const basePath = (import.meta.env.BASE_URL ?? '/').trim() || '/';
  if (basePath === './') return cleanPath;
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return `${normalizedBase}${cleanPath}`;
}

async function fetchGatewayMetadata(name: string): Promise<GatewayNappletMetadata> {
  const response = await fetch(
    playgroundPath(`/napplet-gateway/${encodeURIComponent(name)}/manifest.json`),
    { cache: 'no-store' },
  );
  if (!response.ok) {
    throw new Error(`[demo] gateway metadata load failed for ${name}: ${response.status}`);
  }

  const metadata = await response.json() as Partial<GatewayNappletMetadata>;
  if (
    metadata.dTag !== name ||
    typeof metadata.aggregateHash !== 'string' ||
    metadata.aggregateHash.length === 0 ||
    typeof metadata.htmlUrl !== 'string' ||
    metadata.htmlUrl.length === 0 ||
    !Array.isArray(metadata.requires) ||
    metadata.requires.some((capability) => typeof capability !== 'string' || capability.length === 0)
  ) {
    throw new Error(`[demo] malformed gateway metadata for ${name}`);
  }
  return metadata as GatewayNappletMetadata;
}

/**
 * Grant or revoke a capability on a napplet.
 */
export function toggleCapability(windowId: string, capability: Capability, enabled: boolean): void {
  const info = napplets.get(windowId);
  if (!info) { console.warn('[acl] toggleCapability: no info for', windowId); return; }
  if (!info.identityBound) {
    console.warn('[acl] toggleCapability: napplet not yet identity-bound', windowId);
    return;
  }
  const pubkey = info.pubkey;  // '' for NIP-5D, real pubkey for legacy
  const dTag = info.dTag || '';
  const hash = info.aggregateHash || '';
  if (enabled) {
    relay.runtime.aclState.grant(pubkey, dTag, hash, capability);
  } else {
    relay.runtime.aclState.revoke(pubkey, dTag, hash, capability);
  }
  relay.runtime.aclState.persist();
}

/**
 * Enable or disable a service. When disabled, the service handler is unregistered
 * from the runtime (messages to it will fail). When re-enabled, the stored handler
 * reference is re-registered. Changes take effect on the very next message.
 */
export function toggleService(name: string, enabled: boolean): void {
  if (enabled) {
    const handler = serviceHandlerStore.get(name);
    if (!handler) {
      console.warn('[service] toggleService: no stored handler for', name);
      return;
    }
    disabledServices.delete(name);
    relay.runtime.registerService(name, handler);
  } else {
    disabledServices.add(name);
    relay.runtime.unregisterService(name);
  }
  persistDisabledServices();
}

/**
 * Check if a service is currently enabled (registered with the runtime).
 */
export function isServiceEnabled(name: string): boolean {
  return !disabledServices.has(name);
}

/**
 * Block or unblock a napplet entirely.
 */
export function toggleBlock(windowId: string, blocked: boolean): void {
  const info = napplets.get(windowId);
  if (!info?.identityBound) return;
  // NIP-5D napplets have pubkey='' — ACL is keyed on dTag:hash; pass pubkey as-is.
  if (blocked) {
    relay.runtime.aclState.block(info.pubkey, info.dTag || '', info.aggregateHash || '');
  } else {
    relay.runtime.aclState.unblock(info.pubkey, info.dTag || '', info.aggregateHash || '');
  }
  relay.runtime.aclState.persist();
}

export interface DemoAclAdapter {
  /** Grant a capability on a napplet by windowId. */
  grant(windowId: string, capability: Capability): void;
  /** Revoke a capability on a napplet by windowId. */
  revoke(windowId: string, capability: Capability): void;
  /** Block a napplet by windowId. */
  block(windowId: string): void;
  /** Unblock a napplet by windowId. */
  unblock(windowId: string): void;
  /** Snapshot of all ACL entries for napplets currently identity-bound. */
  snapshot(): Array<{
    windowId: string;
    name: string;
    pubkey: string;
    dTag: string;
    aggregateHash: string;
    blocked: boolean;
    capabilities: Record<Capability, boolean>;
  }>;
  /** Synchronous capability check (delegates to aclState.check). */
  check(windowId: string, capability: Capability): boolean;
  /** Subscribe to ACL audit events (pushed via onAclCheck). */
  onCheck(listener: (event: AclCheckEvent, windowId: string, nappletName: string) => void): () => void;
}

const _aclCheckListeners: Array<(event: AclCheckEvent, wid: string, name: string) => void> = [];

function _notifyAclCheckListeners(event: AclCheckEvent, windowId: string, name: string): void {
  for (const cb of _aclCheckListeners) {
    try { cb(event, windowId, name); } catch { /* ignore listener error */ }
  }
}

const aclAdapter: DemoAclAdapter = {
  grant(windowId, capability) { toggleCapability(windowId, capability, true); },
  revoke(windowId, capability) { toggleCapability(windowId, capability, false); },
  block(windowId) { toggleBlock(windowId, true); },
  unblock(windowId) { toggleBlock(windowId, false); },
  snapshot() {
    const out: ReturnType<DemoAclAdapter['snapshot']> = [];
    for (const [windowId, info] of napplets) {
      // Accept both Path A (NIP-01, pubkey populated) and Path B (NIP-5D,
      // identity-bound via dTag with empty pubkey). aclState.check() handles
      // the empty-pubkey + dTag-keyed lookup path correctly (v1.2 canonical),
      // so no changes are required to the check calls below.
      if (!info.identityBound) continue;
      const pk = info.pubkey ?? '';
      const dTag = info.dTag ?? '';
      const hash = info.aggregateHash ?? '';
      const entry = relay.runtime.aclState.getEntry(pk, dTag, hash);
      const hasCapability = (capability: Capability): boolean =>
        entry ? entry.capabilities.includes(capability) : relay.runtime.aclState.check(pk, dTag, hash, capability);
      const caps: Record<Capability, boolean> = {
        'relay:read': hasCapability('relay:read'),
        'relay:write': hasCapability('relay:write'),
        'cache:read': hasCapability('cache:read'),
        'cache:write': hasCapability('cache:write'),
        'hotkey:forward': hasCapability('hotkey:forward'),
        'state:read': hasCapability('state:read'),
        'state:write': hasCapability('state:write'),
        'identity:read': hasCapability('identity:read'),
        'identity:decrypt': hasCapability('identity:decrypt'),
        'keys:bind': hasCapability('keys:bind'),
        'keys:forward': hasCapability('keys:forward'),
        'media:control': hasCapability('media:control'),
        'notify:send': hasCapability('notify:send'),
        'notify:channel': hasCapability('notify:channel'),
        'theme:read': hasCapability('theme:read'),
      };
      out.push({
        windowId,
        name: info.name,
        pubkey: pk,
        dTag,
        aggregateHash: hash,
        blocked: entry?.blocked ?? false,
        capabilities: caps,
      });
    }
    return out;
  },
  check(windowId, capability) {
    const info = napplets.get(windowId);
    if (!info?.identityBound) return false;
    return relay.runtime.aclState.check(info.pubkey ?? '', info.dTag ?? '', info.aggregateHash ?? '', capability);
  },
  onCheck(listener) {
    _aclCheckListeners.push(listener);
    return () => {
      const i = _aclCheckListeners.indexOf(listener);
      if (i !== -1) _aclCheckListeners.splice(i, 1);
    };
  },
};

/**
 * Get the demo ACL adapter — the single seam for all grant/revoke/block/unblock
 * operations in the demo UI. Provides snapshot, check, and onCheck subscription.
 *
 * @returns DemoAclAdapter instance
 */
export function getAclAdapter(): DemoAclAdapter {
  return aclAdapter;
}

let _messageTapRef: MessageTap | null = null;

/**
 * Set the message tap reference. Called from the bootstrap site so
 * host-originated dispatchers (e.g., notification-demo.ts) can record
 * their envelopes through the same tap that iframe postMessage traffic uses.
 *
 * @param tap - The installed message tap
 */
export function setMessageTap(tapRef: MessageTap): void {
  _messageTapRef = tapRef;
}

/**
 * Get the demo message tap. Returns null before bootShell() has run.
 *
 * @returns MessageTap or null
 */
export function getMessageTap(): MessageTap | null {
  return _messageTapRef;
}
