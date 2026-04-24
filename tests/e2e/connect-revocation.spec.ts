/**
 * E2E-22 (v1.7 Phase 39 / Plan 39-05 / CONNECT-04 / C-04) — revocation
 * triggers iframe destroy+recreate; connectStore grant is cleared on revoke.
 *
 * Phase 39 (v1.7 / Plan 39-05) — NUB-CONNECT + NUB-CONFIG Layer-B E2E.
 * Runs against the built :4174 demo (pnpm test:serve:demo). Anti-features
 * verified: no implicit allow on dismiss (M-04), no meta-CSP (C-03),
 * iframe destroy+recreate on revoke (C-04), preview-mode CSP present (C-05).
 *
 * Flow:
 *   1. Grant wss://relay.test to chat via __grantConnectOrigin__.
 *   2. Verify grant persisted in localStorage.
 *   3. Revoke all chat grants via __revokeConnect__ — dispatches shell:connect-revoked.
 *   4. Wait for main.ts to destroy + recreate the chat iframe (C-04 assertion).
 *   5. Verify grant removed from localStorage (revocation persisted).
 *
 * The iframe destroy+recreate is the C-04 hard requirement: the new iframe
 * triggers a fresh GET to /napplets/chat/index.html so the Vite middleware
 * serves the updated CSP header (now reflecting the post-revoke grant state).
 * The localStorage assertion proves the connectStore's revoke() path is correct.
 */
import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://localhost:4174' });

test.describe('NUB-CONNECT revocation (E2E-22 / CONNECT-04)', () => {
  test.describe.configure({ mode: 'serial' });

  test('revoke triggers iframe destroy+recreate and connectStore clears the grant', async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      try { localStorage.removeItem('napplet:connect'); } catch { /* best-effort */ }
    });
    // Reset Vite in-memory grants for chat so state is clean before the revocation flow.
    // Use AbortSignal.timeout to bound the reset to 3s (best-effort, not required for the test logic).
    await page.evaluate(async () => {
      try {
        await fetch('/__connect-grants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dTag: 'chat', aggregateHash: '', origins: [] }),
          signal: AbortSignal.timeout(3000),
        });
      } catch { /* best-effort — timeout or network error is acceptable */ }
    });
    await page.waitForSelector('#chat-frame-container iframe', { timeout: 20_000 });

    // Step 1: Grant wss://relay.test to chat.
    const granted = await page.evaluate(() =>
      // @ts-expect-error runtime hook
      window.__grantConnectOrigin__('chat', '', 'wss://relay.test'),
    );
    expect(granted).toBe(true);

    // Step 2: Verify grant persisted in localStorage.
    const rawBefore = await page.evaluate(() => localStorage.getItem('napplet:connect'));
    expect(rawBefore).toBeTruthy();
    expect(rawBefore!).toContain('wss://relay.test');

    // Capture the iframe element before revoke so we can detect replacement.
    const iframeBefore = await page.$('#chat-frame-container iframe');
    expect(iframeBefore).not.toBeNull();

    // Step 3: Revoke — dispatches shell:connect-revoked; main.ts destroys + recreates iframe.
    const revoked = await page.evaluate(() =>
      // @ts-expect-error runtime hook
      window.__revokeConnect__('chat', ''),
    );
    expect(revoked).toBe(true);

    // Step 4: Wait for iframe destroy+recreate (new element replaces old one in the DOM).
    // C-04 requirement: shell MUST tear down and recreate the iframe on revoke.
    // We use the old iframe's id to detect the new one — loadNapplet assigns a fresh
    // windowId to the new iframe, so the src or id changes.
    const oldIframeId = await iframeBefore!.getAttribute('id');
    await page.waitForFunction(
      (oldId) => {
        const container = document.getElementById('chat-frame-container');
        const current = container?.querySelector('iframe');
        if (!current) return false; // iframe removed, waiting for new one
        return current.id !== oldId; // new iframe has a different id (fresh windowId)
      },
      oldIframeId,
      { timeout: 10_000 },
    );

    // Step 5: Verify grant removed from localStorage (revocation was persisted by revoke()).
    const rawAfter = await page.evaluate(() => localStorage.getItem('napplet:connect'));
    // After revoke(), the entry is deleted from the Map and persist() is called,
    // which either removes the key or stores an empty array.
    if (rawAfter !== null) {
      // connectStore.persist() serializes entries; if all entries are gone, the
      // stored JSON is '[]' (empty array) or the key is removed entirely.
      const parsed = JSON.parse(rawAfter) as Array<unknown>;
      const chatEntries = (parsed as Array<[string, unknown]>).filter(([k]) => k.startsWith('chat:'));
      expect(chatEntries.length, 'chat grant should be cleared from localStorage after revoke').toBe(0);
    }
    // If rawAfter is null: the key was removed entirely — grant is definitely cleared.
  });
});
