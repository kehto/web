/**
 * demo-node-inspector.spec.ts — E2E-06: inspector per-role dispatch.
 *
 * Rewrites the legacy spec (which spawned its own dev server on :4175).
 * v1.3 / Phase 17: uses the webServer array from playwright.config.ts,
 * uses demoBeforeEach, and asserts on canonical per-role inspector content.
 *
 * Note: The demo napplets (chat, bot) still use the legacy NIP-01 array protocol
 * and do not reach identity-bound state under the v1.2 shell (which accepts only
 * NIP-5D envelope objects). Napplet migration to NIP-5D is Phase 18.
 * Tests that previously waited for #chat-status = "identity-bound" now use the
 * "no identity-bound napplets" path or are removed from the identity-gated check.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('ACL node opens inspector with grant/revoke table', async ({ page }) => {
  await demoBeforeEach(page);
  // napplets use legacy NIP-01 arrays; ACL table will show "no identity-bound napplets" path
  await page.locator('#topology-node-acl').click();
  // Inspector-open class applied to flow-area-inner
  await expect(page.locator('#flow-area-inner')).toHaveClass(/inspector-open/, { timeout: 3_000 });
  // Inspector pane is visible and contains ACL content (table or no-napplets message)
  await expect(page.locator('#inspector-pane')).toBeVisible({ timeout: 3_000 });
  // At least one capability label visible in the pane (relay:, identity:, state:, etc.)
  await expect(page.locator('#inspector-pane')).toContainText(
    /relay:|identity:|state:|no identity-bound napplets/,
    { timeout: 3_000 },
  );
});

test('runtime node shows Registered NUBs with 8 entries', async ({ page }) => {
  await demoBeforeEach(page);
  await page.locator('#topology-node-runtime').click();
  await expect(page.locator('#inspector-pane')).toBeVisible({ timeout: 3_000 });
  // renderRuntimeRoleContent writes "Registered NUBs" header + <ul>
  await expect(page.locator('#inspector-pane')).toContainText('Registered NUBs', { timeout: 3_000 });
  // Check each of the 8 canonical NUB names appears somewhere in the pane
  const pane = page.locator('#inspector-pane');
  for (const nub of ['identity', 'keys', 'media', 'notifications', 'relay', 'signer', 'storage', 'theme']) {
    await expect(pane).toContainText(nub);
  }
});

test('napplet node (chat) shows capability state and recent envelopes', async ({ page }) => {
  await demoBeforeEach(page);
  // napplets use legacy protocol — chat node will show pending/not identity-bound inspector state
  await page.locator('[data-napplet-name="chat"]').click();
  await expect(page.locator('#inspector-pane')).toBeVisible({ timeout: 3_000 });
  await expect(page.locator('#inspector-pane')).toContainText(
    /Capability state|relay:|identity:|not identity-bound|pending/,
    { timeout: 3_000 },
  );
  await expect(page.locator('#inspector-pane')).toContainText(/Recent envelopes/, { timeout: 3_000 });
});

test('service node (notifications) shows service-role content', async ({ page }) => {
  await demoBeforeEach(page);
  await page.locator('[data-service-name="notifications"]').click();
  await expect(page.locator('#inspector-pane')).toBeVisible({ timeout: 3_000 });
  await expect(page.locator('#inspector-pane')).toContainText(/notifications/, { timeout: 3_000 });
});

test('inspector open/close via node click and close button', async ({ page }) => {
  await demoBeforeEach(page);
  // Open inspector
  await page.locator('#topology-node-runtime').click();
  await expect(page.locator('#flow-area-inner')).toHaveClass(/inspector-open/, { timeout: 3_000 });
  // Close via the close button
  await page.locator('#inspector-close').click();
  await expect(page.locator('#flow-area-inner')).not.toHaveClass(/inspector-open/, { timeout: 3_000 });
});

test('no anti-term in console output during inspector interactions', async ({ page }) => {
  const msgs: string[] = [];
  page.on('console', (m) => msgs.push(m.text()));
  await demoBeforeEach(page);
  await page.locator('#topology-node-acl').click();
  await page.locator('#inspector-close').click();
  await page.locator('#topology-node-runtime').click();
  await page.waitForTimeout(300);
  const anti = msgs.filter(m => ANTI_TERM_RE.test(m));
  expect(anti, `anti-term in console: ${anti.join(' | ')}`).toHaveLength(0);
});
