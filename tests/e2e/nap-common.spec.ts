/**
 * NAP-COMMON demo spec -- proves the playground advertises common and handles
 * shell-mediated common social helper requests through the runtime service.
 */
import { test, expect } from '@playwright/test';

import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });

test('common demo resolves NIP-19, profile, follows, and actions', async ({ page }) => {
  test.setTimeout(30_000);
  await demoBeforeEach(page);
  await expect(page.locator('#common-demo-frame-container iframe')).toHaveCount(1, { timeout: 25_000 });

  const commonFrame = page.frameLocator('#common-demo-frame-container iframe');
  await expect(commonFrame.locator('#common-demo-status')).toContainText('encoded:npub; decoded:ok; profile:playground-common; follows:1; actions:ok', { timeout: 20_000 });
  await expect(commonFrame.locator('#common-demo-encoded')).toHaveText('npub');
  await expect(commonFrame.locator('#common-demo-profile')).toHaveText('playground-common');
  await expect(commonFrame.locator('#common-demo-follows')).toHaveText('1');
  await expect(commonFrame.locator('#common-demo-actions')).toHaveText('ok');
});
