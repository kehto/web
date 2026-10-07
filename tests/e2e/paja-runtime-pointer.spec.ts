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

const classOnePrefix = "default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;";
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

    const outboxRead = page.locator('#acl-controls [data-acl-capability="outbox:read"]');
    await expect(outboxRead).toHaveAttribute('data-enabled', 'true');
    await outboxRead.click();
    await expect(outboxRead).toHaveAttribute('data-enabled', 'false');
    await expect(page.locator('#message-log [data-message-type="paja.acl.revoke"]')).toHaveCount(1);
    await outboxRead.click();
    await expect(outboxRead).toHaveAttribute('data-enabled', 'true');
    await expect(page.locator('#message-log [data-message-type="paja.acl.grant"]')).toHaveCount(1);
  } finally {
    await server.close();
  }
});

test('compiles verified WebAssembly while JavaScript string evaluation stays blocked', async ({ page }) => {
  test.setTimeout(30_000);
  const server = await startPointerServer();
  const relay = 'wss://intent-fixture.example';
  const fixture = createPointerFixture(server.url, 'wasm-target', wasmTargetHtml(), []);
  server.blobs.set(fixture.hash, fixture.bytes);
  server.setConfig({
    ...createPajaRuntimeHostConfig({ pointer: fixture.pointer, maxWaitMs: 2_000 }),
    simulation: normalizePajaSimulation({ relay: { mode: 'live', urls: [relay] } }),
  });
  await page.routeWebSocket(`${relay}/`, (socket) => {
    socket.onMessage((message) => {
      const request = JSON.parse(String(message)) as unknown[];
      if (request[0] !== 'REQ' || typeof request[1] !== 'string') return;
      socket.send(JSON.stringify(['EVENT', request[1], fixture.event]));
      socket.send(JSON.stringify(['EOSE', request[1]]));
    });
  });

  try {
    await page.goto(server.url);
    const frame = page.frameLocator('iframe');
    await expect(frame.locator('#wasm-status')).toHaveText('ready');
    await expect(frame.locator('#eval-status')).toHaveText('blocked');
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

test('opens local single-file index.html through the picker and drop without persisting it', async ({ page }) => {
  test.setTimeout(30_000);
  const server = await startPointerServer();
  const localHtml = (label: string) => `<!doctype html><html><head><meta name="napplet-id" content="${label}"><title>${label}</title></head><body><div id="status">booting</div><script>
    // The runtime-owned NAP-SHELL prelude emits shell.ready; the file only awaits shell.init.
    window.napplet.shell.ready().then((environment) => {
      document.getElementById('status').textContent = 'init:' + Array.isArray(environment.services);
    });
  </script></body></html>`;
  const pickedBytes = Buffer.from(localHtml('picked-local'));
  const pickedHash = createHash('sha256').update(pickedBytes).digest('hex');
  const pickedAggregate = computeAggregateHash([{ path: '/index.html', sha256: pickedHash }]);
  server.setConfig(createPajaRuntimeHostConfig({ maxWaitMs: 2_000 }));

  try {
    await page.goto(server.url);
    await expect(page.locator('#empty-runtime-stage')).toHaveText(
      'Load a napplet pointer or drop an index.html to start a runtime tab.',
    );
    await page.locator('#runtime-local-file').setInputFiles({
      name: 'picked.html',
      mimeType: 'text/html',
      buffer: pickedBytes,
    });

    const picked = page.locator('iframe').first();
    await expect(page.frameLocator('iframe').first().locator('#status')).toHaveText('init:true');
    await expect(page.locator('#napplet-tabs .tab-label')).toHaveText(['picked.html']);
    await expect(page.locator('#napplet-tabs .tab-share')).toHaveCount(0);
    const srcdoc = await picked.getAttribute('srcdoc');
    expect(srcdoc).toContain(classOnePrefix);
    expect(srcdoc).toContain(`connect-src 'none'; ${classOneSuffix}`);
    expect(srcdoc!.indexOf('Content-Security-Policy')).toBeLessThan(srcdoc!.indexOf('data-kehto-nip5d-injection'));
    await expect(picked).toHaveAttribute('sandbox', 'allow-scripts');
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');
    const state = await page.evaluate(() => window.__KEHTO_PAJA__?.getState());
    expect(state?.tabs[0]?.initSent).toBe(true);
    expect(state?.resolvedTarget).toMatchObject({
      source: 'local',
      fileName: 'picked.html',
      dTag: 'picked-local',
      aggregateHash: pickedAggregate,
    });
    expect(state?.tabs).toMatchObject([{ title: 'picked.html', pointerValue: '' }]);
    const logTypes = state?.messageLog.map((entry) => entry.type) ?? [];
    expect(logTypes).toEqual(expect.arrayContaining(['paja.local.load', 'paja.local.loaded', 'shell.ready', 'shell.init']));

    await page.evaluate((html) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([html], 'dropped.html', { type: 'text/html' }));
      document.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    }, localHtml('dropped-local'));
    await expect(page.locator('#napplet-tabs .tab-label')).toHaveText(['picked.html', 'dropped.html']);
    await expect(page.frameLocator('iframe').nth(1).locator('#status')).toHaveText('init:true');

    await page.reload();
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().tabs.length)).toBe(0);
    await expect(page.locator('#empty-runtime-stage')).toBeVisible();
  } finally {
    await server.close();
  }
});

for (const blockedStorage of [false, true]) {
  test(`sidebar accordion and resource servers preserve live verified bytes without frame reload (storage blocked: ${blockedStorage})`, async ({ page }) => {
    test.setTimeout(60_000);
    const server = await startPointerServer();
    const bytes = Buffer.from('verified browser resource bytes');
    const hash = createHash('sha256').update(bytes).digest('hex');
    const fixture = createPointerFixture(server.url, 'resource-settings-target', resourceSettingsHtml(hash), ['resource']);
    server.blobs.set(fixture.hash, fixture.bytes);
    server.setConfig({
      ...createPajaRuntimeHostConfig({ pointer: fixture.pointer, maxWaitMs: 2_000 }),
      simulation: normalizePajaSimulation({ relay: { mode: 'live', urls: ['wss://intent-fixture.example'] } }),
    });
    await page.routeWebSocket('wss://intent-fixture.example/', (socket) => {
      socket.onMessage((message) => {
        const request = JSON.parse(String(message)) as unknown[];
        if (request[0] !== 'REQ' || typeof request[1] !== 'string') return;
        const filter = request[2] as { kinds?: number[] };
        if (filter.kinds?.includes(NAPPLET_KIND_NAMED)) socket.send(JSON.stringify(['EVENT', request[1], fixture.event]));
        socket.send(JSON.stringify(['EOSE', request[1]]));
      });
    });
    const fetched: string[] = [];
    await page.route('https://*.example/**', async (route) => {
      fetched.push(route.request().url());
      await route.fulfill({ status: 200, body: bytes, headers: { 'access-control-allow-origin': '*', 'content-type': 'text/plain' } });
    });
    if (blockedStorage) {
      await page.addInitScript(() => {
        for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
          const original = Storage.prototype[method];
          Storage.prototype[method] = function (key: string, ...args: string[]) {
            if (key === 'kehto:paja:resource-servers') throw new DOMException('Blocked', 'SecurityError');
            return Reflect.apply(original, this, [key, ...args]);
          };
        }
      });
    }
    const input = page.getByLabel('Resource servers', { exact: true });
    const save = page.locator('#paja-resource-servers-save');
    const status = page.locator('#paja-resource-servers-status');
    const snapshot = () => page.evaluate(() => ({
      tabs: window.__KEHTO_PAJA__?.getState().tabs.map(({ id, windowId, generation }) => ({ id, windowId, generation })),
      srcdocs: Array.from(document.querySelectorAll('iframe'), (frame) => frame.srcdoc),
    }));
    try {
      await page.goto(server.url);
      await expect(page.frameLocator('iframe').locator('#ready')).toHaveText('ready');
      const original = await snapshot();
      await expect(page.locator('#paja-console > details')).toHaveCount(6);
      expect(await page.locator('#paja-console > details').evaluateAll((sections) => sections.map((section) => section.getAttribute('data-paja-section')))).toEqual(['pointer', 'interfaces', 'acl', 'signer', 'resource-servers', 'messages']);
      const frameNode = await page.locator('iframe').elementHandle();
      const frameWindow = await page.locator('iframe').evaluateHandle((frame) => (frame as HTMLIFrameElement).contentWindow);
      const pointer = page.locator('#runtime-pointer-section');
      await pointer.locator('summary').click();
      await page.locator('#paja-section-messages > summary').click();
      await expect(pointer).not.toHaveAttribute('open');
      await expect(page.locator('#paja-section-messages')).not.toHaveAttribute('open');
      expect(await snapshot()).toEqual(original);
      expect(await frameNode!.evaluate((node, originalWindow) => node === document.querySelector('iframe') && (node as HTMLIFrameElement).contentWindow === originalWindow, frameWindow)).toBe(true);
      await pointer.locator('summary').click();
      await expect(page.locator('#runtime-pointer-input')).toHaveValue(fixture.pointer);
      await page.locator('#runtime-local-open').click();
      await page.locator('#paja-section-messages > summary').click();
      await input.fill(' EXTRA.Example \nhttps://extra.example:443/');
      await save.focus();
      await save.press('Enter');
      await expect(input).toHaveValue('https://extra.example');
      await expect(status).toContainText(blockedStorage ? 'session-only' : 'saved for this host origin');
      expect(await snapshot()).toEqual(original);
      const frame = page.frameLocator('iframe');
      await frame.locator('#read').click();
      await expect(frame.locator('#result')).toHaveText('verified browser resource bytes');
      expect(fetched).toEqual([`https://extra.example/${hash}`]);
      await input.fill('valid.example\nhttp://private.example');
      await save.click();
      await expect(status).toContainText('Line 2:');
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await frame.locator('#read').click();
      await expect(frame.locator('#count')).toHaveText('2');
      expect(fetched.at(-1)).toBe(`https://extra.example/${hash}`);
      expect(await snapshot()).toEqual(original);
      if (!blockedStorage) {
        await page.reload();
        await expect(input).toHaveValue('https://extra.example');
        await expect(frame.locator('#ready')).toHaveText('ready');
      }
      const restored = await snapshot();
      await input.fill('replacement.example');
      await save.click();
      await expect(input).toHaveAttribute('aria-invalid', 'false');
      await frame.locator('#read').click();
      await expect(frame.locator('#result')).toHaveText('verified browser resource bytes');
      await expect.poll(() => fetched.at(-1)).toBe(`https://replacement.example/${hash}`);
      expect(await snapshot()).toEqual(restored);
      await input.fill('');
      await save.click();
      await expect(status).toContainText(blockedStorage ? 'session-only' : 'cleared from this host origin');
      const beforeClearRead = fetched.length;
      await frame.locator('#read').click();
      await expect(frame.locator('#result')).toHaveText('blocked-by-policy');
      expect(fetched).toHaveLength(beforeClearRead);
      expect(await snapshot()).toEqual(restored);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await input.scrollIntoViewIfNeeded();
        await expect(input).toBeVisible();
        expect(await input.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(200);
        expect(await page.locator('#paja-resource-servers-help').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
        await page.screenshot({ path: `/tmp/opencode/n18-sidebar-pointer-${blockedStorage}-${width}.png` });
      }
      await pointer.locator('summary').click();
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kehto:paja:sidebar-sections:v1') ?? '{}').pointer)).toBe(true);
      await page.reload();
      await expect(pointer).not.toHaveAttribute('open');
      await expect(input).toHaveValue('');
    } finally {
      await server.close();
    }
  });
}

function resourceSettingsHtml(hash: string): string {
  return `<!doctype html><html><body><div id="ready">booting</div><button id="read">Read</button><div id="result"></div><div id="count">0</div><script>
    let count = 0;
    window.napplet.shell.onReady(() => { document.getElementById('ready').textContent = 'ready'; });
    document.getElementById('read').onclick = () => {
      document.getElementById('result').textContent = 'pending';
      parent.postMessage({type:'resource.bytes',id:'read-' + (++count),url:'blossom:sha256:${hash}'}, '*');
    };
    window.addEventListener('message', async (event) => {
      if (event.source !== parent || !event.data.id?.startsWith('read-')) return;
      const message = event.data;
      document.getElementById('result').textContent = message.blob ? await message.blob.text() : message.error;
      document.getElementById('count').textContent = String(count);
    });
  </script></body></html>`;
}

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

function wasmTargetHtml(): string {
  return `<!doctype html><html><body><div id="wasm-status">pending</div><div id="eval-status">pending</div><script>
    WebAssembly.instantiate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))
      .then(() => { document.getElementById('wasm-status').textContent = 'ready'; })
      .catch((error) => { document.getElementById('wasm-status').textContent = error.name; });
    try {
      Function('return 1')();
      document.getElementById('eval-status').textContent = 'allowed';
    } catch {
      document.getElementById('eval-status').textContent = 'blocked';
    }
  </script></body></html>`;
}
