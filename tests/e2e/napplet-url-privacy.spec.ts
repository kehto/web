/**
 * Embedding-URL privacy (kehto/web#381, napplet/evil finding #2): a napplet must not read the shell URL.
 *
 * NIP-5D (nostr-protocol/nips#2303 at f60550c) is silent on referrers and base URLs, so this is beyond-spec Kehto
 * host policy: `referrerpolicy="no-referrer"` on the napplet frame, `<meta name="referrer" content="no-referrer">`
 * and `<base href="./">` on the host page. Cross-engine measurements live in docs/policies/NIP-5D-CONFORMANCE.md
 * ("Embedding URL"); this spec pins the Chromium behavior through both Kehto host paths.
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { expect, test, type Frame, type Page } from '@playwright/test';
import { createPajaRuntimeHostConfig, renderPajaHtml } from '../../packages/paja/dist/index.js';
import { installPajaApprovalDriver } from './paja-approval-driver.js';
import { waitForNappletReady } from './helpers/wait-for-napplet-ready.js';

const PROBE = `<!doctype html><html><head><title>url probe</title></head><body><pre id="probe">pending</pre><script>
  document.getElementById('probe').textContent = JSON.stringify({ referrer: document.referrer, baseURI: document.baseURI });
</script></body></html>`;

async function readProbe(frame: Frame): Promise<{ referrer: string; baseURI: string }> {
  await expect(frame.locator('#probe')).not.toHaveText('pending');
  return JSON.parse(await frame.locator('#probe').innerText()) as { referrer: string; baseURI: string };
}

function napplet(page: Page): Frame {
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  if (!frame) throw new Error('napplet frame missing');
  return frame;
}

test('Paja napplets read neither the shell URL referrer nor its query and fragment', async ({ page }) => {
  await installPajaApprovalDriver(page);
  const browserHost = readFileSync(new URL('../../packages/paja/dist/browser-host.js', import.meta.url), 'utf8');
  const config = createPajaRuntimeHostConfig({ maxWaitMs: 2_000 });
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    const body = path === '/' ? renderPajaHtml(config)
      : path === '/__kehto/config.json' ? JSON.stringify(config)
        : path === '/__kehto/browser-host.js' ? browserHost : null;
    response.writeHead(body === null ? 404 : 200, {
      'content-type': path === '/' ? 'text/html' : path.endsWith('.json') ? 'application/json' : 'text/javascript',
    });
    response.end(body ?? 'Not found');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    await page.goto(`${origin}/?probe=SHELL-SECRET#shell-fragment`);
    await page.locator('#runtime-local-file').setInputFiles({ name: 'url-probe.html', mimeType: 'text/html', buffer: Buffer.from(PROBE) });
    await expect(page.locator('iframe').first()).toHaveAttribute('referrerpolicy', 'no-referrer');
    const seen = await readProbe(napplet(page));
    expect(seen.referrer).toBe('');
    expect(seen.baseURI).toBe(`${origin}/`);
    expect(JSON.stringify(seen)).not.toContain('SHELL-SECRET');
    expect(JSON.stringify(seen)).not.toContain('shell-fragment');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('e2e harness napplets get an empty referrer', async ({ page }) => {
  await page.goto('/?probe=HARNESS-SECRET');
  await page.waitForFunction(() => window.__SHELL_READY__ === true);
  const windowId = await page.evaluate(() => window.__loadNapplet__('nap-relay'));
  await waitForNappletReady(page, windowId);
  await expect(page.locator(`iframe[id="${windowId}"]`)).toHaveAttribute('referrerpolicy', 'no-referrer');
  const referrer = await napplet(page).evaluate(() => document.referrer);
  expect(referrer).toBe('');
});
