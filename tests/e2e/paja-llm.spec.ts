import { createServer } from 'node:http';
import { expect, test, type FrameLocator, type Page } from '@playwright/test';
import { startPajaServer, type PajaServer } from '../../packages/paja/dist/index.js';

// Draft NAP-LLM (napplet/naps PR #134 at 3e10939) hosted by Paja: the llm
// interface is advertised while unconfigured, select() offers configuration and
// answers typed failures, the chooser scopes selection, and every generation
// asks for consent before a prompt leaves the page.

let target: ReturnType<typeof createServer>;
let host: PajaServer;

test.beforeAll(async () => {
  target = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><body><p>LLM probe</p><script>window.parent.postMessage({type:"shell.ready"}, "*")</script>');
  });
  await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve));
  const address = target.address();
  if (!address || typeof address === 'string') throw new Error('Target did not bind');
  host = await startPajaServer({ options: { targetUrl: `http://127.0.0.1:${address.port}`, port: 0 } });
});

test.afterAll(async () => {
  await host?.close();
  await new Promise<void>((resolve, reject) => target.close((error) => error ? reject(error) : resolve()));
});

function request(frame: FrameLocator, type: string, fields: Record<string, unknown> = {}) {
  return frame.locator('body').evaluate((_body, input) => new Promise<Record<string, unknown>>((resolve) => {
    const id = crypto.randomUUID();
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent || event.data?.id !== id || event.data?.type !== `${input.type}.result`) return;
      window.removeEventListener('message', receive);
      resolve(event.data);
    };
    window.addEventListener('message', receive);
    window.parent.postMessage({ ...input.fields, type: input.type, id }, '*');
  }), { type, fields });
}

async function addConnection(page: Page, name: string, baseUrl: string, model: string) {
  await page.locator('#paja-llm-preset').selectOption('custom');
  await page.locator('#paja-llm-name').fill(name);
  await page.locator('#paja-llm-base-url').fill(baseUrl);
  await page.locator('#paja-llm-model').fill(model);
  await page.locator('#paja-llm-save').click();
  await expect(page.locator('#paja-llm-status')).toContainText(`Saved ${name}`);
}

test('advertises an unconfigured llm interface, prompts to configure, then selects and asks consent per generation', async ({ page }) => {
  await page.goto(host.url);
  const frame = page.frameLocator('#napplet-frame');
  await expect(frame.locator('body')).toContainText('LLM probe');
  const toggle = page.locator('#interface-toggles [data-interface-domain="llm"]');
  await expect(toggle).toHaveAttribute('data-enabled', 'true');
  await expect(toggle).toHaveAttribute('data-state', 'unconfigured');
  await expect(toggle).toHaveText(/^⚠ llm$/);
  expect(await frame.locator('body').evaluate(() => typeof (window as Window & { napplet?: { llm?: unknown } }).napplet?.llm)).toBe('object');

  const declined = request(frame, 'llm.select', { requirements: { json: true } });
  await expect(page.locator('#paja-confirmation-title')).toHaveText('Configure a language model connection?');
  await page.locator('#paja-confirmation-deny').click();
  expect(await declined).toMatchObject({ error: { code: 'user-cancelled' } });

  const configure = request(frame, 'llm.select');
  await expect(page.locator('#paja-confirmation-title')).toHaveText('Configure a language model connection?');
  await page.locator('#paja-confirmation-approve').click();
  expect(await configure).toMatchObject({ error: { code: 'unsupported', message: expect.stringContaining('Language models') } });
  await expect(page.locator('#paja-section-llm')).toHaveAttribute('open', '');

  await addConnection(page, 'Dead local', 'http://127.0.0.1:9/v1', 'probe-model');
  await expect(page.locator('#paja-llm-connections li')).toHaveCount(1);
  await expect(toggle).toHaveAttribute('data-state', 'supported');
  await expect(toggle).toHaveText('llm');

  const selected = request(frame, 'llm.select');
  await expect(page.locator('#paja-llm-select-dialog')).toBeVisible();
  await page.locator('#paja-llm-select-use').click();
  const selection = await selected;
  expect(selection).toMatchObject({ model: { name: 'Dead local', model: 'probe-model', route: expect.stringContaining('http://127.0.0.1:9'), images: false, json: true } });
  const handle = (selection.model as { handle: string }).handle;
  expect(JSON.stringify(selection)).not.toContain('probe-secret');
  expect(await request(frame, 'llm.describe', { handle })).toMatchObject({ model: { handle } });

  const generation = { handle, messages: [{ role: 'user', content: [{ type: 'text', text: 'private prompt text' }] }] };
  const denied = request(frame, 'llm.generate', { request: generation });
  await expect(page.locator('#paja-confirmation-title')).toHaveText('Send this prompt to a language model?');
  await expect(page.locator('#paja-confirmation-details')).toContainText('Route: Paja (this browser)');
  await expect(page.locator('#paja-confirmation-details')).not.toContainText('private prompt text');
  await page.locator('#paja-confirmation-deny').click();
  expect(await denied).toMatchObject({ error: { code: 'user-cancelled' } });

  const approved = request(frame, 'llm.generate', { request: generation });
  await expect(page.locator('#paja-confirmation-title')).toHaveText('Send this prompt to a language model?');
  await page.locator('#paja-confirmation-approve').click();
  expect(await approved).toMatchObject({ error: { code: 'provider-error', message: 'The provider could not be reached.' } });
  await expect(page.locator('[data-message-type="paja.llm.confirmed"]')).toHaveCount(1);
  expect(await page.locator('#message-log').textContent()).not.toContain('private prompt text');

  await toggle.click();
  await expect(toggle).toHaveAttribute('data-state', 'disabled');
  await expect(frame.locator('body')).toContainText('LLM probe');
  expect(await frame.locator('body').evaluate(() => typeof (window as Window & { napplet?: { llm?: unknown } }).napplet?.llm)).toBe('undefined');
});
