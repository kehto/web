/**
 * notify-lifecycle.spec.ts — E2E-07 (notify-lifecycle subset, Phase 19 NAP-05).
 *
 * Asserts the toaster napplet's direct notify.create → notify.list → notify.dismiss lifecycle.
 * Plan 19-04 dual-registered the notification-service under name 'notify' so the
 * runtime's serviceRegistry['notify'] lookup (packages/runtime/src/runtime.ts:1000)
 * routes the toaster's raw envelopes (window.parent.postMessage per Plan 19-03 SDK gap)
 * to the same handler that serves host-originated notifications.
 *
 * Three assertions:
 *   1. Clicking #toaster-notify-btn dispatches notify.create → <li> appears in
 *      #toaster-list with a data-notif-id AND a .notif-toast appears in
 *      #notification-toast-layer (host toast).
 *   2. The debugger shows the notify.create envelope type string.
 *   3. Clicking #toaster-dismiss-all-btn dispatches notify.list + notify.dismiss
 *      cascade → #toaster-list becomes empty.
 *
 * Button clicks use frame.evaluate(() => btn.click()) rather than frameLocator().click()
 * because the napplet iframes are sandboxed (allow-scripts only), making them cross-origin.
 * Playwright's CDP Input dispatch for cross-origin sandboxed iframes does not deliver
 * events to iframe button handlers — frame.evaluate() uses the CDP Runtime in the frame's
 * execution context directly, which works reliably.
 *
 * See 19-05-PLAN.md <demo_runtime_behaviors> sec 4 for routing semantics.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach, getNappletFrame } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

async function expectDirectNotificationMessage(page: import('@playwright/test').Page, type: string): Promise<void> {
  const debuggerText = await page.locator('napplet-debugger').textContent();
  expect(debuggerText).toContain(type);
  expect(debuggerText).not.toMatch(/\b(?:notifications|audio):|\binc\.event\b/);
}

test('toaster creates notification and Dismiss all empties the list', async ({ page }) => {
  test.setTimeout(60_000);
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  const toasterFrame = page.frameLocator('#toaster-frame-container iframe');
  await expect(toasterFrame.locator('#toaster-status')).toContainText('ready', { timeout: 10_000 });

  // Get a direct frame reference — CDP Runtime evaluate works in sandboxed cross-origin frames.
  const toasterFrameDirect = await getNappletFrame(page, 'toaster-frame-container');
  if (!toasterFrameDirect) throw new Error('toaster frame not found in page.frames()');

  // List should be empty initially (no li elements in #toaster-list).
  await expect(toasterFrame.locator('#toaster-list li')).toHaveCount(0);

  // Drive: fill title + body, click Notify via frame.evaluate.
  await toasterFrame.locator('#toaster-title').fill('Test Notification');
  await toasterFrame.locator('#toaster-body').fill('Phase 19 NAP-05 assertion');
  await toasterFrameDirect.evaluate(() => {
    (document.getElementById('toaster-notify-btn') as HTMLButtonElement | null)?.click();
  });

  // <li> appears in #toaster-list (notify.created reply received by toaster listener).
  await expect(toasterFrame.locator('#toaster-list li')).toHaveCount(1, { timeout: 5_000 });

  // Host toast appears (notification-service onChange → notification-demo.ts → renderToast).
  await expect(page.locator('#notification-toast-layer .notif-toast')).toBeVisible({ timeout: 3_000 });

  // Debugger shows a direct notify.create envelope, never a topic or synthetic INC event.
  await expect.poll(async () => page.locator('napplet-debugger').textContent()).toContain('notify.create');
  await expectDirectNotificationMessage(page, 'notify.create');

  // Dismiss all: triggers notify.list → iterate notify.dismiss per id.
  await toasterFrameDirect.evaluate(() => {
    (document.getElementById('toaster-dismiss-all-btn') as HTMLButtonElement | null)?.click();
  });

  // List becomes empty.
  await expect(toasterFrame.locator('#toaster-list li')).toHaveCount(0, { timeout: 5_000 });

  // Debugger keeps the direct notification lifecycle after dismissal.
  await expect.poll(async () => page.locator('napplet-debugger').textContent()).toContain('notify.dismiss');
  await expectDirectNotificationMessage(page, 'notify.dismiss');

  const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);
  const antiErrors = pageErrors.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});
