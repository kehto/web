import type { Frame, Page } from '@playwright/test';

/**
 * Resolve the {@link Frame} for a playground napplet by its container element id.
 *
 * Napplets load via `iframe.srcdoc` (opaque origin), so the frame URL is
 * `about:srcdoc` for every napplet — `page.frames().find(f => f.url()...)` can no
 * longer distinguish them. Resolve by the container element instead.
 *
 * @param page - Playwright page
 * @param containerId - The frame container element id (e.g. `composer-frame-container`)
 * @returns The napplet's Frame, or `null` if the iframe is not present yet
 */
export async function getNappletFrame(page: Page, containerId: string): Promise<Frame | null> {
  const handle = await page.locator(`#${containerId} iframe`).elementHandle();
  if (!handle) return null;
  return handle.contentFrame();
}
