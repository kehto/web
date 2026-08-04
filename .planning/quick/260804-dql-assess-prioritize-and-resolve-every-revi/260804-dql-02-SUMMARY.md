---
phase: quick-260804-dql
plan: "02"
subsystem: paja-browser-device-services
tags: [paja, nap-serial, nap-ble, web-serial, web-bluetooth, vitest]
requires:
  - phase: quick-260804-dql-01
    provides: immutable review authority inventory
provides:
  - serial write-tail recovery after caller-visible failures
  - failure-safe BLE notification ownership cleanup
affects: [quick-260804-dql-03, review-resolution]
tech-stack:
  added: []
  patterns:
    - retain a caller-visible queued operation separately from a settled queue continuation
    - release local subscription ownership before awaiting fallible platform cleanup
key-files:
  created:
    - .planning/quick/260804-dql-assess-prioritize-and-resolve-every-revi/260804-dql-02-SUMMARY.md
  modified:
    - packages/paja/src/browser-device-services.ts
    - packages/paja/src/browser-device-services.test.ts
    - .planning/quick/260804-dql-assess-prioritize-and-resolve-every-revi/260804-dql-REVIEW-INVENTORY.md
key-decisions:
  - "Serial callers receive their own failure while writeTail always resumes as a settled continuation for the next ordered write."
  - "BLE drops listener and map ownership before stopNotifications so platform failure remains caller-visible without retaining a subscription."
requirements-completed: [QUICK-260804-DQL]
coverage:
  - id: D1
    description: A rejected serial write reports its own error and does not block the next ordered write.
    requirement: QUICK-260804-DQL
    verification:
      - kind: unit
        ref: pnpm exec vitest run packages/paja/src/browser-device-services.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: A rejecting BLE stopNotifications call releases local listener/map ownership while returning its platform error.
    requirement: QUICK-260804-DQL
    verification:
      - kind: unit
        ref: pnpm exec vitest run packages/paja/src/browser-device-services.test.ts
        status: pass
    human_judgment: false
duration: 12m
completed: 2026-08-04
status: complete
---

# Quick 260804-dql Plan 02: Browser Device Failure Recovery Summary

**Paja now keeps serial writes recoverable after a rejected writer and releases BLE subscription ownership even when browser notification shutdown fails.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-08-04
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments

- Re-read the immutable NAP-SERIAL authority at `a3891d4bab8ec9418a1ebacba9e261b89b7297ee`; C05 now preserves caller-visible correlated write errors while normalizing the internal per-session queue tail for later ordered writes.
- Re-read the immutable NAP-BLE authority at `e14de22a794d24c2431834105d50efd0bd89d459`; C06 now releases the local event listener and subscription map entry before awaiting browser cleanup, while retaining the original cleanup error for the caller.
- Updated the shared review inventory with request/result direction, lifecycle, and security-boundary evidence for both claims. No review replies or resolutions were made.

## Verification

- `pnpm exec vitest run packages/paja/src/browser-device-services.test.ts` — **4 passed**.
- `pnpm type-check --filter @kehto/paja` — **passed** (including the required build).
- `pnpm test:unit` — **142 files / 1663 tests passed**.
- `git diff --check HEAD~5..HEAD` — **passed**.
- AI-slop gate could not run locally because `.aislop/config.yml` is present but `pnpm exec aislop` reports `Command "aislop" not found`; this is outside this plan's automated verification command.

## Task Commits

1. **Task 1: Recover the serial write queue after rejection** — `7904622` (`test`), `4fcb0d6` (`fix`), `7a81a6b` (`docs`)
2. **Task 2: Make BLE unsubscribe cleanup failure-safe** — `fc51f55` (`test`), `da4dcc2` (`fix`), `90aa7f4` (`docs`)

## Decisions Made

- A-SERIAL explicitly requires same-id correlated results and per-session write ordering; the settled queue continuation is the minimal Paja mechanism that fulfills both after a rejected browser writer.
- A-BLE defines the correlated unsubscribe contract and runtime-owned lifecycle but not browser cleanup order or missing-subscription behavior. Deleting ownership before the await is bounded Kehto policy that preserves the established no-op retry contract and propagates the original stop error.

## Deviations from Plan

None - plan executed as specified.

## Known Stubs

None.

## Next Phase Readiness

Plans 03–06 can rely on the updated C05 and C06 ledger evidence. Both review threads remain unresolved until the final plan pushes the supporting commits and reconciles exact-head CI.

## Self-Check: PASSED

All three modified artifacts and this summary exist; all six task and inventory commits are present; C05/C06 ledger rows contain their immutable authority, regression, and fix evidence; and no stub markers were found in the changed source or test file.
