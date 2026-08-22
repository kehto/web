/**
 * E2E-25 (resource demo shape) — the resource napplet shows a remote image
 * loaded through the shell's resource service rather than debug output.
 */
import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://localhost:4174' });

const CORS_REDIRECT_URL = 'http://localhost:4173/resource-cors/redirect.png';
const CORS_FINAL_URL = 'http://localhost:4173/resource-cors/final.png';

test('resource demo loads and renders a remote image', async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto('/');
  await expect(page.locator('#resource-demo-frame-container iframe')).toHaveCount(1, { timeout: 25_000 });

  const resourceFrame = page.frameLocator('#resource-demo-frame-container iframe');
  const image = resourceFrame.locator('#resource-demo-image');
  const status = resourceFrame.locator('#resource-demo-status');
  const source = resourceFrame.locator('#resource-demo-source');
  const bulk = resourceFrame.locator('#resource-demo-bulk');

  await expect(status).toContainText(/^(loading remote images|loaded remote images)/, { timeout: 10_000 });
  await expect(source).toContainText('raw.githubusercontent.com', { timeout: 10_000 });
  await expect(bulk).toContainText(/^(bulk loading|bulk loaded 2\/2)/, { timeout: 10_000 });
  await expect(image).toHaveAttribute('src', /^(blob:|https:\/\/raw\.githubusercontent\.com)/, { timeout: 15_000 });
  await expect.poll(async () => {
    return resourceFrame.locator('#resource-demo-image').evaluate((el) => {
      const img = el as HTMLImageElement;
      return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
    });
  }, { timeout: 15_000 }).toBe(true);
  await expect(resourceFrame.locator('#resource-demo-granted')).toHaveCount(0);
  await expect(resourceFrame.locator('#resource-demo-denied')).toHaveCount(0);
  await expect(resourceFrame.locator('#resource-demo-log')).toHaveCount(0);
});

test('static browser delegates HTTP(S) to the runtime resolver when CORS visibility differs', async ({ page }) => {
  await page.goto('/');

  const browserEvidence = await page.evaluate(async ({ redirectUrl, finalUrl }) => {
    const image = await new Promise<{ ok: boolean; width?: number; height?: number }>((resolve) => {
      const element = new Image();
      element.onload = () => resolve({
        ok: true,
        width: element.naturalWidth,
        height: element.naturalHeight,
      });
      element.onerror = () => resolve({ ok: false });
      element.src = redirectUrl;
    });

    const read = async (url: string) => {
      try {
        const response = await fetch(url);
        return {
          ok: true,
          status: response.status,
          bytes: (await response.arrayBuffer()).byteLength,
        };
      } catch (error: unknown) {
        return {
          ok: false,
          name: error instanceof Error ? error.name : typeof error,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    };

    return {
      image,
      redirectFetch: await read(redirectUrl),
      finalFetch: await read(finalUrl),
    };
  }, { redirectUrl: CORS_REDIRECT_URL, finalUrl: CORS_FINAL_URL });

  expect(browserEvidence.image).toMatchObject({ ok: true, width: 1, height: 1 });
  expect(browserEvidence.redirectFetch).toMatchObject({
    ok: false,
    name: 'TypeError',
  });
  expect(browserEvidence.finalFetch).toMatchObject({
    ok: true,
    status: 200,
  });
  expect('bytes' in browserEvidence.finalFetch && browserEvidence.finalFetch.bytes).toBeGreaterThan(0);

  await expect(page.locator('#resource-demo-frame-container iframe')).toHaveCount(1, { timeout: 25_000 });
  const resourceFrame = page.frameLocator('#resource-demo-frame-container iframe');
  const envelopes = await resourceFrame.locator('body').evaluate(async (_body, urls) => {
    const request = (url: string) => {
      const id = `cors-regression-${crypto.randomUUID()}`;
      return new Promise<Record<string, unknown>>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          window.removeEventListener('message', onMessage);
          reject(new Error('resource.bytes response timed out'));
        }, 10_000);
        const onMessage = (event: MessageEvent) => {
          if (event.source !== window.parent) return;
          const message = event.data as Record<string, unknown> | null;
          if (!message || message.id !== id) return;
          window.clearTimeout(timeout);
          window.removeEventListener('message', onMessage);
          const blob = message.blob;
          resolve({
            type: message.type,
            error: message.error,
            message: message.message,
            mime: message.mime,
            blobSize: blob instanceof Blob ? blob.size : undefined,
          });
        };
        window.addEventListener('message', onMessage);
        window.parent.postMessage({ type: 'resource.bytes', id, url }, '*');
      });
    };

    return {
      redirect: await request(urls.redirect),
      final: await request(urls.final),
    };
  }, { redirect: CORS_REDIRECT_URL, final: CORS_FINAL_URL });

  expect(envelopes.redirect).toMatchObject({
    type: 'resource.bytes.error',
    error: 'network-error',
  });
  expect(envelopes.final).toMatchObject({
    type: 'resource.bytes.result',
    mime: 'image/png',
  });
  expect(envelopes.final.blobSize).toBeGreaterThan(0);
});
