import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const PROFILE_PUBKEY = 'a'.repeat(64);

test('profile-viewer opens a NAP-01 profile request emitted from the feed frame', async ({ page }) => {
  test.setTimeout(60_000);

  await demoBeforeEach(page);

  const profileFrame = page.frameLocator('#profile-viewer-frame-container iframe');
  await expect(profileFrame.locator('#profile-status')).toContainText('waiting', { timeout: 10_000 });

  // srcdoc iframes have an opaque origin (about:srcdoc) — resolve the feed frame
  // by its container element, not by URL.
  await expect.poll(async () => {
    const handle = await page.locator('#feed-frame-container iframe').elementHandle();
    const frame = handle ? await handle.contentFrame() : null;
    if (!frame) return false;
    return frame.evaluate(() => {
      const maybeWindow = window as Window & {
        napplet?: { inc?: { emit?: unknown } };
      };
      return typeof maybeWindow.napplet?.inc?.emit === 'function';
    });
  }, { timeout: 10_000 }).toBe(true);

  const feedHandle = await page.locator('#feed-frame-container iframe').elementHandle();
  const frame = feedHandle ? await feedHandle.contentFrame() : null;
  expect(frame, 'feed srcdoc frame').not.toBeNull();
  await frame!.evaluate((pubkey) => {
    const maybeWindow = window as Window & {
      napplet?: {
        inc?: { emit?: (topic: string, extraTags?: string[][], content?: string) => void };
      };
    };
    maybeWindow.napplet?.inc?.emit?.('profile:open', [], JSON.stringify({ pubkey }));
  }, PROFILE_PUBKEY);

  await expect(profileFrame.locator('#profile-pubkey')).toContainText(PROFILE_PUBKEY, { timeout: 10_000 });
  await expect(profileFrame.locator('#profile-status')).toContainText(/^(loaded|not found)/, { timeout: 15_000 });
  await expect(profileFrame.locator('#profile-log')).toHaveCount(0);
  await expect(page.locator('napplet-debugger')).toContainText('inc.emit', { timeout: 8_000 });
});
