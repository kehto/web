/**
 * nub-ifc fixture — exercises ifcOn + ifcEmit (E2E-09).
 *
 * Layer-A spec drives this via __loadNapplet__('nub-ifc') and asserts:
 *   - #nub-status flips to 'ready' (after ifcOn subscribe.result resolves)
 *   - When the spec injects an ifc.event envelope (via __injectEnvelope__), the
 *     fixture's listener appends a line to #nub-ifc-log
 *   - When the spec clicks #nub-ifc-emit-btn, the harness sees an ifc.emit envelope
 *     via __getNubMessage__(windowId, 'ifc.emit')
 *
 * Anti-features: NO raw window.addEventListener — uses ifcOn() exclusively for cross-frame.
 */
import '@napplet/shim';
import { ifcEmit, ifcOn } from '@napplet/nub/ifc/sdk';

const statusEl = document.getElementById('nub-status')!;
const logEl = document.getElementById('nub-ifc-log')!;
const emitBtn = document.getElementById('nub-ifc-emit-btn') as HTMLButtonElement;

const TOPIC = 'nub-ifc-test';

function fmt(err: unknown, fb: string): string {
  return err instanceof Error && err.message ? err.message : (typeof err === 'string' && err.length > 0 ? err : fb);
}

function init(): void {
  try {
    // ifcOn triggers an ifc.subscribe envelope to the runtime. Runtime emits
    // ifc.subscribe.result back; the SDK callback fires when ifc.event matches the topic.
    ifcOn(TOPIC, (payload, _event) => {
      const div = document.createElement('div');
      div.className = 'ifc-event';
      div.textContent = typeof payload === 'string' ? payload : JSON.stringify(payload);
      logEl.appendChild(div);
    });
    statusEl.textContent = 'ready';
  } catch (err) {
    statusEl.textContent = `denied:${fmt(err, 'ifc:subscribe')}`;
  }
}

emitBtn.addEventListener('click', () => {
  try {
    ifcEmit(TOPIC, [], JSON.stringify({ ts: Date.now(), src: 'nub-ifc' }));
  } catch (err) {
    statusEl.textContent = `emit-denied:${fmt(err, 'ifc:emit')}`;
  }
});

init();
