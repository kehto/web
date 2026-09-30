---
phase: 106
plan: 02
subsystem: release-evidence
tags: [playwright, paja, playground, conformance, release-checklist, ui-debt]
requires:
  - phase-106-01-conformance-evidence
provides:
  - real-shell focused browser evidence for Paja and playground protocol flows
  - explicit Phase 105 UI-debt disposition and release-operation boundary
affects: [106-03, PR-204, release-readiness]
tech-stack:
  added: []
  patterns: [named browser-flow evidence, explicit optional-skip accounting, release-boundary documentation]
key-files:
  created:
    - .planning/phases/106-active-surface-conformance-and-release/106-RELEASE-CHECKLIST.md
  modified: []
key-decisions:
  - Focused browser evidence records every required real-shell flow and treats mandatory skips or failures as blocking.
  - The 12/24 Phase 105 UI audit remains visible, non-blocking protocol-release debt owned by Kehto maintainers.
  - This phase proves PR-readiness evidence only; merging, versioning, tagging, and publishing remain unexecuted release-process steps.
patterns-established:
  - Release checklists distinguish recorded evidence from pending PR and post-merge release activity.
requirements-completed: [VERIFY-03]
coverage:
  - id: D1
    description: Focused Paja and playground browser evidence covers startup, exact INC routing, URI-authoritative intent delivery, identity/resource behavior, and atomic theme delivery.
    requirement: VERIFY-03
    verification:
      - kind: e2e
        ref: pnpm test:e2e -- tests/e2e/napplet-auth.spec.ts tests/e2e/inc-roundtrip.spec.ts tests/e2e/nap-inc-playground.spec.ts tests/e2e/identity-flow.spec.ts tests/e2e/theme-broadcast.spec.ts tests/e2e/playground-profile-intent.spec.ts tests/e2e/profile-open.spec.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Phase 105 UI debt is explicitly linked, owned, and excluded from visual sign-off or a Phase 106 redesign.
    requirement: VERIFY-04
    verification:
      - kind: other
        ref: .planning/phases/106-active-surface-conformance-and-release/106-RELEASE-CHECKLIST.md
        status: pass
    human_judgment: false
metrics:
  duration: 5m
  completed: 2026-07-27
  tasks_completed: 2
  files_changed: 1
status: complete
---

# Phase 106 Plan 02: Active-Surface Conformance and Release Summary

Real built-shell Playwright evidence now names all required Paja/playground protocol flows, while the 12/24 UI audit remains an honest Kehto-maintainer follow-up rather than visual sign-off.

## Performance

- **Duration:** 5m
- **Started:** 2026-07-27T15:54:30Z
- **Completed:** 2026-07-27T15:59:57Z
- **Tasks:** 2/2
- **Files modified:** 1

## Accomplishments

- Ran the exact seven-file repository `test:e2e` command through built Paja and playground shell paths: 9 Playwright tests passed, 0 failed, and 0 skipped in 17 seconds.
- Recorded explicit evidence for domain-gated startup, exact INC events/channels, source-independent canonical intent delivery, identity/resource behavior, and state-before-one-push atomic themes.
- Linked the Phase 105 desktop/mobile 12/24 audit and its recoverability, type-scale, token/spacing, and mobile-composition concerns without representing it as a pass.
- Recorded that PR #204 merge, Version Packages metadata, exact target-main CI, tagging, and `release.yml` publishing are later unexecuted steps.

## Task Commits

1. **Task 1: Prove the required host flows through real Paja and playground frames** — `216b5e9` (`docs`)
2. **Task 2: Record the non-blocking UI debt and the exact PR/release boundary** — `d10bfac` (`docs`)

## Verification

- `pnpm test:e2e -- tests/e2e/napplet-auth.spec.ts tests/e2e/inc-roundtrip.spec.ts tests/e2e/nap-inc-playground.spec.ts tests/e2e/identity-flow.spec.ts tests/e2e/theme-broadcast.spec.ts tests/e2e/playground-profile-intent.spec.ts tests/e2e/profile-open.spec.ts` — 9 passed, 0 failed, 0 skipped (rerun as the plan-level gate; 17s).
- `pnpm test:unit` — 125 files / 1,571 tests passed (4s).
- Checklist acceptance assertions for the audit link, `12/24`, Kehto-maintainer ownership, and non-authorized release operations — PASS.
- `git diff --check` — PASS.

## Files Created/Modified

- `.planning/phases/106-active-surface-conformance-and-release/106-RELEASE-CHECKLIST.md` — focused browser evidence, UI-debt disposition, and PR/release boundary.

## Decisions Made

- Treat every required focused browser flow as mandatory and record no skip unless it is the separately classified optional live-network Good Morning Protocol case; the focused run had no skips.
- Keep the Phase 105 UI audit as non-blocking protocol-release debt because this plan proves runtime conformance, not the host redesign that audit recommends.
- Preserve the release authority boundary: a maintainer must perform post-merge versioning, exact-main CI validation, and release actions.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 106-03 can consume the checklist’s browser and UI-debt evidence for the full release gate and final PR #204 state. Full-gate, changeset, branch synchronization, and release operations remain intentionally pending.

## Self-Check: PASSED

- The release checklist and this summary exist in the Phase 106 directory.
- Task commits `216b5e9` and `d10bfac` exist in git history.

---
*Phase: 106-active-surface-conformance-and-release*
*Completed: 2026-07-27*
