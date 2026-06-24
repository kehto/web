import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });

const disabledDemoNapplets = [
  'ble-demo',
  'common-demo',
  'link-demo',
  'lists-demo',
  'serial-demo',
  'webrtc-demo',
] as const;

test('fake demo napplets are retained as sources but not hosted in the playground', async ({ page }) => {
  await demoBeforeEach(page);

  const loadedNames = await page.$$eval('iframe', (iframes) =>
    iframes
      .map((iframe) => iframe.id.match(/^demo-(.+)-\d+$/)?.[1])
      .filter((name): name is string => typeof name === 'string')
      .sort(),
  );

  for (const name of disabledDemoNapplets) {
    expect(loadedNames, `${name} must not load as a playground iframe`).not.toContain(name);
    await expect(page.locator(`#topology-node-napplet-${name}`)).toHaveCount(0);
    await expect(page.locator(`#${name}-frame-container iframe`)).toHaveCount(0);
  }
});
