/**
 * main.ts -- Demo playground entry point.
 *
 * Boots shell, renders the topology view, loads napplets, wires debugger,
 * ACL panels, flow animator, and node-detail summaries.
 */
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
  getNip66Aggregator,
  publishDecryptFixturesToNapplet,
  getDemoDecryptBridgeCallCount,
  resetDemoDecryptBridgeCallCount,
} from './shell-host.js';
import type { GatewayNappletMetadata } from './shell-host.js';
import type { NappletClass } from '@kehto/shell';
import type { Capability } from '@kehto/shell';
import { connectStore } from '@kehto/shell';
import { createConsentModal } from './consent-modal.js';
import {
  createDemoNotificationController,
} from './notification-demo.js';
import type { DemoNotificationSnapshot } from './notification-demo.js';
import './debugger.js';
import type { NappletDebugger } from './debugger.js';
import { classifyTappedMessagePath } from './debugger.js';
import { renderAclPanels, setDebugger } from './acl-panel.js';
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
} from './color-state.js';
import type { PersistenceMode } from './color-state.js';
import { buildDemoTopology, renderDemoTopology, getServiceNodeId, initTopologyEdges, wireServiceToggles } from './topology.js';
import type { SignerConnectionStateView } from './topology.js';
import {
  buildAllNodeDetails,
  buildNodeDetails,
  installActivityProjection,
} from './node-details.js';
import type { NodeDetail } from './node-details.js';
import { initNodeInspector, setSelectedNodeId } from './node-inspector.js';
import {
  onStateChange,
  disconnectSigner,
  recordSignerRequest,
  getSignerConnectionState,
  getSigner as getSignerFromConnection,
} from './signer-connection.js';
import { initSignerModal, openSignerModal } from './signer-modal.js';
import { demoConfig } from './demo-config.js';
import { openConstantsTab } from './node-inspector.js';
import { setAclRingSize } from './acl-history.js';

// ─── Notification Controller ─────────────────────────────────────────────────

// Create the controller before boot so we can pass its onChange into the shell.
// The controller accumulates service state and notifies subscribers on change.
const notificationController = createDemoNotificationController();

// Boot the shell (now includes signer and notifications)
const { tap } = bootShell((notifications) => {
  notificationController.handleServiceChange(notifications);
});

// Connect the service handler so the controller can dispatch actions
const notificationHandler = getNotificationServiceHandler();
if (notificationHandler) {
  notificationController.connectService(notificationHandler);
}

// ─── Phase 39 Plan 39-04: NUB-CONNECT consent modal registration ────────────
// Registers the consent modal as the sole consent handler on the bridge.
// Non-connect consent types (destructive-signing) fall through to the 500ms
// auto-approve callback (demo ergonomics, preserved from shell-host.ts prior handler).
createConsentModal().registerWith(relay, (request) => {
  // Fallthrough for non-connect consent types (existing destructive-signing path).
  setTimeout(() => request.resolve(true), 500);
});

// ─── Phase 41 Plan 41-01 (NIP66-07 / D5, D6, D8): nip66 aggregator lifecycle ─
// Kicks off the mock kind:30166 subscription, populates the suggestions panel
// from the aggregator's relay set (polled on a microtask loop until the panel
// has ≥1 <li>), and registers a beforeunload cleanup handler (D8 — prevents
// SimplePool leaks on SPA navigation per PITFALLS.md M-03).
const _nip66Aggregator = getNip66Aggregator();
if (_nip66Aggregator) {
  _nip66Aggregator.start();

  const renderNip66Suggestions = (): void => {
    const list = document.getElementById('nip66-suggestions-list');
    if (!list) return;
    const relays = Array.from(_nip66Aggregator.getRelaySet());
    if (relays.length === 0) return;  // leave "no suggestions yet" placeholder in place
    list.innerHTML = '';
    for (const url of relays) {
      const li = document.createElement('li');
      li.style.padding = '2px 0';
      li.style.color = '#62d0ff';
      li.style.fontFamily = 'monospace';
      li.textContent = url;
      list.appendChild(li);
    }
  };

  // Initial render is best-effort — fixtures land on microtask from aggregator.start().
  // Poll a handful of times to catch the first fan-out without requiring a framework.
  // Bounded: stops after 10 attempts or as soon as ≥1 suggestion renders.
  let attempts = 0;
  const nip66PollId = window.setInterval(() => {
    attempts++;
    renderNip66Suggestions();
    const after = document.querySelectorAll('#nip66-suggestions-list li[style*="62d0ff"]').length;
    if (after >= 1 || attempts >= 10) {
      window.clearInterval(nip66PollId);
    }
  }, 100);

  // D8: beforeunload cleanup — dispose pool subscription + clear interval.
  window.addEventListener('beforeunload', () => {
    window.clearInterval(nip66PollId);
    _nip66Aggregator.stop();
  });
}

// ─── Notification Toast Rendering ────────────────────────────────────────────

// Track shown toast IDs so we don't re-show the same notification
const _shownToastIds = new Set<string>();

function renderToast(notification: import('@napplet/services').Notification): void {
  const layer = document.getElementById('notification-toast-layer');
  if (!layer) return;
  const toast = document.createElement('div');
  toast.className = 'notif-toast';
  toast.dataset.notifId = notification.id;
  toast.innerHTML = `
    <div class="notif-toast-title">${escapeHtml(notification.title)}</div>
    ${notification.body ? `<div class="notif-toast-body">${escapeHtml(notification.body)}</div>` : ''}
    <div class="notif-toast-cue">notifications:create via service</div>
  `;
  layer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, demoConfig.get('demo.TOAST_DISPLAY_MS'));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Notification Node Summary Rendering ────────────────────────────────────

function renderNotificationNodeSummary(snapshot: DemoNotificationSnapshot): void {
  const totalEl = document.getElementById('notif-total');
  const unreadEl = document.getElementById('notif-unread');
  const sourceCueEl = document.getElementById('notif-source-cue');
  const cueTextEl = sourceCueEl?.querySelector('.notif-cue-text');

  if (totalEl) totalEl.textContent = String(snapshot.notifications.length);
  if (unreadEl) unreadEl.textContent = String(snapshot.unreadCount);
  if (sourceCueEl && cueTextEl && snapshot.sourceLabel) {
    (cueTextEl as HTMLElement).textContent = snapshot.sourceLabel;
    (sourceCueEl as HTMLElement).style.display = '';
  }
}

// ─── Notification Inspector Rendering ────────────────────────────────────────

function renderNotificationInspector(snapshot: DemoNotificationSnapshot): void {
  const listEl = document.getElementById('notification-list');
  if (!listEl) return;

  if (snapshot.notifications.length === 0) {
    listEl.innerHTML = '<div class="notif-list-empty">no notifications yet</div>';
    return;
  }

  // Newest first
  const sorted = [...snapshot.notifications].reverse();
  listEl.innerHTML = sorted
    .map(
      (n) => `
      <div class="notif-item${n.read ? ' read' : ''}" data-notif-id="${n.id}">
        <div class="notif-item-title">${escapeHtml(n.title)}</div>
        ${n.body ? `<div class="notif-item-body">${escapeHtml(n.body)}</div>` : ''}
        <div class="notif-item-meta">
          <span class="notif-item-tag">notifications:create</span>
          <span>${n.read ? 'read' : 'unread'}</span>
        </div>
        <div class="notif-item-actions">
          ${!n.read ? `<button class="notif-item-btn read-btn" data-action="notif-read" data-notif-id="${n.id}">mark read</button>` : ''}
          <button class="notif-item-btn dismiss-btn" data-action="notif-dismiss" data-notif-id="${n.id}">dismiss</button>
        </div>
      </div>
    `
    )
    .join('');
}

// ─── Notification Snapshot Subscriber ────────────────────────────────────────

// Track the latest notification snapshot for rendering
let _notificationSnapshot: DemoNotificationSnapshot = notificationController.getSnapshot();
notificationController.subscribe((snapshot) => {
  const prev = _notificationSnapshot;
  _notificationSnapshot = snapshot;

  // Show toasts for new notifications
  for (const n of snapshot.notifications) {
    if (!_shownToastIds.has(n.id)) {
      _shownToastIds.add(n.id);
      renderToast(n);
      debuggerEl?.addSystemMessage(`notifications:create via service — id:${n.id.slice(0, 16)}`);
    }
  }

  // Update summary fields in the node
  renderNotificationNodeSummary(snapshot);

  // If inspector is open, update it
  const inspector = document.getElementById('notification-inspector');
  if (inspector?.classList.contains('open')) {
    renderNotificationInspector(snapshot);
  }

  // Reflect dismissed notifications (remove from shown set)
  const currentIds = new Set(snapshot.notifications.map((n) => n.id));
  for (const id of [..._shownToastIds]) {
    if (!currentIds.has(id)) {
      _shownToastIds.delete(id);
    }
  }

  // Suppress TS unused-variable warning from old code
  void prev;
});

const topology = buildDemoTopology(getDemoTopologyInputs());

// Render topology into the left topology pane
const topologyPane = document.getElementById('topology-pane');
if (topologyPane) {
  topologyPane.innerHTML = renderDemoTopology(topology);
}

// Initialize Leader Line edges after topology HTML is in the DOM
const edgeFlasher = initTopologyEdges(topology);

// Wire service toggle icons on topology nodes
wireServiceToggles((name, enabled) => {
  toggleService(name, enabled);
});

// Initialize persistent color state tracking for topology edges
initColorState(topology);

// ─── Persistent Node Color Rendering ────────────────────────────────────
onColorStateChange(() => {
  for (const node of topology.nodes) {
    const inboundColor = getNodeInboundColor(node.id);
    const outboundColor = getNodeOutboundColor(node.id);

    // Update inbound overlay
    const inEl = document.querySelector<HTMLElement>(
      `[data-color-overlay="${node.id}"][data-color-direction="inbound"]`,
    );
    if (inEl) {
      inEl.classList.remove('node-color-active', 'node-color-blocked');
      if (inboundColor) inEl.classList.add(`node-color-${inboundColor}`);
    }

    // Update outbound overlay
    const outEl = document.querySelector<HTMLElement>(
      `[data-color-overlay="${node.id}"][data-color-direction="outbound"]`,
    );
    if (outEl) {
      outEl.classList.remove('node-color-active', 'node-color-blocked');
      if (outboundColor) outEl.classList.add(`node-color-${outboundColor}`);
    }
  }
});

// ─── Inject Notification Controls into the Notifications Node ────────────────

(function injectNotificationControls(): void {
  const notifNodeId = getServiceNodeId('notifications');
  const notifServiceNode = document.getElementById(notifNodeId);
  const template = document.getElementById('notification-node-controls-template') as HTMLTemplateElement | null;
  if (!notifServiceNode || !template) return;
  const clone = document.importNode(template.content, true);
  // Append inside the content wrapper so controls render within the opaque area
  const contentWrapper = notifServiceNode.querySelector('.topology-node-content') ?? notifServiceNode;
  contentWrapper.appendChild(clone);
})();

// Connect debugger to tap
const debuggerEl = document.getElementById('debugger') as NappletDebugger;
if (debuggerEl) {
  debuggerEl.connectTap(tap);
  setDebugger(debuggerEl);
  debuggerEl.addSystemMessage(`shell booted -- host pubkey: ${getDemoHostPubkey().substring(0, 16)}...`);
  debuggerEl.addSystemMessage(getDemoHostAuditSummary());
  debuggerEl.addSystemMessage('notification service registered -- host callbacks active');
}

// ─── Theme Broadcast Bridge (Plan 20-06, D-USER-01) ──────────────────────
// theme-switcher napplet (Plan 20-04) dispatches `demo.publishTheme` postMessage
// (SDK gap exemption — @napplet/sdk does not expose theme.publish). The host
// listens here and forwards to relay.publishTheme(theme) which fan-outs
// `theme.changed` envelopes to every napplet via originRegistry.getIframeWindow.
// The preferences napplet (Plan 20-05) observes those `theme.changed` envelopes
// and mirrors the color to document.body + #preferences-theme-applied.
//
// This handler is narrowly-scoped:
//   - Guards on event.data being a plain object with type === 'demo.publishTheme'
//   - event.source may be any iframe (we don't pin to theme-switcher — any napplet
//     that dispatches demo.publishTheme is honored, which is fine for v1.3 demo)
//   - Calls relay.publishTheme(event.data.theme) synchronously
// Does NOT intercept any other envelope type (storage.*, ifc.*, notify.*, etc.)

window.addEventListener('message', (event: MessageEvent) => {
  const data = event.data as Record<string, unknown> | null;
  if (!data || typeof data !== 'object') return;
  if (data.type !== 'demo.publishTheme') return;
  const theme = (data as { theme?: unknown }).theme;
  if (!theme || typeof theme !== 'object') return;
  const themeTyped = theme as { colors?: { background?: string; text?: string; primary?: string } };
  if (!themeTyped.colors || typeof themeTyped.colors.background !== 'string') return;
  // relay is the ShellBridge — publishTheme fan-outs theme.changed to every registered napplet.
  // Type cast via ShellBridge['publishTheme'] parameter to avoid direct @napplet/nub/theme import
  // in the demo app (the nub subpath is covered by @kehto/shell's peer dep, not apps/playground directly).
  relay.publishTheme(themeTyped as Parameters<typeof relay.publishTheme>[0]);
  debuggerEl?.addSystemMessage(`theme broadcast — bg: ${themeTyped.colors.background}`);
});

// Keep the existing "theme service registered" debugger message:
const _themeBundle = getThemeServiceBundle();
if (_themeBundle) {
  debuggerEl?.addSystemMessage('theme service registered -- publishTheme seam ready');
}

// ─── Config Change Logging ──────────────────────────────────────────────────

demoConfig.subscribe((key, value) => {
  debuggerEl?.addSystemMessage(`config changed: ${key} = ${value}`);
  if (key === 'demo.ACL_RING_BUFFER_SIZE') {
    setAclRingSize(value);
  }
});

// Suppress unused import warning — openConstantsTab is available for keyboard shortcuts
void openConstantsTab;

// ─── Signer Node Display ─────────────────────────────────────────────────────

const signerNodeId = getServiceNodeId('signer');

/**
 * Update the signer service node in the topology to reflect current connection state.
 * Operates surgically on the node element without re-rendering the whole topology.
 */
function updateSignerNodeDisplay(state: SignerConnectionStateView): void {
  const signerNode = document.getElementById(signerNodeId);
  if (!signerNode) return;

  // Target the content wrapper (overlays and toggle live outside it)
  const contentWrapper = signerNode.querySelector('.topology-node-content') ?? signerNode;

  // Remove existing dynamic content (everything before node-summary)
  const nodeSummary = contentWrapper.querySelector('.node-summary');
  // Clear children except the node-summary
  const toRemove: Element[] = [];
  for (const child of contentWrapper.children) {
    if (!child.classList.contains('node-summary')) {
      toRemove.push(child);
    }
  }
  for (const el of toRemove) el.remove();

  let innerHtml = '';

  if (state.isConnecting) {
    innerHtml = `
      <div class="topology-node-kicker">service</div>
      <div class="topology-node-title">signer</div>
      <div class="topology-node-meta signer-status-connecting">connecting...</div>
    `;
  } else if (state.method === 'none') {
    const errorHtml = state.error
      ? `<div class="topology-node-meta signer-status-error">${state.error}</div>`
      : '';
    innerHtml = `
      <div class="topology-node-kicker">service</div>
      <div class="topology-node-title">signer</div>
      ${errorHtml}
      <div class="topology-node-meta signer-status-disconnected">not connected</div>
      <button class="signer-connect-btn" data-action="open-signer-connect">Connect Signer</button>
    `;
  } else {
    // Connected
    const truncatedPubkey = state.pubkey
      ? `${state.pubkey.substring(0, 8)}...${state.pubkey.substring(state.pubkey.length - 4)}`
      : '';
    const relayHtml = state.relay
      ? `<span class="signer-relay">${state.relay}</span>`
      : '';

    // Recent requests (last 5, most recent first)
    const recentSlice = [...state.recentRequests].reverse().slice(0, 5);
    const requestRowsHtml = recentSlice.length > 0
      ? recentSlice.map((r) => `
          <div class="signer-request-row ${r.success ? 'ok' : 'err'}">
            <span class="signer-req-method">${r.method}</span>
            ${r.kind !== undefined ? `<span class="signer-req-kind">k${r.kind}</span>` : ''}
            <span class="signer-req-status">${r.success ? '✓' : '✗'}</span>
          </div>
        `).join('')
      : '<div class="signer-no-requests">no requests yet</div>';

    innerHtml = `
      <div class="topology-node-kicker">service</div>
      <div class="topology-node-title">signer</div>
      <div class="topology-node-meta signer-status-connected">
        <span class="signer-method-badge">${state.method === 'nip07' ? 'nip-07' : 'nip-46'}</span>
        <span class="signer-pubkey">${truncatedPubkey}</span>
        ${relayHtml}
      </div>
      <div class="signer-recent-requests">
        <div class="signer-recent-label">recent</div>
        ${requestRowsHtml}
      </div>
      <div class="signer-action-row">
        <button class="signer-test-sign-btn" data-action="signer-test-sign">test sign</button>
        <button class="signer-disconnect-btn" data-action="disconnect-signer">disconnect</button>
      </div>
    `;
  }

  // Insert the dynamic content before node-summary
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = innerHtml;
  if (nodeSummary) {
    for (const child of [...tempDiv.children]) {
      contentWrapper.insertBefore(child, nodeSummary);
    }
  } else {
    contentWrapper.innerHTML = innerHtml;
  }
}

// Subscribe to signer connection state changes
onStateChange((state) => {
  updateSignerNodeDisplay(state);

  // Log to debugger
  if (state.method !== 'none' && !state.isConnecting && !state.error) {
    debuggerEl?.addSystemMessage(
      `signer connected via ${state.method}: ${state.pubkey?.substring(0, 16)}...`
    );
  }
  if (state.error) {
    debuggerEl?.addSystemMessage(`signer connection error: ${state.error}`);
  }
});

// Initialize signer connect modal
initSignerModal();

// Handle signer connect/disconnect button clicks
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.closest('[data-action="open-signer-connect"]')) {
    e.stopPropagation();
    openSignerModal();
  }
  if (target.closest('[data-action="disconnect-signer"]')) {
    e.stopPropagation();
    disconnectSigner();
    debuggerEl?.addSystemMessage('signer disconnected');
  }

  // Test-sign button: signs a demo kind:1 event via the connected signer (host-internal path)
  if (target.closest('[data-action="signer-test-sign"]')) {
    e.stopPropagation();
    void (async () => {
      const signer = getSignerFromConnection();
      if (!signer) {
        debuggerEl?.addSystemMessage('test-sign: no signer connected');
        return;
      }
      try {
        const t = Math.floor(Date.now() / 1000);
        const pubkey = await signer.getPublicKey();
        const template = {
          kind: 1,
          pubkey,
          created_at: t,
          tags: [],
          content: 'demo test-sign from kehto shell',
        };
        const signed = await signer.signEvent(template as unknown as Record<string, unknown>);
        const eventId = (signed as { id?: string }).id ?? 'unknown';
        debuggerEl?.addSystemMessage(`test-sign: OK, event id ${eventId.substring(0, 16)}...`);
        recordSignerRequest({
          timestamp: Date.now(),
          method: 'signEvent',
          kind: 1,
          success: true,
        });
      } catch (err) {
        debuggerEl?.addSystemMessage(`test-sign: error ${(err as Error).message}`);
        recordSignerRequest({
          timestamp: Date.now(),
          method: 'signEvent',
          kind: 1,
          success: false,
        });
      }
    })();
  }

  // Notification node controls
  if (target.id === 'notification-node-create' || target.closest('#notification-node-create')) {
    e.stopPropagation();
    notificationController.createDemoNotification({
      title: 'Demo notification',
      body: 'Triggered from the notification service node',
      sourceLabel: 'notifications:create via service',
    });
    debuggerEl?.addSystemMessage('notifications:create dispatched from host node control');
  }
  if (target.id === 'notification-node-list' || target.closest('#notification-node-list')) {
    e.stopPropagation();
    notificationController.requestList();
    debuggerEl?.addSystemMessage('notifications:list requested');
    // Open inspector to show the list
    const inspector = document.getElementById('notification-inspector');
    inspector?.classList.add('open');
    renderNotificationInspector(_notificationSnapshot);
  }
  if (target.id === 'notification-node-mark-read' || target.closest('#notification-node-mark-read')) {
    e.stopPropagation();
    const newest = [..._notificationSnapshot.notifications].filter((n) => !n.read).pop();
    if (newest) {
      notificationController.markRead(newest.id);
      debuggerEl?.addSystemMessage(`notifications:read dispatched — id:${newest.id.slice(0, 16)}`);
    } else {
      debuggerEl?.addSystemMessage('notifications:read — no unread notifications');
    }
  }
  if (target.id === 'notification-node-dismiss' || target.closest('#notification-node-dismiss')) {
    e.stopPropagation();
    const newest = [..._notificationSnapshot.notifications].pop();
    if (newest) {
      notificationController.dismiss(newest.id);
      debuggerEl?.addSystemMessage(`notifications:dismiss dispatched — id:${newest.id.slice(0, 16)}`);
    } else {
      debuggerEl?.addSystemMessage('notifications:dismiss — no notifications to dismiss');
    }
  }

  // Inspector per-item controls
  if ((target as HTMLElement).dataset.action === 'notif-read') {
    e.stopPropagation();
    const id = (target as HTMLElement).dataset.notifId;
    if (id) {
      notificationController.markRead(id);
      debuggerEl?.addSystemMessage(`notifications:read from inspector — id:${id.slice(0, 16)}`);
    }
  }
  if ((target as HTMLElement).dataset.action === 'notif-dismiss') {
    e.stopPropagation();
    const id = (target as HTMLElement).dataset.notifId;
    if (id) {
      notificationController.dismiss(id);
      debuggerEl?.addSystemMessage(`notifications:dismiss from inspector — id:${id.slice(0, 16)}`);
    }
  }

  // Close notification inspector
  if (target.id === 'notification-inspector-close' || target.closest('#notification-inspector-close')) {
    e.stopPropagation();
    const inspector = document.getElementById('notification-inspector');
    inspector?.classList.remove('open');
  }

  // ─── Color Mode Toggle ──────────────────────────────────────────────────
  const colorModeBtn = target.closest<HTMLElement>('[data-color-mode]');
  if (colorModeBtn) {
    const mode = colorModeBtn.dataset.colorMode as PersistenceMode;
    if (mode) {
      const prevMode = getPersistenceMode();

      // Cancel any pending trace animations before switching modes
      if (prevMode === 'trace') {
        cancelAllTraceAnimations(edgeFlasher, topology.edges.map((e) => e.id));
      }

      setPersistenceMode(mode);

      // Update active class on toggle buttons
      document.querySelectorAll('.color-mode-btn').forEach((b) => {
        b.classList.toggle('color-mode-active', (b as HTMLElement).dataset.colorMode === mode);
      });

      // Clear node overlays when entering ephemeral modes or leaving them
      const ephemeral = ['flash', 'trace'];
      if (ephemeral.includes(mode) || ephemeral.includes(prevMode)) {
        clearAllNodeOverlays();
        // Also reset LeaderLine edges to resting
        for (const edge of topology.edges) {
          edgeFlasher.setColor(edge.id, 'out', null);
          edgeFlasher.setColor(edge.id, 'in', null);
        }
      }

      debuggerEl?.addSystemMessage(`color mode changed: ${mode}`);
    }
  }
});

// Show pubkey in shell node
const shellPubkey = document.getElementById('shell-pubkey');
if (shellPubkey) shellPubkey.textContent = `pubkey: ${getDemoHostPubkey().substring(0, 20)}...`;

// ─── Phase 39 Plan 39-04: NUB-CONNECT + NUB-CONFIG test hooks ───────────────
//
// Hoisted before napplet loading (Phase 40 Plan 40-02) so resource-demo can
// grant its manifest-derived aggregateHash before loadNapplet navigates the
// iframe. Phase 40 D3 requires the grant to land before the iframe's first HTTP
// request so the Vite serveNappletCsp plugin emits connect-src localhost:4174.
//
// Plan 39-05's E2E specs (connect-consent.spec.ts, connect-revocation.spec.ts,
// nub-config.spec.ts) need to grant/revoke connect origins and publish config
// updates without driving the UI. Mirrors __grantKeysForward__ / __grantMediaControl__
// from Phases 26/27 -- direct shell-state mutation + HTTP sync to the Vite
// middleware's in-memory Map (Plan 39-03 /__connect-grants endpoint).
//
// __grantConnectOrigin__ and __revokeConnect__ also dispatch / listen for
// 'shell:connect-revoked' CustomEvent to wire the C-04 iframe destroy+recreate path.

async function syncGrantsToVite(dTag: string, aggregateHash: string, origins: readonly string[]): Promise<void> {
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
  console.info(`[demo] __grantConnectOrigin__: granted ${origin} to ${dTag}:${aggregateHash}`);
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
  console.info(`[demo] __revokeConnect__: revoked all origins from ${dTag}:${aggregateHash}`);
  return true;
};

// C-04 / CONNECT-04: listen for revocation events and destroy+recreate the napplet iframe.
// Snapshot entries BEFORE the loop — loadNapplet adds a new entry to the same Map,
// and a live Map iterator would visit it, causing an infinite destroy+recreate loop.
window.addEventListener('shell:connect-revoked', (event) => {
  const detail = (event as CustomEvent<{ dTag: string; aggregateHash: string }>).detail;
  const napps = getNapplets();
  // Snapshot: collect matching entries before mutating the Map.
  const toRevoke = [...napps.entries()].filter(([, info]) => info.name === detail.dTag);
  for (const [windowId, info] of toRevoke) {
    const def = DEMO_NAPPLETS.find((d) => d.name === detail.dTag);
    if (!def) continue;
    const containerId = def.frameContainerId;
    // Remove the iframe -- loadNapplet will re-append a fresh one.
    info.iframe.remove();
    napps.delete(windowId);
    // Re-load. loadNapplet assigns a fresh windowId and re-appends iframe.
    void loadNapplet(detail.dTag, containerId).catch((err) => {
      console.error(`[demo] shell:connect-revoked: failed to reload ${detail.dTag}`, err);
    });
    console.info(`[demo] shell:connect-revoked: destroy+recreate iframe for ${detail.dTag}`);
  }
});

// ─── Phase 40 Plan 40-02 (RESOURCE-04 / D3): resource-demo auto-grant ────────
// Grants http://localhost:4174 to resource-demo at demo boot so the Vite
// serveNappletCsp plugin (Phase 39 Plan 39-03) emits connect-src localhost:4174
// on the iframe HTML response. No user click-through — deterministic for E2E.
// Phase 40 Plan 40-03 fix: uses 4174 (demo server) not 5174 (napplet dev server)
// because demo-data.json is served from apps/playground/public/ at the demo origin.
// In preview mode (E2E), no server runs at 5174; the fixture is at /demo-data.json
// on the same 4174 origin that serves the built demo.
//
// Phase 39 Dev 2 safety: does NOT touch the shell:connect-revoked path at all;
// the revocation handler's snapshot-before-mutate pattern is preserved unchanged.
async function pregrantBeforeGatewayNavigation(metadata: GatewayNappletMetadata): Promise<void> {
  if (metadata.dTag !== 'resource-demo') return;
  const ok = await grantConnectOrigin(
    metadata.dTag,
    metadata.aggregateHash,
    'http://localhost:4174',
  );
  if (!ok) {
    console.warn('[demo] resource-demo auto-grant failed; E2E may fail on granted-fetch assertion');
  } else {
    console.info('[demo] resource-demo: pre-granted http://localhost:4174 (RESOURCE-04 / D3)');
  }
}

// Load demo napplets into the rendered topology
for (const napplet of DEMO_NAPPLETS) {
  void loadNapplet(napplet.name, napplet.frameContainerId, {
    beforeNavigate: pregrantBeforeGatewayNavigation,
  }).catch((err) => {
    const statusEl = document.getElementById(napplet.statusId);
    if (statusEl) {
      statusEl.textContent = 'load failed';
      statusEl.style.color = '#ff6b6b';
    }
    console.error(`[demo] failed to load napplet ${napplet.name}`, err);
  });
}

initFlowAnimator(tap, topology, edgeFlasher);

// ─── Node Detail Counters ────────────────────────────────────────────────────
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

// ─── Signer Request Tap Wiring ───────────────────────────────────────────────

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

// ─── Compact Node Summary Rendering ─────────────────────────────────────────

function renderSummaryFields(detail: NodeDetail): string {
  return detail.summaryFields
    .map(
      (field) =>
        `<span class="node-summary-field"><span class="node-summary-label">${field.label}:</span> <span class="node-summary-value">${field.value}</span></span>`
    )
    .join('');
}

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
      el.innerHTML = renderSummaryFields(detail);
    }
  }
}

// Refresh summaries periodically during active traffic
tap.onMessage(() => {
  refreshNodeSummaries();
});

// Initial render
refreshNodeSummaries();

// ─── Inspector Wiring ─────────────────────────────────────────────────────────

// Initialize the inspector panel
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
        // Eagerly build a single-node detail for quick UI response
        const node = topology.nodes.find((n) => n.id === nodeId);
        if (node) {
          buildNodeDetails(node, {
            napplets: getNapplets(),
            serviceNames: getDemoServiceNames(),
            hostPubkey: getDemoHostPubkey(),
            totalMessages,
            totalBlocked,
          });
        }
      }
    });
  }
}

// Wire after topology is rendered
wireNodeSelection();

// ─── ACL Panel Wiring ────────────────────────────────────────────────────────

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
// shell-host.ts marks each napplet identity-bound after the first source-bound
// envelope from its pre-registered iframe. This function is pure display: for
// each identity-bound napplet, update its outer topology status sentinel once.
function refreshAclPanelsIfNeeded(): void {
  for (const napplet of DEMO_NAPPLETS) {
    if (aclRendered.has(napplet.name)) continue;
    const info = [...getNapplets().values()].find((entry) => entry.name === napplet.name);
    if (!info?.identityBound) continue;
    const statusEl = document.getElementById(napplet.statusId);
    if (statusEl) {
      statusEl.textContent = 'identity-bound';
      statusEl.style.color = '#39ff14';
    }
    aclRendered.add(napplet.name);
  }

  if (aclRendered.size > 0) {
    renderAclPanels(aclRendered);
  }

  refreshNodeSummaries();
}

tap.onMessage((msg) => {
  // Legacy OK success can still wake old fixture paths.
  if (msg.verb === 'OK' && msg.parsed.success === true && msg.direction === 'shell->napplet') {
    setTimeout(() => {
      refreshAclPanelsIfNeeded();
    }, 200);
  }

  // Path B: NIP-5D envelope-only napplets (composer/preferences/toaster, feed,
  // profile-viewer, theme-switcher, hotkey-chord, media-controller).
  // The shell-host sets info.identityBound=true on the first ENVELOPE from a napplet.
  // We respond to that envelope here to trigger ACL panel rendering.
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

  // Log ifc events prominently
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

// ─── Plan 38-03 (CLASS-04 / D9): __setNappletClass__ test hook (main.ts) ──────
// Plan 38-03's Playwright spec (E2E-20 class-invariant) must assign a
// restrictive class to one napplet on-the-fly to exercise the cross-NUB
// invariant. Hook placement is locked by D9 to demo main.ts (not shell-host).
// Shape mirrors __grantKeysForward__/__grantMediaControl__ patterns (Plans
// 26-03/27-03): dTag-scoped mutation hook returning true on success, false
// when the target napplet is not yet loaded or not yet identity-bound.
//
// CLASS-01/02 semantics: class is normally resolved synchronously at iframe
// creation. This test hook mutates the already-registered session entry's
// class in place. The next NUB request through enforce.ts reads the mutated
// value via resolveIdentityByWindowId. No class.assigned envelope is
// emitted — C-01 prevention holds because mutation is test-only and
// completes before the next NUB request arrives.
//
// Usage (from tests/e2e/class-invariant.spec.ts):
//   await page.evaluate(
//     ([dTag, cls]) => window.__setNappletClass__?.(dTag, cls),
//     ['theme-switcher', 'class-2'],
//   );
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
  // Mutate .class in place. SessionRegistry retains a reference to the entry
  // object, so the mutation is observed by the next resolveIdentityByWindowId
  // call inside enforce.ts.
  (entry as { class: NappletClass }).class = newClass;
  console.info(
    `[demo] __setNappletClass__: ${dTag} -> ${newClass === null ? 'null (permissive)' : `'${newClass}'`}`,
  );
  return true;
};

// ─── Plan 38-03 (E2E-20): __clearAclEvents__ + __aclEvents__ reader ────────
// The class-invariant spec uses __aclEvents__ to assert the enforce.ts gate
// fired with reason='class-forbidden'. test.beforeEach calls
// __clearAclEvents__ to prevent cross-test contamination. Lives in main.ts
// with __setNappletClass__ (D9 test-hook locus); __aclEvents__ itself is
// populated by the onAclCheck callback wired in shell-host.ts.
(window as Window & { __clearAclEvents__?: () => void }).__clearAclEvents__ = (): void => {
  const w = window as Window & { __aclEvents__?: Array<unknown> };
  w.__aclEvents__ = [];
};

// ─── Plan 38-03 (E2E-20): __injectNubEnvelopeAsNapplet__ test hook ───────────
// Injects a NIP-5D NUB envelope into the runtime as if sent by the named
// napplet's iframe. This causes the envelope to pass through relay.handleMessage
// -> enforceNub, making class-forbidden denials observable via __aclEvents__.
//
// The theme-switcher napplet sends theme via window.parent.postMessage (host-side
// bypass, not through the runtime); this hook simulates the runtime path so
// the class-invariant spec can exercise the enforce.ts gate directly.
//
// Usage (from tests/e2e/class-invariant.spec.ts):
//   await page.evaluate(([dTag, envelope]) =>
//     window.__injectNubEnvelopeAsNapplet__?.(dTag, envelope),
//     ['theme-switcher', { type: 'relay.publish', id: 'test-123' }]
//   );
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
  // Dispatch a MessageEvent as if from the napplet iframe.
  // relay.handleMessage is installed on window and checks event.source to
  // resolve the windowId -- matching the iframe's contentWindow routes it
  // through enforceNub with the correct session entry.
  const event = new MessageEvent('message', {
    data: envelope,
    source: targetFrame.contentWindow,
    origin: 'null',
  });
  window.dispatchEvent(event);
  console.info(`[demo] __injectNubEnvelopeAsNapplet__: injected ${String(envelope['type'])} for ${dTag}`);
  return true;
};

// ─── Phase 39 Plan 39-04 (D11): config-demo update button wiring ─────────────
// The shell UI button flips demoConfigFixtures.theme between dark/light via
// setDemoConfigValue, which calls configServiceBundle.publishValues.
// The E2E spec uses __publishConfigValues__ test hook for deterministic updates.
{
  const updateBtn = document.getElementById('config-demo-update-btn');
  if (updateBtn) {
    let _currentTheme = 'dark';
    updateBtn.addEventListener('click', () => {
      _currentTheme = _currentTheme === 'dark' ? 'light' : 'dark';
      setDemoConfigValue('theme', _currentTheme);
      console.info(`[demo] config-demo-update-btn: theme toggled to ${_currentTheme}`);
    });
  }
}

// ─── Phase 39 Plan 39-04: __publishConfigValues__ test hook ──────────────────
// E2E deterministic config value override. Bypasses the shell UI button
// and directly calls setDemoConfigValue for each key in the provided values
// object, then triggers a full publishValues via configServiceBundle (via
// setDemoConfigValue iterating keys).
(window as Window & {
  __publishConfigValues__?: (values: Record<string, unknown>) => boolean;
}).__publishConfigValues__ = (values: Record<string, unknown>): boolean => {
  for (const [key, value] of Object.entries(values)) {
    setDemoConfigValue(key, value);
  }
  console.info(`[demo] __publishConfigValues__: published keys: ${Object.keys(values).join(',')}`);
  return true;
};

// ─── Phase 46 Plan 46-01: __publishDecryptFixtures__ test hook ─────────────
// Publishes deterministic encrypted fixtures into decrypt-demo's iframe. The
// napplet calls identityDecrypt, which exercises the full
// napplet->runtime->service->napplet identity.decrypt path.
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

console.log('[napplet playground] initialized');
