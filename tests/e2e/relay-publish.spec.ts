/**
 * relay-publish.spec.ts — E2E-07 (relay-publish + relay-publish-encrypted subsets, Phase 19 NAP-03).
 *
 * Contains two serial tests that cover the plain relay.publish path and the
 * relay.publishEncrypted path. Both tests are in a single file with mode:'serial'
 * to prevent postMessage timing interference that occurs when both composer-frame
 * interaction tests run in parallel across separate browser contexts.
 *
 * Test 1 (plain): the composer napplet dispatches a relay.publish envelope via @napplet/sdk.
 * The demo's relay pool is stubbed (no real network publish) — the assertion is that the
 * envelope REACHES the shell (visible in napplet-debugger) and the composer's status
 * transitions away from 'authenticated' to either 'published:*' or 'denied:*'.
 *
 * Test 2 (encrypted): the composer napplet with #composer-encrypted-toggle checked dispatches
 * a relay.publishEncrypted envelope (NIP-44 default) via @napplet/sdk. The demo has no
 * default connected signer, so the runtime replies { ok: false, error: 'no signer configured' }
 * and composer status becomes 'denied: no signer configured'. Either outcome proves the
 * envelope reached the shell.
 *
 * See 19-05-PLAN.md <demo_runtime_behaviors> sec 1 + 2 for stub relay pool and signer semantics.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('composer dispatches relay.publish envelope visible in debugger', async ({ page }) => {
  // Extended test timeout: under parallel test load the postMessage round-trip can be slow.
  test.setTimeout(60_000);
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  const composerFrame = page.frameLocator('#composer-frame-container iframe');
  await expect(composerFrame.locator('#composer-status')).toContainText('authenticated', { timeout: 10_000 });

  // Ensure encrypted toggle is unchecked (default) so we hit the plain relay.publish path.
  const encryptedToggle = composerFrame.locator('#composer-encrypted-toggle');
  const isChecked = await encryptedToggle.isChecked();
  if (isChecked) await encryptedToggle.uncheck();

  // Drive the publish flow: fill input + click button.
  await composerFrame.locator('#composer-input').fill('hello world');
  await composerFrame.locator('#composer-publish-btn').click();

  // Status should transition away from 'authenticated' — either 'published:*' or 'denied:*'.
  // Both outcomes prove the envelope was dispatched and a reply was received.
  await expect(composerFrame.locator('#composer-status')).toContainText(/^(published:|denied:)/, { timeout: 12_000 });

  // Debugger shows the relay.publish envelope type string.
  await expect(page.locator('napplet-debugger')).toContainText('relay.publish', { timeout: 8_000 });

  const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);
  const antiErrors = pageErrors.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});

test('composer with encrypted toggle dispatches relay.publishEncrypted envelope', async ({ page }) => {
  // Extended test timeout: publishEncrypted involves signer lookup + async reply path.
  test.setTimeout(60_000);
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  const composerFrame = page.frameLocator('#composer-frame-container iframe');
  await expect(composerFrame.locator('#composer-status')).toContainText('authenticated', { timeout: 10_000 });

  // Enable encrypted toggle and provide a deterministic recipient pubkey (32 bytes hex).
  await composerFrame.locator('#composer-encrypted-toggle').check();
  await composerFrame.locator('#composer-recipient').fill('0000000000000000000000000000000000000000000000000000000000000001');
  await composerFrame.locator('#composer-input').fill('encrypted hello');
  await composerFrame.locator('#composer-publish-btn').click();

  // Status transitions to published:* or denied:* within 12s. (On the default demo
  // with no signer, expect denied: no signer configured — but accept either.)
  await expect(composerFrame.locator('#composer-status')).toContainText(/^(published:|denied:)/, { timeout: 12_000 });

  // Debugger shows the relay.publishEncrypted envelope type string (distinct from plain publish).
  await expect(page.locator('napplet-debugger')).toContainText('relay.publishEncrypted', { timeout: 10_000 });

  const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);
  const antiErrors = pageErrors.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});
