// Downstream Paja Playwright spec template for an experimental x- NAP.
// Requires: @playwright/test (Chromium), @kehto/paja (add @types/node to type-check).
// Copy next to x-echo.js and paja.config.json, plus a playwright.config.ts with a chromium project.
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
  const frame = await (await page.locator('#napplet-frame').elementHandle())?.contentFrame();
  type Echo = { say(text: string): Promise<string>; onHeard(cb: (text: string) => void): () => void };
  const early = await frame?.evaluate(() => (window as unknown as { napplet: Record<string, Echo> }).napplet['x-echo']
    .say('early').then(() => 'ok', (error: { code?: string }) => error.code));
  expect(early).toBe('not-configured');

  // Settings inputs are #paja-extension-<domain>-<key>; the button is #paja-extension-<domain>-save.
  await page.locator('#paja-extension-x-echo-prefix').fill('echo>');
  await page.locator('#paja-extension-x-echo-save').click();
  await expect(toggle).toHaveAttribute('data-state', 'supported');

  const result = await frame?.evaluate(async () => {
    const echo = (window as unknown as { napplet: Record<string, Echo> }).napplet['x-echo'];
    const heard: string[] = [];
    echo.onHeard((text) => heard.push(text));
    const reply = await echo.say('hi');
    await new Promise((done) => setTimeout(done, 100));
    return { reply, heard };
  });
  expect(result).toEqual({ reply: 'echo>hi', heard: ['echo>hi'] });
});
