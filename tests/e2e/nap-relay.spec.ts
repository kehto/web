/**
 * nap-relay Layer-A spec — E2E-09 Phase 21.
 *
 * Drives fixture-nap-relay via harness driver globals at :4173.
 * Asserts:
 *   1. Fixture loads and reaches __nappletReady__ (session registered).
 *   2. The fixture's relay.publish envelope was dispatched (auto-triggered on init).
 *   3. The fixture's #nap-status sentinel reflects either 'event:<id>' (accepted) or
 *      'denied:relay:write' (no relay pool) — both prove the envelope round-tripped.
 *   4. Triggering #nap-encrypt-btn dispatches a relay.publishEncrypted envelope.
 *      Without a signer the runtime returns an error ('denied:relay:write encrypted')
 *      but the envelope dispatch proves the NAP-08 path is exercised.
 *
 * No demo server dependency.
 */
import { test, expect } from '@playwright/test';
import { aclBeforeEach, waitForNappletReady } from './helpers/index.js';

test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('nap-relay: relay.publish envelope dispatched and fixture sentinel updates', async ({ page }) => {
  test.setTimeout(30_000);
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => consoleMessages.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await aclBeforeEach(page);

  const windowId = await page.evaluate(() => window.__loadNapplet__('nap-relay'));
  await waitForNappletReady(page, windowId);

  // Wait for relay.publish envelope to be recorded by the harness (auto-dispatched on init).
  await page.waitForFunction(
    (wid) => window.__getNubMessage__(wid, 'relay.publish') !== null,
    windowId,
    { timeout: 10_000 },
  );

  const envelope = await page.evaluate(
    (wid) => window.__getNubMessage__(wid, 'relay.publish'),
    windowId,
  );
  expect(envelope).not.toBeNull();
  expect((envelope as { type: string }).type).toBe('relay.publish');

  // Status sentinel: either 'event:<id>' or 'denied:relay:write' — both prove round-trip.
  const statusLocator = page.frameLocator(`#${windowId}`).locator('#nap-status');
  await expect(statusLocator).toContainText(/^(event:|denied:)/, { timeout: 8_000 });

  // Trigger encrypted publish button — dispatches relay.publishEncrypted.
  // Button clicks via frame.evaluate because sandboxed iframes are cross-origin.
  const frame = page.frames().find(f => f.url().includes('/nap-relay/'));
  if (frame) {
    await frame.evaluate(() => {
      const recipient = document.getElementById('nap-recipient') as HTMLInputElement | null;
      if (recipient) recipient.value = '0000000000000000000000000000000000000000000000000000000000000001';
      (document.getElementById('nap-encrypt-btn') as HTMLButtonElement | null)?.click();
    });
  }

  await page.waitForFunction(
    (wid) => window.__getNubMessage__(wid, 'relay.publishEncrypted') !== null,
    windowId,
    { timeout: 10_000 },
  );

  const encEnvelope = await page.evaluate(
    (wid) => window.__getNubMessage__(wid, 'relay.publishEncrypted'),
    windowId,
  );
  expect(encEnvelope).not.toBeNull();
  expect((encEnvelope as { type: string }).type).toBe('relay.publishEncrypted');

  expect(consoleMessages.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
  expect(pageErrors.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
});
