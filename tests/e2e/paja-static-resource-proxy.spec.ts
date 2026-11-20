import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

import { expect, test, type Page } from '@playwright/test';
import { finalizeEvent } from 'nostr-tools/pure';
import { naddrEncode } from 'nostr-tools/nip19';
import { NAPPLET_KIND_NAMED } from '../../packages/nip/dist/5d/index.js';
import { installPajaApprovalDriver } from './paja-approval-driver.js';
import {
  createPajaRuntimeHostConfig,
  normalizePajaSimulation,
  renderPajaHtml,
  type PajaHostConfig,
} from '../../packages/paja/dist/index.js';

// NAP-RESOURCE napplet/naps#80 @ ae5b9c6: DNS-time private-IP checks are mandatory,
// so the static build reads network resources only through a resource proxy.
const KEY = Uint8Array.from('77'.repeat(32).match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)));
const RELAY = 'wss://static-resource.example';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);

const NAPPLET = `<!doctype html><html><body><pre id="out"></pre><script>
  (async () => {
    const info = await window.napplet.resource.info();
    let bytes;
    try {
      const blob = await window.napplet.resource.bytes('https://image.example/a.png');
      bytes = { size: blob.size, mime: blob.type };
    } catch (error) {
      bytes = { error: String(error && (error.code || error.message || error)) };
    }
    document.getElementById('out').textContent = JSON.stringify({ schemes: info.schemes, bytes });
  })();
</script></body></html>`;

interface StaticServer {
  readonly url: string;
  setConfig(next: PajaHostConfig): void;
  close(): Promise<void>;
}

async function startStaticServer(blob: Buffer, hash: string): Promise<StaticServer> {
  const browserHost = readFileSync(new URL('../../packages/paja/dist/browser-host.js', import.meta.url), 'utf8');
  let config: PajaHostConfig = createPajaRuntimeHostConfig();
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (path === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(renderPajaHtml(config));
    } else if (path === '/__kehto/config.json') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(config));
    } else if (path === '/__kehto/browser-host.js') {
      response.writeHead(200, { 'content-type': 'text/javascript' });
      response.end(browserHost);
    } else if (path === `/blossom/${hash}`) {
      response.writeHead(200, { 'access-control-allow-origin': '*', 'content-type': 'text/html' });
      response.end(blob);
    } else {
      // Like GitHub Pages, the static host has no /__kehto/resource proxy.
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('static server did not bind');
  return {
    url: `http://127.0.0.1:${address.port}/`,
    setConfig(next) { config = next; },
    close: () => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }),
  };
}

async function loadStatic(page: Page, proxyUrl: string | undefined) {
  const bytes = Buffer.from(NAPPLET);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const server = await startStaticServer(bytes, hash);
  const target = finalizeEvent({
    kind: NAPPLET_KIND_NAMED, created_at: 1_760_000_000, content: 'static resource',
    tags: [['d', 'static-resource'], ['x', hash], ['server', `${server.url}blossom`], ['R', 'resource'], ['title', 'static-resource']],
  }, KEY);
  const pointer = naddrEncode({ identifier: 'static-resource', pubkey: target.pubkey, kind: NAPPLET_KIND_NAMED, relays: [RELAY] });
  await installPajaApprovalDriver(page);
  server.setConfig({
    ...createPajaRuntimeHostConfig({ maxWaitMs: 5_000, pointer, ...(proxyUrl ? { resourceProxyUrl: proxyUrl } : {}) }),
    simulation: normalizePajaSimulation({ relay: { mode: 'live', urls: [RELAY] } }),
  });
  await page.routeWebSocket(`${RELAY}/`, (socket) => socket.onMessage((message) => {
    const request = JSON.parse(String(message)) as unknown[];
    if (request[0] !== 'REQ') return;
    socket.send(JSON.stringify(['EVENT', request[1], target]));
    socket.send(JSON.stringify(['EOSE', request[1]]));
  }));
  await page.goto(server.url);
  const out = page.frameLocator('iframe.tab-panel').locator('#out');
  await expect(out).toContainText('schemes', { timeout: 30_000 });
  const result = JSON.parse((await out.textContent()) ?? '{}') as {
    schemes: { scheme: string; enabled: boolean }[];
    bytes: Record<string, unknown>;
  };
  return { result, server };
}

test('static Paja without a proxy disables network resources and never fetches them', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  const { result, server } = await loadStatic(page, undefined);
  try {
    expect(result.schemes).toEqual(expect.arrayContaining([
      { scheme: 'https', enabled: false },
      { scheme: 'blossom', enabled: false },
    ]));
    expect(result.bytes).toEqual({ error: 'unsupported-scheme' });
    expect(requested.filter((url) => url.includes('image.example') || url.includes('/__kehto/resource'))).toEqual([]);
  } finally {
    await server.close();
  }
});

test('static Paja reads images through a configured CORS proxy, one hop at a time', async ({ page }) => {
  const seen: string[] = [];
  const proxy = createServer((request, response) => {
    const cors = {
      'access-control-allow-origin': String(request.headers.origin ?? ''),
      vary: 'Origin',
      'access-control-expose-headers': 'x-kehto-resource-redirect, x-kehto-resource-upstream',
    };
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { ...cors, 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type' });
      response.end();
      return;
    }
    let body = '';
    request.on('data', (chunk) => { body += String(chunk); });
    request.on('end', () => {
      const { url } = JSON.parse(body) as { url: string };
      seen.push(`${request.headers.cookie ? 'cookie' : 'no-cookie'} ${url}`);
      if (url === 'https://image.example/a.png') {
        response.writeHead(200, { ...cors, 'content-type': 'application/json', 'x-kehto-resource-redirect': '1' });
        response.end(JSON.stringify({ status: 302, location: 'https://cdn.example/b.png' }));
        return;
      }
      // Upstream content-type is ignored; Paja sniffs the bytes itself.
      response.writeHead(200, { ...cors, 'content-type': 'text/html', 'x-kehto-resource-upstream': '1' });
      response.end(PNG);
    });
  });
  await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  const address = proxy.address();
  if (!address || typeof address === 'string') throw new Error('proxy did not bind');
  const { result, server } = await loadStatic(page, `http://127.0.0.1:${address.port}/`);
  try {
    expect(result.schemes).toEqual(expect.arrayContaining([
      { scheme: 'https', enabled: true },
      { scheme: 'blossom', enabled: true },
    ]));
    expect(result.bytes).toEqual({ size: PNG.byteLength, mime: 'image/png' });
    expect(seen).toEqual(['no-cookie https://image.example/a.png', 'no-cookie https://cdn.example/b.png']);
  } finally {
    await server.close();
    await new Promise<void>((resolve) => { proxy.closeAllConnections(); proxy.close(() => resolve()); });
  }
});
