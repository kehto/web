/**
 * demo-service-toggle.spec.ts — E2E-06: service toggle icon flips disabled class.
 *
 * Asserts the topology service node's toggle icon adds/removes the
 * `service-disabled` class on click, and that toggling does not cause
 * anti-term page errors.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('notifications service toggle flips .service-disabled class', async ({ page }) => {
  await demoBeforeEach(page);
  const node = page.locator('[data-service-name="notifications"]');
  await expect(node).toBeVisible();
  await expect(node).not.toHaveClass(/service-disabled/);

  // Disable — first click
  await node.locator('.service-toggle-icon').click();
  await expect(node).toHaveClass(/service-disabled/, { timeout: 15_000 });

  // Re-enable — second click
  await node.locator('.service-toggle-icon').click();
  await expect(node).not.toHaveClass(/service-disabled/, { timeout: 15_000 });
});

test('notifications service toggle persists across reloads', async ({ page }) => {
  // Two full page.reload() cycles each re-bind the whole roster before service
  // state restores from localStorage; the default 30s budget is too tight on
  // slow CI runners (the real flake — failures land at ~31s total, not on the
  // per-assertion timeouts). Match the sibling ACL-persistence spec's headroom.
  test.setTimeout(120_000);
  await demoBeforeEach(page);
  const node = page.locator('[data-service-name="notifications"]');
  await expect(node).toBeVisible();

  await node.locator('.service-toggle-icon').click();
  await expect(node).toHaveClass(/service-disabled/, { timeout: 15_000 });
  await expect.poll(() =>
    page.evaluate(() => JSON.parse(localStorage.getItem('kehto.playground.disabledServices.v1') ?? '[]')),
  ).toContain('notifications');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#topology-root', { state: 'visible', timeout: 15_000 });
  await expect(page.locator('[data-service-name="notifications"]')).toHaveClass(/service-disabled/, { timeout: 15_000 });

  await page.locator('[data-service-name="notifications"] .service-toggle-icon').click();
  await expect(page.locator('[data-service-name="notifications"]')).not.toHaveClass(/service-disabled/, { timeout: 15_000 });
  await expect.poll(() =>
    page.evaluate(() => JSON.parse(localStorage.getItem('kehto.playground.disabledServices.v1') ?? '[]')),
  ).not.toContain('notifications');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#topology-root', { state: 'visible', timeout: 15_000 });
  await expect(page.locator('[data-service-name="notifications"]')).not.toHaveClass(/service-disabled/, { timeout: 15_000 });
});

test('new registrations reflect disabled live services without mutating concurrent frame snapshots', async ({ page }) => {
  test.setTimeout(120_000);
  await demoBeforeEach(page);

  const botHandle = await page.locator('#bot-frame-container iframe').elementHandle();
  const toasterHandle = await page.locator('#toaster-frame-container iframe').elementHandle();
  expect(botHandle, 'bot iframe').not.toBeNull();
  expect(toasterHandle, 'toaster iframe').not.toBeNull();
  const botFrame = await botHandle!.contentFrame();
  const toasterFrame = await toasterHandle!.contentFrame();
  expect(botFrame, 'bot content frame').not.toBeNull();
  expect(toasterFrame, 'toaster content frame').not.toBeNull();

  const shellState = async (frame: NonNullable<typeof toasterFrame>) => frame.evaluate(async () => {
    const shell = (window as Window & {
      napplet?: { shell?: {
        ready: () => Promise<{ capabilities: { domains: readonly string[] }; services: readonly string[] }>;
        supports: (domain: string) => boolean;
      } };
    }).napplet?.shell;
    const environment = await shell?.ready();
    return {
      receiver: typeof (window as Window & { napplet?: Record<string, unknown> }).napplet?.notify === 'object',
      supports: shell?.supports('notify') ?? false,
      domains: environment?.capabilities.domains ?? [],
      services: environment?.services ?? [],
    };
  });

  await expect.poll(() => shellState(botFrame!)).toMatchObject({ receiver: true, supports: true });
  await expect.poll(() => shellState(toasterFrame!)).toMatchObject({ receiver: true, supports: true });

  await page.locator('[data-service-name="notifications"] .service-toggle-icon').click();
  await expect(page.locator('[data-service-name="notifications"]')).toHaveClass(/service-disabled/);

  // Existing frames keep their frozen first-init snapshot; only a new
  // registration receives the current disabled live environment.
  await expect.poll(() => shellState(botFrame!)).toMatchObject({ receiver: true, supports: true });

  await page.evaluate(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('#toaster-frame-container iframe');
    if (!iframe) throw new Error('toaster iframe missing');
    iframe.srcdoc = iframe.srcdoc;
  });

  await expect.poll(async () => {
    const handle = await page.locator('#toaster-frame-container iframe').elementHandle();
    const frame = handle ? await handle.contentFrame() : null;
    if (!frame) return false;
    const state = await shellState(frame);
    return state.receiver === false && state.supports === false &&
      !state.domains.includes('notify') && !state.services.includes('notifications');
  }, { timeout: 30_000 }).toBe(true);

  const refreshedHandle = await page.locator('#toaster-frame-container iframe').elementHandle();
  const refreshedFrame = await refreshedHandle?.contentFrame();
  expect(refreshedFrame, 'reloaded toaster content frame').not.toBeNull();
  const duplicateInitCount = await refreshedFrame!.evaluate(async () => {
    let initCount = 0;
    window.addEventListener('message', (event) => {
      if ((event.data as { type?: unknown } | null)?.type === 'shell.init') initCount += 1;
    });
    window.parent.postMessage({ type: 'shell.ready' }, '*');
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    return initCount;
  });
  expect(duplicateInitCount).toBe(0);
});

test('service toggle click does not cause anti-term page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await demoBeforeEach(page);
  await page.locator('[data-service-name="notifications"] .service-toggle-icon').click();
  await page.waitForTimeout(200);
  await page.locator('[data-service-name="notifications"] .service-toggle-icon').click();
  const antiErrors = errors.filter(e => ANTI_TERM_RE.test(e));
  expect(antiErrors, `anti-term in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});
