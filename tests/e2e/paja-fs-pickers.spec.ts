import { createServer } from 'node:http';
import { expect, test, type FrameLocator } from '@playwright/test';
import { startPajaServer, type PajaServer } from '../../packages/paja/dist/index.js';
import { installPajaApprovalDriver } from './paja-approval-driver.js';

let target: ReturnType<typeof createServer>;
let host: PajaServer;

test.beforeEach(async ({ page }) => installPajaApprovalDriver(page));

test.beforeAll(async () => {
  target = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><head><meta name="napplet-requires" content="shell"><meta name="napplet-optional" content="fs"></head><body><p>FS probe</p></body>');
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

// NIP-5D: NAP traffic travels over the injected namespace's private port.
// Results resolve as `{ result }`; host errors reject and surface as `{ error }`.
async function request(frame: FrameLocator, type: string, args: unknown[] = []) {
  return frame.locator('body').evaluate(async (_body, input) => {
    const method = input.type.slice('fs.'.length);
    const fs = (window as unknown as { napplet: { fs: Record<string, (...args: unknown[]) => Promise<unknown>> } }).napplet.fs;
    try {
      return { result: await fs[method](...input.args) } as Record<string, unknown>;
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) } as Record<string, unknown>;
    }
  }, { type, args });
}

test('OPFS stays usable while missing native pickers are explained separately from ACL grants', async ({ page, browserName }) => {
  if (browserName !== 'firefox') await page.addInitScript(() => {
    if (window !== window.top) return;
    for (const name of ['showOpenFilePicker', 'showSaveFilePicker', 'showDirectoryPicker']) {
      Object.defineProperty(window, name, { configurable: true, value: undefined });
    }
  });
  await page.goto(host.url);
  const frame = page.frameLocator('#napplet-frame');
  await expect(frame.locator('body')).toContainText('FS probe');
  await expect(page.locator('[data-acl-capability="fs:read"]')).toHaveAttribute('data-enabled', 'true');
  await expect(page.locator('#paja-fs-support')).toContainText('Workspace available');
  await expect(page.locator('#paja-fs-support')).toContainText('open unavailable');
  await expect(page.locator('#paja-fs-support')).toContainText('save unavailable');

  expect(await request(frame, 'fs.write', ['/workspace/probe.txt', 'cHJvYmU='])).not.toHaveProperty('error');
  expect(await request(frame, 'fs.read', ['/workspace/probe.txt'])).toMatchObject({ result: { data: 'cHJvYmU=' } });
  for (const type of ['fs.pickFile', 'fs.pickFiles', 'fs.pickDirectory', 'fs.pickSaveFile']) {
    expect(await request(frame, type)).toEqual({ error: 'unsupported' });
    await expect(page.locator(`[data-message-type="${type}.result"] .log-detail`)).toContainText('browser does not provide');
  }
  await expect(page.locator('#paja-confirmation-dialog')).not.toBeVisible();
  await page.locator('[data-interface-domain="fs"]').click();
  await expect(page.locator('#paja-fs-support')).toHaveText('FS disabled by host.');
});

test('missing OPFS is reported without claiming a usable workspace or changing ACL permission', async ({ page }) => {
  await page.addInitScript(() => {
    if (window !== window.top) return;
    Object.defineProperty(navigator.storage, 'getDirectory', {
      value: async () => { throw new DOMException('Storage unavailable', 'SecurityError'); },
    });
  });
  await page.goto(host.url);
  await expect(page.frameLocator('#napplet-frame').locator('body')).toContainText('FS probe');
  await expect(page.locator('#paja-fs-support')).toHaveText('FS unavailable: browser workspace storage could not be opened.');
  await expect(page.locator('[data-acl-capability="fs:read"]')).toHaveAttribute('data-enabled', 'true');
});

test('available native pickers run from the host approval click and preserve cancellation results', async ({ page }) => {
  await page.addInitScript(() => {
    if (window !== window.top) return;
    const calls: boolean[] = [];
    Object.defineProperty(window, '__fsPickerActivation', { value: calls });
    const picker = async () => {
      calls.push(navigator.userActivation.isActive);
      throw new DOMException('User cancelled', 'AbortError');
    };
    for (const name of ['showOpenFilePicker', 'showSaveFilePicker', 'showDirectoryPicker']) {
      Object.defineProperty(window, name, { configurable: true, value: picker });
    }
  });
  await page.goto(host.url);
  const frame = page.frameLocator('#napplet-frame');
  await expect(frame.locator('body')).toContainText('FS probe');
  await expect(page.locator('#paja-fs-support')).toContainText('open available');
  await expect(page.locator('#paja-fs-support')).toContainText('save available');
  for (const type of ['fs.pickFile', 'fs.pickSaveFile']) {
    const pending = request(frame, type);
    await expect(page.locator('#paja-confirmation-dialog')).toBeVisible();
    await page.locator('#paja-confirmation-approve').click();
    expect(await pending).toEqual({ error: 'cancelled' });
    await expect(page.locator(`[data-message-type="${type}.result"]`).last()).toBeVisible();
  }
  expect(await page.evaluate(() => (window as Window & { __fsPickerActivation?: boolean[] }).__fsPickerActivation)).toEqual([true, true]);
});
