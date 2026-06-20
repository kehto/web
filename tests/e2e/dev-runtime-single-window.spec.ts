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
  await expect(targetFrame.locator('#shell-init-domains')).toContainText('identity,storage,inc');
  await expect(page.locator('#lifecycle-status')).toHaveText('ready');

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
    <script>
      window.addEventListener('message', (event) => {
        if (!event.data || event.data.type !== 'shell.init') return;
        document.getElementById('shell-init-type').textContent = event.data.type;
        document.getElementById('shell-init-domains').textContent = event.data.capabilities.domains.join(',');
        document.getElementById('target-status').textContent = 'shell-init received';
      });
      window.parent.postMessage({ type: 'shell.ready' }, '*');
    </script>
  </body>
</html>`;
}
