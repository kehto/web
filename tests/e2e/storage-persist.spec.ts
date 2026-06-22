/**
 * storage-persist.spec.ts — E2E-07 (storage-persist subset, Phase 19 NAP-04).
 *
 * Asserts the preferences napplet's storageSetItem writes survive a page.reload().
 * The runtime's storage is localStorage-backed (packages/shell/src/hooks-adapter.ts:256)
 * and scoped per napplet identity. page.reload() does NOT clear localStorage — that
 * behavior is what the spec exercises.
 *
 * IMPORTANT: This spec deliberately uses page.reload() instead of a second
 * demoBeforeEach(), because demoBeforeEach calls localStorage.clear() which would
 * erase the persisted values we want to verify survived. page.reload() is explicitly
 * permitted in this spec because it does NOT touch ACL state (Pitfall 5 applies only
 * to ACL-touching specs — this spec only touches storage).
 *
 * Button clicks use frame.evaluate(() => btn.click()) rather than frameLocator().click()
 * because the napplet iframes are sandboxed (allow-scripts only), making them cross-origin.
 * Playwright's CDP Input dispatch for cross-origin sandboxed iframes does not deliver
 * events to iframe button handlers — frame.evaluate() uses the CDP Runtime in the frame's
 * execution context directly, which works reliably.
 *
 * See 19-05-PLAN.md <demo_runtime_behaviors> sec 3 for storage semantics.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach, getNappletFrame } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('preferences round-trips display-name and theme-preference across page.reload()', async ({ page }) => {
  test.setTimeout(60_000);
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  const prefFrame = page.frameLocator('#preferences-frame-container iframe');

  // Wait for the first load (loadPreferences → storageGetItem) to resolve.
  await expect(prefFrame.locator('#preferences-status')).toContainText('loaded', { timeout: 10_000 });

  // Get a direct frame reference — CDP Runtime evaluate works in sandboxed cross-origin frames.
  const prefFrameDirect = await getNappletFrame(page, 'preferences-frame-container');
  if (!prefFrameDirect) throw new Error('preferences frame not found in page.frames()');

  // Fill the two inputs with deterministic test values.
  const TEST_NAME = 'alice-test-01';
  const TEST_THEME = 'dark-test-01';
  await prefFrame.locator('#pref-display-name').fill(TEST_NAME);
  await prefFrame.locator('#pref-theme-preference').fill(TEST_THEME);

  // Click Save via frame.evaluate — triggers storageSetItem for both keys.
  await prefFrameDirect.evaluate(() => {
    (document.getElementById('preferences-save-btn') as HTMLButtonElement | null)?.click();
  });

  // Status should transition to 'saved' after both setItem calls resolve.
  await expect(prefFrame.locator('#preferences-status')).toContainText('saved', { timeout: 8_000 });

  // Debugger shows the storage.set envelope type (NIP-5D canonical).
  await expect(page.locator('napplet-debugger')).toContainText('storage.set', { timeout: 8_000 });

  // NOW the critical assertion: page.reload() (does NOT clear localStorage)
  // followed by re-waiting for preferences to re-initialize, then verifying the
  // inputs still hold the saved values.
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('#topology-root', { state: 'visible', timeout: 15_000 });

  // Re-grab the frame locator after reload.
  const prefFrameAfterReload = page.frameLocator('#preferences-frame-container iframe');
  await expect(prefFrameAfterReload.locator('#preferences-status')).toContainText('loaded', { timeout: 20_000 });

  // The inputs must show the previously-saved values (loadPreferences populated them).
  await expect(prefFrameAfterReload.locator('#pref-display-name')).toHaveValue(TEST_NAME);
  await expect(prefFrameAfterReload.locator('#pref-theme-preference')).toHaveValue(TEST_THEME);

  const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);
  const antiErrors = pageErrors.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});
