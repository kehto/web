/**
 * demo-service-toggle.spec.ts — E2E-06: service toggle icon flips disabled class.
 *
 * Asserts the topology service node's toggle icon adds/removes the
 * `service-disabled` class on click, and that toggling does not cause
 * anti-term page errors.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('notifications service toggle flips .service-disabled class', async ({ page }) => {
  await demoBeforeEach(page);
  const node = page.locator('[data-service-name="notifications"]');
  await expect(node).toBeVisible();
  await expect(node).not.toHaveClass(/service-disabled/);

  // Disable — first click
  await node.locator('.service-toggle-icon').click();
  await expect(node).toHaveClass(/service-disabled/, { timeout: 3_000 });

  // Re-enable — second click
  await node.locator('.service-toggle-icon').click();
  await expect(node).not.toHaveClass(/service-disabled/, { timeout: 3_000 });
});

test('notifications service toggle persists across reloads', async ({ page }) => {
  await demoBeforeEach(page);
  const node = page.locator('[data-service-name="notifications"]');
  await expect(node).toBeVisible();

  await node.locator('.service-toggle-icon').click();
  await expect(node).toHaveClass(/service-disabled/, { timeout: 3_000 });
  await expect.poll(() =>
    page.evaluate(() => JSON.parse(localStorage.getItem('kehto.playground.disabledServices.v1') ?? '[]')),
  ).toContain('notifications');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#topology-root', { state: 'visible', timeout: 15_000 });
  await expect(page.locator('[data-service-name="notifications"]')).toHaveClass(/service-disabled/, { timeout: 3_000 });

  await page.locator('[data-service-name="notifications"] .service-toggle-icon').click();
  await expect(page.locator('[data-service-name="notifications"]')).not.toHaveClass(/service-disabled/, { timeout: 3_000 });
  await expect.poll(() =>
    page.evaluate(() => JSON.parse(localStorage.getItem('kehto.playground.disabledServices.v1') ?? '[]')),
  ).not.toContain('notifications');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#topology-root', { state: 'visible', timeout: 15_000 });
  await expect(page.locator('[data-service-name="notifications"]')).not.toHaveClass(/service-disabled/, { timeout: 3_000 });
});

test('service toggle click does not cause anti-term page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await demoBeforeEach(page);
  await page.locator('[data-service-name="notifications"] .service-toggle-icon').click();
  await page.waitForTimeout(200);
  await page.locator('[data-service-name="notifications"] .service-toggle-icon').click();
  const antiErrors = errors.filter(e => ANTI_TERM_RE.test(e));
  expect(antiErrors, `anti-term in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});
