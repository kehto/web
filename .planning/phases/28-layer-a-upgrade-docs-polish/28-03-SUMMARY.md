---
phase: 28-layer-a-upgrade-docs-polish
plan: 03
subsystem: docs, testing
tags: [playwright, e2e, readme, napplet, nip-5d, anti-term-hygiene]

# Dependency graph
requires:
  - phase: 28-01
    provides: E2E-14 — real-backend harness extension + upgraded nub-keys/nub-media specs
  - phase: 28-02
    provides: DOCS-05 — @kehto/services README extended with Keys + Media sections
provides:
  - DOCS-06 — apps/demo/README.md created from scratch with 10-napplet inventory table, service topology, ACL surface, host-hook catalog, v1.3→v1.4 history line
  - 28-ITERATION-LOG.md — Phase 28 phase-close evidence: fresh-build 49/0/0 no-delta, full v1.4-surface anti-term hygiene sweep (zero real violations), milestone-gate handoff
affects: [gsd:audit-milestone, gsd:complete-milestone v1.4, gsd:cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canonical 7-section README skeleton (H1 title + Run + Inventory/Topology/ACL/Hooks/License H2s) applied to apps/demo package"
    - "Fresh-build iteration loop discipline: manual-clean + pnpm build + pnpm test:e2e recorded in ITERATION-LOG.md per v1.3 Phase 22 canon; Phase 28 no-delta (49→49) because upgrade is in-place"
    - "Anti-term hygiene sweep false-positive documentation: grep -v ANTI_TERM_RE filters spec declaration lines; broader false-positive classes (JSDoc migration docs, signer\.sign over-match) documented inline"

key-files:
  created:
    - apps/demo/README.md
    - .planning/phases/28-layer-a-upgrade-docs-polish/28-ITERATION-LOG.md
  modified: []

key-decisions:
  - "Anti-term grep's 27 raw matches are all documented false-positive classes (JSDoc/comments explaining deleted features, signer.signEvent method call mis-matching signer.sign pattern, spec file comment references) — zero real violations; full catalog documented in 28-ITERATION-LOG.md"
  - "Phase 28 closes v1.4 with STUB_ONLY_SERVICES=[] and 49-spec E2E baseline unchanged; coverage-depth upgrade (Layer-A real-backend) is NOT a spec-count delta"

patterns-established:
  - "Per-napplet grant-hook pattern (__grantKeysForward__ + __grantMediaControl__) documented in apps/demo/README.md Host Hooks section — future E2E napplets follow the same __grant<Capability>__ preinstallation pattern"
  - "Iteration log NO-DELTA pattern: when a phase rewrites specs in-place without adding new files, the log records baseline=final=N and delta=0 with an explanation of the coverage-depth change"

requirements-completed: [DOCS-06]

# Metrics
duration: 3min
completed: 2026-04-19
---

# Phase 28 Plan 03: DOCS-06 + Fresh-Build Iteration Loop + v1.4 Milestone-Gate Close Summary

**apps/demo/README.md created from scratch with 10-napplet inventory table (v1.3→v1.4 history line, STUB_ONLY_SERVICES=[], host-hook catalog) + Phase 28 iteration loop 49/0/0 no-delta confirmed + full v1.4-surface anti-term sweep: 0 real violations documented**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-19T18:30:57Z
- **Completed:** 2026-04-19T18:34:03Z
- **Tasks:** 2
- **Files modified:** 2 (created)

## Accomplishments

- Created `apps/demo/README.md` from scratch — canonical 7-section skeleton (H1 + 6 H2s); 10-row napplet inventory table (alphabetical, hotkey-chord + media-controller v1.4 additions noted); v1.3→v1.4 history line; STUB_ONLY_SERVICES=[] service topology; ACL surface with full capability list; host-hook catalog cross-referencing Playwright spec files; MIT license
- Ran fresh-build iteration loop (manual-clean → pnpm build 22 tasks / 0 cached → pnpm test:e2e); 49 passed / 0 failed / 0 skipped — NO-DELTA in-place upgrade confirmed (Phase 27 baseline = Phase 28 final = 49)
- Full v1.4-surface anti-term hygiene sweep: 27 raw grep matches, all documented false-positive classes, zero real violations; raw-postMessage grep on new napplets = 0; skip-marker audit = 0
- Phase 28 milestone-gate satisfied: v1.4 closes with all 49 E2E specs passing, all REQ-IDs (E2E-14, DOCS-05, DOCS-06) marked closed in 28-ITERATION-LOG.md

## Task Commits

1. **Task 1: Create apps/demo/README.md** - `393f235` (docs)
2. **Task 2: Fresh-build iteration loop + anti-term sweep + 28-ITERATION-LOG.md** - `126b132` (docs)

## Files Created/Modified

- `/home/sandwich/Develop/kehto/apps/demo/README.md` — 10-napplet README with canonical 7-section skeleton; run instructions, inventory table, service topology, ACL surface, host hooks, license
- `/home/sandwich/Develop/kehto/.planning/phases/28-layer-a-upgrade-docs-polish/28-ITERATION-LOG.md` — Phase 28 close evidence: build/test run output, anti-term hygiene documentation, milestone-gate handoff

## Decisions Made

- Anti-term grep's 27 raw matches are documented false-positive classes (JSDoc/comments/over-broad `signer\.sign` pattern), not real violations. Full catalog documented in 28-ITERATION-LOG.md so future audits can trace the reasoning.
- Phase 28 closes with 49-spec baseline unchanged vs Phase 27. The in-place spec upgrade (Plan 28-01) is a coverage-depth delta, not a spec-count delta.

## Deviations from Plan

None - plan executed exactly as written. The anti-term grep returned 27 raw matches (more than the expected 0) but all are documented false-positive classes present throughout v1.4 — not Phase 28 regressions. The iteration loop ran clean on iteration 1 (no regression recovery needed).

## Issues Encountered

**Anti-term grep false-positive analysis** (not a deviation — expected per plan instructions): The grep pattern `signer\.sign` catches `signer.signEvent(...)` calls on local signer objects in `apps/demo/src/main.ts` and in ACL unit tests that test the ABSENCE of signer capability. These are not the forbidden `signer-service` NUB pattern. The plan's `grep -v 'ANTI_TERM_RE'` filter handles spec declaration lines; the broader false-positive class (JSDoc migration docs, method call over-matches) is cataloged in 28-ITERATION-LOG.md.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 28 is the v1.4 capstone — no Phase 29 in the v1.4 roadmap
- v1.4 milestone-gate satisfied: all 49 E2E specs pass, STUB_ONLY_SERVICES=[], REQ-IDs E2E-14 + DOCS-05 + DOCS-06 all closed
- Ready for autonomous lifecycle handoff: `gsd:audit-milestone` → `gsd:complete-milestone v1.4` → `gsd:cleanup`

---
*Phase: 28-layer-a-upgrade-docs-polish*
*Completed: 2026-04-19*
