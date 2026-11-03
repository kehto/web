/**
 * NAP-THEME browser contract — exercises the protected injected API inside the
 * fixture-nap-theme napplet hosted by the e2e harness (real runtime + shell),
 * rather than fabricating a parent result in the test.
 */
import { test, expect } from '@playwright/test';
import { aclBeforeEach } from './helpers/index.js';

test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('nap-theme: the injected API exposes one complete get result and automatic changes only', async ({ page }) => {
  test.setTimeout(30_000);
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => consoleMessages.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await aclBeforeEach(page);
  const windowId = await page.evaluate(() => window.__loadNapplet__('nap-theme'));
  // The theme-only fixture sends no wire message before theme.get, so the
  // runtime session registers on that call; wait for the fixture DOM instead.
  await expect(page.frameLocator(`#${windowId}`).locator('#nap-status')).toHaveText('ready', { timeout: 15_000 });

  const handle = await page.locator(`#${windowId}`).elementHandle();
  const frame = await handle?.contentFrame();
  if (!frame) throw new Error('nap-theme fixture frame not found');

  const result = await frame.evaluate(async () => {
    const theme = (window as Window & {
      napplet?: { theme?: Record<string, unknown> & { get?: () => Promise<unknown> } };
    }).napplet?.theme;
    return {
      api: {
        get: typeof theme?.get,
        onChanged: typeof theme?.onChanged,
        subscribe: typeof theme?.subscribe,
        unsubscribe: typeof theme?.unsubscribe,
      },
      theme: await theme?.get?.(),
    };
  });

  expect(result.api).toEqual({ get: 'function', onChanged: 'function', subscribe: 'undefined', unsubscribe: 'undefined' });
  expect(result.theme).toMatchObject({
    colors: { background: '#0a0a0a', text: '#e0e0e0', primary: '#7aa2f7' },
  });
  expect(consoleMessages.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
  expect(pageErrors.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
});
