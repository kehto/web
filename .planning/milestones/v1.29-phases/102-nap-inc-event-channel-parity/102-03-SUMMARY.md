---
phase: 102-nap-inc-event-channel-parity
plan: 03
subsystem: runtime-acl
tags: [nap-inc, acl, channels, revocation, vitest]
requires:
  - phase: 102-02
    provides: dTag-safe INC channel lifecycle with shared teardown
provides:
  - Open-only `relay:read` authorization for INC channel creation
  - Synchronous ACL revoke/block teardown for matching live channel routes
affects: [102-05, 102-06, 102-07, 102-08]
tech-stack:
  added: []
  patterns: [internal ACL mutation observer, channel membership authorization]
key-files:
  created: []
  modified:
    - packages/acl/src/resolve.ts
    - packages/runtime/src/acl-state.ts
    - packages/runtime/src/runtime.ts
    - packages/runtime/src/session-registry.ts
key-decisions:
  - "INC channel ACL is checked only at inc.channel.open; established routes are authorized by opaque membership."
  - "Only block and relay:read revoke events invalidate matching live dTag and aggregateHash channel routes."
requirements-completed: [INC-06, INC-07, INC-08]
coverage:
  - id: D1
    description: Channel creation is gated once while established channel traffic bypasses global ACL checks.
    requirement: INC-06
    verification:
      - kind: integration
        ref: packages/acl/src/resolve.test.ts and packages/runtime/src/dispatch.test.ts#checks ACL at channel open but not for established channel traffic
        status: pass
    human_judgment: false
  - id: D2
    description: Block and relay:read revoke synchronously close matching INC channels and leave former routes inert.
    requirement: INC-07
    verification:
      - kind: integration
        ref: packages/runtime/src/dispatch.test.ts#synchronously closes both endpoints and makes traffic inert after ACL
        status: pass
    human_judgment: false
  - id: D3
    description: Channel open denial, stable unrelated ACL mutations, and post-revocation fire-and-forget silence preserve INC transport semantics.
    requirement: INC-08
    verification:
      - kind: integration
        ref: packages/runtime/src/dispatch.test.ts
        status: pass
    human_judgment: false
duration: 7min
completed: 2026-07-23
status: complete
---

# Phase 102 Plan 03: Open-only INC Channel Authorization Summary

**INC channels now check the existing `relay:read` authority only at open, then use opaque membership until a relevant ACL mutation synchronously closes both endpoints.**

## Performance

- **Duration:** 7 min
- **Completed:** 2026-07-23T18:19:22Z
- **Tasks:** 2/2
- **Files modified:** 7

## Accomplishments

- Replaced duplicated INC resolver coverage with one table that preserves topic policy and maps established channel actions to `null`/`null`.
- Added a typed internal ACL mutation seam and connected block or `relay:read` revoke events to channel teardown for exact matching dTag and aggregate-hash sessions.
- Proved denied opens, one-time authorization, synchronous bilateral closure, unrelated-mutation stability, and inert post-revocation traffic.

## Task Commits

1. **Task 1: Make channel capability resolution open-only** — `962e74a` (RED tests), `9c1a1c6` (implementation)
2. **Task 2: Close established channels when open-time authority is revoked** — `33cd7b2` (RED tests), `fde08fc` (implementation)

## Files Created/Modified

- `packages/acl/src/resolve.ts` — keeps channel ACL authorization at open and bypasses global checks for established routes.
- `packages/acl/src/resolve.test.ts` — table-driven, non-duplicated INC capability policy coverage.
- `packages/runtime/src/acl-state.ts` — emits internal, payload-free revoke/block facts.
- `packages/runtime/src/runtime.ts` — revokes matching live INC routes synchronously.
- `packages/runtime/src/session-registry.ts` — enumerates every live window session, including empty-pubkey NIP-5D entries.
- `packages/runtime/src/acl-state.test.ts` and `packages/runtime/src/dispatch.test.ts` — focused mutation and dispatch regression coverage.

## Decisions Made

- Retained `relay:read` as the existing host policy gate for `inc.channel.open`; no new capability or wire field was introduced.
- Used exact dTag plus aggregate-hash matching for invalidation, and only block or `relay:read` revoke can close channels.
- Checked NAP-INC draft #89 at `4593ce9e301ce098fd3dad64206fcd6f144fa7af`, web projection draft #90 at `896c32c92deee68dc4d10fc1132b62df20cccb6f`, and symmetric channel draft #92 at `c5cd06f7be6d4690b303949abb26e87ff62f4729`; the implementation conforms to their auth-on-open and terminal-notification requirements.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Include all NIP-5D sessions in aggregate session enumeration**
- **Found during:** Task 2
- **Issue:** `getAllEntries()` read the pubkey index, which collapses multiple NIP-5D sessions because their authenticated pubkey is empty.
- **Fix:** Enumerate the window-session index so exact dTag and aggregate-hash revocation reaches every live session.
- **Files modified:** `packages/runtime/src/session-registry.ts`, `packages/runtime/src/dispatch.test.ts`
- **Verification:** Focused dispatch suite proves both registered window sessions are enumerated and channel teardown tests pass.
- **Committed in:** `fde08fc` (implementation), `33cd7b2` (coverage)

**Total deviations:** 1 auto-fixed (Rule 1 bug)

## Issues Encountered

- The repository does not expose a local `aislop` executable, so the requested AI-slop gate could not be run. This did not affect the plan's automated verification, which passed.

## Next Phase Readiness

- Paja/playground and static conformance plans can rely on auth-on-open channel behavior and deterministic ACL teardown.
- No wire protocol, NAP-INTENT behavior, package versions, or package dependencies changed.

## Self-Check: PASSED

Verified all seven modified source/test files, the summary artifact, and all four task commits.
