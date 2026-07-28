import { expect, test } from '@playwright/test';
import { demoBeforeEach, getNappletFrame } from './helpers/index.js';

test.use({ baseURL: process.env.KEHTO_PLAYGROUND_BASE_URL ?? 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const PROFILE_PUBKEY = 'b'.repeat(64);

test('dispatches the feed profile convention to a cold target through canonical INC', async ({ page }) => {
  test.setTimeout(120_000);
  await demoBeforeEach(page);

  const feed = await getNappletFrame(page, 'feed-frame-container');
  if (!feed) throw new Error('feed frame must be ready');

  await expect(page.frameLocator('#profile-viewer-frame-container iframe').locator('#profile-status'))
    .toContainText('waiting', { timeout: 15_000 });

  const closedTarget = await page.evaluate(() => {
    const host = window as Window & {
      __closeNappletForTest__?: (dTag: string) => boolean;
      __clearPlaygroundTapForTest__?: () => void;
    };
    const closed = host.__closeNappletForTest__?.('profile-viewer') ?? false;
    host.__clearPlaygroundTapForTest__?.();
    return closed;
  });
  expect(closedTarget).toBe(true);
  await expect(page.locator('#profile-viewer-frame-container iframe')).toHaveCount(0);

  const accepted = await feed.evaluate(async (pubkey) => {
    const napplet = (window as Window & {
      napplet?: { intent?: { invoke(request: unknown): Promise<unknown> } };
    }).napplet;
    if (!napplet?.intent) throw new Error('published intent API unavailable');
    return napplet.intent.invoke({
      archetype: 'profile',
      convention: 'napplet:profile/open',
      payload: { pubkey },
    });
  }, PROFILE_PUBKEY);
  expect(accepted).toMatchObject({ ok: true, convention: 'napplet:profile/open' });

  const closedSource = await page.evaluate(() => {
    const host = window as Window & { __closeNappletForTest__?: (dTag: string) => boolean };
    return host.__closeNappletForTest__?.('feed') ?? false;
  });
  expect(closedSource).toBe(true);

  // The completed request must revive the verified profile handler and deliver
  // its stable convention through the ordinary runtime-attested INC carrier.
  await expect(page.locator('#profile-viewer-frame-container iframe')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.frameLocator('#profile-viewer-frame-container iframe').locator('#profile-pubkey'))
    .toHaveText(PROFILE_PUBKEY, { timeout: 15_000 });

  await expect.poll(async () => page.evaluate(() => {
    const host = window as Window & {
      __getPlaygroundEnvelopeTapForTest__?: () => Array<{
        direction: string;
        windowId?: string;
        type?: string;
        event?: unknown;
      }>;
    };
    return (host.__getPlaygroundEnvelopeTapForTest__?.() ?? [])
      .filter((message) => message.type === 'inc.event').length;
  }), { timeout: 15_000 }).toBe(1);

  const messages = await page.evaluate(() => {
    const host = window as Window & {
      __getPlaygroundEnvelopeTapForTest__?: () => Array<{
        direction: string;
        windowId?: string;
        type?: string;
        event?: unknown;
      }>;
    };
    return host.__getPlaygroundEnvelopeTapForTest__?.() ?? [];
  });

  const deliveries = messages.filter((message) => message.type === 'inc.event');
  expect(deliveries).toHaveLength(1);
  expect(deliveries[0]).toMatchObject({
    direction: 'shell->napplet',
  });
  expect(deliveries[0]?.event).toMatchObject({
    type: 'inc.event',
    topic: 'napplet:profile/open',
    sender: 'feed',
    payload: { pubkey: PROFILE_PUBKEY },
  });
  expect(messages.filter((message) => message.type === 'intent.deliver')).toHaveLength(0);
});
