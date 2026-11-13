/**
 * Paja reports "no relay connection" distinctly during pointer resolution.
 *
 * Incident: browser WebSocket starvation (many tabs holding relay sockets)
 * made every wss:// connection fail at once, and Paja showed a generic pointer
 * timeout that read like a napplet bug. A real browser WebSocket to a closed
 * loopback port reproduces the "socket never opens" shape faithfully; the
 * control case proves a relay that connects but has no manifest is not
 * misreported as unreachable.
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { expect, test, type Page } from '@playwright/test';
import { naddrEncode } from 'nostr-tools/nip19';
import { createPajaRuntimeHostConfig, renderPajaHtml } from '../../packages/paja/dist/index.js';

const HOST = 'http://127.0.0.1:47691';
const PUBKEY = 'e771af0b05c8e95fcdf6feb3500544d2fb1ccd384788e9f490bb3ee28e8ed66f';

/** A loopback port that is guaranteed closed (bound then released) and not on Chromium's unsafe-port list. */
async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function servePaja(page: Page, relay: string): Promise<void> {
  const config = createPajaRuntimeHostConfig({ maxWaitMs: 2_000, simulation: { relay: { mode: 'live', urls: [relay] } } });
  const script = readFileSync(new URL('../../packages/paja/dist/browser-host.js', import.meta.url), 'utf8');
  await page.route(`${HOST}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      contentType: path.endsWith('.js') ? 'text/javascript' : path.endsWith('.json') ? 'application/json' : 'text/html',
      body: path.endsWith('.js') ? script : path.endsWith('.json') ? JSON.stringify(config) : renderPajaHtml(config),
    });
  });
}

function pointerFor(relay: string): string {
  return naddrEncode({ kind: 35129, pubkey: PUBKEY, identifier: 'unreachable-fixture', relays: [relay] });
}

async function pajaState(page: Page) {
  return page.evaluate(() => {
    const state = window.__KEHTO_PAJA__!.getState();
    return {
      status: state.status,
      pointerStatus: state.pointerStatus,
      tabs: state.tabs.length,
      logTypes: state.messageLog.map((entry) => entry.type),
      unreachable: state.messageLog.filter((entry) => entry.type === 'paja.relay.unreachable').map((entry) => JSON.parse(entry.preview) as Record<string, unknown>),
    };
  });
}

test('zero relay connections surface as an actionable status, not a generic timeout', async ({ page }) => {
  const relay = `ws://127.0.0.1:${await closedPort()}`;
  await servePaja(page, relay);
  await page.goto(`${HOST}/?naddr=${pointerFor(relay)}`);

  const status = page.locator('#runtime-pointer-status');
  await expect(status).toContainText('No relay connection could be opened', { timeout: 10_000 });
  await expect(status).toContainText('0 of 1 relays connected');
  await expect(status).toContainText('WebSocket connection limit');
  await expect(status).not.toContainText('timed out');

  const state = await pajaState(page);
  expect(state.status).toBe('error');
  expect(state.tabs).toBe(0);
  expect(state.logTypes).toContain('paja.relay.unreachable');
  expect(state.logTypes).toContain('paja.pointer.error');
  expect(state.unreachable).toHaveLength(1);
  expect(state.unreachable[0]).toMatchObject({ relays: 1, connected: 0, pending: [] });
  expect(state.unreachable[0]!.failed).toHaveLength(1);
  expect(String((state.unreachable[0]!.failed as string[])[0])).toContain(relay);
  expect(String(state.unreachable[0]!.hint)).toContain('WebSocket');
});

test('a relay that connects but holds no manifest is not reported as unreachable', async ({ page }) => {
  const relay = 'wss://reachable-but-empty.example';
  await servePaja(page, relay);
  await page.routeWebSocket(`${relay}/`, (socket) => socket.onMessage((message) => {
    const [action, subscription] = JSON.parse(String(message));
    if (action === 'REQ') socket.send(JSON.stringify(['EOSE', subscription]));
  }));
  await page.goto(`${HOST}/?naddr=${pointerFor(relay)}`);

  const status = page.locator('#runtime-pointer-status');
  await expect(status).toContainText('reached EOSE without a matching naddr', { timeout: 10_000 });
  const state = await pajaState(page);
  expect(state.logTypes).not.toContain('paja.relay.unreachable');
  expect(state.logTypes).toContain('paja.pointer.error');
});
