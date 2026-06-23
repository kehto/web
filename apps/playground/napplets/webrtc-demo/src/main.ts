/**
 * webrtc-demo napplet -- sends NAP-WEBRTC envelopes and renders shell decisions.
 */
import '@napplet/shim';
import type {
  WebrtcCloseResultMessage,
  WebrtcEvent,
  WebrtcEventMessage,
  WebrtcOpenResultMessage,
  WebrtcSendResultMessage,
} from '@napplet/nap/webrtc/types';

const REQUIRED_NAPS = ['webrtc'] as const;
const CAPABILITY_WAIT_MS = 5_000;
const CAPABILITY_WAIT_INTERVAL_MS = 25;
const REQUEST_TIMEOUT_MS = 10_000;

const statusEl = document.getElementById('webrtc-demo-status')!;
const sessionEl = document.getElementById('webrtc-demo-session')!;
const stateEl = document.getElementById('webrtc-demo-state')!;
const messageEl = document.getElementById('webrtc-demo-message')!;
const closedEl = document.getElementById('webrtc-demo-closed')!;

function setStatus(text: string, color: 'gray' | 'green' | 'red' = 'gray'): void {
  statusEl.textContent = text;
  statusEl.style.color =
    color === 'green'
      ? 'var(--nap-theme-success, #39ff14)'
      : color === 'red'
        ? 'var(--nap-theme-danger, #ff3b3b)'
        : 'var(--nap-theme-muted, #888)';
}

function getMissingRequiredNaps(): string[] {
  const supports = window.napplet.shell.supports as (capability: string) => boolean;
  return REQUIRED_NAPS.filter((capability) => !supports(capability));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForRequiredNaps(): Promise<void> {
  const deadline = Date.now() + CAPABILITY_WAIT_MS;
  let missing = getMissingRequiredNaps();
  while (missing.length > 0 && Date.now() < deadline) {
    await sleep(CAPABILITY_WAIT_INTERVAL_MS);
    missing = getMissingRequiredNaps();
  }
  if (missing.length > 0) {
    throw new Error(`unsupported NAP capability: ${missing.join(', ')}`);
  }
}

function newRequestId(label: string): string {
  return `webrtc-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isWebrtcEventMessage(value: unknown): value is WebrtcEventMessage {
  return (
    typeof value === 'object'
    && value !== null
    && (value as { type?: unknown }).type === 'webrtc.event'
    && typeof (value as { event?: unknown }).event === 'object'
    && (value as { event?: unknown }).event !== null
  );
}

function requestWebrtc<T extends { type: string; id: string }>(
  message: { type: string; id: string; [key: string]: unknown },
  resultType: T['type'],
  onEvent?: (event: WebrtcEvent) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error(`${message.type} timed out`));
    }, REQUEST_TIMEOUT_MS);

    // Phase 58 raw-message allowlist: demo waits for shell-owned NAP results/events.
    function onMessage(event: MessageEvent): void {
      if (event.source !== window.parent) return;
      if (isWebrtcEventMessage(event.data)) {
        onEvent?.(event.data.event);
        return;
      }
      const msg = event.data as Partial<T> | null;
      if (!msg || msg.type !== resultType || msg.id !== message.id) return;
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      resolve(msg as T);
    }

    window.addEventListener('message', onMessage);
    window.parent.postMessage(message, '*');
  });
}

function renderEvent(event: WebrtcEvent): void {
  if (event.type === 'state') stateEl.textContent = event.state;
  if (event.type === 'message') {
    const body = typeof event.payload === 'object' && event.payload !== null
      ? (event.payload as { body?: unknown }).body
      : event.payload;
    messageEl.textContent = String(body ?? 'message');
  }
  if (event.type === 'closed') closedEl.textContent = event.reason ?? 'closed';
}

async function init(): Promise<void> {
  await waitForRequiredNaps();
  setStatus('running webrtc', 'gray');

  const open = await requestWebrtc<WebrtcOpenResultMessage>({
    type: 'webrtc.open',
    id: newRequestId('open'),
    request: {
      scope: { type: 'direct', pubkey: '7'.repeat(64) },
      channel: 'chat',
      protocol: 'chat:live',
    },
  }, 'webrtc.open.result', renderEvent);
  if (!open.session?.id) throw new Error(open.error ?? 'webrtc open failed');

  const send = await requestWebrtc<WebrtcSendResultMessage>({
    type: 'webrtc.send',
    id: newRequestId('send'),
    sessionId: open.session.id,
    payload: { body: 'hello-webrtc' },
  }, 'webrtc.send.result', renderEvent);
  if (send.error) throw new Error(send.error);

  const close = await requestWebrtc<WebrtcCloseResultMessage>({
    type: 'webrtc.close',
    id: newRequestId('close'),
    sessionId: open.session.id,
    reason: 'demo complete',
  }, 'webrtc.close.result', renderEvent);
  if (close.error) throw new Error(close.error);

  sessionEl.textContent = open.session.channel;
  if (stateEl.textContent === 'pending') stateEl.textContent = open.session.state;
  if (closedEl.textContent !== 'demo complete') closedEl.textContent = 'ok';
  setStatus('opened:chat; sent:ok; event:hello-webrtc; closed:demo complete', 'green');
}

init().catch((err) => {
  setStatus('init failed', 'red');
  closedEl.textContent = err instanceof Error ? err.message : String(err);
});
