/**
 * Opt-in red-team gate: runs the napplet/evil suite (https://github.com/napplet/evil) against Paja.
 *
 * Skipped unless `KEHTO_EVIL_SUITE_DIR` points at a local checkout. Nothing here fetches the suite, and CI never sets
 * the variable. The suite is hostile code, so this runner only reads its prebuilt `napplets/<id>/index.html` files
 * (never its build scripts) and loads each one through Paja's local-file loader: the production NIP-5D path with the
 * napplet CSP, injected `window.napplet`, `sandbox="allow-scripts"` srcdoc and a real ShellBridge. The browser has no
 * signer and no keys, relays and uploads are disabled, and every request Playwright can route that does not target
 * the Paja test server is aborted. Routing does not see browser-initiated resource hints (prerender, preconnect,
 * dns-prefetch), and Playwright's default context runs with network prediction off, so this runner cannot observe
 * hint egress; tests/e2e/shell-resource-hints.spec.ts covers that. The collector stays unreachable because
 * `evil.example.invalid` is a non-resolving RFC 2606 name, plus the routing above.
 *
 * Demo mode only. The runner never arms the suite's "VERY EVIL" mode. The one active step is `evil-09`'s
 * operator-triggered self-replacement, the suite's own regression gate for kehto/web#378.
 *
 * Set `KEHTO_EVIL_SUITE_OUT` to a file path to append each napplet's per-row results as one JSON line.
 * Set `KEHTO_EVIL_SUITE_LOCK` to `on`, `off` or `auto` (default) to choose Paja's experimental nested-context lock.
 */
import { appendFileSync, readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { expect, test, type Frame, type Page } from '@playwright/test';
import { createPajaRuntimeHostConfig, renderPajaHtml } from '../../packages/paja/dist/index.js';
import { installPajaApprovalDriver } from './paja-approval-driver.js';

const SUITE_DIR = process.env.KEHTO_EVIL_SUITE_DIR;
const OUT_FILE = process.env.KEHTO_EVIL_SUITE_OUT;
const LOCK = (['on', 'off', 'auto'] as const).find((value) => value === process.env.KEHTO_EVIL_SUITE_LOCK) ?? 'auto';

/**
 * Rows allowed to report `armed`, each a documented residual in docs/policies/NIP-5D-CONFORMANCE.md
 * ("Red-team residuals"). Anything else armed fails the gate.
 */
const DOCUMENTED_RESIDUALS: Readonly<Record<string, readonly string[]>> = {
  // Passive fingerprinting: NIP-5D makes no promise here.
  'evil-07-fingerprint': ['core-id', 'hardware', 'display', 'locale-tz', 'fonts', 'media-devices', 'gpu', 'network-class', 'shell-composition'],
  // NIP-5D's baseline CSP grants 'wasm-unsafe-eval' and makes no timer promise.
  'evil-08-wasm-timing': ['wasm-compile', 'timer-resolution'],
  // Grandchild-realm WebRTC is closed only by the opt-in nested-context lock.
  ...(LOCK === 'on' ? {} : { 'evil-02-csp-egress': ['webrtc-grandchild'] }),
};

interface RowResult { readonly status: string; readonly evidence: string }
interface NappletRun {
  readonly id: string;
  readonly rows: Record<string, RowResult>;
  readonly revocations: readonly string[];
  readonly collectorConsole: readonly string[];
  readonly abortedRequests: readonly string[];
}

test.describe('napplet/evil red-team suite (opt-in)', () => {
  test.skip(!SUITE_DIR, 'Set KEHTO_EVIL_SUITE_DIR to a local napplet/evil checkout to run the red-team suite.');
  test.beforeEach(async ({ page }) => installPajaApprovalDriver(page));

  for (const id of SUITE_DIR ? listNapplets(SUITE_DIR) : []) {
    test(`${id} holds in demo mode`, async ({ page }) => {
      test.setTimeout(90_000);
      const html = readFileSync(join(SUITE_DIR!, 'napplets', id, 'index.html'));
      const run = await runNapplet(page, id, html);
      if (OUT_FILE) appendFileSync(OUT_FILE, `${JSON.stringify({ lock: LOCK, ...run })}\n`);
      const allowed = new Set(DOCUMENTED_RESIDUALS[id] ?? []);
      const unexpected = Object.entries(run.rows).filter(([row, result]) => result.status === 'armed' && !allowed.has(row));
      expect(unexpected.map(([row, result]) => `${row}: ${result.evidence}`)).toEqual([]);
      if (id === 'evil-09-self-replacement') expect(run.revocations.length).toBeGreaterThan(0);
    });
  }
});

function listNapplets(dir: string): string[] {
  return readdirSync(join(dir, 'napplets'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^evil-\d{2}-[a-z0-9-]+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

async function runNapplet(page: Page, id: string, html: Buffer): Promise<NappletRun> {
  const server = await startPajaServer();
  const collectorConsole: string[] = [];
  const abortedRequests: string[] = [];
  page.on('console', (message) => {
    if (/evil\.example\.invalid/.test(message.text())) collectorConsole.push(message.text().slice(0, 240));
  });
  await page.context().route('**/*', (route) => {
    if (route.request().url().startsWith(server.url)) return route.continue();
    abortedRequests.push(route.request().url().slice(0, 160));
    return route.abort('blockedbyclient');
  });
  try {
    await page.goto(server.url);
    // Paja publishes __KEHTO_PAJA__ in the same tick it installs the file-input
    // listener, so an earlier upload is silently dropped (kehto/web#525).
    await page.waitForFunction(() => window.__KEHTO_PAJA__ !== undefined, undefined, { timeout: 15_000 });
    await page.locator('#runtime-local-file').setInputFiles({ name: `${id}.html`, mimeType: 'text/html', buffer: html });
    const frame = await waitForSuiteFrame(page);
    let rows = frame ? await settledRows(frame) : {};
    if (frame && id === 'evil-09-self-replacement') {
      // The suite's sanctioned active step: replace the verified document and expect revocation.
      await frame.locator('button[data-probe="self-replace"]').click();
      await expect.poll(() => revocations(page), { timeout: 15_000 }).not.toEqual([]);
      // Caught means torn down, not only logged: the tab goes to error and the attacker frame is gone.
      await expect.poll(() => page.evaluate(() => window.__KEHTO_PAJA__?.getState().tabs[0]?.status), { timeout: 15_000 }).toBe('error');
      await expect.poll(() => frame.isDetached(), { timeout: 15_000 }).toBe(true);
      rows = { ...rows, 'self-replace': { status: 'detonated', evidence: 'operator-triggered self-replacement' } };
    }
    return { id, rows, revocations: await revocations(page), collectorConsole, abortedRequests };
  } finally {
    await server.close();
  }
}

/** The napplet frame once the suite chrome rendered, or null when Paja revoked it before that. */
async function waitForSuiteFrame(page: Page): Promise<Frame | null> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      const ready = await frame.evaluate(() => Boolean(document.querySelector('.attack'))).catch(() => false);
      if (ready) return frame;
    }
    if ((await revocations(page)).length) return null;
    await page.waitForTimeout(150);
  }
  return null;
}

/**
 * Read every row until the auto-run sweep settles (no row `pending`). Paja removes a revoked frame, so the last
 * snapshot taken before removal is what the napplet reported up to its revocation.
 */
async function settledRows(frame: Frame): Promise<Record<string, RowResult>> {
  let last: Record<string, RowResult> = {};
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const snapshot = await frame.evaluate(() => Object.fromEntries([...document.querySelectorAll<HTMLElement>('.attack')].map((row) => [
      row.dataset.attack ?? '?',
      { status: row.dataset.status ?? 'unknown', evidence: (row.querySelector('.evidence')?.textContent ?? '').slice(0, 240) },
    ]))).catch(() => null);
    if (!snapshot) return last;
    last = snapshot;
    if (Object.values(last).every((row) => row.status !== 'pending')) return last;
    await frame.page().waitForTimeout(100);
  }
  return last;
}

/** Revocation reasons Paja logged, e.g. `window-message` or `second-load`. */
async function revocations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window.__KEHTO_PAJA__?.getState().messageLog ?? [])
    .filter((entry) => entry.type === 'paja.napplet.revoked')
    .map((entry) => /"reason":"([a-z-]+)"/.exec(String(entry.preview))?.[1] ?? 'unknown'));
}

async function startPajaServer(): Promise<{ readonly url: string; close(): Promise<void> }> {
  const browserHost = readFileSync(new URL('../../packages/paja/dist/browser-host.js', import.meta.url), 'utf8');
  const config = createPajaRuntimeHostConfig({
    maxWaitMs: 2_000,
    experimental: { nestedContextLock: LOCK },
    simulation: {
      relay: { mode: 'disabled' },
      upload: { mode: 'disabled' },
      capabilities: { domains: { relay: false, outbox: false, upload: false } },
    },
  });
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    const body = path === '/' ? renderPajaHtml(config)
      : path === '/__kehto/config.json' ? JSON.stringify(config)
        : path === '/__kehto/browser-host.js' ? browserHost : null;
    const type = path === '/' ? 'text/html' : path.endsWith('.json') ? 'application/json' : 'text/javascript';
    response.writeHead(body === null ? 404 : 200, { 'content-type': `${type}; charset=utf-8` });
    response.end(body ?? 'Not found');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Paja test server did not bind a TCP port.');
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
  };
}
