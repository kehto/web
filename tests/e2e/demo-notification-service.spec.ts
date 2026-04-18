/**
 * demo-notification-service.spec.ts — E2E-06 migration.
 *
 * Original spec (v1.1) spawned its own Vite server and used `napplet-debugger`
 * text assertions that depended on NIP-01 topic strings like `notifications:create`.
 * v1.3 / Phase 17 rewrites in place: uses the `webServer` array from
 * playwright.config.ts (no local spawn), uses `demoBeforeEach`, and asserts on
 * canonical `notify.*` envelope type strings.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

async function openDemoAndAuth(page: import('@playwright/test').Page): Promise<void> {
  await demoBeforeEach(page);
  // Wait for both legacy napplets to reach authenticated state
  await expect(page.locator('#chat-status')).toHaveText('authenticated', { timeout: 30_000 });
  await expect(page.locator('#bot-status')).toHaveText('authenticated', { timeout: 30_000 });
}

test('notification topology node is visible', async ({ page }) => {
  await demoBeforeEach(page);
  await expect(page.locator('[data-service-name="notifications"]')).toBeVisible();
});

test('node-control: create toast via notify.create envelope', async ({ page }) => {
  await openDemoAndAuth(page);
  const totalEl = page.locator('#notif-total');
  const initial = parseInt(await totalEl.textContent() ?? '0', 10);
  await page.locator('#notification-node-create').click();

  // Toast appears
  await expect(page.locator('#notification-toast-layer .notif-toast')).toBeVisible({ timeout: 3_000 });

  // Debugger shows canonical envelope type (not BusKind, not kind:29003)
  await expect(page.locator('napplet-debugger')).toContainText('notify.create', { timeout: 3_000 });

  // Summary increments
  await expect(totalEl).toHaveText(String(initial + 1), { timeout: 3_000 });
});

test('notify.list opens inspector with items', async ({ page }) => {
  await openDemoAndAuth(page);
  await page.locator('#notification-node-create').click();
  await expect(page.locator('#notification-toast-layer .notif-toast')).toBeVisible({ timeout: 3_000 });
  await page.locator('#notification-node-list').click();
  const inspector = page.locator('#notification-inspector');
  await expect(inspector).toBeVisible({ timeout: 2_000 });
  await expect(page.locator('#notification-list .notif-item')).toHaveCount(1, { timeout: 3_000 });
});

test('notify.read decrements unread count', async ({ page }) => {
  await openDemoAndAuth(page);
  await page.locator('#notification-node-create').click();
  const unreadEl = page.locator('#notif-unread');
  const before = parseInt(await unreadEl.textContent() ?? '0', 10);
  expect(before).toBeGreaterThan(0);
  await page.locator('#notification-node-mark-read').click();
  await expect(unreadEl).toHaveText(String(before - 1), { timeout: 3_000 });
});

test('notify.dismiss removes item from inspector', async ({ page }) => {
  await openDemoAndAuth(page);
  await page.locator('#notification-node-create').click();
  await page.locator('#notification-node-list').click();
  const before = await page.locator('#notification-list .notif-item').count();
  await page.locator('#notification-node-dismiss').click();
  await expect(page.locator('#notification-list .notif-item')).toHaveCount(before - 1, { timeout: 3_000 });
});

test('no anti-term in captured console output', async ({ page }) => {
  const messages: string[] = [];
  page.on('console', (m) => messages.push(m.text()));
  await openDemoAndAuth(page);
  await page.locator('#notification-node-create').click();
  await page.waitForTimeout(500);
  const anti = messages.filter(m => ANTI_TERM_RE.test(m));
  expect(anti, `anti-term in console: ${anti.join(' | ')}`).toHaveLength(0);
});
