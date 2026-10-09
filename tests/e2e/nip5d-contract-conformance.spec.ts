import { test, expect } from '@playwright/test';
import { finalizeEvent } from 'nostr-tools/pure';
import { computeAggregateHash } from '../../packages/nip/src/5a/index.js';
import { demoBeforeEach } from './helpers/index.js';
import { DEMO_NAPPLETS } from '../../apps/playground/src/demo-definitions.js';

test.use({ baseURL: 'http://localhost:4174' });

// Playground dev manifest signing key ('11'.repeat(32)). Re-signing keeps the
// manifest signature valid so resolution succeeds and the load is rejected by
// the requires check (not by signature verification).
const DEV_SK = Uint8Array.from('11'.repeat(32).match(/.{2}/g)!.map((b) => parseInt(b, 16)));

for (const format of ['current', 'legacy'] as const) {
test(`playground rejects ${format} manifests requiring an unsupported NAP`, async ({ page }) => {
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
        tags: [...schemaTags(event.tags, format), [format === 'current' ? 'R' : 'requires', 'unsupported-demo-nap']],
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


test(`playground loads ${format} events with verified identity and optional unavailable domains`, async ({ page }) => {
  let expectedHash = '';
  await page.route('**/napplet-relay/event/toaster', async (route) => {
    const response = await route.fetch();
    const event = await response.json();
    const tags = [...schemaTags(event.tags, format), ['O', 'unavailable-optional-domain']];
    expectedHash = tags.find((tag) => tag[0] === 'x')![1];
    const signed = finalizeEvent({ kind: event.kind, created_at: event.created_at, content: event.content, tags }, DEV_SK);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(signed) });
  });
  await demoBeforeEach(page);
  const frame = page.locator('#toaster-frame-container iframe');
  await expect(frame).toHaveCount(1);
  expect(await frame.getAttribute('sandbox')).toBe('allow-scripts');
  expect(await frame.getAttribute('src')).toBeNull();
  expect(await frame.getAttribute('srcdoc')).toContain('shell.ready');
  expect(expectedHash).toMatch(/^[a-f0-9]{64}$/);
  // srcdoc executes the real artifact; shell availability is independent of O.
  const handle = await frame.elementHandle();
  const target = await handle?.contentFrame();
  expect(target).toBeTruthy();
  await expect.poll(() => target!.evaluate(() => {
    const napplet = (window as unknown as { napplet?: { shell?: { supports(name: string): boolean } } }).napplet;
    return napplet?.shell?.supports('notify');
  })).toBe(true);
  expect(await target!.evaluate(() => 'unavailable-optional-domain' in (window as unknown as { napplet: object }).napplet)).toBe(false);
});
}

function schemaTags(tags: string[][], format: 'current' | 'legacy'): string[][] {
  if (format === 'current') return tags;
  const hash = tags.find((tag) => tag[0] === 'x')![1];
  const aggregate = computeAggregateHash([{ path: '/index.html', sha256: hash }]);
  const roles = tags.filter((tag) => tag[0] === 'z').map((tag) => tag[1]);
  const intents = tags.filter((tag) => tag[0] === 'i').map((tag) => tag[1]);
  return [
    ...tags.filter((tag) => !['x', 'z', 'i', 'R', 'O'].includes(tag[0])),
    ['path', '/index.html', hash], ['x', aggregate, 'aggregate'],
    ...tags.filter((tag) => tag[0] === 'R').map((tag) => ['requires', tag[1]]),
    ...roles.flatMap((slug) => intents.map((intent) => ['archetype', slug, intent])),
  ];
}
