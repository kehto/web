/**
 * shell-host.ts -- Demo shell host.
 *
 * Boots @napplet/shell with mock hooks, installs message tap,
 * loads demo napplet iframes, and exposes control APIs for the UI.
 */

import {
  createShellBridge,
  injectNappletNamespacePrelude,
  originRegistry,
  type ShellBridge,
  type ServiceHandler,
  type Capability,
  type NappletMessage,
  type AclCheckEvent,
  type SessionEntry,
} from '@kehto/shell';
import type { Notification } from '@kehto/services';
import {
  resolvePlaygroundNapplet,
  injectCspMeta,
  PLAYGROUND_MANIFEST_AUTHOR,
} from './napplet-resolver.js';
import { getSignerConnectionState } from './signer-connection.js';
import { pushAclEvent } from './acl-history.js';
import {
  DEMO_NAPPLETS,
  DEMO_TOPOLOGY_SERVICE_NAMES,
  type DemoNappletDefinition,
} from './demo-definitions.js';
import {
  createDemoHooks,
  getMissingRequiredNaps,
  getShellCapabilities,
  setDemoSessionRegistryRef,
} from './demo-hooks.js';
import { createMessageTap, type MessageTap } from './message-tap.js';
import { RESOURCE_DEMO_REMOTE_IMAGE_ORIGIN } from './main-preferences.js';

/**
 * Static per-dTag origin allowlist for the `connect-src` CSP injected into
 * srcdoc iframes (Task 4 static-allowlist). Only resource-demo needs a
 * non-empty allowlist; all other napplets get `connect-src 'none'`.
 */
const STATIC_ORIGIN_ALLOWLIST: ReadonlyMap<string, readonly string[]> = new Map([
  ['resource-demo', [RESOURCE_DEMO_REMOTE_IMAGE_ORIGIN]],
]);

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

export interface LoadedNappletIdentity {
  dTag: string;
  aggregateHash: string;
}

export interface LoadNappletOptions {
  /**
   * Hook invoked after the napplet is resolved and verified but before the
   * verified bytes are injected into the iframe. Receives the computed identity
   * for any pre-render setup the host requires.
   */
  beforeRender?: (identity: LoadedNappletIdentity) => void | Promise<void>;
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
        return windowId;
      }
    }
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
  // Resolve + verify content-addressed bytes: relays (NIP-65 outbox) → Blossom →
  // verify signature + aggregate + every blob. The gateway is never in the trust
  // path; identity (dTag, aggregateHash) is COMPUTED from the verified bytes.
  // Any verification failure throws here — no iframe is ever shown unverified.
  const resolved = await resolvePlaygroundNapplet({
    dTag: name,
    author: PLAYGROUND_MANIFEST_AUTHOR,
    relayDiscoveryUrl: playgroundPath('/napplet-relay/relay-list'),
    blossomServers: [playgroundPath('/napplet-blossom')],
  });

  const missingRequiredNaps = getMissingRequiredNaps(resolved.requires);
  if (missingRequiredNaps.length > 0) {
    throw new Error(
      `[demo] ${resolved.dTag} requires unsupported NAP capabilities: ${missingRequiredNaps.join(', ')}`,
    );
  }

  const { dTag, aggregateHash } = resolved;
  const windowId = `demo-${name}-${++nappletCounter}`;

  const iframe = document.createElement('iframe');
  iframe.id = windowId;
  iframe.className = 'w-full h-full border-0';
  iframe.sandbox.add('allow-scripts'); // scripts only — keep the iframe origin opaque

  const container = document.getElementById(containerId);
  if (container) container.appendChild(iframe);

  const info: NappletInfo = {
    windowId,
    name,
    iframe,
    dTag,
    aggregateHash,
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

  // NIP-5D session entry — registered immediately so storage.* and notify.* NAP
  // handlers can resolve the napplet's identity without any runtime negotiation.
  // dTag and aggregateHash are the COMPUTED identity from the verified manifest
  // bytes, never asserted by a gateway.
  function registerSessionEntry(): SessionEntry {
    const entry: SessionEntry = {
      pubkey: '',
      windowId,
      origin: 'null',
      type: 'napplet',
      dTag,
      aggregateHash,
      registeredAt: Date.now(),
      instanceId: crypto.randomUUID(),
      provenance: 'nip-5d',
    };
    relay.runtime.sessionRegistry.register(windowId, entry);
    return entry;
  }

  // Register origin immediately — contentWindow is available after appendChild.
  // This must happen before the hosted artifact bootstrap can send shell.ready.
  if (iframe.contentWindow) {
    originRegistry.register(iframe.contentWindow, windowId, { dTag, aggregateHash });
    markSourceDerivedIdentity(registerSessionEntry());
  }

  iframe.addEventListener('load', () => {
    if (iframe.contentWindow) {
      // Re-register the origin (idempotent) in case the contentWindow reference
      // changed during load. Only (re)create the session entry if it was not
      // already registered synchronously above — re-registering would mint a new
      // instanceId/registeredAt and reset per-window runtime state (e.g. the
      // firewall init-burst window), which can drop a napplet's first request
      // when it acts immediately after reaching "ready".
      originRegistry.register(iframe.contentWindow, windowId, { dTag, aggregateHash });
      if (!info.identityBound) markSourceDerivedIdentity(registerSessionEntry());
    }
  });

  // Optional pre-render hook runs against the computed identity before
  // the verified bytes are injected via srcdoc. The connect-src CSP <meta>
  // is built from the static per-dTag allowlist — the CSP travels inside
  // the document because srcdoc iframes have an opaque origin and no HTTP response.
  await options.beforeRender?.({ dTag, aggregateHash });
  const origins = STATIC_ORIGIN_ALLOWLIST.get(dTag) ?? [];
  const exposedDomains =
    getShellCapabilities()?.domains.filter((domain) => !domain.includes(':')) ?? [];
  iframe.srcdoc = injectNappletNamespacePrelude(
    injectCspMeta(resolved.indexHtml, origins),
    { domains: exposedDomains },
  );

  return info;
}

function playgroundPath(pathname: string): string {
  const cleanPath = pathname.replace(/^\/+/, '');
  const basePath = (import.meta.env.BASE_URL ?? '/').trim() || '/';
  if (basePath === './') return cleanPath;
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return `${normalizedBase}${cleanPath}`;
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
  const pubkey = info.pubkey ?? '';  // '' for NIP-5D, real pubkey for legacy
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
    relay.runtime.aclState.block(info.pubkey ?? '', info.dTag || '', info.aggregateHash || '');
  } else {
    relay.runtime.aclState.unblock(info.pubkey ?? '', info.dTag || '', info.aggregateHash || '');
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
        'config:read': hasCapability('config:read'),
        'resource:fetch': hasCapability('resource:fetch'),
        'cvm:call': hasCapability('cvm:call'),
        'keys:bind': hasCapability('keys:bind'),
        'keys:forward': hasCapability('keys:forward'),
        'media:control': hasCapability('media:control'),
        'notify:send': hasCapability('notify:send'),
        'notify:channel': hasCapability('notify:channel'),
        'theme:read': hasCapability('theme:read'),
        'outbox:read': hasCapability('outbox:read'),
        'outbox:write': hasCapability('outbox:write'),
        'upload:write': hasCapability('upload:write'),
        'intent:read': hasCapability('intent:read'),
        'intent:write': hasCapability('intent:write'),
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
