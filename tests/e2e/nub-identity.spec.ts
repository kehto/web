/**
 * nub-identity Layer-A spec — E2E-09 Phase 21.
 *
 * Drives the fixture-nub-identity napplet via harness driver globals at :4173.
 * Asserts:
 *   1. Fixture loads and reaches __nappletReady__ (AUTH handshake completes).
 *   2. The fixture's identity.getPublicKey envelope was dispatched (visible via __getNubMessage__).
 *   3. The fixture's #nub-status sentinel reflects the success path
 *      ('pubkey:<truncated>'). The test installs a deterministic mock signer first
 *      because @napplet/nap@0.3.1's identityGetPublicKey() helper resolves
 *      identity.getPublicKey.result, not the runtime fallback error envelope.
 *
 * No demo server dependency. No frameLocator interactions beyond reading the iframe sentinel.
 */
import { test, expect } from '@playwright/test';
import { aclBeforeEach, waitForNappletReady } from './helpers/index.js';

test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;
const TEST_PUBKEY = '1'.repeat(64);

test('nub-identity: getPublicKey envelope dispatched and fixture sentinel updates', async ({ page }) => {
  test.setTimeout(30_000);
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => consoleMessages.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await aclBeforeEach(page);
  await page.evaluate((pubkey) => {
    window.__setSigner__({
      getPublicKey: () => pubkey,
    });
  }, TEST_PUBKEY);

  const windowId = await page.evaluate(() => window.__loadNapplet__('nub-identity'));
  await waitForNappletReady(page, windowId);

  // Wait for the fixture's identity.getPublicKey envelope to be recorded by the harness.
  await page.waitForFunction(
    (wid) => window.__getNubMessage__(wid, 'identity.getPublicKey') !== null,
    windowId,
    { timeout: 10_000 },
  );

  const envelope = await page.evaluate(
    (wid) => window.__getNubMessage__(wid, 'identity.getPublicKey'),
    windowId,
  );
  expect(envelope).not.toBeNull();
  expect((envelope as { type: string }).type).toBe('identity.getPublicKey');

  // Read the fixture's #nub-status sentinel from inside the iframe.
  // Use expect().toContainText() for built-in retry until the sentinel updates
  // (identity round-trip may take a few ms after envelope dispatch).
  const statusLocator = page.frameLocator(`#${windowId}`).locator('#nub-status');
  await expect(statusLocator).toContainText('pubkey:11111111...1111', { timeout: 8_000 });

  expect(consoleMessages.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
  expect(pageErrors.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
});
