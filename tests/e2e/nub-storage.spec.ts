/**
 * nub-storage Layer-A spec — E2E-09 Phase 21.
 *
 * Drives fixture-nub-storage via harness globals.
 * Storage is localStorage-backed (packages/shell/src/hooks-adapter.ts:256), scoped per
 * napplet identity. The fixture sets KEY='nub-storage-key', VALUE='fixture-v1' on init,
 * then reads it back.
 *
 * Asserts:
 *   1. storage.setItem AND storage.getItem envelopes dispatched.
 *   2. Fixture's #nub-storage-value sentinel === 'fixture-v1' (round-trip success).
 *   3. Fixture's #nub-status === 'value:fixture-v1'.
 */
import { test, expect } from '@playwright/test';
import { aclBeforeEach, waitForNappletReady } from './helpers/index.js';

test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('nub-storage: setItem + getItem round-trip via fixture sentinels', async ({ page }) => {
  test.setTimeout(30_000);
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => consoleMessages.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await aclBeforeEach(page);

  const windowId = await page.evaluate(() => window.__loadNapplet__('nub-storage'));
  await waitForNappletReady(page, windowId);

  // Wait for both envelopes to be recorded.
  // Note: @napplet/nub/storage shim sends 'storage.set' (not 'storage.setItem')
  // and 'storage.get' (not 'storage.getItem') — these are the canonical NIP-5D wire types.
  await page.waitForFunction(
    (wid) => window.__getNubMessage__(wid, 'storage.set') !== null
          && window.__getNubMessage__(wid, 'storage.get') !== null,
    windowId,
    { timeout: 10_000 },
  );

  // DOM round-trip success sentinel.
  const value = page.frameLocator(`#${windowId}`).locator('#nub-storage-value');
  await expect(value).toContainText('fixture-v1', { timeout: 8_000 });

  const status = page.frameLocator(`#${windowId}`).locator('#nub-status');
  await expect(status).toContainText('value:fixture-v1', { timeout: 5_000 });

  expect(consoleMessages.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
  expect(pageErrors.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
});
