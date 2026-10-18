import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { createPajaRuntimeHostConfig, renderPajaHtml } from '../../packages/paja/dist/index.js';

const config = createPajaRuntimeHostConfig({ simulation: { relay: { mode: 'memory' } } });
const script = readFileSync(new URL('../../packages/paja/dist/browser-host.js', import.meta.url), 'utf8');

type Pad = { index: number; id: string; connected: boolean; axes: number[]; buttons: { pressed: boolean; value: number }[] };
const pad = (index: number): Pad => ({ index, id: 'Same model <controller>', connected: true, axes: [0, 0], buttons: [{ pressed: false, value: 0 }] });

async function openHost(page: Page, mode: 'normal' | 'blocked' | 'missing' = 'normal') {
  await page.addInitScript((access) => {
    let slots: unknown[] = [];
    const host = window as unknown as { setTestPads(pads: unknown[]): void };
    host.setTestPads = (pads) => { slots = pads; window.dispatchEvent(new Event('gamepadconnected')); };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: access === 'missing' ? undefined : () => {
      if (access === 'blocked') throw new DOMException('Denied', 'SecurityError');
      return slots;
    } });
  }, mode);
  await page.route('http://paja.test/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({
      contentType: path.endsWith('.js') ? 'text/javascript' : path.endsWith('.json') ? 'application/json' : 'text/html',
      body: path.endsWith('.js') ? script : path.endsWith('.json') ? JSON.stringify(config) : renderPajaHtml(config),
    });
  });
  await page.goto('http://paja.test');
  await expect(page.locator('#paja-console-toggle')).toBeVisible();
}

async function setPads(page: Page, pads: (Pad | null)[]) {
  await page.evaluate((slots) => (window as unknown as { setTestPads(pads: unknown[]): void }).setTestPads(slots), pads);
}

test('sparse same-model controllers have stable identities and independent live input', async ({ page }) => {
  await openHost(page);
  const icons = page.locator('.gamepad-indicator');
  await expect(icons).toHaveCount(0);
  await setPads(page, [pad(0), null, pad(2)]);
  await expect(icons).toHaveCount(2);
  const first = page.locator('[data-gamepad-index="0"]');
  const third = page.locator('[data-gamepad-index="2"]');
  await expect(first).toHaveAccessibleName('Controller 1: Same model <controller> — idle');
  await expect(third.locator('small')).toHaveText('3');
  const appearance = await icons.evaluateAll((nodes) => nodes.map((node) => ({
    color: getComputedStyle(node).color,
    duration: (node as HTMLElement).style.getPropertyValue('--pad-duration'),
    turn: (node as HTMLElement).style.getPropertyValue('--pad-turn'),
  })));
  expect(appearance[0]).not.toEqual(appearance[1]);
  expect(appearance[0].color).not.toBe(appearance[1].color);
  expect(appearance[0].duration).not.toBe(appearance[1].duration);
  expect(appearance[0].turn).not.toBe(appearance[1].turn);
  // Actual display-frame polling must notice input without a connection event.
  await page.evaluate((slots) => {
    (window as unknown as { setTestPads(pads: unknown[]): void }).setTestPads(slots);
    const nativeRead = navigator.getGamepads;
    let reads = 0;
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => {
      const pads = nativeRead();
      if (++reads > 2 && pads[2]) Object.assign(pads[2], { axes: [0.8, 0] });
      return pads;
    } });
  }, [pad(0), null, pad(2)]);
  await expect(third).toHaveAttribute('data-activity', 'active');
  await expect(first).toHaveAttribute('data-activity', 'idle');
  expect(await third.locator('svg').evaluate((svg) => getComputedStyle(svg).animationName)).toBe('gamepad-input');
  await setPads(page, [pad(0)]);
  await expect(icons).toHaveCount(1);
  expect(await first.evaluate((node) => getComputedStyle(node).color)).toBe(appearance[0].color);
  await setPads(page, [{ ...pad(0), axes: [0.03, -0.08] }]);
  await expect(first).toHaveAttribute('data-activity', 'idle');
  await setPads(page, [{ ...pad(0), buttons: [{ pressed: true, value: 1 }] }]);
  await expect(first).toHaveAttribute('data-activity', 'active');
  await setPads(page, [pad(0)]);
  await expect(first).toHaveAttribute('data-activity', 'active');
  await expect(first).toHaveAttribute('data-activity', 'idle');
  expect(await first.evaluate((node) => node.previousElementSibling?.id ?? node.parentElement?.previousElementSibling?.id)).toBe('paja-console-toggle');
});

test('reduced motion preserves activity; hidden hosts go idle and pagehide disposes the monitor', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHost(page);
  await setPads(page, [{ ...pad(1), buttons: [{ pressed: false, value: 0.6 }] }]);
  const icon = page.locator('.gamepad-indicator');
  await expect(icon).toHaveAttribute('data-activity', 'active');
  expect(await icon.locator('svg').evaluate((svg) => getComputedStyle(svg).animationName)).toBe('none');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false });
    window.dispatchEvent(new Event('blur'));
  });
  await expect(icon).toHaveAttribute('data-activity', 'idle');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => true });
    window.dispatchEvent(new Event('focus'));
  });
  await expect(icon).toHaveAttribute('data-activity', 'active');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(icon).toHaveAttribute('data-activity', 'idle');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(icon).toHaveAttribute('data-activity', 'active');
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect(icon).toHaveCount(0);
  await setPads(page, [pad(0)]);
  await page.waitForTimeout(100);
  await expect(icon).toHaveCount(0);
});

for (const mode of ['missing', 'blocked'] as const) {
  test(`${mode} native access leaves the toolbar usable`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openHost(page, mode);
    await setPads(page, [pad(0)]);
    await expect(page.locator('.gamepad-indicator')).toHaveCount(0);
    await page.locator('#paja-console-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-paja-console', 'collapsed');
    expect(errors).toEqual([]);
  });
}
