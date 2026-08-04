---
phase: quick-260804-dql
plan: "04"
subsystem: services-lifecycle
tags: [nap-serial, nap-notify, nip-5d, lifecycle, vitest]
requires:
  - phase: quick-260804-dql-03
    provides: immutable review inventory and completed C09 DM ownership correction
provides:
  - source-bound serial callback delivery across destroy and window-id reuse
  - result-first serial opening event delivery with terminal connection teardown
  - notification presentation completion guarded by current active ownership
affects: [quick-260804-dql-05, quick-260804-dql-06, review-resolution]
tech-stack:
  added: []
  patterns:
    - compare delayed callbacks against the current per-window ownership record
    - buffer pushed events during correlated operation setup and flush only after success
key-files:
  created:
    - .planning/quick/260804-dql-assess-prioritize-and-resolve-every-revi/260804-dql-04-SUMMARY.md
  modified:
    - packages/services/src/serial-service.ts
    - packages/services/src/serial-service.test.ts
    - packages/services/src/notify-service.ts
    - packages/services/src/notify-service.test.ts
    - .planning/quick/260804-dql-assess-prioritize-and-resolve-every-revi/260804-dql-REVIEW-INVENTORY.md
key-decisions:
  - "Serial callbacks are valid only while their exact window record remains current; an equal reused window ID is not sufficient."
  - "Serial opening events are buffered until the successful correlated open result; the NAP leaves this ordering as Kehto projection policy."
  - "C12's review anchor is corrected to notify-service.ts because relay-pool-service.test.ts does not own notification presentation lifecycle."
patterns-established:
  - "Lifecycle ownership: reserve a record, compare record identity after every await, and release or close late-acquired resources."
requirements-completed: [QUICK-260804-DQL]
coverage:
  - id: D1
    description: Serial callbacks from a destroyed or reused window are silent.
    requirement: QUICK-260804-DQL
    verification:
      - kind: unit
        ref: packages/services/src/serial-service.test.ts#suppresses a destroyed window context after that window id is reused
        status: pass
    human_judgment: false
  - id: D2
    description: Serial opening sends its correlated result before buffered events and rejects events after close or destroy.
    requirement: QUICK-260804-DQL
    verification:
      - kind: unit
        ref: packages/services/src/serial-service.test.ts#lets the host deliver serial data and lifecycle events
        status: pass
      - kind: unit
        ref: packages/services/src/serial-service.test.ts#suppresses serial events after their session closes or window is destroyed
        status: pass
    human_judgment: false
  - id: D3
    description: Destroyed notification presentations cannot later send results or interaction callbacks and are closed after late acquisition.
    requirement: QUICK-260804-DQL
    verification:
      - kind: unit
        ref: packages/services/src/notify-service.test.ts#closes a presentation that resolves after its window is destroyed without sending a result
        status: pass
      - kind: unit
        ref: packages/services/src/notify-service.test.ts#rejects a destroyed presentation callback after the window id is reused
        status: pass
    human_judgment: false
duration: 6m 27s
completed: 2026-08-04
status: complete
---

# Quick 260804-dql Plan 04: Service Callback Lifecycle Summary

**Serial and notification services now bind delayed callbacks to current window ownership, order serial open results before events, and close notifications that finish after teardown.**

## Performance

- **Duration:** 6m 27s
- **Started:** 2026-08-04T09:54:22Z
- **Completed:** 2026-08-04T10:00:49Z
- **Tasks:** 3 lifecycle claims complete (C10–C12)
- **Files modified:** 5

## Accomplishments

- C10 makes all serial request results and captured event callbacks conditional on an exact live-window record, preventing destroyed or reused window IDs from receiving stale data.
- C11 buffers synchronous `serial.event` output until its successful `serial.open.result`, then invalidates sessions before close/destroy cleanup.
- C12 moves the mis-anchored review evidence to the real notification owner and prevents late presentation completion or callbacks from reaching a destroyed/reused window; late-acquired presentations are dismissed.
- Updated the review inventory with the immutable NAP-SERIAL, NAP-NOTIFY, and NIP-5D authority mappings, focused red tests, green commits, and the C12 anchor correction.

## Verification

- `pnpm exec vitest run packages/services/src/serial-service.test.ts packages/services/src/notify-service.test.ts` — **18 passed**.
- `pnpm test:unit` — **142 files / 1671 tests passed**.
- `pnpm type-check --filter @kehto/services` — **passed** (including the required build).
- `git diff --check` — **passed**.
- `pnpm exec aislop` — **not run:** executable is unavailable (`Command "aislop" not found`); recorded in `.planning/WINDOWS.md` as entry 28 without installing a package.

## Task Commits

1. **C10: Expire serial callbacks with destroyed windows** — `6659b6c` (`test`), `251b077` (`fix`)
2. **C11: Order and terminate serial lifecycle events** — `89b9981` (`test`), `4e59c86` (`fix`)
3. **C12: Expire notification presentation ownership** — `b074fda` (`test`), `5f520ef` (`fix`)

## Decisions Made

- NAP-SERIAL `a3891d4bab8ec9418a1ebacba9e261b89b7297ee` requires correlated results, runtime-owned events, and session closure on unload, but does not order an open result relative to synchronous events. Result-first buffering is therefore an explicit, bounded Kehto projection policy.
- NIP-5D `eb45dfd7335b7f88cb53781984c553581d2b4c34` makes `MessageEvent.source` lifecycle identity. The serial service represents that invariant with non-reusable current-window record identity.
- NAP-NOTIFY `e14f5c9d6a6dd2a69ccf79668c4a3c1e955e1ac9` requires per-iframe notification removal and silent unknown IDs. The active-map identity check is the Kehto policy that makes delayed host callbacks conform to that lifecycle.

## Deviations from Plan

### Prior Completion

Plan 04's written Task 1 repeats C09 DM synchronous subscription ownership, which Plan 03 already completed (`f6e4b27`, `e02f2a4`) before this plan began. Per the assigned scope, this plan did not duplicate that change and instead completed the remaining C10–C12 lifecycle claims.

## Known Stubs

None.

## Threat Flags

None. This plan changes only in-process lifecycle ownership checks; it adds no endpoint, trust boundary, or persisted schema.

## Next Phase Readiness

Plans 05–06 can rely on resolved C10–C12 inventory evidence. Review replies and thread resolution remain deliberately deferred until the final plan pushes the supporting commits and reconciles exact-head CI.

## Self-Check: PASSED

All five changed artifacts and this summary exist; all six C10–C12 red/green commits are present; focused and repository-wide unit tests pass; and no stub markers were found in modified service/test files.
