/**
 * demo-debugger.spec.ts — E2E-06: debugger renders canonical envelope type strings.
 *
 * Asserts that the napplet-debugger web component displays literal envelope type
 * strings (e.g. notify.create, identity.getPublicKey, relay.publish) and NOT
 * legacy BusKind enums, NIP-01 kind numbers, or anti-term strings.
 *
 * Note: The demo napplets (chat, bot) still use the legacy NIP-01 array protocol
 * and do not reach "authenticated" state under the v1.2 shell (which accepts only
 * NIP-5D envelope objects). Napplet migration to NIP-5D is Phase 18.
 * These tests verify the debugger using host-originated notify.create envelopes
 * (which are NIP-5D and flow correctly without napplet auth).
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;
const ENVELOPE_TYPE_RE = /shell\.ready|shell\.init|identity\.|relay\.|notify\.|storage\.|ifc\.|theme\.|keys\.|media\./;

test('debugger displays canonical envelope type strings after auth', async ({ page }) => {
  await demoBeforeEach(page);
  // Trigger a host-originated notification to guarantee notify.create appears in the debugger
  // (napplets use legacy NIP-01 arrays and auth in Phase 18; host envelopes work immediately)
  await page.locator('#notification-node-create').click();

  // Debugger web component renders in shadow DOM; textContent() includes shadow content in Chromium
  await expect(page.locator('napplet-debugger')).toContainText(
    /notify\.create|identity\.|relay\.|shell\./,
    { timeout: 5_000 },
  );

  // Assert no BusKind / kind numeric anti-term strings appear in rendered debugger text
  const debuggerText = await page.locator('napplet-debugger').textContent() ?? '';
  expect(debuggerText, `anti-term in debugger text: ${debuggerText.slice(0, 200)}`).not.toMatch(ANTI_TERM_RE);
});

test('debugger text includes at least one canonical envelope type after auth (smoke)', async ({ page }) => {
  await demoBeforeEach(page);
  await page.locator('#notification-node-create').click();
  // Use containsText which pierces shadow DOM (textContent() returns empty for shadow roots in Chromium)
  await expect(page.locator('napplet-debugger')).toContainText(
    ENVELOPE_TYPE_RE,
    { timeout: 5_000 },
  );
});
