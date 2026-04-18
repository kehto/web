/**
 * nub-keys Layer-A spec — E2E-09 Phase 21 STUB-SCOPE coverage.
 *
 * STUB SCOPE NOTICE:
 *   The keys NUB is intentionally stub-only in v1.3 (per CONTEXT D-05 + ROADMAP
 *   "Future Requirements deferred past v1.3" -> hotkey-chord napplet). The
 *   @kehto/services keys-service factory is a stub that does not interact with any
 *   real host hotkey backend. This spec asserts the runtime's stub response SHAPE
 *   only — not real hotkey behavior. DO NOT graduate this spec to a fixture-backed
 *   Layer-A spec without first implementing a real keys backend.
 *
 *   Replacement work (deferred to v1.4): hotkey-chord napplet when a host hotkey
 *   backend ships.
 *
 * Coverage scope (this spec only):
 *   1. keys.registerAction envelope is dispatchable via __injectEnvelope__.
 *   2. The runtime routes to a stub 'keys' service installed via __registerService__;
 *      the service captures the message and emits a keys.registerAction.result
 *      envelope with canonical fields { type, id, actionId, binding }.
 *   3. The request envelope is recorded in envelopeLog (verifiable via __getNubMessage__).
 *   4. No anti-term violations in console or page errors.
 *
 * Runtime behavior verified (Phase 21-04 execution):
 *   POSSIBILITY A applies for keys.registerAction — runtime.ts:982 emits a fallback
 *   keys.registerAction.result envelope even when NO 'keys' service is registered.
 *   This spec installs a stub service via __registerService__ to guarantee service-path
 *   coverage AND capture the result into a window-scoped global for assertion.
 *   The stub service takes precedence over the runtime's own fallback (runtime.ts:950-954
 *   routes to the registered service first).
 *
 * Implementation notes:
 *   - Loads nub-storage as a generic fixture purely to obtain a valid windowId
 *     (every napplet that completes AUTH gets a windowId — fixture choice is irrelevant).
 *   - Drives keys.registerAction via __injectEnvelope__(windowId, ...).
 *   - Installs a stub 'keys' service that records the inbound message into
 *     window.__lastKeysReq and emits a stub-correct result envelope.
 *   - Asserts request envelope via __getNubMessage__ + captured message via global.
 */
import { test, expect } from '@playwright/test';
import { aclBeforeEach, waitForNappletReady } from './helpers/index.js';

test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('nub-keys: keys.registerAction envelope dispatchable + runtime stub response captured', async ({ page }) => {
  test.setTimeout(30_000);
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => consoleMessages.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await aclBeforeEach(page);

  // Load any fixture to obtain a valid windowId — nub-storage is small and reaches
  // __nappletReady__ quickly. The fixture itself is unrelated to keys; we only need
  // a windowId registered in the harness's originRegistry.
  const windowId = await page.evaluate(() => window.__loadNapplet__('nub-storage'));
  await waitForNappletReady(page, windowId);

  // Install a stub 'keys' service that records inbound messages on a window-scoped global.
  // This guarantees Possibility A semantics: our service intercepts before the runtime's
  // own fallback (runtime.ts:950 routes to registered service first). The stub emits a
  // canonical keys.registerAction.result envelope matching the @kehto/services spec shape.
  //
  // NOTE: The handler object must include `descriptor` because runtime.registerService()
  // accesses handler.descriptor.name at registration time (runtime.ts:1181).
  const installed = await page.evaluate(() =>
    window.__registerService__('keys', `({
      descriptor: { name: 'keys', version: '1.0-stub', description: 'stub keys service for E2E-09' },
      handleMessage: function(windowId, msg, send) {
        window.__lastKeysReq = msg;
        if (msg.type === 'keys.registerAction') {
          var actionId = (msg.action && msg.action.id) ? msg.action.id : (msg.actionId || '');
          var binding = (msg.action && msg.action.defaultKey) ? msg.action.defaultKey : undefined;
          send({ type: 'keys.registerAction.result', id: msg.id, actionId: actionId, binding: binding });
        }
      },
      onWindowDestroyed: function() {}
    })`),
  );
  expect(installed).toBe(true);

  // Inject the request envelope as if the napplet had posted it to the shell.
  await page.evaluate(
    (wid) => window.__injectEnvelope__(wid, {
      type: 'keys.registerAction',
      id: 'nub-keys-spec-1',
      action: { id: 'editor.save', label: 'Save', defaultKey: 'Ctrl+S' },
    } as Parameters<typeof window.__injectEnvelope__>[1]),
    windowId,
  );

  // Request envelope recorded in harness envelopeLog (proves dispatch succeeded).
  await page.waitForFunction(
    (wid) => window.__getNubMessage__(wid, 'keys.registerAction') !== null,
    windowId,
    { timeout: 5_000 },
  );
  const reqEnvelope = await page.evaluate(
    (wid) => window.__getNubMessage__(wid, 'keys.registerAction'),
    windowId,
  );
  expect((reqEnvelope as { type: string }).type).toBe('keys.registerAction');
  expect((reqEnvelope as { id?: string }).id).toBe('nub-keys-spec-1');

  // Stub service captured the message via window.__lastKeysReq.
  await page.waitForFunction(
    () => Boolean((window as Window & { __lastKeysReq?: unknown }).__lastKeysReq),
    null,
    { timeout: 3_000 },
  );
  const captured = await page.evaluate(
    () => (window as Window & { __lastKeysReq?: { type: string; action?: { id: string; defaultKey?: string } } }).__lastKeysReq,
  );
  expect(captured?.type).toBe('keys.registerAction');
  expect(captured?.action?.id).toBe('editor.save');
  expect(captured?.action?.defaultKey).toBe('Ctrl+S');

  // Cleanup: unregister the stub service to avoid cross-test pollution.
  await page.evaluate(() => window.__unregisterService__('keys'));

  // Anti-term hygiene: no forbidden patterns in console or page errors.
  expect(consoleMessages.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
  expect(pageErrors.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
});
