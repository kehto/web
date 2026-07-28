import { test, expect } from '@playwright/test';
import { demoBeforeEach, getNappletFrame } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const PROFILE_PUBKEY = 'a'.repeat(64);

test('profile-viewer receives the published profile convention from the feed frame', async ({ page }) => {
  test.setTimeout(120_000);

  await demoBeforeEach(page);

  const profileFrame = page.frameLocator('#profile-viewer-frame-container iframe');
  await expect(profileFrame.locator('#profile-status')).toContainText('waiting', { timeout: 10_000 });

  const frame = await getNappletFrame(page, 'feed-frame-container');
  if (!frame) throw new Error('feed srcdoc frame missing');
  const result = await frame.evaluate(async (pubkey) => {
    const intent = (window as Window & {
      napplet?: { intent?: { invoke(uri: string): Promise<unknown> } };
    }).napplet?.intent;
    if (!intent) throw new Error('published intent API unavailable');
    return intent.invoke({
      archetype: 'profile',
      convention: 'napplet:profile/open',
      payload: { pubkey },
    });
  }, PROFILE_PUBKEY);
  expect(result).toMatchObject({ ok: true, convention: 'napplet:profile/open' });

  await expect(profileFrame.locator('#profile-pubkey')).toContainText(PROFILE_PUBKEY, { timeout: 10_000 });
  await expect(profileFrame.locator('#profile-status')).toContainText(/^(loaded|not found)/, { timeout: 15_000 });
  await expect(profileFrame.locator('#profile-log')).toHaveCount(0);
  await expect.poll(async () => frame.evaluate(() => {
    const napplet = (window as Window & { napplet?: Record<string, unknown> }).napplet;
    return typeof napplet?.intent;
  })).toBe('object');
});
