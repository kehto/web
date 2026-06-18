/**
 * nap-inc Layer-A spec — E2E-09 Phase 21.
 *
 * Drives fixture-nap-inc via harness driver globals at :4173.
 *
 * The fixture imports incEmit/incOn from `@napplet/nap/inc/sdk` and posts the
 * canonical `inc.*` wire: inc.subscribe / inc.emit / inc.subscribe.result.
 *
 * Asserts:
 *   1. Fixture loads and reaches __nappletReady__ (session registered).
 *   2. The fixture's inc.subscribe envelope was dispatched (incOn on init).
 *   3. The fixture's #nap-status sentinel reflects 'ready'
 *      (inc.subscribe.result received — proves the envelope round-tripped).
 *   4. Triggering #nap-inc-emit-btn dispatches an inc.emit envelope (visible via __getNubMessage__).
 *
 * No demo server dependency.
 */
import { test, expect } from '@playwright/test';
import { aclBeforeEach, waitForNappletReady } from './helpers/index.js';

test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('nap-inc: inc.subscribe envelope dispatched and fixture sentinel reaches ready', async ({ page }) => {
  test.setTimeout(30_000);
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => consoleMessages.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await aclBeforeEach(page);

  const windowId = await page.evaluate(() => window.__loadNapplet__('nap-inc'));
  await waitForNappletReady(page, windowId);

  // Wait for inc.subscribe envelope to be recorded by the harness.
  await page.waitForFunction(
    (wid) => window.__getNubMessage__(wid, 'inc.subscribe') !== null,
    windowId,
    { timeout: 10_000 },
  );

  const envelope = await page.evaluate(
    (wid) => window.__getNubMessage__(wid, 'inc.subscribe'),
    windowId,
  );
  expect(envelope).not.toBeNull();
  expect((envelope as { type: string }).type).toBe('inc.subscribe');

  // Fixture sets #nap-status to 'ready' after incOn returns (inc.subscribe.result received).
  const statusLocator = page.frameLocator(`#${windowId}`).locator('#nap-status');
  await expect(statusLocator).toContainText('ready', { timeout: 8_000 });

  // Trigger the emit button — dispatches inc.emit envelope to the harness.
  // Button clicks via frame.evaluate because sandboxed iframes are cross-origin.
  const frame = page.frames().find(f => f.url().includes('/nap-inc/'));
  if (frame) {
    await frame.evaluate(() => {
      (document.getElementById('nap-inc-emit-btn') as HTMLButtonElement | null)?.click();
    });
  }

  await page.waitForFunction(
    (wid) => window.__getNubMessage__(wid, 'inc.emit') !== null,
    windowId,
    { timeout: 8_000 },
  );

  const emitEnvelope = await page.evaluate(
    (wid) => window.__getNubMessage__(wid, 'inc.emit'),
    windowId,
  );
  expect(emitEnvelope).not.toBeNull();
  expect((emitEnvelope as { type: string }).type).toBe('inc.emit');

  expect(consoleMessages.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
  expect(pageErrors.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
});
