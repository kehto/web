/**
 * acl-beforeEach.ts — canonical per-test setup for ACL-touching Playwright specs.
 *
 * WHY page.reload() IS BANNED (read before touching this file):
 *
 *   The harness's `originRegistry` is a module-level singleton
 *   (packages/shell/src/origin-registry.ts). `page.reload()` reuses the same
 *   JavaScript context and therefore does NOT reset that singleton — ACL
 *   entries and session state from a previous test persist in memory even
 *   after `__aclClear__()` if the page object is reused.
 *
 *   `page.goto('/')` — by contrast — forces a fresh navigation, which
 *   re-executes the harness module and recreates all singletons. This is the
 *   ONLY correct way to reset harness state between ACL-touching tests.
 *
 *   See .planning/research/PITFALLS.md Pitfall 5 for the full failure mode
 *   (ACL state bleed via localStorage + module-level Map singletons).
 *
 *   v1.4 will add an ESLint rule enforcing the ban; v1.3 is doc-comment only.
 */
import type { Page } from '@playwright/test';

/**
 * Canonical ACL-clean beforeEach setup.
 *
 * Sequence (strict order — do NOT reorder):
 *   1. page.goto('/')                 — forces a fresh JS context (singleton reset).
 *   2. wait for window.__SHELL_READY__ — harness booted, __aclClear__ is installed.
 *   3. window.__aclClear__()          — clears the in-memory ACL store.
 *   4. window.__clearLocalStorage__() — clears the persistence layer (npl:acl key).
 *
 * Calling this helper twice in one test is safe but wasteful — it is designed to
 * be called ONCE inside a Playwright test.beforeEach hook.
 *
 * @param page - Playwright Page instance.
 * @param options - Optional { shellReadyTimeoutMs } (default 10000).
 *
 * @example
 *   test.beforeEach(async ({ page }) => {
 *     await aclBeforeEach(page);
 *     // Test-specific setup (napplet load, AUTH OK wait) follows here.
 *   });
 */
export async function aclBeforeEach(
  page: Page,
  options?: { shellReadyTimeoutMs?: number },
): Promise<void> {
  const timeout = options?.shellReadyTimeoutMs ?? 10000;
  await page.goto('/');
  await page.waitForFunction(
    () => (window as unknown as { __SHELL_READY__?: boolean }).__SHELL_READY__ === true,
    { timeout },
  );
  await page.evaluate(() => (window as unknown as { __aclClear__: () => void }).__aclClear__());
  await page.evaluate(() => (window as unknown as { __clearLocalStorage__: () => void }).__clearLocalStorage__());
}
