/**
 * lists-demo napplet -- sends NAP-LISTS envelopes and renders shell decisions.
 */
import '@napplet/shim';
import { getMissingNapDomains } from '../../domain-availability';
import type {
  ListsAddResultMessage,
  ListsRemoveResultMessage,
  ListsSupportedResultMessage,
} from '@napplet/nap/lists/types';

const REQUIRED_NAPS = ['lists'] as const;
const CAPABILITY_WAIT_MS = 5_000;
const CAPABILITY_WAIT_INTERVAL_MS = 25;
const REQUEST_TIMEOUT_MS = 10_000;
const EVENT_ID = '6'.repeat(64);

const statusEl = document.getElementById('lists-demo-status')!;
const supportedEl = document.getElementById('lists-demo-supported')!;
const addedEl = document.getElementById('lists-demo-added')!;
const removedEl = document.getElementById('lists-demo-removed')!;

function setStatus(text: string, color: 'gray' | 'green' | 'red' = 'gray'): void {
  statusEl.textContent = text;
  statusEl.style.color =
    color === 'green'
      ? 'var(--nap-theme-success, #39ff14)'
      : color === 'red'
        ? 'var(--nap-theme-danger, #ff3b3b)'
        : 'var(--nap-theme-muted, #888)';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForRequiredNaps(): Promise<void> {
  const deadline = Date.now() + CAPABILITY_WAIT_MS;
  let missing = getMissingNapDomains(REQUIRED_NAPS);
  while (missing.length > 0 && Date.now() < deadline) {
    await sleep(CAPABILITY_WAIT_INTERVAL_MS);
    missing = getMissingNapDomains(REQUIRED_NAPS);
  }
  if (missing.length > 0) {
    throw new Error(`unsupported NAP capability: ${missing.join(', ')}`);
  }
}

function newRequestId(label: string): string {
  return `lists-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function requestLists<T extends { type: string; id: string }>(message: { type: string; id: string; [key: string]: unknown }, resultType: T['type']): Promise<T> {
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
  setStatus('running lists', 'gray');

  const supported = await requestLists<ListsSupportedResultMessage>({
    type: 'lists.supported',
    id: newRequestId('supported'),
  }, 'lists.supported.result');
  const list = { type: 'bookmarks' };
  const items = [{ itemType: 'event', value: EVENT_ID, relay: 'wss://relay.example' }];
  const add = await requestLists<ListsAddResultMessage>({
    type: 'lists.add',
    id: newRequestId('add'),
    list,
    items,
    options: { create: true },
  }, 'lists.add.result');
  const remove = await requestLists<ListsRemoveResultMessage>({
    type: 'lists.remove',
    id: newRequestId('remove'),
    list,
    items,
  }, 'lists.remove.result');

  const supportedType = supported.lists?.[0]?.type ?? 'missing';
  const added = String(add.added ?? 0);
  const removed = String(remove.removed ?? 0);

  supportedEl.textContent = supportedType;
  addedEl.textContent = added;
  removedEl.textContent = removed;
  setStatus(`supported:${supportedType}; added:${added}; removed:${removed}`, 'green');
}

init().catch((err) => {
  setStatus('init failed', 'red');
  removedEl.textContent = err instanceof Error ? err.message : String(err);
});
