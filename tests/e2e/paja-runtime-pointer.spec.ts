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

test('completes a verified intent and delivers its convention once to a cold target', async ({ page }) => {
  test.setTimeout(60_000);
  const server = await startPointerServer();
  const source = createPointerFixture(server.url, 'intent-source', sourceIntentHtml(), ['intent']);
  const target = createPointerFixture(server.url, 'profile-target', targetIntentHtml(), ['inc', 'theme'], [
    ['archetype', 'profile', 'napplet:profile/open'],
  ]);
  const relay = 'wss://intent-fixture.example';
  server.blobs.set(source.hash, source.bytes);
  server.blobs.set(target.hash, target.bytes);
  server.setConfig({
    ...createPajaRuntimeHostConfig({ pointer: source.pointer, maxWaitMs: 2_000 }),
    simulation: normalizePajaSimulation({ relay: { mode: 'live', urls: [relay] } }),
  });
  await page.routeWebSocket(`${relay}/`, (socket) => {
    socket.onMessage((message) => {
      const request = JSON.parse(String(message)) as unknown[];
      if (request[0] !== 'REQ' || typeof request[1] !== 'string') return;
      const subscriptionId = request[1];
      socket.send(JSON.stringify(['EVENT', subscriptionId, source.event]));
      socket.send(JSON.stringify(['EVENT', subscriptionId, target.event]));
      socket.send(JSON.stringify(['EOSE', subscriptionId]));
    });
  });

  try {
    await page.goto(server.url);
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().tabs.length)).toBe(1);
    await page.evaluate((pointer) => window.__KEHTO_PAJA__?.loadPointer(pointer), target.pointer);
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().tabs
      .find((tab) => tab.title === 'profile-target')?.status)).toBe('ready');

    await page.evaluate(() => {
      const state = window.__KEHTO_PAJA__;
      const targetTab = state?.getState().tabs.find((tab) => tab.title === 'profile-target');
      if (targetTab) state?.closeTab(targetTab.id);
    });
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().tabs.length)).toBe(1);

    await page.evaluate(() => {
      const state = window.__KEHTO_PAJA__;
      const sourceTab = state?.getState().tabs.find((tab) => tab.title === 'intent-source');
      const frame = sourceTab ? document.getElementById(`napplet-frame-${sourceTab.id}`) : null;
      if (!(frame instanceof HTMLIFrameElement)) throw new Error('Missing verified source frame');
      frame.contentWindow?.postMessage({ type: 'test.invoke' }, '*');
    });
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().messageLog
      .filter((entry) => entry.type === 'test.source.accepted').length ?? 0)).toBe(1);

    await page.evaluate(() => {
      const state = window.__KEHTO_PAJA__;
      const sourceTab = state?.getState().tabs.find((tab) => tab.title === 'intent-source');
      if (sourceTab) state?.closeTab(sourceTab.id);
    });
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().tabs
      .filter((tab) => tab.title === 'profile-target').length)).toBe(1);
    const targetTabId = await page.evaluate(() => window.__KEHTO_PAJA__?.getState().tabs
      .find((tab) => tab.title === 'profile-target')?.id ?? null);
    expect(targetTabId).toBeTruthy();
    const targetFrame = page.frameLocator(`#napplet-frame-${targetTabId}`);
    await expect(targetFrame.locator('#delivery-count')).toHaveText('1', { timeout: 15_000 });
    await expect(targetFrame.locator('#delivery-pubkey')).toHaveText('f'.repeat(64));
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().messageLog
      .filter((entry) => entry.type === 'inc.event').length ?? 0)).toBe(1);

    await page.evaluate(() => {
      const forged = document.createElement('iframe');
      forged.id = 'forged-ready';
      forged.sandbox.add('allow-scripts');
      forged.srcdoc = '<div id="messages">0</div><script>let count=0;window.addEventListener("message",()=>document.getElementById("messages").textContent=String(++count));parent.postMessage({type:"shell.ready"},"*");</script>';
      document.body.append(forged);
    });
    await expect(page.frameLocator('#forged-ready').locator('#messages')).toHaveText('0');
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
      server.closeIdleConnections();
      server.closeAllConnections();
    }),
  };
}

function createPointerFixture(
  serverUrl: string,
  dTag: string,
  html: string,
  requires: readonly string[],
  extraTags: readonly string[][] = [],
) {
  const bytes = Buffer.from(html);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const aggregateHash = computeAggregateHash([{ path: '/index.html', sha256: hash }]);
  const event = finalizeEvent({
    kind: NAPPLET_KIND_NAMED,
    created_at: 1_700_000_001,
    tags: [
      ['d', dTag],
      ['title', dTag],
      ['path', '/index.html', hash],
      ['x', aggregateHash, 'aggregate'],
      ['server', `${serverUrl}blossom`],
      ...requires.map((name) => ['requires', name]),
      ...extraTags,
    ],
    content: '',
  }, Uint8Array.from('33'.repeat(32).match(/.{2}/g)!.map((part) => parseInt(part, 16))));
  return {
    bytes,
    hash,
    event,
    pointer: naddrEncode({
      identifier: dTag,
      pubkey: event.pubkey,
      kind: NAPPLET_KIND_NAMED,
      relays: ['wss://intent-fixture.example'],
    }),
  };
}

function sourceIntentHtml(): string {
  return `<!doctype html><html><body><div id="source-status">booting</div><script>
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'shell.init') document.getElementById('source-status').textContent = 'ready';
      if (event.data && event.data.type === 'test.invoke') {
        window.parent.postMessage({ type: 'intent.invoke', id: 'source-intent', request: {
          archetype: 'profile', action: 'open', convention: 'napplet:profile/open', payload: { pubkey: '${'f'.repeat(64)}' },
        } }, '*');
      }
      if (event.data && event.data.type === 'intent.invoke.result' && event.data.result && event.data.result.ok) {
        window.parent.postMessage({ type: 'test.source.accepted' }, '*');
      }
    });
    window.parent.postMessage({ type: 'shell.ready' }, '*');
  </script></body></html>`;
}

function targetIntentHtml(): string {
  return `<!doctype html><html><body><div id="delivery-count">0</div><div id="delivery-pubkey"></div><script>
    let count = 0;
    window.napplet.inc.on('napplet:profile/open', (event) => {
      count += 1;
      document.getElementById('delivery-count').textContent = String(count);
      document.getElementById('delivery-pubkey').textContent = event.payload && event.payload.pubkey || '';
    });
    window.parent.postMessage({ type: 'shell.ready' }, '*');
  </script></body></html>`;
}
