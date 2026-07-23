/**
 * demo-notification-service.spec.ts — E2E-06 migration.
 *
 * Original spec (v1.1) spawned its own Vite server and used `napplet-debugger`
 * text assertions that depended on NIP-01 topic strings like `notifications:create`.
 * v1.3 / Phase 17 rewrites in place: uses the `webServer` array from
 * playwright.config.ts (no local spawn), uses `demoBeforeEach`, and asserts on
 * canonical `notify.*` envelope type strings.
 *
 * Note: Earlier demo napplets used legacy NIP-01 arrays and could not become
 * identity-bound under the NIP-5D shell. Napplet migration to NIP-5D was Phase 18.
 * All tests in this spec are host-side and do not require napplet identity binding.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

async function expectDirectNotificationMessage(page: import('@playwright/test').Page, type: string): Promise<void> {
  const debuggerText = await page.locator('napplet-debugger').textContent();
  expect(debuggerText).toContain(type);
  expect(debuggerText).not.toMatch(/\b\w+:\w+|\binc\.event\b/);
}

test('notification topology node is visible', async ({ page }) => {
  await demoBeforeEach(page);
  await expect(page.locator('[data-service-name="notifications"]')).toBeVisible();
});

test('node-control: create toast via notify.create envelope', async ({ page }) => {
  await demoBeforeEach(page);
  const totalEl = page.locator('#notif-total');
  const initial = parseInt(await totalEl.textContent() ?? '0', 10);
  await page.locator('#notification-node-create').click();

  // Toast appears
  await expect(page.locator('#notification-toast-layer .notif-toast')).toBeVisible({ timeout: 3_000 });

  // Debugger contains a direct-domain notification, never a topic or synthetic INC event.
  await expect.poll(async () => page.locator('napplet-debugger').textContent()).toContain('notify.create');
  await expectDirectNotificationMessage(page, 'notify.create');

  // Summary increments
  await expect(totalEl).toHaveText(String(initial + 1), { timeout: 3_000 });
});

test('notify.list opens inspector with items', async ({ page }) => {
  await demoBeforeEach(page);
  await page.locator('#notification-node-create').click();
  await expect(page.locator('#notification-toast-layer .notif-toast')).toBeVisible({ timeout: 3_000 });
  await page.locator('#notification-node-list').click();
  const inspector = page.locator('#notification-inspector');
  await expect(inspector).toBeVisible({ timeout: 2_000 });
  await expect(page.locator('#notification-list .notif-item')).toHaveCount(1, { timeout: 3_000 });
  await expectDirectNotificationMessage(page, 'notify.list');
});

test('notify.read decrements unread count', async ({ page }) => {
  await demoBeforeEach(page);
  await page.locator('#notification-node-create').click();
  const unreadEl = page.locator('#notif-unread');
  const before = parseInt(await unreadEl.textContent() ?? '0', 10);
  expect(before).toBeGreaterThan(0);
  await page.locator('#notification-node-mark-read').click();
  await expect(unreadEl).toHaveText(String(before - 1), { timeout: 3_000 });
  await expectDirectNotificationMessage(page, 'notify.read');
});

test('notify.dismiss removes item from inspector', async ({ page }) => {
  await demoBeforeEach(page);
  await page.locator('#notification-node-create').click();
  await page.locator('#notification-node-list').click();
  const before = await page.locator('#notification-list .notif-item').count();
  await page.locator('#notification-node-dismiss').click();
  await expect(page.locator('#notification-list .notif-item')).toHaveCount(before - 1, { timeout: 3_000 });
  await expectDirectNotificationMessage(page, 'notify.dismiss');
});

test('no anti-term in captured console output', async ({ page }) => {
  const messages: string[] = [];
  page.on('console', (m) => messages.push(m.text()));
  await demoBeforeEach(page);
  await page.locator('#notification-node-create').click();
  await page.waitForTimeout(500);
  const anti = messages.filter(m => ANTI_TERM_RE.test(m));
  expect(anti, `anti-term in console: ${anti.join(' | ')}`).toHaveLength(0);
});
