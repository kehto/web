/**
 * Hotkey-chord demo napplet — exercises real keys backend (KEYS-03, Phase 26).
 *
 * Per CONTEXT.md Area 3 + Area 1 + 26-CONTEXT.md checker blocker 1 fix:
 *   - On init: calls `await keysRegisterAction({...})` via the NUB keys helper.
 *     The helper owns the correlation ID and Promise resolution on the shell's
 *     keys.registerAction.result envelope.
 *   - On each keys.action push from the shell (emitted by Plan 26-01 on chord
 *     match), `keysOnAction('hotkey-chord.demo', () => ...)` fires — the helper
 *     internally routes keys.action envelopes to the right callback.
 *   - #hotkey-chord-status transitions: 'connecting...' → 'subscribed'
 *   - After the Playwright spec (Plan 26-04) dispatches Ctrl+Shift+K on the host page,
 *     the service's document keydown listener fires, pushes keys.action to this napplet,
 *     the helper routes it to the onAction callback, and this file updates the DOM.
 *
 * Anti-features (enforced per v1.4 milestone — see Phase 26 acceptance greps):
 *   - no raw postMessage listener — uses @napplet/nub/keys/sdk helpers exclusively
 *   - no direct nostr/signer/legacy-bus imports
 *   - no hand-rolled correlation IDs (helper owns them)
 */
import '@napplet/shim';
import { keysOnAction, keysRegisterAction } from '@napplet/nub/keys/sdk';

const REQUIRED_NUBS = ['keys'] as const;

const DEFAULT_KEY = 'Ctrl+Shift+K';
const ACTION_ID = 'hotkey-chord.demo';

const statusEl = document.getElementById('hotkey-chord-status')!;
const countEl = document.getElementById('hotkey-chord-count')!;
const lastEl = document.getElementById('hotkey-chord-last')!;
const logEl = document.getElementById('hotkey-chord-log')!;

function setStatus(text: string, color: 'gray' | 'green' | 'red' = 'gray'): void {
  statusEl.textContent = text;
  statusEl.style.color = color === 'green' ? '#39ff14' : color === 'red' ? '#ff3b3b' : '#888';
}

function getMissingRequiredNubs(): string[] {
  const supports = (window as unknown as {
    napplet: { shell: { supports(capability: string): boolean } };
  }).napplet.shell.supports;
  return REQUIRED_NUBS.filter((capability) => !supports(capability));
}

function log(text: string): void {
  const div = document.createElement('div');
  div.className = 'hotkey-log-entry';
  const time = new Date().toLocaleTimeString('en', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  div.textContent = `${time} ${text}`;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

let deliveryCount = 0;

async function init(): Promise<void> {
  const missing = getMissingRequiredNubs();
  if (missing.length > 0) {
    throw new Error(`unsupported NUB capability: ${missing.join(', ')}`);
  }

  log(`registering action (${DEFAULT_KEY})`);

  // Register the action via the keys helper. The helper owns correlation + Promise
  // resolution on the shell's keys.registerAction.result envelope.
  const result = await keysRegisterAction({
    id: ACTION_ID,
    label: 'Hotkey Chord Demo',
    defaultKey: DEFAULT_KEY,
  });
  setStatus('subscribed', 'green');
  log(`keys.registerAction.result — actionId=${result.actionId} binding=${result.binding ?? 'none'}`);

  // Subscribe to keys.action pushes from the shell. The helper's onAction callback
  // signature is `() => void`, so we format the displayed chord from our own
  // registered DEFAULT_KEY.
  keysOnAction(ACTION_ID, () => {
    deliveryCount += 1;
    countEl.textContent = String(deliveryCount);
    lastEl.textContent = DEFAULT_KEY;
    log(`keys.action received — ${DEFAULT_KEY}`);
  });
}

init().catch((err) => {
  if (statusEl.textContent === 'connecting...') {
    setStatus('register failed', 'red');
    log(`init failed — ${err instanceof Error ? err.message : String(err)}`);
  }
});
