/**
 * nub-relay fixture — exercises relay.publish + relay.publishEncrypted (E2E-09).
 *
 * On init: dispatches a relay.publish for a kind:1 fixture event (auto-trigger so spec
 * can assert the envelope without DOM clicks). Encrypted publish only fires on
 * #nub-encrypt-btn click (spec drives this in the relay encrypted assertion).
 *
 * Layer-A spec asserts:
 *   - #nub-status flips to 'authenticated' then 'event:<truncated-id>' or 'denied:*'
 *   - #nub-event-id populated with the returned event id (or empty on denial)
 *   - __getNubMessage__(windowId, 'relay.publish') returns the request envelope
 *   - On click: __getNubMessage__(windowId, 'relay.publishEncrypted') returns the encrypted envelope
 */
import '@napplet/shim';
import { relay, type EventTemplate } from '@napplet/sdk';

const statusEl = document.getElementById('nub-status')!;
const eventIdEl = document.getElementById('nub-event-id')!;
const encryptBtn = document.getElementById('nub-encrypt-btn') as HTMLButtonElement;
const recipientEl = document.getElementById('nub-recipient') as HTMLInputElement;

function fmt(err: unknown, fb: string): string {
  return err instanceof Error && err.message ? err.message : (typeof err === 'string' && err.length > 0 ? err : fb);
}

function template(content: string): EventTemplate {
  return {
    kind: 1,
    content,
    tags: [['t', 'fixture-nub-relay']],
    created_at: Math.floor(Date.now() / 1000),
  };
}

async function init(): Promise<void> {
  try {
    const event = await relay.publish(template('nub-relay fixture probe'));
    const id = (event as { id?: string } | undefined)?.id ?? '';
    statusEl.textContent = `event:${id.slice(0, 16)}`;
    eventIdEl.textContent = id;
  } catch (err) {
    statusEl.textContent = `denied:${fmt(err, 'relay:write')}`;
  }
}

encryptBtn.addEventListener('click', () => {
  const recipient = recipientEl.value.trim() ||
    '0000000000000000000000000000000000000000000000000000000000000001';
  void (async () => {
    try {
      const event = await relay.publishEncrypted(template('encrypted probe'), recipient, 'nip44');
      const id = (event as { id?: string } | undefined)?.id ?? '';
      statusEl.textContent = `encrypted:${id.slice(0, 16)}`;
      eventIdEl.textContent = id;
    } catch (err) {
      statusEl.textContent = `denied:${fmt(err, 'relay:write encrypted')}`;
    }
  })();
});

void init();
