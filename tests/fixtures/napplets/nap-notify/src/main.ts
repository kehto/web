/**
 * nap-notify fixture — exercises notifySend (E2E-09).
 *
 * Runtime fallback (packages/runtime/src/runtime.ts:1011) handles notify.send
 * even without a registered 'notify' service: returns
 * { type: 'notify.send.result', notificationId: 'shell-<timestamp>' }.
 *
 * Layer-A spec asserts:
 *   - #nap-status flips to 'notification:<id>' or 'denied:*'
 *   - #nap-notif-id contains the returned notificationId (matches /^shell-\d+$/)
 *   - __getNapMessage__(windowId, 'notify.send') returns the request envelope
 */
import '@napplet/shim';
import { notifySend } from '@napplet/nap/notify/sdk';

const statusEl = document.getElementById('nap-status')!;
const notifIdEl = document.getElementById('nap-notif-id')!;

function fmt(err: unknown, fb: string): string {
  return err instanceof Error && err.message ? err.message : (typeof err === 'string' && err.length > 0 ? err : fb);
}

async function init(): Promise<void> {
  try {
    const result = await notifySend({
      title: 'nap-notify fixture',
      body: 'Phase 21 E2E-09 probe',
      priority: 'normal',
    });
    statusEl.textContent = `notification:${result.notificationId}`;
    notifIdEl.textContent = result.notificationId;
  } catch (err) {
    statusEl.textContent = `denied:${fmt(err, 'notify:send')}`;
  }
}

void init();
