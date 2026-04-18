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
  type ShellAdapter,
  type ServiceHandler,
  type Capability,
  type NostrEvent,
  type ConsentRequest,
  type NappletMessage,
  type AclCheckEvent,
  type SessionEntry,
} from '@kehto/shell';
import {
  createIdentityService,
  createNotificationService,
  createKeysService,
  createMediaService,
  createThemeService,
} from '@kehto/services';
import type { Notification, ThemeService } from '@kehto/services';
import { getSigner, getSignerConnectionState } from './signer-connection.js';
import { demoConfig } from './demo-config.js';
import { pushAclEvent } from './acl-history.js';
import { createMockRelayPool } from './mock-relay-pool.js';

// Static ephemeral host identity for shell node display (separate from signer identity)
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
const _hostSecretKey = generateSecretKey();
const _hostPubkey = getPublicKey(_hostSecretKey);

// Inline a simplified message tap since we can't import from tests/helpers in apps/
// (they are not a published package)

export interface TappedMessage {
  index: number;
  timestamp: number;
  direction: 'napplet->shell' | 'shell->napplet';
  verb: string;                                          // 'EVENT'|'REQ'|...|'ENVELOPE'
  windowId?: string;
  raw: unknown[] | NappletMessage;
  envelope?: NappletMessage;                             // present when raw is a plain-object envelope
  envelopeType?: string;                                 // envelope.type for convenience
  parsed: {
    subId?: string;
    eventKind?: number;
    eventId?: string;
    topic?: string;
    success?: boolean;
    reason?: string;
    pubkey?: string;
    domain?: string;                                     // envelope.type.split('.')[0]
  };
}

export interface MessageTap {
  messages: TappedMessage[];
  recordOutbound(msg: unknown[], windowId?: string): void;
  recordOutboundEnvelope(envelope: NappletMessage, windowId?: string): void;    // NEW
  recordInboundEnvelope(envelope: NappletMessage, windowId?: string): void;     // NEW
  install(shellWindow: Window): void;
  onMessage(callback: (msg: TappedMessage) => void): () => void;
  filter(criteria: { verb?: string; direction?: string; envelopeType?: string }): TappedMessage[];
  clear(): void;
}

export interface DemoNappletDefinition {
  name: string;
  label: string;
  statusId: string;
  aclId: string;
  frameContainerId: string;
}

export type DemoProtocolPath =
  | 'auth'
  | 'relay-publish'
  | 'relay-subscribe'
  | 'ipc-send'
  | 'ipc-receive'
  | 'state-read'
  | 'state-write'
  | 'identity-request'
  | 'relay-publish-signed';

export interface DemoPathAuditEntry {
  path: DemoProtocolPath;
  capability: Capability | null;
  direction: 'host->runtime' | 'runtime->napplet' | 'napplet->runtime';
  explanation: string;
}

export type DemoSignerMode = 'service' | 'fallback';

export const DEMO_SIGNER_MODE: DemoSignerMode = 'service';

/** Services that expose NIP-5D envelopes but have no real host backend in v1.3. */
export const STUB_ONLY_SERVICES: readonly string[] = ['keys', 'media'] as const;

/** All 8 NIP-5D-adjacent topology node names the demo renders on boot. */
export const DEMO_TOPOLOGY_SERVICE_NAMES: readonly string[] = [
  'identity',
  'keys',
  'media',
  'notifications',
  'relay',
  'signer',
  'storage',
  'theme',
] as const;

export const DEMO_NAPPLETS: DemoNappletDefinition[] = [
  {
    name: 'chat',
    label: 'chat',
    statusId: 'chat-status',
    aclId: 'chat-acl',
    frameContainerId: 'chat-frame-container',
  },
  {
    name: 'bot',
    label: 'bot',
    statusId: 'bot-status',
    aclId: 'bot-acl',
    frameContainerId: 'bot-frame-container',
  },
  // Composer/preferences/toaster (Phase 19) — each napplet sets its own #*-status sentinel
  // INSIDE its iframe via D-04 init pattern; the outer topology placeholder shows 'loading...'
  // and is not updated by the host (no per-napplet AUTH projection in main.ts for the new 3).
  // Layer-B specs assert the INNER iframe status via frameLocator, not the outer placeholder.
  {
    name: 'composer',
    label: 'composer',
    statusId: 'composer-status',
    aclId: 'composer-acl',
    frameContainerId: 'composer-frame-container',
  },
  {
    name: 'preferences',
    label: 'preferences',
    statusId: 'preferences-status',
    aclId: 'preferences-acl',
    frameContainerId: 'preferences-frame-container',
  },
  {
    name: 'toaster',
    label: 'toaster',
    statusId: 'toaster-status',
    aclId: 'toaster-acl',
    frameContainerId: 'toaster-frame-container',
  },
  // Phase 20 (Plan 20-06): feed/profile-viewer/theme-switcher complete the 8-napplet showcase.
  // statusId values match the INNER iframe sentinel from each napplet's index.html.
  // The outer topology card shows 'loading...' until the inner iframe sets its own sentinel
  // via the D-04 init pattern; Layer-B specs assert via frameLocator (not outer placeholder).
  {
    name: 'feed',
    label: 'feed',
    statusId: 'feed-status',
    aclId: 'feed-acl',
    frameContainerId: 'feed-frame-container',
  },
  {
    name: 'profile-viewer',
    label: 'profile-viewer',
    statusId: 'profile-status',
    aclId: 'profile-viewer-acl',
    frameContainerId: 'profile-viewer-frame-container',
  },
  {
    name: 'theme-switcher',
    label: 'theme-switcher',
    statusId: 'theme-status',
    aclId: 'theme-switcher-acl',
    frameContainerId: 'theme-switcher-frame-container',
  },
];

export const DEMO_PROTOCOL_PATHS: DemoPathAuditEntry[] = [
  {
    path: 'auth',
    capability: null,
    direction: 'napplet->runtime',
    explanation: 'AUTH handshakes establish napplet identity before capability checks begin.',
  },
  {
    path: 'relay-publish',
    capability: 'relay:write',
    direction: 'napplet->runtime',
    explanation: 'Regular EVENT publishes go through relay write enforcement before they fan out.',
  },
  {
    path: 'relay-subscribe',
    capability: 'relay:read',
    direction: 'napplet->runtime',
    explanation: 'REQ and relay delivery both rely on relay read permission.',
  },
  {
    path: 'ipc-send',
    capability: 'relay:write',
    direction: 'napplet->runtime',
    explanation: 'Non-state ipc events reuse the relay write sender gate before delivery.',
  },
  {
    path: 'ipc-receive',
    capability: 'relay:read',
    direction: 'runtime->napplet',
    explanation: 'Recipients need relay read permission to receive non-state ipc events.',
  },
  {
    path: 'state-read',
    capability: 'state:read',
    direction: 'napplet->runtime',
    explanation: 'shell:state-get and shell:state-keys topics are routed as state reads.',
  },
  {
    path: 'state-write',
    capability: 'state:write',
    direction: 'napplet->runtime',
    explanation: 'shell:state-set, remove, and clear topics require state write permission.',
  },
  {
    path: 'identity-request',
    capability: 'identity:read',
    direction: 'napplet->runtime',
    explanation: 'identity.getPublicKey reads flow through ShellAdapter.auth.getSigner; the shell signs relay.publish envelopes internally, not via a separate signer service.',
  },
  {
    path: 'relay-publish-signed',
    capability: 'relay:write',
    direction: 'runtime->napplet',
    explanation: 'relay.publish envelopes are signed by the shell-internal signer before being handed to the relay pool; napplets never see the signing step.',
  },
];

export const DEMO_PROTOCOL_PATH_INDEX: Record<DemoProtocolPath, DemoPathAuditEntry> =
  Object.fromEntries(DEMO_PROTOCOL_PATHS.map((entry) => [entry.path, entry])) as Record<DemoProtocolPath, DemoPathAuditEntry>;

export function getDemoHostAuditSummary(): string {
  const auditedPaths = DEMO_PROTOCOL_PATHS
    .map((entry) => `${entry.path}:${entry.capability ?? 'none'}`)
    .join(', ');
  return `host ready -- signer mode: ${DEMO_SIGNER_MODE}; audited paths: ${auditedPaths}`;
}

// --- Message Tap (simplified from tests/helpers/message-tap.ts) ---

const KNOWN_VERBS = new Set([
  'EVENT', 'REQ', 'CLOSE', 'AUTH', 'OK', 'EOSE', 'NOTICE', 'CLOSED', 'COUNT',
]);

function parseMessage(raw: unknown[]): TappedMessage['parsed'] {
  const verb = raw[0] as string;
  const parsed: TappedMessage['parsed'] = {};
  switch (verb) {
    case 'EVENT': {
      if (raw.length === 2 && typeof raw[1] === 'object' && raw[1] !== null) {
        const ev = raw[1] as Record<string, unknown>;
        parsed.eventId = ev.id as string;
        parsed.eventKind = ev.kind as number;
        parsed.pubkey = ev.pubkey as string;
        const tags = (ev.tags as string[][] | undefined) ?? [];
        const t = tags.find(t => t[0] === 't');
        if (t) parsed.topic = t[1];
      } else if (raw.length === 3) {
        parsed.subId = raw[1] as string;
        const ev = raw[2] as Record<string, unknown>;
        parsed.eventId = ev.id as string;
        parsed.eventKind = ev.kind as number;
        parsed.pubkey = ev.pubkey as string;
        const tags = (ev.tags as string[][] | undefined) ?? [];
        const t = tags.find(t => t[0] === 't');
        if (t) parsed.topic = t[1];
      }
      break;
    }
    case 'REQ': parsed.subId = raw[1] as string; break;
    case 'CLOSE': parsed.subId = raw[1] as string; break;
    case 'AUTH': {
      if (typeof raw[1] === 'object' && raw[1] !== null) {
        const ev = raw[1] as Record<string, unknown>;
        parsed.eventId = ev.id as string;
        parsed.eventKind = ev.kind as number;
        parsed.pubkey = ev.pubkey as string;
      }
      break;
    }
    case 'OK': {
      parsed.eventId = raw[1] as string;
      parsed.success = raw[2] as boolean;
      parsed.reason = raw[3] as string;
      break;
    }
    case 'EOSE': parsed.subId = raw[1] as string; break;
    case 'NOTICE': parsed.reason = raw[1] as string; break;
    case 'CLOSED': {
      parsed.subId = raw[1] as string;
      parsed.reason = raw[2] as string;
      break;
    }
  }
  return parsed;
}

function parseEnvelope(envelope: NappletMessage): TappedMessage['parsed'] {
  const type = envelope.type;
  const domain = type.includes('.') ? type.split('.')[0] : type;
  const parsed: TappedMessage['parsed'] = { domain };
  // Lift common fields if present — tolerant of any payload shape.
  const env = envelope as unknown as Record<string, unknown>;
  if (typeof env.id === 'string') parsed.eventId = env.id;
  if (typeof env.subscriptionId === 'string') parsed.subId = env.subscriptionId;
  if (typeof env.error === 'string') parsed.reason = env.error;
  return parsed;
}

function createMessageTap(): MessageTap {
  const messages: TappedMessage[] = [];
  const listeners: Array<(msg: TappedMessage) => void> = [];
  let idx = 0;

  function record(
    direction: TappedMessage['direction'],
    raw: unknown[] | NappletMessage,
    windowId?: string,
  ): void {
    const isEnvelope =
      !Array.isArray(raw) &&
      typeof raw === 'object' &&
      raw !== null &&
      typeof (raw as NappletMessage).type === 'string';
    const envelope = isEnvelope ? (raw as NappletMessage) : undefined;
    const envelopeType = envelope?.type;
    const verb = envelope
      ? 'ENVELOPE'
      : Array.isArray(raw) && typeof raw[0] === 'string' && KNOWN_VERBS.has(raw[0] as string)
        ? (raw[0] as string)
        : 'UNKNOWN';
    const parsed = envelope ? parseEnvelope(envelope) : parseMessage(raw as unknown[]);
    const msg: TappedMessage = {
      index: idx++,
      timestamp: Date.now(),
      direction,
      verb,
      windowId,
      raw,
      envelope,
      envelopeType,
      parsed,
    };
    messages.push(msg);
    for (const cb of listeners) { try { cb(msg); } catch { /* ignore */ } }
  }

  return {
    messages,
    recordOutbound(msg: unknown[], windowId?: string) { if (Array.isArray(msg)) record('shell->napplet', msg, windowId); },
    recordOutboundEnvelope(envelope: NappletMessage, windowId?: string) {
      record('shell->napplet', envelope, windowId);
    },
    recordInboundEnvelope(envelope: NappletMessage, windowId?: string) {
      record('napplet->shell', envelope, windowId);
    },
    install(shellWindow: Window) {
      shellWindow.addEventListener('message', (event: MessageEvent) => {
        // Resolve windowId from event.source
        let wid: string | undefined;
        for (const [id, info] of napplets) {
          if (info.iframe?.contentWindow === event.source) { wid = id; break; }
        }
        if (Array.isArray(event.data)) {
          record('napplet->shell', event.data, wid);
        } else if (
          typeof event.data === 'object' &&
          event.data !== null &&
          typeof (event.data as NappletMessage).type === 'string'
        ) {
          record('napplet->shell', event.data as NappletMessage, wid);
        }
      }, true);
    },
    onMessage(callback) {
      listeners.push(callback);
      return () => {
        const i = listeners.indexOf(callback);
        if (i !== -1) listeners.splice(i, 1);
      };
    },
    filter(criteria) {
      return messages.filter(m => {
        if (criteria.verb && m.verb !== criteria.verb) return false;
        if (criteria.direction && m.direction !== criteria.direction) return false;
        if (criteria.envelopeType && m.envelopeType !== criteria.envelopeType) return false;
        return true;
      });
    },
    clear() { messages.length = 0; idx = 0; },
  };
}

// --- Mock ShellAdapter (simplified from tests/helpers/mock-hooks.ts) ---

/**
 * CONTEXT D-USER-01 (Phase 20): ShellAdapter.relayPool is backed by the in-memory
 * mock pool (apps/demo/src/mock-relay-pool.ts) rather than the old no-op stub. This
 * unblocks the feed napplet (NAP-06) — on relay.subscribe({kinds:[1]}) the pool
 * emits 5 fixture events then EOSE. relay.publish events are stored in-memory
 * only (no network traffic). Demo-only; not part of any @kehto/* package.
 */
function createDemoHooks(notificationOnChange?: (notifications: readonly Notification[]) => void): ShellAdapter {
  const notificationService = createNotificationService({
    onChange: notificationOnChange,
    maxPerWindow: 50,
  });
  const keysService = createKeysService({
    onForward: (event) => {
      // Stub: log to console for demo visibility; real hotkey wiring deferred to v1.4+
      console.debug('[demo] keys.forward (stub-only):', event.key, { ctrl: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, meta: event.metaKey });
    },
  });
  const mediaService = createMediaService({
    onSessionCreate: (windowId, sessionId, metadata) => {
      console.debug('[demo] media.session.create (stub-only):', windowId, sessionId, metadata);
    },
  });
  const themeServiceBundle = createThemeService({
    onBroadcast: (envelope) => {
      // Fan-out handled by shell-bridge.publishTheme() at the session-registry level.
      // This hook is diagnostic only.
      console.debug('[demo] theme.changed broadcast envelope:', envelope.type);
    },
  });
  _themeServiceBundle = themeServiceBundle;

  // ─── NAP-09 COVERAGE GATE (Phase 20) ──────────────────────────────────────
  // After Phase 20, the demo exercises 6 non-stub NUB domains end-to-end:
  //   identity (profile-viewer — Plan 20-03)
  //   ifc      (chat + bot — Phase 18)
  //   notify   (toaster — Phase 19)
  //   relay    (composer publish — Phase 19, feed subscribe — Plan 20-02)
  //   storage  (preferences — Phase 19)
  //   theme    (theme-switcher + preferences observer — Plans 20-04/05)
  //
  // keys and media remain stub-only (STUB_ONLY_SERVICES above). Real backends
  // are deferred to v1.4+ because:
  //   - keys requires a real host-side hotkey forwarding system (no reference
  //     implementation in @kehto/services; current createKeysService logs to
  //     console for topology visibility only)
  //   - media requires a real audio playback backend (no reference implementation;
  //     current createMediaService accepts session create/update/destroy calls
  //     for topology visibility only)
  // Corresponding napplets (hotkey-chord, media-controller) are in the v1.4+
  // backlog. Topology still renders keys + media nodes with a stub-only badge
  // so the 8-domain map remains visible to the demo audience.
  const services = {
    identity: createIdentityService({
      getSigner,
    }),
    notifications: notificationService,
    // Phase 19 (Plan 19-04): dual-register notification-service under 'notify' so the
    // runtime's serviceRegistry['notify'] lookup (packages/runtime/src/runtime.ts:1000)
    // routes notify.create / notify.list / notify.dismiss envelopes from the toaster
    // (Plan 19-03) to the same handler. The 'notifications' key stays for topology
    // display + host-originated wiring via notification-demo.ts. Both keys reference
    // the SAME handler instance — see <dual_registration_rationale> in 19-04-PLAN.md.
    notify: notificationService,
    keys: keysService,
    media: mediaService,
    theme: themeServiceBundle.handler,
  };
  // Expose the notification service handler so the controller can dispatch to it directly
  _notificationServiceHandler = notificationService;
  // Expose the identity service handler for host-side diagnostic probe flows
  _identityServiceHandler = services.identity;
  return {
    // CONTEXT D-USER-01 (Phase 20): in-memory mock relay pool holding 5 kind:1 fixture
    // events. On relay.subscribe({kinds:[1]}) emits matching events then EOSE; on
    // relay.publish stores the event in an in-memory array. Demo-only seam; no real
    // relay traffic. See apps/demo/src/mock-relay-pool.ts for the implementation.
    relayPool: createMockRelayPool(),
    relayConfig: {
      addRelay: () => {},
      removeRelay: () => {},
      getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }),
      getNip66Suggestions: () => null,
    },
    windowManager: { createWindow: () => null },
    auth: {
      getUserPubkey: () => getSignerConnectionState().pubkey ?? '',
      getSigner,
    },
    services,
    config: { getNappUpdateBehavior: () => 'auto-grant' },
    hotkeys: { executeHotkeyFromForward: () => {} },
    workerRelay: { getWorkerRelay: () => null },
    crypto: {
      verifyEvent: async (event: NostrEvent): Promise<boolean> => {
        const { verifyEvent } = await import('nostr-tools/pure');
        return verifyEvent(event as Parameters<typeof verifyEvent>[0]);
      },
      randomBytes: (length: number): Uint8Array => crypto.getRandomValues(new Uint8Array(length)),
      randomUUID: () => crypto.randomUUID(),
    },
    shellSecretPersistence: {
      get(): Uint8Array | null {
        try {
          const hex = localStorage.getItem('napplet-shell-secret');
          if (!hex) return null;
          const bytes = new Uint8Array(hex.length / 2);
          for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
          return bytes;
        } catch { return null; }
      },
      set(secret: Uint8Array): void {
        try {
          const hex = Array.from(secret).map(b => b.toString(16).padStart(2, '0')).join('');
          localStorage.setItem('napplet-shell-secret', hex);
        } catch { /* localStorage unavailable */ }
      },
    },
    guidPersistence: {
      get(windowId: string): string | null {
        try { return localStorage.getItem(`napplet-guid:${windowId}`); } catch { return null; }
      },
      set(windowId: string, guid: string): void {
        try { localStorage.setItem(`napplet-guid:${windowId}`, guid); } catch { /* best-effort */ }
      },
      remove(windowId: string): void {
        try { localStorage.removeItem(`napplet-guid:${windowId}`); } catch { /* best-effort */ }
      },
    },
    getConfigOverrides() {
      return {
        replayWindowSeconds: demoConfig.get('core.REPLAY_WINDOW_SECONDS'),
        ringBufferSize: demoConfig.get('runtime.RING_BUFFER_SIZE'),
      };
    },
    onAclCheck: (event) => {
      // Resolve windowId and name from pubkey
      let windowId = '';
      let nappletName = 'unknown';
      for (const [wid, info] of napplets) {
        if (info.pubkey === event.identity.pubkey) {
          windowId = wid;
          nappletName = info.name;
          break;
        }
      }
      if (windowId) {
        pushAclEvent(event, windowId, nappletName);
        _notifyAclCheckListeners(event, windowId, nappletName);
      }
    },
  };
}

// --- Proxy pattern (from harness.ts) ---

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
        const val = (target as unknown as Record<string | symbol, unknown>)[prop];
        return typeof val === 'function' ? (val as Function).bind(target) : val;
      } catch { return undefined; }
    },
  });
  proxyToReal.set(proxy, realWin);
  return proxy as unknown as Window;
}

// --- Napplet Frame Management ---

export interface NappletInfo {
  windowId: string;
  name: string;
  iframe: HTMLIFrameElement;
  pubkey?: string;
  dTag?: string;
  aggregateHash?: string;
  authenticated: boolean;
}

const napplets = new Map<string, NappletInfo>();
const demoServiceNames = new Set<string>(DEMO_TOPOLOGY_SERVICE_NAMES);
let nappletCounter = 0;

/** Permanent store of all service handler references — never deleted, used for re-registration on toggle-on. */
const serviceHandlerStore = new Map<string, ServiceHandler>();

/** Set of service names that are currently disabled (unregistered from runtime). */
const disabledServices = new Set<string>();

let _notificationServiceHandler: ServiceHandler | null = null;
let _themeServiceBundle: ThemeService | null = null;
let _identityServiceHandler: ServiceHandler | null = null;

/** Get the registered notification service handler for direct host dispatch. */
export function getNotificationServiceHandler(): ServiceHandler | null {
  return _notificationServiceHandler;
}

/** Get the registered theme service bundle (exposes .publishTheme for host theme toggles). */
export function getThemeServiceBundle(): ThemeService | null {
  return _themeServiceBundle;
}

/** Get the registered identity service handler for host-side probe flows. */
export function getIdentityServiceHandler(): ServiceHandler | null {
  return _identityServiceHandler;
}

// --- Public API ---

export let tap: MessageTap;
export let relay: ShellBridge;

export function getNapplets(): Map<string, NappletInfo> { return napplets; }
export function getNapplet(windowId: string): NappletInfo | undefined { return napplets.get(windowId); }
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

/**
 * Get the current signer connection state for topology rendering and UI.
 */
export function getDemoSignerState() {
  return getSignerConnectionState();
}

/**
 * Boot the shell: create ShellBridge, install tap, wire up proxy.
 *
 * @param notificationOnChange - Called when the notification service state changes.
 *   Used by the demo notification controller to update host-side toast/summary UX.
 */
export function bootShell(notificationOnChange?: (notifications: readonly Notification[]) => void): { tap: MessageTap; relay: ShellBridge } {
  const hooks = createDemoHooks(notificationOnChange);
  tap = createMessageTap();
  tap.install(window);

  // Wrap originRegistry for outbound capture (same pattern as harness.ts)
  const _origGetIframeWindow = originRegistry.getIframeWindow.bind(originRegistry);
  originRegistry.getIframeWindow = (windowId: string) => {
    const win = _origGetIframeWindow(windowId);
    if (!win) return null;
    return createPostMessageProxy(win, tap, windowId);
  };

  const _origGetWindowId = originRegistry.getWindowId.bind(originRegistry);
  originRegistry.getWindowId = (win: Window) => {
    const result = _origGetWindowId(win);
    if (result) return result;
    const real = proxyToReal.get(win);
    if (real) return _origGetWindowId(real);
    return undefined;
  };

  relay = createShellBridge(hooks);

  // Pre-populate serviceHandlerStore with adapter-provided services
  // (these bypass the registerService wrapper since they're passed via ShellAdapter.services)
  if (hooks.services) {
    for (const [name, handler] of Object.entries(hooks.services)) {
      serviceHandlerStore.set(name, handler);
    }
  }

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

  // Set consent handler for destructive kinds
  // In the demo, auto-approve after 500ms to show the flow
  relay.registerConsentHandler((request: ConsentRequest) => {
    setTimeout(() => request.resolve(true), 500);
  });

  // Wrap handleMessage for outbound capture (both array and envelope-shape messages)
  const _origHandle = relay.handleMessage;
  relay.handleMessage = (event: MessageEvent) => {
    const isArray = Array.isArray(event.data);
    const isEnvelope =
      !isArray &&
      typeof event.data === 'object' &&
      event.data !== null &&
      typeof (event.data as NappletMessage).type === 'string';

    if (!event.source || (!isArray && !isEnvelope)) {
      _origHandle(event);
      return;
    }
    const proxiedSource = createPostMessageProxy(event.source as Window, tap);
    const syntheticEvent = new Proxy(event, {
      get(target, prop) {
        if (prop === 'source') return proxiedSource;
        const val = (target as unknown as Record<string | symbol, unknown>)[prop];
        return typeof val === 'function' ? (val as Function).bind(target) : val;
      },
    });
    _origHandle(syntheticEvent);
  };

  window.addEventListener('message', relay.handleMessage);

  // Track AUTH completions — two paths:
  // Path A (legacy NIP-01 pubkey-based napplets): detect via NIP-01 OK success message.
  // Path B (NIP-5D napplets — composer/preferences/toaster): detect via first envelope
  //         from napplet→shell; session is pre-registered with pubkey='' and dTag=name.
  tap.onMessage((msg) => {
    if (msg.verb === 'OK' && msg.parsed.success === true && msg.direction === 'shell->napplet') {
      // Find which napplet this OK belongs to by checking sessionRegistry
      for (const [wid, info] of napplets) {
        if (!info.authenticated) {
          const pubkey = relay.runtime.sessionRegistry.getPubkey(wid);
          if (pubkey) {
            const entry = relay.runtime.sessionRegistry.getEntry(pubkey);
            if (entry) {
              info.authenticated = true;
              info.pubkey = entry.pubkey;
              info.dTag = entry.dTag;
              info.aggregateHash = entry.aggregateHash;
            }
          }
        }
      }
    }

    // Path B: NIP-5D envelope-only napplets (pre-registered with pubkey='').
    // When the first envelope arrives from a napplet, mark it authenticated and
    // populate dTag from the session registry entry (set by loadNapplet's pre-register).
    if (msg.verb === 'ENVELOPE' && msg.direction === 'napplet->shell' && msg.windowId) {
      const info = napplets.get(msg.windowId);
      if (info && !info.authenticated) {
        const entry = relay.runtime.sessionRegistry.getEntryByWindowId(msg.windowId);
        if (entry) {
          info.authenticated = true;
          // NIP-5D napplets: pubkey stays '' — ACL keyed on dTag:hash identity.
          info.pubkey = entry.pubkey;  // '' for NIP-5D pre-registered napplets
          info.dTag = entry.dTag;
          info.aggregateHash = entry.aggregateHash;
        }
      }
    }
  });

  // Make the tap accessible for host-originated envelope recording
  setMessageTap(tap);

  return { tap, relay };
}

/**
 * Load a demo napplet into a container element.
 */
export function loadNapplet(name: string, containerId: string): NappletInfo {
  const windowId = `demo-${name}-${++nappletCounter}`;
  const url = `/napplets/${name}/index.html`;

  const iframe = document.createElement('iframe');
  iframe.id = windowId;
  iframe.className = 'w-full h-full border-0';
  iframe.sandbox.add('allow-scripts');
  iframe.src = url;

  const container = document.getElementById(containerId);
  if (container) container.appendChild(iframe);

  // NIP-5D session entry — registered immediately so storage.* and notify.* NUB
  // handlers can resolve the napplet's identity without a legacy AUTH handshake.
  // dTag uses the napplet name; aggregateHash is empty (no manifest hash in demo).
  function registerSessionEntry(): void {
    const entry: SessionEntry = {
      pubkey: '',
      windowId,
      origin: 'null',
      type: 'napplet',
      dTag: name,
      aggregateHash: '',
      registeredAt: Date.now(),
      instanceId: crypto.randomUUID(),
      identitySource: 'source',
    };
    relay.runtime.sessionRegistry.register(windowId, entry);
  }

  // Register origin immediately — contentWindow is available after appendChild.
  // This must happen before the shim module runs (which sends REGISTER).
  if (iframe.contentWindow) {
    originRegistry.register(iframe.contentWindow, windowId);
    registerSessionEntry();
  }

  const info: NappletInfo = {
    windowId,
    name,
    iframe,
    authenticated: false,
  };
  napplets.set(windowId, info);

  iframe.addEventListener('load', () => {
    if (iframe.contentWindow) {
      // Re-register origin and session in case contentWindow reference changed during load.
      originRegistry.register(iframe.contentWindow, windowId);
      registerSessionEntry();
    }
  });

  return info;
}

/**
 * Grant or revoke a capability on a napplet.
 */
export function toggleCapability(windowId: string, capability: Capability, enabled: boolean): void {
  const info = napplets.get(windowId);
  if (!info) { console.warn('[acl] toggleCapability: no info for', windowId); return; }
  // NIP-5D napplets are pre-registered with pubkey=''; ACL is keyed on dTag:hash.
  // Traditional pubkey-based napplets have a non-empty pubkey from AUTH.
  // Both paths use the same aclState interface with pubkey ('' or real).
  if (!info.authenticated) {
    console.warn('[acl] toggleCapability: napplet not yet authenticated', windowId);
    return;
  }
  const pubkey = info.pubkey;  // '' for NIP-5D, real pubkey for legacy
  const dTag = info.dTag || '';
  const hash = info.aggregateHash || '';
  const pubkeyDisplay = pubkey ? pubkey.substring(0, 8) + '...' : '(nip5d-empty)';
  console.log(`[acl] ${enabled ? 'GRANT' : 'REVOKE'} ${capability} for ${info.name} (pubkey=${pubkeyDisplay} dTag=${dTag} hash=${hash})`);
  if (enabled) {
    relay.runtime.aclState.grant(pubkey, dTag, hash, capability);
  } else {
    relay.runtime.aclState.revoke(pubkey, dTag, hash, capability);
  }
  // Verify the change took effect
  const check = relay.runtime.aclState.check(pubkey, dTag, hash, capability);
  console.log(`[acl] check ${capability} after ${enabled ? 'grant' : 'revoke'}: ${check}`);
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
    console.log(`[service] ENABLED ${name}`);
  } else {
    disabledServices.add(name);
    relay.runtime.unregisterService(name);
    console.log(`[service] DISABLED ${name}`);
  }
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
  if (!info?.authenticated) return;
  // NIP-5D napplets have pubkey='' — ACL is keyed on dTag:hash; pass pubkey as-is.
  if (blocked) {
    relay.runtime.aclState.block(info.pubkey, info.dTag || '', info.aggregateHash || '');
  } else {
    relay.runtime.aclState.unblock(info.pubkey, info.dTag || '', info.aggregateHash || '');
  }
}

// ─── DemoAclAdapter (DEMO-03 seam) ──────────────────────────────────────────
// All UI grant/revoke/block/unblock flows go through this adapter. Keeps
// a single seam for future ShellAdapter.acl hook consolidation.

export interface DemoAclAdapter {
  /** Grant a capability on a napplet by windowId. */
  grant(windowId: string, capability: Capability): void;
  /** Revoke a capability on a napplet by windowId. */
  revoke(windowId: string, capability: Capability): void;
  /** Block a napplet by windowId. */
  block(windowId: string): void;
  /** Unblock a napplet by windowId. */
  unblock(windowId: string): void;
  /** Snapshot of all ACL entries for napplets currently authenticated. */
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

/** Internal hook called from createDemoHooks().onAclCheck — fans out to subscribers. */
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
      if (!info.pubkey) continue;
      const pk = info.pubkey;
      const dTag = info.dTag ?? '';
      const hash = info.aggregateHash ?? '';
      const entry = relay.runtime.aclState.getEntry(pk, dTag, hash);
      const caps: Record<Capability, boolean> = {
        'relay:read': relay.runtime.aclState.check(pk, dTag, hash, 'relay:read'),
        'relay:write': relay.runtime.aclState.check(pk, dTag, hash, 'relay:write'),
        'cache:read': relay.runtime.aclState.check(pk, dTag, hash, 'cache:read'),
        'cache:write': relay.runtime.aclState.check(pk, dTag, hash, 'cache:write'),
        'hotkey:forward': relay.runtime.aclState.check(pk, dTag, hash, 'hotkey:forward'),
        'state:read': relay.runtime.aclState.check(pk, dTag, hash, 'state:read'),
        'state:write': relay.runtime.aclState.check(pk, dTag, hash, 'state:write'),
        'identity:read': relay.runtime.aclState.check(pk, dTag, hash, 'identity:read'),
        'keys:bind': relay.runtime.aclState.check(pk, dTag, hash, 'keys:bind'),
        'keys:forward': relay.runtime.aclState.check(pk, dTag, hash, 'keys:forward'),
        'media:control': relay.runtime.aclState.check(pk, dTag, hash, 'media:control'),
        'notify:send': relay.runtime.aclState.check(pk, dTag, hash, 'notify:send'),
        'notify:channel': relay.runtime.aclState.check(pk, dTag, hash, 'notify:channel'),
        'theme:read': relay.runtime.aclState.check(pk, dTag, hash, 'theme:read'),
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
    if (!info?.pubkey) return false;
    return relay.runtime.aclState.check(info.pubkey, info.dTag ?? '', info.aggregateHash ?? '', capability);
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

// ─── Message Tap Accessor (for host-originated envelope recording) ────────────

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

