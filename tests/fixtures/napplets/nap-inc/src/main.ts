/**
 * nap-inc fixture — exercises incOn + incEmit (E2E-09).
 *
 * Layer-A spec drives this via __loadNapplet__('nap-inc') and asserts:
 *   - #nap-status flips to 'ready' (after incOn subscribe.result resolves)
 *   - When the spec injects an inc.event envelope (via __injectEnvelope__), the
 *     fixture's listener appends a line to #nap-inc-log
 *   - When the spec clicks #nap-inc-emit-btn, the harness sees an inc.emit envelope
 *     via __getNapMessage__(windowId, 'inc.emit')
 *
 * Anti-features: NO raw window.addEventListener — uses incOn() exclusively for cross-frame.
 */
// NIP-5D: the host injects window.napplet and sends the single napplet.hello
// before this script runs. Importing @napplet/shim would install a second
// namespace and hello, which revokes the napplet (nostr-protocol/nips#2303).
import { incEmit, incOn } from '@napplet/nap/inc/sdk';

const statusEl = document.getElementById('nap-status')!;
const logEl = document.getElementById('nap-inc-log')!;
const emitBtn = document.getElementById('nap-inc-emit-btn') as HTMLButtonElement;

const TOPIC = 'nap-inc-test';

function fmt(err: unknown, fb: string): string {
  return err instanceof Error && err.message ? err.message : (typeof err === 'string' && err.length > 0 ? err : fb);
}

function readIncPayload(value: unknown, packageEvent?: unknown): unknown {
  if (packageEvent !== undefined) return value;
  if (!value || typeof value !== 'object') return value;
  const event = value as Record<string, unknown>;
  return typeof event.topic === 'string' && typeof event.sender === 'string'
    ? event.payload
    : value;
}

function init(): void {
  try {
    // incOn triggers an inc.subscribe envelope to the runtime. Runtime emits
    // inc.subscribe.result back; the SDK callback fires when inc.event matches the topic.
    incOn(TOPIC, (value, packageEvent) => {
      const payload = readIncPayload(value, packageEvent);
      const div = document.createElement('div');
      div.className = 'inc-event';
      div.textContent = typeof payload === 'string' ? payload : JSON.stringify(payload);
      logEl.appendChild(div);
    });
    statusEl.textContent = 'ready';
  } catch (err) {
    statusEl.textContent = `denied:${fmt(err, 'inc:subscribe')}`;
  }
}

emitBtn.addEventListener('click', () => {
  try {
    incEmit(TOPIC, { ts: Date.now(), src: 'nap-inc' });
  } catch (err) {
    statusEl.textContent = `emit-denied:${fmt(err, 'inc:emit')}`;
  }
});

init();
