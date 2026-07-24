import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { computeAggregateHash } from '../../packages/nip/dist/5a/index.js';
import { NAPPLET_KIND_NAMED } from '../../packages/nip/dist/5d/index.js';
import { finalizeEvent } from 'nostr-tools/pure';
import { naddrEncode } from 'nostr-tools/nip19';
import {
  createPajaRuntimeHostConfig,
  normalizePajaSimulation,
  renderPajaHtml,
  type PajaHostConfig,
} from '../../packages/paja/dist/index.js';

const LIVE_NADDR = 'naddr1qqxxwmm0vskk6mmjde5kueczyqnxs90qeyssm73jf3kt5dtnk997ujw6ggy6j3t0jjzw2yrv6sy22qcyqqqgjwgpz4mhxue69uhhyetvv9ujuerfw36x7tnsw43qzd3wc3';
const LIVE_EVENT_ID = 'f39dfca7dbaeacbddf294977c5654c912fced30d8b839b32a1910a988ccc1f5a';
const LIVE_AGGREGATE = 'c922cf30dc1e12b135462057631ba3017cdaeea591725f077c5a20a6d9967b68';
const classOnePrefix = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;";
const classOneSuffix = "worker-src 'none'; child-src 'none'; frame-src 'none'; media-src 'none'; object-src 'none'; manifest-src 'none'; prefetch-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";

interface PointerServer {
  readonly url: string;
  readonly blobs: Map<string, Buffer>;
  setConfig(config: PajaHostConfig): void;
  close(): Promise<void>;
}

test('resolves a stale embedded hint through configured live relays in the running browser', async ({ page }) => {
  test.setTimeout(30_000);
  const server = await startPointerServer();
  const html = '<!doctype html><html><head><title>Configured Relay Target</title></head><body>verified fallback</body></html>';
  const bytes = Buffer.from(html);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const aggregateHash = computeAggregateHash([{ path: '/index.html', sha256: hash }]);
  const event = finalizeEvent({
    kind: NAPPLET_KIND_NAMED,
    created_at: 1_700_000_000,
    tags: [
      ['d', 'configured-relay-target'],
      ['path', '/index.html', hash],
      ['x', aggregateHash, 'aggregate'],
      ['server', `${server.url}blossom`],
    ],
    content: '',
  }, Uint8Array.from('22'.repeat(32).match(/.{2}/g)!.map((part) => parseInt(part, 16))));
  const pointer = naddrEncode({
    identifier: 'configured-relay-target',
    pubkey: event.pubkey,
    kind: NAPPLET_KIND_NAMED,
    relays: ['wss://stale-hint.example'],
  });
  const fallbackRelay = 'wss://configured-fallback.example';
  const baseConfig = createPajaRuntimeHostConfig({ pointer, maxWaitMs: 2_000 });
  server.blobs.set(hash, bytes);
  server.setConfig({
    ...baseConfig,
    simulation: normalizePajaSimulation({
      relay: { mode: 'live', urls: [fallbackRelay] },
    }),
  });

  for (const relay of ['wss://stale-hint.example/', `${fallbackRelay}/`]) {
    await page.routeWebSocket(relay, (socket) => {
      socket.onMessage((message) => {
        const request = JSON.parse(String(message)) as unknown[];
        if (request[0] !== 'REQ' || typeof request[1] !== 'string') return;
        const subscriptionId = request[1];
        if (relay === `${fallbackRelay}/`) {
          socket.send(JSON.stringify(['EVENT', subscriptionId, event]));
        }
        socket.send(JSON.stringify(['EOSE', subscriptionId]));
      });
    });
  }

  try {
    await page.goto(server.url);
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().resolvedTarget?.dTag))
      .toBe('configured-relay-target');
    const state = await page.evaluate(() => window.__KEHTO_PAJA__?.getState());
    expect(state?.resolvedTarget).toMatchObject({
      aggregateHash,
      relays: ['wss://stale-hint.example', fallbackRelay],
      indexHtml: expect.stringContaining('verified fallback'),
    });
    await expect(page.locator('iframe')).toHaveCount(1);
    await expect(page.locator('iframe')).toHaveAttribute('srcdoc', /Configured Relay Target/);
    const frame = page.locator('iframe');
    const srcdoc = await frame.getAttribute('srcdoc');
    expect(srcdoc).toContain(classOnePrefix);
    expect(srcdoc).toContain(`connect-src wss://configured-fallback.example wss://stale-hint.example; ${classOneSuffix}`);
    expect(srcdoc!.indexOf('Content-Security-Policy')).toBeLessThan(
      srcdoc!.indexOf('data-kehto-nip5d-injection'),
    );
    await expect(frame).toHaveAttribute('sandbox', /allow-scripts/);
    await expect(frame).not.toHaveAttribute('sandbox', /allow-same-origin/);
  } finally {
    await server.close();
  }
});

test('resolves the supplied Good Morning Protocol naddr through verified HTML', async ({ page }) => {
  test.skip(process.env.PAJA_LIVE_POINTER_TEST !== '1', 'requires live Nostr relays and Blossom availability');
  test.setTimeout(90_000);
  const server = await startPointerServer();
  server.setConfig(createPajaRuntimeHostConfig({ pointer: LIVE_NADDR, maxWaitMs: 15_000 }));

  try {
    await page.goto(server.url);
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().resolvedTarget?.dTag), {
      timeout: 45_000,
    }).toBe('good-morning');
    const state = await page.evaluate(() => window.__KEHTO_PAJA__?.getState());
    expect(state?.resolvedTarget).toMatchObject({
      event: { id: LIVE_EVENT_ID },
      aggregateHash: LIVE_AGGREGATE,
      manifest: { title: 'Good Morning Protocol' },
      indexHtml: expect.stringContaining('Good Morning Protocol'),
    });
    await expect(page.locator('iframe')).toHaveCount(1);
    await expect(page.locator('iframe')).toHaveAttribute('srcdoc', /Good Morning Protocol/);
  } finally {
    await server.close();
  }
});

async function startPointerServer(): Promise<PointerServer> {
  const browserHost = readFileSync(new URL('../../packages/paja/dist/browser-host.js', import.meta.url), 'utf8');
  const blobs = new Map<string, Buffer>();
  let config = createPajaRuntimeHostConfig();
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (path === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(renderPajaHtml(config));
      return;
    }
    if (path === '/__kehto/config.json') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(config));
      return;
    }
    if (path === '/__kehto/browser-host.js') {
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      response.end(browserHost);
      return;
    }
    const match = /^\/blossom\/([0-9a-f]{64})$/.exec(path);
    const blob = match ? blobs.get(match[1]!) : undefined;
    if (blob) {
      response.writeHead(200, {
        'access-control-allow-origin': '*',
        'content-type': 'text/html; charset=utf-8',
      });
      response.end(blob);
      return;
    }
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Pointer test server did not bind a TCP port.');

  return {
    url: `http://127.0.0.1:${address.port}/`,
    blobs,
    setConfig(nextConfig) {
      config = nextConfig;
    },
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}
