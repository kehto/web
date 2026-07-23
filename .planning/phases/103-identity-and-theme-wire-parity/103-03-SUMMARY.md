---
phase: 103-identity-and-theme-wire-parity
plan: 03
subsystem: shell-bridge
tags: [identity, theme, acl, shell-ready, nap-identity, nap-theme, vitest]
requires:
  - phase: 101-session-gate-and-host-boundary
    provides: source-bound shell.ready sessions and frozen shell environments
  - phase: 103-identity-and-theme-wire-parity
    provides: canonical identity/theme runtime and reference-service envelopes
provides:
  - Recipient-authorized identity.changed and theme.changed fanout
  - Per-session live ACL, environment, and iframe lifecycle checks
affects: [paja, playground, identity, theme, acl, shell]
tech-stack:
  added: []
  patterns:
    - Enumerate authenticated SessionEntry instances rather than collapse recipients by pubkey
    - Recheck recipient ACL state immediately before each host-originated postMessage
key-files:
  created: []
  modified:
    - packages/acl/src/resolve.ts
    - packages/acl/src/resolve.test.ts
    - packages/shell/src/shell-bridge.ts
    - packages/shell/src/shell-bridge.test.ts
key-decisions:
  - "identity.changed is sender-null and recipient identity:read, matching the NAP-IDENTITY shell-to-napplet push direction."
  - "Identity and theme fanout uses shell.ready session entries plus their frozen domain environment and live ACL state; origin registration alone is insufficient."
patterns-established:
  - "Host pushes select recipients per window so concurrent empty-pubkey NIP-5D sessions remain independent."
requirements-completed: [IDENTITY-03, IDENTITY-04, THEME-03, THEME-05]
coverage:
  - id: D1
    description: Recipient-gated identity change delivery, including sign-out
    requirement: IDENTITY-03
    verification:
      - kind: unit
        ref: packages/acl/src/resolve.test.ts#identity.changed and packages/shell/src/shell-bridge.test.ts#ShellBridge identity and theme recipient eligibility
        status: pass
    human_judgment: false
  - id: D2
    description: Session, frozen-domain, current-grant, and lifecycle isolation for private host pushes
    requirement: IDENTITY-04
    verification:
      - kind: unit
        ref: packages/shell/src/shell-bridge.test.ts#excludes pre-session, domain-disabled, ungranted, revoked, and destroyed recipients
        status: pass
    human_judgment: false
  - id: D3
    description: Complete theme update reaches each eligible recipient exactly once without a subscription protocol
    requirement: THEME-03
    verification:
      - kind: unit
        ref: packages/shell/src/shell-bridge.test.ts#delivers normal identity, sign-out, and complete theme pushes once per eligible concurrent session
        status: pass
    human_judgment: false
  - id: D4
    description: Theme changed remains an automatic recipient-authorized push
    requirement: THEME-05
    verification:
      - kind: unit
        ref: packages/acl/src/resolve.test.ts#theme.changed and packages/shell/src/shell-bridge.test.ts#checks current ACL state on every push so revocation blocks the next delivery
        status: pass
    human_judgment: false
metrics:
  duration: 4m
  completed: 2026-07-23
status: complete
---

# Phase 103 Plan 03: Authenticated Identity and Theme Fanout Summary

**Identity and theme changes now reach only live shell.ready recipients that expose the matching frozen domain and still hold its current read capability.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-23T21:25:52Z
- **Completed:** 2026-07-23T21:29:18Z
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- Corrected `identity.changed` to the NAP-IDENTITY shell-push direction: no sender capability and recipient `identity:read`.
- Replaced origin-wide identity/theme fanout with one per-session delivery path that requires an authenticated session, its frozen environment domain, a live ACL grant, and a live iframe window.
- Added exact-cardinality coverage for ordinary identity changes, sign-out, complete themes, same-pubkey concurrent sessions, pre-session registrations, missing domains, revoked grants, and destroyed sessions.

## Task Commits

1. **Task 1: Trace one authenticated identity change to one eligible recipient** — `63a460d` (test), `2635549` (fix)
2. **Task 2: Expand exact push eligibility across identity sign-out, theme, revocation, destruction, and concurrency** — `d051c7f` (test)

## Files Created/Modified

- `packages/acl/src/resolve.ts` — maps `identity.changed` as a recipient-authorized shell push.
- `packages/acl/src/resolve.test.ts` — locks the direction-sensitive identity mapping.
- `packages/shell/src/shell-bridge.ts` — evaluates every live session, frozen domain environment, and current ACL grant before posting an identity or theme push.
- `packages/shell/src/shell-bridge.test.ts` — verifies message cardinality and privacy across session lifecycle states.

## Decisions Made

- Checked NAP-IDENTITY and NAP-THEME on the active draft source `napplet/naps@c5cd06f7be6d4690b303949abb26e87ff62f4729` before changing the protocol surface. The result conforms to both documents: automatic shell-originated changes, no IDs or subscription lifecycle, and read-only recipient authorization.
- The frozen environment is read from bridge-owned shell-ready state, which is the runtime’s immutable per-window environment snapshot; origin registration by itself never authorizes delivery.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test correctness] Scoped lifecycle assertions to the matching domain push.**
- **Found during:** Task 2
- **Issue:** A domain-disabled identity recipient correctly remained eligible for `theme.changed`, but the first lifecycle-matrix assertion incorrectly expected no messages of either domain.
- **Fix:** Asserted zero matching messages and explicitly proved delivery remains limited to the enabled domain.
- **Files modified:** `packages/shell/src/shell-bridge.test.ts`
- **Verification:** Focused bridge and ACL tests pass.
- **Committed in:** `d051c7f`

**Total deviations:** 1 auto-fixed (Rule 1).
**Impact on plan:** The correction strengthened domain-isolation coverage without expanding the implementation scope.

## Known Stubs

None.

## Issues Encountered

- The configured AI-slop executable is unavailable in this workspace (`pnpm exec aislop --help` reports command not found). This existing Phase 103 unrun-verification item is already tracked in `.planning/WINDOWS.md`; no dependency was installed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Paja and playground plans can now remove duplicate host-side fanout while preserving a single recipient-authorized ShellBridge delivery path.

## Self-Check: PASSED

- All four assigned source and test files exist.
- Task commits `63a460d`, `2635549`, and `d051c7f` are present in git history.
- `pnpm exec vitest run packages/acl/src/resolve.test.ts packages/shell/src/shell-bridge.test.ts` passed (161 tests).
- `pnpm --filter @kehto/acl type-check` and `pnpm --filter @kehto/shell type-check` passed.
