/**
 * demo-before-each.ts — Canonical per-test setup for demo-targeted specs (:4174).
 *
 * Parallels aclBeforeEach (which targets the harness at :4173). The demo does
 * NOT expose `window.__SHELL_READY__`; instead we wait for a demo DOM sentinel
 * (`#topology-root`) as the "demo ready" signal.
 *
 * Do NOT use this helper against the harness — it lacks the ACL clearing logic
 * because the demo has no `__aclClear__` global.
 *
 * @param page - Playwright Page instance (must already be configured with baseURL :4174).
 * @param options - Optional { topologyReadyTimeoutMs } (default 15000).
 */
import type { Page } from '@playwright/test';

export async function demoBeforeEach(
  page: Page,
  options?: { topologyReadyTimeoutMs?: number },
): Promise<void> {
  const timeout = options?.topologyReadyTimeoutMs ?? 15000;
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* best-effort */ } });
  // Second goto ensures clean module state after localStorage.clear
  await page.goto('/');
  // #topology-root is rendered dynamically by renderDemoTopology() into #topology-pane
  await page.waitForSelector('#topology-root', { state: 'visible', timeout });
  // Wait for at least one service node to render (demo booted + topology built)
  await page.waitForFunction(
    () => document.querySelectorAll('[data-service-name]').length >= 1,
    undefined,
    { timeout: 5000 },
  );
}
