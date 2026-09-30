---
phase: 108-runtime-shell-composition
plan: 01
subsystem: ipc-runtime-projection
tags: [ipc, unix-socket, nap-shell, runtime, nip-5d]
requires:
  - phase: 107-ipc-transport-foundation
    provides: bounded RFC 7464 Unix-socket carrier with immutable endpoint registrations
provides:
  - Host-facing IPC shell projection composed only through @kehto/runtime public APIs
  - Opaque targeted peer lifecycle and exact bare shell.ready handshake
affects: [108-02-lifecycle-parity, 109-reference-process-proof]
tech-stack:
  added: [@kehto/runtime workspace dependency]
  patterns: [opaque peer egress, host-bound shell readiness]
key-files:
  created: [packages/shell-ipc/src/runtime-shell.test.ts]
  modified: [packages/shell-ipc/src/ipc-shell.ts, packages/shell-ipc/src/types.ts, packages/shell-ipc/src/index.ts, packages/shell-ipc/package.json, pnpm-lock.yaml]
key-decisions:
  - "IPC source identity, environment, connection state, and diagnostics remain projection-private; only canonical envelopes cross the carrier."
  - "Only an exact bare shell.ready establishes the session and sends shell.init; payload-bearing readiness is inert and produces one redacted diagnostic."
patterns-established:
  - "Runtime egress uses the admitted opaque peer handle rather than generic endpoint broadcast."
  - "Projection domain eligibility composes registered shell capabilities with the host RuntimeAdapter decision."
requirements-completed: [BIND-03, PROOF-01]
coverage:
  - id: D1
    description: One admitted raw Unix-socket peer establishes a host-bound NAP-SHELL session and receives exactly one init.
    requirement: BIND-03
    verification:
      - kind: integration
        ref: packages/shell-ipc/src/runtime-shell.test.ts#binds one raw peer through exact readiness and public runtime dispatch
        status: pass
    human_judgment: false
  - id: D2
    description: The IPC projection composes the unchanged public Runtime seam with targeted canonical-envelope egress.
    requirement: PROOF-01
    verification:
      - kind: integration
        ref: packages/shell-ipc/src/runtime-shell.test.ts#binds one raw peer through exact readiness and public runtime dispatch
        status: pass
      - kind: other
        ref: pnpm build && pnpm type-check
        status: pass
    human_judgment: false
duration: 7min
completed: 2026-08-20
status: complete
---

# Phase 108 Plan 01: Runtime Shell Tracer Summary

**Experimental POSIX IPC projection binds one authenticated raw peer to the unchanged public Kehto runtime through exact NAP-SHELL readiness.**

## Accomplishments

- Added `createIpcShellProjection()` and typed, opaque peer lifecycle contracts to `@kehto/shell-ipc`.
- Added the first-party `@kehto/runtime@workspace:^` dependency and composed targeted runtime egress plus capability-domain gating without editing runtime or browser shell source.
- Added a raw `node:net` tracer covering redacted payload-ready diagnostics, pre-ready inertness, exact-once init/session binding, peer admission, targeted runtime output, immutable registration, and peer identity-claim rejection.

## Task Commits

1. **Task 1: Bind one raw IPC peer through bare readiness to the public runtime** - `b187ef8` (test), `4697bfa` (feat), `f1d7cd8` (refactor)

## Files Created/Modified

- `packages/shell-ipc/src/runtime-shell.test.ts` - raw Unix-socket projection integration coverage.
- `packages/shell-ipc/src/ipc-shell.ts` - opaque peer targeting, admission lifecycle, and runtime composition factory.
- `packages/shell-ipc/src/types.ts` - shell projection, environment, peer, and diagnostic contracts.
- `packages/shell-ipc/src/index.ts` - deliberate host-facing projection exports.
- `packages/shell-ipc/package.json` and `pnpm-lock.yaml` - reproducible first-party runtime workspace link.

## Verification

- `pnpm vitest run packages/shell-ipc/src/runtime-shell.test.ts packages/shell-ipc/src/ipc-shell.test.ts --reporter=dot` — 21 passed.
- `pnpm --filter @kehto/shell-ipc build` and `pnpm --filter @kehto/shell-ipc type-check` — passed.
- `pnpm test:unit` — 148 files / 1752 tests passed.
- `pnpm build` — 33 packages passed; `pnpm type-check` — 18 packages passed.
- `git diff --check` passed; no diff under `packages/runtime/src` or `packages/shell/src`.
- `npx --no-install aislop scan -d` — 97/100; the two remaining warnings are pre-existing duplicate narrative comments in `packages/shell-ipc/src/json-sequence.ts`, outside this plan's allowed source files.

## Decisions Made

- Checked `napplet/naps` `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`: NAP-SHELL's bare-ready, source-bound-session, one-init, and pre-ready gating rules are conformed to; the Unix-socket carrier and one-peer topology are documented experimental spec-gap choices.
- The projection does not expose Node sockets, queues, connection tokens, browser APIs, interface injection, or a napplet-side helper.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Test fixture] Used a short `/tmp` prefix for raw-socket test directories.**
- **Found during:** Task 1
- **Issue:** Long `mkdtemp(tmpdir())` prefixes exceeded the production 90-byte pathname safety limit before the test could exercise the projection.
- **Fix:** Switched the test-only directory prefix to a short `/tmp/k-ipc-*` path.
- **Files modified:** `packages/shell-ipc/src/runtime-shell.test.ts`
- **Verification:** Focused raw-socket tracer passed.
- **Committed in:** `4697bfa`

**Total deviations:** 1 auto-fixed (Rule 1).

## Next Phase Readiness

Plan 108-02 can add generation-matched teardown and replacement-race coverage on the established opaque peer and projection seam. No Phase 109 process proof, docs, or drafting artifact was added.

## Self-Check: PASSED

- Summary exists at `.planning/phases/108-runtime-shell-composition/108-01-SUMMARY.md`.
- Task commits `b187ef8`, `4697bfa`, and `f1d7cd8` exist in git history.
