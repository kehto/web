/**
 * Paja reports a pointer whose event is gone as "not found", not as a relay
 * failure (#471).
 *
 * Incident: an addressable napplet was republished, relays replaced the old
 * event, and its nevent showed "Relay query failed ... connection failed"
 * because one of five relays was down while the other four answered EOSE.
 *
 * Fake relays: `page.routeWebSocket` relays answer REQ honestly against their
 * filter; a closed loopback port reproduces a relay whose socket never opens.
 * No live relay is contacted.
 *
 * Provenance (NIP-5D, nostr-protocol/nips#2303 @ f60550c3): the replacement is
 * only an offer. Until the user clicks it no Blossom byte is fetched and no
 * napplet frame exists; the click starts an ordinary naddr load whose
 * identity is computed from the new verified bytes.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { expect, test, type Page } from '@playwright/test';
import { naddrEncode, neventEncode } from 'nostr-tools/nip19';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import { createPajaRuntimeHostConfig, renderPajaHtml } from '../../packages/paja/dist/index.js';

const HOST = 'http://127.0.0.1:47693';
const BLOSSOM = 'https://not-found-blobs.example';
const AUTHOR = new Uint8Array(32).fill(31);
const ANSWERING = ['wss://answer-a.example', 'wss://answer-b.example', 'wss://answer-c.example', 'wss://answer-d.example'];

type Filter = { ids?: string[]; kinds?: number[]; authors?: string[]; '#d'?: string[] };
type SignedEvent = ReturnType<typeof finalizeEvent>;

/** A loopback port that is guaranteed closed (bound then released). */
async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function servePaja(page: Page, relays: readonly string[]): Promise<void> {
  const config = createPajaRuntimeHostConfig({ maxWaitMs: 2_000, simulation: { relay: { mode: 'live', urls: [...relays] } } });
  const script = readFileSync(new URL('../../packages/paja/dist/browser-host.js', import.meta.url), 'utf8');
  await page.route(`${HOST}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      contentType: path.endsWith('.js') ? 'text/javascript' : path.endsWith('.json') ? 'application/json' : 'text/html',
      body: path.endsWith('.js') ? script : path.endsWith('.json') ? JSON.stringify(config) : renderPajaHtml(config),
    });
  });
}

function matches(event: SignedEvent, filter: Filter): boolean {
  if (filter.ids && !filter.ids.includes(event.id)) return false;
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
  if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
  const d = event.tags.find((tag) => tag[0] === 'd')?.[1] ?? '';
  return !filter['#d'] || filter['#d'].includes(d);
}

async function fakeRelay(page: Page, url: string, events: readonly SignedEvent[]): Promise<void> {
  await page.routeWebSocket(`${url}/`, (socket) => socket.onMessage((message) => {
    const [action, subscription, filter] = JSON.parse(String(message)) as [string, string, Filter];
    if (action !== 'REQ') return;
    for (const event of events) if (matches(event, filter)) socket.send(JSON.stringify(['EVENT', subscription, event]));
    socket.send(JSON.stringify(['EOSE', subscription]));
  }));
}

function manifest(dTag: string, createdAt: number, artifact: Buffer): SignedEvent {
  const hash = createHash('sha256').update(artifact).digest('hex');
  return finalizeEvent({
    kind: 35129,
    created_at: createdAt,
    content: 'Not-found fixture',
    tags: [['d', dTag], ['R', 'shell'], ['x', hash], ['title', `Fixture ${dTag}`], ['server', BLOSSOM]],
  }, AUTHOR);
}

const artifact = (label: string) => Buffer.from(`<!doctype html><html><body><output id="ready">${label}</output></body></html>`);

async function pajaState(page: Page) {
  return page.evaluate(() => {
    const state = window.__KEHTO_PAJA__!.getState();
    return {
      status: state.status,
      tabs: state.tabs.map((tab) => tab.pointerValue),
      resolvedTarget: state.resolvedTarget as { aggregateHash?: string } | null,
      iframes: document.querySelectorAll('#napplet-stage iframe').length,
      logTypes: state.messageLog.map((entry) => entry.type),
      notFound: state.messageLog.filter((entry) => entry.type === 'paja.pointer.not-found').map((entry) => JSON.parse(entry.preview) as Record<string, unknown>),
    };
  });
}

test('four relays answering EOSE and one down reads as not found, not a connection failure', async ({ page }) => {
  const down = `ws://127.0.0.1:${await closedPort()}`;
  const relays = [...ANSWERING, down];
  for (const url of ANSWERING) await fakeRelay(page, url, []);
  await servePaja(page, relays);
  const gone = manifest('feed', 1_700_000_000, artifact('old'));
  // No author, so Paja has nothing to look up a replacement with.
  const pointer = neventEncode({ id: gone.id, kind: 35129, relays });
  await page.goto(`${HOST}/?nevent=${pointer}`);

  const status = page.locator('#runtime-pointer-status');
  await expect(status).toContainText('not found (4 answered, 1 failed)', { timeout: 10_000 });
  await expect(status).toContainText('reached EOSE without a matching nevent');
  await expect(status).toContainText(down);
  await expect(status).not.toContainText('Relay query failed');
  await expect(status).not.toContainText('WebSocket connection limit');

  const state = await pajaState(page);
  expect(state.status).toBe('error');
  expect(state.tabs).toEqual([]);
  expect(state.logTypes).not.toContain('paja.relay.unreachable');
  expect(state.notFound).toHaveLength(1);
  expect(state.notFound[0]).toMatchObject({ answered: 4 });
  expect(state.notFound[0]!.failed).toHaveLength(1);
  await expect(page.locator('#runtime-pointer-offer')).toBeHidden();
});

test('no relay connecting keeps the no-connection message and its WebSocket hint', async ({ page }) => {
  const relays = [`ws://127.0.0.1:${await closedPort()}`, `ws://127.0.0.1:${await closedPort()}`];
  await servePaja(page, relays);
  const gone = manifest('feed', 1_700_000_000, artifact('old'));
  await page.goto(`${HOST}/?nevent=${neventEncode({ id: gone.id, kind: 35129, author: gone.pubkey, relays })}`);

  const status = page.locator('#runtime-pointer-status');
  await expect(status).toContainText('No relay connection could be opened', { timeout: 10_000 });
  await expect(status).toContainText('0 of 2 relays connected');
  await expect(status).toContainText('WebSocket connection limit');
  await expect(status).not.toContainText('not found');
  const state = await pajaState(page);
  expect(state.logTypes).toContain('paja.relay.unreachable');
  expect(state.logTypes).not.toContain('paja.pointer.not-found');
});

test('a replaced addressable napplet is offered, not loaded, until the user picks it', async ({ page }) => {
  const down = `ws://127.0.0.1:${await closedPort()}`;
  const relay = ANSWERING[0]!;
  const gone = manifest('feed', 1_700_000_000, artifact('old'));
  const currentBytes = artifact('current');
  const current = manifest('feed', 1_700_000_600, currentBytes);
  let blossomRequests = 0;
  await page.route(`${BLOSSOM}/**`, (route) => {
    blossomRequests += 1;
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'text/html', body: currentBytes });
  });
  // The relay replaced `gone` with `current`: it no longer holds the old id.
  await fakeRelay(page, relay, [current]);
  await servePaja(page, [relay, down]);
  const pointer = neventEncode({ id: gone.id, kind: 35129, author: getPublicKey(AUTHOR), relays: [relay, down] });
  await page.goto(`${HOST}/?nevent=${pointer}`);

  await expect(page.locator('#runtime-pointer-status')).toContainText('not found (1 answered, 1 failed)', { timeout: 10_000 });
  const offer = page.locator('#runtime-pointer-offer');
  await expect(offer).toBeVisible();
  await expect(offer).toContainText('likely replaced');
  const button = offer.getByRole('button', { name: /Open Fixture feed \(d=feed,/ });
  await expect(button).toHaveCount(1);
  const naddr = naddrEncode({ kind: 35129, pubkey: getPublicKey(AUTHOR), identifier: 'feed', relays: [relay, down] });
  await expect(button).toHaveAttribute('data-naddr', naddr);

  // Nothing was fetched, verified, or framed on the user's behalf.
  const before = await pajaState(page);
  expect(blossomRequests).toBe(0);
  expect(before.tabs).toEqual([]);
  expect(before.iframes).toBe(0);
  expect(before.resolvedTarget).toBeNull();
  expect(before.logTypes).toContain('paja.pointer.replacement.offered');

  await button.click();
  await expect(page.frameLocator('#napplet-stage iframe').last().locator('#ready')).toHaveText('current', { timeout: 10_000 });
  await expect(offer).toBeHidden();
  const after = await pajaState(page);
  expect(blossomRequests).toBeGreaterThan(0);
  expect(after.tabs).toEqual([naddr]);
  expect(after.resolvedTarget?.aggregateHash).toBe(createHash('sha256').update(currentBytes).digest('hex'));
  expect(after.logTypes).toContain('paja.pointer.replacement.chosen');
});

test('several current napplets from the author are a picker with nothing chosen for the user', async ({ page }) => {
  const relay = ANSWERING[1]!;
  const gone = manifest('feed', 1_700_000_000, artifact('old'));
  const feedBytes = artifact('feed');
  const events = [manifest('feed', 1_700_000_300, feedBytes), manifest('profile', 1_700_000_900, artifact('profile'))];
  let blossomRequests = 0;
  await page.route(`${BLOSSOM}/**`, (route) => {
    blossomRequests += 1;
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'text/html', body: feedBytes });
  });
  await fakeRelay(page, relay, events);
  await servePaja(page, [relay]);
  await page.goto(`${HOST}/?nevent=${neventEncode({ id: gone.id, kind: 35129, author: getPublicKey(AUTHOR), relays: [relay] })}`);

  const offer = page.locator('#runtime-pointer-offer');
  await expect(offer).toContainText("pick one of the author's 2 current napplets", { timeout: 10_000 });
  const choice = page.locator('#runtime-pointer-offer-choice');
  await expect(choice).toHaveValue('');
  await expect(page.locator('#runtime-pointer-offer-open')).toBeDisabled();
  await expect(choice.locator('option:not([disabled])')).toHaveText([/^Fixture feed \(d=feed,/, /^Fixture profile \(d=profile,/]);
  expect(blossomRequests).toBe(0);
  expect((await pajaState(page)).tabs).toEqual([]);

  const naddr = naddrEncode({ kind: 35129, pubkey: getPublicKey(AUTHOR), identifier: 'feed', relays: [relay] });
  await choice.selectOption(naddr);
  await page.locator('#runtime-pointer-offer-open').click();
  await expect(page.frameLocator('#napplet-stage iframe').last().locator('#ready')).toHaveText('feed', { timeout: 10_000 });
  expect((await pajaState(page)).tabs).toEqual([naddr]);
});
