/**
 * relay-subscribe.spec.ts — E2E-07 (relay-subscribe subset, Phase 20 NAP-06).
 *
 * The feed napplet subscribes via sdk.relay.subscribe({ kinds:[1], limit:5 }); the
 * demo's in-memory mock relay pool (Plan 20-01) emits 5 fixture kind:1 events then EOSE.
 * This spec asserts the full subscribe → receive → render pipeline end-to-end.
 *
 * Fixture event reference (from 20-01-SUMMARY.md):
 *   #1 content: "Welcome to the kehto demo!"
 *   #2 content: "NIP-5D ships in v1.3 — 8 nub domains end-to-end"
 *   #3 content: "feed napplet subscribes; EOSE marks loaded"
 *   #4 content: "composer + preferences + toaster cover core domains"
 *   #5 content: "theme-switcher broadcasts; preferences observes"
 *
 * The first fixture content string "Welcome to the kehto demo!" (Plan 20-01 FIXTURE_EVENTS[0])
 * is used as a partial-match sentinel — its presence in #feed-list proves fixture delivery via
 * the SDK relay.subscribe path (not a placeholder or empty list).
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

test('feed napplet subscribes and renders 5 fixture events from mock relay pool', async ({ page }) => {
  test.setTimeout(60_000);
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  const feedFrame = page.frameLocator('#feed-frame-container iframe');

  // Step 1: wait for feed napplet init to complete. The feed napplet sets
  // 'authenticated' then immediately calls relay.subscribe() which sets 'subscribed' in
  // the same synchronous tick — Playwright may see 'subscribed' or 'loaded' instead of
  // 'authenticated'. Accept any valid post-auth state as evidence that AUTH completed.
  await expect(feedFrame.locator('#feed-status')).toContainText(
    /^(authenticated|subscribed|loaded)/,
    { timeout: 10_000 },
  );

  // Step 2: wait for the relay.subscribe dispatch (status transitions to 'subscribed').
  // Plan 20-01 mock pool queues onevent via microtask so this may race past 'subscribed'
  // and go straight to 'loaded' — accept either as evidence that subscribe happened.
  await expect(feedFrame.locator('#feed-status')).toContainText(/^(subscribed|loaded)/, { timeout: 8_000 });

  // Step 3: wait for EOSE to flip status to 'loaded (5)' (Plan 20-01 mock pool has 5 fixture kind:1 events).
  await expect(feedFrame.locator('#feed-status')).toContainText('loaded (5)', { timeout: 12_000 });

  // Step 4: verify #feed-list has exactly 5 <li class="feed-item"> children.
  const feedItems = feedFrame.locator('#feed-list .feed-item');
  await expect(feedItems).toHaveCount(5, { timeout: 5_000 });

  // Step 5: verify the fixture content strings reached the DOM. We assert at least the
  // first fixture string is present — a partial-match check is sufficient to prove
  // the onEvent callback rendered real NostrEvent.content values, not empty placeholders.
  await expect(feedFrame.locator('#feed-list')).toContainText('Welcome to the kehto demo');

  // Step 6: debugger shows the relay.subscribe envelope type (NIP-5D canonical).
  await expect(page.locator('napplet-debugger')).toContainText('relay.subscribe', { timeout: 8_000 });

  const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);
  const antiErrors = pageErrors.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});
