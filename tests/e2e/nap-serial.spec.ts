/**
 * NAP-SERIAL demo spec -- proves the playground advertises serial and handles
 * shell-mediated runtime-owned serial open/write/close requests.
 */
import { test, expect } from '@playwright/test';

import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });

test('serial demo opens, writes, and closes a shell-owned serial session', async ({ page }) => {
  test.setTimeout(30_000);
  await demoBeforeEach(page);
  await expect(page.locator('#serial-demo-frame-container iframe')).toHaveCount(1, { timeout: 25_000 });

  const serialFrame = page.frameLocator('#serial-demo-frame-container iframe');
  await expect(serialFrame.locator('#serial-demo-status')).toContainText('opened:Playground serial; written:2; closed:ok', { timeout: 20_000 });
  await expect(serialFrame.locator('#serial-demo-opened')).toHaveText('Playground serial');
  await expect(serialFrame.locator('#serial-demo-written')).toHaveText('2');
  await expect(serialFrame.locator('#serial-demo-closed')).toHaveText('ok');
});
