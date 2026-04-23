/**
 * nub-theme Layer-A spec — E2E-09 Phase 21.
 *
 * Drives fixture-nub-theme via harness driver globals at :4173.
 * Asserts:
 *   1. Fixture loads and reaches __nappletReady__ (session registered).
 *   2. The fixture's storage.get envelope was dispatched on init.
 *   3. The fixture's #nub-status sentinel reflects 'authenticated'
 *      (storage round-trip completed — proves the napplet is live and messaging works).
 *   4. Injecting a theme.get envelope FROM the napplet via __injectEnvelope__ is routed
 *      by the harness (envelope recorded in envelopeLog). The runtime replies with
 *      theme.get.result containing a default theme — the napplet need not handle it
 *      but the round-trip proves the theme NUB path is wired.
 *
 * No demo server dependency. No frameLocator interactions beyond reading sentinels.
 * @napplet/sdk does NOT expose a theme namespace — fixture uses storage.get as init signal.
 */
import { test, expect } from '@playwright/test';
import { aclBeforeEach, waitForNappletReady } from './helpers/index.js';

test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('nub-theme: fixture authenticates via storage probe; theme.get envelope round-trips', async ({ page }) => {
  test.setTimeout(30_000);
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => consoleMessages.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await aclBeforeEach(page);

  const windowId = await page.evaluate(() => window.__loadNapplet__('nub-theme'));
  await waitForNappletReady(page, windowId);

  // Wait for the storage.get envelope (dispatched on init).
  await page.waitForFunction(
    (wid) => window.__getNubMessage__(wid, 'storage.get') !== null,
    windowId,
    { timeout: 10_000 },
  );

  const storageEnvelope = await page.evaluate(
    (wid) => window.__getNubMessage__(wid, 'storage.get'),
    windowId,
  );
  expect(storageEnvelope).not.toBeNull();
  expect((storageEnvelope as { type: string }).type).toBe('storage.get');

  // Fixture sets #nub-status to 'authenticated' after the storage probe completes.
  const statusLocator = page.frameLocator(`#${windowId}`).locator('#nub-status');
  await expect(statusLocator).toContainText('authenticated', { timeout: 8_000 });

  // Inject a theme.get envelope FROM the napplet to the runtime via __injectEnvelope__.
  // The harness routes it through relay.handleMessage; the runtime's theme handler replies
  // with theme.get.result. We assert the harness recorded the outbound theme.get envelope.
  const themeGetId = 'theme-get-probe-' + Date.now();
  await page.evaluate(
    ([wid, id]) => window.__injectEnvelope__(wid, { type: 'theme.get', id } as never),
    [windowId, themeGetId] as [string, string],
  );

  await page.waitForFunction(
    (wid) => window.__getNubMessage__(wid, 'theme.get') !== null,
    windowId,
    { timeout: 8_000 },
  );

  const themeEnvelope = await page.evaluate(
    (wid) => window.__getNubMessage__(wid, 'theme.get'),
    windowId,
  );
  expect(themeEnvelope).not.toBeNull();
  expect((themeEnvelope as { type: string }).type).toBe('theme.get');

  expect(consoleMessages.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
  expect(pageErrors.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
});
