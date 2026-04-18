/**
 * nub-media Layer-A spec — E2E-09 Phase 21 STUB-SCOPE coverage.
 *
 * STUB SCOPE NOTICE:
 *   The media NUB is intentionally stub-only in v1.3 (per CONTEXT D-05 + ROADMAP
 *   "Future Requirements deferred past v1.3" -> media-controller napplet). The
 *   @kehto/services media-service factory is a stub that does not interact with any
 *   real host media backend. This spec asserts the runtime's stub response SHAPE
 *   only — not real media session behavior. DO NOT graduate this spec to a
 *   fixture-backed Layer-A spec without first implementing a real media backend.
 *
 *   Replacement work (deferred to v1.4): media-controller napplet when a host media
 *   backend ships.
 *
 * Coverage scope (this spec only):
 *   1. media.session.create envelope is dispatchable via __injectEnvelope__.
 *   2. The runtime routes to a stub 'media' service installed via __registerService__;
 *      the service captures the message and emits a media.session.create.result
 *      envelope with canonical fields { type, id, sessionId }.
 *   3. The request envelope is recorded in envelopeLog (verifiable via __getNubMessage__).
 *   4. No anti-term violations in console or page errors.
 *
 * Runtime behavior verified (Phase 21-04 execution):
 *   POSSIBILITY A applies for media.session.create — runtime.ts:939 emits a fallback
 *   media.session.create.result envelope even when NO 'media' service is registered.
 *   Fallback shape: { type: 'media.session.create.result', id, sessionId: m.sessionId ?? '' }.
 *   Since our request does not include a sessionId field, the fallback returns sessionId: ''.
 *   This spec installs a stub service via __registerService__ that generates a
 *   predictable stub-session ID, giving a stronger assertion target than the fallback's
 *   empty-string sessionId. The stub service takes precedence over the runtime fallback
 *   (runtime.ts:930-934 routes to the registered service first).
 *
 * Implementation notes:
 *   - Loads nub-storage as a generic fixture purely to obtain a valid windowId
 *     (every napplet that completes AUTH gets a windowId — fixture choice is irrelevant).
 *   - Drives media.session.create via __injectEnvelope__(windowId, ...).
 *   - Installs a stub 'media' service that records the inbound message into
 *     window.__lastMediaReq and emits a stub-correct result envelope.
 *   - Asserts request envelope via __getNubMessage__ + captured message via global.
 */
import { test, expect } from '@playwright/test';
import { aclBeforeEach, waitForNappletReady } from './helpers/index.js';

test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('nub-media: media.session.create envelope dispatchable + runtime stub response captured', async ({ page }) => {
  test.setTimeout(30_000);
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => consoleMessages.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await aclBeforeEach(page);

  // Load any fixture to obtain a valid windowId — nub-storage is small and reaches
  // __nappletReady__ quickly. The fixture itself is unrelated to media; we only need
  // a windowId registered in the harness's originRegistry.
  const windowId = await page.evaluate(() => window.__loadNapplet__('nub-storage'));
  await waitForNappletReady(page, windowId);

  // Install a stub 'media' service that records inbound messages on a window-scoped global.
  // This guarantees Possibility A semantics: our service intercepts before the runtime's
  // own fallback (runtime.ts:930 routes to registered service first). The stub emits a
  // canonical media.session.create.result envelope with a predictable stub sessionId.
  //
  // NOTE: The handler object must include `descriptor` because runtime.registerService()
  // accesses handler.descriptor.name at registration time (runtime.ts:1181).
  const installed = await page.evaluate(() =>
    window.__registerService__('media', `({
      descriptor: { name: 'media', version: '1.0-stub', description: 'stub media service for E2E-09' },
      handleMessage: function(windowId, msg, send) {
        window.__lastMediaReq = msg;
        if (msg.type === 'media.session.create') {
          send({ type: 'media.session.create.result', id: msg.id, sessionId: 'stub-session-spec' });
        }
      },
      onWindowDestroyed: function() {}
    })`),
  );
  expect(installed).toBe(true);

  // Inject the request envelope as if the napplet had posted it to the shell.
  await page.evaluate(
    (wid) => window.__injectEnvelope__(wid, {
      type: 'media.session.create',
      id: 'nub-media-spec-1',
      metadata: { title: 'Stub Track', artist: 'Test Suite' },
    } as Parameters<typeof window.__injectEnvelope__>[1]),
    windowId,
  );

  // Request envelope recorded in harness envelopeLog (proves dispatch succeeded).
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

  // Stub service captured the message via window.__lastMediaReq.
  await page.waitForFunction(
    () => Boolean((window as Window & { __lastMediaReq?: unknown }).__lastMediaReq),
    null,
    { timeout: 3_000 },
  );
  const captured = await page.evaluate(
    () => (window as Window & { __lastMediaReq?: { type: string; metadata?: { title: string; artist: string } } }).__lastMediaReq,
  );
  expect(captured?.type).toBe('media.session.create');
  expect(captured?.metadata?.title).toBe('Stub Track');
  expect(captured?.metadata?.artist).toBe('Test Suite');

  // Cleanup: unregister the stub service to avoid cross-test pollution.
  await page.evaluate(() => window.__unregisterService__('media'));

  // Anti-term hygiene: no forbidden patterns in console or page errors.
  expect(consoleMessages.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
  expect(pageErrors.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
});
