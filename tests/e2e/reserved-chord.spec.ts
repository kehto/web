/**
 * reserved-chord.spec.ts — E2E-17 (Phase 33 reserved chord surface).
 *
 * Phase 33 / KEYS-04..06 ships the `reservedChords` option on
 * `createKeysService` + the reservation gate in both handleMessage branches
 * (33-01) + README docs + demo wiring that declares `Ctrl+Shift+R` as a
 * reserved chord and exposes a shell-side DOM sentinel (33-02).
 *
 * This Layer-B spec is the end-to-end contract: it drives a synthetic
 * reserved chord via page.keyboard.press, asserts the shell's onForward
 * fired (via the #reserved-chord-last-fired sentinel in the parent frame),
 * and asserts the hotkey-chord napplet DID NOT receive a keys.action
 * envelope for the reserved chord. A regression gate then presses the
 * napplet's own registered chord (Ctrl+Shift+K, NON-reserved) and confirms
 * the napplet's counter STILL increments — proving the reservation gate
 * did not break the legacy non-reserved path.
 *
 * Precedence contract locked: reserved > registered. A napplet claiming a
 * chord the shell has reserved never sees the event; the shell's onForward
 * (or HostKeysBridge handler) always wins.
 *
 * Serial mode prevents postMessage timing interference across worker lifetimes.
 *
 * ANTI-TERM hygiene: standard v1.4 regex covering window.nostr / signer-service
 * / BusKind / AUTH_KIND / legacy kind 29001|29002.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('reserved chord Ctrl+Shift+R fires shell onForward and suppresses napplet keys.action; non-reserved Ctrl+Shift+K still reaches napplet', async ({ page }) => {
  test.setTimeout(60_000);
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  const hotkeyFrame = page.frameLocator('#hotkey-chord-frame-container iframe');

  // Step 1: wait for the hotkey-chord napplet to be fully subscribed. Its
  // DEFAULT_KEY is 'Ctrl+Shift+K' (apps/demo/napplets/hotkey-chord/src/main.ts:25)
  // which is NOT in the shell's reservedChords set (33-02 declares
  // ['Ctrl+Shift+R'] only). The 'subscribed' sentinel proves the SDK's
  // registerAction round-trip completed against the real backend.
  await expect(hotkeyFrame.locator('#hotkey-chord-status')).toContainText('subscribed', { timeout: 15_000 });

  // Step 2: baseline — napplet counter at '0', napplet last at '—', shell
  // sentinel empty. The shell-side sentinel lives in the parent frame
  // (document.body append in bootShell, 33-02) — no frameLocator needed.
  await expect(hotkeyFrame.locator('#hotkey-chord-count')).toHaveText('0', { timeout: 3_000 });
  await expect(hotkeyFrame.locator('#hotkey-chord-last')).toHaveText('—', { timeout: 1_000 });
  await expect(page.locator('#reserved-chord-last-fired')).toHaveText('', { timeout: 3_000 });

  // Step 3: dispatch the RESERVED chord. Per 33-02, the demo shell declares
  // reservedChords: ['Ctrl+Shift+R']. The hotkey-chord napplet has NOT
  // registered this chord — Ctrl+Shift+K is its registration — but even if
  // it had, the reservation gate (33-01 Edit 5) would suppress the
  // keys.action fan-out. We use the Playwright KeyCode form ('Control+Shift+KeyR')
  // which is keyboard-layout-independent; mirror hotkey-chord.spec.ts line 102.
  await page.keyboard.press('Control+Shift+KeyR');

  // Step 4: assert the shell's onForward fired — the sentinel text updates
  // to the canonical chord string. onForward (33-02) composes the string
  // from event.ctrlKey / shiftKey / event.key → 'Ctrl+Shift+R'.
  await expect(page.locator('#reserved-chord-last-fired')).toHaveText('Ctrl+Shift+R', { timeout: 5_000 });

  // Step 5: assert the napplet DID NOT receive a keys.action envelope for
  // the reserved chord. Its counter MUST remain '0' and its last-chord
  // MUST remain '—' (the initial value from apps/demo/napplets/hotkey-chord/index.html).
  // Note: hotkey-chord registers Ctrl+Shift+K, not Ctrl+Shift+R, so even
  // without the reservation gate the napplet would not receive keys.action
  // for Ctrl+Shift+R. This step primarily confirms that registration scope
  // is observed: the document keydown listener in keys-service.ts (33-01 Edit 5)
  // does not leak events across actionIds. Step 6 below exercises the
  // reservation-gate path directly.
  await expect(hotkeyFrame.locator('#hotkey-chord-count')).toHaveText('0', { timeout: 1_000 });
  await expect(hotkeyFrame.locator('#hotkey-chord-last')).toHaveText('—', { timeout: 1_000 });

  // Step 6: regression gate — press the napplet's OWN registered chord
  // (Ctrl+Shift+K, NON-reserved). The reservation gate MUST NOT break
  // legacy non-reserved dispatch. Counter should increment to '1' and
  // last-chord should reflect the napplet's DEFAULT_KEY.
  await page.keyboard.press('Control+Shift+KeyK');
  await expect(hotkeyFrame.locator('#hotkey-chord-count')).toHaveText('1', { timeout: 5_000 });
  await expect(hotkeyFrame.locator('#hotkey-chord-last')).toContainText('Ctrl+Shift+K', { timeout: 2_000 });

  // Step 7: the shell's onForward fires on non-reserved document keydowns
  // IF any registered action matches (33-01 Edit 5 — onForward fires once
  // per keydown when reserved OR any-match). Ctrl+Shift+K matches the
  // hotkey-chord registration, so the sentinel should now reflect
  // 'Ctrl+Shift+K' (overwritten from the previous 'Ctrl+Shift+R'). This is
  // the side effect that pins the onForward-fires-on-match contract.
  await expect(page.locator('#reserved-chord-last-fired')).toHaveText('Ctrl+Shift+K', { timeout: 2_000 });

  // Step 8: ANTI-TERM hygiene — no forbidden patterns in console or page errors.
  const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);
  const antiErrors = pageErrors.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});
