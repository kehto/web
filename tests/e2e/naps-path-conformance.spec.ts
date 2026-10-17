/**
 * naps-path-conformance.spec.ts — TERM-04 / G6.
 *
 * Proves the migrated playground exercises the host-owned injected-domain path
 * and the NAP-SHELL receiver when the host exposes it.
 *
 * Background (verified against the installed dist):
 *   - Kehto injects a srcdoc prelude that predeclares the verified manifest's
 *     bare required domains.
 *   - The host prelude filters assignments through the verified manifest allowlist,
 *     so non-required optional domains stay absent while this host exposes NAP-SHELL.
 *
 * Target: the migrated profile-viewer napplet (requires ['intent', 'relay',
 * 'resource', 'theme']). Asserting the namespace in-frame proves the host uses
 * the current NIP-5D availability primitive.
 *
 * Honors workers:1 (serial, no describe.configure parallel) and the reload-heavy
 * demo boot (test.setTimeout(120000)).
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

test('profile-viewer receives current injected window.napplet domain objects', async ({ page }) => {
  test.setTimeout(120_000);

  await demoBeforeEach(page);

  // Resolve the profile-viewer content frame (srcdoc -> opaque origin, so go via
  // the container element, not the URL), then wait until the host namespace is visible.
  await expect.poll(async () => {
    const handle = await page.locator('#profile-viewer-frame-container iframe').elementHandle();
    const frame = handle ? await handle.contentFrame() : null;
    if (!frame) return false;
    return frame.evaluate(() => {
      const w = window as Window & {
        napplet?: Record<string, unknown>;
      };
      return typeof w.napplet?.inc === 'object' &&
        typeof w.napplet?.relay === 'object' &&
        typeof w.napplet?.resource === 'object' &&
        typeof w.napplet?.theme === 'object';
    });
  }, { timeout: 30_000 }).toBe(true);

  const handle = await page.locator('#profile-viewer-frame-container iframe').elementHandle();
  expect(handle, 'profile-viewer iframe handle').not.toBeNull();
  const frame = await handle!.contentFrame();
  expect(frame, 'profile-viewer content frame').not.toBeNull();

  // Single evaluate → deterministic boolean shape under workers:1.
  const result = await frame!.evaluate(async () => {
    const w = window as Window & {
      napplet?: Record<string, unknown> & {
        shell?: {
          ready: () => Promise<unknown>;
          supports: (domain: string) => boolean;
          services: readonly string[];
          onReady: (handler: (environment: unknown) => void) => { close(): void };
        };
      };
      nostr?: unknown;
    };
    const namespaceKeys = Object.keys(w.napplet ?? {});
    const shell = w.napplet?.shell;
    await shell?.ready();
    return {
      namespaceKeys,
      incDomain: typeof w.napplet?.inc === 'object',
      relayDomain: typeof w.napplet?.relay === 'object',
      resourceDomain: typeof w.napplet?.resource === 'object',
      themeDomain: typeof w.napplet?.theme === 'object',
      shellDomain: typeof shell === 'object',
      shellApi: typeof shell?.ready === 'function' &&
        typeof shell?.supports === 'function' &&
        typeof shell?.onReady === 'function' &&
        Array.isArray(shell?.services),
      supportsArity: shell?.supports.length,
      nostrdbDomain: 'nostrdb' in (w.napplet ?? {}),
      injectedDomainSentinel: '__kehtoInjectedDomains' in (w.napplet ?? {}),
      nostrGlobal: typeof w.nostr !== 'undefined',
    };
  });

  expect(result.incDomain).toBe(true);
  expect(result.relayDomain).toBe(true);
  expect(result.resourceDomain).toBe(true);
  expect(result.themeDomain).toBe(true);
  expect(result.shellDomain).toBe(true);
  expect(result.shellApi).toBe(true);
  expect(result.supportsArity).toBe(1);
  expect(result.nostrdbDomain).toBe(false);
  expect(result.injectedDomainSentinel).toBe(false);
  expect(result.nostrGlobal).toBe(false);
  expect(result.namespaceKeys).toEqual(expect.arrayContaining(['shell', 'inc', 'relay', 'theme']));
});

test('feed and profile media receive the canonical unsupported-scheme result', async ({ page }) => {
  test.setTimeout(120_000);
  await demoBeforeEach(page);

  for (const containerId of ['feed-frame-container', 'profile-viewer-frame-container']) {
    const handle = await page.locator(`#${containerId} iframe`).elementHandle();
    expect(handle, `${containerId} iframe handle`).not.toBeNull();
    const frame = await handle!.contentFrame();
    expect(frame, `${containerId} iframe content`).not.toBeNull();

    const result = await frame!.evaluate(async () => {
      const resource = (window as Window & {
        napplet?: { resource?: { bytesMany(urls: readonly string[]): Promise<Array<{
          ok: boolean;
          blob?: Blob;
          error?: string;
        }>> } };
      }).napplet?.resource;
      if (!resource) throw new Error('resource capability unavailable');
      const items = await resource.bytesMany(['data:text/plain;base64,aGVsbG8=']);
      const first = items[0];
      return {
        count: items.length,
        ok: first?.ok,
        error: first?.error,
      };
    });

    expect(result).toEqual({ count: 1, ok: false, error: 'unsupported-scheme' });
  }
});
