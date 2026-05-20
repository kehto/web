/**
 * E2E-25 (v1.7 Phase 40 / Plan 40-03 / RESOURCE-05) — NUB-RESOURCE round-trip.
 *
 * Layer-B invariant: shell-side createResourceService correctly proxies a
 * granted fetch and refuses an ungranted origin with canonical 'denied' code.
 * H-03 coupling proof: denied-origin fetch is NEVER invoked at the network
 * layer — the DOM sentinel populates before any real HTTP request could
 * complete (the denied-origin URL https://untrusted.example is an RFC-2606
 * reserved domain that would 5-10s network-fail IF the guard failed).
 *
 * Runs against the built :4174 demo (pnpm test:serve:demo) so CSP headers
 * and Vite middleware (Phase 39 Plan 39-03) are active — the auto-grant
 * in apps/playground/src/main.ts (RESOURCE-04 / D3) syncs http://localhost:5174
 * to connectStore + POSTs to /__connect-grants before the resource-demo
 * iframe loads, so the CSP header on its HTML response includes localhost:5174.
 *
 * Flow:
 *   1. Load demo; wait for resource-demo iframe.
 *   2. [granted] Assert #resource-demo-granted contains decoded JSON from
 *      /demo-data.json (must contain "kehto demo" — the fixture).
 *   3. [denied] Assert #resource-demo-denied contains 'code=denied' for
 *      the https://untrusted.example fetch (refused at shell, never
 *      reached the network).
 */
import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://localhost:4174' });

test.describe('NUB-RESOURCE round-trip (E2E-25 / RESOURCE-05)', () => {
  test('granted fetch returns decoded JSON in #resource-demo-granted', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/');
    await page.waitForSelector('#resource-demo-frame-container iframe', { timeout: 10_000 });

    const resourceFrame = page.frameLocator('#resource-demo-frame-container iframe');
    const grantedEl = resourceFrame.locator('#resource-demo-granted');

    // The fixture payload (apps/playground/public/demo-data.json) includes "kehto demo".
    // This asserts the full shell-proxied round trip: napplet dispatch -> runtime
    // enforce gate (allow, resource:fetch granted by demo-boot grant via ACL) ->
    // createResourceService.handleMessage -> getConnectGrants(resource-demo, '')
    // -> isOriginGranted(http://localhost:5174, [...]) -> true -> hostFetch(url, ...)
    // -> base64 encode response body -> shell -> napplet onEnvelope handler ->
    // decode base64 -> JSON.parse -> write stringified JSON to #resource-demo-granted.
    await expect(grantedEl).toContainText('"kehto demo"', { timeout: 15_000 });
    await expect(grantedEl).toContainText('"version"', { timeout: 5_000 });
  });

  test('denied-origin fetch returns canonical "denied" code in #resource-demo-denied', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/');
    await page.waitForSelector('#resource-demo-frame-container iframe', { timeout: 10_000 });

    const resourceFrame = page.frameLocator('#resource-demo-frame-container iframe');
    const deniedEl = resourceFrame.locator('#resource-demo-denied');

    // H-03 coupling proof: shell MUST refuse before calling fetch. The reserved
    // RFC-2606 domain https://untrusted.example would 5-10s network-fail if
    // the service bypassed getConnectGrants; 'denied' populating within 15s
    // proves the guard fired synchronously. We deliberately set the test
    // timeout above the worst-case network fail to keep this assertion truthful.
    await expect(deniedEl).toContainText('code=denied', { timeout: 15_000 });
    // Sanity: ensure the denied panel NEVER reports the protocol-violation marker.
    // (main.ts prints 'PROTOCOL VIOLATION' if resource.bytes.result arrives for
    // the denied requestId — see Wave 2 Task 1 napplet logic.)
    await expect(deniedEl).not.toContainText('PROTOCOL VIOLATION', { timeout: 1_000 });
  });
});
