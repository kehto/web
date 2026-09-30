---
phase: 102-nap-inc-event-channel-parity
plan: 14
subsystem: runtime-shell-inc
tags: [nap-inc, channels, admission-control, lifecycle, vitest]
requires:
  - phase: 102-13
    provides: Reproduced repeated unopened-handle loss at the protected binding
provides:
  - Per-authenticated-window admission limit of 32 concurrent INC channels
  - Bilateral capacity reclamation through existing channel teardown
  - Lossless trusted-parent opened-handle retention until onOpened registration
affects: [phase-102-verification, runtime, shell, paja, playground]
tech-stack:
  added: []
  patterns:
    - Bound live resources before emitting a trusted lifecycle push
    - Retain every trusted lifecycle push until its required public callback observes it
key-files:
  created: []
  modified:
    - packages/runtime/src/inc-handler.ts
    - packages/runtime/src/runtime.test.ts
    - packages/shell/src/napplet-namespace.ts
    - packages/shell/src/napplet-namespace.test.ts
key-decisions:
  - "Enforce the NAP-INC resource maximum at the authenticated runtime membership boundary, not in the projection binding."
  - "Count both source and target memberships so no authenticated napplet can exceed 32 live channels in either role."
  - "Retain every trusted-parent opened state in arrival order; preserve the independent 32-event per-handle overflow policy."
patterns-established:
  - "Admission-limit regressions must prove source capacity, target capacity, target silence on rejection, and bilateral slot release."
  - "Late lifecycle delivery regressions must exceed the former bound and prove complete ordered, exactly-once observation."
requirements-completed: [INC-07]
coverage:
  - id: D1
    description: The authenticated runtime admits exactly 32 channels per endpoint and rejects the 33rd before target notification.
    requirement: INC-07
    verification:
      - kind: unit
        ref: packages/runtime/src/runtime.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Closing an admitted channel releases capacity for both endpoints and permits replacement opens.
    requirement: INC-07
    verification:
      - kind: unit
        ref: packages/runtime/src/runtime.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Thirty-four trusted-parent opened handles are retained and delivered exactly once in arrival order to a late callback.
    requirement: INC-07
    verification:
      - kind: unit
        ref: packages/shell/src/napplet-namespace.test.ts#retains every trusted-parent inbound handle in arrival order until onOpened registers
        status: pass
    human_judgment: false
  - id: D4
    description: Late callback registration neither closes nor marks retained handles terminal, while untrusted opened injection remains ignored.
    requirement: INC-07
    verification:
      - kind: unit
        ref: packages/shell/src/napplet-namespace.test.ts#retains every trusted-parent inbound handle in arrival order until onOpened registers
        status: pass
    human_judgment: false
metrics:
  duration: 63 min
  completed: 2026-07-26
status: complete
---

# Phase 102 Plan 14: Lossless INC Channel Retention Summary

**INC channels are now bounded before trusted lifecycle delivery, allowing the shared binding to retain every legitimate inbound handle losslessly until a napplet registers `channel.onOpened()`.**

## Performance

- **Duration:** 63 min
- **Completed:** 2026-07-26
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- Added a deterministic 32-channel per-endpoint runtime admission guard after session, target, and ACL validation but before channel allocation or target notification.
- Proved source saturation, target saturation, exact correlated rejection, target silence, and capacity reclamation for both endpoints.
- Removed the binding-side unopened-handle limit and singleton overflow handoff that silently discarded the second overflow.
- Proved 34 trusted-parent opened pushes survive late callback registration exactly once and in arrival order, without synthetic close or terminal records.
- Preserved trusted-parent filtering and the separate 32-event per-handle close-on-overflow policy.

## Task Commits

1. **Task 1: Bound concurrent channels at the authenticated runtime boundary** — `1744ee5` (TDD RED), `4ef39dc` (TDD GREEN)
2. **Task 2: Retain every trusted-parent opened handle for late delivery** — `74a89d0` (TDD RED), `5df0ff7` (TDD GREEN), `a07d835` (acceptance-name alignment)

## Files Created/Modified

- `packages/runtime/src/inc-handler.ts` — rejects opens when either authenticated endpoint already owns 32 live channels.
- `packages/runtime/src/runtime.test.ts` — exercises source/target capacity, target silence, and bilateral capacity release with unique deterministic IDs.
- `packages/shell/src/napplet-namespace.ts` — drains all trusted retained opened states without a binding-side overflow singleton.
- `packages/shell/src/napplet-namespace.test.ts` — proves ordered lossless late delivery and parent-source trust beyond the former capacity.

## NAP Authority Checked

- Merged `napplet/naps` `naps/NAP-INC.md` at exact master ref `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`, incorporating PRs #89, #90, and #92.

The merged specification unconditionally requires each incoming opened handle to be retained until at least one `channel.onOpened` handler receives it. It separately permits a shell to cap concurrent channels per napplet and recommends bounding runtime resources. The final design is conformant: admission happens before any trusted opened push, and every admitted push is retained.

## Decisions Made

- The runtime checks both authenticated endpoints' live `channelsByWindow` memberships and returns the existing correlated `inc.channel.open.result` error shape with `error: "channel limit reached"`.
- Rejected opens allocate no UUID, mutate no channel state, and notify no target.
- The projection binding has no independent unopened-handle drop policy; its existing per-channel event-buffer limit remains unchanged.

## Deviations from Plan

### Auto-fixed

**1. Replaced the runtime test adapter's collision-prone truncated UUID sequence**

- **Found during:** Task 1 RED verification
- **Issue:** The existing mock UUID sequence repeated after decimal truncation during the new 32-channel vector, causing unrelated channel identity collisions before the intended admission edge.
- **Fix:** The focused runtime test setup now emits deterministic collision-free 32-character IDs.
- **Files modified:** `packages/runtime/src/runtime.test.ts`
- **Verification:** The RED test reached the intended 33rd-open failure, and the GREEN suite passed all 22 runtime cases.

## Issues Encountered

- The initial high-volume test vector reached the runtime's unrelated initialization burst firewall. The source session was aged in the fixture so the test exercises steady-state channel admission without weakening production firewall behavior.
- The new shell regression failed before implementation because the 34th handle was omitted, exactly reproducing the verifier's N+2 blocker.

## User Setup Required

None.

## Verification

- `pnpm exec vitest run packages/runtime/src/runtime.test.ts` — passed (22 tests)
- `pnpm --filter @kehto/runtime type-check` — passed
- `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts` — passed (23 tests)
- `pnpm --filter @kehto/shell type-check` — passed
- `pnpm exec vitest run packages/runtime/src/runtime.test.ts packages/shell/src/napplet-namespace.test.ts` — passed (45 tests)
- `git diff --check` — passed for all four execution files

## Next Phase Readiness

- The concrete repeated-open blocker in `102-VERIFICATION.md` is closed and ready for re-verification against the merged NAP-INC authority.
- Published Napplet package adoption and the legacy full-E2E fixture cases remain intentionally assigned to Phase 105.

## Self-Check: PASSED

- Confirmed all four declared execution files exist.
- Confirmed commits `1744ee5`, `4ef39dc`, `74a89d0`, `5df0ff7`, and `a07d835` are present in branch history.

---

*Phase: 102-nap-inc-event-channel-parity*
*Completed: 2026-07-26*
