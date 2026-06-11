/**
 * relay-subscribe.spec.ts — E2E-07 (relay-subscribe subset, Phase 20 NAP-06).
 *
 * The feed napplet gets the shell user's pubkey via identity.getPublicKey,
 * resolves the user's kind:3 contacts, and subscribes to kind:1 events authored
 * by followed pubkeys. The demo must not render deterministic seeded feed
 * fixtures when no signer identity is present.
 *
 * Serial mode prevents postMessage timing interference when multiple napplet specs run in the
 * same Playwright worker. Button clicks, if any, use frame.evaluate() rather than
 * frameLocator().click() because napplet iframes are sandboxed (cross-origin to the host).
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;
const TEST_PUBKEY = 'f'.repeat(64);

test('feed napplet reads identity and does not render seeded feed fixtures', async ({ page }) => {
  test.setTimeout(60_000);
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  const feedFrame = page.frameLocator('#feed-frame-container iframe');

  // Step 1: wait for feed napplet init to complete. In the default demo there
  // is no connected signer, so the logged-out sentinel is the expected path.
  // If a browser signer is already connected, the status can proceed to relay.
  await expect(feedFrame.locator('#feed-status')).toContainText(
    /^(not logged in|subscribed|loading|loaded|denied:)/,
    { timeout: 10_000 },
  );

  // Step 2: the identity envelope must be visible; the feed is no longer a
  // generic unauthenticated relay demo.
  await expect(page.locator('napplet-debugger')).toContainText('identity.getPublicKey', { timeout: 8_000 });

  // Step 3: prove the removed deterministic feed fixtures are not rendered.
  await expect(feedFrame.locator('#feed-list')).not.toContainText('Welcome to the kehto demo');
  await expect(feedFrame.locator('#feed-list')).not.toContainText('feed napplet subscribes; EOSE marks loaded');

  // Step 4: if the environment has a connected signer, the feed proceeds to
  // relay.subscribe. The default CI demo has no signer and stops at not logged in.
  const status = (await feedFrame.locator('#feed-status').textContent())?.trim() ?? '';
  if (!status.startsWith('not logged in')) {
    await expect(page.locator('napplet-debugger')).toContainText('relay.subscribe', { timeout: 8_000 });
  }

  const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);
  const antiErrors = pageErrors.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});

test('feed napplet subscribes after signer connects post-load', async ({ page }) => {
  test.setTimeout(60_000);
  await demoBeforeEach(page);

  const feedFrame = page.frameLocator('#feed-frame-container iframe');
  await expect(feedFrame.locator('#feed-status')).toContainText('not logged in', { timeout: 10_000 });

  await page.evaluate((pubkey) => {
    (window as Window & { nostr?: unknown }).nostr = {
      getPublicKey: async () => pubkey,
      signEvent: async (event: Record<string, unknown>) => event,
    };
  }, TEST_PUBKEY);

  await page.locator('[data-action="open-signer-connect"]').click();
  await page.locator('[data-action="connect-nip07"]').click();

  await expect(page.locator('#topology-node-service-signer')).toContainText('nip-07', { timeout: 8_000 });
  await expect(feedFrame.locator('#feed-status')).toContainText(/^(subscribed|loading|loaded)/, {
    timeout: 8_000,
  });
  await expect(page.locator('napplet-debugger')).toContainText('relay.subscribe', { timeout: 8_000 });
});
