/**
 * hotkey-chord.spec.ts — E2E-12 (Phase 26 real keys backend).
 *
 * The hotkey-chord napplet (Plan 26-03) subscribes to Ctrl+Shift+K via
 * `keysRegisterAction(...)` + `keysOnAction(...)`.
 * The helper internally routes the shell's `keys.registerAction.result` envelope
 * (Plan 26-01 preserves that wire shape) and the `keys.action` push (Plan 26-01
 * emits this on every matching document keydown) to the napplet callback.
 *
 * This spec is the Layer-B contract: it drives a synthetic chord via
 * page.keyboard.press, confirms the full loop (registration → first delivery →
 * second delivery proving durability), and exercises anti-term hygiene.
 *
 * The full loop under test:
 *
 *   Napplet boot:
 *     hotkey-chord main.ts calls `await keysRegisterAction({ defaultKey: 'Ctrl+Shift+K' })`
 *     → helper generates correlation ID + sends keys.registerAction envelope
 *     → shell routes to keys-service.handleMessage (Plan 26-01)
 *     → service stores actionRegistry[actionId] = { chord, windowId } + captures send handle
 *     → service sends keys.registerAction.result back
 *     → helper resolves the registerAction Promise
 *     → napplet status transitions 'authenticated' → 'subscribed'
 *
 *   Playwright keyboard.press('Control+Shift+KeyK'):
 *     → document keydown dispatched in the host page
 *     → keys-service document listener fires (Plan 26-01)
 *     → options.onForward callback fires on the host side (demo logs real-backend evidence)
 *     → service emits `keys.action` envelope to the hotkey-chord napplet (Plan 26-01)
 *     → helper listener routes keys.action → the onAction callback for
 *       'hotkey-chord.demo' → napplet updates #hotkey-chord-count + #hotkey-chord-last
 *
 * Serial mode prevents postMessage timing interference across worker lifetimes.
 *
 * Capability gate: keys-forwarder.ts (Plan 12-11) ALSO broadcasts a keys.forward
 * envelope to every napplet granted keys:forward — that path is disjoint from
 * keys.action (which targets the specific owning napplet). The hotkey-chord
 * napplet only consumes keys.action via the helper callback, so the keys:forward
 * capability on the hotkey-chord napplet is not strictly required for THIS
 * spec's DOM assertions. However, other napplets might have keys:forward and
 * consume keys.forward independently — granting it here keeps the demo in a
 * consistent state AND exercises the cap-gate code path for the hotkey-chord
 * napplet per the v1.4 milestone. Plan 26-03's `__grantKeysForward__` host hook
 * performs the grant; the spec calls it after the napplet is subscribed.
 *
 * ROADMAP §4 deviation (the napplet-ready helper): the :4174 demo does not
 * install `window.__nappletReady__` (only the :4173 harness does — helpers
 * diverge here by design). This spec uses the status-sentinel wait
 * `toContainText('subscribed')` which provides equivalent coverage because it
 * blocks until both the napplet's init and the
 * keys.registerAction round-trip have completed — observable via the
 * #hotkey-chord-status DOM transition. relay-subscribe.spec.ts follows the
 * same pattern for the same reason.
 *
 * ANTI-TERM hygiene: standard v1.4 regex covering window.nostr / signer-service
 * / BusKind / AUTH_KIND / legacy kind 29001|29002.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('hotkey-chord napplet receives Ctrl+Shift+K via real keys backend and increments counter', async ({ page }) => {
  test.setTimeout(60_000);
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  const hotkeyFrame = page.frameLocator('#hotkey-chord-frame-container iframe');

  // Step 1: wait for napplet AUTH handshake + keys.registerAction round-trip.
  // The init pattern + `await keysRegisterAction(...)` means status
  // transitions 'connecting...' → 'authenticated' → 'subscribed'. We accept
  // 'subscribed' as evidence that the helper resolved the registerAction Promise
  // (the real backend registered the chord AND captured the per-window send handle).
  await expect(hotkeyFrame.locator('#hotkey-chord-status')).toContainText('subscribed', { timeout: 15_000 });

  // Step 2: initial counter state is '0' (baseline sanity check).
  await expect(hotkeyFrame.locator('#hotkey-chord-count')).toHaveText('0', { timeout: 3_000 });

  // Step 3: grant keys:forward capability via the pre-installed host hook
  // (Plan 26-03 bootShell installs window.__grantKeysForward__). The hook
  // returns true when the grant succeeded, false if the napplet isn't loaded
  // or authenticated yet. Because Step 1 gated on 'subscribed' (which implies
  // authenticated), the grant MUST succeed here.
  const granted = await page.evaluate(() => {
    const fn = (window as Window & { __grantKeysForward__?: () => boolean }).__grantKeysForward__;
    return typeof fn === 'function' ? fn() : false;
  });
  expect(granted, '__grantKeysForward__ must return true — hook installed by Plan 26-03 bootShell').toBe(true);

  // Step 4: dispatch Ctrl+Shift+K via Playwright's keyboard API. Use the KeyCode
  // form ('Control+Shift+KeyK') which is keyboard-layout-independent — the
  // character form ('Control+Shift+K') depends on US keyboard layout and is
  // fragile across CI variations.
  await page.keyboard.press('Control+Shift+KeyK');

  // Step 5: assert counter increments to '1' (proves keys.action envelope delivered
  // via the keysOnAction callback).
  await expect(hotkeyFrame.locator('#hotkey-chord-count')).toHaveText('1', { timeout: 5_000 });

  // Step 6: assert #hotkey-chord-last text includes 'Ctrl+Shift+K' — proves the
  // napplet's onAction callback fired and wrote DEFAULT_KEY to the sentinel.
  await expect(hotkeyFrame.locator('#hotkey-chord-last')).toContainText('Ctrl+Shift+K', { timeout: 2_000 });

  // Step 7: press the chord again — confirm subscription is durable (counter → '2').
  await page.keyboard.press('Control+Shift+KeyK');
  await expect(hotkeyFrame.locator('#hotkey-chord-count')).toHaveText('2', { timeout: 5_000 });

  // Step 8: ANTI-TERM hygiene — no forbidden patterns in console or page errors.
  const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);
  const antiErrors = pageErrors.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});
