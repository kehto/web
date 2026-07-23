/**
 * NAP-IDENTITY browser contract — drive the real playground signer controller
 * and observe only the source-bound injected identity API in an eligible frame.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach, getNappletFrame } from './helpers/index.js';

test.use({ baseURL: process.env.KEHTO_PLAYGROUND_BASE_URL ?? 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;
const TEST_PUBKEY = '1'.repeat(64);

test('nap-identity: only real signer transitions publish one normal and one sign-out change', async ({ page }) => {
  test.setTimeout(60_000);
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => consoleMessages.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.addInitScript((pubkey) => {
    Object.defineProperty(window, 'nostr', {
      configurable: true,
      value: {
        getPublicKey: async () => pubkey,
        signEvent: async (event: Record<string, unknown>) => event,
      },
    });
  }, TEST_PUBKEY);

  await demoBeforeEach(page);
  const frame = await getNappletFrame(page, 'feed-frame-container');
  if (!frame) throw new Error('feed frame not found in page.frames()');

  await frame.evaluate(() => new Promise((resolve) => window.setTimeout(resolve, 150)));
  await frame.evaluate(() => {
    const target = window as Window & {
      __identityChanges?: string[];
      napplet?: { identity?: { onChanged(handler: (pubkey: string) => void): unknown } };
    };
    target.__identityChanges = [];
    target.napplet?.identity?.onChanged((pubkey) => target.__identityChanges?.push(pubkey));
  });

  await page.locator('[data-action="open-signer-connect"]').click();
  await page.locator('#nip07-connect-btn').click();
  await expect(page.locator('#nip07-status')).toContainText('Connected:', { timeout: 8_000 });
  await expect.poll(() => frame.evaluate(() => (window as Window & { __identityChanges?: string[] }).__identityChanges ?? [])).toEqual([TEST_PUBKEY]);
  await expect.poll(() => frame.evaluate(async () => {
    const identity = (window as Window & { napplet?: { identity?: { getPublicKey(): Promise<string> } } }).napplet?.identity;
    return identity?.getPublicKey();
  })).toBe(TEST_PUBKEY);

  // Let every real connection-state callback settle. The production preview
  // must remain at one normal transition without importing Vite source files.
  await page.waitForTimeout(250);
  await expect.poll(() => frame.evaluate(() => (window as Window & { __identityChanges?: string[] }).__identityChanges ?? [])).toEqual([TEST_PUBKEY]);

  await page.locator('[data-action="disconnect-signer"]').click();
  await expect.poll(() => frame.evaluate(() => (window as Window & { __identityChanges?: string[] }).__identityChanges ?? [])).toEqual([TEST_PUBKEY, '']);
  expect(consoleMessages.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
  expect(pageErrors.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
});
