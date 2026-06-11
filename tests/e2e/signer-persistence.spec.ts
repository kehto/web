import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const TEST_PUBKEY = 'e'.repeat(64);
const SIGNER_STORAGE_KEY = 'kehto.playground.signerConnection.v1';

test('connected signer is restored after playground reload', async ({ page }) => {
  test.setTimeout(60_000);

  await page.addInitScript((pubkey) => {
    (window as Window & { nostr?: unknown }).nostr = {
      getPublicKey: async () => pubkey,
      signEvent: async (event: Record<string, unknown>) => event,
    };
  }, TEST_PUBKEY);

  await demoBeforeEach(page);

  await page.locator('[data-action="open-signer-connect"]').click();
  await page.locator('[data-action="connect-nip07"]').click();

  await expect(page.locator('#topology-node-service-signer')).toContainText('nip-07', { timeout: 8_000 });
  await expect.poll(
    () => page.evaluate((key) => localStorage.getItem(key), SIGNER_STORAGE_KEY),
    { timeout: 8_000 },
  ).toContain('"method":"nip07"');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#topology-root', { state: 'visible', timeout: 15_000 });

  await expect(page.locator('#topology-node-service-signer')).toContainText('nip-07', { timeout: 8_000 });
  await expect(page.locator('#topology-node-service-signer')).toContainText('eeeeeeee...eeee', { timeout: 8_000 });
  await expect(page.locator('napplet-debugger')).toContainText('signer restored from previous session', {
    timeout: 8_000,
  });

  const feedFrame = page.frameLocator('#feed-frame-container iframe');
  await expect(feedFrame.locator('#feed-status')).toContainText(/^(subscribed|loading|loaded)/, {
    timeout: 10_000,
  });
  await expect(feedFrame.locator('#feed-log')).toHaveCount(0);
});
