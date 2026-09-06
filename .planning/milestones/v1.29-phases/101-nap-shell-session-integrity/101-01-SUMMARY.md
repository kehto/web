---
phase: 101-nap-shell-session-integrity
plan: 01
subsystem: runtime-shell-session-security
tags: [nap-shell, session-integrity, acl, firewall, nip-5d]
requires:
  - phase: v1.29 planning
    provides: "Pinned NAP-SHELL lifecycle contract at napplet/naps@6461e4b"
provides:
  - "A total runtime ingress gate requiring a NAP-SHELL session before any capability work"
  - "Trusted-source identity binding that withholds both session and init when creation identity is absent"
affects: [101-02, 101-03, shell-bridge, runtime-dispatch]
tech-stack:
  added: []
  patterns: ["Validate envelope shape, then gate all capability ingress on SessionRegistry", "Use registered source windows rather than ready payload fields for session identity"]
key-files:
  created: []
  modified: [packages/runtime/src/runtime.ts, packages/runtime/src/dispatch.test.ts, packages/shell/src/shell-ready.ts, packages/shell/src/shell-bridge.test.ts]
key-decisions:
  - "The pre-session guard lives in createMessageHandler after safe envelope validation and before every policy or dispatch branch."
  - "shell.init requires a trusted creation-time identity from the registered source window, while registration IDs retain valid reload lifecycles."
patterns-established:
  - "Pre-session behavior is silent: no response, ACL observation, firewall audit, service invocation, or domain dispatch."
requirements-completed: [SHELL-03, SHELL-04, SHELL-05]
coverage:
  - id: D1
    description: "Runtime capability dispatch remains inert until a SessionRegistry entry exists."
    requirement: SHELL-04
    verification:
      - kind: unit
        ref: "packages/runtime/src/dispatch.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Trusted first-ready binds immutable creation identity, is idempotent, and withholds init without identity."
    requirement: SHELL-03
    verification:
      - kind: unit
        ref: "packages/shell/src/shell-bridge.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Source-bound ready payloads cannot forge the runtime session identity."
    requirement: SHELL-05
    verification:
      - kind: unit
        ref: "packages/shell/src/shell-bridge.test.ts"
        status: pass
    human_judgment: false
duration: 5min
completed: 2026-07-23
status: complete
---

# Phase 101 Plan 01: NAP-SHELL Session Integrity Summary

**A total pre-session runtime gate and source-bound `shell.ready` transition that establish exactly one trusted NAP-SHELL session before capability traffic.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-23T13:40:00Z
- **Completed:** 2026-07-23T13:45:15Z
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- Added one ingress guard after safe envelope validation and before capability resolution, ACL, firewall, services, and NAP dispatch.
- Added fail-first runtime regressions proving pre-session storage and registered-service envelopes are fully silent while the registered-session control remains serviceable.
- Made trusted creation-time identity a prerequisite for both session registration and `shell.init`, with forged ready claims ignored and reload idempotency preserved.

## Task Commits

1. **Task 1: Enforce one end-to-end pre-session dispatch boundary** - `5ecfd4d` (feat)
2. **Task 2: Make first-ready identity binding and replay behavior invariant** - `a6bc928` (feat)

## Files Created/Modified

- `packages/runtime/src/runtime.ts` - gates every valid incoming envelope on an existing session.
- `packages/runtime/src/dispatch.test.ts` - proves pre-session policy, firewall, service, and response silence.
- `packages/shell/src/shell-ready.ts` - requires trusted source identity before creating a session or sending init.
- `packages/shell/src/shell-bridge.test.ts` - covers identity-less and forged-ready handshake vectors.

## Decisions Made

- Checked the authoritative NAP-SHELL contract at `napplet/naps@6461e4b37c29dc09a20dff35d9515889c4433874:naps/NAP-SHELL.md`; `shell.ready` is payload-free and session identity comes only from creation-time host state.
- Kept registration-ID-scoped `WeakMap` idempotency so a duplicate ready is inert but a host re-registration receives its separate init lifecycle.

## Verification

- PASS `pnpm exec vitest run packages/runtime/src/dispatch.test.ts`
- PASS `pnpm exec vitest run packages/shell/src/shell-bridge.test.ts packages/runtime/src/dispatch.test.ts`
- PASS `pnpm test:unit` — 104 files / 1377 tests
- PASS `pnpm --filter @kehto/runtime type-check && pnpm --filter @kehto/shell type-check`
- PASS `pnpm --filter @kehto/runtime build && pnpm --filter @kehto/shell build`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The mandated `npx --no-install aislop scan -d` quality gate could not run because `aislop@0.13.1` is not installed in this worktree; the command correctly refused to download a package. This does not affect the plan's completed test/type/build verification.

## Self-Check: PASSED
