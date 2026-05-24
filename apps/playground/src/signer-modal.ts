/**
 * signer-modal.ts — Connect modal for NIP-07 and NIP-46 signer flows.
 *
 * Presents NIP-07 browser extension and NIP-46 bunker as equal first-class
 * connection options. Hosts the editable NIP-46 relay field (modal-only).
 * Generates a nostrconnect:// QR code for mobile bunker scanning.
 */

import {
  connectNip07,
  connectNip46,
  onStateChange,
  getSignerConnectionState,
  recordSignerRequest,
} from './signer-connection.js';
import {
  parseBunkerUri,
  buildNostrConnectUri,
  createNip46Client,
} from './nip46-client.js';
import { getIdentityServiceHandler } from './shell-host.js';
import type { NappletMessage } from '@kehto/shell';
import { getPublicKey, generateSecretKey } from 'nostr-tools/pure';
import QRCode from 'qrcode';

/** Ephemeral requester keypair for displaying the nostrconnect:// QR. */
const _qrSecretKey = generateSecretKey();
const _qrLocalPubkey = getPublicKey(_qrSecretKey);

function getModal(): HTMLElement | null {
  return document.getElementById('signer-connect-modal');
}

function getNip07StatusEl(): HTMLElement | null {
  return document.getElementById('nip07-status');
}

function getNip46StatusEl(): HTMLElement | null {
  return document.getElementById('nip46-status');
}

function getNip07ConnectBtn(): HTMLButtonElement | null {
  return document.getElementById('nip07-connect-btn') as HTMLButtonElement | null;
}

function getNip46ConnectBtn(): HTMLButtonElement | null {
  return document.getElementById('nip46-connect-btn') as HTMLButtonElement | null;
}

function getRelayInput(): HTMLInputElement | null {
  return document.getElementById('nip46-relay-input') as HTMLInputElement | null;
}

function getBunkerUriInput(): HTMLInputElement | null {
  return document.getElementById('nip46-bunker-uri-input') as HTMLInputElement | null;
}

function getQrContainer(): HTMLElement | null {
  return document.getElementById('nip46-qr-container');
}

function getQrRelayNote(): HTMLElement | null {
  return document.getElementById('nip46-qr-relay-note');
}

function setStatus(el: HTMLElement | null, text: string, type: 'error' | 'success' | 'connecting' | ''): void {
  if (!el) return;
  el.textContent = text;
  el.className = 'signer-option-status' + (type ? ` ${type}` : '');
}

async function renderQrCode(relayUrl: string): Promise<void> {
  const container = getQrContainer();
  const relayNote = getQrRelayNote();
  if (!container) return;

  const uri = buildNostrConnectUri(relayUrl, _qrLocalPubkey);

  if (relayNote) {
    relayNote.textContent = `relay: ${relayUrl}`;
  }

  try {
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, uri, {
      width: 160,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });
    container.replaceChildren(canvas);
  } catch {
    const fallback = document.createElement('div');
    fallback.className = 'signer-qr-fallback';
    fallback.textContent = uri;
    container.replaceChildren(fallback);
  }
}

/**
 * Open the signer connect modal.
 */
export function openSignerModal(): void {
  const modal = getModal();
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'false');

  // Reset status fields
  setStatus(getNip07StatusEl(), '', '');
  setStatus(getNip46StatusEl(), '', '');

  // Re-enable buttons
  const nip07Btn = getNip07ConnectBtn();
  if (nip07Btn) nip07Btn.disabled = false;
  const nip46Btn = getNip46ConnectBtn();
  if (nip46Btn) nip46Btn.disabled = false;

  const relayInput = getRelayInput();
  const relayUrl = relayInput?.value.trim() || 'wss://relay.nsec.app';
  renderQrCode(relayUrl).catch(() => { /* best-effort */ });
}

/**
 * Close the signer connect modal.
 */
export function closeSignerModal(): void {
  const modal = getModal();
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'true');
}

async function handleNip07Connect(): Promise<void> {
  const btn = getNip07ConnectBtn();
  const statusEl = getNip07StatusEl();

  if (btn) btn.disabled = true;
  setStatus(statusEl, 'Connecting...', 'connecting');

  await connectNip07();

  const state = getSignerConnectionState();
  if (state.error) {
    setStatus(statusEl, state.error, 'error');
    if (btn) btn.disabled = false;
  } else if (state.method === 'nip07' && state.pubkey) {
    setStatus(statusEl, `Connected: ${state.pubkey.substring(0, 12)}...`, 'success');
    await runIdentityProbe(state.pubkey);
    setTimeout(() => closeSignerModal(), 1500);
  }
}

async function handleNip46Connect(): Promise<void> {
  const btn = getNip46ConnectBtn();
  const statusEl = getNip46StatusEl();
  const relayInput = getRelayInput();
  const bunkerUriInput = getBunkerUriInput();

  const bunkerUriRaw = bunkerUriInput?.value.trim() ?? '';
  const relayOverride = relayInput?.value.trim() ?? '';

  const parsed = parseBunkerUri(bunkerUriRaw);
  if (!parsed) {
    setStatus(statusEl, 'Invalid bunker URI — expected bunker://<pubkey>?relay=...', 'error');
    return;
  }

  // Relay field takes precedence over URI relay
  const relayUrl = relayOverride || parsed.relay;

  if (btn) btn.disabled = true;
  setStatus(statusEl, 'Connecting to relay...', 'connecting');

  await connectNip46({
    relayUrl,
    bunkerPubkey: parsed.pubkey,
    secret: parsed.secret,
  });

  const state = getSignerConnectionState();
  if (state.error) {
    setStatus(statusEl, state.error, 'error');
    if (btn) btn.disabled = false;
  } else if (state.method === 'nip46' && state.pubkey) {
    const relayNote = state.relay ? ` via ${state.relay}` : '';
    setStatus(statusEl, `Connected: ${state.pubkey.substring(0, 12)}...${relayNote}`, 'success');
    await runIdentityProbe(state.pubkey);
    setTimeout(() => closeSignerModal(), 1500);
  }
}

const DEMO_HOST_PROBE_WINDOW_ID = '__demo-host-probe__';

/**
 * Post-connect diagnostic probe.
 * Dispatches `identity.getPublicKey` through the REAL identity service
 * (ShellAdapter.services.identity) — the same codepath a napplet would take.
 * Asserts the result matches the connected signer's pubkey.
 * No `window.nostr` access; no signer-service; no kind 29001.
 */
async function runIdentityProbe(expectedPubkey: string): Promise<void> {
  const handler = getIdentityServiceHandler();
  if (!handler) {
    console.warn('[signer-modal] identity service not registered — skipping probe');
    return;
  }
  const probeId = `probe-${Date.now().toString(36)}`;
  const request: NappletMessage = { type: 'identity.getPublicKey', id: probeId } as NappletMessage;
  await new Promise<void>((resolve) => {
    let responded = false;
    const timeout = setTimeout(() => {
      if (!responded) {
        console.warn('[signer-modal] identity.getPublicKey probe timed out');
        resolve();
      }
    }, 3000);
    handler.handleMessage(DEMO_HOST_PROBE_WINDOW_ID, request, (reply: NappletMessage) => {
      responded = true;
      clearTimeout(timeout);
      if (reply.type === 'identity.getPublicKey.result') {
        const returned = (reply as NappletMessage & { pubkey?: string }).pubkey;
        const matches = returned === expectedPubkey;
        recordSignerRequest({
          timestamp: Date.now(),
          method: 'identity.getPublicKey',
          success: matches,
        });
        if (!matches) {
          console.warn('[signer-modal] identity.getPublicKey mismatch', { expected: expectedPubkey, returned });
        }
      } else if (reply.type === 'identity.getPublicKey.error') {
        recordSignerRequest({
          timestamp: Date.now(),
          method: 'identity.getPublicKey',
          success: false,
        });
      }
      resolve();
    });
  });
}

/**
 * Initialize the signer connect modal.
 * Attaches event handlers for open, close, NIP-07 connect, and NIP-46 connect.
 * Subscribe to state changes to keep the modal in sync.
 * Call once after the DOM is ready.
 */
export function initSignerModal(): void {
  const modal = getModal();
  if (!modal) return;

  // Close on backdrop click (click outside the panel)
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeSignerModal();
  });

  // Close on X button
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-action="close-signer-modal"]')) {
      closeSignerModal();
    }
  });

  // NIP-07 connect
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-action="connect-nip07"]')) {
      handleNip07Connect().catch(() => { /* best-effort */ });
    }
  });

  // NIP-46 connect
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-action="connect-nip46"]')) {
      handleNip46Connect().catch(() => { /* best-effort */ });
    }
  });

  const relayInput = getRelayInput();
  if (relayInput) {
    relayInput.addEventListener('input', () => {
      const relayUrl = relayInput.value.trim() || 'wss://relay.nsec.app';
      renderQrCode(relayUrl).catch(() => { /* best-effort */ });
    });
  }

  // Subscribe to state changes to sync UI
  onStateChange((state) => {
    // If connected and modal is open, close it
    if (
      modal.getAttribute('aria-hidden') === 'false' &&
      state.method !== 'none' &&
      !state.isConnecting &&
      !state.error
    ) {
      // Modal close is handled in the connect handlers with a delay
    }
  });
}

// Re-export parseBunkerUri and createNip46Client for test access
export { parseBunkerUri, buildNostrConnectUri, createNip46Client };
