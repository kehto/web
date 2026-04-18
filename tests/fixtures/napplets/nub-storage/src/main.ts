/**
 * nub-storage fixture — exercises storage.setItem + storage.getItem round-trip (E2E-09).
 *
 * On init: setItem('nub-storage-key', 'fixture-v1') then getItem of same key. Asserts
 * the round-trip via #nub-storage-value. Storage is localStorage-backed
 * (packages/shell/src/hooks-adapter.ts:256), scoped per napplet identity.
 *
 * Layer-A spec asserts:
 *   - #nub-status flips to 'authenticated' then 'value:<value>' or 'denied:*'
 *   - #nub-storage-value === 'fixture-v1' on success
 *   - __getNubMessage__(windowId, 'storage.setItem') and 'storage.getItem' both return non-null
 */
import '@napplet/shim';
import { storage } from '@napplet/sdk';

const statusEl = document.getElementById('nub-status')!;
const valueEl = document.getElementById('nub-storage-value')!;

const KEY = 'nub-storage-key';
const VALUE = 'fixture-v1';

function fmt(err: unknown, fb: string): string {
  return err instanceof Error && err.message ? err.message : (typeof err === 'string' && err.length > 0 ? err : fb);
}

async function init(): Promise<void> {
  try {
    await storage.setItem(KEY, VALUE);
    const got = await storage.getItem(KEY);
    statusEl.textContent = `value:${got ?? 'null'}`;
    valueEl.textContent = got ?? '';
  } catch (err) {
    statusEl.textContent = `denied:${fmt(err, 'state:write')}`;
  }
}

void init();
