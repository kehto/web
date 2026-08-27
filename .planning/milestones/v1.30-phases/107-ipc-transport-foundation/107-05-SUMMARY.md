---
phase: 107-ipc-transport-foundation
plan: 05
subsystem: ipc-transport
tags: [typescript, node, rfc7464, utf8, lifecycle]
requires:
  - phase: 107-01
    provides: IPC transport tracer
  - phase: 107-02
    provides: valid RFC 7464 decoding
provides:
  - documented public IPC contract and private generation registry
  - typed terminal invalid-frame decoder failures
affects: [107-03, phase-108-runtime-composition]
tech-stack:
  added: []
  patterns: [generation-guarded cleanup, fail-closed byte decoding]
key-files:
  created: [packages/shell-ipc/src/types.ts, packages/shell-ipc/src/endpoint-registry.ts]
  modified: [packages/shell-ipc/src/index.ts, packages/shell-ipc/src/ipc-shell.ts, packages/shell-ipc/src/json-sequence.ts]
key-decisions:
  - "IPC remains an experimental spec-gap projection with no pathname-based peer authentication claim."
  - "The first decoder failure clears buffered bytes and permanently closes the stream."
requirements-completed: [IPC-03]
coverage:
  - id: D1
    description: "Generation-safe host endpoint lifecycle and documented root exports."
    requirement: IPC-03
    verification:
      - kind: unit
        ref: "packages/shell-ipc/src/endpoint-registry.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Malformed, invalid UTF-8, and over-limit frames fail before host dispatch."
    requirement: IPC-03
    verification:
      - kind: unit
        ref: "packages/shell-ipc/src/json-sequence.test.ts"
        status: pass
    human_judgment: false
duration: 5min
completed: 2026-08-18
status: complete
---

# Phase 107 Plan 05: Fail-Closed Ingress Summary

**Documented IPC host contracts, generation-guarded endpoint ownership, and typed terminal RFC 7464 ingress validation.**

## Accomplishments

- Extracted the stable experimental public transport contract and excluded carrier internals from the root barrel.
- Added monotonic compare-and-remove endpoint generations so stale lifecycle callbacks cannot remove a current registration.
- Made invalid framing, UTF-8, JSON shape, bounds, and truncation terminal before callback dispatch.

## Task Commits

1. **Task 1: Freeze the public host-registration contract and internal generation seam** - `c0036d8` (test), `fc20d2a` (feat)
2. **Task 2: Reject the complete invalid-frame and finite-bound matrix before dispatch** - `59c74b6` (test), `bc5a434` (feat)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

Plan 107-03 can now rely on terminal ingress classification and generation-safe endpoint ownership.

## Self-Check: PASSED

- Confirmed public contract, registry, and decoder files exist.
- Confirmed task commits `c0036d8`, `fc20d2a`, `59c74b6`, and `bc5a434` exist.
