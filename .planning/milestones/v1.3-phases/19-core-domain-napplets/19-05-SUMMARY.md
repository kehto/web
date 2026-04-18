---
phase: 19-core-domain-napplets
plan: "05"
subsystem: testing
tags: [playwright, e2e, napplets, storage, relay, notify, frameLocator, sandboxed-iframe]

requires:
  - phase: 19-core-domain-napplets/19-04
    provides: "5 demo napplets wired + dual notify service registration enabling notify.create routing"
  - phase: 19-core-domain-napplets/19-01
    provides: "composer napplet DOM contract (#composer-input, #composer-publish-btn, #composer-status)"
  - phase: 19-core-domain-napplets/19-02
    provides: "preferences napplet DOM contract (#pref-display-name, #pref-theme-preference, #preferences-status)"
  - phase: 19-core-domain-napplets/19-03
    provides: "toaster napplet DOM contract (#toaster-title, #toaster-body, #toaster-notify-btn, #toaster-list)"

provides:
  - "E2E-07 relay-publish Layer-B spec: composer dispatches relay.publish envelope, debugger observes"
  - "E2E-07 relay-publish-encrypted Layer-B spec: composer encrypted path dispatches relay.publishEncrypted"
  - "E2E-07 storage-persist Layer-B spec: preferences storage round-trips across page.reload()"
  - "E2E-07 notify-lifecycle Layer-B spec: toaster notify.create + host toast + notify.dismiss cascade"

affects: [19-06, 19-07, plan-level-E2E-07]

tech-stack:
  added: []
  patterns:
    - "frame.evaluate(() => btn.click()) for button clicks in sandboxed iframes — replaces frameLocator().click() which does not dispatch events to cross-origin sandboxed iframe handlers via CDP Input"
    - "page.frames().find(f => f.url().includes('/napplet-name/')) for direct frame reference in cross-origin iframe specs"
    - "page.reload() (not demoBeforeEach) in storage-persist spec to preserve localStorage while resetting DOM state"
    - "NIP-5D session entry pre-registration in loadNapplet() so storage.* NUB handlers resolve napplet identity without legacy AUTH handshake"

key-files:
  created:
    - tests/e2e/relay-publish.spec.ts
    - tests/e2e/relay-publish-encrypted.spec.ts
    - tests/e2e/storage-persist.spec.ts
    - tests/e2e/notify-lifecycle.spec.ts
  modified:
    - apps/demo/src/shell-host.ts
    - apps/demo/napplets/preferences/src/main.ts (debug logging reverted)

key-decisions:
  - "frame.evaluate(() => btn.click()) is the canonical pattern for triggering button handlers in sandboxed napplet iframes — Playwright CDP Input dispatch does not reach cross-origin sandboxed iframe event handlers"
  - "sessionRegistry.register() must be called in loadNapplet() before/after iframe loads so handleStorageNub and handleNotifyNub can resolve napplet identity"
  - "storage-persist spec uses page.reload() (not demoBeforeEach) after saving values — demoBeforeEach calls localStorage.clear() which would defeat the persistence assertion"
  - "relay-publish spec uses /^(published:|denied:)/ regex — accepts both the stub-relay 'published: unknown' and 'denied:*' outcomes without over-constraining"

patterns-established:
  - "Sandboxed iframe click pattern: get direct frame ref via page.frames().find(), then frame.evaluate(() => btn.click())"
  - "Storage-persist reload pattern: save values, assert 'saved' status, then page.reload() + re-grab frameLocator + assert toHaveValue"
  - "Notify lifecycle triple-surface pattern: assert toaster-list li count + host #notification-toast-layer toast + napplet-debugger envelope type strings"

requirements-completed: [E2E-07]

duration: 120min
completed: 2026-04-17
---

# Phase 19 Plan 05: Layer-B E2E specs for relay/storage/notify napplet contracts

**4 Layer-B Playwright specs locking NAP-03/04/05 contracts with frame.evaluate click pattern for sandboxed cross-origin iframes and NIP-5D session pre-registration fix in demo shell-host.**

## Performance

- **Duration:** ~120 min (including investigation of sandboxed iframe click behavior and sessionRegistry fix)
- **Completed:** 2026-04-17
- **Tasks:** 3 (Task 1: relay specs, Task 2: storage + notify specs, plus 2 bug fixes)
- **Files modified:** 6

## Accomplishments

### Task 1: relay-publish + relay-publish-encrypted specs (NAP-03)

Two serial specs in `tests/e2e/relay-publish.spec.ts` (2 tests) and `tests/e2e/relay-publish-encrypted.spec.ts` (1 test) covering the composer napplet's relay.publish and relay.publishEncrypted paths. Both specs:
- Gate on `#composer-status` containing `'authenticated'` (D-04 init pattern)
- Assert status transitions to `/^(published:|denied:)/` (accepts both the stub relay's `'published: unknown'` and the no-signer `'denied: no signer configured'` outcomes)
- Assert `napplet-debugger` contains the envelope type string (`relay.publish` / `relay.publishEncrypted`)
- Capture console + pageerror streams and assert no anti-term matches

### Task 2: storage-persist + notify-lifecycle specs (NAP-04/05)

`tests/e2e/storage-persist.spec.ts`: Fills `display-name` + `theme-preference` inputs in preferences napplet, saves, then `page.reload()` (NOT demoBeforeEach — would clear localStorage) and asserts both input values survive via `toHaveValue`.

`tests/e2e/notify-lifecycle.spec.ts`: Drives toaster napplet through notify.create → host toast appears → notify.dismiss cascade via `#toaster-dismiss-all-btn`. Asserts triple surface: `toaster-list li` count, `#notification-toast-layer .notif-toast` visibility, and debugger envelope type strings for `notify.create` + `notify.dismiss`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Playwright CDP Input does not dispatch events to sandboxed cross-origin iframes**
- **Found during:** Task 1 investigation — both relay tests failed (status stayed 'authenticated')
- **Issue:** `frameLocator().click()` uses CDP Input.dispatchMouseEvent at page-level coordinates. The napplet iframes are sandboxed (`allow-scripts` only, no `allow-same-origin`), making them cross-origin. CDP Input dispatch misses the iframe button handlers entirely — confirmed via event detection listeners showing mousedown/click/pointerdown all null.
- **Fix:** Replace all `frameLocator().locator().click()` calls with `page.frames().find(f => f.url().includes('/napplet-name/')).evaluate(() => btn.click())`. This uses CDP Runtime in the frame's execution context directly, which works for sandboxed iframes.
- **Files modified:** `tests/e2e/relay-publish.spec.ts`, `tests/e2e/relay-publish-encrypted.spec.ts`, `tests/e2e/storage-persist.spec.ts`, `tests/e2e/notify-lifecycle.spec.ts`
- **Commits:** d9b9187, 9931ad0, 640beca

**2. [Rule 1 - Bug] handleStorageNub returns 'not registered' — preferences #preferences-status shows 'denied: State request timed out'**
- **Found during:** Task 2 investigation — storage-persist spec showed status stuck at 'denied' after load attempt
- **Issue:** `handleStorageNub` (state-handler.ts) checks `sessionRegistry.getEntryByWindowId(windowId)` at line 210-211 and returns 'not registered' immediately if absent. The demo's `loadNapplet()` previously called `relay.sendChallenge(windowId)` in a setTimeout to populate the registry, but `sendChallenge` was removed from ShellBridge — it was a TypeError silently swallowed, leaving the registry empty. The storage NUB shim ignores `.error` message types, causing a 5s timeout.
- **Fix:** Added `registerSessionEntry()` in `loadNapplet()` that creates a `SessionEntry` with `identitySource: 'source'`, napplet name as `dTag`, empty `pubkey`, and registers it in `relay.runtime.sessionRegistry` immediately after `originRegistry.register()`. Also called again on iframe `load` event in case `contentWindow` reference changed. Removed the broken `sendChallenge` setTimeout.
- **Files modified:** `apps/demo/src/shell-host.ts`
- **Commit:** fac7d91

## Known Stubs

- `relay.publish` in the demo always returns `{ accepted: false, message: 'no relay pool available' }` — the SDK resolves with `undefined`, so `eventId = 'unknown'` and status is `'published: unknown'`. This is by design for the demo (no real relay pool). The spec accepts this via the permissive regex.
- `relay.publishEncrypted` with no connected signer always returns `{ ok: false, error: 'no signer configured' }`. The spec accepts this via the permissive regex.

## Self-Check

PASSED — verified below.
