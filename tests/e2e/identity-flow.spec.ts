/**
 * identity-flow.spec.ts — profile-viewer no longer reads the shell identity directly.
 *
 * The profile viewer is a NAP-01 consumer: it waits for profile:open over IFC
 * and then fetches kind 0 metadata through relay.subscribe.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('profile-viewer waits for NAP-01 profile:open instead of reading identity directly', async ({ page }) => {
  test.setTimeout(60_000);
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  const profileFrame = page.frameLocator('#profile-viewer-frame-container iframe');

  await expect(profileFrame.locator('#profile-status')).toContainText('waiting', { timeout: 10_000 });
  await expect(profileFrame.locator('#profile-about')).toContainText('Select a profile from the feed.');
  await expect(page.locator('napplet-debugger')).toContainText('ifc.subscribe', { timeout: 8_000 });
  await expect(page.locator('napplet-debugger')).not.toContainText('identity.getProfile');

  const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);
  const antiErrors = pageErrors.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});
