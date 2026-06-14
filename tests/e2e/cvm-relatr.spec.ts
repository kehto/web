/**
 * E2E — NAP-CVM bridge: the cvm-relatr napplet discovers the Relatr ContextVM
 * server and renders a trust score returned through the shell's CVM service.
 *
 * Uses `?cvmFixture=1` so the shell's CVM transport returns canned Relatr-shaped
 * responses (offline, deterministic) — exercising the full
 * napplet → shell → cvm service → transport → napplet wire without the network.
 */
import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://localhost:4174' });

test('cvm-relatr napplet renders a trust score via the CVM bridge', async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto('/?cvmFixture=1');
  await page.waitForSelector('#cvm-relatr-frame-container iframe', { timeout: 10_000 });

  const frame = page.frameLocator('#cvm-relatr-frame-container iframe');
  const status = frame.locator('#cvm-status');
  const server = frame.locator('#cvm-server');
  const score = frame.locator('#cvm-score');

  // The napplet is click-driven (no automatic relay traffic on load).
  await expect(status).toContainText('ready', { timeout: 10_000 });
  await frame.locator('#cvm-run').click();

  // Discovery populates the server line with Relatr's announcement.
  await expect(server).toContainText('Relatr', { timeout: 10_000 });
  // The trust score (tools/call calculate_trust_score) renders as a 0–1 number.
  await expect(score).toHaveText(/^0\.\d+$/, { timeout: 15_000 });
  await expect(status).toContainText('trust score', { timeout: 10_000 });
});
