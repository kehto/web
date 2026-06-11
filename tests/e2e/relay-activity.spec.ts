/**
 * Relay activity panel - shell relay runtime visibility.
 *
 * The lower shell chrome panel should show the relays selected by the
 * playground relay runtime, not synthetic NIP-66 fixture suggestions.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });

const TEST_PUBKEY = 'f'.repeat(64);

test('relay activity panel shows recent runtime relays and counters after feed subscribes', async ({ page }) => {
  test.setTimeout(60_000);

  await demoBeforeEach(page);

  await expect(page.locator('#relay-activity-panel')).toContainText('relay activity');
  await expect(page.locator('#relay-activity-list')).toContainText('no relay activity yet');
  await expect(page.locator('#relay-activity-panel')).not.toContainText('fixture-one');

  await page.evaluate((pubkey) => {
    (window as Window & { nostr?: unknown }).nostr = {
      getPublicKey: async () => pubkey,
      signEvent: async (event: Record<string, unknown>) => event,
    };
  }, TEST_PUBKEY);

  await page.locator('[data-action="open-signer-connect"]').click();
  await page.locator('[data-action="connect-nip07"]').click();

  await expect(page.locator('#topology-node-service-signer')).toContainText('nip-07', { timeout: 8_000 });
  await expect(page.locator('napplet-debugger')).toContainText('relay.subscribe', { timeout: 8_000 });

  await expect
    .poll(
      async () =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll('#relay-activity-list li')).map((li) => li.textContent ?? ''),
        ),
      { timeout: 8_000, intervals: [200] },
    )
    .toEqual(expect.arrayContaining([expect.stringMatching(/^wss:\/\/.+\d+ evt \/ \d+ sub \/ \d+ req \/ \d+ pub$/)]));
});
