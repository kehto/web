import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { finalizeEvent } from 'nostr-tools/pure';
import { naddrEncode, neventEncode } from 'nostr-tools/nip19';
import { createPajaRuntimeHostConfig, renderPajaHtml } from '../../packages/paja/dist/index.js';

// Authority: NIP-5D #2303@5560820 and NIP-19 master@0b5532c.
// Roots/named manifests have coordinates; immutable snapshots pin signed IDs.
const relay = 'wss://manifest-kinds.example';
const blossom = 'https://manifest-blobs.example';
const html = '<!doctype html><html><body><output id="ready">waiting</output><script>window.napplet.shell.ready().then(() => document.getElementById("ready").textContent = "ready");</script></body></html>';
const bytes = Buffer.from(html);
const hash = createHash('sha256').update(bytes).digest('hex');
const key = new Uint8Array(32).fill(3);
const fixtures = [
  { kind: 15129, title: 'Root napplet' },
  { kind: 35129, title: 'Named napplet' },
  { kind: 5129, title: 'First snapshot' },
  { kind: 5129, title: 'Second snapshot' },
].map(({ kind, title }) => {
  const event = finalizeEvent({
    kind, created_at: 1_700_000_000, content: title,
    tags: [...(kind === 35129 ? [['d', 'named-fixture']] : []), ['x', hash], ['title', title], ['server', blossom]],
  }, key);
  return {
    event, title,
    exact: neventEncode({ id: event.id, author: event.pubkey, kind, relays: [relay] }),
    coordinate: kind === 5129 ? null : naddrEncode({ kind, pubkey: event.pubkey, identifier: kind === 35129 ? 'named-fixture' : '', relays: [relay] }),
  };
});

async function prepare(page: Page) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (text: string) => {
      (window as unknown as { copiedAppLink: string }).copiedAppLink = text;
    } },
  }));
  const config = createPajaRuntimeHostConfig({ maxWaitMs: 2_000, simulation: { relay: { mode: 'live', urls: [relay] } } });
  const script = readFileSync(new URL('../../packages/paja/dist/browser-host.js', import.meta.url), 'utf8');
  const filters: Record<string, unknown>[] = [];
  await page.route('http://127.0.0.1:47689/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      contentType: path.endsWith('.js') ? 'text/javascript' : path.endsWith('.json') ? 'application/json' : 'text/html',
      body: path.endsWith('.js') ? script : path.endsWith('.json') ? JSON.stringify(config) : renderPajaHtml(config),
    });
  });
  await page.route(`${blossom}/**`, (route) => route.fulfill({
    status: new URL(route.request().url()).pathname === `/${hash}` ? 200 : 404,
    headers: { 'access-control-allow-origin': '*' }, contentType: 'text/html', body: bytes,
  }));
  await page.routeWebSocket(`${relay}/`, (socket) => socket.onMessage((message) => {
    const [action, subscription, filter] = JSON.parse(String(message));
    if (action !== 'REQ') return;
    filters.push(filter);
    for (const { event } of fixtures) {
      if (filter.ids && !filter.ids.includes(event.id)) continue;
      if (filter.kinds && !filter.kinds.includes(event.kind)) continue;
      if (filter.authors && !filter.authors.includes(event.pubkey)) continue;
      if (filter['#d'] && !event.tags.some((tag) => tag[0] === 'd' && filter['#d'].includes(tag[1]))) continue;
      socket.send(JSON.stringify(['EVENT', subscription, event]));
    }
    socket.send(JSON.stringify(['EOSE', subscription]));
  }));
  return filters;
}

for (const [index, mode] of [[0, 'coordinate'], [1, 'coordinate'], [2, 'exact'], [0, 'exact'], [1, 'exact']] as const) {
  test(`loads kind ${fixtures[index].event.kind} by ${mode} through verified srcdoc`, async ({ page }) => {
    const fixture = fixtures[index];
    const filters = await prepare(page);
    const pointer = fixture[mode]!;
    await page.goto(`http://127.0.0.1:47689/?${mode === 'coordinate' ? 'naddr' : 'nevent'}=${pointer}`);
    await expect(page.locator('#napplet-tabs .tab-label')).toHaveText(fixture.title);
    await expect(page.frameLocator('iframe').locator('#ready')).toHaveText('ready');
    await expect(page).toHaveTitle(fixture.title);
    await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts');
    expect(await page.locator('iframe').getAttribute('src')).toBeNull();
    await expect(page.locator('iframe')).toHaveAttribute('srcdoc', /data-kehto-nip5d-injection/);
    const target = await page.evaluate(() => window.__KEHTO_PAJA__!.getState().resolvedTarget!);
    expect(target.event.id).toBe(fixture.event.id);
    expect(target.event.kind).toBe(fixture.event.kind);
    expect(target.indexHtml).toBe(html);
    expect(target.aggregateHash).toBe(hash);
    await page.locator('#napplet-tabs .tab-share').click();
    const copied = await page.evaluate(() => (window as unknown as { copiedAppLink: string }).copiedAppLink);
    expect(new URL(copied).searchParams.get(mode === 'coordinate' ? 'naddr' : 'nevent')).toBe(pointer);
    if (mode === 'coordinate' && fixture.event.kind === 15129) {
      const query = filters.find((filter) => (filter.kinds as number[] | undefined)?.includes(15129));
      expect(query).toMatchObject({ authors: [fixture.event.pubkey], kinds: [15129] });
      expect(query).not.toHaveProperty('#d');
    }
    await page.reload();
    await expect(page.frameLocator('iframe').locator('#ready')).toHaveText('ready');
    await expect(page).toHaveTitle(fixture.title);
  });
}

test('keeps root, named and distinct same-byte snapshots in separate tabs across restoration', async ({ page }) => {
  await prepare(page);
  await page.goto('http://127.0.0.1:47689/');
  for (const fixture of fixtures) {
    await page.locator('#runtime-pointer-input').fill(fixture.coordinate ?? fixture.exact);
    await page.locator('#runtime-pointer-form button[type="submit"]').click();
    await expect(page.locator('#napplet-tabs .tab-label').last()).toHaveText(fixture.title);
  }
  await expect(page.locator('iframe')).toHaveCount(4);
  await expect.poll(() => page.evaluate(() => window.__KEHTO_PAJA__!.getState().tabs.every((tab) => tab.initSent))).toBe(true);
  await expect(page.locator('#duplicate-pointer-dialog')).not.toBeVisible();
  const state = await page.evaluate(() => window.__KEHTO_PAJA__!.getState());
  expect(state.tabs.map((tab) => tab.pointerValue)).toEqual(fixtures.map((fixture) => fixture.coordinate ?? fixture.exact));
  await page.reload();
  await expect(page.locator('#napplet-tabs .tab-label')).toHaveText(fixtures.map((fixture) => fixture.title));
  await expect(page.locator('iframe')).toHaveCount(4);
  await expect.poll(() => page.evaluate(() => window.__KEHTO_PAJA__!.getState().tabs.every((tab) => tab.initSent))).toBe(true);
  await expect(page).toHaveTitle('Second snapshot');
});
