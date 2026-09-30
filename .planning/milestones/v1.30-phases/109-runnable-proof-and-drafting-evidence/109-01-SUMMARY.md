---
phase: 109-runnable-proof-and-drafting-evidence
plan: 01
subsystem: ipc-process-proof
tags: [node-net, unix-sockets, rfc7464, runtime-services, vitest]
requires:
  - phase: 108-runtime-shell-composition
    provides: Public IPC shell composition with runtime lifecycle and policy-aware targeted egress.
provides:
  - Standalone public-ESM IPC reference host and dependency-free raw Node napplet fixture.
  - Graceful and SIGKILL process proof for correlated intent messages, eligible pushes, and cleanup.
affects: [109-02-public-drafting-evidence, 109-03-release-evidence]
tech-stack:
  added: []
  patterns: [Safe newline-delimited process transcript outside RFC 7464 socket frames, host-owned child lifecycle cleanup]
key-files:
  created:
    - packages/shell-ipc/examples/ipc-projection-reference-host.mjs
    - packages/shell-ipc/tests/fixtures/raw-ipc-napplet.mjs
    - packages/shell-ipc/src/ipc-projection-process.test.ts
  modified: []
key-decisions:
  - "The host uses the built public @kehto/shell-ipc export; the napplet imports only node:net and owns its local RFC 7464 codec."
  - "The host sends intent.changed only after the raw process observes the matching runtime/service result and ServiceRuntimeContext.sendToEligibleNapplet returns true."
  - "Forced proof records the raw child SIGKILL, while the reference host exits normally after converging lifecycle cleanup."
patterns-established:
  - "Use a bounded, redacted JSON-lines process transcript; do not reflect socket paths, registration identity, or arbitrary peer payloads."
  - "Verify endpoint and composition cleanup before removing the test-owned outer directory."
requirements-completed: [PROOF-02, PROOF-03, PROOF-05]
coverage:
  - id: D1
    description: Raw Node process completes one exact shell handshake and correlated intent.available result over the public IPC projection.
    requirement: PROOF-02
    verification:
      - kind: integration
        ref: packages/shell-ipc/src/ipc-projection-process.test.ts#proves the graceful public-ESM host, exact shell lifecycle, runtime result, and eligible push
        status: pass
    human_judgment: false
  - id: D2
    description: Registered service context delivers a recipient-mapped intent.changed push only through runtime eligibility policy.
    requirement: PROOF-03
    verification:
      - kind: integration
        ref: packages/shell-ipc/src/ipc-projection-process.test.ts#proves the graceful public-ESM host, exact shell lifecycle, runtime result, and eligible push
        status: pass
    human_judgment: false
  - id: D3
    description: Raw napplet remains Node-only with local RFC 7464 framing and no Kehto, browser, injection, or helper dependency.
    requirement: PROOF-05
    verification:
      - kind: unit
        ref: packages/shell-ipc/src/ipc-projection-process.test.ts#keeps the raw napplet Node-only and the reference host on public seams
        status: pass
    human_judgment: false
duration: 5min
completed: 2026-08-20
status: complete
---

# Phase 109 Plan 01: Runnable IPC Process Proof Summary

**A standalone public-ESM IPC host now proves a raw `node:net` napplet's exact handshake, same-id runtime result, eligible service push, and graceful/SIGKILL cleanup.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-20T14:58:00Z
- **Completed:** 2026-08-20T15:03:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added a directly runnable host that consumes only `@kehto/shell-ipc`'s public ESM export, installs a complete local runtime adapter, and registers a real `intent` service.
- Added a child process that owns its `node:net` connection and RFC 7464 codec, sends one bare `shell.ready`, then observes the runtime's same-id `intent.available.result` and `intent.changed` push.
- Added deterministic process coverage for graceful and actual raw-child `SIGKILL` termination, proving matched session, endpoint path, and owned-directory cleanup before test directory removal.

## Task Commits

1. **Task 1: Run one graceful raw-process request/result and policy-checked push** - `740cff5` (test), `018edc0` (feat)
2. **Task 2: Prove SIGKILL and graceful runs converge on owned cleanup** - `43e0b7c` (test), `3219eb8` (feat)

## Files Created

- `packages/shell-ipc/examples/ipc-projection-reference-host.mjs` — public-API reference host, local runtime adapter, registered intent service, child coordinator, and redacted transcript.
- `packages/shell-ipc/tests/fixtures/raw-ipc-napplet.mjs` — raw `node:net` child with fixture-local RFC 7464 framing.
- `packages/shell-ipc/src/ipc-projection-process.test.ts` — focused graceful/SIGKILL process and static-boundary proof.

## Decisions Made

- Checked `napplet/naps origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`: NAP-SHELL's bare-ready, one-init, and first-ready session rules are conformant. Unix sockets, RFC 7464 framing, and path distribution remain an intentional experimental carrier gap.
- The raw child receives only the host-held pathname as an argument. Possession is a routing mechanism, not authentication against hostile same-UID peers.
- Process stdout carries only bounded named milestones; no path, host registration, socket state, or arbitrary frame contents are emitted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test expectation] Corrected forced-run process ownership assertion**
- **Found during:** Task 1
- **Issue:** The first red test expected the reference host itself to exit from `SIGKILL`, while the plan requires the host to signal its raw child and then verify cleanup.
- **Fix:** The forced case now requires a normal host exit and a transcript record proving the raw child exited from `SIGKILL`.
- **Files modified:** `packages/shell-ipc/src/ipc-projection-process.test.ts`
- **Verification:** Focused process test passes both graceful and forced cases.
- **Committed in:** `018edc0` (Task 1 implementation commit)

**Total deviations:** 1 auto-fixed (Rule 1).
**Impact on plan:** Clarified the required process ownership without changing the IPC projection, public API, or proof scope.

## Issues Encountered

None after the planned TDD red gates: missing executable fixtures failed as expected, then the graceful and forced process proofs passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 109-02 can document this exact runnable proof and its carrier-neutral/spec-gap boundary. Plan 109-03 can run the wider release evidence gates.

## Self-Check: PASSED

- All three owned proof files exist.
- Task commits `740cff5`, `018edc0`, `43e0b7c`, and `3219eb8` exist.
- `pnpm --filter @kehto/shell-ipc build`, focused process/runtime-shell tests, and package type-check pass.
