---
phase: 102-nap-inc-event-channel-parity
plan: 09
subsystem: runtime-routing
tags: [runtime, nap-inc, service-dispatch, vitest, security]
requires:
  - phase: 102-01
    provides: Exact INC subscription runtime ownership and stable topic routing
provides:
  - Generic service routing without INC topic-prefix dispatch
  - Exact-type guard reserving inc.emit for IncRuntime
affects: [runtime, inc, service-handlers, phase-102]
tech-stack:
  added: []
  patterns: [Direct service domains route from message.type; INC emits bypass generic service handlers]
key-files:
  created: [packages/runtime/src/service-dispatch.test.ts]
  modified: [packages/runtime/src/service-dispatch.ts]
key-decisions:
  - "Treat inc.emit as an exact runtime-owned message before generic domain lookup."
  - "Keep direct notify.* routing keyed by its wire message type domain."
patterns-established:
  - "INC topic strings are opaque to generic dispatch; never split, prefix-match, wildcard-match, or parse them."
requirements-completed: [BASE-05, INC-04]
coverage:
  - id: D1
    description: "Generic services route canonical direct-domain envelopes while leaving all inc.emit topics opaque."
    requirement: BASE-05
    verification:
      - kind: unit
        ref: "packages/runtime/src/service-dispatch.test.ts#routeServiceMessage"
        status: pass
    human_judgment: false
  - id: D2
    description: "inc.emit remains exclusively owned by the INC runtime, even if a generic inc service is registered."
    requirement: INC-04
    verification:
      - kind: unit
        ref: "packages/runtime/src/service-dispatch.test.ts#does not delegate inc.emit to a generic inc service"
        status: pass
    human_judgment: false
duration: 5min
completed: 2026-07-23
status: complete
---

# Phase 102 Plan 09: Exact Generic Service Routing Summary

**Generic service dispatch now routes only direct wire domains while INC emits remain exclusively handled by the exact INC runtime path.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-23T17:59:35Z
- **Completed:** 2026-07-23T18:04:34Z
- **Tasks:** 1/1
- **Files modified:** 2

## Accomplishments

- Removed the legacy `inc.emit` topic-prefix service fallback, so topic text cannot select host services.
- Preserved direct-domain dispatch for canonical envelopes such as `notify.create`.
- Added focused regressions for prefix-like, query-bearing, unknown, and generic-`inc` service cases.

## Task Commits

1. **Task 1: Remove INC topic-prefix interception from generic dispatch (RED)** - `9f185ca` (test)
2. **Task 1: Protect INC runtime ownership (RED extension)** - `f0106c1` (test)
3. **Task 1: Remove INC topic-prefix interception from generic dispatch (GREEN)** - `fff2aa0` (fix)

## Files Created/Modified

- `packages/runtime/src/service-dispatch.ts` - Routes only direct wire domains and reserves `inc.emit` for `IncRuntime`.
- `packages/runtime/src/service-dispatch.test.ts` - Proves exact direct routing and opaque INC topic handling.

## Decisions Made

- Checked NAP-INC draft PR #89 at `4593ce9e301ce098fd3dad64206fcd6f144fa7af` and web projection draft PR #90 at `896c32c92deee68dc4d10fc1132b62df20cccb6f`; exact queryless topic identity and projection-only normalization are conformant with both proposed authorities.
- Preserve `notify.*` service routing by the direct wire domain while returning false for exact `inc.emit` before generic service lookup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Protected INC ownership from a generic `inc` registry entry**
- **Found during:** Task 1: Remove INC topic-prefix interception from generic dispatch
- **Issue:** Removing the legacy topic fallback alone still allowed an explicitly registered generic `inc` service to receive `inc.emit` through the direct domain lookup.
- **Fix:** Added an exact `message.type === 'inc.emit'` early return and a regression proving no generic `inc` handler is invoked.
- **Files modified:** `packages/runtime/src/service-dispatch.ts`, `packages/runtime/src/service-dispatch.test.ts`
- **Verification:** Focused suite passes all 8 tests.
- **Committed in:** `f0106c1`, `fff2aa0`

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Necessary to uphold the plan's single-owner INC routing and elevation-of-privilege mitigation; no scope expansion.

## Issues Encountered

- `npx --no-install aislop scan -d` could not run because `aislop@0.13.1` is not installed locally. The phase threat model forbids package installation, so this verification remains recorded for the shared quality gate.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Subsequent Phase 102 plans can rely on generic service dispatch never interpreting INC topics.
- Build, repository type-check, and 1,343-unit-test suite pass. The AI-slop executable must be restored by the shared environment before the final phase quality gate.

## Self-Check: PASSED

- Confirmed both runtime routing files and this summary exist.
- Confirmed task commits `9f185ca`, `f0106c1`, and `fff2aa0` exist in git history.

---
*Phase: 102-nap-inc-event-channel-parity*
*Completed: 2026-07-23*
