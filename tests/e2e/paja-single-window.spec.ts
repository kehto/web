import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { expect, test, type FrameLocator } from '@playwright/test';
import { verifyEvent } from 'nostr-tools/pure';
import { startPajaServer, type PajaServer } from '../../packages/paja/dist/index.js';

interface TargetServer {
  readonly url: string;
  close(): Promise<void>;
}

interface BlossomPut {
  readonly bytes: Buffer;
  readonly authorization: string;
  readonly contentType: string;
}

interface BlossomTestServer extends TargetServer {
  readonly puts: BlossomPut[];
  readonly requestMethods: string[];
  omitSizeOnce(): void;
}

let targetServer: TargetServer;
let runtimeServer: PajaServer;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  targetServer = await startTargetServer();
  runtimeServer = await startPajaServer({
    options: {
      targetUrl: targetServer.url,
      port: 0,
    },
    now: new Date('2026-06-21T00:00:00.000Z'),
  });
});

test.afterAll(async () => {
  await runtimeServer.close();
  await targetServer.close();
});

test('hosts one sandboxed target iframe and reinitializes it on reload', async ({ page }) => {
  test.setTimeout(60_000);
  const dialogMessages: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogMessages.push(dialog.message());
    await dialog.accept();
  });
  await page.goto(runtimeServer.url);

  await expect(page.locator('header.top')).toBeVisible();
  await expect(page.locator('.brand')).toHaveText('@kehto/paja');
  await expect.poll(async () => page.locator('.brand').evaluate((brand) => {
    const product = brand.querySelector('.brand-product');
    if (!(product instanceof HTMLElement)) return false;
    return getComputedStyle(brand).color !== getComputedStyle(product).color;
  })).toBe(true);
  await expect(page.locator('footer.bottom')).toBeVisible();
  await expect(page.locator('.console')).toBeVisible();
  await expect(page.locator('#interface-toggles [data-interface-domain="identity"]')).toHaveAttribute('data-enabled', 'true');
  await expect(page.locator('#acl-controls [data-acl-capability="state:write"]')).toHaveAttribute('data-enabled', 'true');
  await expect(page.locator('#signer-status')).toContainText('every sign/publish request prompts');
  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(page.locator('#napplet-frame')).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(page.locator('#napplet-frame')).not.toHaveAttribute('sandbox', /allow-same-origin/);

  const targetFrame = page.frameLocator('#napplet-frame');
  await expect(targetFrame.locator('#target-status')).toHaveText('shell-init received', { timeout: 15_000 });
  await expect(targetFrame.locator('#injected-domains')).toHaveText('identity,outbox,resource,keys');
  await expect(targetFrame.locator('#shell-init-type')).toHaveText('shell.init');
  await expect(targetFrame.locator('#shell-init-domains')).toContainText('relay,outbox,identity,storage,inc');
  await expect(targetFrame.locator('#shell-init-domains')).toContainText('upload,intent');
  await expect(targetFrame.locator('#service-results')).toContainText('storage.set.result');
  await expect(targetFrame.locator('#service-results')).toContainText('config.values');
  await expect(targetFrame.locator('#service-results')).toContainText('theme.get.result');
  await expect(targetFrame.locator('#service-results')).toContainText('notify.send.result');
  await expect(targetFrame.locator('#service-results')).toContainText('identity.getPublicKey.result');
  await expect(targetFrame.locator('#service-results')).toContainText('upload.upload.result');
  await expect(targetFrame.locator('#service-results')).toContainText('intent.available.result');
  await expect(targetFrame.locator('#service-results')).toContainText('cvm.discover.result');
  await expect(targetFrame.locator('#service-results')).toContainText('outbox.publish.result');
  await expect(targetFrame.locator('#identity-pubkey')).toHaveText('');
  expect(dialogMessages.filter((message) => message.includes('Paja sign request'))).toHaveLength(0);
  expect(dialogMessages.filter((message) => message.includes('Paja publish request'))).toHaveLength(0);
  await expect(page.locator('#message-log .log-row')).not.toHaveCount(0);
  await page.locator('#message-filter').fill('identity.getPublicKey');
  await expect(page.locator('#message-log .log-row')).not.toHaveCount(0);
  await expect(page.locator('#message-log .log-row').first()).toContainText('identity.getPublicKey');
  await page.locator('#message-filter').fill('');
  await expect(page.locator('#lifecycle-status')).toHaveText('ready');
  await expect(page.locator('#simulation-status')).toContainText('identity:anon relay:live:4 storage:local upload:memory:simulator theme:dark off:none');

  const firstLoadId = await targetFrame.locator('#load-id').textContent();
  expect(firstLoadId).toBeTruthy();

  const firstGeneration = await page.evaluate(() => window.__KEHTO_PAJA__?.getState().generation ?? -1);
  await page.locator('#reload-target').click();

  await expect(page.locator('iframe')).toHaveCount(1);
  await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().generation)).toBe(firstGeneration + 1);
  await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');
  await expect.poll(() => page.frames().some((frame) => frame.url() === 'about:srcdoc'), { timeout: 15_000 }).toBe(true);
  await expect(page.locator('#napplet-frame')).toHaveAttribute('data-target-url', targetServer.url);
  const reloadedFrame = page.frameLocator('#napplet-frame');
  await expect(reloadedFrame.locator('#target-status')).toHaveText('shell-init received', { timeout: 15_000 });
  const secondLoadId = await reloadedFrame.locator('#load-id').textContent();
  expect(secondLoadId).toBeTruthy();
  expect(secondLoadId).not.toBe(firstLoadId);

  const state = await page.evaluate(() => window.__KEHTO_PAJA__?.getState());
  expect(state).toMatchObject({
    generation: 1,
    status: 'ready',
    iframeCount: 1,
    initSent: true,
  });
  expect(state?.services).toEqual(expect.arrayContaining([
    'config',
    'common',
    'cvm',
    'identity',
    'intent',
    'keys',
    'media',
    'notify',
    'outbox',
    'relay',
    'resource',
    'theme',
    'upload',
  ]));

  await page.locator('#acl-controls [data-acl-capability="state:write"]').click();
  await expect(page.locator('#acl-controls [data-acl-capability="state:write"]')).toHaveAttribute('data-enabled', 'false');
  await page.locator('#reload-target').click();
  await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');
  await expect(page.frameLocator('#napplet-frame').locator('#storage-error')).toContainText('denied', { timeout: 15_000 });

  await page.locator('#interface-toggles [data-interface-domain="media"]').click();
  await expect(page.locator('#interface-toggles [data-interface-domain="media"]')).toHaveAttribute('data-enabled', 'false');
  await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');
  await expect(page.frameLocator('#napplet-frame').locator('#shell-init-domains')).not.toContainText('media', { timeout: 15_000 });
});

test('applies simulation config and compact theme adjustment', async ({ page }) => {
  test.setTimeout(60_000);
  const pubkey = '4'.repeat(64);
  const customTargetUrl = `${targetServer.url}?required=identity,resource,keys`;
  const customRuntime = await startPajaServer({
    options: {
      targetUrl: customTargetUrl,
      port: 0,
      simulation: {
        identity: { mode: 'fixed', pubkey },
        relay: { mode: 'disabled' },
        capabilities: { domains: { relay: false, outbox: false } },
        theme: { mode: 'light' },
        config: { values: { density: 'compact' } },
      },
    },
    now: new Date('2026-06-21T00:00:00.000Z'),
  });

  try {
    await page.goto(customRuntime.url);
    await expect(page.locator('#simulation-status')).toContainText('identity:fixed relay:off');
    await expect(page.locator('#simulation-status')).toContainText('theme:light');

    const targetFrame = page.frameLocator('#napplet-frame');
    await expect(targetFrame.locator('#target-status')).toHaveText('shell-init received');
    await expect(targetFrame.locator('#shell-init-domains')).not.toContainText('relay');
    await expect(targetFrame.locator('#shell-init-domains')).not.toContainText('outbox');
    await expect(targetFrame.locator('#identity-pubkey')).toHaveText(pubkey);
    await expect(targetFrame.locator('#config-density')).toHaveText('compact');
    await expect(targetFrame.locator('#theme-background')).toHaveText('#f7f5ed');

    await page.locator('#simulation-theme').selectOption('dark');
    await expect(page.locator('#simulation-status')).toContainText('theme:dark');
    const firstGeneration = await page.evaluate(() => window.__KEHTO_PAJA__?.getState().generation ?? -1);
    await page.locator('#reload-target').click();
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().generation)).toBe(firstGeneration + 1);
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');
    await expect.poll(() => page.frames().some((frame) => frame.url() === 'about:srcdoc'), { timeout: 15_000 }).toBe(true);
    await expect(page.locator('#napplet-frame')).toHaveAttribute('data-target-url', customTargetUrl);
    const reloadedFrame = page.frameLocator('#napplet-frame');
    await expect(reloadedFrame.locator('#target-status')).toHaveText('shell-init received', { timeout: 15_000 });
    await expect(reloadedFrame.locator('#theme-background')).toHaveText('#101211', { timeout: 15_000 });
  } finally {
    await customRuntime.close();
  }
});

test('shows error details and routes signing through NIP-07', async ({ page }) => {
  test.setTimeout(60_000);
  const pubkey = '7'.repeat(64);
  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.addInitScript((signerPubkey) => {
    const signedEvents: unknown[] = [];
    const host = window as unknown as {
      nostr?: unknown;
      __pajaTestSignerEvents?: unknown[];
    };
    host.__pajaTestSignerEvents = signedEvents;
    host.nostr = {
      getPublicKey: async () => signerPubkey,
      getRelays: async () => ({ 'wss://relay.test': { read: true, write: true } }),
      signEvent: async (event: Record<string, unknown>) => {
        signedEvents.push(event);
        return {
          ...event,
          id: '8'.repeat(64),
          pubkey: signerPubkey,
          sig: '9'.repeat(128),
          kind: typeof event.kind === 'number' ? event.kind : 1,
          tags: Array.isArray(event.tags) ? event.tags : [],
          content: typeof event.content === 'string' ? event.content : '',
          created_at: typeof event.created_at === 'number' ? event.created_at : Math.floor(Date.now() / 1000),
        };
      },
    };
  }, pubkey);

  await page.goto(runtimeServer.url);
  await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');

  await page.locator('#signer-nip07').click();
  await expect(page.locator('#signer-status')).toContainText('NIP-07 connected');
  await expect(page.locator('#signer-status')).toContainText(pubkey);
  await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().signer.method)).toBe('nip07');
  await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');

  const targetFrame = page.frameLocator('#napplet-frame');
  await expect(targetFrame.locator('#identity-pubkey')).toHaveText(pubkey, { timeout: 15_000 });
  await expect.poll(async () => page.evaluate(() => {
    const host = window as unknown as { __pajaTestSignerEvents?: unknown[] };
    return host.__pajaTestSignerEvents?.length ?? 0;
  })).toBeGreaterThan(0);

  await targetFrame.locator('body').evaluate(() => {
    window.parent.postMessage({
      type: 'identity.getPublicKey.error',
      id: 'manual-error',
      error: 'visible boom',
    }, '*');
  });
  await page.locator('#message-filter').fill('visible boom');
  await expect(page.locator('#message-log')).toContainText('identity.getPublicKey.error');
  await expect(page.locator('#message-log .log-row[data-error="true"]')).toContainText('visible boom');
});

test('stores disclosed bytes through a signed Blossom upload and fails closed on denial or incomplete proof', async ({ page }) => {
  test.setTimeout(60_000);
  const blossom = await startBlossomServer();
  const uploadTargetUrl = `${targetServer.url}?required=upload&manualTraffic=1`;
  const uploadRuntime = await startPajaServer({
    options: {
      targetUrl: uploadTargetUrl,
      port: 0,
      simulation: {
        relay: { mode: 'disabled' },
        capabilities: { domains: { relay: false, outbox: false } },
        upload: {
          mode: 'blossom',
          servers: [blossom.url],
          maxBytes: 1024,
          mimeTypes: ['application/octet-stream'],
        },
      },
    },
    now: new Date('2026-06-21T00:00:00.000Z'),
  });
  const dialogs: string[] = [];
  let denyNextUpload = false;
  let putsBeforeConsent = 0;
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    if (dialog.message().includes('Paja upload request')) {
      expect(blossom.puts).toHaveLength(putsBeforeConsent);
      expect(dialog.message()).toContain('dev-target');
      expect(dialog.message()).toContain('application/octet-stream');
      expect(dialog.message()).toContain(blossom.url);
      expect(dialog.message()).toContain('public and durable');
      if (denyNextUpload) {
        denyNextUpload = false;
        await dialog.dismiss();
        return;
      }
    }
    await dialog.accept();
  });

  try {
    await page.goto(uploadRuntime.url);
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');
    await page.locator('#signer-dev').click();
    await expect(page.locator('#signer-status')).toContainText('dev connected');
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');

    const frame = page.frameLocator('#napplet-frame');
    await expect(frame.locator('#target-status')).toHaveText('shell-init received', { timeout: 15_000 });
    await sendFixtureMessage(frame, { type: 'upload.info', id: 'info-1' });
    await expect.poll(() => readFixtureMessage(frame, 'upload.info.result', 'info-1')).toMatchObject({
      info: {
        rails: [{ rail: 'blossom', enabled: true, returns: ['http'] }],
        maxBytes: 1024,
        mimeTypes: ['application/octet-stream'],
      },
    });
    expect(blossom.requestMethods).toEqual([]);

    const bytes = [0, 1, 2, 3, 254, 255];
    const expectedSha = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
    await sendUploadMessage(frame, 'real-upload', bytes);
    await expect.poll(() => readFixtureMessage(frame, 'upload.upload.result', 'real-upload')).toMatchObject({
      result: {
        ok: true,
        status: 'complete',
        rail: 'blossom',
        url: `${blossom.url}/${expectedSha}`,
        sha256: expectedSha,
        size: bytes.length,
        mimeType: 'application/octet-stream',
        nip94: [
          ['url', `${blossom.url}/${expectedSha}`],
          ['m', 'application/octet-stream'],
          ['x', expectedSha],
          ['size', String(bytes.length)],
        ],
      },
    });
    expect(blossom.puts).toHaveLength(1);
    expect([...blossom.puts[0]!.bytes]).toEqual(bytes);
    expect(blossom.puts[0]!.contentType).toBe('application/octet-stream');
    const authEvent = decodeNostrAuthorization(blossom.puts[0]!.authorization);
    expect(verifyEvent(authEvent as Parameters<typeof verifyEvent>[0])).toBe(true);
    expect(authEvent.kind).toBe(24_242);
    expect(authEvent.tags).toContainEqual(['t', 'upload']);
    expect(authEvent.tags).toContainEqual(['x', expectedSha]);
    expect(Number(authEvent.tags.find((tag) => tag[0] === 'expiration')?.[1])).toBeGreaterThan(authEvent.created_at);

    putsBeforeConsent = 1;
    denyNextUpload = true;
    await sendUploadMessage(frame, 'denied-upload', [9, 9]);
    await expect.poll(() => readFixtureMessage(frame, 'upload.upload.result', 'denied-upload')).toMatchObject({
      result: { ok: false, status: 'cancelled', error: 'user cancelled' },
    });
    expect(blossom.puts).toHaveLength(1);

    blossom.omitSizeOnce();
    await sendUploadMessage(frame, 'missing-size', [7, 8, 9]);
    await expect.poll(() => readFixtureMessage(frame, 'upload.upload.result', 'missing-size')).toMatchObject({
      result: { ok: false, status: 'failed', error: 'server returned invalid size' },
    });
    expect(blossom.puts).toHaveLength(2);
    expect(dialogs.filter((message) => message.includes('Paja upload request'))).toHaveLength(3);
    expect(dialogs.filter((message) => message.includes('Paja sign request'))).toHaveLength(2);
  } finally {
    await uploadRuntime.close();
    await blossom.close();
  }
});

test('boots modern injected-domain targets through mandatory NAP-SHELL', async ({ page }) => {
  test.setTimeout(60_000);
  const modernRuntime = await startPajaServer({
    options: {
      targetUrl: `${targetServer.url}?shellReady=0&required=identity,keys`,
      port: 0,
    },
    now: new Date('2026-06-21T00:00:00.000Z'),
  });

  try {
    await page.goto(modernRuntime.url);

    const targetFrame = page.frameLocator('#napplet-frame');
    await expect(targetFrame.locator('#injected-domains')).toHaveText('identity,keys');
    await expect.poll(async () => targetFrame.locator('body').evaluate(() => {
      const shell = (window as Window & {
        napplet?: { shell?: Record<string, unknown> };
      }).napplet?.shell;
      return typeof shell?.ready === 'function'
        && typeof shell.supports === 'function'
        && typeof shell.onReady === 'function'
        && Array.isArray(shell.services);
    })).toBe(true);
    await expect(targetFrame.locator('#target-status')).toHaveText('napplet namespace ready', { timeout: 15_000 });
    await expect(targetFrame.locator('#identity-pubkey')).toHaveText('');
    await expect.poll(async () => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');

    const state = await page.evaluate(() => window.__KEHTO_PAJA__?.getState());
    expect(state).toMatchObject({
      status: 'ready',
      initSent: true,
    });
  } finally {
    await modernRuntime.close();
  }
});

async function startTargetServer(): Promise<TargetServer> {
  let loadCount = 0;
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (requestUrl.pathname !== '/') {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    loadCount += 1;
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
    });
    response.end(renderTargetHtml(loadCount, {
      requiredDomains: readRequiredDomains(requestUrl),
      shellReady: requestUrl.searchParams.get('shellReady') !== '0',
      manualTraffic: requestUrl.searchParams.get('manualTraffic') === '1',
    }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (typeof address !== 'object' || address === null) {
    throw new Error('Target server did not bind to a TCP port.');
  }

  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    }),
  };
}

function readRequiredDomains(url: URL): string[] {
  const raw = url.searchParams.get('required');
  if (!raw) return ['identity', 'outbox', 'resource', 'keys'];
  return raw.split(',').map((domain) => domain.trim()).filter(Boolean);
}

function renderTargetHtml(
  loadCount: number,
  options: { requiredDomains: readonly string[]; shellReady: boolean; manualTraffic: boolean },
): string {
  const requiredDomainsJson = JSON.stringify(options.requiredDomains);
  const shellReadyJson = JSON.stringify(options.shellReady);
  const manualTrafficJson = JSON.stringify(options.manualTraffic);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Kehto Paja fixture</title>
  </head>
  <body>
    <div id="target-status">booting</div>
    <div id="injected-domains"></div>
    <div id="load-id">${loadCount}</div>
    <div id="shell-init-type"></div>
    <div id="shell-init-domains"></div>
    <div id="service-results"></div>
    <div id="identity-pubkey"></div>
    <div id="config-density"></div>
    <div id="theme-background"></div>
    <div id="storage-error"></div>
    <script>
      const seenTypes = new Set();
      const pajaTestMessages = [];
      window.__pajaTestMessages = pajaTestMessages;
      window.__sendPajaMessage = (message) => window.parent.postMessage(message, '*');
      const serviceResults = document.getElementById('service-results');
      const requiredDomains = ${requiredDomainsJson};
      const injectedDomains = requiredDomains.filter((domain) =>
        window.napplet && typeof window.napplet[domain] === 'object'
      );
      document.getElementById('injected-domains').textContent = injectedDomains.join(',');
      if (injectedDomains.length !== requiredDomains.length) {
        document.getElementById('target-status').textContent = 'Required shell domains unavailable';
        throw new Error('Required shell domains unavailable');
      }
      const sendShellReady = ${shellReadyJson};
      function renderResult(message) {
        pajaTestMessages.push(message);
        const type = message.type;
        seenTypes.add(type);
        serviceResults.textContent = Array.from(seenTypes).sort().join(',');
        if (type === 'identity.getPublicKey.result') {
          document.getElementById('identity-pubkey').textContent = message.pubkey || '';
        }
        if (type === 'config.values') {
          document.getElementById('config-density').textContent = message.values && message.values.density || '';
        }
        if (type === 'theme.get.result') {
          document.getElementById('theme-background').textContent = message.theme && message.theme.colors && message.theme.colors.background || '';
        }
        if (type === 'storage.set.result') {
          document.getElementById('storage-error').textContent = message.error || '';
        }
      }
      function sendServiceTraffic() {
        const bytes = new TextEncoder().encode('kehto-paja').buffer;
        const messages = [
          { type: 'storage.set', id: 'storage-1', key: 'phase', value: '92' },
          { type: 'config.get', id: 'config-1' },
          { type: 'theme.get', id: 'theme-1' },
          { type: 'notify.send', id: 'notify-1', title: 'hello from fixture' },
          { type: 'identity.getPublicKey', id: 'identity-1' },
          { type: 'upload.upload', id: 'upload-1', request: { data: bytes, mimeType: 'text/plain', filename: 'paja.txt' } },
          { type: 'intent.available', id: 'intent-1', archetype: 'paja-target' },
          { type: 'cvm.discover', id: 'cvm-1' },
          { type: 'outbox.publish', id: 'outbox-1', event: { kind: 1, content: 'hello from paja fixture', tags: [] } },
        ];
        for (const message of messages) window.parent.postMessage(message, '*');
      }
      if (sendShellReady) {
        window.addEventListener('message', (event) => {
          if (!event.data || typeof event.data.type !== 'string') return;
          if (event.data.type === 'shell.init') {
            document.getElementById('shell-init-type').textContent = event.data.type;
            document.getElementById('shell-init-domains').textContent = event.data.capabilities.domains.join(',');
            document.getElementById('target-status').textContent = 'shell-init received';
            if (!${manualTrafficJson}) sendServiceTraffic();
            return;
          }
          renderResult(event.data);
        });
        window.parent.postMessage({ type: 'shell.ready' }, '*');
      } else {
        window.napplet.identity.getPublicKey()
          .then((pubkey) => {
            document.getElementById('identity-pubkey').textContent = pubkey || '';
            document.getElementById('target-status').textContent = 'napplet namespace ready';
          })
          .catch((error) => {
            document.getElementById('target-status').textContent = error instanceof Error ? error.message : String(error);
          });
      }
    </script>
  </body>
</html>`;
}

async function sendFixtureMessage(frame: FrameLocator, message: Record<string, unknown>): Promise<void> {
  await frame.locator('body').evaluate((_body, payload) => {
    const fixtureWindow = window as Window & {
      __sendPajaMessage?: (message: Record<string, unknown>) => void;
    };
    fixtureWindow.__sendPajaMessage?.(payload);
  }, message);
}

async function sendUploadMessage(frame: FrameLocator, id: string, bytes: number[]): Promise<void> {
  await frame.locator('body').evaluate((_body, payload) => {
    const fixtureWindow = window as Window & {
      __sendPajaMessage?: (message: Record<string, unknown>) => void;
    };
    fixtureWindow.__sendPajaMessage?.({
      type: 'upload.upload',
      id: payload.id,
      request: {
        data: new Uint8Array(payload.bytes).buffer,
        filename: `${payload.id}.bin`,
        mimeType: 'application/octet-stream',
      },
    });
  }, { id, bytes });
}

async function readFixtureMessage(
  frame: FrameLocator,
  type: string,
  id: string,
): Promise<Record<string, unknown> | null> {
  return frame.locator('body').evaluate((_body, expected) => {
    const messages = (window as Window & {
      __pajaTestMessages?: Array<Record<string, unknown>>;
    }).__pajaTestMessages ?? [];
    return messages.find((message) => message.type === expected.type && message.id === expected.id) ?? null;
  }, { type, id });
}

function decodeNostrAuthorization(value: string): {
  readonly kind: number;
  readonly created_at: number;
  readonly tags: string[][];
  readonly [key: string]: unknown;
} {
  expect(value).toMatch(/^Nostr /);
  return JSON.parse(Buffer.from(value.slice('Nostr '.length), 'base64').toString('utf8')) as {
    kind: number;
    created_at: number;
    tags: string[][];
  };
}

async function startBlossomServer(): Promise<BlossomTestServer> {
  const puts: BlossomPut[] = [];
  const requestMethods: string[] = [];
  let omitSize = false;
  let url = '';
  const server = createServer((request, response) => {
    requestMethods.push(request.method ?? 'UNKNOWN');
    response.setHeader('access-control-allow-origin', '*');
    response.setHeader('access-control-allow-methods', 'PUT, OPTIONS');
    response.setHeader('access-control-allow-headers', 'authorization, content-type');
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.method !== 'PUT' || request.url !== '/upload') {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('Not found');
      return;
    }
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const bytes = Buffer.concat(chunks);
      const authorization = String(request.headers.authorization ?? '');
      const contentType = String(request.headers['content-type'] ?? '');
      puts.push({ bytes, authorization, contentType });
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const descriptor = {
        url: `${url}/${sha256}`,
        sha256,
        ...(!omitSize ? { size: bytes.byteLength } : {}),
        type: contentType,
      };
      omitSize = false;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(descriptor));
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || address === null) {
    throw new Error('Blossom server did not bind to a TCP port.');
  }
  url = `http://127.0.0.1:${address.port}`;
  return {
    url,
    puts,
    requestMethods,
    omitSizeOnce() {
      omitSize = true;
    },
    close: () => new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    }),
  };
}
