import { createServer } from 'node:http';
import { expect, test, type FrameLocator, type Page } from '@playwright/test';
import { startPajaServer, type PajaServer } from '../../packages/paja/dist/index.js';

// Draft NAP-LLM (napplet/naps PR #134 at 3e10939) hosted by Paja: the llm
// interface is advertised while unconfigured, select() offers configuration and
// answers typed failures, the chooser scopes selection, and every generation
// asks for consent before a prompt leaves the page. The streaming case covers
// kehto/web#370 (provider SSE → ordered llm.delta → authoritative result) and
// #369 (a napplet llm.cancel withdraws the open consent dialog).

let target: ReturnType<typeof createServer>;
let host: PajaServer;

test.beforeAll(async () => {
  target = createServer((request, response) => {
    if (request.url === '/v1/chat/completions') { streamCompletion(request.method ?? 'GET', response); return; }
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><body><p>LLM probe</p></body>');
  });
  await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve));
  const address = target.address();
  if (!address || typeof address === 'string') throw new Error('Target did not bind');
  host = await startPajaServer({ options: { targetUrl: `http://127.0.0.1:${address.port}`, port: 0 } });
});

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'POST' };
const STREAM_CHUNKS = [
  { choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] },
  { choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }] },
  { choices: [{ index: 0, delta: { content: ', napplet' }, finish_reason: null }] },
  { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
  { choices: [], usage: { prompt_tokens: 5, completion_tokens: 3 } },
];

/** A local OpenAI-compatible server answering every completion as server-sent events. */
function streamCompletion(method: string, response: import('node:http').ServerResponse) {
  if (method === 'OPTIONS') { response.writeHead(204, CORS); response.end(); return; }
  response.writeHead(200, { ...CORS, 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  const lines = [...STREAM_CHUNKS.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`), 'data: [DONE]\n\n'];
  const timer = setInterval(() => {
    const line = lines.shift();
    if (line === undefined) { clearInterval(timer); response.end(); return; }
    response.write(line);
  }, 20);
}

test.afterAll(async () => {
  await host?.close();
  await new Promise<void>((resolve, reject) => target.close((error) => error ? reject(error) : resolve()));
});

// NIP-5D: NAP-LLM travels over the injected namespace's private port. Each
// helper maps the API's resolve/reject back to `{ <field>: value }` or
// `{ error: { code, message } }`, the `.result` wire payload the host sent.
const LLM_FIELDS: Record<string, string> = { select: 'model', describe: 'model', generate: 'result', cancel: 'cancelled' };

function request(frame: FrameLocator, type: string, fields: Record<string, unknown> = {}) {
  const method = type.slice('llm.'.length);
  const arg = method === 'select' ? fields.requirements : method === 'describe' ? fields.handle
    : method === 'generate' ? fields.request : fields.requestId;
  return frame.locator('body').evaluate(async (_body, input) => {
    const llm = (window as unknown as { napplet: { llm: Record<string, (arg?: unknown) => Promise<unknown>> } }).napplet.llm;
    try {
      const value = input.arg === undefined ? await llm[input.method]() : await llm[input.method](input.arg);
      return { [input.field]: value } as Record<string, unknown>;
    } catch (error) {
      const failure = error as { code?: string; message?: string };
      return { error: { code: failure.code, message: failure.message } } as Record<string, unknown>;
    }
  }, { method, arg, field: LLM_FIELDS[method] });
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

function streamGeneration(frame: FrameLocator, generation: Record<string, unknown>) {
  return frame.locator('body').evaluate(async (_body, input) => {
    const deltas: Array<Record<string, unknown>> = [];
    const llm = (window as unknown as { napplet: { llm: { generate(request: unknown, options: unknown): Promise<unknown> } } }).napplet.llm;
    const result = await llm.generate(input, { onDelta: (delta: Record<string, unknown>) => deltas.push(delta) });
    return { deltas, result: { result } as Record<string, unknown> };
  }, generation);
}

test('streams provider output as ordered deltas and withdraws consent when the napplet cancels', async ({ page }) => {
  await page.goto(host.url);
  const frame = page.frameLocator('#napplet-frame');
  await expect(frame.locator('body')).toContainText('LLM probe');
  const address = target.address();
  if (!address || typeof address === 'string') throw new Error('Target did not bind');
  await addConnection(page, 'Streaming local', `http://127.0.0.1:${address.port}/v1`, 'stream-model');

  const selected = request(frame, 'llm.select');
  await expect(page.locator('#paja-llm-select-dialog')).toBeVisible();
  await page.locator('#paja-llm-select-use').click();
  const handle = ((await selected).model as { handle: string }).handle;
  const generation = { handle, messages: [{ role: 'user', content: [{ type: 'text', text: 'stream please' }] }] };

  const streamed = streamGeneration(frame, generation);
  await expect(page.locator('#paja-confirmation-title')).toHaveText('Send this prompt to a language model?');
  await page.locator('#paja-confirmation-approve').click();
  const { deltas, result } = await streamed;
  expect(deltas.map((delta) => [delta.sequence, delta.text])).toEqual([[0, 'Hello'], [1, ', napplet']]);
  expect(result).toMatchObject({ result: { text: 'Hello, napplet', finish: 'stop', usage: { inputTokens: 5, outputTokens: 3 } } });

  const requestId = await frame.locator('body').evaluate((_body, input) => {
    const llm = (window as unknown as { napplet: { llm: { generate(request: unknown): Promise<unknown> & { requestId: string } } } }).napplet.llm;
    const generation = llm.generate(input);
    (window as unknown as { __pendingGeneration: Promise<unknown> }).__pendingGeneration = generation.then(
      (result) => ({ result }),
      (error: { code?: string; message?: string }) => ({ error: { code: error.code, message: error.message } }),
    );
    return generation.requestId;
  }, generation);
  const pending = frame.locator('body').evaluate(() => (window as unknown as { __pendingGeneration: Promise<Record<string, unknown>> }).__pendingGeneration);
  await expect(page.locator('#paja-confirmation-dialog')).toBeVisible();
  expect(await request(frame, 'llm.cancel', { requestId })).toMatchObject({ cancelled: true });
  expect(await pending).toMatchObject({ error: { code: 'cancelled' } });
  await expect(page.locator('#paja-confirmation-dialog')).toBeHidden();
});

test('switching presets clears the previous key before discovery and updates only default names', async ({ page }) => {
  const listingHeaders: Array<Record<string, string>> = [];
  await page.route('http://127.0.0.1:8008/v1/models', async (route) => {
    listingHeaders.push(route.request().headers());
    await route.fulfill({ json: { data: [{ id: 'alpha' }, { id: 'beta' }] } });
  });
  await page.goto(host.url);
  await page.locator('#paja-section-llm').evaluate((section) => { (section as HTMLDetailsElement).open = true; });
  const preset = page.locator('#paja-llm-preset');
  const name = page.locator('#paja-llm-name');
  const key = page.locator('#paja-llm-credential');
  await expect(name).toHaveValue('OpenAI');
  await key.fill('sk-previous-provider-secret');
  await preset.selectOption('routstr');
  await expect(page.locator('#paja-llm-model-status')).toContainText('Connected');
  expect(listingHeaders).toHaveLength(1);
  expect(listingHeaders[0]).not.toHaveProperty('authorization');
  await expect(key).toHaveValue('');
  await expect(name).toHaveValue('Routstr');
  await preset.selectOption('anthropic');
  await expect(name).toHaveValue('Anthropic');
  await expect(page.locator('#paja-llm-base-url')).toHaveValue('https://api.anthropic.com/v1');
  await name.fill('My personal connection');
  await preset.selectOption('openai');
  await expect(name).toHaveValue('My personal connection');
  await name.fill('');
  await preset.selectOption('anthropic');
  await expect(name).toHaveValue('Anthropic');
});

test('saving a Routstr connection keeps the catalogue available for another connection', async ({ page }) => {
  await page.route('http://127.0.0.1:8008/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'alpha' }, { id: 'beta' }] } }));
  await page.goto(host.url);
  await page.locator('#paja-section-llm').evaluate((section) => { (section as HTMLDetailsElement).open = true; });
  await page.locator('#paja-llm-preset').selectOption('routstr');
  const models = page.locator('#paja-llm-model-select');
  await expect(models.locator('option')).toHaveCount(2);
  await page.locator('#paja-llm-name').fill('First Routstr');
  await models.selectOption('alpha');
  await page.locator('#paja-llm-save').click();
  await expect(page.locator('#paja-llm-status')).toContainText('Saved First Routstr');
  await expect(models.locator('option')).toHaveCount(2);
  await page.locator('#paja-llm-name').fill('Second Routstr');
  await models.selectOption('beta');
  await page.locator('#paja-llm-save').click();
  await expect(page.locator('#paja-llm-status')).toContainText('Saved Second Routstr');
  await expect(page.locator('#paja-llm-connections li')).toHaveCount(2);
  await expect(page.locator('#paja-llm-connections')).toContainText('First Routstr · alpha');
  await expect(page.locator('#paja-llm-connections')).toContainText('Second Routstr · beta');
});


test('failed Routstr discovery offers installation guidance and clears it on retry or provider switch', async ({ page }) => {
  let connected = false;
  await page.route('http://127.0.0.1:8008/v1/models', (route) => connected
    ? route.fulfill({ json: { data: [{ id: 'alpha' }] } })
    : route.abort('connectionrefused'));
  await page.goto(host.url);
  await page.locator('#paja-section-llm').evaluate((section) => { (section as HTMLDetailsElement).open = true; });
  const preset = page.locator('#paja-llm-preset');
  const status = page.locator('#paja-llm-model-status');
  const install = status.getByRole('link', { name: 'Install routstrd' });
  await expect(install).toHaveCount(0);
  await preset.selectOption('routstr');
  await expect(install).toBeVisible();
  await expect(install).toHaveAttribute('href', 'https://routstr.com/routstrd');
  await expect(install).toHaveAttribute('target', '_blank');
  await expect(install).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.locator('#paja-llm-model')).toBeVisible();
  await preset.selectOption('openrouter');
  await expect(install).toHaveCount(0);
  await preset.selectOption('routstr');
  await expect(install).toBeVisible();
  connected = true;
  await page.locator('#paja-llm-base-url').fill('http://127.0.0.1:8008/v1/');
  await page.locator('#paja-llm-base-url').blur();
  await expect(status).toContainText('Connected');
  await expect(install).toHaveCount(0);
});
