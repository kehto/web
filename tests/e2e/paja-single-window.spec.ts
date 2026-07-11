import { createServer } from 'node:http';
import { expect, test } from '@playwright/test';
import { startPajaServer, type PajaServer } from '../../packages/paja/dist/index.js';

interface TargetServer {
  readonly url: string;
  close(): Promise<void>;
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
  await expect(page.locator('#simulation-status')).toContainText('identity:anon relay:live:4 storage:local theme:dark off:none');

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
  options: { requiredDomains: readonly string[]; shellReady: boolean },
): string {
  const requiredDomainsJson = JSON.stringify(options.requiredDomains);
  const shellReadyJson = JSON.stringify(options.shellReady);
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
            sendServiceTraffic();
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
