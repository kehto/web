/**
 * demo-debugger.spec.ts — E2E-06: debugger renders canonical envelope type strings.
 *
 * Asserts that the napplet-debugger web component displays literal envelope type
 * strings (e.g. notify.create, identity.getPublicKey, relay.publish) and NOT
 * legacy BusKind enums, NIP-01 kind numbers, or anti-term strings.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;
const ENVELOPE_TYPE_RE = /shell\.ready|shell\.init|identity\.|relay\.|notify\.|storage\.|ifc\.|theme\.|keys\.|media\./;

test('debugger displays canonical envelope type strings after auth', async ({ page }) => {
  await demoBeforeEach(page);
  // Wait for legacy napplets to auth so envelopes flow
  await expect(page.locator('#chat-status')).toHaveText('authenticated', { timeout: 30_000 });

  // Trigger a notification to guarantee notify.create appears
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
  await expect(page.locator('#chat-status')).toHaveText('authenticated', { timeout: 30_000 });
  await page.locator('#notification-node-create').click();
  const txt = await page.locator('napplet-debugger').textContent() ?? '';
  expect(txt, 'expected at least one canonical envelope type in debugger').toMatch(ENVELOPE_TYPE_RE);
});
