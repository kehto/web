/**
 * E2E-23 (v1.7 Phase 39 / Plan 39-05 / C-05) — CSP header is present in
 * preview mode (:4174, via configurePreviewServer), not just dev.
 *
 * Phase 39 (v1.7 / Plan 39-05) — NUB-CONNECT + NUB-CONFIG Layer-B E2E.
 * Runs against the built :4174 demo (pnpm test:serve:demo). Anti-features
 * verified: no implicit allow on dismiss (M-04), no meta-CSP (C-03),
 * iframe destroy+recreate on revoke (C-04), preview-mode CSP present (C-05).
 *
 * Defends against C-05: the structural trap where developers verify CSP
 * in dev but forget configurePreviewServer — leaving production-like
 * deploys CSP-less. The playwright baseURL is :4174 preview; a
 * dev-only response would fail here because dev is :5174.
 *
 * This spec also validates D4 strict default: on a fresh E2E run with no
 * localStorage-to-Vite sync, no grants are seeded so connect-src must be 'none'.
 */
import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://localhost:4174' });

test.describe('NUB-CONNECT preview-mode CSP (E2E-23 / C-05)', () => {
  test('preview server emits connect-src none on /napplets/<dTag>/index.html', async ({ request, baseURL }) => {
    // Sanity: baseURL MUST be the preview URL so this spec actually asserts
    // preview behavior (not dev). playwright.config + test.use both set :4174.
    expect(baseURL).toContain('4174');

    const response = await request.get('/napplets/chat/index.html');
    expect(response.status()).toBe(200);

    const csp = response.headers()['content-security-policy'];
    expect(csp).toBeDefined();
    // D4 strict default when no grants exist (fresh E2E run has no prior sync).
    expect(csp).toMatch(/connect-src\s+'none'/);
  });
});
