import { test, expect } from '@playwright/test';
import { finalizeEvent } from 'nostr-tools/pure';
import { demoBeforeEach } from './helpers/index.js';
import { DEMO_NAPPLETS } from '../../apps/playground/src/demo-definitions.js';

test.use({ baseURL: 'http://localhost:4174' });

// Playground dev manifest signing key ('11'.repeat(32)). Re-signing keeps the
// manifest signature valid so resolution succeeds and the load is rejected by
// the requires check (not by signature verification).
const DEV_SK = Uint8Array.from('11'.repeat(32).match(/.{2}/g)!.map((b) => parseInt(b, 16)));

test('playground rejects a napplet whose verified manifest requires an unsupported NAP', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.route('**/napplet-relay/event/toaster', async (route) => {
    const upstream = await route.fetch();
    const event = await upstream.json() as {
      kind: number;
      created_at: number;
      tags: string[][];
      content: string;
    };
    const resigned = finalizeEvent(
      {
        kind: event.kind,
        created_at: event.created_at,
        tags: [...event.tags, ['requires', 'unsupported-demo-nap']],
        content: event.content,
      },
      DEV_SK,
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(resigned),
    });
  });

  await demoBeforeEach(page);

  await expect(page.locator('#toaster-status')).toContainText('load failed', { timeout: 10_000 });
  await expect(page.locator('#toaster-frame-container iframe')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(DEMO_NAPPLETS.length - 1);

  expect(consoleErrors.join('\n')).toContain('failed to load napplet toaster');
  expect(consoleErrors.join('\n')).toContain('unsupported-demo-nap');
});
