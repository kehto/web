---
phase: 107-ipc-transport-foundation
plan: 02
subsystem: ipc-transport
tags: [rfc-7464, utf-8, byte-framing, typescript, vitest]
requires:
  - phase: 107-01
    provides: "Experimental shell-ipc tracer and bounded decoder seam"
provides:
  - "Owned Uint8Array ingress contract for the RFC 7464 decoder"
  - "Exhaustive valid-stream fragmentation and coalescing coverage"
affects: [107-05, IPC-02]
tech-stack:
  added: []
  patterns: ["owned byte chunks before buffering", "synchronous wire-order decoder delivery"]
key-files:
  created:
    - packages/shell-ipc/src/json-sequence.test.ts
  modified:
    - packages/shell-ipc/src/json-sequence.ts
key-decisions:
  - "Accept Uint8Array ingress and immediately copy it into package-owned Buffer storage."
  - "Keep callback delivery synchronous and do not convert host callback failures into recovery behavior."
patterns-established:
  - "Valid RFC 7464 stream tests enumerate every byte split instead of selecting arbitrary chunk boundaries."
requirements-completed: [IPC-02]
coverage:
  - id: D1
    description: "Valid RFC 7464 streams preserve unchanged multibyte canonical envelopes across every byte split, coalesced records, and independent decoder instances."
    requirement: IPC-02
    verification:
      - kind: unit
        ref: "packages/shell-ipc/src/json-sequence.test.ts#RFC 7464 JSON text-sequence codec"
        status: pass
      - kind: integration
        ref: "packages/shell-ipc/src/ipc-shell.test.ts#createIpcTransport carries an immutable host-bound envelope"
        status: pass
    human_judgment: false
duration: 2m
completed: 2026-08-18
status: complete
---

# Phase 107 Plan 02: RFC 7464 Valid-Stream Codec Summary

**An owned-byte RFC 7464 decoder with exhaustive UTF-8 split, coalescing, ordering, and instance-isolation proof for canonical IPC envelopes.**

## Performance

- **Duration:** 2m
- **Started:** 2026-08-18T16:14:00Z
- **Completed:** 2026-08-18T16:16:56Z
- **Tasks:** 1/1
- **Files modified:** 2

## Accomplishments

- Added dynamic test coverage that enumerates every split byte in a multibyte canonical frame, including BMP and astral Unicode values.
- Expanded the decoder ingress contract to `Uint8Array` and copies each chunk before buffering so callers cannot mutate retained partial data.
- Proved zero-record input, coalesced callback wire order, callback synchrony, independent decoder isolation, and unchanged canonical envelope content.

## Task Commits

1. **Task 1 RED: Exhaust RFC 7464 fragmentation, coalescing, empty, encoding, and ordering cases** — `7829d59` (`test`)
2. **Task 1 GREEN: Accept owned Uint8Array IPC chunks** — `cee7606` (`feat`)

## Files Created/Modified

- `packages/shell-ipc/src/json-sequence.test.ts` — exhaustive valid-stream byte-boundary and isolation tests.
- `packages/shell-ipc/src/json-sequence.ts` — owned `Uint8Array` buffering and explicit UTF-8/JSON/canonical-envelope helpers.

## Decisions Made

- Treat arbitrary byte containers as untrusted transient input; the decoder owns a copied `Buffer` before retaining a partial frame.
- Preserve callback exceptions as caller-visible exceptions rather than silently resynchronizing an experimental identity-bearing carrier.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used the supported Vitest focused-test command**
- **Found during:** Task 1 verification
- **Issue:** Vitest 4 rejects the plan's obsolete `-x` flag.
- **Fix:** Ran the equivalent focused test command without `-x`.
- **Verification:** both codec and endpoint tracer tests passed.
- **Committed in:** `cee7606`

**Total deviations:** 1 auto-fixed (1 Rule 3).

## TDD Gate Compliance

- RED commit `7829d59` failed package type-check because the former `Buffer`-only signature rejected required `Uint8Array` chunks.
- GREEN commit `cee7606` widened the contract and made the full focused/type-check gate pass.

## Verification Notes

- Passed: package build, package type-check, focused codec/tracer tests (8 tests), and full `pnpm test:unit` (144 files / 1,686 tests).
- Unrun: local AI-slop gate; the `aislop` executable is not installed in this workspace.

## Known Stubs

None.

## Next Phase Readiness

The valid-stream codec is ready for the remaining Phase 107 invalid-input/limit hardening and endpoint lifecycle work.

## Self-Check: PASSED

- Confirmed commits `7829d59` and `cee7606` exist.
- Confirmed the codec implementation and its exhaustive test file exist.
