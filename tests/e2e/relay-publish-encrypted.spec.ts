/**
 * relay-publish-encrypted.spec.ts — E2E-07 (relay-publish-encrypted subset, Phase 19 NAP-03).
 *
 * Asserts the composer napplet with #composer-encrypted-toggle checked dispatches a
 * relay.publishEncrypted envelope (NIP-44 default) via relayPublishEncrypted. The demo has no
 * default connected signer, so the runtime replies `{ ok: false, error: 'no signer
 * configured' }` and composer status becomes `'denied: no signer configured'`. If a
 * signer IS connected in the demo (e.g. future Phase 20 extension), the path resolves
 * to 'published:*'. Either outcome proves the envelope reached the shell.
 *
 * Note: This spec's single test is also covered in relay-publish.spec.ts (serially after
 * the plain publish test) so that when both spec files run in parallel under Playwright's
 * fullyParallel mode, the serial variant runs reliably. This file provides the canonical
 * one-test-per-file artifact required by the plan's must_haves.
 *
 * Button clicks use frame.evaluate(() => btn.click()) rather than frameLocator().click()
 * because the napplet iframes are sandboxed (allow-scripts only), making them cross-origin.
 * Playwright's CDP Input dispatch for cross-origin sandboxed iframes does not deliver
 * events to iframe button handlers — frame.evaluate() uses the CDP Runtime in the frame's
 * execution context directly, which works reliably.
 *
 * See 19-05-PLAN.md <demo_runtime_behaviors> for signer configuration semantics.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('composer with encrypted toggle dispatches relay.publishEncrypted envelope', async ({ page }) => {
  // Extended test timeout: publishEncrypted involves signer lookup + async reply path,
  // and postMessage round-trips can be slow under parallel test load.
  test.setTimeout(60_000);
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  const composerFrame = page.frameLocator('#composer-frame-container iframe');
  await expect(composerFrame.locator('#composer-status')).toContainText('ready', { timeout: 10_000 });

  // Get a direct frame reference — CDP Runtime evaluate works in sandboxed cross-origin frames.
  const composerFrameDirect = page.frames().find(f => f.url().includes('/composer/'));
  if (!composerFrameDirect) throw new Error('composer frame not found in page.frames()');

  // Enable encrypted toggle and provide a deterministic recipient pubkey (32 bytes hex).
  await composerFrameDirect.evaluate(() => {
    const toggle = document.getElementById('composer-encrypted-toggle') as HTMLInputElement | null;
    if (toggle) toggle.checked = true;
    const recipient = document.getElementById('composer-recipient') as HTMLInputElement | null;
    if (recipient) recipient.value = '0000000000000000000000000000000000000000000000000000000000000001';
  });
  await composerFrame.locator('#composer-input').fill('encrypted hello');
  await composerFrameDirect.evaluate(() => {
    (document.getElementById('composer-publish-btn') as HTMLButtonElement | null)?.click();
  });

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
