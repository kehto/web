---
phase: 10-spec-conformance-audit
plan: 01
subsystem: docs
tags: [nip-5d, spec, readme, provenance, sync, specs, documentation]

# Dependency graph
requires: []
provides:
  - Pinned NIP-5D spec at specs/NIP-5D.md (byte-identical to napplet upstream)
  - Provenance header documenting upstream source, sync milestone, and sync policy
  - Top-level README.md with Specification section linking local + upstream spec
  - Stable spec path that phases 10-02, 12, 13, 14 can cite in plans and audits
affects:
  - 10-02-audit-drift (consumes specs/NIP-5D.md as audit source)
  - 12-four-nub-full-coverage-drift-fixes (remediates drift cited against this spec)
  - 13-theme-nub-implementation (theme drift referenced against this spec)
  - 14-dispatch-refactor (dispatch-API drift referenced against this spec)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "specs/NIP-5D.md synced from napplet/specs/NIP-5D.md at milestone boundaries"
    - "HTML-comment provenance header (6-line prefix) at top of synced spec files"
    - "README ## Specification section as canonical pointer to pinned spec + upstream source"

key-files:
  created:
    - specs/NIP-5D.md
    - README.md
  modified: []

key-decisions:
  - "Provenance header is exactly 6 lines so `tail -n +7` yields byte-identical upstream content, making drift detection a single `diff` call"
  - "README kept minimal (30 lines, well under the 80-line cap) — Specification section is the SPEC-01 deliverable; other sections exist only so the repo root README is presentable"
  - "Sync anchor names the milestone (v1.2) + ISO date (2026-04-17) so future contributors can detect staleness at a glance"

patterns-established:
  - "Spec sync pattern: provenance HTML comment (6 lines) + verbatim upstream body; verify via `diff <(tail -n +7 synced) upstream`"
  - "README points at both local pinned path (`specs/NIP-5D.md`) and upstream URL so drift audits always have two anchors"

requirements-completed:
  - SPEC-01

# Metrics
duration: 4min
completed: 2026-04-17
---

# Phase 10 Plan 01: Spec Snapshot Summary

**Pinned NIP-5D v0.1.0 into kehto at `specs/NIP-5D.md` with provenance header, and added top-level README.md documenting the upstream sync source for milestone v1.2.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-17T09:46:30Z
- **Completed:** 2026-04-17T09:49:49Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- Snapshotted `napplet/specs/NIP-5D.md` into `specs/NIP-5D.md` byte-identically under a 6-line provenance comment (SPEC-01 artifact #1).
- Added top-level `README.md` with `## Specification` section that links to the local pinned copy, the upstream GitHub URL, and names milestone v1.2 (2026-04-17) as the sync anchor (SPEC-01 artifact #2).
- Established the drift-detection invariant for all future milestones: `diff <(tail -n +7 specs/NIP-5D.md) napplet/specs/NIP-5D.md` must exit 0 at sync time; any non-zero exit in a later milestone is evidence of upstream drift.
- Zero code in `packages/` touched (`git diff --stat HEAD~2 HEAD -- packages/` returns empty) — this is a pure docs/snapshot plan as the phase scope requires.

## Task Commits

Each task was committed atomically:

1. **Task 1: Copy NIP-5D spec into specs/NIP-5D.md with provenance header** — `18cc540` (docs)
2. **Task 2: Add or update README.md with spec reference section** — `b69c165` (docs)

## Files Created/Modified

- `specs/NIP-5D.md` (created, 121 lines) — pinned NIP-5D spec; lines 1–6 are the provenance HTML comment, lines 7–121 are byte-identical to `napplet/specs/NIP-5D.md` (115 lines upstream).
- `README.md` (created, 30 lines) — top-level repo README with `# kehto`, `## Overview`, `## Packages`, `## Specification`, `## Build` sections. Specification section links to both `./specs/NIP-5D.md` and `https://github.com/sandwichfarm/napplet/blob/main/specs/NIP-5D.md`, names milestone v1.2 (2026-04-17) as the sync anchor, and restates the "do not edit in-place" rule.

## Decisions Made

- **Provenance block is exactly 6 lines, not 7.** The plan's example shape had a trailing blank line after `-->`, but both the plan's automated verify (`diff <(tail -n +7 specs/NIP-5D.md) napplet/specs/NIP-5D.md`) and the `wc -l` acceptance criterion treat the prefix as 6 lines with upstream content starting directly at line 7. Honoring the verify command ensures the drift-detection invariant works. (Deviation Rule 1 — bug in the example fragment, not in the verify logic.)
- **No separator line between provenance and spec body.** Same reason as above — `tail -n +7` must yield upstream content exactly.
- **README kept to 30 lines.** The plan cap was ~80 lines; staying short keeps the README focused on orienting new contributors to the spec pointer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Removed blank line between provenance block and spec body**
- **Found during:** Task 1 (first verification run)
- **Issue:** The plan's example shape showed a trailing blank line after `-->`, but the task's own automated verify (`diff <(tail -n +7 specs/NIP-5D.md) napplet/specs/NIP-5D.md`) and `wc -l` acceptance criterion require the provenance block to be exactly 6 lines with upstream content starting on line 7 (not line 8). Left as written, `tail -n +7` emits a leading blank line that doesn't exist in upstream, so `diff` fails.
- **Fix:** Deleted the blank line between `-->` and `NIP-5D` so the provenance block is exactly 6 lines.
- **Files modified:** `specs/NIP-5D.md`
- **Verification:** `diff <(tail -n +7 specs/NIP-5D.md) napplet/specs/NIP-5D.md` exits 0; `wc -l`: 121 (synced) - 6 (provenance) = 115 (upstream).
- **Committed in:** `18cc540` (part of Task 1 commit — fix applied before commit)

---

**Total deviations:** 1 auto-fixed (1 bug in plan's example fragment vs. its own verify command)
**Impact on plan:** None — the verify-command-driven fix preserves the drift-detection invariant, which is the whole point of the 6-line header. No scope creep.

## Issues Encountered

- None beyond the example-vs-verify discrepancy documented under Deviations.

## User Setup Required

None — pure docs/snapshot plan, no external services touched.

## Next Phase Readiness

- `10-02-PLAN.md` (Cross-Package Conformance Audit) can now cite `specs/NIP-5D.md` as its spec source. The pinned path is the single source of truth for every audit row in `docs/v1.2-NIP-5D-AUDIT.md`.
- Phases 12, 13, and 14 inherit this spec anchor — drift-remediation plans in those phases will reference drift items that were diffed against this snapshot.
- Any future re-sync (at the next milestone boundary) only needs to: `cp napplet/specs/NIP-5D.md specs/NIP-5D.md` + re-prepend a fresh 6-line provenance block + bump the milestone/date in README. The 6-line invariant means `diff <(tail -n +7 specs/NIP-5D.md) napplet/specs/NIP-5D.md` remains the one-command drift check.

## Self-Check: PASSED

- `specs/NIP-5D.md` exists — FOUND
- `README.md` exists — FOUND
- Commit `18cc540` (Task 1: spec snapshot) — FOUND
- Commit `b69c165` (Task 2: README) — FOUND
- `10-01-SUMMARY.md` exists — FOUND

---
*Phase: 10-spec-conformance-audit*
*Completed: 2026-04-17*
