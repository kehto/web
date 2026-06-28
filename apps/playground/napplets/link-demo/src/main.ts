/**
 * link-demo napplet -- sends NAP-LINK envelopes and renders shell decisions.
 */
import '@napplet/shim';
import { getMissingNapDomains } from '../../domain-availability';
import type { LinkOpenMessage, LinkOpenResultMessage } from '@napplet/nap/link/types';

const REQUIRED_NAPS = ['link'] as const;
const CAPABILITY_WAIT_MS = 5_000;
const CAPABILITY_WAIT_INTERVAL_MS = 25;
const LINK_REQUEST_TIMEOUT_MS = 15_000;

const statusEl = document.getElementById('link-demo-status')!;
const openedEl = document.getElementById('link-demo-opened')!;
const deniedEl = document.getElementById('link-demo-denied')!;

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
  return `link-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function openLink(url: string, label: string): Promise<LinkOpenResultMessage> {
  const id = newRequestId(label);
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error(`link.open timed out for ${label}`));
    }, LINK_REQUEST_TIMEOUT_MS);

    // Phase 58 raw-message allowlist: demo waits for one shell-owned NAP result.
    function onMessage(event: MessageEvent): void {
      if (event.source !== window.parent) return;
      const msg = event.data as Partial<LinkOpenResultMessage> | null;
      if (!msg || msg.type !== 'link.open.result' || msg.id !== id) return;
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      resolve(msg as LinkOpenResultMessage);
    }

    window.addEventListener('message', onMessage);
    const message: LinkOpenMessage = {
      type: 'link.open',
      id,
      url,
      options: { label },
    };
    window.parent.postMessage(message, '*');
  });
}

async function init(): Promise<void> {
  await waitForRequiredNaps();
  setStatus('opening links', 'gray');

  const opened = await openLink('https://example.com/kehto-link-demo', 'Open allowed demo link');
  openedEl.textContent = opened.status;

  const denied = await openLink('file:///etc/passwd', 'Open denied demo link');
  deniedEl.textContent = denied.status;

  setStatus(`allowed:${opened.status}; denied:${denied.status}`, 'green');
}

init().catch((err) => {
  setStatus('init failed', 'red');
  deniedEl.textContent = err instanceof Error ? err.message : String(err);
});
