/**
 * nub-media Layer-A spec — E2E-14 Phase 28 real-backend coverage.
 *
 * Graduated from stub-scope (v1.3 Phase 21 E2E-09) to real-backend coverage
 * now that Phase 27 shipped the navigator.mediaSession mirror (MEDIA-01),
 * HostMediaBridge interface (MEDIA-02), and media-controller demo napplet
 * (MEDIA-03). Harness extension: Phase 28 Plan 28-01 Task 1 added a 'real'
 * factory-key branch to __registerService__; passing the literal string
 * 'real' as the second arg swaps in the @kehto/services reference
 * createMediaService() which defaults to createBrowserMediaBridge (mirrors
 * metadata + playbackState to navigator.mediaSession on the shell window).
 *
 * Coverage scope (this spec):
 *   1. media.session.create envelope dispatchable via __injectEnvelope__.
 *   2. The real @kehto/services createMediaService() handler replies with a
 *      canonical media.session.create.result envelope carrying { type, id,
 *      sessionId } — captured via __getNubMessage__.
 *   3. After session.create, navigator.mediaSession.metadata.title on the
 *      harness page reflects the supplied metadata — proves the real bridge
 *      mirrored via bridge.setMetadata (Plan 27-01 createBrowserMediaBridge).
 *   4. After a subsequent media.session.update with new metadata,
 *      navigator.mediaSession.metadata.title reflects the updated value.
 *   5. No anti-term violations in console or page errors.
 *
 * Implementation notes:
 *   - Loads nub-storage as a generic fixture purely to obtain a valid windowId.
 *   - Installs the real media service via __registerService__('media', 'real').
 *   - Drives media.session.create + media.session.update via __injectEnvelope__.
 *   - Reads navigator.mediaSession from the top-level harness page via
 *     page.evaluate (createBrowserMediaBridge writes to the shell window's
 *     singleton navigator.mediaSession, not the iframe's — same pattern as
 *     media-controller.spec.ts Plan 27-04).
 *   - Uses expect.poll for the navigator.mediaSession.metadata.title read to
 *     absorb sub-second mirror timing jitter between __injectEnvelope__ and
 *     bridge.setMetadata completion.
 */
import { test, expect } from '@playwright/test';
import { aclBeforeEach, waitForNappletReady } from './helpers/index.js';

test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('nub-media: media.session.create/update drives real media-service navigator.mediaSession mirror', async ({ page }) => {
  test.setTimeout(30_000);
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => consoleMessages.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await aclBeforeEach(page);

  // Load any fixture to obtain a valid windowId — nub-storage reaches
  // __nappletReady__ quickly; fixture choice is unrelated to media.
  const windowId = await page.evaluate(() => window.__loadNapplet__('nub-storage'));
  await waitForNappletReady(page, windowId);

  // Install the REAL @kehto/services media service via the 'real' factory-key
  // branch (Plan 28-01 Task 1). Zero-arg construction yields the reference
  // navigator.mediaSession mirror implementation (Phase 27 Plan 27-01).
  const installed = await page.evaluate(() => window.__registerService__('media', 'real'));
  expect(installed).toBe(true);

  // Inject the media.session.create request envelope.
  await page.evaluate(
    (wid) => window.__injectEnvelope__(wid, {
      type: 'media.session.create',
      id: 'nub-media-spec-1',
      sessionId: 'nub-media-spec-session',
      metadata: { title: 'Layer-A Real Track', artist: 'kehto' },
    } as Parameters<typeof window.__injectEnvelope__>[1]),
    windowId,
  );

  // Request envelope recorded in envelopeLog (dispatch succeeded).
  await page.waitForFunction(
    (wid) => window.__getNubMessage__(wid, 'media.session.create') !== null,
    windowId,
    { timeout: 5_000 },
  );
  const reqEnvelope = await page.evaluate(
    (wid) => window.__getNubMessage__(wid, 'media.session.create'),
    windowId,
  );
  expect((reqEnvelope as { type: string }).type).toBe('media.session.create');
  expect((reqEnvelope as { id?: string }).id).toBe('nub-media-spec-1');

  // Real backend replies with media.session.create.result — captured via envelopeLog.
  await page.waitForFunction(
    (wid) => window.__getNubMessage__(wid, 'media.session.create.result') !== null,
    windowId,
    { timeout: 5_000 },
  );
  const resultEnvelope = await page.evaluate(
    (wid) => window.__getNubMessage__(wid, 'media.session.create.result'),
    windowId,
  );
  expect((resultEnvelope as { type: string }).type).toBe('media.session.create.result');
  expect((resultEnvelope as { id?: string }).id).toBe('nub-media-spec-1');
  expect((resultEnvelope as { sessionId?: string }).sessionId).toBe('nub-media-spec-session');

  // Real bridge mirrored metadata to navigator.mediaSession.metadata via
  // createBrowserMediaBridge.setMetadata (Plan 27-01). Poll to absorb timing.
  await expect.poll(async () => {
    return page.evaluate(() => navigator.mediaSession?.metadata?.title ?? null);
  }, { timeout: 5_000, message: 'navigator.mediaSession.metadata.title should mirror session.create metadata' }).toBe('Layer-A Real Track');

  // Inject media.session.update with new title; the real bridge re-mirrors.
  await page.evaluate(
    (wid) => window.__injectEnvelope__(wid, {
      type: 'media.session.update',
      id: 'nub-media-spec-2',
      sessionId: 'nub-media-spec-session',
      metadata: { title: 'Updated Layer-A Track' },
    } as Parameters<typeof window.__injectEnvelope__>[1]),
    windowId,
  );

  // navigator.mediaSession.metadata.title reflects the updated value.
  await expect.poll(async () => {
    return page.evaluate(() => navigator.mediaSession?.metadata?.title ?? null);
  }, { timeout: 5_000, message: 'navigator.mediaSession.metadata.title should reflect session.update metadata' }).toBe('Updated Layer-A Track');

  // Cleanup: unregister the real service (runtime.unregisterService -> destroy()).
  await page.evaluate(() => window.__unregisterService__('media'));

  // Anti-term hygiene: no forbidden patterns in console or page errors.
  expect(consoleMessages.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
  expect(pageErrors.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
});
