/**
 * Toaster demo napplet — exercises notify lifecycle via NIP-5D envelopes (NAP-05, Phase 19).
 *
 * Behavior:
 *   - On click of #toaster-notify-btn: dispatch notify.create envelope; on notify.created
 *     reply, append <li data-notif-id="<id>"> to #toaster-list and (host) toast appears
 *   - On click of #toaster-dismiss-all-btn: dispatch notify.list to enumerate, then
 *     dispatch notify.dismiss for each id; #toaster-list empties as the local state
 *     mirrors the dismissal acks (notification-service does not push a notify.dismissed
 *     reply, so we trust the dispatch and drop locally — equivalent to optimistic UI)
 *
 * SDK gap notice (Plan 19-03): @napplet/sdk does NOT expose notify.create / notify.list
 * / notify.read (verified at /home/sandwich/Develop/napplet/packages/sdk/src/index.ts
 * lines 352-450 — only send/dismiss/badge/permission/registerChannel are exposed). The
 * demo's notification-service (packages/services/src/notification-service.ts) implements
 * the notify.create / notify.list / notify.read / notify.dismiss contract, NOT the SDK's
 * notify.send contract. Therefore this napplet sends raw envelopes via
 * window.parent.postMessage and receives replies via a single narrowly-guarded message
 * handler registered once near the bottom of this file (Plan 19-03 deviation). Plan
 * 19-04 dual-registers notification-service under 'notify' so the runtime's
 * serviceRegistry['notify'] lookup (packages/runtime/src/runtime.ts:1000) routes the
 * toaster's envelopes correctly.
 *
 * The single message handler below is an EXPLICIT, NARROWLY-SCOPED deviation from the
 * v1.3 anti-feature ban on raw message listeners. The 19-07 anti-term grep exempts
 * this one occurrence for the toaster napplet only.
 *
 * Anti-features (still enforced): no NIP-01 arrays, no BusKind, no window.nostr,
 * no signer-service, no kind === 29001/29002. Shim handles AUTH implicitly
 * — shim fires AUTHENTICATED from bootstrap; no probe needed.
 */
import '@napplet/shim';
import { identity } from '@napplet/sdk';

const statusEl = document.getElementById('toaster-status')!;
const titleEl = document.getElementById('toaster-title') as HTMLInputElement;
const bodyEl = document.getElementById('toaster-body') as HTMLInputElement;
const notifyBtn = document.getElementById('toaster-notify-btn')!;
const dismissAllBtn = document.getElementById('toaster-dismiss-all-btn')!;
const listEl = document.getElementById('toaster-list')!;
const logEl = document.getElementById('toaster-log')!;

// Track in-flight create requests by correlation id so we can map notify.created
// replies back to the title/body the user submitted (for the local <li> render).
interface PendingCreate { title: string; body: string; }
const pendingCreates = new Map<string, PendingCreate>();

function formatError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;
  return fallback;
}

function log(text: string): void {
  const div = document.createElement('div');
  div.className = 'toaster-log-entry';
  const time = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  div.textContent = `${time} ${text}`;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(text: string, color: 'gray' | 'green' | 'red' = 'gray'): void {
  statusEl.textContent = text;
  statusEl.style.color = color === 'green' ? '#39ff14' : color === 'red' ? '#ff3b3b' : '#888';
}

function makeCorrelationId(): string {
  return `toaster-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function appendListItem(notifId: string, title: string, body: string): void {
  const li = document.createElement('li');
  li.className = 'toaster-list-item';
  li.dataset.notifId = notifId;
  li.textContent = `${title} — ${body}`;
  listEl.appendChild(li);
}

function removeListItem(notifId: string): void {
  const li = listEl.querySelector(`li[data-notif-id="${notifId}"]`);
  if (li) li.remove();
}

function clearList(): void {
  listEl.innerHTML = '';
}

/**
 * Dispatch a notify.create envelope. Reply (notify.created) arrives via the
 * message handler below; we store the title/body in pendingCreates so the
 * reply handler can render the <li> with the shell-assigned id.
 */
function notifyCreate(title: string, body: string): void {
  const id = makeCorrelationId();
  pendingCreates.set(id, { title, body });
  log(`notify.create dispatch — correlation: ${id}`);
  window.parent.postMessage({ type: 'notify.create', id, title, body }, '*');
}

/**
 * Dispatch a notify.list envelope. Reply (notify.listed) arrives via the handler.
 * We use this only as part of the Dismiss all flow.
 */
let pendingListId: string | null = null;
function notifyList(): void {
  pendingListId = makeCorrelationId();
  log(`notify.list dispatch — correlation: ${pendingListId}`);
  window.parent.postMessage({ type: 'notify.list', id: pendingListId }, '*');
}

/**
 * Dispatch a notify.dismiss envelope for a specific id. Fire-and-forget per
 * notification-service.ts (no notify.dismissed reply emitted by the service).
 * We optimistically remove the local <li>.
 */
function notifyDismiss(notifId: string): void {
  const id = makeCorrelationId();
  log(`notify.dismiss dispatch — id: ${notifId}`);
  window.parent.postMessage({ type: 'notify.dismiss', id, notificationId: notifId }, '*');
  removeListItem(notifId);
}

notifyBtn.addEventListener('click', () => {
  const title = titleEl.value.trim() || 'Hello';
  const body = bodyEl.value.trim() || 'World';
  notifyCreate(title, body);
});

dismissAllBtn.addEventListener('click', () => {
  // First enumerate active notifications, then dismiss each — the handler
  // below processes the notify.listed reply and dispatches notify.dismiss per id.
  notifyList();
});

/**
 * THE ONLY raw message listener in this napplet (Plan 19-03 explicit deviation).
 *
 * Justified because @napplet/sdk does not expose notify.create / notify.list
 * (Plan 19-03 SDK gap — see file-header notice). This handler:
 *   - Guards on event.source === window.parent (drop messages from other origins)
 *   - Guards on event.data being a plain object with a string `type` starting with 'notify.'
 *   - Handles notify.created (correlate via id, render <li>)
 *   - Handles notify.listed (per-id dispatch notify.dismiss for the dismiss-all flow)
 *   - Ignores all other envelope types (storage.*, ifc.*, etc.)
 */
window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window.parent) return;
  const data = event.data as Record<string, unknown> | null;
  if (!data || typeof data !== 'object') return;
  const type = data.type;
  if (typeof type !== 'string' || !type.startsWith('notify.')) return;

  if (type === 'notify.created') {
    // notification-service emits { type: 'notify.created', id: <shell-assigned-id> }
    // (the 'id' on the reply IS the shell-assigned notification id, NOT the request
    // correlation id — verified from packages/services/src/notification-service.ts:151).
    const notifId = typeof data.id === 'string' ? data.id : '';
    if (!notifId) return;
    // Best-effort: pop any pending create record (there may be multiple in flight,
    // but the reply doesn't carry the correlation id back — pop oldest as approximation).
    const firstKey = pendingCreates.keys().next().value as string | undefined;
    const meta = firstKey ? pendingCreates.get(firstKey) : undefined;
    if (firstKey) pendingCreates.delete(firstKey);
    const title = meta?.title ?? '(unknown title)';
    const body = meta?.body ?? '';
    appendListItem(notifId, title, body);
    log(`notify.created received — id: ${notifId.slice(0, 16)}`);
  } else if (type === 'notify.listed') {
    // notification-service emits { type: 'notify.listed', notifications: Notification[] }
    // (verified from packages/services/src/notification-service.ts:189).
    const items = Array.isArray(data.notifications) ? data.notifications : [];
    log(`notify.listed received — ${items.length} item(s)`);
    // Dispatch dismiss for each (fire-and-forget; service does not reply to dismiss).
    for (const item of items as { id: string }[]) {
      if (item && typeof item.id === 'string') notifyDismiss(item.id);
    }
    // After the loop, also clear the local list defensively (in case our local state
    // drifted from the service state — this guarantees Dismiss all empties the UL).
    clearList();
    pendingListId = null;
  } else if (type === 'notify.create.error' || type === 'notify.list.error' || type === 'notify.dismiss.error') {
    // ACL denial path — runtime emits a {type: '<type>.error', id, error: 'denied: ...'}
    // envelope when a capability check fails (verified packages/runtime/src/runtime.ts:1123).
    const reason = typeof data.error === 'string' ? data.error : 'denied: notify:send';
    setStatus(`denied: ${reason}`, 'red');
    log(`notify denied — ${reason}`);
  }
});

// Initialize: a single identity.getPublicKey() call triggers the shell's Path B
// AUTH detection (first napplet->shell envelope flips the outer topology card
// sentinel) without the vestigial storage probe deleted in Phase 36-01.
// notify.* flows still run from button handlers + the one documented message listener.
async function init(): Promise<void> {
  await identity.getPublicKey();
  setStatus('authenticated', 'green');
  log('ready to notify');
}

init().catch((err) => {
  setStatus('auth failed', 'red');
  log(`init failed — ${formatError(err, 'init failure')}`);
});
