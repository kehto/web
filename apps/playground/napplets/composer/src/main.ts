/**
 * Composer demo napplet — exercises relay.publish + relay.publishEncrypted (NAP-03, Phase 19).
 *
 * Per CONTEXT D-02:
 *   - On click of #composer-publish-btn, publish kind:1 event with content from #composer-input
 *   - If #composer-encrypted-toggle is checked, route through relayPublishEncrypted (NIP-44 default)
 *   - #composer-status reflects: 'connecting...' -> 'ready' -> 'published: <id>' or 'denied: <reason>'
 *   - #composer-log shows a per-attempt log line for debugger visibility
 *
 * Anti-features (per v1.3 milestone): no raw window message protocol listener, no NIP-01 arrays,
 *   no legacy bus enums, no global nostr accessor. Shim handles NIP-5D envelopes.
 */
import '@napplet/shim';
import { relayPublish, relayPublishEncrypted } from '@napplet/nub/relay/sdk';
import type { EventTemplate } from '@napplet/core';

const REQUIRED_NUBS = ['relay'] as const;

const statusEl = document.getElementById('composer-status')!;
const inputEl = document.getElementById('composer-input') as HTMLInputElement;
const encryptedToggleEl = document.getElementById('composer-encrypted-toggle') as HTMLInputElement;
const recipientEl = document.getElementById('composer-recipient') as HTMLInputElement;
const publishBtn = document.getElementById('composer-publish-btn')!;
const logEl = document.getElementById('composer-log')!;

function formatError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;
  return fallback;
}

function log(text: string): void {
  const div = document.createElement('div');
  div.className = 'composer-log-entry';
  const time = new Date().toLocaleTimeString('en', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  div.textContent = `${time} ${text}`;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(text: string, color: 'gray' | 'green' | 'red' = 'gray'): void {
  statusEl.textContent = text;
  statusEl.style.color = color === 'green' ? '#39ff14' : color === 'red' ? '#ff3b3b' : '#888';
}

function getMissingRequiredNubs(): string[] {
  const supports = window.napplet.shell.supports;
  return REQUIRED_NUBS.filter((capability) => !supports(capability));
}

async function publish(): Promise<void> {
  const content = inputEl.value.trim();
  if (!content) {
    setStatus('empty input — skipped', 'red');
    return;
  }

  const template: EventTemplate = {
    kind: 1,
    content,
    tags: [['t', 'demo-composer']],
    created_at: Math.floor(Date.now() / 1000),
  };

  const isEncrypted = encryptedToggleEl.checked;

  try {
    if (isEncrypted) {
      // CONTEXT D-02: NIP-44 default — explicit recipient. If empty, use a deterministic
      // demo placeholder pubkey (32 bytes hex) so the spec can drive an encrypted publish
      // without needing a real NIP-46 key exchange.
      const recipient =
        recipientEl.value.trim() ||
        '0000000000000000000000000000000000000000000000000000000000000001';
      log(`relay.publishEncrypted attempt — recipient: ${recipient.slice(0, 12)}...`);
      const result = await relayPublishEncrypted(template, recipient, 'nip44');
      const eventId = (result as { id?: string } | undefined)?.id ?? 'unknown';
      setStatus(`published: ${eventId.slice(0, 16)}`, 'green');
      log(`relay.publishEncrypted OK — id: ${eventId.slice(0, 16)}`);
    } else {
      log('relay.publish attempt');
      const result = await relayPublish(template);
      const eventId = (result as { id?: string } | undefined)?.id ?? 'unknown';
      setStatus(`published: ${eventId.slice(0, 16)}`, 'green');
      log(`relay.publish OK — id: ${eventId.slice(0, 16)}`);
    }
  } catch (error) {
    const reason = formatError(
      error,
      isEncrypted ? 'denied: relay:write (encrypted)' : 'denied: relay:write',
    );
    setStatus(`denied: ${reason}`, 'red');
    log(`publish failed — ${reason}`);
  }
}

publishBtn.addEventListener('click', () => {
  void publish();
});
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') void publish();
});

// Initialize the napplet without an identity probe. NIP-5D identity is assigned
// by the shell at iframe creation; the relay NUB is the only required runtime
// capability for this demo.
async function init(): Promise<void> {
  const missing = getMissingRequiredNubs();
  if (missing.length > 0) {
    throw new Error(`unsupported NUB capability: ${missing.join(', ')}`);
  }
  setStatus('ready', 'green');
  log('ready to publish');
}

init().catch((err) => {
  setStatus('unavailable', 'red');
  log(`init failed — ${formatError(err, 'init failure')}`);
});
