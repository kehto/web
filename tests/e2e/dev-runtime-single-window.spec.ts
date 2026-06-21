import { createServer } from 'node:http';
import { expect, test } from '@playwright/test';
import { startDevRuntimeServer, type DevRuntimeServer } from '../../packages/dev-runtime/dist/index.js';

interface TargetServer {
  readonly url: string;
  close(): Promise<void>;
}

let targetServer: TargetServer;
let runtimeServer: DevRuntimeServer;

test.beforeAll(async () => {
  targetServer = await startTargetServer();
  runtimeServer = await startDevRuntimeServer({
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
  await page.goto(runtimeServer.url);

  await expect(page.locator('header.top')).toBeVisible();
  await expect(page.locator('footer.bottom')).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(page.locator('#napplet-frame')).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(page.locator('#napplet-frame')).not.toHaveAttribute('sandbox', /allow-same-origin/);

  const targetFrame = page.frameLocator('#napplet-frame');
  await expect(targetFrame.locator('#target-status')).toHaveText('shell-init received');
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
  await expect(page.locator('#lifecycle-status')).toHaveText('ready');
  await expect(page.locator('#simulation-status')).toContainText('identity:anon relay:1 storage:local theme:dark off:none');

  const firstLoadId = await targetFrame.locator('#load-id').textContent();
  expect(firstLoadId).toBeTruthy();

  await page.locator('#reload-target').click();

  await expect(page.locator('iframe')).toHaveCount(1);
  await expect.poll(async () => targetFrame.locator('#load-id').textContent()).not.toBe(firstLoadId);
  await expect(targetFrame.locator('#target-status')).toHaveText('shell-init received');
  await expect(page.locator('#lifecycle-status')).toHaveText('ready');

  const state = await page.evaluate(() => window.__KEHTO_DEV_RUNTIME__?.getState());
  expect(state).toMatchObject({
    generation: 1,
    status: 'ready',
    iframeCount: 1,
    initSent: true,
  });
  expect(state?.services).toEqual(expect.arrayContaining([
    'config',
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
});

test('applies simulation config and compact theme adjustment', async ({ page }) => {
  const pubkey = '4'.repeat(64);
  const customRuntime = await startDevRuntimeServer({
    options: {
      targetUrl: targetServer.url,
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
    await page.locator('#reload-target').click();
    await expect(targetFrame.locator('#target-status')).toHaveText('shell-init received');
    await expect(targetFrame.locator('#theme-background')).toHaveText('#101211');
  } finally {
    await customRuntime.close();
  }
});

async function startTargetServer(): Promise<TargetServer> {
  let loadCount = 0;
  const server = createServer((request, response) => {
    if (request.url !== '/') {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    loadCount += 1;
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
    });
    response.end(renderTargetHtml(loadCount));
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

function renderTargetHtml(loadCount: number): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Kehto dev-runtime fixture</title>
  </head>
  <body>
    <div id="target-status">booting</div>
    <div id="load-id">${loadCount}</div>
    <div id="shell-init-type"></div>
    <div id="shell-init-domains"></div>
    <div id="service-results"></div>
    <div id="identity-pubkey"></div>
    <div id="config-density"></div>
    <div id="theme-background"></div>
    <script>
      const seenTypes = new Set();
      const serviceResults = document.getElementById('service-results');
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
      }
      function sendServiceTraffic() {
        const bytes = new TextEncoder().encode('kehto-dev-runtime').buffer;
        const messages = [
          { type: 'storage.set', id: 'storage-1', key: 'phase', value: '92' },
          { type: 'config.get', id: 'config-1' },
          { type: 'theme.get', id: 'theme-1' },
          { type: 'notify.send', id: 'notify-1', title: 'hello from fixture' },
          { type: 'identity.getPublicKey', id: 'identity-1' },
          { type: 'upload.upload', id: 'upload-1', request: { data: bytes, mimeType: 'text/plain', filename: 'dev-runtime.txt' } },
          { type: 'intent.available', id: 'intent-1', archetype: 'dev-runtime-target' },
          { type: 'cvm.discover', id: 'cvm-1' },
        ];
        for (const message of messages) window.parent.postMessage(message, '*');
      }
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
    </script>
  </body>
</html>`;
}
