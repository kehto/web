---
phase: 106
plan: 01
subsystem: conformance-evidence
tags: [napplet, authority, static-guard, traceability]
requires:
  - phase-105-verification
provides:
  - fail-closed PR/package authority reconciliation
  - classified active-surface migration guard
  - machine-verified Phase 101-105 evidence matrix
affects: [106-02, 106-03, release-readiness]
tech_stack:
  added: [Node.js built-ins, gh api, npm view, JSR metadata]
  patterns: [fail-closed evidence checks, scoped static scans, exact-title traceability]
key_files:
  created:
    - scripts/verify-napplet-authorities.mjs
    - .planning/phases/106-active-surface-conformance-and-release/106-AUTHORITY-REVALIDATION.md
    - scripts/verify-phase-106-conformance-matrix.mjs
    - .planning/phases/106-active-surface-conformance-and-release/106-CONFORMANCE-MATRIX.md
  modified:
    - tests/unit/sdk-migration-guard.test.ts
    - docs/superpowers/specs/2026-06-15-nap-intent-design.md
decisions:
  - PR #89's expanded symmetric channel contract is already conformant in the current runtime and protected prelude.
  - Dated intent design material remains intact behind a prominent non-authoritative banner.
  - Each completed Phase 101-105 requirement retains a separate ordered matrix row even when tests are shared.
metrics:
  duration: 10m
  completed: 2026-07-27
  tasks_completed: 3
  files_changed: 6
status: complete
---

# Phase 106 Plan 01: Active-Surface Conformance Foundations Summary

Fail-closed authority and traceability guards prove the current NAP/package line, bounded active guidance, and executable evidence for all completed prior-phase requirements.

## Completed Tasks

1. **Authority revalidation tracer** — `111d7c7`
   - Added live GitHub PR #89–#92, npm, JSR, installed-artifact, manifest, and lockfile reconciliation.
   - Recorded the #89 head/merge/master distinction and its clause-level symmetric-channel verdict.
2. **Classified active-surface guard (TDD)** — `24f3d33`, `244c968`
   - Added a failing RED test, then explicit active guidance/source inventories and region-scoped obsolete-shape checks.
   - Marked the dated NAP-INTENT design as historical without rewriting its body.
3. **Focused conformance evidence matrix** — `5f2e6b0`, `ac89b96`
   - Added a Node-only verifier that requires an exact ordered row, file, title, evidence, command, and passing result for every completed Phase 101–105 requirement.

## Verification

- `node scripts/verify-napplet-authorities.mjs --check` — PASS
- Focused authority packages: 2 files / 11 tests — PASS
- Active-surface guards: 3 files / 47 tests — PASS
- `pnpm docs:check` — PASS
- `node scripts/verify-phase-106-conformance-matrix.mjs --check` — 47 requirements, 9 files / 94 tests — PASS
- `pnpm test:unit` — 125 files / 1,571 tests — PASS
- `npx --yes aislop@0.12.0 scan -d` — 100/100 PASS
- `git diff --check` — PASS

## Decisions Made

- The current worktree already meets PR #89’s target-side `inc.channel.opened`, retained inbound handle, terminal closure, and symmetric-channel obligations; no product-source repair was needed.
- Historical planning, changeset, changelog, migration, and fixture material remains excluded from active migration scanning.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Quality] Removed an unused matrix-verifier import**
- **Found during:** Plan-level quality verification
- **Issue:** The pinned AI-slop scan reported an unused `relative` import and scored 97/100.
- **Fix:** Removed the unused import from the verifier.
- **Files modified:** `scripts/verify-phase-106-conformance-matrix.mjs`
- **Verification:** Matrix verifier passed; pinned scanner returned 100/100.
- **Commit:** `ac89b96`

**Total deviations:** 1 auto-fixed. **Impact:** No behavior or scope change.

## Known Stubs

None.

## Self-Check: PASSED

- All six declared plan artifacts exist.
- Task and follow-up commits `111d7c7`, `24f3d33`, `244c968`, `5f2e6b0`, and `ac89b96` exist in git history.
