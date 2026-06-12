import 'virtual:uno.css';
import {
  bootShell,
  DEMO_NAPPLETS,
  getDemoHostAuditSummary,
  getDemoHostPubkey,
  getDemoTopologyInputs,
  getDemoServiceNames,
  getNapplets,
  loadNapplet,
  getNotificationServiceHandler,
  getThemeServiceBundle,
  findIdentityBoundNappletWindowIdByDTag,
  relay,
  toggleService,
  setDemoConfigValue,
  getPlaygroundRelayActivity,
  publishDecryptFixturesToNapplet,
  getDemoDecryptBridgeCallCount,
  resetDemoDecryptBridgeCallCount,
  type GatewayNappletMetadata,
  isServiceEnabled,
} from './shell-host.js';
import { connectStore, type Capability, type NappletClass } from '@kehto/shell';
import { createConsentModal } from './consent-modal.js';
import { classifyTappedMessagePath, type NappletDebugger } from './debugger.js';
import {
  areAllAclPanelsExpanded,
  renderAclPanels,
  setAllAclPanelsExpanded,
  setDebugger,
} from './acl-panel.js';
import { initFlowAnimator } from './flow-animator.js';
import { cancelAllTraceAnimations } from './trace-animator.js';
import {
  initColorState,
  onColorStateChange,
  getNodeInboundColor,
  getNodeOutboundColor,
  setPersistenceMode,
  getPersistenceMode,
  clearAllNodeOverlays,
  type PersistenceMode,
} from './color-state.js';
import {
  buildDemoTopology,
  renderDemoTopology,
  initTopologyEdges,
  wireServiceToggles,
  updateServiceNodeVisual,
} from './topology.js';
import {
  buildAllNodeDetails,
  installActivityProjection,
} from './node-details.js';
import { initNodeInspector, openConstantsTab, setSelectedNodeId } from './node-inspector.js';
import { replaceChildrenFromTrustedHtml } from './dom-utils.js';
import { recordSignerRequest, getSignerConnectionState } from './signer-connection.js';
import { createNotificationUi, initRelayActivityPanel } from './main-notifications.js';
import { initSignerNodeUi } from './main-signer.js';
import { demoConfig } from './demo-config.js';
import { setAclRingSize } from './acl-history.js';
import { applyNapTheme } from './theme.js';

const STATIC_PAGES_BASE_PATH = '/web/playground/';
const isStaticPagesDemo = import.meta.env.BASE_URL === STATIC_PAGES_BASE_PATH;
const NAPPLET_HEIGHT_STORAGE_KEY = 'kehto.playground.nappletHeightPx';
const DEBUGGER_HIDDEN_STORAGE_KEY = 'kehto.playground.debuggerHidden';
const COLOR_MODE_STORAGE_KEY = 'kehto.playground.colorMode';
const THEME_STORAGE_KEY = 'kehto.playground.theme.v1';
const DEFAULT_NAPPLET_HEIGHT_PX = 330;
const MIN_NAPPLET_HEIGHT_PX = 220;
const MAX_NAPPLET_HEIGHT_PX = 720;
const COLOR_MODES: readonly PersistenceMode[] = ['flash', 'rolling', 'decay', 'last-message', 'trace'];
const RESOURCE_DEMO_REMOTE_IMAGE_ORIGIN = 'https://raw.githubusercontent.com';

type PlaygroundTheme = {
  title: string;
  colors: {
    background: string;
    text: string;
    primary: string;
  };
};

const DEFAULT_THEME: PlaygroundTheme = {
  title: 'Dark',
  colors: {
    background: '#0a0a0a',
    text: '#e0e0e0',
    primary: '#7aa2f7',
  },
};

if (isStaticPagesDemo) {
  document.getElementById('static-demo-banner')?.removeAttribute('hidden');
}

const notificationUi = createNotificationUi();
let currentTheme = readStoredTheme();

function broadcastCurrentTheme(): void {
  if (!relay) return;
  relay.publishTheme(currentTheme as Parameters<typeof relay.publishTheme>[0]);
  for (const napplet of getNapplets().values()) {
    napplet.iframe.contentWindow?.postMessage({ type: 'theme.changed', theme: currentTheme }, '*');
  }
}

applySelectedTheme(currentTheme, false);

function readStoredNumber(key: string, fallback: number): number {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    const value = Number.parseInt(stored, 10);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in hardened contexts; keep the current session usable.
  }
}

function readStoredJson<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored) as T;
  } catch {
    return null;
  }
}

function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    return stored === 'true';
  } catch {
    return fallback;
  }
}

function isPersistenceMode(value: string | null): value is PersistenceMode {
  return COLOR_MODES.includes(value as PersistenceMode);
}

function readStoredColorMode(): PersistenceMode {
  try {
    const stored = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    return isPersistenceMode(stored) ? stored : 'flash';
  } catch {
    return 'flash';
  }
}

function isThemeLike(value: unknown): value is PlaygroundTheme {
  if (!value || typeof value !== 'object') return false;
  const theme = value as PlaygroundTheme;
  return typeof theme.title === 'string'
    && typeof theme.colors?.background === 'string'
    && typeof theme.colors?.text === 'string'
    && typeof theme.colors?.primary === 'string';
}

function readStoredTheme(): PlaygroundTheme {
  const stored = readStoredJson<unknown>(THEME_STORAGE_KEY);
  return isThemeLike(stored) ? stored : DEFAULT_THEME;
}

function persistTheme(theme: PlaygroundTheme): void {
  writeStoredValue(THEME_STORAGE_KEY, JSON.stringify(theme));
}

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  if (normalized.length === 3) {
    return [
      Number.parseInt(normalized[0] + normalized[0], 16),
      Number.parseInt(normalized[1] + normalized[1], 16),
      Number.parseInt(normalized[2] + normalized[2], 16),
    ];
  }
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixHexColors(left: string, right: string, ratio: number): string {
  const leftRgb = hexToRgb(left);
  const rightRgb = hexToRgb(right);
  if (!leftRgb || !rightRgb) return left;

  const weight = Math.max(0, Math.min(1, ratio));
  return rgbToHex(
    leftRgb[0] + (rightRgb[0] - leftRgb[0]) * weight,
    leftRgb[1] + (rightRgb[1] - leftRgb[1]) * weight,
    leftRgb[2] + (rightRgb[2] - leftRgb[2]) * weight,
  );
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}

function ensureThemeHostStyle(): void {
  if (document.getElementById('playground-theme-style')) return;
  const style = document.createElement('style');
  style.id = 'playground-theme-style';
  style.textContent = `
    body {
      background: var(--nap-theme-background, #0a0a0f) !important;
      color: var(--nap-theme-text, #e0e0e0) !important;
      color-scheme: var(--nap-theme-color-scheme, dark);
    }

    header.app-header,
    #static-demo-banner,
    #relay-activity-panel,
    #debugger-section,
    #inspector-pane,
    .shell-control-group,
    .shell-control-btn,
    .topology-node,
    .topology-node-content,
    .topology-runtime-demo-card,
    .topology-service-card,
    .topology-acl-slot,
    .topology-flow-log,
    .node-summary,
    .notif-toast,
    .signer-modal-panel,
    .notif-node-controls,
    #notification-inspector,
    .acl-modal,
    .const-grouping-btn,
    .const-reset-all-btn,
    .const-reset-btn,
    .notif-node-btn,
    .notif-item-btn,
    .signer-connect-btn,
    .signer-disconnect-btn,
    .signer-connect-action-btn {
      border-color: var(--nap-theme-border, #2a2a3a) !important;
    }

    header.app-header,
    #static-demo-banner,
    #relay-activity-panel,
    #debugger-section,
    #inspector-pane,
    .shell-control-group,
    .topology-node,
    .topology-node-content,
    .topology-runtime-demo-card,
    .topology-service-card,
    .topology-acl-slot,
    .topology-flow-log,
    .notif-toast,
    .signer-modal-panel,
    .notif-node-controls,
    #notification-inspector,
    .acl-modal {
      background: var(--nap-theme-surface-1, #12121a) !important;
    }

    .shell-control-label,
    .shell-control-value,
    .topology-region-label,
    .topology-node-kicker,
    .topology-node-status,
    .topology-node-title,
    .topology-node-header,
    .topology-node-copy,
    .topology-node-meta,
    .topology-flow-log-body,
    .node-summary-label,
    .node-summary-value,
    .notif-toast-title,
    .notif-item-title,
    .signer-option-title,
    .signer-pubkey,
    .signer-method-badge,
    .notif-toast-body,
    .notif-item-body,
    .signer-relay,
    .signer-option-copy,
    .signer-field-label,
    .notif-inspector-title,
    .notif-list-empty {
      color: var(--nap-theme-muted, #7981a0) !important;
    }

    .shell-control-btn:hover,
    .shell-control-btn[aria-pressed="true"],
    .const-grouping-btn.active,
    .const-grouping-btn:hover:not(.active),
    .notif-node-btn:hover,
    .notif-item-btn:hover,
    .signer-connect-btn:hover,
    .signer-disconnect-btn:hover,
    .signer-connect-action-btn:hover {
      color: var(--nap-theme-primary, #00f0ff) !important;
      border-color: var(--nap-theme-primary-border, #00f0ff) !important;
    }
  `;
  document.head.appendChild(style);
}

function applySelectedTheme(theme: PlaygroundTheme, persist: boolean): void {
  ensureThemeHostStyle();
  (window as Window & { __kehtoCurrentTheme?: PlaygroundTheme }).__kehtoCurrentTheme = theme;
  applyNapTheme(theme);

  const rootStyle = document.documentElement.style;
  const background = theme.colors.background;
  const text = theme.colors.text;
  const primary = theme.colors.primary;
  const isLight = relativeLuminance(background) > 0.35;

  rootStyle.setProperty('--nap-theme-surface-1', mixHexColors(background, text, isLight ? 0.08 : 0.12));
  rootStyle.setProperty('--nap-theme-surface-2', mixHexColors(background, text, isLight ? 0.12 : 0.18));
  rootStyle.setProperty('--nap-theme-surface-3', mixHexColors(background, text, isLight ? 0.18 : 0.24));
  rootStyle.setProperty('--nap-theme-border', mixHexColors(background, text, isLight ? 0.22 : 0.30));
  rootStyle.setProperty('--nap-theme-muted', mixHexColors(text, background, isLight ? 0.38 : 0.55));
  rootStyle.setProperty('--nap-theme-primary-soft', mixHexColors(background, primary, isLight ? 0.18 : 0.14));
  rootStyle.setProperty('--nap-theme-primary-border', mixHexColors(background, primary, isLight ? 0.40 : 0.32));
  rootStyle.setProperty('--nap-theme-primary-text', mixHexColors(primary, background, isLight ? 0.18 : 0.12));
  rootStyle.setProperty('--nap-theme-color-scheme', isLight ? 'light' : 'dark');
  document.documentElement.style.colorScheme = isLight ? 'light' : 'dark';

  if (persist) persistTheme(theme);
}

function clampNappletHeight(value: number): number {
  return Math.min(MAX_NAPPLET_HEIGHT_PX, Math.max(MIN_NAPPLET_HEIGHT_PX, value));
}

function notifyLayoutChanged(): void {
  window.dispatchEvent(new Event('resize'));
  window.setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
}

function applyNappletHeight(heightPx: number, persist: boolean): void {
  const clamped = clampNappletHeight(heightPx);
  document.documentElement.style.setProperty('--napplet-frame-height', `${clamped}px`);

  const slider = document.getElementById('napplet-height-slider') as HTMLInputElement | null;
  if (slider) slider.value = String(clamped);

  const valueEl = document.getElementById('napplet-height-value');
  if (valueEl) valueEl.textContent = `${clamped}px`;

  if (persist) writeStoredValue(NAPPLET_HEIGHT_STORAGE_KEY, String(clamped));
  notifyLayoutChanged();
}

function initNappletHeightControl(): void {
  const slider = document.getElementById('napplet-height-slider') as HTMLInputElement | null;
  const resetBtn = document.getElementById('napplet-height-reset');
  const initialHeight = clampNappletHeight(
    readStoredNumber(NAPPLET_HEIGHT_STORAGE_KEY, DEFAULT_NAPPLET_HEIGHT_PX),
  );

  applyNappletHeight(initialHeight, false);

  slider?.addEventListener('input', () => {
    applyNappletHeight(Number.parseInt(slider.value, 10), true);
  });

  resetBtn?.addEventListener('click', () => {
    applyNappletHeight(DEFAULT_NAPPLET_HEIGHT_PX, true);
  });
}

function setDebuggerHidden(hidden: boolean, persist: boolean): void {
  document.body.classList.toggle('debugger-hidden', hidden);

  const btn = document.getElementById('debugger-toggle-btn') as HTMLButtonElement | null;
  if (btn) {
    btn.textContent = hidden ? 'show debugger' : 'hide debugger';
    btn.setAttribute('aria-pressed', String(hidden));
  }

  if (persist) writeStoredValue(DEBUGGER_HIDDEN_STORAGE_KEY, String(hidden));
  notifyLayoutChanged();
}

function initDebuggerToggle(): void {
  const btn = document.getElementById('debugger-toggle-btn');
  const initialHidden = readStoredBoolean(DEBUGGER_HIDDEN_STORAGE_KEY, false);
  setDebuggerHidden(initialHidden, false);

  btn?.addEventListener('click', () => {
    setDebuggerHidden(!document.body.classList.contains('debugger-hidden'), true);
  });
}

function updateAclExpandAllButton(): void {
  const btn = document.getElementById('acl-expand-all-btn') as HTMLButtonElement | null;
  if (!btn) return;

  const allExpanded = areAllAclPanelsExpanded();
  btn.textContent = allExpanded ? 'collapse all ACL' : 'expand all ACL';
  btn.setAttribute('aria-pressed', String(allExpanded));
}

function initAclExpandAllControl(): void {
  const btn = document.getElementById('acl-expand-all-btn');
  btn?.addEventListener('click', () => {
    setAllAclPanelsExpanded(!areAllAclPanelsExpanded());
    updateAclExpandAllButton();
    notifyLayoutChanged();
  });

  window.addEventListener('acl-panels:expansion-changed', () => {
    updateAclExpandAllButton();
    notifyLayoutChanged();
  });

  updateAclExpandAllButton();
}

function updateColorModeButtons(mode: PersistenceMode): void {
  document.querySelectorAll('.color-mode-btn').forEach((button) => {
    button.classList.toggle('color-mode-active', (button as HTMLElement).dataset.colorMode === mode);
  });
}

function applyColorMode(mode: PersistenceMode, persist: boolean): void {
  const prevMode = getPersistenceMode();

  if (prevMode === 'trace' && mode !== 'trace') {
    cancelAllTraceAnimations(edgeFlasher, topology.edges.map((edge) => edge.id));
  }

  setPersistenceMode(mode);
  updateColorModeButtons(mode);

  const ephemeral = ['flash', 'trace'];
  if (ephemeral.includes(mode) || ephemeral.includes(prevMode)) {
    clearAllNodeOverlays();
    for (const edge of topology.edges) {
      edgeFlasher.setColor(edge.id, 'out', null);
      edgeFlasher.setColor(edge.id, 'in', null);
    }
  }

  if (persist) writeStoredValue(COLOR_MODE_STORAGE_KEY, mode);
}

initNappletHeightControl();
initDebuggerToggle();
initAclExpandAllControl();

const { tap } = bootShell((notifications) => {
  notificationUi.controller.handleServiceChange(notifications);
});

const notificationHandler = getNotificationServiceHandler();
if (notificationHandler) {
  notificationUi.controller.connectService(notificationHandler);
}

createConsentModal().registerWith(relay, (request) => {
  setTimeout(() => request.resolve(true), 500);
});
initRelayActivityPanel(getPlaygroundRelayActivity);

const topology = buildDemoTopology(getDemoTopologyInputs());

const topologyPane = document.getElementById('topology-pane');
if (topologyPane) {
  replaceChildrenFromTrustedHtml(topologyPane, renderDemoTopology(topology));
}

// Initialize Leader Line edges after topology HTML is in the DOM
const edgeFlasher = initTopologyEdges(topology);

// Wire service toggle icons on topology nodes
wireServiceToggles((name, enabled) => {
  toggleService(name, enabled);
});
for (const serviceName of getDemoServiceNames()) {
  updateServiceNodeVisual(serviceName, isServiceEnabled(serviceName));
}

// Initialize persistent color state tracking for topology edges
initColorState(topology);
applyColorMode(readStoredColorMode(), false);

onColorStateChange(() => {
  for (const node of topology.nodes) {
    const inboundColor = getNodeInboundColor(node.id);
    const outboundColor = getNodeOutboundColor(node.id);

    const inEl = document.querySelector<HTMLElement>(
      `[data-color-overlay="${node.id}"][data-color-direction="inbound"]`,
    );
    if (inEl) {
      inEl.classList.remove('node-color-active', 'node-color-blocked');
      if (inboundColor) inEl.classList.add(`node-color-${inboundColor}`);
    }

    const outEl = document.querySelector<HTMLElement>(
      `[data-color-overlay="${node.id}"][data-color-direction="outbound"]`,
    );
    if (outEl) {
      outEl.classList.remove('node-color-active', 'node-color-blocked');
      if (outboundColor) outEl.classList.add(`node-color-${outboundColor}`);
    }
  }
});

notificationUi.injectControls();

// Connect debugger to tap
const debuggerEl = document.getElementById('debugger') as NappletDebugger;
if (debuggerEl) {
  debuggerEl.connectTap(tap);
  setDebugger(debuggerEl);
  debuggerEl.addSystemMessage(`shell booted -- host pubkey: ${getDemoHostPubkey().substring(0, 16)}...`);
  debuggerEl.addSystemMessage(getDemoHostAuditSummary());
  debuggerEl.addSystemMessage('notification service registered -- host callbacks active');
}

window.addEventListener('message', (event: MessageEvent) => {
  const data = event.data as Record<string, unknown> | null;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'shell.ready') {
    window.setTimeout(() => {
      broadcastCurrentTheme();
    }, 0);
    window.setTimeout(() => {
      broadcastCurrentTheme();
    }, 100);
    return;
  }
  if (data.type !== 'theme.set') return;
  const theme = (data as { theme?: unknown }).theme;
  if (!isThemeLike(theme)) return;

  currentTheme = theme;
  applySelectedTheme(currentTheme, true);
  broadcastCurrentTheme();
  debuggerEl?.addSystemMessage(`theme set — bg: ${theme.colors.background}`);
});

// Keep the existing "theme service registered" debugger message:
const _themeBundle = getThemeServiceBundle();
if (_themeBundle) {
  debuggerEl?.addSystemMessage('theme service registered -- theme.set seam ready');
}

demoConfig.subscribe((key, value) => {
  debuggerEl?.addSystemMessage(`config changed: ${key} = ${value}`);
  if (key === 'demo.ACL_RING_BUFFER_SIZE') {
    setAclRingSize(value);
  }
});

// Suppress unused import warning — openConstantsTab is available for keyboard shortcuts
void openConstantsTab;

notificationUi.attachDebugger(debuggerEl ?? null);
const signerUi = initSignerNodeUi(debuggerEl ?? null, (pubkey) => {
  relay.publishIdentityChanged(pubkey);
  debuggerEl?.addSystemMessage(
    pubkey
      ? `identity changed — ${pubkey.substring(0, 16)}...`
      : 'identity changed — signed out',
  );
});

document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (signerUi.handleDocumentClick(e)) return;
  if (notificationUi.handleDocumentClick(e)) return;

  const colorModeBtn = target.closest<HTMLElement>('[data-color-mode]');
  if (colorModeBtn) {
    const mode = colorModeBtn.dataset.colorMode as PersistenceMode;
    if (mode) {
      applyColorMode(mode, true);
      debuggerEl?.addSystemMessage(`color mode changed: ${mode}`);
    }
  }
});

// Show pubkey in shell node
const shellPubkey = document.getElementById('shell-pubkey');
if (shellPubkey) shellPubkey.textContent = `pubkey: ${getDemoHostPubkey().substring(0, 20)}...`;

async function syncGrantsToVite(dTag: string, aggregateHash: string, origins: readonly string[]): Promise<void> {
  if (isStaticPagesDemo) return;

  try {
    await fetch('/__connect-grants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dTag, aggregateHash, origins: [...origins] }),
    });
  } catch {
    // Best-effort -- failure here doesn't invalidate the in-memory grant;
    // the CSP header will be stale until the next sync succeeds.
  }
}

async function grantConnectOrigin(dTag: string, aggregateHash: string, origin: string): Promise<boolean> {
  const existing = connectStore.getOrigins(dTag, aggregateHash);
  const next = [...new Set([...existing, origin])];
  connectStore.grant(dTag, aggregateHash, next);
  await syncGrantsToVite(dTag, aggregateHash, next);
  return true;
}

(window as Window & {
  __grantConnectOrigin__?: (dTag: string, aggregateHash: string, origin: string) => boolean;
}).__grantConnectOrigin__ = (dTag: string, aggregateHash: string, origin: string): boolean => {
  void grantConnectOrigin(dTag, aggregateHash, origin);
  return true;
};

(window as Window & {
  __revokeConnect__?: (dTag: string, aggregateHash: string) => boolean;
}).__revokeConnect__ = (dTag: string, aggregateHash: string): boolean => {
  connectStore.revoke(dTag, aggregateHash);
  void syncGrantsToVite(dTag, aggregateHash, []);
  // C-04 / CONNECT-04: iframe destroy+recreate so the newly-served HTML
  // picks up the updated CSP header (now without the revoked origin).
  window.dispatchEvent(new CustomEvent('shell:connect-revoked', { detail: { dTag, aggregateHash } }));
  return true;
};

window.addEventListener('shell:connect-revoked', (event) => {
  const detail = (event as CustomEvent<{ dTag: string; aggregateHash: string }>).detail;
  const napps = getNapplets();
  // Snapshot: collect matching entries before mutating the Map.
  const toRevoke = [...napps.entries()].filter(([, info]) => info.name === detail.dTag);
  for (const [windowId, info] of toRevoke) {
    const def = DEMO_NAPPLETS.find((d) => d.name === detail.dTag);
    if (!def) continue;
    const containerId = def.frameContainerId;
    info.iframe.remove();
    napps.delete(windowId);
    // Re-load. loadNapplet assigns a fresh windowId and re-appends iframe.
    void loadNapplet(detail.dTag, containerId).then(() => {
      handleLoadedNapplet();
    }).catch((err) => {
      console.error(`[demo] shell:connect-revoked: failed to reload ${detail.dTag}`, err);
    });
  }
});

function handleLoadedNapplet(): void {
  broadcastCurrentTheme();
  setTimeout(() => {
    refreshAclPanelsIfNeeded();
  }, 0);
}

async function pregrantBeforeGatewayNavigation(metadata: GatewayNappletMetadata): Promise<void> {
  if (metadata.dTag !== 'resource-demo') return;
  const ok = await grantConnectOrigin(
    metadata.dTag,
    metadata.aggregateHash,
    RESOURCE_DEMO_REMOTE_IMAGE_ORIGIN,
  );
  if (!ok) {
    console.warn('[demo] resource-demo auto-grant failed; E2E may fail on remote-image assertion');
  }
}

for (const napplet of DEMO_NAPPLETS) {
  void loadNapplet(napplet.name, napplet.frameContainerId, {
    beforeNavigate: pregrantBeforeGatewayNavigation,
  }).then(() => {
    handleLoadedNapplet();
  }).catch((err) => {
    const statusEl = document.getElementById(napplet.statusId);
    if (statusEl) {
      statusEl.textContent = 'load failed';
      statusEl.style.color = 'var(--nap-theme-danger, #ff6b6b)';
    }
    console.error(`[demo] failed to load napplet ${napplet.name}`, err);
  });
}

initFlowAnimator(tap, topology, edgeFlasher);

let totalMessages = 0;
let totalBlocked = 0;

tap.onMessage((msg) => {
  totalMessages++;
  const rawArr = Array.isArray(msg.raw) ? msg.raw : null;
  const isOkFalse = msg.verb === 'OK' && rawArr?.[2] === false;
  const isClosedDenied =
    msg.verb === 'CLOSED' &&
    typeof rawArr?.[2] === 'string' &&
    (String(rawArr[2]).includes('denied') || String(rawArr[2]).startsWith('blocked:'));
  if (isOkFalse || isClosedDenied) totalBlocked++;
});

tap.onMessage((msg) => {
  // Detect signer request (kind 29001 from napplet to shell, no topic = direct signer request)
  if (
    msg.verb === 'EVENT' &&
    msg.parsed.eventKind === 29001 &&
    msg.parsed.topic === undefined &&
    msg.direction === 'napplet->shell'
  ) {
    const raw = msg.raw;
    const event = (Array.isArray(raw) && raw.length > 1)
      ? (raw[1] as Record<string, unknown>)
      : null;
    const tags = (event?.tags as string[][] | undefined) ?? [];
    const method = tags.find((t) => t[0] === 'method')?.[1] ?? 'unknown';
    const eventTag = tags.find((t) => t[0] === 'event')?.[1];
    let kind: number | undefined;
    if (method === 'signEvent' && eventTag) {
      try {
        kind = (JSON.parse(eventTag) as { kind?: number }).kind;
      } catch { /* ignore malformed event tag */ }
    }

    recordSignerRequest({
      timestamp: msg.timestamp,
      method,
      kind,
      success: true, // preliminary; updated on OK false response heuristic below
    });
  }

  // Detect signer response failure — heuristic: most recent request within 5s
  if (
    msg.verb === 'OK' &&
    msg.parsed.success === false &&
    msg.direction === 'shell->napplet'
  ) {
    const state = getSignerConnectionState();
    const last = state.recentRequests[state.recentRequests.length - 1];
    if (last && Date.now() - last.timestamp < 5000) {
      recordSignerRequest({ ...last, success: false });
    }
  }
});

// Install per-node activity projection
installActivityProjection(tap, topology, classifyTappedMessagePath);

function refreshNodeSummaries(): void {
  const napplets = getNapplets();
  const options = {
    napplets,
    serviceNames: getDemoServiceNames(),
    hostPubkey: getDemoHostPubkey(),
    totalMessages,
    totalBlocked,
  };
  const details = buildAllNodeDetails(topology, options);
  for (const [nodeId, detail] of details) {
    const el = document.getElementById(`node-summary-${nodeId}`);
    if (el) {
      const fields = detail.summaryFields.map((field) => {
        const wrapper = document.createElement('span');
        wrapper.className = 'node-summary-field';
        const label = document.createElement('span');
        label.className = 'node-summary-label';
        label.textContent = `${field.label}:`;
        const value = document.createElement('span');
        value.className = 'node-summary-value';
        value.textContent = field.value;
        wrapper.append(label, document.createTextNode(' '), value);
        return wrapper;
      });
      el.replaceChildren(...fields);
    }
  }
}

// Refresh summaries periodically during active traffic
tap.onMessage(() => {
  refreshNodeSummaries();
});

refreshNodeSummaries();

initNodeInspector(() => {
  // Called when inspector needs fresh data for the selected node
  const napplets = getNapplets();
  return {
    napplets,
    serviceNames: getDemoServiceNames(),
    hostPubkey: getDemoHostPubkey(),
    totalMessages,
    totalBlocked,
    checkCapability: (pubkey: string, dTag: string, hash: string, cap: string) =>
      relay.runtime.aclState.check(pubkey, dTag, hash, cap as Capability),
    tap,
  };
}, topology);

// Wire per-node click → selection
function wireNodeSelection(): void {
  const allNodes = document.querySelectorAll('[data-node-id]');
  for (const el of allNodes) {
    el.addEventListener('click', (event) => {
      // Guard: Skip button clicks to allow button handlers to execute
      if ((event.target as HTMLElement).closest('button')) return;

      event.stopPropagation();
      const nodeId = el.getAttribute('data-node-id');
      if (nodeId) {
        setSelectedNodeId(nodeId);
      }
    });
  }
}

// Wire after topology is rendered
wireNodeSelection();

// Track which napplets have had their ACL panel rendered (render only once)
const aclRendered = new Set<string>();

// Phase 29 (Plan 29-01, DEMO-01): Data-driven status refresh.
//
// Post-v1.4 UAT revealed that the previous hardcoded if-chain only updated the
// outer topology status DOM for chat + bot. The other 8 napplets
// (composer, preferences, toaster, feed, profile-viewer, theme-switcher,
// hotkey-chord, media-controller) were added to `aclRendered` but their
// `#<name>-status` span stayed at 'loading...' forever — the cause of the
// "7/10 stuck on LOADING" user-visible bug. hotkey-chord + media-controller
// were missing from the function entirely.
//
// shell-host.ts marks each napplet identity-bound from the gateway-derived
// source tuple registered for its iframe. This function is pure display: for
// each identity-bound napplet, update its outer topology status sentinel once.
function refreshAclPanelsIfNeeded(): void {
  for (const napplet of DEMO_NAPPLETS) {
    if (aclRendered.has(napplet.name)) continue;
    const info = [...getNapplets().values()].find((entry) => entry.name === napplet.name);
    if (!info?.identityBound) continue;
    const statusEl = document.getElementById(napplet.statusId);
    if (statusEl) {
      statusEl.textContent = 'identity-bound';
      statusEl.style.color = 'var(--nap-theme-success, #39ff14)';
    }
    aclRendered.add(napplet.name);
  }

  if (aclRendered.size > 0) {
    renderAclPanels(aclRendered);
  }

  refreshNodeSummaries();
}

window.addEventListener('napplet:identity-bound', () => {
  setTimeout(() => {
    refreshAclPanelsIfNeeded();
  }, 0);
});

tap.onMessage((msg) => {
  // Legacy OK success can still wake old fixture paths.
  if (msg.verb === 'OK' && msg.parsed.success === true && msg.direction === 'shell->napplet') {
    setTimeout(() => {
      refreshAclPanelsIfNeeded();
    }, 200);
  }

  // Envelope traffic can still wake ACL panel rendering for reloads and
  // diagnostics, but source-derived NIP-5D identity no longer depends on a
  // startup protocol message.
  //
  // Phase 29 (Plan 29-01): removed the stale `aclRendered.size < 8` bail — that
  // count was set in Phase 20 (pre-hotkey-chord, pre-media-controller) and kept
  // the refresh from running once the v1.3 napplet set was done, blocking the
  // v1.4 additions. Idempotence now comes from `aclRendered.has(napplet.name)`
  // inside the loop in refreshAclPanelsIfNeeded() — a size-based guard is
  // redundant.
  if (msg.verb === 'ENVELOPE' && msg.direction === 'napplet->shell' && msg.windowId) {
    setTimeout(() => {
      refreshAclPanelsIfNeeded();
    }, 200);
  }

  if (msg.verb === 'EVENT' && msg.parsed.topic) {
    debuggerEl?.addSystemMessage(
      `ifc: ${msg.parsed.topic} (kind:${msg.parsed.eventKind})`
    );
  }
});

// Selected-node state (exported for inspector module access)
export let selectedNodeId: string | null = null;

export function setSelectedNode(id: string | null): void {
  selectedNodeId = id;
  setSelectedNodeId(id);
}

(window as Window & {
  __setNappletClass__?: (dTag: string, newClass: NappletClass) => boolean;
}).__setNappletClass__ = (dTag: string, newClass: NappletClass): boolean => {
  const windowId = findIdentityBoundNappletWindowIdByDTag(dTag);
  if (!windowId) {
    console.warn(`[demo] __setNappletClass__: ${dTag} not loaded or not identity-bound`);
    return false;
  }
  const entry = relay.runtime.sessionRegistry.getEntryByWindowId(windowId);
  if (!entry) {
    console.warn(`[demo] __setNappletClass__: session entry missing for ${dTag}`);
    return false;
  }
  (entry as { class: NappletClass }).class = newClass;
  return true;
};

(window as Window & { __clearAclEvents__?: () => void }).__clearAclEvents__ = (): void => {
  const w = window as Window & { __aclEvents__?: Array<unknown> };
  w.__aclEvents__ = [];
};

(window as Window & {
  __injectNubEnvelopeAsNapplet__?: (dTag: string, envelope: Record<string, unknown>) => boolean;
}).__injectNubEnvelopeAsNapplet__ = (dTag: string, envelope: Record<string, unknown>): boolean => {
  const windowId = findIdentityBoundNappletWindowIdByDTag(dTag);
  if (!windowId) {
    console.warn(`[demo] __injectNubEnvelopeAsNapplet__: ${dTag} not loaded or not identity-bound`);
    return false;
  }
  // Find the iframe for this napplet by its windowId (the id attribute set in loadNapplet).
  const targetFrame = document.getElementById(windowId) as HTMLIFrameElement | null;
  if (!targetFrame?.contentWindow) {
    console.warn(`[demo] __injectNubEnvelopeAsNapplet__: iframe not found for ${dTag} (windowId=${windowId})`);
    return false;
  }
  // relay.handleMessage is installed on window and checks event.source to
  // resolve the windowId -- matching the iframe's contentWindow routes it
  // through enforceNub with the correct session entry.
  const event = new MessageEvent('message', {
    data: envelope,
    source: targetFrame.contentWindow,
    origin: 'null',
  });
  window.dispatchEvent(event);
  return true;
};

{
  const updateBtn = document.getElementById('config-demo-update-btn');
  if (updateBtn) {
    let _currentTheme = 'dark';
    updateBtn.addEventListener('click', () => {
      _currentTheme = _currentTheme === 'dark' ? 'light' : 'dark';
      setDemoConfigValue('theme', _currentTheme);
    });
  }
}

(window as Window & {
  __publishConfigValues__?: (values: Record<string, unknown>) => boolean;
}).__publishConfigValues__ = (values: Record<string, unknown>): boolean => {
  for (const [key, value] of Object.entries(values)) {
    setDemoConfigValue(key, value);
  }
  return true;
};

(window as Window & {
  __publishDecryptFixtures__?: (dTag?: string) => Promise<boolean>;
}).__publishDecryptFixtures__ = async (dTag = 'decrypt-demo'): Promise<boolean> => {
  return publishDecryptFixturesToNapplet(dTag);
};

(window as Window & {
  __getDecryptBridgeCallCount__?: () => number;
}).__getDecryptBridgeCallCount__ = (): number => getDemoDecryptBridgeCallCount();

(window as Window & {
  __resetDecryptBridgeCallCount__?: () => void;
}).__resetDecryptBridgeCallCount__ = (): void => {
  resetDemoDecryptBridgeCallCount();
};
