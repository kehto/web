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

  await expect.poll(async () => {
    const frame = page.frames().find((candidate) =>
      new URL(candidate.url()).pathname.includes('/napplet-gateway/feed/'),
    );
    if (!frame) return false;
    return frame.evaluate(() => {
      const maybeWindow = window as Window & {
        napplet?: {
          ifc?: { emit?: unknown };
        };
      };
      return typeof maybeWindow.napplet?.ifc?.emit === 'function';
    });
  }, { timeout: 10_000 }).toBe(true);

  const frame = page.frames().find((candidate) =>
    new URL(candidate.url()).pathname.includes('/napplet-gateway/feed/'),
  );
  expect(frame, 'feed gateway frame').toBeDefined();
  await frame!.evaluate((pubkey) => {
    const maybeWindow = window as Window & {
      napplet?: {
        ifc?: { emit?: (topic: string, extraTags?: string[][], content?: string) => void };
      };
    };
    maybeWindow.napplet?.ifc?.emit?.('profile:open', [], JSON.stringify({ pubkey }));
  }, PROFILE_PUBKEY);

  await expect(profileFrame.locator('#profile-pubkey')).toContainText(PROFILE_PUBKEY, { timeout: 10_000 });
  await expect(profileFrame.locator('#profile-status')).toContainText(/^(loaded|not found)/, { timeout: 15_000 });
  await expect(profileFrame.locator('#profile-log')).toHaveCount(0);
  await expect(page.locator('napplet-debugger')).toContainText('ifc.emit', { timeout: 8_000 });
  await expect(page.locator('napplet-debugger')).toContainText('relay.subscribe', { timeout: 8_000 });
});
