import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for (const protocol of ['http', 'https']) {
  test(`shell event injection works on ${protocol} with native browser crypto capabilities`, async ({ page }) => {
    const origin = `${protocol}://shell-uuid.test`;
    await page.route(`${origin}/**`, async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname !== '/' && !/^\/assets\/[\w.-]+\.(js|css)$/.test(pathname)) {
        await route.abort();
        return;
      }
      const file = pathname === '/' ? 'index.html' : pathname.slice(1);
      const body = await readFile(new URL(`./harness/dist/${file}`, import.meta.url));
      const contentType = file.endsWith('.js') ? 'application/javascript'
        : file.endsWith('.css') ? 'text/css' : 'text/html';
      await route.fulfill({ contentType, body });
    });
    await page.goto(origin);
    await page.waitForFunction(() => window.__SHELL_READY__);
    const capabilities = await page.evaluate(() => {
      window.__getRelay__().injectEvent('uuid-browser-probe', { content: 'delivered' });
      return {
        secure: window.isSecureContext,
        randomUUID: typeof crypto.randomUUID,
        getRandomValues: typeof crypto.getRandomValues,
      };
    });
    expect(capabilities).toEqual({
      secure: protocol === 'https',
      randomUUID: protocol === 'https' ? 'function' : 'undefined',
      getRandomValues: 'function',
    });
  });
}
