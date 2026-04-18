/**
 * acl-revoke-storage-write.spec.ts — E2E-08 capability-matrix spec (Phase 19).
 *
 * Asserts that revoking state:write on the preferences napplet via the demo ACL panel UI
 * causes the next preferences save attempt to fail with a denial envelope visible in
 * both the preferences's #preferences-status sentinel and the napplet-debugger.
 *
 * Two-phase assertion (per 19-06-PLAN.md spec_design_constraints sec 2):
 *   Phase 1 (control): save with default-granted state:write succeeds (status flips to
 *     'saved' after both storage.setItem calls resolve).
 *   Phase 2 (revoke + assert): click the state:write toggle in #preferences-acl to
 *     revoke, then save again — status MUST contain 'denied:' AND debugger shows
 *     'storage.set.error' envelope.
 *
 * No page.reload() — Pitfall 5 (PITFALLS.md): reload is banned in ACL-touching specs.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('revoking state:write on preferences denies next save (denial visible in status + debugger)', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  const prefFrame = page.frameLocator('#preferences-frame-container iframe');
  // Wait for first load (preferences napplet sets 'loaded' after loadPreferences resolves).
  await expect(prefFrame.locator('#preferences-status')).toContainText('loaded', { timeout: 10_000 });

  // Phase 1 (control): save should succeed with default-granted state:write.
  await prefFrame.locator('#pref-display-name').fill('control-name');
  await prefFrame.locator('#pref-theme-preference').fill('control-theme');
  await prefFrame.locator('#preferences-save-btn').click();
  await expect(prefFrame.locator('#preferences-status')).toContainText('saved', { timeout: 5_000 });

  // Wait until the ACL panel toggle for state:write is rendered + initial state ON.
  const aclSlot = page.locator('#preferences-acl');
  await expect(aclSlot).toBeVisible({ timeout: 5_000 });
  const stateWriteToggle = aclSlot.locator('button[title^="state:write"]');
  await expect(stateWriteToggle).toBeVisible({ timeout: 5_000 });
  await expect(stateWriteToggle).toHaveAttribute('data-enabled', 'true');

  // Phase 2 (revoke + assert):
  await stateWriteToggle.click();
  await expect(stateWriteToggle).toHaveAttribute('data-enabled', 'false');

  // Trigger another save — runtime's ACL gate emits storage.set.error.
  await prefFrame.locator('#pref-display-name').fill('phase-2-name');
  await prefFrame.locator('#pref-theme-preference').fill('phase-2-theme');
  await prefFrame.locator('#preferences-save-btn').click();

  // Status contains 'denied:' (preferences catch branch sets 'denied: <reason>').
  await expect(prefFrame.locator('#preferences-status')).toContainText('denied:', { timeout: 5_000 });

  // Debugger shows storage.set.error envelope.
  await expect(page.locator('napplet-debugger')).toContainText('storage.set.error', { timeout: 5_000 });

  const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);
  const antiErrors = pageErrors.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});
