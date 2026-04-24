/**
 * E2E-24 (v1.7 Phase 39 / Plan 39-05 / CONFIG-03) — NUB-CONFIG round-trip.
 *
 * Phase 39 (v1.7 / Plan 39-05) — NUB-CONNECT + NUB-CONFIG Layer-B E2E.
 * Runs against the built :4174 demo (pnpm test:serve:demo). Anti-features
 * verified: no implicit allow on dismiss (M-04), no meta-CSP (C-03),
 * iframe destroy+recreate on revoke (C-04), preview-mode CSP present (C-05).
 *
 * Flow:
 *   1. Load demo; wait for config-demo iframe to load.
 *   2. Assert #config-demo-values (frameLocator) contains theme:'dark' (initial fixture).
 *   3. Click #config-demo-update-btn → setDemoConfigValue('theme', 'light') →
 *      configBundle.publishValues → napplet's config.subscribe callback fires.
 *   4. Assert #config-demo-values updates to contain 'light'.
 *
 * This spec proves the config.subscribe round-trip works end-to-end:
 * shell fixture values -> createConfigService publishValues -> NUB-CONFIG wire ->
 * napplet config.subscribe handler -> #config-demo-values DOM sentinel.
 */
import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://localhost:4174' });

test.describe('NUB-CONFIG round-trip (E2E-24 / CONFIG-03)', () => {
  test('config.subscribe receives initial snapshot and subsequent publishValues push', async ({ page }) => {
    test.setTimeout(30_000);

    await page.goto('/');
    await page.waitForSelector('#config-demo-frame-container iframe', { timeout: 10_000 });

    const configFrame = page.frameLocator('#config-demo-frame-container iframe');
    const valuesEl = configFrame.locator('#config-demo-values');

    // Wait for initial snapshot to land in the sentinel (push from config.subscribe on connect).
    await expect(valuesEl).toContainText('"theme"', { timeout: 10_000 });
    await expect(valuesEl).toContainText('"dark"', { timeout: 5_000 });

    // Trigger a shell-side update via the test hook (D11).
    // Note: #config-demo-update-btn is intentionally display:none (a shell-internal button);
    // E2E uses __publishConfigValues__ for deterministic control per Plan 39-04's design.
    const published = await page.evaluate(() => {
      // @ts-expect-error runtime hook
      return window.__publishConfigValues__({ theme: 'light' });
    });
    expect(published).toBe(true);

    // Assert push propagated to the napplet's sentinel.
    await expect(valuesEl).toContainText('"light"', { timeout: 5_000 });
  });
});
