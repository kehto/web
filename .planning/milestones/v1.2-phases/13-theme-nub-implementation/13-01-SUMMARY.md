---
phase: 13-theme-nub-implementation
plan: 01
subsystem: runtime-services
tags: [nip-5d, theme, nub, acl, tdd, vitest, service-handler]

requires:
  - phase: 11-nub-peer-deps-type-imports
    provides: "@napplet/nub-theme peer-dep wired into @kehto/runtime + @kehto/services"
  - phase: 12-shell-conformance-seven-nub-coverage
    provides: "resolveCapabilitiesNub themeMap (theme:read gate) at packages/acl/src/resolve.ts:164; createNubEnforceGate + formatDenialReason plumbing at runtime.ts:1038-1046"
provides:
  - "@kehto/services createThemeService({ initialTheme?, onBroadcast? }) factory returning { handler, publishTheme, getCurrentTheme }"
  - "@kehto/runtime case 'theme': dispatch branch routing theme.* envelopes to serviceRegistry['theme'] with spec-correct fallback emitting theme.get.result"
  - "Canonical default theme constants (background=#0a0a0a, text=#e0e0e0, primary=#7aa2f7) anchored in theme-service.ts and mirrored in runtime.ts"
  - "End-to-end TH-04 ACL enforcement test in dispatch.test.ts proving blocked napplet gets theme.get.error, granted napplet reaches service"
affects:
  - 13-02-PLAN (shell adapter publishTheme wraps createThemeService's publishTheme handle)
  - 14-dispatch-refactor (case 'theme' is the 8th switch arm to migrate into createDispatch/registerNub)

tech-stack:
  added: []
  patterns:
    - "ThemeService bundle return shape: { handler, publishTheme, getCurrentTheme } — decouples host-facing broadcast handle from ServiceHandler surface so runtime.registerService only sees the handler and the shell adapter (Plan 13-02) consumes publishTheme directly"
    - "onBroadcast callback injection: service stays browser-agnostic; shell adapter wires onBroadcast to sendToNapplet fanout in Plan 13-02"
    - "Mirrored default constants with JSDoc sync contract instead of runtime->services import (preserves one-way services->runtime dependency)"

key-files:
  created:
    - packages/services/src/theme-service.ts
    - packages/services/src/theme-service.test.ts
  modified:
    - packages/services/src/index.ts
    - packages/runtime/src/runtime.ts
    - packages/runtime/src/dispatch.test.ts

key-decisions:
  - "ThemeService return shape: { handler, publishTheme, getCurrentTheme } (option (a) from plan) — host-facing publishTheme sits outside the ServiceHandler surface so the shell adapter in Plan 13-02 can wrap it without reaching through an attached method on the handler"
  - "onBroadcast callback injection over direct sendToNapplet coupling — keeps createThemeService browser-agnostic and trivially unit-testable"
  - "Mirror default theme values in runtime.ts rather than import from @kehto/services — preserves one-way services->runtime dependency; sync contract documented in JSDoc on both DEFAULT_THEME and THEME_FALLBACK_DEFAULT constants"
  - "TH-04 ACL denial test uses aclState.block() (rather than targeted revoke) because the default ACL policy is 'permissive' and block reliably denies ALL capabilities including theme:read regardless of future policy changes"
  - "Service-level ACL denial test stays as envelope-shape assertion (identical to identity-service.test.ts pattern); real ACL gate is proven end-to-end in dispatch.test.ts via createRuntime().handleMessage()"

patterns-established:
  - "8th NUB handler complete — runtime switch is now (relay, identity, keys, media, notify, storage, ifc, theme); Plan 14 migrates all 8 into createDispatch/registerNub API"
  - "createXxxService return-bundle pattern: when a service needs host-facing methods outside ServiceHandler (like publishTheme), return { handler, ...hostApi } rather than attaching methods to the handler object"

requirements-completed: [TH-01, TH-02, TH-04]

duration: 4 min
completed: 2026-04-17
---

# Phase 13 Plan 01: Theme NUB Runtime + Reference Service Summary

**Theme NUB end-to-end (runtime dispatch + reference service with publishTheme broadcast handle), closing TH-01/TH-02/TH-04 via 2-task TDD cycle with 61 tests green.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-17T20:02:06Z
- **Completed:** 2026-04-17T20:06:44Z
- **Tasks:** 2 (TDD RED + GREEN; no REFACTOR needed)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- **TH-01 (runtime route):** Added `case 'theme':` + `handleThemeMessage` to the NIP-5D dispatch switch in `packages/runtime/src/runtime.ts`. Runtime now has 8 domain cases (relay, identity, keys, media, notify, storage, ifc, theme). Fallback path emits a spec-correct `theme.get.result` envelope with the canonical default theme so napplets always get a reply even without a registered `theme` service.
- **TH-02 (reference service):** Created `@kehto/services` `createThemeService({ initialTheme?, onBroadcast? })` returning `{ handler, publishTheme, getCurrentTheme }`. Handler answers `theme.get` with the current theme and emits canonical `.error` envelopes for unknown `theme.*` actions. `publishTheme(theme)` updates internal state, invokes `onBroadcast` with a `theme.changed` envelope, and returns that envelope — ready for Plan 13-02's shell adapter to wrap with a `sendToNapplet` fanout.
- **TH-04 (ACL enforcement test):** Added `describe('theme NUB dispatch (TH-01 + TH-04)', ...)` block to `packages/runtime/src/dispatch.test.ts` with three tests proving the end-to-end ACL gate: (1) granted napplet reaches the registered service; (2) blocked napplet gets `theme.get.error` with service NEVER invoked; (3) fallback path emits `theme.get.result` with canonical default theme when no service registered.

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): failing theme-service tests + TH-04 ACL enforcement** — `7717d28` (test)
2. **Task 2 (TDD GREEN): theme-service + runtime case 'theme' + barrel export** — `1540bce` (feat)

_Note: No REFACTOR commit — GREEN implementation was minimal and clean._

## Files Created/Modified

- `packages/services/src/theme-service.ts` (created, 199 lines) — `createThemeService` factory, `ThemeServiceOptions` + `ThemeService` interfaces, `DEFAULT_THEME` constant, `ServiceHandler` with `theme.get` handler + unknown-action `.error` path, `publishTheme` + `getCurrentTheme` host API.
- `packages/services/src/theme-service.test.ts` (created, 164 lines) — 8 tests covering descriptor, theme.get default/initialTheme, publishTheme broadcast wiring + getCurrentTheme read, ACL-denial envelope shape, unknown action, and onWindowDestroyed.
- `packages/services/src/index.ts` (modified) — Added `// ─── Theme Service (NIP-5D theme NUB) ───` section exporting `createThemeService`, `ThemeServiceOptions`, `ThemeService`.
- `packages/runtime/src/runtime.ts` (modified) — Added `handleThemeMessage` helper (mirrors `handleNotifyMessage`), `THEME_FALLBACK_DEFAULT` constant, and `case 'theme':` branch to the main dispatch switch.
- `packages/runtime/src/dispatch.test.ts` (modified) — Appended top-level `describe('theme NUB dispatch (TH-01 + TH-04)', ...)` block with 3 tests (happy path, ACL denial, fallback).

## Decisions Made

- **ThemeService return-bundle shape `{ handler, publishTheme, getCurrentTheme }`.** Plan offered two shapes (shape (a) separate bundle vs shape (b) method on handler); picked (a) as the plan preferred. Rationale: the shell adapter in Plan 13-02 needs to invoke `publishTheme` from the host-app context independent of the runtime's ServiceHandler dispatch surface, so keeping host API and handler API separate avoids conflating roles.
- **`onBroadcast` callback over direct sendToNapplet.** Keeps the service browser-agnostic and trivially unit-testable (the test in Plan 13-01 captures broadcasts into an array). Plan 13-02 will wire `onBroadcast` to a real fanout in the shell adapter.
- **Mirrored default theme values.** Runtime fallback keeps its own `THEME_FALLBACK_DEFAULT` local constant rather than importing from `@kehto/services` to preserve the one-way services->runtime dependency. Both constants are annotated with a "keep in sync with" JSDoc comment so future edits are flagged.
- **TH-04 denial uses `aclState.block()`.** The default ACL policy is `'permissive'`, so an unknown identity passes all caps by default. Block denies ALL caps unconditionally, which is the most robust way to prove the `theme:read` gate fires end-to-end. `grant('theme:read')` is still used in the happy-path test to remain robust if the default policy ever shifts to `'restrictive'`.

## Deviations from Plan

None - plan executed exactly as written.

The planner pre-specified the default shape choice ((a)), the runtime/services dependency direction, the mirrored-constants approach, and the exact JSDoc skeletons. Implementation followed the plan's `<action>` blocks verbatim; no Rule 1-4 deviations triggered.

## Issues Encountered

None — RED phase produced the expected 2 failures in dispatch.test.ts (TH-01 happy path + fallback; TH-04 denial test incidentally passed because the ACL gate at runtime.ts:1038-1046 was already wired via Phase 12's `themeMap`) + 1 suite failure in theme-service.test.ts (`Cannot find module './theme-service.js'`). GREEN phase flipped all three to green without any auto-fix deviations.

## User Setup Required

None - no external service configuration required.

## Self-Check

- [x] `packages/services/src/theme-service.ts` exists on disk (199 lines).
- [x] `packages/services/src/theme-service.test.ts` exists on disk (164 lines).
- [x] `grep -n "case 'theme':" packages/runtime/src/runtime.ts` → line 1086 (single match).
- [x] `grep -n "createThemeService" packages/services/src/index.ts` → exported in barrel.
- [x] `grep -rn "DRIFT-RT-05" packages/` returns zero matches.
- [x] Commits `7717d28` + `1540bce` present in `git log --oneline`.
- [x] `pnpm test:unit` → 444 passed / 19 skipped / 0 failed across 30 files.
- [x] `pnpm type-check` + `pnpm build` green across all 4 @kehto packages.

## Self-Check: PASSED

## Next Phase Readiness

- **Plan 13-02 ready:** All prerequisites satisfied. `createThemeService` exposes `publishTheme(theme): ThemeChangedMessage` and accepts `onBroadcast: (envelope) => void`. Plan 13-02's shell adapter wraps this by instantiating the service with `onBroadcast = (envelope) => forEach(napplets, (win) => sendToNapplet(win, envelope))`, then exposing a `bridge.publishTheme(theme)` method that calls `themeService.publishTheme(theme)`.
- **TH-03 (shell adapter API) remains open** — scoped to Plan 13-02, final plan in Phase 13.
- **DRIFT-SVC-06 closed** — theme service now exists in @kehto/services. DRIFT-SHELL-05 stays open until 13-02; DRIFT-RT-05 was never present in source (confirmed via grep).
- **No blockers for Plan 13-02.**

---
*Phase: 13-theme-nub-implementation*
*Completed: 2026-04-17*
