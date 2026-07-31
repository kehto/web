/**
 * Phase 42 / Plan 42-01 / BUG-02 — topology connector lines regression.
 *
 * BUG-01 was fixed in commit `4f02c1e` by vendoring `leader-line.min.js`
 * to `apps/playground/public/vendor/` and updating the script tag in
 * `apps/playground/index.html` to reference `/vendor/leader-line.min.js`
 * (was `/node_modules/leader-line/leader-line.min.js` which 404'd under
 * `pnpm preview` because Vite's static server does not serve node_modules).
 *
 * This spec prevents recurrence: it asserts `window.LeaderLine` is defined
 * (UMD loaded) AND at least one `svg.leader-line` element exists in the DOM
 * after the topology renders against the built `:4174` preview.
 *
 * Loose count ("≥1") rather than "==N" — the edge count grows as v1.8 adds
 * demo napplets and would falsely fail if pinned to today's number.
 *
 * Canonical UMD location: `apps/playground/public/vendor/leader-line.min.js`.
 */
import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://localhost:4174' });

test.describe('topology connector lines (BUG-01/BUG-02)', () => {
  test('leader-line UMD loaded and ≥1 connector line element rendered', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect
      .poll(
        async () => page.evaluate(() => typeof (window as unknown as { LeaderLine?: unknown }).LeaderLine !== 'undefined'),
        { timeout: 20_000 },
      )
      .toBe(true);

    await expect
      .poll(
        async () => page.evaluate(() => document.querySelectorAll('svg.leader-line').length),
        { timeout: 20_000 },
      )
      .toBeGreaterThanOrEqual(1);
  });

  test('clips body-level connector SVGs to the topology scroll canvas', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect
      .poll(
        async () => page.evaluate(() => document.querySelectorAll('svg.leader-line').length),
        { timeout: 20_000 },
      )
      .toBeGreaterThanOrEqual(1);

    const initial = await page.evaluate(() => {
      const pane = document.getElementById('topology-pane');
      if (!pane) return null;
      const paneRect = pane.getBoundingClientRect();
      const lines = [...document.querySelectorAll<SVGSVGElement>('svg.leader-line')];
      return {
        hasOffCanvasLine: lines.some((line) => line.getBoundingClientRect().bottom > paneRect.bottom),
        allClipped: lines.every((line) => line.style.clipPath.startsWith('inset(')),
      };
    });

    expect(initial).toEqual({ hasOffCanvasLine: true, allClipped: true });

    await page.evaluate(async () => {
      const pane = document.getElementById('topology-pane');
      pane?.scrollTo({ top: 220 });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });

    await expect
      .poll(
        async () => page.evaluate(() =>
          [...document.querySelectorAll<SVGSVGElement>('svg.leader-line')]
            .every((line) => line.style.clipPath.startsWith('inset('))),
      )
      .toBe(true);
  });
});
