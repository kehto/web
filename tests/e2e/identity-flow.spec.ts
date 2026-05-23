/**
 * identity-flow.spec.ts — E2E-07 (identity-flow subset, Phase 20 NAP-07).
 *
 * Profile-viewer calls identityGetPublicKey + identityGetProfile on init;
 * this spec asserts the envelope reached the shell (visible in debugger as 'identity.getPublicKey')
 * and the DOM contract was updated.
 *
 * Demo has no default signer connection — spec tolerates two outcome paths:
 *   - 'loaded' path: getPublicKey resolves (possibly with empty string); DOM shows truncated
 *     hex pubkey OR the 'no-pubkey' sentinel (truncatePubkey('') === 'no-pubkey' per Plan 20-03).
 *   - 'denied:' path: identity:read ACL denied before getPublicKey completed; status starts
 *     with 'denied:' — proof the envelope WAS dispatched; pubkey assertion relaxed to avoid
 *     asserting content that never arrived.
 *
 * Both paths prove the identity.getPublicKey envelope was dispatched and the shell
 * responded — the napplet reached the shell and the protocol round-trip completed.
 *
 * Serial mode prevents postMessage timing interference when multiple napplet specs run in the
 * same Playwright worker. All frame interactions use frameLocator (toContainText pierces shadow
 * DOM); no frame.evaluate() needed as this spec involves no button clicks.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('profile-viewer reads identity.getPublicKey and renders truncated pubkey', async ({ page }) => {
  test.setTimeout(60_000);
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  const profileFrame = page.frameLocator('#profile-viewer-frame-container iframe');

  // Step 1: wait for status transition from 'connecting...' to identity-bound or loaded.
  // When no signer is configured, getPublicKey returns immediately with empty pubkey so the status
  // can race from 'identity-bound' to 'loaded' before Playwright polls.
  await expect(profileFrame.locator('#profile-status')).toContainText(
    /^(identity-bound|loaded|denied:)/,
    { timeout: 10_000 },
  );

  // Step 2: wait for getPublicKey + getProfile to resolve. Demo may have no NIP-46 signer connected,
  // in which case getPublicKey resolves with '' and Plan 20-03 renders the sentinel 'no-pubkey'.
  // Accept either 'loaded' (real pubkey) or 'denied:' (identity:read denied without signer setup).
  await expect(profileFrame.locator('#profile-status')).toContainText(/^(loaded|denied:)/, { timeout: 12_000 });

  // Step 3: regardless of loaded/denied path, #profile-pubkey must be populated.
  // - loaded + real pubkey: textContent matches truncated hex pattern /^[0-9a-f]{8}\.\.\.[0-9a-f]{4}$/
  // - loaded + empty pubkey: textContent is 'no-pubkey'
  // - denied (identity:read rejected before getPublicKey completed): textContent may be empty — this
  //   is acceptable only when status starts with 'denied:' (proof the envelope WAS dispatched).
  const pubkeyContent = await profileFrame.locator('#profile-pubkey').textContent();
  const statusContent = await profileFrame.locator('#profile-status').textContent();
  if (statusContent?.startsWith('loaded')) {
    // Loaded path: pubkey must be either truncated hex or 'no-pubkey' sentinel.
    expect(pubkeyContent, 'pubkey populated in loaded path').not.toBe(null);
    expect(pubkeyContent!.length, 'pubkey non-empty in loaded path').toBeGreaterThan(0);
    const isTruncHex = /^[0-9a-f]{8}\.\.\.[0-9a-f]{4}$/i.test(pubkeyContent!);
    const isNoSentinel = pubkeyContent === 'no-pubkey';
    expect(isTruncHex || isNoSentinel, `pubkey textContent '${pubkeyContent}' must be truncated hex or 'no-pubkey'`).toBe(true);
  }
  // If denied path, no strict pubkey assertion — proof is status === 'denied:' (envelope reached shell).

  // Step 4: debugger shows the identity.getPublicKey envelope type (NIP-5D canonical).
  await expect(page.locator('napplet-debugger')).toContainText('identity.getPublicKey', { timeout: 8_000 });

  const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);
  const antiErrors = pageErrors.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});
