---
phase: 102-nap-inc-event-channel-parity
plan: 13
subsystem: shell-inc-binding
tags: [nap-inc, channels, lifecycle, bounded-buffer, vitest]
requires:
  - phase: 102-04
    provides: Symmetric INC channel handles and retained lifecycle state in the shared shell prelude
  - phase: 102-12
    provides: Phase 102 active-conformance guardrails
provides:
  - Bounded later delivery of one terminal inbound overflow handle
  - Regression coverage for unopened channel overflow lifecycle and inert terminal routing
affects: [phase-102-verification, shell, paja, playground]
tech-stack:
  added: []
  patterns:
    - Keep the 32-entry unopened queue bounded while handing one terminal overflow state to the next opened callback
    - Closed ChannelHandle instances do not register local event routes
key-files:
  created: []
  modified:
    - packages/shell/src/napplet-namespace.ts
    - packages/shell/src/napplet-namespace.test.ts
key-decisions:
  - "Retain one closed overflow state outside pendingOpened only until the first late onOpened delivery, preserving the existing 32-slot queue."
  - "Treat ChannelHandle.on on a terminal state as an inert subscription, so terminal handles cannot create a local event route."
patterns-established:
  - "Overflow lifecycle tests must prove close wire cardinality, late onOpened/onClosed delivery, and post-close inertness together."
requirements-completed: [INC-07]
coverage:
  - id: D1
    description: A saturated unopened channel queue closes the 33rd inbound channel once and later exposes its terminal symmetric handle.
    requirement: INC-07
    verification:
      - kind: unit
        ref: packages/shell/src/napplet-namespace.test.ts#retains one terminal inbound handle for late opened and closed callbacks when unopened delivery overflows
        status: pass
    human_judgment: false
  - id: D2
    description: The overflowed terminal handle replays its exact close record and remains unable to receive or send channel traffic.
    requirement: INC-07
    verification:
      - kind: unit
        ref: packages/shell/src/napplet-namespace.test.ts#retains one terminal inbound handle for late opened and closed callbacks when unopened delivery overflows
        status: pass
    human_judgment: false
metrics:
  duration: 8 min
  completed: 2026-07-23
status: complete
---

# Phase 102 Plan 13: Bounded Terminal Overflow Handle Summary

**The shared INC binding now closes a saturated inbound channel once while preserving its terminal handle and exact close record for the first later `channel.onOpened()` callback.**

## Performance

- **Duration:** 8 min
- **Completed:** 2026-07-23
- **Tasks:** 1/1
- **Files modified:** 2

## Accomplishments

- Added a fail-first executed-prelude regression that fills all 32 unopened slots, overflows one inbound channel, and verifies its complete public lifecycle.
- Kept `pendingOpened` at its existing 32-entry bound while retaining one terminal overflow state only until it is handed to a late opened callback.
- Made terminal handles inert for event subscriptions, inbound channel events, outbound emits, and duplicate close attempts.

## Task Commits

1. **Task 1: Retain the overflowed inbound handle as a bounded terminal delivery** — `5de0fff` (TDD RED), `bd709a6` (TDD GREEN)

## Files Created/Modified

- `packages/shell/src/napplet-namespace.ts` — retains and drains one terminal overflow state without raising the unopened queue cap.
- `packages/shell/src/napplet-namespace.test.ts` — proves close cardinality, late terminal callback delivery, and inert terminal behavior.

## NAP Authority Checked

- Draft `napplet/naps` PR #92, `naps/NAP-INC.md` at `c5cd06f7be6d4690b303949abb26e87ff62f4729`.
- [kehto/web#203 resolution](https://github.com/kehto/web/issues/203#issuecomment-5060904495).

The draft requires the binding to retain incoming handles and terminal records, and permits bounded buffers only when overflow closes and notifies instead of silently dropping lifecycle state. The bounded one-state handoff is conformant with the planned D-06/D-12 interpretation; no upstream semantic conflict was found.

## Decisions Made

- `pendingOpened` remains exactly bounded at 32; the terminal handoff is a single ephemeral state and is cleared immediately after the first late `onOpened` delivery.
- A terminal handle's `on` call returns a closeable inert subscription rather than registering a callback against a closed route.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The new regression failed before the implementation because the overflowed state was closed but never queued for late `onOpened`; this was the expected TDD RED result.

## User Setup Required

None - no external service configuration required.

## Verification

- `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts` — passed (20 tests)
- `pnpm --filter @kehto/shell type-check` — passed
- `git diff --check` — passed

## Next Phase Readiness

- The concrete `102-VERIFICATION.md` overflow gap now has focused regression coverage and can be re-verified with the Phase 102 goal check.
- The known published-package E2E adoption gate remains owned by Phase 105.

## Self-Check: PASSED

- Confirmed both declared shell files exist and task commits `5de0fff` and `bd709a6` are present in history.

---

*Phase: 102-nap-inc-event-channel-parity*
*Completed: 2026-07-23*
