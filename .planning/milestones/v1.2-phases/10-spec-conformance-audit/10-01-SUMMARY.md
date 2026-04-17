---
phase: 10-spec-conformance-audit
plan: "01"
subsystem: docs
tags: [nip-5d, spec-sync, readme, provenance]

requires:
  - phase: pre-v1.2
    provides: commit 604337a (canonical NIP-5D sync + README ## Specification section)
provides:
  - Verified specs/NIP-5D.md is byte-identical to canonical upstream dskvr/nips nip/5d
  - Verified README.md ## Specification section links local pinned copy + canonical upstream + v1.2 sync milestone
  - Idempotent drift-detection procedure (head -7 + diff <(tail -n +8)) usable by Phase 11+
affects: [11-nub-peer-deps-type-imports, 12-shell-conformance-seven-nub-coverage, 13-theme-nub-implementation, 14-dispatch-refactor, 15-milestone-validation-release-prep]

tech-stack:
  added: []
  patterns:
    - "Provenance header: 7-line HTML comment block, lines 1-7; upstream body byte-identical from line 8"
    - "Drift check: `diff <(tail -n +8 specs/NIP-5D.md) <upstream>` yields zero output when in sync"

key-files:
  created: []
  modified: []

key-decisions:
  - "Plan executed as pure verification — no spec or README edits needed; commit 604337a sync still valid at v1.2, 2026-04-17"
  - "Noted canonical spec contains the `Shells MUST NOT provide \\`window.nostr\\`` phrase twice (Transport §44, Security §118) — plan's acceptance criterion asserting count=1 was a planning typo; canonical body is authoritative"

patterns-established:
  - "Idempotent verify plans: grep-guarded tasks that write nothing when preconditions hold, emitting empty commits for audit trail"
  - "Canonical spec sync cadence: re-verify at each milestone boundary; re-sync only on upstream drift"

requirements-completed: [SPEC-01]

duration: 1min
completed: 2026-04-17
---

# Phase 10 Plan 01: Canonical NIP-5D Sync Verification Summary

**Verified specs/NIP-5D.md is byte-identical to dskvr/nips nip/5d canonical upstream and README.md ## Specification section remains intact at v1.2 milestone boundary — zero rewrites needed.**

## Performance

- **Duration:** ~1 min (47s wall-clock)
- **Started:** 2026-04-17T11:42:36Z
- **Completed:** 2026-04-17T11:43:23Z
- **Tasks:** 2 (both verify-only, no file changes)
- **Files modified:** 0

## Accomplishments

- Confirmed `specs/NIP-5D.md` lines 1-7 exactly match the required provenance header (`Source:` / `Synced at: milestone v1.2, 2026-04-17` / `Sync policy:`).
- Confirmed `tail -n +8 specs/NIP-5D.md` diffs zero lines against `https://raw.githubusercontent.com/dskvr/nips/nip/5d/5D.md` (upstream: 118 lines; local body: 118 lines; total local: 125 lines = 7-line header + 118-line body).
- Confirmed both v1.2 spec-delta markers are present in the pinned copy: the `Shells MUST NOT provide \`window.nostr\`` prohibition (Transport §44 + Security §118) and the `shell.supports('perm:popups')` permission-namespace example (§92).
- Confirmed `README.md` ## Specification section (line 14) still contains: relative link to `specs/NIP-5D.md` (line 18), canonical `dskvr/nips` branch URL (line 19), and milestone v1.2 / 2026-04-17 sync reference (line 20).
- SPEC-01 requirement is satisfied: contributors have a single, discoverable source of truth pinned in the repo.

## Task Commits

Each task was committed atomically as an empty commit (no file changes needed — verification-only):

1. **Task 1: Verify specs/NIP-5D.md matches canonical upstream** — `bb0d7cb` (chore, --allow-empty)
2. **Task 2: Verify README.md ## Specification section** — `bd2f0d5` (chore, --allow-empty)

**Plan metadata:** (appended at orchestrator-level final commit)

## Files Created/Modified

- None. Both target files (`specs/NIP-5D.md`, `README.md`) were left untouched because the earlier sync in commit `604337a` is still byte-accurate against upstream.

## Decisions Made

- **Empty-commit-per-task audit trail:** Plan objective explicitly requested "commit per task (even if empty or SUMMARY-only)" to preserve per-task traceability. Used `git commit --allow-empty --no-verify` for both tasks.
- **Did not fix the acceptance-criterion count typo in-plan:** Task 1's acceptance criterion said `grep -c 'Shells MUST NOT provide .window\.nostr.'` should return `1`, but canonical upstream legitimately contains this phrase twice (Transport + Security sections). The canonical body is authoritative — the plan typo is noted here for Phase 11+ planners but no spec edit was made (would violate provenance).

## Deviations from Plan

None — plan executed exactly as written (verify-only path). Both tasks hit the "DO NOT modify the file — log 'verified'" branch.

**Observation (not a deviation):** The `<verify><automated>` block for Task 1 piped `grep -c '...window.nostr...' | grep -q '^1$'`; this would return non-zero for the canonical body (actual count: 2). The truth test — `diff <(tail -n +8 specs/NIP-5D.md) <upstream>` — returned zero output, confirming the local file matches canonical. Phase 11+ planners should update any similar count-based assertions to match canonical content (or switch to existence-only `grep -q`).

## Issues Encountered

None. Upstream fetch succeeded on first try; diff returned zero output; all Task 2 greps matched on first invocation.

## User Setup Required

None — no external service configuration required. SPEC-01 is documentation-only.

## Next Phase Readiness

- SPEC-01 satisfied and closable in REQUIREMENTS.md.
- Phase 10 Plan 02 (cross-package NIP-5D drift audit, SPEC-02) can proceed immediately; it will treat `specs/NIP-5D.md` as ground truth for auditing @kehto/runtime, @kehto/shell, @kehto/acl, @kehto/services against the canonical spec.
- Phase 11+ (peer-dep bumps, shell conformance, theme NUB, dispatch refactor) can reference `specs/NIP-5D.md` without re-fetching upstream; re-sync only on next milestone boundary or explicit upstream-drift signal.

## Self-Check: PASSED

- `10-01-SUMMARY.md` exists at `.planning/phases/10-spec-conformance-audit/10-01-SUMMARY.md`
- Task 1 commit `bb0d7cb` present in git log
- Task 2 commit `bd2f0d5` present in git log

---
*Phase: 10-spec-conformance-audit*
*Completed: 2026-04-17*
