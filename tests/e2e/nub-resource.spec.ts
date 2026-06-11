/**
 * E2E-25 (resource demo shape) — the resource napplet shows a remote image
 * loaded through the shell's resource service rather than debug output.
 */
import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://localhost:4174' });

test('resource demo loads and renders a remote image', async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto('/');
  await page.waitForSelector('#resource-demo-frame-container iframe', { timeout: 10_000 });

  const resourceFrame = page.frameLocator('#resource-demo-frame-container iframe');
  const image = resourceFrame.locator('#resource-demo-image');
  const status = resourceFrame.locator('#resource-demo-status');
  const source = resourceFrame.locator('#resource-demo-source');

  await expect(status).toContainText(/^(loading remote image|loaded remote image)/, { timeout: 10_000 });
  await expect(source).toContainText('raw.githubusercontent.com', { timeout: 10_000 });
  await expect(image).toHaveAttribute('src', /^(blob:|https:\/\/raw\.githubusercontent\.com)/, { timeout: 15_000 });
  await expect.poll(async () => {
    return resourceFrame.locator('#resource-demo-image').evaluate((el) => {
      const img = el as HTMLImageElement;
      return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
    });
  }, { timeout: 15_000 }).toBe(true);
  await expect(resourceFrame.locator('#resource-demo-granted')).toHaveCount(0);
  await expect(resourceFrame.locator('#resource-demo-denied')).toHaveCount(0);
  await expect(resourceFrame.locator('#resource-demo-log')).toHaveCount(0);
});
