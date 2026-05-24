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
  type GatewayNappletMetadata,
} from './shell-host.js';
import { connectStore, type Capability, type NappletClass } from '@kehto/shell';
import { createConsentModal } from './consent-modal.js';
import {
  createDemoNotificationController,
  type DemoNotificationSnapshot,
} from './notification-demo.js';
import { classifyTappedMessagePath, type NappletDebugger } from './debugger.js';
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
  type PersistenceMode,
} from './color-state.js';
import {
  buildDemoTopology,
  renderDemoTopology,
  getServiceNodeId,
  initTopologyEdges,
  wireServiceToggles,
  type SignerConnectionStateView,
} from './topology.js';
import {
  buildAllNodeDetails,
  buildNodeDetails,
  installActivityProjection,
} from './node-details.js';
import { initNodeInspector, openConstantsTab, setSelectedNodeId } from './node-inspector.js';
import { replaceChildrenFromTrustedHtml } from './dom-utils.js';
import {
  onStateChange,
  disconnectSigner,
  recordSignerRequest,
  getSignerConnectionState,
  getSigner as getSignerFromConnection,
} from './signer-connection.js';
import { initSignerModal, openSignerModal } from './signer-modal.js';
import { demoConfig } from './demo-config.js';
import { setAclRingSize } from './acl-history.js';
import type { Notification } from '@kehto/services';

const notificationController = createDemoNotificationController();

const { tap } = bootShell((notifications) => {
  notificationController.handleServiceChange(notifications);
});

const notificationHandler = getNotificationServiceHandler();
if (notificationHandler) {
  notificationController.connectService(notificationHandler);
}

createConsentModal().registerWith(relay, (request) => {
  setTimeout(() => request.resolve(true), 500);
});
const _nip66Aggregator = getNip66Aggregator();
if (_nip66Aggregator) {
  _nip66Aggregator.start();

  const renderNip66Suggestions = (): void => {
    const list = document.getElementById('nip66-suggestions-list');
    if (!list) return;
    const relays = Array.from(_nip66Aggregator.getRelaySet());
    if (relays.length === 0) return;  // leave "no suggestions yet" placeholder in place
    list.replaceChildren();
    for (const url of relays) {
      const li = document.createElement('li');
      li.style.padding = '2px 0';
      li.style.color = '#62d0ff';
      li.style.fontFamily = 'monospace';
      li.textContent = url;
      list.appendChild(li);
    }
  };

  let attempts = 0;
  const nip66PollId = window.setInterval(() => {
    attempts++;
    renderNip66Suggestions();
    const after = document.querySelectorAll('#nip66-suggestions-list li[style*="62d0ff"]').length;
    if (after >= 1 || attempts >= 10) {
      window.clearInterval(nip66PollId);
    }
  }, 100);

  window.addEventListener('beforeunload', () => {
    window.clearInterval(nip66PollId);
    _nip66Aggregator.stop();
  });
}

const _shownToastIds = new Set<string>();

function renderToast(notification: Notification): void {
  const layer = document.getElementById('notification-toast-layer');
  if (!layer) return;
  const toast = document.createElement('div');
  toast.className = 'notif-toast';
  toast.dataset.notifId = notification.id;
  const title = document.createElement('div');
  title.className = 'notif-toast-title';
  title.textContent = notification.title;
  toast.appendChild(title);
  if (notification.body) {
    const body = document.createElement('div');
    body.className = 'notif-toast-body';
    body.textContent = notification.body;
    toast.appendChild(body);
  }
  const cue = document.createElement('div');
  cue.className = 'notif-toast-cue';
  cue.textContent = 'notifications:create via service';
  toast.appendChild(cue);
  layer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, demoConfig.get('demo.TOAST_DISPLAY_MS'));
}

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

function renderNotificationInspector(snapshot: DemoNotificationSnapshot): void {
  const listEl = document.getElementById('notification-list');
  if (!listEl) return;

  if (snapshot.notifications.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'notif-list-empty';
    empty.textContent = 'no notifications yet';
    listEl.replaceChildren(empty);
    return;
  }

  const sorted = [...snapshot.notifications].reverse();
  const items = sorted.map((n) => {
    const item = document.createElement('div');
    item.className = `notif-item${n.read ? ' read' : ''}`;
    item.dataset.notifId = n.id;

    const title = document.createElement('div');
    title.className = 'notif-item-title';
    title.textContent = n.title;
    item.appendChild(title);

    if (n.body) {
      const body = document.createElement('div');
      body.className = 'notif-item-body';
      body.textContent = n.body;
      item.appendChild(body);
    }

    const meta = document.createElement('div');
    meta.className = 'notif-item-meta';
    const tag = document.createElement('span');
    tag.className = 'notif-item-tag';
    tag.textContent = 'notifications:create';
    const state = document.createElement('span');
    state.textContent = n.read ? 'read' : 'unread';
    meta.append(tag, state);
    item.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'notif-item-actions';
    if (!n.read) {
      const readBtn = document.createElement('button');
      readBtn.className = 'notif-item-btn read-btn';
      readBtn.dataset.action = 'notif-read';
      readBtn.dataset.notifId = n.id;
      readBtn.textContent = 'mark read';
      actions.appendChild(readBtn);
    }
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'notif-item-btn dismiss-btn';
    dismissBtn.dataset.action = 'notif-dismiss';
    dismissBtn.dataset.notifId = n.id;
    dismissBtn.textContent = 'dismiss';
    actions.appendChild(dismissBtn);
    item.appendChild(actions);

    return item;
  });
  listEl.replaceChildren(...items);
}

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

  renderNotificationNodeSummary(snapshot);

  // If inspector is open, update it
  const inspector = document.getElementById('notification-inspector');
  if (inspector?.classList.contains('open')) {
    renderNotificationInspector(snapshot);
  }

  const currentIds = new Set(snapshot.notifications.map((n) => n.id));
  for (const id of _shownToastIds) {
    if (!currentIds.has(id)) {
      _shownToastIds.delete(id);
    }
  }

  // Suppress TS unused-variable warning from old code
  void prev;
});

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

// Initialize persistent color state tracking for topology edges
initColorState(topology);

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

demoConfig.subscribe((key, value) => {
  debuggerEl?.addSystemMessage(`config changed: ${key} = ${value}`);
  if (key === 'demo.ACL_RING_BUFFER_SIZE') {
    setAclRingSize(value);
  }
});

// Suppress unused import warning — openConstantsTab is available for keyboard shortcuts
void openConstantsTab;

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

  function meta(className: string, text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = `topology-node-meta ${className}`;
    el.textContent = text;
    return el;
  }

  function baseNodes(): [HTMLDivElement, HTMLDivElement] {
    const kicker = document.createElement('div');
    kicker.className = 'topology-node-kicker';
    kicker.textContent = 'service';
    const title = document.createElement('div');
    title.className = 'topology-node-title';
    title.textContent = 'signer';
    return [kicker, title];
  }

  const dynamicNodes: HTMLElement[] = [];
  dynamicNodes.push(...baseNodes());

  if (state.isConnecting) {
    dynamicNodes.push(meta('signer-status-connecting', 'connecting...'));
  } else if (state.method === 'none') {
    if (state.error) dynamicNodes.push(meta('signer-status-error', state.error));
    dynamicNodes.push(meta('signer-status-disconnected', 'not connected'));
    const button = document.createElement('button');
    button.className = 'signer-connect-btn';
    button.dataset.action = 'open-signer-connect';
    button.textContent = 'Connect Signer';
    dynamicNodes.push(button);
  } else {
    const truncatedPubkey = state.pubkey
      ? `${state.pubkey.substring(0, 8)}...${state.pubkey.substring(state.pubkey.length - 4)}`
      : '';

    const connected = document.createElement('div');
    connected.className = 'topology-node-meta signer-status-connected';
    const method = document.createElement('span');
    method.className = 'signer-method-badge';
    method.textContent = state.method === 'nip07' ? 'nip-07' : 'nip-46';
    const pubkey = document.createElement('span');
    pubkey.className = 'signer-pubkey';
    pubkey.textContent = truncatedPubkey;
    connected.append(method, pubkey);
    if (state.relay) {
      const relay = document.createElement('span');
      relay.className = 'signer-relay';
      relay.textContent = state.relay;
      connected.appendChild(relay);
    }
    dynamicNodes.push(connected);

    const recent = document.createElement('div');
    recent.className = 'signer-recent-requests';
    const recentLabel = document.createElement('div');
    recentLabel.className = 'signer-recent-label';
    recentLabel.textContent = 'recent';
    recent.appendChild(recentLabel);
    const recentSlice = [...state.recentRequests].reverse().slice(0, 5);
    if (recentSlice.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'signer-no-requests';
      empty.textContent = 'no requests yet';
      recent.appendChild(empty);
    } else {
      for (const request of recentSlice) {
        const row = document.createElement('div');
        row.className = `signer-request-row ${request.success ? 'ok' : 'err'}`;
        const methodEl = document.createElement('span');
        methodEl.className = 'signer-req-method';
        methodEl.textContent = request.method;
        row.appendChild(methodEl);
        if (request.kind !== undefined) {
          const kind = document.createElement('span');
          kind.className = 'signer-req-kind';
          kind.textContent = `k${request.kind}`;
          row.appendChild(kind);
        }
        const status = document.createElement('span');
        status.className = 'signer-req-status';
        status.textContent = request.success ? '✓' : '✗';
        row.appendChild(status);
        recent.appendChild(row);
      }
    }
    dynamicNodes.push(recent);

    const actions = document.createElement('div');
    actions.className = 'signer-action-row';
    const testBtn = document.createElement('button');
    testBtn.className = 'signer-test-sign-btn';
    testBtn.dataset.action = 'signer-test-sign';
    testBtn.textContent = 'test sign';
    const disconnectBtn = document.createElement('button');
    disconnectBtn.className = 'signer-disconnect-btn';
    disconnectBtn.dataset.action = 'disconnect-signer';
    disconnectBtn.textContent = 'disconnect';
    actions.append(testBtn, disconnectBtn);
    dynamicNodes.push(actions);
  }

  if (nodeSummary) {
    for (const child of dynamicNodes) contentWrapper.insertBefore(child, nodeSummary);
  } else {
    contentWrapper.replaceChildren(...dynamicNodes);
  }
}

// Subscribe to signer connection state changes
onStateChange((state) => {
  updateSignerNodeDisplay(state);

  if (state.method !== 'none' && !state.isConnecting && !state.error) {
    debuggerEl?.addSystemMessage(
      `signer connected via ${state.method}: ${state.pubkey?.substring(0, 16)}...`
    );
  }
  if (state.error) {
    debuggerEl?.addSystemMessage(`signer connection error: ${state.error}`);
  }
});

initSignerModal();

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
        const signed = await signer.signEvent(template as Parameters<NonNullable<typeof signer.signEvent>>[0]);
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
    void loadNapplet(detail.dTag, containerId).catch((err) => {
      console.error(`[demo] shell:connect-revoked: failed to reload ${detail.dTag}`, err);
    });
  }
});

async function pregrantBeforeGatewayNavigation(metadata: GatewayNappletMetadata): Promise<void> {
  if (metadata.dTag !== 'resource-demo') return;
  const grantedOrigin = window.location.origin;
  const ok = await grantConnectOrigin(
    metadata.dTag,
    metadata.aggregateHash,
    grantedOrigin,
  );
  if (!ok) {
    console.warn('[demo] resource-demo auto-grant failed; E2E may fail on granted-fetch assertion');
  }
}

for (const napplet of DEMO_NAPPLETS) {
  void loadNapplet(napplet.name, napplet.frameContainerId, {
    beforeNavigate: pregrantBeforeGatewayNavigation,
  }).then(() => {
    setTimeout(() => {
      refreshAclPanelsIfNeeded();
    }, 0);
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
      statusEl.style.color = '#39ff14';
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
