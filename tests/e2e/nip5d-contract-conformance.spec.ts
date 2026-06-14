import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });

test('playground rejects a napplet whose manifest requires an unsupported NAP', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.route('**/napplet-gateway/toaster/manifest.json', async (route) => {
    const upstream = await route.fetch();
    const metadata = await upstream.json() as {
      requires?: string[];
      [key: string]: unknown;
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...metadata,
        requires: [...(metadata.requires ?? []), 'unsupported-demo-nub'],
      }),
    });
  });

  await demoBeforeEach(page);

  await expect(page.locator('#toaster-status')).toContainText('load failed', { timeout: 10_000 });
  await expect(page.locator('#toaster-frame-container iframe')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(12);

  expect(consoleErrors.join('\n')).toContain('failed to load napplet toaster');
  expect(consoleErrors.join('\n')).toContain('unsupported-demo-nub');
});
