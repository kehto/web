/**
 * decrypt-demo Layer-B spec -- E2E-28 Phase 46.
 *
 * Walks the built preview demo through class-1 decrypt success and class-2
 * forbidden short-circuit using the real playground iframe.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

test('decrypt-demo exercises all modes and class-2 forbidden without bridge invocation', async ({ page }) => {
  test.setTimeout(60_000);
  await demoBeforeEach(page);

  await expect(page.locator('[data-napplet-name]')).toHaveCount(13);
  await expect(page.locator('[data-napplet-name="decrypt-demo"]')).toBeVisible();

  const frame = page.frameLocator('#decrypt-demo-frame-container iframe');
  await expect(frame.locator('#decrypt-demo-status')).toContainText(/waiting|decrypting|done/, { timeout: 15_000 });

  const hooksReady = await page.waitForFunction(() => {
    const w = window as Window & {
      __publishDecryptFixtures__?: unknown;
      __setNappletClass__?: unknown;
      __getDecryptBridgeCallCount__?: unknown;
    };
    return typeof w.__publishDecryptFixtures__ === 'function' &&
      typeof w.__setNappletClass__ === 'function' &&
      typeof w.__getDecryptBridgeCallCount__ === 'function';
  }, null, { timeout: 10_000 });
  expect(hooksReady).toBeTruthy();

  await page.evaluate(() => {
    const w = window as Window & { __resetDecryptBridgeCallCount__?: () => void };
    w.__resetDecryptBridgeCallCount__?.();
  });

  const published = await page.evaluate(async () => {
    const w = window as Window & { __publishDecryptFixtures__?: (dTag?: string) => Promise<boolean> };
    return w.__publishDecryptFixtures__?.('decrypt-demo') ?? false;
  });
  expect(published).toBe(true);

  await expect(frame.locator('#decrypt-nip04-status')).toContainText('ok:nip04:fixture-nip04', { timeout: 12_000 });
  await expect(frame.locator('#decrypt-nip44-status')).toContainText('ok:nip44:fixture-nip44', { timeout: 12_000 });
  await expect(frame.locator('#decrypt-nip17-status')).toContainText('ok:nip17:fixture-nip17', { timeout: 12_000 });
  await expect(page.locator('#decrypt-demo-status')).toContainText('authenticated', { timeout: 15_000 });

  const beforeForbidden = await page.evaluate(() => {
    const w = window as Window & { __getDecryptBridgeCallCount__?: () => number };
    return w.__getDecryptBridgeCallCount__?.() ?? -1;
  });
  expect(beforeForbidden).toBeGreaterThanOrEqual(3);

  const assigned = await page.evaluate(() => {
    const w = window as Window & { __setNappletClass__?: (dTag: string, cls: string | null) => boolean };
    return w.__setNappletClass__?.('decrypt-demo', 'class-2') ?? false;
  });
  expect(assigned).toBe(true);

  await frame.locator('#decrypt-class2-run').evaluate((button) => {
    (button as HTMLButtonElement).click();
  });
  await expect(frame.locator('#decrypt-class2-status')).toContainText('error:class-forbidden', { timeout: 8_000 });

  const afterForbidden = await page.evaluate(() => {
    const w = window as Window & { __getDecryptBridgeCallCount__?: () => number };
    return w.__getDecryptBridgeCallCount__?.() ?? -1;
  });
  expect(afterForbidden).toBe(beforeForbidden);
});
