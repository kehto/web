/**
 * serial-demo napplet -- sends NAP-SERIAL envelopes and renders shell decisions.
 */
import '@napplet/shim';
import type {
  SerialCloseResultMessage,
  SerialOpenResultMessage,
  SerialWriteResultMessage,
} from '@napplet/nap/serial/types';

const REQUIRED_NAPS = ['serial'] as const;
const CAPABILITY_WAIT_MS = 5_000;
const CAPABILITY_WAIT_INTERVAL_MS = 25;
const REQUEST_TIMEOUT_MS = 10_000;

const statusEl = document.getElementById('serial-demo-status')!;
const openedEl = document.getElementById('serial-demo-opened')!;
const writtenEl = document.getElementById('serial-demo-written')!;
const closedEl = document.getElementById('serial-demo-closed')!;

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
  return `serial-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function requestSerial<T extends { type: string; id: string }>(message: { type: string; id: string; [key: string]: unknown }, resultType: T['type']): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error(`${message.type} timed out`));
    }, REQUEST_TIMEOUT_MS);

    // Phase 58 raw-message allowlist: demo waits for one shell-owned NAP result.
    function onMessage(event: MessageEvent): void {
      if (event.source !== window.parent) return;
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

async function init(): Promise<void> {
  await waitForRequiredNaps();
  setStatus('running serial', 'gray');

  const open = await requestSerial<SerialOpenResultMessage>({
    type: 'serial.open',
    id: newRequestId('open'),
    request: {
      options: { baudRate: 9600 },
      label: 'demo serial',
    },
  }, 'serial.open.result');
  if (!open.session?.id) throw new Error(open.error ?? 'serial open failed');

  const write = await requestSerial<SerialWriteResultMessage>({
    type: 'serial.write',
    id: newRequestId('write'),
    sessionId: open.session.id,
    data: [104, 105],
  }, 'serial.write.result');
  if (write.error) throw new Error(write.error);

  const close = await requestSerial<SerialCloseResultMessage>({
    type: 'serial.close',
    id: newRequestId('close'),
    sessionId: open.session.id,
    reason: 'demo complete',
  }, 'serial.close.result');
  if (close.error) throw new Error(close.error);

  openedEl.textContent = open.session.info?.displayName ?? open.session.id;
  writtenEl.textContent = '2';
  closedEl.textContent = 'ok';
  setStatus('opened:Playground serial; written:2; closed:ok', 'green');
}

init().catch((err) => {
  setStatus('init failed', 'red');
  closedEl.textContent = err instanceof Error ? err.message : String(err);
});
