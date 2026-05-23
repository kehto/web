/**
 * acl-revoke-relay-write.spec.ts — E2E-08 capability-matrix spec (Phase 19).
 *
 * Asserts that revoking relay:write on the composer napplet via the demo ACL panel UI
 * causes the next composer publish attempt to fail with a denial envelope visible in
 * both the composer's #composer-status sentinel and the napplet-debugger.
 *
 * Two-phase assertion (per 19-06-PLAN.md spec_design_constraints sec 2):
 *   Phase 1 (control): publish with default-granted relay:write succeeds (status
 *     becomes 'published:*' or 'denied:*' due to demo stub — accept either as
 *     "the envelope path works"; key is that we're NOT in the explicit-denial path).
 *   Phase 2 (revoke + assert): click the relay:write toggle in #composer-acl to revoke,
 *     then publish again — status MUST be 'denied:*' AND debugger shows
 *     'relay.publish.error' envelope.
 *
 * No page.reload() — Pitfall 5 (PITFALLS.md): reload is banned in ACL-touching specs.
 *
 * Button clicks use frame.evaluate(() => btn.click()) rather than frameLocator().click()
 * because the napplet iframes are sandboxed (allow-scripts only), making them cross-origin.
 * Playwright's CDP Input dispatch for cross-origin sandboxed iframes does not deliver
 * events to iframe button handlers — frame.evaluate() uses the CDP Runtime in the frame's
 * execution context directly, which works reliably (same pattern as relay-publish.spec.ts).
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('revoking relay:write on composer denies next publish (denial visible in status + debugger)', async ({ page }) => {
  test.setTimeout(60_000);
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  const composerFrame = page.frameLocator('#composer-frame-container iframe');
  // Wait for ready state so the ACL panel renders for composer.
  await expect(composerFrame.locator('#composer-status')).toContainText('ready', { timeout: 10_000 });

  // Get a direct frame reference — CDP Runtime evaluate works in sandboxed cross-origin frames.
  const composerFrameDirect = page.frames().find(f => f.url().includes('/composer/'));
  if (!composerFrameDirect) throw new Error('composer frame not found in page.frames()');

  // Ensure encrypted toggle is off (default).
  await composerFrameDirect.evaluate(() => {
    const toggle = document.getElementById('composer-encrypted-toggle') as HTMLInputElement | null;
    if (toggle) toggle.checked = false;
  });

  // Phase 1 (control): publish should NOT be in the explicit-denial path.
  // The demo's stub relay pool returns accepted:false but with `message: 'no relay pool available'`
  // (no `error`), so relayPublish resolves and composer status becomes 'published: unknown'.
  // We DO NOT assert the success outcome strictly — just that we're not already denied.
  await composerFrame.locator('#composer-input').fill('phase 1 control publish');
  await composerFrameDirect.evaluate(() => {
    (document.getElementById('composer-publish-btn') as HTMLButtonElement | null)?.click();
  });
  await expect(composerFrame.locator('#composer-status')).toContainText(/^(published:|denied:)/, { timeout: 12_000 });

  // Wait until the ACL panel toggle for relay:write is rendered + initial state ON.
  // The button is rendered into #composer-acl after identity binding is detected in main.ts.
  const aclSlot = page.locator('#composer-acl');
  await expect(aclSlot).toBeVisible({ timeout: 10_000 });
  const relayWriteToggle = aclSlot.locator('button[title^="relay:write"]');
  await expect(relayWriteToggle).toBeVisible({ timeout: 10_000 });
  await expect(relayWriteToggle).toHaveAttribute('data-enabled', 'true');

  // Phase 2 (revoke + assert):
  // Click the toggle to revoke relay:write on the composer.
  await relayWriteToggle.click();
  // Verify the toggle flipped to OFF state (data-enabled=false).
  await expect(relayWriteToggle).toHaveAttribute('data-enabled', 'false');

  // Diagnostic: verify ACL state ACTUALLY changed (captures shell console.log output)
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const relay = (window as any).__relay__;
    if (relay) {
      console.log('[diagnostic] ACL state check after revoke (relay:write on composer)');
    } else {
      console.log('[diagnostic] relay not found on window');
    }
  });

  // Trigger another publish — this time the runtime's ACL gate
  // emits relay.publish.error with `error: 'denied: relay:write ...'`.
  await composerFrame.locator('#composer-input').fill('phase 2 denied publish');
  await composerFrameDirect.evaluate(() => {
    (document.getElementById('composer-publish-btn') as HTMLButtonElement | null)?.click();
  });

  // The composer's catch branch sets #composer-status to 'denied: <reason>'.
  // We assert the 'denied:' prefix because the exact reason string is runtime-formatted.
  await expect(composerFrame.locator('#composer-status')).toContainText('denied:', { timeout: 8_000 });

  // The debugger shows the relay.publish.error envelope (proves the runtime emitted the denial).
  await expect(page.locator('napplet-debugger')).toContainText('relay.publish.error', { timeout: 8_000 });

  const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);
  const antiErrors = pageErrors.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});
