---
phase: 107-ipc-transport-foundation
plan: 03
subsystem: ipc-transport
tags: [typescript, node, unix-socket, filesystem-ownership, race-safety]
requires:
  - phase: 107-01
    provides: host-bound IPC transport tracer
  - phase: 107-05
    provides: private endpoint contracts and terminal ingress classification
provides:
  - fingerprint-guarded private Unix-socket allocation and cleanup
  - generation-owned endpoint reservation, rollback, and close lifecycle
affects: [phase-108-runtime-composition, ipc-transport]
tech-stack:
  added: []
  patterns: [lstat-compare-before-unlink, synchronous-reservation, generation-owned-cleanup]
key-files:
  created: [packages/shell-ipc/src/socket-directory.test.ts]
  modified: [packages/shell-ipc/src/socket-directory.ts, packages/shell-ipc/src/endpoint-registry.ts, packages/shell-ipc/src/endpoint-registry.test.ts, packages/shell-ipc/src/ipc-shell.ts, packages/shell-ipc/src/types.ts]
key-decisions:
  - "Socket cleanup requires unchanged device/inode/mode fingerprints and never treats a substituted entry as owned."
  - "Endpoint reservations are inserted synchronously and lifecycle callbacks act only on their current safe-integer generation."
patterns-established:
  - "Private socket cleanup: lstat the directory and socket immediately before unlink/rmdir, then reject rather than delete on a mismatch."
  - "Endpoint lifecycle: reserve before awaits, transition through creating/active/closing, and compare generation before mutation."
requirements-completed: [IPC-01]
coverage:
  - id: D1
    description: "Private mode-0700 directories use a fixed basename, UTF-8 byte limits, and lstat-proven owned cleanup."
    requirement: IPC-01
    verification:
      - kind: integration
        ref: "packages/shell-ipc/src/socket-directory.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Duplicate registration, retry, idempotent close, and delayed old-generation cleanup preserve the current endpoint."
    requirement: IPC-01
    verification:
      - kind: integration
        ref: "packages/shell-ipc/src/endpoint-registry.test.ts"
        status: pass
    human_judgment: false
duration: 5min
completed: 2026-08-18
status: complete
---

# Phase 107 Plan 03: Race-Safe Socket Ownership Summary

**Private Unix-socket directories now retain filesystem fingerprints, and host endpoint generations serialize duplicate creation and stale cleanup.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-18T16:32:00Z
- **Completed:** 2026-08-18T16:37:04Z
- **Tasks:** 2/2
- **Files modified:** 6

## Accomplishments

- Created mode-0700, short fixed-basename socket directories with UTF-8 path bounds and device/inode/mode ownership fingerprints.
- Refused active, unrecorded, substituted, non-socket, and out-of-root cleanup targets; stale recovery rechecks identity after its liveness probe.
- Serialized endpoint registration before filesystem work and guarded activation, rollback, and close against obsolete generations.
- Added deterministic lifecycle race coverage plus real Unix-socket stale and substitution fixtures.

## Task Commits

1. **Task 1: Guard private pathname allocation, stale recovery, and exact owned cleanup** - `38fb41c` (feat)
2. **Task 2: Serialize duplicate registration and generation-owned rollback/cleanup** - `5ffe0ba` (feat)

## Files Created/Modified

- `packages/shell-ipc/src/socket-directory.ts` - private directory allocation, ownership fingerprints, stale probing, and guarded cleanup.
- `packages/shell-ipc/src/socket-directory.test.ts` - real filesystem/socket containment, stale, substitution, and cleanup coverage.
- `packages/shell-ipc/src/endpoint-registry.ts` - creating/active/closing records and generation-guarded lifecycle methods.
- `packages/shell-ipc/src/endpoint-registry.test.ts` - deterministic reservation and replacement race coverage with real socket lifecycle assertions.
- `packages/shell-ipc/src/ipc-shell.ts` - integrates generation-owned directories and cleanup with the public transport.
- `packages/shell-ipc/src/types.ts` - typed endpoint and ownership error codes.

## Decisions Made

- Retained full socket paths only on host endpoint handles; diagnostics continue to expose only endpoint identity and codes.
- Treat a changed filesystem identity as a typed ownership/substitution failure, never as a recoverable missing socket.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Verification compatibility] Removed the unsupported Vitest `-x` flag from executed verification commands.**
- **Found during:** Task 1
- **Issue:** Vitest 4.1.2 rejects `-x` as an unknown option.
- **Fix:** Ran the exact focused test sets without `-x`; all completed successfully.
- **Files modified:** None
- **Verification:** Focused tests, package type-check, repository build/type-check, and unit suite passed.
- **Committed in:** N/A

**2. [Rule 3 - Plan drift] Extended the existing endpoint-registry test instead of creating a second file.**
- **Found during:** Task 2
- **Issue:** `packages/shell-ipc/src/endpoint-registry.test.ts` already existed from Plan 107-05.
- **Fix:** Preserved its coverage and added deterministic reservation, rollback, replacement, and real-socket lifecycle cases.
- **Files modified:** `packages/shell-ipc/src/endpoint-registry.test.ts`
- **Verification:** Focused integration tests passed.
- **Committed in:** `5ffe0ba`

---

**Total deviations:** 2 auto-fixed (1 verification compatibility, 1 plan drift).
**Impact on plan:** Both adjustments preserve the intended IPC-01 proof without broadening protocol scope.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 108 can compose runtime session behavior on endpoint resources whose path and lifecycle cleanup are now constrained to the owning registration generation.

## Self-Check: PASSED

- Confirmed all six implementation/test files exist.
- Confirmed task commits `38fb41c` and `5ffe0ba` exist.
- Confirmed focused IPC tests, `pnpm test:unit` (1734 tests), `pnpm type-check`, and `pnpm build` pass.
