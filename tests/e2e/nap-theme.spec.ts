/**
 * NAP-THEME browser contract — exercises the protected injected API in the
 * real playground rather than fabricating a parent result in the test harness.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach, getNappletFrame } from './helpers/index.js';

test.use({ baseURL: process.env.KEHTO_PLAYGROUND_BASE_URL ?? 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('nap-theme: the injected API exposes one complete get result and automatic changes only', async ({ page }) => {
  test.setTimeout(60_000);
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => consoleMessages.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await demoBeforeEach(page);
  const frame = await getNappletFrame(page, 'preferences-frame-container');
  if (!frame) throw new Error('preferences frame not found in page.frames()');

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
  expect(result.theme).toEqual({
    title: 'Dark',
    colors: { background: '#0a0a0a', text: '#e0e0e0', primary: '#7aa2f7' },
  });
  expect(consoleMessages.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
  expect(pageErrors.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
});
