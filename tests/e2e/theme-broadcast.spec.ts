/**
 * theme-broadcast.spec.ts — E2E-07 (theme-broadcast subset, Phase 20 NAP-08).
 *
 * Full round-trip: host #theme-dark-btn click (theme-switcher-host.ts, task
 * 260616-8iv) → preferences.applyTheme → relay.publishTheme (theme) →
 * shell-bridge fan-out theme.changed to every napplet → preferences observer
 * (Plan 20-05) updates document.body.backgroundColor + #preferences-theme-applied
 * textContent.
 *
 * The Dark button is now a host-side element (no sandbox boundary), so Playwright
 * can click it directly on the page without frame evaluation tricks.
 *
 * The DARK_THEME preset has:
 *   colors.background: '#0a0a0a' (DARK_BG_HEX)
 * Chromium-normalizes '#0a0a0a' to 'rgb(10, 10, 10)' in getComputedStyle (DARK_BG_RGB).
 *
 * Serial mode prevents postMessage timing interference when multiple napplet specs run in the
 * same Playwright worker.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

const DARK_BG_HEX = '#0a0a0a';
const DARK_BG_RGB = 'rgb(10, 10, 10)';

test('clicking host dark button propagates theme.changed to preferences napplet', async ({ page }) => {
  test.setTimeout(60_000);
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  const prefFrame = page.frameLocator('#preferences-frame-container iframe');

  // Step 1: wait for preferences to reach usable state.
  // preferences reaches 'loaded' after storageGetItem completes (Phase 19 behavior).
  await expect(prefFrame.locator('#preferences-status')).toContainText(/^(loaded|denied:)/, { timeout: 10_000 });

  // Step 2: wait for the host theme-switcher to be mounted (topology card must be present).
  await expect(page.locator('#theme-dark-btn')).toBeVisible({ timeout: 10_000 });

  // Step 3: click the Dark button — host-side, no postMessage needed.
  await page.locator('#theme-dark-btn').click();

  // Step 4: verify host button's active-state toggle (data-active='true').
  await expect(page.locator('#theme-dark-btn')).toHaveAttribute('data-active', 'true', { timeout: 5_000 });

  // Step 5: debugger should log the theme set message with the dark bg hex.
  await expect(page.locator('napplet-debugger')).toContainText('theme set — bg: ' + DARK_BG_HEX, { timeout: 8_000 });

  // Step 5b: the host shell should adopt the selected theme too.
  const hostBodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(hostBodyBg).toBe(DARK_BG_RGB);

  // Step 6: preferences napplet (Plan 20-05 observer) receives theme.changed and updates its DOM.
  // #preferences-theme-applied textContent should equal the dark bg hex.
  await expect(prefFrame.locator('#preferences-theme-applied')).toHaveText(DARK_BG_HEX, { timeout: 8_000 });

  // Step 7: preferences iframe body computed backgroundColor should be rgb(10, 10, 10).
  const prefFrameDirect = page.frames().find(f => f.url().includes('/preferences/'));
  if (!prefFrameDirect) throw new Error('preferences frame not found in page.frames()');
  const bodyBg = await prefFrameDirect.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bodyBg, `preferences body backgroundColor after theme.changed`).toBe(DARK_BG_RGB);

  const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);
  const antiErrors = pageErrors.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});
