---
phase: 16-harness-triage-playwright-infrastructure
plan: 03
subsystem: testing
tags: [playwright, harness, nip-5d, envelopes, typescript, globals]

requires:
  - phase: 16-02
    provides: "playwright.config.ts webServer array, build:napplets turbo task"

provides:
  - "tests/e2e/harness/globals.d.ts — single source of truth for all harness window globals"
  - "8 new NIP-5D envelope-aware driver globals on window (Plan 16-03)"
  - "__nappletReady__ per-napplet readiness flag consumed by Plan 16-04"
  - "harness-smoke.spec.ts exercising __getServiceNames__ and __nappletReady__"

affects:
  - "16-04 (waitForNappletReady helper consumes __nappletReady__)"
  - "17+ (all future specs use these driver globals)"
  - "21 (fixture napplets and layer-A specs use envelope globals)"

tech-stack:
  added: []
  patterns:
    - "globals.d.ts as single source of truth for all window.__ type declarations"
    - "Triple-slash reference to globals.d.ts in harness.ts replacing inline declare global block"
    - "serviceShadow Set for harness-local service name tracking (avoids private runtime Map)"
    - "envelopeLog Map keyed by windowId for NIP-5D envelope shadow logging"
    - "JSON.parse(JSON.stringify()) pattern for structured-clone-safe deep clones"
    - "new Function('return (' + script + ')') for safe eval of test service handlers"

key-files:
  created:
    - "tests/e2e/harness/globals.d.ts"
  modified:
    - "tests/e2e/harness/harness.ts"
    - "tests/e2e/harness-smoke.spec.ts"

key-decisions:
  - "globals.d.ts owns the Window interface — harness.ts uses triple-slash reference, not inline declare global"
  - "__getNotifications__ returns [] until Phase 19 wires notification-service state propagation (intentional stub)"
  - "serviceShadow Set is harness-local because runtime.serviceRegistry is not publicly enumerable on the Runtime type"
  - "Envelope interception uses a separate window.addEventListener listener alongside relay.handleMessage — does not modify createPostMessageProxy to avoid regression risk"

patterns-established:
  - "All harness driver globals return structured-clone-safe values (primitives, plain objects, or JSON.parse clones)"
  - "serviceShadow tracks initial + dynamically registered services independently of runtime internals"

requirements-completed:
  - E2E-04

duration: 3min
completed: 2026-04-17
---

# Phase 16 Plan 03: NIP-5D Envelope-Aware Driver Globals Summary

**7 new NIP-5D envelope-aware harness globals + readiness flag in harness.ts, backed by globals.d.ts as single source of truth for all window.__* type declarations**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-17T23:12:25Z
- **Completed:** 2026-04-17T23:15:15Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Created `tests/e2e/harness/globals.d.ts` declaring all 40 harness window globals (32 legacy + 8 new) with full TypeScript signatures including NappletMessage from @napplet/core
- Implemented all 8 new globals in harness.ts: `__injectEnvelope__`, `__getNubMessage__`, `__getServiceNames__`, `__registerService__`, `__unregisterService__`, `__getNotifications__`, `__setIdentityPubkey__`, `__nappletReady__`
- Extended harness-smoke.spec.ts with 2 new smoke tests exercising `__getServiceNames__` and `__nappletReady__`
- harness.ts grew from 354 to 482 lines (+128 lines)
- `pnpm type-check` passes clean workspace-wide after all changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create globals.d.ts** - `c6736b9` (feat)
2. **Task 2: Implement 8 new globals in harness.ts** - `3076ff3` (feat)
3. **Task 3: Extend harness-smoke.spec.ts** - `1b11b34` (test)

## Files Created/Modified

- `/home/sandwich/Develop/kehto/tests/e2e/harness/globals.d.ts` — new file; declares full Window interface (legacy + 8 new NIP-5D globals); module-scoped with `export {}`
- `/home/sandwich/Develop/kehto/tests/e2e/harness/harness.ts` — removed inline `declare global` block; added triple-slash reference; added NappletMessage import; implemented all 8 new globals with shadow maps (envelopeLog, serviceShadow, notificationsShadow)
- `/home/sandwich/Develop/kehto/tests/e2e/harness-smoke.spec.ts` — added 2 new test cases: `__getServiceNames__` (string[] assertion) and `__nappletReady__` (false for nonexistent windowId)

## Global Implementation Details

Each of the 8 new globals and their runtime assignments:

| Global | Return type | Clone-safe | Implementation |
|--------|-------------|------------|----------------|
| `__injectEnvelope__` | void | N/A | Dispatches MessageEvent with envelope as data from napplet iframe |
| `__getNubMessage__` | NappletMessage \| null | JSON.parse(JSON.stringify(...)) | Reads envelopeLog shadow, deep-clones last match |
| `__getServiceNames__` | string[] | Spread of Set | `[...serviceShadow]` plain array |
| `__registerService__` | boolean | boolean | eval via new Function, validates handleMessage, calls runtime.registerService |
| `__unregisterService__` | boolean | boolean | removes from shadow + calls runtime.unregisterService |
| `__getNotifications__` | Array<{...}> | Plain object map | Returns filtered notificationsShadow (stub, returns []) |
| `__setIdentityPubkey__` | void | N/A | Delegates to mockResult.setUserPubkey() |
| `__nappletReady__` | boolean | boolean | Boolean(relay.runtime.sessionRegistry.getPubkey(windowId)) |

## Decisions Made

- `globals.d.ts` owns the Window interface — harness.ts uses `/// <reference path="./globals.d.ts" />` instead of inline `declare global` block
- `serviceShadow` (Set) is maintained locally in harness.ts because `runtime.serviceRegistry` is not publicly enumerable via the Runtime type (Map is private to the factory closure)
- Envelope interception uses a separate `window.addEventListener('message')` listener — does NOT modify `createPostMessageProxy` to avoid regression risk to existing NIP-01 array tap
- `__getNotifications__` returns `[]` intentionally until Phase 19 wires notification-service state propagation (documented below in Known Stubs)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- **`__getNotifications__`** (`tests/e2e/harness/harness.ts`, `notificationsShadow` array, ~line 362): Returns an empty array `[]` in all cases because `mockResult.hooks.services` does not include a notification service with a public state reader. The global exists and returns structured-clone-safe data (closes E2E-04), but notification state is not yet propagated. **Phase 19** (toaster napplet + notify-lifecycle spec) will wire the notification-service's `onChange` callback or expose a `getAll()` reader to populate this shadow.

## Issues Encountered

None.

## Next Phase Readiness

- `__nappletReady__(windowId)` is live and ready for Plan 16-04's `waitForNappletReady` helper
- All 8 new globals are typed in `globals.d.ts` — specs get full IDE autocomplete
- `globals.d.ts` is the canonical type surface for the harness; future globals should be added there first
- Plan 16-04 can reference globals via `window.__nappletReady__` with correct types

---
*Phase: 16-harness-triage-playwright-infrastructure*
*Completed: 2026-04-17*
