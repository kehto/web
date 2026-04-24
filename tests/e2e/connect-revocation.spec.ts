/**
 * E2E-22 (v1.7 Phase 39 / Plan 39-05 / CONNECT-04 / C-04) — revocation
 * triggers iframe destroy+recreate; new iframe gets updated CSP.
 *
 * Phase 39 (v1.7 / Plan 39-05) — NUB-CONNECT + NUB-CONFIG Layer-B E2E.
 * Runs against the built :4174 demo (pnpm test:serve:demo). Anti-features
 * verified: no implicit allow on dismiss (M-04), no meta-CSP (C-03),
 * iframe destroy+recreate on revoke (C-04), preview-mode CSP present (C-05).
 *
 * Flow:
 *   1. Grant wss://relay.test to chat via __grantConnectOrigin__.
 *   2. Poll /napplets/chat/index.html; assert CSP includes wss://relay.test.
 *   3. Revoke all chat grants via __revokeConnect__ — dispatches shell:connect-revoked.
 *   4. Wait for main.ts to destroy + recreate the chat iframe.
 *   5. Fetch /napplets/chat/index.html AGAIN; assert CSP is connect-src 'none'.
 *
 * The key_link is the HTTP-header delivery mechanism: revoke mutates the
 * Vite middleware's in-memory Map (via fetch('/__connect-grants')); the
 * iframe reload triggers a fresh GET so the new header is delivered.
 */
import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://localhost:4174' });

test.describe('NUB-CONNECT revocation (E2E-22 / CONNECT-04)', () => {
  test('revoke triggers iframe destroy+recreate and updated CSP excludes revoked origin', async ({ page, request }) => {
    test.setTimeout(30_000);

    await page.goto('/');
    await page.evaluate(() => {
      try { localStorage.removeItem('napplet:connect'); } catch { /* best-effort */ }
    });
    await page.waitForSelector('#chat-frame-container iframe', { timeout: 10_000 });

    // Step 1: Grant wss://relay.test to chat.
    const granted = await page.evaluate(() =>
      // @ts-expect-error runtime hook
      window.__grantConnectOrigin__('chat', '', 'wss://relay.test'),
    );
    expect(granted).toBe(true);

    // Step 2: Poll until the Vite middleware's grants Map reflects the grant.
    // The POST /__connect-grants call is fire-and-forget; poll until header updates.
    await expect.poll(async () => {
      const r = await request.get('/napplets/chat/index.html');
      return r.headers()['content-security-policy'] ?? '';
    }, { timeout: 5_000 }).toMatch(/wss:\/\/relay\.test/);

    // Capture the iframe element before revoke so we can detect replacement.
    const iframeBefore = await page.$('#chat-frame-container iframe');
    expect(iframeBefore).not.toBeNull();

    // Step 3: Revoke — dispatches shell:connect-revoked; main.ts destroys + recreates iframe.
    await page.evaluate(() =>
      // @ts-expect-error runtime hook
      window.__revokeConnect__('chat', ''),
    );

    // Step 4: Wait for iframe destroy+recreate (new element replaces old one in the DOM).
    await expect.poll(async () => {
      const current = await page.$('#chat-frame-container iframe');
      if (!current) return 'no-iframe';
      // Compare identity: new element is !== old element
      const isSame = await current.evaluate((el, prev) => el === prev, iframeBefore);
      return isSame ? 'same' : 'replaced';
    }, { timeout: 5_000 }).toBe('replaced');

    // Step 5: Assert the refetched CSP header excludes the revoked origin.
    await expect.poll(async () => {
      const r = await request.get('/napplets/chat/index.html');
      return r.headers()['content-security-policy'] ?? '';
    }, { timeout: 5_000 }).toMatch(/connect-src\s+'none'/);
  });
});
