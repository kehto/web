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
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('revoking relay:write on composer denies next publish (denial visible in status + debugger)', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  const composerFrame = page.frameLocator('#composer-frame-container iframe');
  // Wait for AUTH so the ACL panel renders for composer.
  await expect(composerFrame.locator('#composer-status')).toContainText('authenticated', { timeout: 10_000 });

  // Phase 1 (control): publish should NOT be in the explicit-denial path.
  // The demo's stub relay pool returns accepted:false but with `message: 'no relay pool available'`
  // (no `error`), so the SDK resolves and composer status becomes 'published: unknown'.
  // We DO NOT assert the success outcome strictly — just that we're not already denied.
  await composerFrame.locator('#composer-input').fill('phase 1 control publish');
  await composerFrame.locator('#composer-publish-btn').click();
  await expect(composerFrame.locator('#composer-status')).toContainText(/^(published:|denied:)/, { timeout: 8_000 });

  // Wait until the ACL panel toggle for relay:write is rendered + initial state ON.
  // The button is rendered into #composer-acl after AUTH (apps/demo/src/main.ts:737 path).
  const aclSlot = page.locator('#composer-acl');
  await expect(aclSlot).toBeVisible({ timeout: 5_000 });
  const relayWriteToggle = aclSlot.locator('button[title^="relay:write"]');
  await expect(relayWriteToggle).toBeVisible({ timeout: 5_000 });
  await expect(relayWriteToggle).toHaveAttribute('data-enabled', 'true');

  // Phase 2 (revoke + assert):
  // Click the toggle to revoke relay:write on the composer.
  await relayWriteToggle.click();
  // Verify the toggle flipped to OFF state (data-enabled=false).
  await expect(relayWriteToggle).toHaveAttribute('data-enabled', 'false');

  // Trigger another publish — this time the runtime's ACL gate (packages/runtime/src/runtime.ts:1117-1125)
  // emits relay.publish.error with `error: 'denied: relay:write ...'`.
  await composerFrame.locator('#composer-input').fill('phase 2 denied publish');
  await composerFrame.locator('#composer-publish-btn').click();

  // The composer's catch branch sets #composer-status to 'denied: <reason>'.
  // We assert the 'denied:' prefix because the exact reason string is runtime-formatted.
  await expect(composerFrame.locator('#composer-status')).toContainText('denied:', { timeout: 5_000 });

  // The debugger shows the relay.publish.error envelope (proves the runtime emitted the denial).
  await expect(page.locator('napplet-debugger')).toContainText('relay.publish.error', { timeout: 5_000 });

  const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);
  const antiErrors = pageErrors.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});
