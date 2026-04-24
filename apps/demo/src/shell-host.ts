/**
 * shell-host.ts -- Demo shell host.
 *
 * Boots @napplet/shell with mock hooks, installs message tap,
 * loads demo napplet iframes, and exposes control APIs for the UI.
 */

import {
  createShellBridge,
  originRegistry,
  connectStore,
  type ShellBridge,
  type ShellAdapter,
  type ServiceHandler,
  type Capability,
  type NappletClass,
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
  createConfigService,  // Phase 39 Plan 39-04 / CONFIG-03
  createResourceService, // Phase 40 Plan 40-02 / RESOURCE-04
} from '@kehto/services';
import type { Notification, ThemeService, ConfigService } from '@kehto/services';
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

/**
 * Services that still expose NIP-5D envelopes with stub-only backends.
 *
 * Phase 26 (KEYS-01) promoted `keys` to a real document-level chord listener.
 * Phase 27 (MEDIA-01) promoted `media` to a real navigator.mediaSession mirror.
 * The stub-only era ends here — all 8 non-stub NUB domains are now exercised
 * end-to-end in the v1.4 demo.
 */
export const STUB_ONLY_SERVICES: readonly string[] = [] as const;

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
  // Phase 26 (Plan 26-03): hotkey-chord napplet exercises the real keys backend
  // (KEYS-01 document-level chord listener + keys.action push + KEYS-02
  // HostKeysBridge interface). topology.ts:466 dynamically renders
  // #hotkey-chord-frame-container from this entry — no apps/demo/index.html
  // edit required. statusId matches the INNER iframe sentinel from
  // napplets/hotkey-chord/index.html; Layer-B spec (26-04) asserts via
  // frameLocator, not the outer placeholder.
  {
    name: 'hotkey-chord',
    label: 'hotkey-chord',
    statusId: 'hotkey-chord-status',
    aclId: 'hotkey-chord-acl',
    frameContainerId: 'hotkey-chord-frame-container',
  },
  // Phase 27 (Plan 27-03): media-controller napplet exercises the real media
  // backend (MEDIA-01 navigator.mediaSession mirror + MEDIA-02 HostMediaBridge
  // interface). topology.ts dynamically renders #media-controller-frame-container
  // from this entry — no apps/demo/index.html edit required (Plan 26-03 precedent).
  // statusId matches the INNER iframe sentinel from napplets/media-controller/index.html;
  // Layer-B spec (27-04) asserts via frameLocator, not the outer placeholder.
  {
    name: 'media-controller',
    label: 'media-controller',
    statusId: 'media-controller-status',
    aclId: 'media-controller-acl',
    frameContainerId: 'media-controller-frame-container',
  },
  // Phase 39 (Plan 39-04 / CONFIG-03): config-demo napplet exercises the
  // NUB-CONFIG reference service (9th NUB domain). sdk.config.get + sdk.config.subscribe
  // against createConfigService registered in createDemoHooks. statusId matches the INNER
  // iframe sentinel from napplets/config-demo/index.html; Plan 39-05's nub-config.spec.ts
  // asserts via frameLocator on #config-demo-values, not the outer placeholder.
  {
    name: 'config-demo',
    label: 'config-demo',
    statusId: 'config-demo-status',
    aclId: 'config-demo-acl',
    frameContainerId: 'config-demo-frame-container',
  },
  // Phase 40 (Plan 40-02 / RESOURCE-04): resource-demo napplet exercises the
  // NUB-RESOURCE reference service (10th NUB domain). Two resource.bytes
  // dispatches on init: one to http://localhost:5174/demo-data.json
  // (granted at boot via __grantConnectOrigin__ — D3) and one to
  // https://untrusted.example (denied, D4). Plan 40-03's nub-resource.spec.ts
  // asserts the granted panel (decoded JSON) + denied panel (canonical
  // error code) via frameLocator on the iframe sentinels.
  {
    name: 'resource-demo',
    label: 'resource-demo',
    statusId: 'resource-demo-status',
    aclId: 'resource-demo-acl',
    frameContainerId: 'resource-demo-frame-container',
  },
];

/**
 * Per-napplet class posture assignment (CLASS-04, v1.7 Phase 38, D3).
 *
 * Adjacent to DEMO_NAPPLETS — every entry in DEMO_NAPPLETS MUST have a
 * corresponding entry here. The module-load assertion below (D4, H-05
 * prevention) enforces this: adding a napplet to DEMO_NAPPLETS without
 * updating CLASS_BY_DTAG throws at import time, breaking `pnpm build`.
 *
 * All 11 v1.7-era demo napplets default to `null` (permissive) so no existing
 * E2E spec regresses (D2). The cross-NUB invariant spec
 * (tests/e2e/class-invariant.spec.ts) uses `window.__setNappletClass__` to
 * temporarily assign 'class-2' to theme-switcher for the test window — no
 * real restrictive policy lives in this map.
 */
export const CLASS_BY_DTAG: ReadonlyMap<string, NappletClass> = new Map<string, NappletClass>([
  ['chat', null],
  ['bot', null],
  ['composer', null],
  ['preferences', null],
  ['toaster', null],
  ['feed', null],
  ['profile-viewer', null],
  ['theme-switcher', null],
  ['hotkey-chord', null],
  ['media-controller', null],
  // Phase 39 (CONFIG-03): config-demo permissive by default (no class restriction).
  ['config-demo', null],
  // Phase 40 (RESOURCE-04): resource-demo permissive by default (no class restriction).
  ['resource-demo', null],
]);

// ─── D4 / H-05 module-load assertion ─────────────────────────────────────────
// Every DEMO_NAPPLETS entry must have a corresponding CLASS_BY_DTAG entry.
// Adding a napplet to DEMO_NAPPLETS without updating CLASS_BY_DTAG throws
// at import time — breaks `pnpm build` before any runtime observes drift.
{
  const _missingClassEntries = DEMO_NAPPLETS
    .map((d) => d.name)
    .filter((name) => !CLASS_BY_DTAG.has(name));
  if (_missingClassEntries.length > 0) {
    throw new Error(
      `[CLASS-04 / H-05] CLASS_BY_DTAG is missing entries for DEMO_NAPPLETS: ${_missingClassEntries.join(', ')}. ` +
      `Add each missing entry with an explicit class assignment (use null for the permissive default).`
    );
  }
}

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
  // Plan 26-03 (KEYS-03): real keys backend wired. The onForward callback
  // records each chord delivery via the demo's console + diagnostic log (host-side
  // evidence of real delivery). The service itself attaches a document-level keydown
  // listener AND emits keys.action pushes to the owning napplet (Plan 26-01); the
  // keys-forwarder.ts path (ACL-gated iframe broadcast of keys.forward) is unchanged
  // and remains authoritative for shell → napplet fan-out.
  //
  // Phase 33 / KEYS-04..06 (E2E-17): the demo reserves `Ctrl+Shift+R` so the
  // Layer-B Playwright spec (`tests/e2e/reserved-chord.spec.ts`) can assert the
  // reserved > registered precedence contract end-to-end. The hotkey-chord napplet
  // registers `Ctrl+Shift+K` via `keys.registerAction`
  // (apps/demo/napplets/hotkey-chord/src/main.ts:25) — disjoint from the reserved
  // set, so the existing hotkey-chord E2E (E2E-12) is unaffected. The shell-side
  // sentinel `#reserved-chord-last-fired` is updated on every onForward fire so
  // the E2E can observe forward delivery without needing a frameLocator round-trip.
  const keysService = createKeysService({
    reservedChords: ['Ctrl+Shift+R'],
    onForward: (event) => {
      console.info(
        '[demo] keys real backend — chord delivered:',
        event.key,
        { ctrl: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, meta: event.metaKey },
      );
      // Phase 33: shell-side DOM sentinel for E2E-17 observation. Writes the
      // canonical chord string (modifiers + key) so the spec can assert on
      // exact match. Updated on every onForward fire (reserved AND non-reserved
      // keydowns that match a registered chord both pass through here — the
      // spec asserts the reserved chord specifically so the value MUST be
      // 'Ctrl+Shift+R' after page.keyboard.press('Control+Shift+KeyR')).
      const sentinel = document.getElementById('reserved-chord-last-fired');
      if (sentinel) {
        const parts: string[] = [];
        if (event.ctrlKey) parts.push('Ctrl');
        if (event.altKey) parts.push('Alt');
        if (event.shiftKey) parts.push('Shift');
        if (event.metaKey) parts.push('Meta');
        parts.push(event.key.length === 1 ? event.key.toUpperCase() : event.key);
        sentinel.textContent = parts.join('+');
      }
    },
  });
  // Plan 27-03 (MEDIA-03): real media backend wired. The onSessionCreate callback
  // indicates real-backend status; the service itself installs navigator.mediaSession
  // action handlers and mirrors metadata/playbackState (Plan 27-01) via the default
  // createBrowserMediaBridge (Plan 27-02). Host apps that want native OS-level
  // transport surfaces can pass a custom hostBridge: HostMediaBridge override.
  const mediaService = createMediaService({
    onSessionCreate: (windowId, sessionId, metadata) => {
      console.info(
        '[demo] media real backend — session created:',
        windowId,
        sessionId,
        metadata,
      );
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

  // ─── COVERAGE GATE (Phase 20 → Phase 26 → Phase 27) ──────────────────────
  // Post-Phase-27, the demo exercises ALL 8 non-stub NUB domains end-to-end:
  //   identity (profile-viewer — Plan 20-03)
  //   ifc      (chat + bot — Phase 18)
  //   notify   (toaster — Phase 19)
  //   relay    (composer publish — Phase 19, feed subscribe — Plan 20-02)
  //   storage  (preferences — Phase 19)
  //   theme    (theme-switcher + preferences observer — Plans 20-04/05)
  //   keys     (hotkey-chord — Plan 26-03; document-level chord listener +
  //             keys.action push via SDK keys.onAction, per Plan 26-01 +
  //             HostKeysBridge contract from Plan 26-02)
  //   media    (media-controller — Plan 27-03; navigator.mediaSession mirror +
  //             media.command push via nub-media mediaOnCommand, per Plan 27-01 +
  //             HostMediaBridge contract from Plan 27-02)
  //
  // STUB_ONLY_SERVICES is now `[]` — the stub-only era ends here. The v1.4 demo
  // is a 10-napplet showcase (8 from v1.3 + hotkey-chord from Phase 26 +
  // media-controller from Phase 27).
  // Phase 39 (CONFIG-03): NUB-CONFIG reference service. Reads values from the
  // mutable demoConfigFixtures module-level object (D11); publishValues is
  // called from setDemoConfigValue when the shell UI button fires.
  const configServiceBundle = createConfigService({
    getValues: () => ({ ...demoConfigFixtures }),
  });
  _configServiceBundle = configServiceBundle;

  // ─── Phase 40 Plan 40-02 (RESOURCE-04): NUB-RESOURCE reference service ───
  // Shell acts as authenticated fetch proxy for the 10th NUB domain.
  //
  // Host `fetch` = native browser fetch + AbortController + 10s timeout (D5).
  // Composites two abort signals: the request-scoped signal and a 10s timeout,
  // whichever fires first aborts the fetch and returns a canonical error code.
  //
  // resolveIdentity uses the module-level _sessionRegistryRef which is
  // populated in bootShell() immediately after createShellBridge(). The first
  // resource.bytes dispatch cannot arrive until AFTER bootShell() returns and
  // the napplet iframe fully loads and authenticates — so the ref is always
  // assigned before any real lookup occurs.
  //
  // H-03 guard (Wave 1): all 4 options are required; factory throws at
  // construction if any is missing.
  async function hostFetch(
    url: string,
    init: { method?: string; headers?: Record<string, string>; signal: AbortSignal },
  ): Promise<Response> {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 10_000);
    // Compose: forward both abort signals into fetch.
    const composite = new AbortController();
    for (const src of [init.signal, timeoutController.signal]) {
      src.addEventListener('abort', () => composite.abort(), { once: true });
    }
    try {
      return await fetch(url, { method: init.method, headers: init.headers, signal: composite.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const resourceHandler = createResourceService({
    fetch: hostFetch,
    isOriginGranted: (origin, grants) => grants.includes(origin),
    getConnectGrants: (dTag, aggregateHash) => connectStore.getOrigins(dTag, aggregateHash),
    resolveIdentity: (windowId) => {
      const entry = _sessionRegistryRef?.getEntryByWindowId(windowId);
      return entry ? { dTag: entry.dTag, aggregateHash: entry.aggregateHash } : null;
    },
  });

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
    config: configServiceBundle.handler,  // Phase 39 (CONFIG-03): NUB-CONFIG reference service
    resource: resourceHandler,            // Phase 40 (RESOURCE-04): NUB-RESOURCE reference service
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
      // Plan 38-03 (E2E-20): push ACL events to window.__aclEvents__ for
      // the class-invariant spec to observe class-forbidden denials.
      if (typeof window !== 'undefined') {
        const w = window as Window & { __aclEvents__?: Array<unknown> };
        w.__aclEvents__ ??= [];
        w.__aclEvents__.push({ ...event });  // shallow-copy to avoid mutation
      }
      // Resolve windowId and name from pubkey (or dTag for NIP-5D napplets)
      let windowId = '';
      let nappletName = 'unknown';
      for (const [wid, info] of napplets) {
        // Path A: legacy pubkey-based napplets
        if (info.pubkey && info.pubkey === event.identity.pubkey) {
          windowId = wid;
          nappletName = info.name;
          break;
        }
        // Path B: NIP-5D napplets with empty pubkey — match by dTag
        if (!event.identity.pubkey && info.dTag === event.identity.dTag) {
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

/** Phase 39 Plan 39-04 — shell-side config fixture (D11). Mutable; setDemoConfigValue publishes changes. */
const demoConfigFixtures: Record<string, unknown> = {
  theme: 'dark',
  density: 'compact',
  'notifications-enabled': true,
  recentSearches: [],
};

let _configServiceBundle: ConfigService | null = null;

/**
 * Phase 40 Plan 40-02 (RESOURCE-04): deferred session registry ref.
 *
 * createResourceService() is constructed inside createDemoHooks() (before
 * bootShell() creates relay). The resolveIdentity option must look up
 * sessionRegistry.getEntryByWindowId, which is only available after
 * relay = createShellBridge(hooks). This ref is populated in bootShell()
 * immediately after createShellBridge — before any napplet iframe loads.
 *
 * Timing safety: the first resource.bytes dispatch cannot arrive until the
 * napplet iframe loads AND authenticates AND dispatches, which is strictly
 * after bootShell() returns. The assignment window is safe.
 */
let _sessionRegistryRef: {
  getEntryByWindowId(windowId: string): SessionEntry | undefined;
} | null = null;

/** Phase 39 Plan 39-04 — access the registered config service bundle for publishValues. */
export function getConfigServiceBundle(): ConfigService | null {
  return _configServiceBundle;
}

/**
 * Phase 39 Plan 39-04 (D11) — mutator used by the shell UI "toggle config"
 * button. Updates the fixture object IN PLACE and pushes a new config.values
 * envelope to every subscribed napplet via configServiceBundle.publishValues.
 */
export function setDemoConfigValue(key: string, value: unknown): void {
  demoConfigFixtures[key] = value;
  _configServiceBundle?.publishValues({ ...demoConfigFixtures });
}

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

/**
 * Look up the windowId for a napplet by its dTag (DEMO_NAPPLETS entry `name`).
 * Returns null if the napplet is not yet loaded or not yet authenticated.
 *
 * Exposed for apps/demo/src/main.ts __setNappletClass__ test hook (D9).
 * Callers MUST NOT mutate napplet state through this helper — read-only lookup only.
 */
export function findAuthenticatedNappletWindowIdByDTag(dTag: string): string | null {
  for (const [windowId, info] of napplets.entries()) {
    if (info.name === dTag && info.authenticated) {
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

  // Phase 40 Plan 40-02 (RESOURCE-04): populate the deferred session registry ref
  // so createResourceService's resolveIdentity closure can look up windowId → dTag.
  // Assigned here (after createShellBridge) because sessionRegistry lives inside the
  // runtime closure created by createShellBridge. The napplet iframes do not load
  // until after bootShell returns, so the ref is always assigned before first use.
  _sessionRegistryRef = relay.runtime.sessionRegistry;

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

  // Phase 39 Plan 39-04: consent handler is registered in apps/demo/src/main.ts
  // via createConsentModal().registerWith(relay, fallthroughHandler). The prior
  // setTimeout(500) auto-approve for destructive-signing is preserved as the
  // fallthrough parameter. Centralizing the registration avoids the runtime.ts
  // overwrite behavior (a single _consentHandler is stored, last-write-wins).
  // DO NOT register a consent handler here.

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

  // ─── Plan 26-03 (KEYS-03): __grantKeysForward__ host hook ────────────────
  // Plan 26-04's Playwright spec (E2E-12) must grant the `keys:forward`
  // capability to the hotkey-chord napplet before dispatching Ctrl+Shift+K —
  // otherwise keys-forwarder.ts gates the outbound envelope per ACL. Rather
  // than auto-granting on boot (which would leak demo-scoped policy into a
  // test-only mechanism), we expose a single, hotkey-chord-scoped grant hook.
  //
  // Usage (from tests/e2e/hotkey-chord.spec.ts):
  //   await page.evaluate(() => window.__grantKeysForward__?.());
  //
  // Returns true on success, false if the hotkey-chord napplet is not yet
  // loaded or not yet authenticated (callers may retry if needed; the spec
  // gates on the #hotkey-chord-status = 'subscribed' sentinel before calling,
  // which implies the napplet is authenticated and ready to receive grants).
  (window as Window & { __grantKeysForward__?: () => boolean }).__grantKeysForward__ = (): boolean => {
    let hotkeyEntry: { windowId: string; info: NappletInfo } | null = null;
    for (const [windowId, info] of napplets.entries()) {
      if (info.name === 'hotkey-chord') {
        hotkeyEntry = { windowId, info };
        break;
      }
    }
    if (!hotkeyEntry) {
      console.warn('[demo] __grantKeysForward__: hotkey-chord napplet not loaded yet');
      return false;
    }
    if (!hotkeyEntry.info.authenticated) {
      console.warn('[demo] __grantKeysForward__: hotkey-chord not yet authenticated');
      return false;
    }
    const pubkey = hotkeyEntry.info.pubkey ?? '';        // '' for NIP-5D napplets, same as toggleCapability
    const dTag = hotkeyEntry.info.dTag ?? '';
    const hash = hotkeyEntry.info.aggregateHash ?? '';
    relay.runtime.aclState.grant(pubkey, dTag, hash, 'keys:forward');
    console.info('[demo] __grantKeysForward__: granted keys:forward to hotkey-chord');
    return true;
  };

  // ─── Plan 27-03 (MEDIA-03): __grantMediaControl__ host hook ──────────────
  // Plan 27-04's Playwright spec (E2E-13) must grant the `media:control`
  // capability to the media-controller napplet before asserting play/pause
  // state transitions. Mirrors the __grantKeysForward__ pattern from
  // Plan 26-03 exactly: single-napplet-scoped grant hook that returns true
  // on success, false when napplet not yet loaded / not yet authenticated.
  //
  // Usage (from tests/e2e/media-controller.spec.ts):
  //   await page.evaluate(() => window.__grantMediaControl__?.());
  //
  // Returns true on success, false if the media-controller napplet is not yet
  // loaded or not yet authenticated (callers may retry if needed; the spec
  // gates on the #media-controller-status = 'session-ready' sentinel before
  // calling, which implies the napplet is authenticated and ready to receive
  // grants).
  (window as Window & { __grantMediaControl__?: () => boolean }).__grantMediaControl__ = (): boolean => {
    let mediaEntry: { windowId: string; info: NappletInfo } | null = null;
    for (const [windowId, info] of napplets.entries()) {
      if (info.name === 'media-controller') {
        mediaEntry = { windowId, info };
        break;
      }
    }
    if (!mediaEntry) {
      console.warn('[demo] __grantMediaControl__: media-controller napplet not loaded yet');
      return false;
    }
    if (!mediaEntry.info.authenticated) {
      console.warn('[demo] __grantMediaControl__: media-controller not yet authenticated');
      return false;
    }
    const pubkey = mediaEntry.info.pubkey ?? '';        // '' for NIP-5D napplets, same as toggleCapability
    const dTag = mediaEntry.info.dTag ?? '';
    const hash = mediaEntry.info.aggregateHash ?? '';
    relay.runtime.aclState.grant(pubkey, dTag, hash, 'media:control');
    console.info('[demo] __grantMediaControl__: granted media:control to media-controller');
    return true;
  };

  // ─── Phase 33 (E2E-17): shell-side sentinel for reserved-chord observation ──
  // Creates a small diagnostic element the Playwright spec asserts against
  // after pressing the reserved chord (Ctrl+Shift+R). Rendered once per demo
  // boot; attached to document.body so the spec can read it without frameLocator
  // traversal. Initial text is the empty string — the onForward callback
  // (declared above in createKeysService) overwrites it on the first chord
  // delivery, writing the canonical chord string (e.g. 'Ctrl+Shift+R').
  const reservedChordSentinel = document.createElement('div');
  reservedChordSentinel.id = 'reserved-chord-last-fired';
  reservedChordSentinel.setAttribute('data-testid', 'reserved-chord-last-fired');
  reservedChordSentinel.style.cssText = [
    'position: fixed',
    'bottom: 4px',
    'right: 4px',
    'padding: 2px 8px',
    'font: 11px/1.4 monospace',
    'color: #888',
    'background: rgba(0,0,0,0.4)',
    'border-radius: 3px',
    'z-index: 9999',
    'pointer-events: none',
  ].join('; ');
  reservedChordSentinel.textContent = '';
  document.body.appendChild(reservedChordSentinel);

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
      // CLASS-04 (Plan 38-03): data-driven class from CLASS_BY_DTAG map (D3).
      // Defaults to null (permissive, D2) if the dTag has no explicit entry —
      // defensive fallback; the module-load assertion above guarantees every
      // DEMO_NAPPLETS name has an entry, so the ?? null is defensive only.
      class: CLASS_BY_DTAG.get(name) ?? null,
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
      // Accept both Path A (NIP-01, pubkey populated) and Path B (NIP-5D,
      // authenticated via dTag with empty pubkey). aclState.check() handles
      // the empty-pubkey + dTag-keyed lookup path correctly (v1.2 canonical),
      // so no changes are required to the check calls below.
      if (!info.authenticated) continue;
      const pk = info.pubkey ?? '';
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

