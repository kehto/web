---
phase: 108-runtime-shell-composition
plan: 02
subsystem: ipc-runtime-lifecycle
tags: [ipc, unix-sockets, runtime, nap-shell, acl, lifecycle]
requires:
  - phase: 108-runtime-shell-composition
    provides: Public runtime projection tracer with host-bound shell.ready sessions
provides:
  - Generation-token guarded IPC peer teardown
  - Runtime session cleanup for disconnect and projection shutdown
  - Raw-socket coverage of identity, domain, and ACL gates
affects: [109-reference-process-and-spec-evidence]
tech-stack:
  added: []
  patterns: [private connection token, retire-before-runtime-cleanup]
key-files:
  created: []
  modified: [packages/shell-ipc/src/ipc-shell.ts, packages/shell-ipc/src/runtime-shell.test.ts]
key-decisions:
  - "A matching private connection generation is required before teardown may destroy runtime state or unregister a session."
  - "The active token is removed before runtime callbacks, so stale peer events cannot affect a replacement session."
patterns-established:
  - "Projection lifecycle: retire current token, destroyWindow, unregister matching session, then release carrier resources."
requirements-completed: [BIND-02, BIND-04, PROOF-04]
coverage:
  - id: D1
    description: Generation-safe peer disconnect and idempotent projection shutdown
    requirement: BIND-02
    verification:
      - kind: integration
        ref: packages/shell-ipc/src/runtime-shell.test.ts#tears down only the current ready peer before accepting a replacement
        status: pass
    human_judgment: false
  - id: D2
    description: Runtime cleanup order and carrier resource release
    requirement: BIND-04
    verification:
      - kind: integration
        ref: packages/shell-ipc/src/runtime-shell.test.ts#uses the same cleanup path for abrupt peer destruction and projection shutdown
        status: pass
    human_judgment: false
  - id: D3
    description: Post-ready host identity, environment-domain, host-domain, and ACL enforcement
    requirement: PROOF-04
    verification:
      - kind: integration
        ref: packages/shell-ipc/src/runtime-shell.test.ts#keeps host-bound identity and runtime domain and ACL gates intact after readiness
        status: pass
    human_judgment: false
duration: 9min
completed: 2026-08-20
status: complete
---

# Phase 108 Plan 02: Lifecycle Cleanup and Runtime Policy Parity Summary

**Generation-safe IPC disconnect teardown that preserves runtime policy gates after the NAP-SHELL handshake.**

## Accomplishments

- Retired the active private connection token before invoking runtime cleanup, then destroys only that window and unregisters its session.
- Made projection shutdown idempotent, retaining Phase 107 transport ownership while invoking the runtime-wide destroy only once.
- Added raw Unix-socket evidence for graceful and abrupt disconnects, replacement safety, host identity, environment/host domain denial, and ACL denial.

## Task Commits

1. **Task 1: Converge every close path on matching token-owned cleanup** — `e65ac6f` (feat)
2. **Task 2: Prove source identity, domain, ACL, and capability parity after readiness** — `e72724e` (test)

## Files Modified

- `packages/shell-ipc/src/ipc-shell.ts` — private generation-aware teardown and one-shot projection shutdown.
- `packages/shell-ipc/src/runtime-shell.test.ts` — raw-socket lifecycle and runtime-policy parity matrix.

## Decisions Made

- NAP-SHELL and NAP-INC were checked at `napplet/naps` `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`; their handshake, identity, and lifecycle rules are conformant. The Unix-socket carrier and token topology remain an explicit experimental spec gap.
- Cleanup ownership stays in the projection for runtime/session state and in the Phase 107 transport for listener, path, and directory resources.

## Deviations from Plan

None - plan executed within its two owned source files. The current single-registration projection API does not expose the multi-endpoint NAP-INC scenario described for later proof; no public API expansion or Phase 109 deliverable was introduced here.

## Issues Encountered

- The first full unit run reported a known unrelated asynchronous `relay timeout` from `packages/services/src/cvm-nostr-transport.test.ts`; its focused test passed and the immediately repeated full suite passed (148 files, 1755 tests).
- `npx --no-install aislop scan -d` ran but scored 97/100 because of two pre-existing narrative-comment warnings in unchanged `packages/shell-ipc/src/json-sequence.ts`. The warning is recorded in `.planning/WINDOWS.md` rather than silently suppressed.

## Verification

- `pnpm vitest run packages/shell-ipc/src/runtime-shell.test.ts packages/shell-ipc/src/ipc-shell.test.ts --reporter=dot` — pass (23 tests)
- `pnpm vitest run packages/shell-ipc/src/runtime-shell.test.ts tests/unit/nap-inc-conformance.test.ts --reporter=dot` — pass (7 tests)
- `pnpm --filter @kehto/shell-ipc build` and `pnpm --filter @kehto/shell-ipc type-check` — pass
- `pnpm test:unit` — pass (148 files, 1755 tests)
- `pnpm build` and `pnpm type-check` — pass (18 packages)
- Runtime/browser-shell and Phase 109 scope guards — pass

## Next Phase Readiness

Phase 109 can build its standalone process and drafting evidence on a projection that no longer allows stale close events to erase a replacement session. The open slop warning is pre-existing quality debt outside this plan's owned files.

## Self-Check: PASSED

- Confirmed both task commits and both modified source files exist.
