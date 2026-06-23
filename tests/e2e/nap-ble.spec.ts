/**
 * NAP-BLE demo spec -- proves the playground advertises ble and handles
 * shell-mediated runtime-owned BLE open/services/read/write/subscribe/close requests.
 */
import { test, expect } from '@playwright/test';

import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });

test('ble demo opens, reads, writes, subscribes, and closes a shell-owned BLE session', async ({ page }) => {
  test.setTimeout(30_000);
  await demoBeforeEach(page);
  await expect(page.locator('#ble-demo-frame-container iframe')).toHaveCount(1, { timeout: 25_000 });

  const bleFrame = page.frameLocator('#ble-demo-frame-container iframe');
  await expect(bleFrame.locator('#ble-demo-status')).toContainText(
    'opened:Playground BLE; services:1; read:87; written:2; subscribed:ok; closed:ok',
    { timeout: 20_000 },
  );
  await expect(bleFrame.locator('#ble-demo-device')).toHaveText('Playground BLE');
  await expect(bleFrame.locator('#ble-demo-services')).toHaveText('1');
  await expect(bleFrame.locator('#ble-demo-read')).toHaveText('87');
  await expect(bleFrame.locator('#ble-demo-written')).toHaveText('2');
  await expect(bleFrame.locator('#ble-demo-subscribed')).toHaveText('ok');
  await expect(bleFrame.locator('#ble-demo-closed')).toHaveText('ok');
});
