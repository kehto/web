/**
 * demo-concurrent-boot.spec.ts — E2E-15 (v1.5 Phase 31).
 *
 * Locks DEMO-01 in CI: all DEMO_NAPPLETS must reach the
 * 'identity-bound' status sentinel within 10 seconds of booting the full
 * :4174 demo — no __loadNapplet__ single-frame helper, native topology
 * concurrent-boot path only.
 *
 * Pre-Phase-29 regression shape (for future debugging): chat + bot hit
 * identity-bound in ~2s; the other napplets stalled on 'loading…'
 * because apps/playground/src/main.ts:refreshAclPanelsIfNeeded() had a stale
 * `aclRendered.size < 8` guard that blocked per-napplet status label
 * updates once the set grew past 8. Plan 29-01 rewrote it as a data-
 * driven loop over DEMO_NAPPLETS; this spec prevents the shape from
 * recurring.
 *
 * Note the statusId naming quirk verified in Phase 29 UAT:
 *   profile-viewer  → #profile-status  (not #profile-viewer-status)
 * All other napplets follow the `${name}-status` pattern.
 *
 * theme-switcher was removed in task 260616-8iv: moved to host-side UI on
 * the theme service card (theme-switcher-host.ts). No iframe status sentinel.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

// Mirrors apps/playground/src/shell-host.ts:DEMO_NAPPLETS statusId fields.
// Keep this list in sync if a new napplet is added.
const NAPPLETS = [
  { name: 'ble-demo',         statusId: 'ble-demo-status' },
  { name: 'bot',              statusId: 'bot-status' },
  { name: 'chat',             statusId: 'chat-status' },
  { name: 'common-demo',      statusId: 'common-demo-status' },
  { name: 'composer',         statusId: 'composer-status' },
  { name: 'cvm-relatr',       statusId: 'cvm-relatr-status' },
  { name: 'feed',             statusId: 'feed-status' },
  { name: 'lists-demo',       statusId: 'lists-demo-status' },
  { name: 'preferences',      statusId: 'preferences-status' },
  { name: 'profile-viewer',   statusId: 'profile-status' },
  { name: 'resource-demo',    statusId: 'resource-demo-status' },
  { name: 'serial-demo',      statusId: 'serial-demo-status' },
  { name: 'toaster',          statusId: 'toaster-status' },
  { name: 'webrtc-demo',      statusId: 'webrtc-demo-status' },
] as const;

test('all DEMO_NAPPLETS reach identity-bound within 10s on concurrent boot at :4174', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  // Poll every 250→500→1000ms up to 10s until every napplet's status
  // sentinel reads 'identity-bound'. On failure, toMatchObject prints a
  // full diff of actual vs expected — the regressing napplet(s) will
  // show `got 'loading…'` / `got 'MISSING'` and immediately pinpoint
  // the DEMO-01-shape regression.
  await expect.poll(
    async () => {
      return await page.evaluate((napplets) => {
        const out: Record<string, string> = {};
        for (const n of napplets) {
          const el = document.getElementById(n.statusId);
          out[n.name] = el ? (el.textContent ?? '').trim() : 'MISSING';
        }
        return out;
      }, NAPPLETS as unknown as { name: string; statusId: string }[]);
    },
    { timeout: 10_000, intervals: [250, 500, 1000] },
  ).toMatchObject(
    Object.fromEntries(NAPPLETS.map((n) => [n.name, 'identity-bound'])),
  );

  // Anti-term hygiene: no forbidden protocol strings in console or page errors.
  const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);

  const antiErrors = pageErrors.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});
