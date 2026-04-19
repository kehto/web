import type { Page } from '@playwright/test';

/**
 * Wait until the runtime has acknowledged a napplet's AUTH handshake.
 *
 * Polls `window.__nappletReady__(windowId)` (installed in Plan 16-03) via
 * `page.waitForFunction`. Subsumes the "iframe mounted AND sessionRegistry
 * has a pubkey entry" readiness condition that naked frameLocator() misses.
 *
 * Prefer this helper over raw `page.frameLocator(...).locator(...)` for any
 * code that must interact with a sandboxed napplet iframe. See
 * .planning/research/PITFALLS.md Pitfall 1 for the failure mode this
 * helper prevents.
 *
 * @param page - Playwright Page instance.
 * @param windowId - The harness-assigned windowId returned by `window.__loadNapplet__`.
 * @param options - Optional Playwright waitForFunction options (timeout, polling).
 * @returns A Promise that resolves when __nappletReady__(windowId) === true.
 *
 * @example
 *   const wid = await page.evaluate(() => window.__loadNapplet__('nub-identity'));
 *   await waitForNappletReady(page, wid);
 *   // Safe to interact with the napplet now.
 */
export async function waitForNappletReady(
  page: Page,
  windowId: string,
  options?: { timeout?: number; polling?: number | 'raf' },
): Promise<void> {
  await page.waitForFunction(
    (wid: string) => {
      const fn = (window as unknown as { __nappletReady__?: (w: string) => boolean }).__nappletReady__;
      return typeof fn === 'function' && fn(wid) === true;
    },
    windowId,
    { timeout: options?.timeout ?? 15000, polling: options?.polling ?? 100 },
  );
}
