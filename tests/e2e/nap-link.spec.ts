/**
 * NAP-LINK demo spec -- proves the playground advertises link, opens safe URLs,
 * and denies unsafe schemes through the shell-owned link service.
 */
import { test, expect } from '@playwright/test';

import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });

test('link demo opens allowed URLs and denies unsafe schemes', async ({ page }) => {
  test.setTimeout(30_000);
  await demoBeforeEach(page);
  await expect(page.locator('#link-demo-frame-container iframe')).toHaveCount(1, { timeout: 25_000 });

  const linkFrame = page.frameLocator('#link-demo-frame-container iframe');
  await expect(linkFrame.locator('#link-demo-status')).toContainText('allowed:opened; denied:denied', { timeout: 10_000 });
  await expect(linkFrame.locator('#link-demo-opened')).toHaveText('opened');
  await expect(linkFrame.locator('#link-demo-denied')).toHaveText('denied');
});
