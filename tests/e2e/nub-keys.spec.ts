/**
 * nub-keys Layer-A spec — E2E-14 Phase 28 real-backend coverage.
 *
 * Graduated from stub-scope (v1.3 Phase 21 E2E-09) to real-backend coverage
 * now that Phase 26 shipped the document-level chord listener (KEYS-01),
 * HostKeysBridge interface (KEYS-02), and hotkey-chord demo napplet (KEYS-03).
 * Harness extension: Phase 28 Plan 28-01 Task 1 added a 'real' factory-key
 * branch to __registerService__; passing the literal string 'real' as the
 * second arg swaps in the @kehto/services reference createKeysService().
 *
 * Coverage scope (this spec):
 *   1. keys.registerAction envelope dispatchable via __injectEnvelope__.
 *   2. The real @kehto/services createKeysService() handler replies with a
 *      canonical keys.registerAction.result envelope carrying { type, id,
 *      actionId, binding } — captured via __getNubMessage__.
 *   3. A synthetic document keydown matching the registered chord produces a
 *      keys.action push envelope back to the owning napplet — captured via
 *      __getNubMessage__ (proves the real document listener + per-window send
 *      handle captured at registerAction time).
 *   4. No anti-term violations in console or page errors.
 *
 * Implementation notes:
 *   - Loads nub-storage as a generic fixture purely to obtain a valid windowId.
 *   - Installs the real keys service via __registerService__('keys', 'real').
 *   - Drives keys.registerAction via __injectEnvelope__(windowId, ...).
 *   - Dispatches the synthetic keydown via page.evaluate with
 *     document.dispatchEvent(new KeyboardEvent(...)) — the real service's
 *     document-level addEventListener('keydown', ...) receives the event and
 *     emits the keys.action envelope via the per-window send callback.
 *   - Asserts request + .result + .action envelopes via __getNubMessage__.
 */
import { test, expect } from '@playwright/test';
import { aclBeforeEach, waitForNappletReady } from './helpers/index.js';

test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('nub-keys: keys.registerAction + synthetic keydown drives real keys-service keys.action push', async ({ page }) => {
  test.setTimeout(30_000);
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => consoleMessages.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await aclBeforeEach(page);

  // Load any fixture to obtain a valid windowId — nub-storage reaches
  // __nappletReady__ quickly; fixture choice is unrelated to keys.
  const windowId = await page.evaluate(() => window.__loadNapplet__('nub-storage'));
  await waitForNappletReady(page, windowId);

  // Install the REAL @kehto/services keys service via the 'real' factory-key
  // branch (Plan 28-01 Task 1). Zero-arg construction yields the reference
  // document-level listener implementation (Phase 26 Plan 26-01).
  const installed = await page.evaluate(() => window.__registerService__('keys', 'real'));
  expect(installed).toBe(true);

  // Inject the keys.registerAction request envelope.
  await page.evaluate(
    (wid) => window.__injectEnvelope__(wid, {
      type: 'keys.registerAction',
      id: 'nub-keys-spec-1',
      action: { id: 'editor.save', label: 'Save', defaultKey: 'Ctrl+S' },
    } as Parameters<typeof window.__injectEnvelope__>[1]),
    windowId,
  );

  // Request envelope recorded in envelopeLog (dispatch succeeded).
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

  // Real backend replies with keys.registerAction.result — captured via envelopeLog.
  await page.waitForFunction(
    (wid) => window.__getNubMessage__(wid, 'keys.registerAction.result') !== null,
    windowId,
    { timeout: 5_000 },
  );
  const resultEnvelope = await page.evaluate(
    (wid) => window.__getNubMessage__(wid, 'keys.registerAction.result'),
    windowId,
  );
  expect((resultEnvelope as { type: string }).type).toBe('keys.registerAction.result');
  expect((resultEnvelope as { id?: string }).id).toBe('nub-keys-spec-1');
  expect((resultEnvelope as { actionId?: string }).actionId).toBe('editor.save');
  expect((resultEnvelope as { binding?: string }).binding).toBe('Ctrl+S');

  // Dispatch a synthetic document keydown matching the registered chord.
  // The real service's document.addEventListener('keydown', ...) fires, matches
  // against the actionRegistry entry for 'editor.save', and emits a keys.action
  // push envelope via the per-window send handle captured at registerAction time.
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 's',
      code: 'KeyS',
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      bubbles: true,
    }));
  });

  // keys.action push envelope recorded in envelopeLog (proves real backend fired).
  await page.waitForFunction(
    (wid) => window.__getNubMessage__(wid, 'keys.action') !== null,
    windowId,
    { timeout: 5_000 },
  );
  const actionEnvelope = await page.evaluate(
    (wid) => window.__getNubMessage__(wid, 'keys.action'),
    windowId,
  );
  expect((actionEnvelope as { type: string }).type).toBe('keys.action');
  expect((actionEnvelope as { actionId?: string }).actionId).toBe('editor.save');

  // Cleanup: unregister the real service (runtime drops the listener via destroy()
  // on next unregisterService -> runtime calls handler.destroy?.() if present).
  await page.evaluate(() => window.__unregisterService__('keys'));

  // Anti-term hygiene: no forbidden patterns in console or page errors.
  expect(consoleMessages.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
  expect(pageErrors.filter((m) => ANTI_TERM_RE.test(m))).toHaveLength(0);
});
