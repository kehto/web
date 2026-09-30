---
phase: 107-ipc-transport-foundation
plan: 04
subsystem: ipc-transport
tags: [typescript, node, unix-socket, backpressure, fifo, vitest]
requires:
  - phase: 107-01
    provides: private IPC endpoint and outbound queue tracer seam
provides:
  - byte-accurate, finite outbound queue admission
  - one-owner FIFO backpressure and terminal-state handling
  - endpoint propagation of queue limits and terminal diagnostics
affects: [107-05, ipc-shell, phase-108-runtime-composition]
tech-stack:
  added: []
  patterns: [owned Buffer frames, callback-pending accounting, single drain owner]
key-files:
  created: [packages/shell-ipc/src/outbound-queue.test.ts, .changeset/quiet-rice-queue.md]
  modified: [packages/shell-ipc/src/outbound-queue.ts, packages/shell-ipc/src/ipc-shell.ts, packages/shell-ipc/src/ipc-shell.test.ts]
key-decisions:
  - "Count and byte limits retain callback-pending writes until their completion callback settles."
  - "Accepted peers receive endpoint-configured outbound limits and emit one host-bound terminal diagnostic."
patterns-established:
  - "Outbound queues own immutable Buffer copies and use one guarded FIFO flush loop per peer."
requirements-completed: [IPC-04]
coverage:
  - id: D1
    description: "Finite byte-accurate outbound queue admission, including zero and invalid-limit policies."
    requirement: IPC-04
    verification:
      - kind: unit
        ref: "packages/shell-ipc/src/outbound-queue.test.ts#createOutboundQueue admission"
        status: pass
    human_judgment: false
  - id: D2
    description: "FIFO egress survives write(false), drain, stale callback, and terminal race schedules."
    requirement: IPC-04
    verification:
      - kind: unit
        ref: "packages/shell-ipc/src/outbound-queue.test.ts#backpressure and terminal races"
        status: pass
    human_judgment: false
  - id: D3
    description: "Endpoint peer queues consume configured outbound limits and report overflow diagnostics."
    requirement: IPC-04
    verification:
      - kind: integration
        ref: "packages/shell-ipc/src/ipc-shell.test.ts#applies endpoint outbound limits"
        status: pass
    human_judgment: false
duration: 3min
completed: 2026-08-18
status: complete
---

# Phase 107 Plan 04: Bounded Egress Summary

**Finite, byte-accurate FIFO IPC egress queues that preserve order through Node socket backpressure and terminal races.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-18T16:20:00Z
- **Completed:** 2026-08-18T16:23:08Z
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- Bound per-peer queues by encoded bytes and frame count, retaining callback-pending writes in accounting.
- Proved ordered A/B/C/D writes with exactly one drain listener under repeated and reentrant drain delivery.
- Wired per-endpoint queue limits and one host-bound terminal diagnostic into accepted peer queues.

## Task Commits

1. **Task 1: Enforce exact count/encoded-byte admission and limit precision** - `ed79ca2` (test), `0fb9bc2` (feat)
2. **Task 2: Serialize write(false), drain, enqueue, completion, and terminal races** - `6079058` (feat)

**Release metadata:** `fb2297f` (chore: shell IPC changeset)

## Files Created/Modified

- `packages/shell-ipc/src/outbound-queue.ts` - finite, single-owner outbound write state machine.
- `packages/shell-ipc/src/outbound-queue.test.ts` - limit, UTF-8 byte accounting, drain-race, and terminal-state vectors.
- `packages/shell-ipc/src/ipc-shell.ts` - forwards endpoint limits and queue terminal diagnostics to each accepted peer.
- `packages/shell-ipc/src/ipc-shell.test.ts` - verifies an overflowing peer closes and reports its diagnostic.
- `.changeset/quiet-rice-queue.md` - records the experimental package behavior change for release.

## Decisions Made

- Use immutable Buffer copies and `Buffer.length` for queue accounting so UTF-8 source character count cannot bypass the byte limit.
- Retain each frame until its Node write callback settles; a false write only pauses future writes until the one drain handler resumes.
- Treat configured outbound limits and terminal diagnostics as per-peer endpoint policy, not hard-coded queue defaults.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Applied endpoint queue limits and terminal diagnostics to accepted peers**
- **Found during:** Task 2
- **Issue:** `IpcTransportLimits` outbound values and terminal diagnostic codes were not passed to `createOutboundQueue`, leaving production peers on implicit defaults without host diagnostics.
- **Fix:** Forwarded both limits and one terminal callback; exposed the four queue error codes through `IpcTransportErrorCode` and added an endpoint regression.
- **Files modified:** `packages/shell-ipc/src/ipc-shell.ts`, `packages/shell-ipc/src/ipc-shell.test.ts`
- **Verification:** Focused IPC queue and endpoint tests, package type-check, full build, full type-check, and 1704 unit tests pass.
- **Committed in:** `6079058`

**2. [Rule 2 - Release Completeness] Added the required shell IPC changeset**
- **Found during:** Plan completion
- **Issue:** Shipped package behavior changed without release metadata required by project policy.
- **Fix:** Added a minor changeset for `@kehto/shell-ipc`.
- **Files modified:** `.changeset/quiet-rice-queue.md`
- **Verification:** Changeset is committed with the package change.
- **Committed in:** `fb2297f`

---

**Total deviations:** 2 auto-fixed (2 Rule 2)
**Impact on plan:** Both changes complete the planned per-peer limit and diagnostic contract without expanding into runtime composition.

## Issues Encountered

- The Task 2 race suite passed on its first run because Task 1's required callback-pending accounting already necessitated the same guarded single-owner flush state; the additional tests lock that behavior in.
- `aislop` completed with exit status 0 at 90/100, reporting four pre-existing warnings in `json-sequence.ts` and an unchanged double assertion in `ipc-shell.ts`; no new slop findings were introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 107-05 can build on bounded egress with malformed-input and filesystem ownership coverage. No blocker remains for IPC-04.

## Self-Check: PASSED

- Confirmed all five plan-owned source/release files exist.
- Confirmed task and release commits `ed79ca2`, `0fb9bc2`, `6079058`, and `fb2297f` exist.

---
*Phase: 107-ipc-transport-foundation*
*Completed: 2026-08-18*
