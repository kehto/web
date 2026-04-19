---
phase: 26-real-keys-backend
plan: 01
subsystem: services
tags: [keys, keyboard, chord, document-listener, nub-keys, vitest]

requires:
  - phase: 12-keys-service
    provides: keys-forwarder shell-side broadcast + stub keys-service envelope shapes
  - phase: 24-drift-core-06-cleanup
    provides: napplet/core@0.2.x peer dep + cleaned service-handler contract
provides:
  - Real document-level keydown listener in @kehto/services/keys-service with chord-subscription registries
  - parseChord() string-to-struct chord parser (modifier aliases: Ctrl/Control, Alt/Option, Shift, Meta/Cmd/Command/Win/Super)
  - Per-window send-callback capture + canonical keys.action envelope emission on chord match (SDK's keys.onAction surface)
  - ServiceHandler & { destroy(): void } return shape for explicit listener teardown
  - 10 new unit tests covering chord matching, event.repeat filter, unregister/onWindowDestroyed cleanup, destroy(), and invalid-chord error envelope
affects: [26-02, 26-03, 26-04, hotkey-chord-napplet, E2E-12]

tech-stack:
  added: []
  patterns:
    - "Three-registry pattern: actionRegistry (actionId→entry), windowActions (windowId→Set<actionId>), sendHandles (windowId→send) — parallels sessionRegistry cleanup idioms"
    - "SSR-safe EventTarget fallback: options.listenerTarget ?? (typeof document !== 'undefined' ? document : new EventTarget()) — mirrors keys-forwarder.ts"
    - "Service-returned destroy() method for explicit listener teardown (new in services package; matches keys-forwarder handle shape)"
    - "Superset envelope pattern: keys.action = { type, actionId } (canonical @napplet/nub-keys) + { chord } extension field; downstream SDKs ignoring unknown fields stay forward-compat"

key-files:
  created: []
  modified:
    - packages/services/src/keys-service.ts — stub replaced with real document listener, chord parser, three registries, keys.action emission, destroy()
    - packages/services/src/keys-service.test.ts — 5 existing describe blocks preserved verbatim; 4 new describe blocks added (document keydown subscription, unregisterAction cleanup, onWindowDestroyed scoping, destroy, invalid chord)
    - packages/services/tsconfig.json — added DOM + DOM.Iterable to lib (required for document/EventTarget/KeyboardEvent types)

key-decisions:
  - "[v1.4-26-01] Extended ServiceHandler return type to ServiceHandler & { destroy(): void } — explicit listener teardown API lives on the handler, not as a separate factory return. Enables runtime integrations to call keys.destroy() on shell teardown without a global registry scan."
  - "[v1.4-26-01] keys.action emission uses superset envelope { type, actionId, chord } — base shape bit-compatible with @napplet/nub-keys KeysActionMessage; the chord extension field lets the hotkey-chord demo display the fired chord without reconstructing from the registration string."
  - "[v1.4-26-01] Added DOM + DOM.Iterable to packages/services/tsconfig.json (Rule 3 Blocking deviation) — real listener needs document/EventTarget/KeyboardEvent types; packages/shell already uses this lib set, so this aligns tsconfig surfaces across browser-facing service packages."
  - "[v1.4-26-01] parseChord treats literal '+' as the key when chord ends in '+' after a separator (e.g., 'Ctrl++' → key: '+'). Single-character keys normalize to uppercase for case-insensitive comparison; multi-character DOM key names preserve casing (Enter, ArrowUp, F4)."
  - "[v1.4-26-01] No break on first match in keydown listener — two actions subscribing to the same chord both fire. Conflict resolution deferred to v1.5+ per CONTEXT Deferred Ideas."

patterns-established:
  - "Service destroy() contract: when a service attaches host-level listeners (document, window), the returned ServiceHandler must expose destroy() to detach them — avoids leaking listeners on runtime rebuild."
  - "Per-window send-callback capture: service handlers that emit shell→napplet pushes cache the send callback at request time (keyed by windowId) and invoke it later from async contexts (listeners, timers). The runtime's service-handler contract guarantees send remains valid until onWindowDestroyed fires."

requirements-completed: [KEYS-01]

duration: 5 min
completed: 2026-04-19
---

# Phase 26 Plan 01: KEYS-01 Real Keys Backend (Document Listener + keys.action Emission) Summary

**Replaced stub @kehto/services/keys-service with a real document-level keydown listener, a string-chord parser, three subscription registries, and canonical keys.action envelope emission to the owning napplet on chord match — SDK's keys.onAction(...) now has a working shell-side counterpart.**

## Performance

- **Duration:** 5 min (4m 39s)
- **Started:** 2026-04-19T13:40:42Z
- **Completed:** 2026-04-19T13:45:21Z
- **Tasks:** 2 (both autonomous)
- **Files modified:** 3 (keys-service.ts, keys-service.test.ts, packages/services/tsconfig.json)

## Accomplishments

- Replaced stub `createKeysService()` body with real implementation:
  - Single `keydown` listener attached to `options.listenerTarget` (default `document`, SSR-safe fallback to `new EventTarget()`)
  - `parseChord()` string-to-struct parser with full modifier-alias table (Ctrl/Control, Alt/Option, Shift, Meta/Cmd/Command/Win/Super)
  - Three registries: `actionRegistry` (actionId → {chord, chordString, windowId}), `windowActions` (windowId → Set<actionId>), `sendHandles` (windowId → send callback)
  - Matching keydowns invoke `options.onForward` (DOM-shape payload) AND push a `keys.action` envelope to the owning napplet via its captured send callback
  - `event.repeat` filtered — OS autorepeat drops both paths
  - `onWindowDestroyed(wid)` removes owned actions AND drops the cached send handle
  - `destroy()` detaches the listener and clears all three registries
  - Return type tightened to `ServiceHandler & { destroy(): void }`
- Preserved all 5 existing describe blocks in keys-service.test.ts verbatim; added 4 new describe blocks + 10 new tests covering the real-listener path, keys.action emission, event.repeat filter, onWindowDestroyed scoping, destroy() teardown, and invalid-chord error envelope
- Bumped `KEYS_SERVICE_VERSION` from `'1.0.0'` to `'1.1.0'` (stub → real, non-breaking wire surface)
- Scrubbed "(stub-level)" / "stub-only" language from the module docblock and service descriptor description

## Task Commits

Per the execution prompt, no commits were created in this plan — Plan 26-02 will atomic-commit Plans 26-01 + 26-02 together (serial wave execution on the same file).

- **Task 1:** Rewrite keys-service.ts with document listener + chord parser + three registries + keys.action emission — uncommitted, staged for 26-02 atomic commit
- **Task 2:** Augment keys-service.test.ts with real-listener + keys.action emission coverage — uncommitted, staged for 26-02 atomic commit

**Plan metadata:** uncommitted — SUMMARY.md to be committed by Plan 26-02's atomic commit alongside the code changes.

## Files Created/Modified

- `packages/services/src/keys-service.ts` — Stub replaced with real implementation. Added `ChordSpec`, `ActionEntry`, `MODIFIER_ALIASES`, `parseChord()`, listener attach, per-window send-handle capture, `keys.action` envelope emission on chord match, `onWindowDestroyed` + `destroy()` cleanup. 16,159 bytes / 384 lines.
- `packages/services/src/keys-service.test.ts` — Preserved 5 existing describe blocks (createKeysService/keys.forward/keys.registerAction/keys.unregisterAction/unknown keys.*/ACL-denial). Added `createMockTarget()` + `dispatchChord()` helpers and 4 new describe blocks + 10 new tests: document keydown subscription (5 tests), unregisterAction cleanup (1 test), onWindowDestroyed scoping (1 test), destroy (1 test), invalid chord (1 test). 17,999 bytes / 561 lines. Total test count: 17 (was 7).
- `packages/services/tsconfig.json` — Added `DOM` + `DOM.Iterable` to `lib` (was ES2022-only). Necessary for referencing `document`, `EventTarget`, `KeyboardEvent`, `Event` types in source. 178 bytes.

## Decisions Made

- **Return type augmented to `ServiceHandler & { destroy(): void }`** — explicit listener teardown lives on the handler itself rather than as a parallel registry. Runtimes can call `keys.destroy()` directly on shell teardown.
- **`keys.action` uses superset envelope (adds `chord` extension field)** — base shape still matches @napplet/nub-keys `KeysActionMessage`; the extension field lets the hotkey-chord demo display the fired chord without having to reconstruct it from the original registration string. SDK consumers reading only `{ type, actionId }` ignore `chord` silently.
- **Case-insensitive key comparison via uppercase normalization** — single-character keys uppercase both in parseChord output and in the keydown match helper, so `parseChord('ctrl+s')` + `KeyboardEvent{ key: 'S' }` matches. Multi-character DOM key names preserve casing (`Enter`, `ArrowUp`, `F4`).
- **No `break` after first match** — multiple actions subscribing to the same chord all fire. Conflict resolution explicitly deferred to v1.5+ per CONTEXT Deferred Ideas.
- **Invalid chord in `keys.registerAction` returns `keys.registerAction.error` envelope** — chose option (a) from the plan's binary choice. The alternative (silent no-subscription on parse failure) would have been observability-hostile; an explicit error envelope lets napplets surface the misconfiguration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added DOM + DOM.Iterable to packages/services/tsconfig.json**
- **Found during:** Task 1 (first type-check after writing keys-service.ts)
- **Issue:** `packages/services/tsconfig.json` listed only `"lib": ["ES2022"]`; the real implementation references `document`, `EventTarget`, `KeyboardEvent`, `Event` globals. Initial type-check produced 9 errors (TS2304/TS2584 "Cannot find name 'document'/'EventTarget'/'KeyboardEvent'/'Event'"). The plan's `<read_first>` guidance pointed at the shell-package `keys-forwarder.ts` pattern but didn't explicitly call out that the target package's tsconfig lacked DOM — this was a latent gap because the previous stub implementation needed zero DOM references.
- **Fix:** Added `"DOM"` and `"DOM.Iterable"` to `packages/services/tsconfig.json` `lib` array — matching `packages/shell/tsconfig.json` exactly. No other compiler options changed.
- **Files modified:** packages/services/tsconfig.json
- **Verification:** `pnpm --filter @kehto/services type-check` exits 0; full-repo `pnpm type-check` exits 0 (8/8 turbo tasks successful); `pnpm test:unit` shows 29/29 test files pass, 451/451 tests pass.
- **Committed in:** uncommitted — Plan 26-02 atomic commit

**2. [Rule 1 - Bug] Fixed `_removedCount` getter on mock EventTarget in test helper**
- **Found during:** Task 2 (first test run, destroy-detaches-listener assertion failed with `expected 0 to be greater than or equal to 1`)
- **Issue:** The `createMockTarget()` helper initially used `Object.assign(target, { get _removedCount() { return removed; } })`. `Object.assign` invokes the getter *at assignment time* and copies the resulting value (0), not the descriptor — so the assertion read the frozen snapshot instead of the live count.
- **Fix:** Replaced the `Object.assign` pattern with `Object.defineProperty(decorated, '_removedCount', { configurable: true, enumerable: true, get: (): number => removed })` so the getter descriptor is installed live.
- **Files modified:** packages/services/src/keys-service.test.ts (helper only)
- **Verification:** All 17 tests pass; `_removedCount` correctly reports 1 after `destroy()`.
- **Committed in:** uncommitted — Plan 26-02 atomic commit

**3. [Rule 3 - Blocking] Non-null assertion on optional `onWindowDestroyed`**
- **Found during:** Task 2 (second type-check)
- **Issue:** `ServiceHandler.onWindowDestroyed?` is declared optional on the runtime interface. The test for window-scoped cleanup calls `service.onWindowDestroyed('win-A')` directly; strict TS raised `TS2722: Cannot invoke an object which is possibly 'undefined'`.
- **Fix:** Use `service.onWindowDestroyed!('win-A')` in the test — the implementation always defines this method; the assertion documents that fact at the call site without changing the interface.
- **Files modified:** packages/services/src/keys-service.test.ts (1 line)
- **Verification:** Type-check + test-run both exit 0.
- **Committed in:** uncommitted — Plan 26-02 atomic commit

---

**Total deviations:** 3 auto-fixed (2 blocking tsconfig/interface, 1 bug in test helper)
**Impact on plan:** None structural. All three deviations are wire-transparent and don't affect the plan's success criteria or the eventual 26-02 atomic-commit scope. The tsconfig change (deviation 1) is the only one that touches a file outside the plan's `files_modified` list; it's necessary for compilation and aligns services/tsconfig.json with the already-established shell/tsconfig.json lib set.

## Issues Encountered

- **Vitest filter for services package not wired** — the plan prescribed `pnpm --filter @kehto/services test` as Task 2 verification, but `packages/services/package.json` has no `test` script (only `test:unit: echo 'no unit tests yet'`). Test execution routed through the root-level `pnpm test:unit packages/services/src/keys-service.test.ts` (direct vitest pattern filter) — behaviorally equivalent since tests live under `packages/*/src/**/*.test.ts` (root `vitest.config.ts` include glob). No code change needed; documenting the substitution for 26-02's verification step. Could be addressed in a future chore commit if `pnpm --filter` filtering is desired.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Ready for Plan 26-02:** The real keys-service + augmented test suite are in-tree, uncommitted, awaiting 26-02's atomic commit scope. Plan 26-02 (per prompt) will atomic-commit both plans' work together (serial wave, same file).
- **Ready for Plan 26-03 (HostKeysBridge):** The `ServiceHandler & { destroy(): void }` return shape + `KeysServiceOptions.listenerTarget` option establish the extensibility seams the bridge interface will hook into.
- **Ready for Plan 26-04 (hotkey-chord demo napplet + E2E-12):** `keys.action` envelope emission is live; the demo napplet can subscribe via `@napplet/sdk` (`keysOnAction('demo.chord', cb)`) and Playwright can drive `page.keyboard.press('Control+Shift+K')` to assert end-to-end delivery.
- **No blockers.**

## Self-Check

Automated verification of SUMMARY claims:

- Files modified present on disk:
  - `packages/services/src/keys-service.ts`: FOUND (16159 bytes, 384 lines)
  - `packages/services/src/keys-service.test.ts`: FOUND (17999 bytes, 561 lines)
  - `packages/services/tsconfig.json`: FOUND (178 bytes)
- Type-check: `pnpm --filter @kehto/services type-check` → exit 0
- Full-repo type-check: `pnpm type-check` → 8/8 turbo tasks successful
- Unit tests: `pnpm test:unit` → 29/29 test files pass, 451/451 tests pass
- Keys-service tests alone: `pnpm test:unit packages/services/src/keys-service.test.ts` → 17/17 tests pass (was 7 baseline; +10 new)
- Grep anti-pattern: `grep -cE "stub-level|stub-only" packages/services/src/keys-service.ts` → 0 ✓
- Grep positive: `grep -cE "addEventListener\('keydown'" packages/services/src/keys-service.ts` → 1 ≥ 1 ✓
- Grep positive: `grep -c "keys\.action" packages/services/src/keys-service.ts` → 8 ≥ 1 ✓
- Commits: N/A — plan explicitly instructed no commits (26-02 atomic commit is the authoritative hash source for this work)

## Self-Check: PASSED

---
*Phase: 26-real-keys-backend*
*Completed: 2026-04-19*
