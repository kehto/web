import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { createPajaRuntimeHostConfig, renderPajaHtml } from '../../packages/paja/dist/index.js';

const config = createPajaRuntimeHostConfig({ simulation: { relay: { mode: 'memory' } } });
const script = readFileSync(new URL('../../packages/paja/dist/browser-host.js', import.meta.url), 'utf8');

for (const width of [640, 1280, 2520]) {
  test(`saved collapsed console keeps its recovery control onscreen at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem('kehto:paja:console:v1', 'collapsed'));
    await page.route('http://paja.test/web/paja/**', (route) => route.fulfill({
      contentType: route.request().url().endsWith('.js') ? 'text/javascript' : 'text/html',
      body: route.request().url().endsWith('.js') ? script : renderPajaHtml(config),
    }));
    await page.goto('http://paja.test/web/paja/');
    await expect(page.locator('html')).toHaveAttribute('data-paja-console', 'collapsed');
    await expect(page.locator('#paja-console')).toBeHidden();
    await expect(page.locator('.empty-stage')).toBeVisible();
    await page.mouse.move(width / 2, 450);

    const toggle = page.getByRole('button', { name: 'Expand the Paja development console' });
    // Visibility alone accepts an offscreen element, and clicking can focus it
    // into view. Check reachability before either scrolling or focusing it.
    await expect(toggle).toBeInViewport({ ratio: 1 });
    await expect(toggle.locator('..')).toHaveCSS('opacity', '1');
    await toggle.click();
    await expect(page.locator('#paja-console')).toBeVisible();
    await expect(page.locator('#runtime-pointer-input')).toBeVisible();
    expect(await page.locator('iframe').count()).toBe(0);
  });
}
