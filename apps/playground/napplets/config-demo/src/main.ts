/**
 * config-demo napplet -- exercises NUB-CONFIG (CONFIG-03, v1.7 Phase 39 / D9).
 *
 * On init:
 *   1. configSubscribe(values => updateUI(values)) -- starts the live push stream.
 *      Shell emits an immediate initial config.values snapshot per NUB-CONFIG spec.
 *   2. configGet() -- separately requests a correlated snapshot (redundant with
 *      the subscribe initial push, but exercises the one-shot path for Plan 39-05's
 *      nub-config.spec.ts E2E assertion).
 *
 * Sentinels:
 *   - #config-demo-status -- 'connecting...' -> 'subscribed' -> 'received N pushes'
 *   - #config-demo-values -- JSON.stringify(values); E2E reads via frameLocator.
 *
 * Anti-features (v1.3 discipline):
 *   - NO <meta http-equiv="Content-Security-Policy"> in index.html (C-03)
 *   - NO raw window.addEventListener('message') (uses @napplet/shim)
 *   - NO window.nostr lookups (forbidden everywhere under NIP-5D)
 *   - NO config.set wire message (CONFIG-04 scope boundary)
 */
import '@napplet/shim';
import { get as configGet, subscribe as configSubscribe } from '@napplet/nub/config/sdk';

const REQUIRED_NUBS = ['config'] as const;

const statusEl = document.getElementById('config-demo-status')!;
const valuesEl = document.getElementById('config-demo-values')!;
const logEl = document.getElementById('config-demo-log')!;

function setStatus(text: string, color: 'gray' | 'green' | 'red' = 'gray'): void {
  statusEl.textContent = text;
  statusEl.style.color = color === 'green' ? '#39ff14' : color === 'red' ? '#ff3b3b' : '#888';
}

function log(text: string): void {
  const div = document.createElement('div');
  const time = new Date().toLocaleTimeString('en', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  div.textContent = `${time} ${text}`;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

function getMissingRequiredNubs(): string[] {
  const supports = window.napplet.shell.supports;
  return REQUIRED_NUBS.filter((capability) => !supports(capability));
}

function updateUI(values: Record<string, unknown>): void {
  // Write the full JSON snapshot into the sentinel -- deterministic for E2E.
  valuesEl.textContent = JSON.stringify(values, null, 2);
}

let pushCount = 0;

async function init(): Promise<void> {
  try {
    const missing = getMissingRequiredNubs();
    if (missing.length > 0) {
      throw new Error(`unsupported NUB capability: ${missing.join(', ')}`);
    }

    setStatus('subscribing...', 'gray');
    // Live push stream -- receives initial snapshot + every subsequent change.
    configSubscribe((values: Record<string, unknown>) => {
      pushCount++;
      updateUI(values);
      setStatus(`received ${pushCount} push(es)`, 'green');
      log(`config.values push #${pushCount} -- keys: ${Object.keys(values).join(',')}`);
    });
    log('config.subscribe dispatched');

    // One-shot read -- separate code path per wire spec (correlated via id).
    const snapshot = await configGet();
    log(`config.get completed -- keys: ${Object.keys(snapshot as Record<string, unknown>).join(',')}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(`error: ${msg}`, 'red');
    log(`init failed -- ${msg}`);
  }
}

init().catch((err) => {
  setStatus('init failed', 'red');
  log(`unhandled init error -- ${err instanceof Error ? err.message : String(err)}`);
});
