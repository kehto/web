/**
 * NAP-LISTS demo spec -- proves the playground advertises lists and handles
 * shell-mediated NIP-51 list metadata and mutation requests.
 */
import { test, expect } from '@playwright/test';

import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });

test('lists demo resolves supported metadata and add/remove mutations', async ({ page }) => {
  test.setTimeout(30_000);
  await demoBeforeEach(page);
  await page.waitForSelector('#lists-demo-frame-container iframe', { timeout: 10_000 });

  const listsFrame = page.frameLocator('#lists-demo-frame-container iframe');
  await expect(listsFrame.locator('#lists-demo-status')).toContainText('supported:bookmarks; added:1; removed:1', { timeout: 20_000 });
  await expect(listsFrame.locator('#lists-demo-supported')).toHaveText('bookmarks');
  await expect(listsFrame.locator('#lists-demo-added')).toHaveText('1');
  await expect(listsFrame.locator('#lists-demo-removed')).toHaveText('1');
});
