/**
 * Feed demo napplet — exercises relay.subscribe (NAP-06, Phase 20).
 *
 * Per CONTEXT D-02:
 *   - On init: subscribes via relaySubscribe({ kinds: [1], limit: 5 }, onEvent, onEose).
 *     Events arrive from the demo's in-memory mock relay pool (Plan 20-01, CONTEXT D-USER-01);
 *     5 fixture kind:1 events are delivered then EOSE fires.
 *   - #feed-status transitions: 'connecting...' → 'subscribed' → 'loaded (N)'
 *   - #feed-list renders one <li class="feed-item"> per received event with pubkey + content
 *
 * Anti-features (per v1.3 milestone): no raw window message protocol listener, no NIP-01 arrays,
 *   no legacy bus enums, no global nostr accessor. Shim handles NIP-5D envelopes.
 */
import '@napplet/shim';
import { relaySubscribe } from '@napplet/nub/relay/sdk';
import type { NostrEvent, Subscription } from '@napplet/core';

const REQUIRED_NUBS = ['relay'] as const;

const statusEl = document.getElementById('feed-status')!;
const listEl = document.getElementById('feed-list')!;
const logEl = document.getElementById('feed-log')!;

function formatError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;
  return fallback;
}

function log(text: string): void {
  const div = document.createElement('div');
  div.className = 'feed-log-entry';
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

let eventCount = 0;

function renderEvent(event: NostrEvent): void {
  const li = document.createElement('li');
  li.className = 'feed-item';
  li.dataset.eventId = event.id;
  const pubkeyShort = event.pubkey.slice(0, 8);
  const pubkeyEl = document.createElement('span');
  pubkeyEl.className = 'feed-item-pubkey';
  pubkeyEl.textContent = pubkeyShort;
  const contentEl = document.createElement('span');
  contentEl.className = 'feed-item-content';
  contentEl.textContent = event.content;
  li.append(pubkeyEl, contentEl);
  listEl.appendChild(li);
  eventCount++;
}

let sub: Subscription | null = null;

async function init(): Promise<void> {
  const missing = getMissingRequiredNubs();
  if (missing.length > 0) {
    throw new Error(`unsupported NUB capability: ${missing.join(', ')}`);
  }

  log('subscribing to kind:1 feed');

  try {
    sub = relaySubscribe(
      { kinds: [1], limit: 5 },
      (event: NostrEvent) => {
        try {
          renderEvent(event);
          log(`relay.event received — id: ${event.id.slice(0, 16)}`);
        } catch (err) {
          log(`renderEvent failed — ${formatError(err, 'unknown')}`);
        }
      },
      () => {
        setStatus(`loaded (${eventCount})`, 'green');
        log(`EOSE — ${eventCount} event(s) rendered`);
      },
    );
    // After relay.subscribe returns synchronously, we've emitted the subscribe envelope.
    // Update status immediately (onEvent may fire via microtask after this line runs).
    setStatus('subscribed', 'green');
    log('relay.subscribe dispatched — kinds:[1], limit:5');
  } catch (err) {
    const reason = formatError(err, 'denied: relay:read');
    setStatus(`denied: ${reason}`, 'red');
    log(`subscribe failed — ${reason}`);
    throw err;
  }
}

init().catch((err) => {
  // If status hasn't been set by the inner catch, set unavailable.
  if (statusEl.textContent === 'connecting...') {
    setStatus('unavailable', 'red');
    log(`init failed — ${formatError(err, 'NIP-5D capability/subscribe failure')}`);
  }
});
