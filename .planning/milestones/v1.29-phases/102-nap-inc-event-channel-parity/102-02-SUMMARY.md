---
phase: 102-nap-inc-event-channel-parity
plan: 02
subsystem: runtime
tags: [inc, channels, dtag, lifecycle, vitest]
requires:
  - phase: 102-01
    provides: Canonical INC event routing with runtime-attested dTag senders
provides:
  - Unambiguous live dTag-to-window resolution that fails closed on duplicates
  - Opaque channel routing with target opened-before-result ordering
  - Unified explicit-close, destruction, and revocation teardown
affects: [102-03, inc-channel-acl]
tech-stack:
  added: []
  patterns: [dTag-only public identity, unified channel teardown]
key-files:
  created: []
  modified:
    - packages/runtime/src/session-registry.ts
    - packages/runtime/src/inc-handler.ts
    - packages/runtime/src/types.test.ts
    - packages/runtime/src/runtime.test.ts
key-decisions:
  - "Resolve a dTag by scanning registered live entries and fail closed when more than one owner exists."
  - "Keep the channel ID opaque and expose only runtime-attested opposite-peer dTags."
  - "Use one teardown primitive for ordinary close, endpoint destruction, and ACL revocation."
patterns-established:
  - "Target lifecycle pushes are queued before correlated opener success."
  - "Destroyed endpoints notify only the surviving peer with peer destroyed."
requirements-completed: [INC-03, INC-04, INC-05, INC-07, INC-08]
coverage:
  - id: D1
    description: Unique live dTag resolution rejects missing, duplicate, window-ID, and pubkey inputs.
    requirement: INC-03
    verification:
      - kind: unit
        ref: packages/runtime/src/types.test.ts#SessionRegistry.getWindowIdByDTag
        status: pass
    human_judgment: false
  - id: D2
    description: Channel open emits the target opened push before a dTag-safe correlated success result.
    requirement: INC-04
    verification:
      - kind: integration
        ref: packages/runtime/src/runtime.test.ts#channel.open sends target opened before the correlated dTag-safe result
        status: pass
    human_judgment: false
  - id: D3
    description: Channel emit, broadcast, list, close, and destruction preserve opaque membership and deterministic cleanup.
    requirement: INC-07
    verification:
      - kind: integration
        ref: packages/runtime/src/runtime.test.ts#inc channel sub-protocol
        status: pass
    human_judgment: false
  - id: D4
    description: Correlated and fire-and-forget channel wire shapes remain distinct.
    requirement: INC-08
    verification:
      - kind: integration
        ref: pnpm exec vitest run packages/runtime/src/runtime.test.ts packages/runtime/src/types.test.ts
        status: pass
    human_judgment: false
duration: 6min
completed: 2026-07-23
status: complete
---

# Phase 102 Plan 02: INC Channel Lifecycle Summary

**dTag-only INC channel routing with ordered target handles, opaque membership, and deterministic lifecycle teardown.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-23T17:35:58Z
- **Completed:** 2026-07-23T17:41:27Z
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- Added fail-closed unique live dTag lookup; raw window IDs and pubkeys cannot select INC peers.
- Opened channels now enqueue the target `inc.channel.opened` notification before sending the opener's correlated result.
- Centralized channel teardown so explicit close, endpoint destruction, and future ACL revocation remove both indexes consistently.

## Task Commits

1. **Task 1: Resolve direct targets by one live dTag only** — `51ba613` (feat)
2. **Task 2: Make channel routing and teardown dTag-safe and complete** — `afb78f2` (feat)

## Files Created/Modified

- `packages/runtime/src/session-registry.ts` — unique dTag lookup over live session entries.
- `packages/runtime/src/types.test.ts` — fail-closed dTag registry contract matrix.
- `packages/runtime/src/inc-handler.ts` — dTag-safe channel routing and shared teardown.
- `packages/runtime/src/runtime.test.ts` — lifecycle, ordering, membership, and identity integration coverage.

## Decisions Made

- Checked `napplet/naps` NAP-INC draft #89 at `4593ce9e301ce098fd3dad64206fcd6f144fa7af` and channel clarification draft #92 at `c5cd06f7be6d4690b303949abb26e87ff62f4729`; implementation conforms to their dTag identity, ordered opened push, and close semantics.
- `IncRuntime.revokeWindow(windowId)` is internal lifecycle plumbing for Plan 102-03, not a wire operation.

## Deviations from Plan

### Process Deviation

- TDD RED checks were run and failed as expected, but the initial worktree branch failed the mandatory pre-commit namespace guard. After orchestration moved the checkout to `worktree-agent-102-nap-inc-conformance`, each GREEN task commit included its matching RED tests. No runtime behavior or plan scope changed.

## Issues Encountered

- `npx --no-install aislop scan -d` could not run because `aislop@0.13.1` is absent from the installed workspace. No package was installed; this unrun verification is recorded in `.planning/WINDOWS.md`.

## User Setup Required

None.

## Next Phase Readiness

Plan 102-03 can connect ACL block/revoke mutations to the internal `IncRuntime.revokeWindow` seam without adding any INC wire message.

## Self-Check: PASSED

- All four modified runtime files and this summary exist.
- Task commits `51ba613` and `afb78f2` exist in git history.
