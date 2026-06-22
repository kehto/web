/**
 * demo-boot.spec.ts — E2E-06: demo boots clean at :4174 with all service nodes.
 *
 * Asserts: topology renders all service nodes, STUB_ONLY_SERVICES is now empty
 * — both keys (graduated to real-backend in Phase 26) and media (graduated in
 * Phase 27) are now backed by real implementations; see STUB_ONLY_SERVICES in
 * apps/playground/src/shell-host.ts. No anti-term (window.nostr / signer-service /
 * BusKind / AUTH_KIND / kind === 29001/29002) appears in console output.
 * Also guards the opaque-origin iframe postMessage regression where hosted
 * napplets time out because a sender targets localhost instead of '*'.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';
import { DEMO_TOPOLOGY_SERVICE_NAMES } from '../../apps/playground/src/demo-definitions.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;
const POSTMESSAGE_TRANSPORT_RE =
  /target origin provided|recipient window's origin \('null'\)|Transport request timed out|Error restoring session/i;

test('demo renders all topology service nodes on boot', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  const serviceNodes = page.locator('[data-service-name]');
  await expect(serviceNodes).toHaveCount(DEMO_TOPOLOGY_SERVICE_NAMES.length, { timeout: 10_000 });

  // Both keys and media graduated to real-backend (Phase 26 + Phase 27);
  // STUB_ONLY_SERVICES is now empty, so no data-service-stub="true" markers
  // exist in the topology and no .stub-badge elements render.
  await expect(page.locator('[data-service-name="keys"][data-service-stub="true"]')).toHaveCount(0);
  await expect(page.locator('[data-service-name="media"][data-service-stub="true"]')).toHaveCount(0);
  await expect(page.locator('.stub-badge')).toHaveCount(0);

  // Shell pubkey rendered (injected dynamically into topology)
  await expect(page.locator('#shell-pubkey')).toContainText('pubkey:');

  // No anti-term in console output captured during boot
  const antiConsole = consoleMessages.filter(m => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);

  // No page errors matching anti-term
  const antiErrors = pageErrors.filter(m => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);

  const transportConsole = consoleMessages.filter(m => POSTMESSAGE_TRANSPORT_RE.test(m));
  expect(
    transportConsole,
    `postMessage transport regression in console: ${transportConsole.join(' | ')}`,
  ).toHaveLength(0);

  const transportErrors = pageErrors.filter(m => POSTMESSAGE_TRANSPORT_RE.test(m));
  expect(
    transportErrors,
    `postMessage transport regression in page errors: ${transportErrors.join(' | ')}`,
  ).toHaveLength(0);
});
