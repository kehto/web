/**
 * nub-notify Layer-A spec — E2E-09 Phase 21.
 *
 * Drives fixture-nub-notify via harness globals.
 * Runtime fallback (packages/runtime/src/runtime.ts:1011) emits notify.send.result
 * even without a registered 'notify' service — fixture's await notifySend(...) resolves.
 *
 * Asserts:
 *   1. notify.send envelope dispatched (__getNubMessage__).
 *   2. Fixture's #nub-status sentinel becomes 'notification:shell-<timestamp>'.
 *   3. Fixture's #nub-notif-id matches /^shell-\d+$/.
 *
 * Note: __getNotifications__ returns [] in the harness (Phase 16 STATE decision —
 * notification service is not wired in createMockHooks). Spec asserts via __getNubMessage__
 * + DOM sentinel only — NOT __getNotifications__.
 */
import { test, expect } from '@playwright/test';
import { aclBeforeEach, waitForNappletReady } from './helpers/index.js';

test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('nub-notify: notify.send envelope dispatched and fixture sentinel reflects shell id', async ({ page }) => {
  test.setTimeout(30_000);
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => consoleMessages.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await aclBeforeEach(page);

  const windowId = await page.evaluate(() => window.__loadNapplet__('nub-notify'));
  await waitForNappletReady(page, windowId);

  // Wait for fixture's notify.send envelope to be recorded.
  await page.waitForFunction(
    (wid) => window.__getNubMessage__(wid, 'notify.send') !== null,
    windowId,
    { timeout: 10_000 },
  );

  const sendEnvelope = await page.evaluate(
    (wid) => window.__getNubMessage__(wid, 'notify.send'),
    windowId,
  );
  expect(sendEnvelope).not.toBeNull();
  expect((sendEnvelope as { type: string }).type).toBe('notify.send');

  // Status sentinel becomes 'notification:shell-<timestamp>'.
  const status = page.frameLocator(`#${windowId}`).locator('#nub-status');
  await expect(status).toContainText(/^notification:shell-\d+$/, { timeout: 8_000 });

  // #nub-notif-id matches the shell id pattern.
  const notifId = await page.frameLocator(`#${windowId}`).locator('#nub-notif-id').textContent();
  expect(notifId ?? '').toMatch(/^shell-\d+$/);

  expect(consoleMessages.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
  expect(pageErrors.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
});
