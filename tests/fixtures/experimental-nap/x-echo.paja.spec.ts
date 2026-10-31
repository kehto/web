// Downstream Paja Playwright spec template for an experimental x- NAP.
// Requires: @playwright/test (Chromium), @kehto/paja. Copy next to x-echo.js and paja.config.json.
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { startPajaServer, type PajaServer } from '@kehto/paja';

const configPath = fileURLToPath(new URL('./paja.config.json', import.meta.url));
let target: ReturnType<typeof createServer>;
let paja: PajaServer;

test.beforeAll(async () => {
  target = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><body><p>echo probe</p>');
  });
  await new Promise<void>((done) => target.listen(0, '127.0.0.1', done));
  const address = target.address();
  if (!address || typeof address === 'string') throw new Error('target did not bind');
  paja = await startPajaServer({ options: { targetUrl: `http://127.0.0.1:${address.port}`, port: 0, configPath } });
});

test.afterAll(async () => {
  await paja?.close();
  await new Promise<void>((done) => target.close(() => done()));
});

test('x-echo is advertised unconfigured, then echoes once configured', async ({ page }) => {
  await page.goto(paja.url);
  await expect(page.frameLocator('#napplet-frame').locator('body')).toContainText('echo probe');
  const toggle = page.locator('#interface-toggles [data-interface-domain="x-echo"]');
  await expect(toggle).toHaveAttribute('data-state', 'unconfigured');

  await page.locator('#paja-extension-x-echo-prefix').fill('echo>');
  await page.locator('#paja-extension-x-echo-save').click();
  await expect(toggle).toHaveAttribute('data-state', 'supported');

  const frame = await (await page.locator('#napplet-frame').elementHandle())?.contentFrame();
  const reply = await frame?.evaluate(() => {
    const echo = (window as unknown as { napplet: Record<string, { say(text: string): Promise<string> }> }).napplet['x-echo'];
    return echo.say('hi');
  });
  expect(reply).toBe('echo>hi');
});
