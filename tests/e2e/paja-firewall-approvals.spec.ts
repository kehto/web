import { createServer } from 'node:http';
import { expect, test, type Page } from '@playwright/test';
import { startPajaServer, type PajaServer } from '../../packages/paja/dist/index.js';
import { installPajaAskEverythingRules } from './paja-approval-driver.js';

const TARGET_HTML = `<!doctype html><html><head>
  <meta name="napplet-requires" content="shell">
  <meta name="napplet-optional" content="theme">
  </head><body><output id="executed">pending</output><output id="theme-state"></output>
  <script>
    document.getElementById('executed').textContent = 'yes';
    document.getElementById('theme-state').textContent = typeof window.napplet.theme;
  </script></body></html>`;

let target: ReturnType<typeof createServer>;
let sibling: ReturnType<typeof createServer>;
let host: PajaServer;
let allowedRequests = 0;
let siblingRequests = 0;
let siblingUrl = '';

test.beforeAll(async () => {
  target = createServer((request, response) => {
    if (request.url === '/allowed') allowedRequests++;
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'access-control-allow-origin': '*',
    });
    response.end(TARGET_HTML);
  });
  await new Promise<void>((resolve, reject) => {
    target.once('error', reject);
    target.listen(0, '127.0.0.1', () => { target.off('error', reject); resolve(); });
  });
  const address = target.address();
  if (!address || typeof address === 'string') throw new Error('Target did not bind');
  sibling = createServer((_request, response) => {
    siblingRequests++;
    response.writeHead(200, { 'access-control-allow-origin': '*' });
    response.end('sibling');
  });
  await new Promise<void>((resolve, reject) => {
    sibling.once('error', reject);
    sibling.listen(0, '127.0.0.1', () => { sibling.off('error', reject); resolve(); });
  });
  const siblingAddress = sibling.address();
  if (!siblingAddress || typeof siblingAddress === 'string') throw new Error('Sibling did not bind');
  siblingUrl = `http://127.0.0.1:${siblingAddress.port}/blocked`;
  host = await startPajaServer({ options: { targetUrl: `http://127.0.0.1:${address.port}/`, port: 0 } });
});

test.afterAll(async () => {
  await host?.close();
  await new Promise<void>((resolve, reject) => target.close((error) => error ? reject(error) : resolve()));
  await new Promise<void>((resolve, reject) => sibling.close((error) => error ? reject(error) : resolve()));
});

async function choose(page: Page, permission: string, effect: 'Allow' | 'Deny'): Promise<void> {
  const dialog = page.locator('.kehto-approval-ui dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(permission);
  await dialog.getByRole('button', { name: effect, exact: true }).click();
}

test.describe('with every request set to ask', () => {
test.beforeEach(async ({ page }) => { await installPajaAskEverythingRules(page); });

test('required network denial prevents the target script from executing', async ({ page }) => {
  await page.goto(host.url);
  await choose(page, 'connect-src', 'Deny');
  await expect.poll(() => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('error');
  await expect(page.frameLocator('#napplet-frame').locator('#executed')).toHaveCount(0);
});

test('optional denial narrows the executing namespace', async ({ page }) => {
  await page.goto(host.url);
  await choose(page, 'connect-src', 'Allow');
  await choose(page, 'Use the theme interface', 'Deny');
  const frame = page.frameLocator('#napplet-frame');
  await expect(frame.locator('#executed')).toHaveText('yes');
  await expect(frame.locator('#theme-state')).toHaveText('undefined');
});

for (const collapsed of ['console', 'permissions'] as const) {
  test(`approval remains usable with persisted collapsed ${collapsed}`, async ({ page }) => {
    await page.addInitScript((preference) => {
      if (window !== window.top) return;
      if (preference === 'console') localStorage.setItem('kehto:paja:console:v1', 'collapsed');
      else localStorage.setItem('kehto:paja:sidebar-sections:v1', JSON.stringify({ permissions: true }));
    }, collapsed);
    await page.goto(host.url);
    await expect(page.frameLocator('#napplet-frame').locator('#executed')).toHaveCount(0);
    await choose(page, 'connect-src', 'Allow');
    await choose(page, 'Use the theme interface', 'Deny');
    const frame = page.frameLocator('#napplet-frame');
    await expect(frame.locator('#executed')).toHaveText('yes');
    await expect(frame.locator('#theme-state')).toHaveText('undefined');
    if (collapsed === 'console') {
      await expect(page.locator('html')).toHaveAttribute('data-paja-console', 'collapsed');
    } else {
      await expect(page.locator('#paja-section-permissions')).not.toHaveAttribute('open');
    }
  });
}

test('revoking an approved interface retires the executing frame', async ({ page }) => {
  await page.goto(host.url);
  await choose(page, 'connect-src', 'Allow');
  await choose(page, 'Use the theme interface', 'Allow');
  const frame = page.frameLocator('#napplet-frame');
  await expect(frame.locator('#theme-state')).toHaveText('object');
  await page.locator('.kehto-fw-domain', { hasText: 'theme' }).locator('> summary').click();
  const revoke = page.getByRole('button', { name: 'Revoke access exact:theme' });
  await expect(revoke).toBeVisible();
  await revoke.click();
  await expect(frame.locator('#executed')).toHaveCount(0);
});

test('direct network approval reaches its exact origin and blocks a sibling origin', async ({ page }) => {
  const allowedBefore = allowedRequests;
  const siblingBefore = siblingRequests;
  await page.goto(host.url);
  await choose(page, 'connect-src', 'Allow');
  await choose(page, 'Use the theme interface', 'Deny');
  const frame = page.frameLocator('#napplet-frame');
  await expect(frame.locator('#executed')).toHaveText('yes');
  await frame.locator('body').evaluate(async (_body, blocked) => {
    await fetch('allowed').catch(() => undefined);
    await fetch(blocked).catch(() => undefined);
  }, siblingUrl);
  await expect.poll(() => allowedRequests).toBe(allowedBefore + 1);
  expect(siblingRequests).toBe(siblingBefore);
});
});
