/**
 * theme-broadcast.spec.ts — E2E-07 (theme-broadcast subset, Phase 20 NAP-08).
 *
 * Full round-trip: theme-switcher #theme-dark-btn click → window.parent.postMessage({
 * type:'demo.publishTheme' }) → demo host listener (main.ts, Plan 20-06) → relay.publishTheme
 * (theme) → shell-bridge fan-out theme.changed to every napplet → preferences observer
 * (Plan 20-05) updates document.body.backgroundColor + #preferences-theme-applied textContent.
 *
 * Asserts both the visible active-state toggle on theme-switcher and the propagated state on
 * preferences. The DARK_THEME preset (from Plan 20-04) has:
 *   colors.background: '#0a0a0a' (DARK_BG_HEX)
 * Chromium-normalizes '#0a0a0a' to 'rgb(10, 10, 10)' in getComputedStyle (DARK_BG_RGB).
 *
 * Button clicks use frame.evaluate() rather than frameLocator().click() because napplet
 * iframes are sandboxed (allow-scripts only) making them cross-origin. Playwright's CDP
 * Input dispatch does not reach cross-origin sandboxed iframe button handlers — frame.evaluate()
 * uses the CDP Runtime in the frame's execution context directly.
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

test('clicking theme-switcher dark button propagates theme.changed to preferences napplet', async ({ page }) => {
  test.setTimeout(60_000);
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  const themeFrame = page.frameLocator('#theme-switcher-frame-container iframe');
  const prefFrame = page.frameLocator('#preferences-frame-container iframe');

  // Step 1: wait for BOTH napplets to reach 'authenticated' state.
  await expect(themeFrame.locator('#theme-status')).toContainText('authenticated', { timeout: 10_000 });
  // preferences reaches 'loaded' after storage.getItem completes (Phase 19 behavior).
  await expect(prefFrame.locator('#preferences-status')).toContainText(/^(loaded|denied:)/, { timeout: 10_000 });

  // Step 2: get a direct frame reference to theme-switcher for button click.
  const themeFrameDirect = page.frames().find(f => f.url().includes('/theme-switcher/'));
  if (!themeFrameDirect) throw new Error('theme-switcher frame not found in page.frames()');

  // Step 3: click the Dark button — dispatches window.parent.postMessage({ type: 'demo.publishTheme', ... }).
  await themeFrameDirect.evaluate(() => {
    (document.getElementById('theme-dark-btn') as HTMLButtonElement | null)?.click();
  });

  // Step 4: verify theme-switcher's active-state toggle (Plan 20-04 contract — button has data-active='true').
  await expect(themeFrame.locator('#theme-dark-btn')).toHaveAttribute('data-active', 'true', { timeout: 5_000 });

  // Step 5: the demo host (Plan 20-06) forwards to relay.publishTheme — expect debugger to show theme.changed.
  await expect(page.locator('napplet-debugger')).toContainText('theme broadcast — bg: ' + DARK_BG_HEX, { timeout: 8_000 });

  // Step 6: preferences napplet (Plan 20-05 observer) receives theme.changed and updates its DOM.
  // #preferences-theme-applied textContent should equal the dark bg hex.
  await expect(prefFrame.locator('#preferences-theme-applied')).toHaveText(DARK_BG_HEX, { timeout: 8_000 });

  // Step 7: preferences iframe body computed backgroundColor should be rgb(10, 10, 10) (browser normalization of #0a0a0a).
  // Use frame.evaluate to read the computed style — getComputedStyle via frameLocator.
  const prefFrameDirect = page.frames().find(f => f.url().includes('/preferences/'));
  if (!prefFrameDirect) throw new Error('preferences frame not found in page.frames()');
  const bodyBg = await prefFrameDirect.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bodyBg, `preferences body backgroundColor after theme.changed`).toBe(DARK_BG_RGB);

  const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);
  const antiErrors = pageErrors.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});
