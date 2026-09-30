---
phase: 106-active-surface-conformance-and-release
plan: 03
subsystem: release-readiness
tags: [github-actions, playwright, changesets, napplet, release-gate]
requires:
  - phase: 106-02
    provides: focused real-shell browser evidence and the explicit UI-debt disposition
provides:
  - complete local release-gate evidence on a current branch
  - exact changeset accounting and green CI provenance for PR #204
  - a non-draft, mergeable PR #204 without merge or publication actions
affects: [release-process, pr-204, changesets, phase-106-verification]
tech-stack:
  added: []
  patterns: [exact-SHA CI verification, first-push evidence before final PR readiness]
key-files:
  created: [.planning/phases/106-active-surface-conformance-and-release/106-03-SUMMARY.md]
  modified: [.planning/phases/106-active-surface-conformance-and-release/106-RELEASE-CHECKLIST.md]
key-decisions:
  - "Recorded first-push CI in the repository and final-head CI in PR #204 to avoid claiming stale evidence."
  - "Kept the Phase 105 12/24 UI audit as explicit non-blocking follow-up debt, not a visual approval."
patterns-established:
  - "Release readiness requires local gates, exact head equality, and green required checks on that exact pushed SHA."
requirements-completed: [VERIFY-04, VERIFY-05, VERIFY-06]
coverage:
  - id: D1
    description: Complete local release readiness gate with exact seven-package changeset audit.
    requirement: VERIFY-04
    verification:
      - kind: integration
        ref: "node scripts/verify-napplet-authorities.mjs --check; pnpm build; pnpm type-check; pnpm test:unit; focused and full pnpm test:e2e; pnpm docs:check; npx --yes aislop@0.12.0 scan -d; git diff --check; pnpm changeset status"
        status: pass
    human_judgment: false
  - id: D2
    description: PR #204 at final pushed SHA is non-draft, mergeable, and green.
    requirement: VERIFY-05
    verification:
      - kind: integration
        ref: "gh pr view 204 and gh pr checks 204 at ccd9f4e02a749606a979e2ed7350d251d04c9043"
        status: pass
    human_judgment: false
  - id: D3
    description: Mutable napplet/naps and published-package authorities remain semantically conformant.
    requirement: VERIFY-06
    verification:
      - kind: integration
        ref: "node scripts/verify-napplet-authorities.mjs --check"
        status: pass
    human_judgment: false
duration: 18min
completed: 2026-07-27
status: complete
---

# Phase 106 Plan 03: Active-Surface Conformance and Release Summary

**Complete release-readiness evidence with a green, mergeable PR #204 at an exact verified SHA, without merging or publishing.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-27T16:03:49Z
- **Completed:** 2026-07-27T16:21:40Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- Verified current `origin/main` ancestry, exact Phase 105 seven-package minor changeset membership, and every required local release gate.
- Recorded first-push green CI provenance in the release checklist for `07d044c473b5520424f22f094266053749e972ad`.
- Marked PR #204 ready for review and confirmed its head equality, non-draft state, `MERGEABLE`/`CLEAN` status, and green required checks; the external PR body records the exact final metadata-head SHA and CI links.

## Task Commits

1. **Task 1: Synchronize current main, audit changesets, and run every final gate** — `07d044c` (`docs`)
2. **Task 2: Push the existing branch and make PR #204 merge-ready** — `ccd9f4e` (`docs`)

## Files Created/Modified

- `.planning/phases/106-active-surface-conformance-and-release/106-RELEASE-CHECKLIST.md` — validated local-gate, changeset, first-push, and CI evidence.
- `.planning/phases/106-active-surface-conformance-and-release/106-03-SUMMARY.md` — plan completion and release-readiness handoff.

## Decisions Made

- Used the first pushed evidence commit to make repository-resident CI evidence immutable, then verified the final evidence commit separately at its exact PR head.
- Left the Phase 105 UI audit at 12/24 as visible Kehto-maintainer follow-up debt; no visual-pass claim was made.
- Stopped at a green PR #204. Merge, Version Packages mutation, tagging, release dispatch, and registry publication remain out of scope.

## Verification

- `node scripts/verify-napplet-authorities.mjs --check` — PASS.
- `pnpm build`, `pnpm type-check`, `pnpm test:unit` (125 files / 1,571 tests), focused E2E (9 passed), full E2E, `pnpm docs:check`, pinned `npx --yes aislop@0.12.0 scan -d` (100/100), `git diff --check`, and `pnpm changeset status` — PASS.
- Final PR #204 checks for its pushed metadata head: Detect CI Scope, Build & Type-Check, Detect Playwright Scope, Vitest, Playwright, and Changeset deletion guard — PASS. The generated-JSR sub-step was intentionally scope-skipped for the non-Version-Packages change; exact SHA and URLs are maintained in the PR body.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

GitHub Playwright browser provisioning made the first CI run longer than the local test run; it completed successfully and required no source change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

PR #204 is ready for maintainer review; its external Phase 106 section records the exact final branch-head SHA and CI evidence. It must be merged and released only through the repository's protected post-merge release process.

## Self-Check: PASSED

- Summary and release-checklist artifacts exist.
- Both task commits (`07d044c`, `ccd9f4e`) exist in repository history.

---
*Phase: 106-active-surface-conformance-and-release*
*Completed: 2026-07-27*
