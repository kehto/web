---
phase: 22-docs-refresh-release-rehearsal
plan: 5
subsystem: release-rehearsal
tags: [changesets, changeset-version, throwaway-branch, version-bump, peer-deps, publish-readiness, dry-run]

# Dependency graph
requires:
  - phase: 22-docs-refresh-release-rehearsal
    provides: "4 staged `.changeset/v1-2-*.md` files (one per @kehto/* package, all `minor`); canonical ESM-only package.json shape on all 4 packages; changesets config with `updateInternalDependencies: patch`; main HEAD at ad5357c from 22-04"
provides:
  - "REL-03 gap closed — `pnpm changeset version` dry-run on throwaway branch `gsd/release-rehearsal-v1.3` exited 0; version bumps applied minor 0.1.0 → 0.2.0 across acl/runtime/shell/services; `pnpm install --frozen-lockfile` exited 0 with no lockfile drift"
  - "Peer-dep mutation audit — `@napplet/core` range stays `^0.2.0` in all 4 @kehto/* packages; all `@napplet/nub-*` ranges stay `^0.2.0`; `nostr-tools` unchanged in @kehto/shell; no unexpected range changes detected"
  - "Rollback proof — throwaway branch created from main, exercised, deleted; `main` HEAD advanced only by the single iteration-log commit (`ad5357c` → `dfe09ca`); `git branch --list gsd/release-rehearsal-v1.3` empty at plan end; `changeset publish` explicitly NOT invoked (D-05 hard rule)"
  - "22-ITERATION-LOG.md REL-03 section (281 lines added) — verbatim tool output, pre/post-bump version table, peer-dep audit, full diff summary, generated CHANGELOG inventory, rollback proof, hard-rule audit, CLOSED status marker"
affects: [22-06-v1-3-changesets, 22-07-e2e-10, 22-08-phase-close]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Throwaway-branch dry-run pattern for `changeset version`: capture diff → stash to /tmp → checkout main → delete branch → `git checkout HEAD -- <mutated>` to clean working-tree leak → remove untracked CHANGELOGs → then write log on main", "Main-HEAD-unchanged assertion: capture `$(git rev-parse HEAD)` before branch creation, compare against post-rollback SHA — guarantees the rehearsal did not leak into main"]

key-files:
  created:
    - ".planning/phases/22-docs-refresh-release-rehearsal/22-05-SUMMARY.md"
  modified:
    - ".planning/phases/22-docs-refresh-release-rehearsal/22-ITERATION-LOG.md"

key-decisions:
  - "REL-03 dry-run passed with zero unexpected mutations — `@napplet/core` and all `@napplet/nub-*` peer-dep ranges remain `^0.2.0` across all 4 packages after `changeset version`; the `Peer deps:` prose in CHANGELOG bodies is documentation of the historical v1.1→v1.2 bump (carried verbatim from the original changeset markdown), not a new mutation."
  - "Working-tree leak fix applied during rollback — `git checkout main` carries the throwaway branch's uncommitted `changeset version` mutations (.changeset deletions, package.json bumps, untracked CHANGELOGs) into main's working tree; the rollback step adds `git checkout HEAD -- <files>` plus `rm -f <CHANGELOGs>` to fully restore main's pre-rehearsal state before the iteration-log commit. The throwaway branch itself had no commits, so `git branch -D` reports `(was ad5357c)` — the same SHA as main, confirming no commits leaked."
  - "Internal-dep fan-out caught as expected (not a finding) — `apps/demo/package.json` and `tests/e2e/harness/package.json` received `0.0.0 → 0.0.1` patch bumps due to `updateInternalDependencies: patch` in `.changeset/config.json`; both are `\"private\": true` so they are excluded from any future `changeset publish`."
  - "Retry-safe execution — prior attempt hit a usage limit mid-flight and was rolled back manually by the orchestrator (branch deleted, package.json mutations reverted, CHANGELOGs removed, v1-2-*.md changesets restored). Fresh re-run followed plan steps verbatim (Option 1 recommended over using pre-captured /tmp/rel-03-notes/ artifacts) and produced clean evidence end-to-end; no state carried from the aborted attempt except informational /tmp artifacts."

patterns-established:
  - "Throwaway-branch dry-run + stash-to-/tmp + rollback + on-main log-write: rehearsal mutations never land in main's git objects; evidence is written only after the branch is deleted and main's HEAD is asserted unchanged. Reusable for any `changeset version` rehearsal, lockfile migration rehearsal, or schema-migration dry-run."
  - "Reflog publish audit: `git reflog | grep -i publish` post-plan must not contain any entries attributable to this plan; historical commit-subject matches (publishTheme, publishEncrypted, etc.) are acceptable because `pnpm changeset publish` does not itself produce reflog entries — absence of *new* publish-related entries is the signal."

requirements-completed: [REL-03]

# Metrics
duration: 4min
completed: 2026-04-18
---

# Phase 22 Plan 05: changeset version Dry-Run Summary

**Exercised `pnpm changeset version` on throwaway branch `gsd/release-rehearsal-v1.3`, confirmed minor 0.1.0 → 0.2.0 bumps on all 4 @kehto/* packages with zero peer-dep range mutations and zero lockfile drift, captured verbatim evidence in 22-ITERATION-LOG.md, discarded the branch, and verified main HEAD unchanged — REL-03 closed; `changeset publish` explicitly NOT invoked (D-05 hard rule).**

## Performance

- **Duration:** 4 min 26 s
- **Started:** 2026-04-18T13:10:12Z
- **Completed:** 2026-04-18T13:14:38Z
- **Tasks:** 1
- **Files modified:** 1 (22-ITERATION-LOG.md — 281 lines added)

## Accomplishments

- **REL-03 closed** — `pnpm changeset version` exited 0 on the throwaway branch `gsd/release-rehearsal-v1.3`; the 4 staged `.changeset/v1-2-{acl,runtime,shell,services}.md` files were consumed; all 4 @kehto/* packages bumped minor 0.1.0 → 0.2.0; new `CHANGELOG.md` files generated with verbatim changeset-body content; internal-dep fan-out (apps/demo and @test/harness both `private:true` → 0.0.1) captured as expected.
- **Lockfile stability confirmed** — `pnpm install --frozen-lockfile` exited 0 after the version bump with "Already up to date" (0 packages resolved, 0 packages added/removed). Version bumps don't touch the dependency tree structure, so the lockfile remains valid.
- **Peer-dep range audit clean** — direct `git show main:packages/<pkg>/package.json` comparison against the post-bump throwaway-branch file confirms all 9 `@napplet/*` peer-dep ranges (@napplet/core + 8 @napplet/nub-*) remain `^0.2.0` on all 4 packages; `nostr-tools` unchanged in @kehto/shell. **No unexpected mutations.**
- **Rollback proof captured** — `main` HEAD `ad5357c` before and after the throwaway-branch round-trip; `git branch --list gsd/release-rehearsal-v1.3` returns empty at plan end; the only advance on main is the iteration-log commit (`dfe09ca`).
- **Hard rules upheld** — `pnpm changeset publish` was NEVER invoked (verified per D-05 and REQUIREMENTS.md out-of-scope); throwaway branch was NEVER pushed to remote; throwaway branch was NEVER merged into main.
- **22-ITERATION-LOG.md REL-03 section appended** (281 lines added, 527 total) — verbatim `changeset version` stdout, verbatim `pnpm install` stdout, pre-rehearsal state block, post-bump version table, peer-dep audit (verbatim JSON per package), full diff (truncated with reference to `/tmp/changeset-diff.txt`), generated CHANGELOG inventory, rollback proof block, hard-rule audit, CLOSED status marker — passes the 6 automated assertions in `<verification>`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create throwaway branch, run changeset version + pnpm install --frozen-lockfile, capture diff, delete branch** — `dfe09ca` (feat)

**Plan metadata:** pending (created with STATE.md + ROADMAP.md updates)

## Release Rehearsal Evidence

### Version bumps applied (throwaway-branch-only)

| Package | Before | After | Bump | Source changeset |
|---------|--------|-------|------|------------------|
| @kehto/acl | 0.1.0 | 0.2.0 | minor | `.changeset/v1-2-acl.md` |
| @kehto/runtime | 0.1.0 | 0.2.0 | minor | `.changeset/v1-2-runtime.md` |
| @kehto/shell | 0.1.0 | 0.2.0 | minor | `.changeset/v1-2-shell.md` |
| @kehto/services | 0.1.0 | 0.2.0 | minor | `.changeset/v1-2-services.md` |
| @kehto/demo (private) | 0.0.0 | 0.0.1 | patch | internal-dep fan-out |
| @test/harness (private) | 0.0.0 | 0.0.1 | patch | internal-dep fan-out |

### Peer-dep audit

All 4 @kehto/* packages retain the exact peer-dep ranges that existed on main before the rehearsal:

- `@napplet/core`: `^0.2.0` (unchanged)
- `@napplet/nub-identity`, `nub-ifc`, `nub-keys`, `nub-media`, `nub-notify`, `nub-relay`, `nub-storage`, `nub-theme`: all `^0.2.0` (unchanged)
- `nostr-tools` in @kehto/shell: `>=2.23.3 <3.0.0` (unchanged)

**Conclusion:** `changeset version` on a `minor` bump does not mutate peer-dep ranges in the consumed package.json files (the CHANGELOG prose documents the historical v1.1→v1.2 peer-dep migration; the actual package.json dependency sections are untouched by this run).

### Lockfile stability

`pnpm install --frozen-lockfile` reported "Already up to date" in 545 ms (exit 0) — version bumps in `packages/*/package.json` do not touch the dependency tree structure, and workspace:* internal refs already resolve to the in-tree workspaces regardless of version string, so the lockfile remains byte-identical.

### Rollback proof

- Pre-rehearsal main HEAD: `ad5357cc96f34eeaf87773201f4808ac86f76c06`
- Post-rollback main HEAD (before iteration-log commit): `ad5357cc96f34eeaf87773201f4808ac86f76c06`
- Post-plan main HEAD (after iteration-log commit): `dfe09ca8f470eeef77f87e0753cfd1fba0a2fb81`
- `git branch --list gsd/release-rehearsal-v1.3` at plan end: empty
- Deleted-branch message: `Deleted branch gsd/release-rehearsal-v1.3 (was ad5357c)` — the "was" SHA equals main's pre-rehearsal SHA, confirming no commits were ever made on the throwaway branch (all `changeset version` output was in the working tree only).

### Hard-rule audit

- `pnpm changeset publish`: **NOT invoked** (D-05 hard rule upheld).
- Throwaway branch push to remote: **NOT performed** (local-only branch, now deleted).
- Throwaway branch merge into main: **NOT performed** (no merge commit; only the iteration-log commit advanced main).
- `git reflog | grep -i publish` for entries from this plan: **empty** (historical reflog rows mentioning `publishTheme` / `publishEncrypted` / etc. are from prior-phase commits, not `changeset publish` invocations).

## Files Created/Modified

- `.planning/phases/22-docs-refresh-release-rehearsal/22-05-SUMMARY.md` (created — this file)
- `.planning/phases/22-docs-refresh-release-rehearsal/22-ITERATION-LOG.md` (modified — +281 lines REL-03 section appended after REL-02)

No source / package.json / lockfile changes land on main — all `changeset version` mutations lived only in the throwaway branch's working tree and were restored to their pre-rehearsal state before the log-write commit.

## Decisions Made

- **Retry approach: Option 1 (fresh re-run)** — prior attempt hit a usage limit mid-execution and was rolled back manually by the orchestrator. Fresh re-run followed plan steps verbatim instead of reusing pre-captured `/tmp/rel-03-notes/diff-stat.txt` and `full-diff.patch` artifacts. Rationale: cleaner evidence chain, no stale state risk, and the first run had already shown the mechanism works without surprises. The pre-captured `/tmp/rel-03-notes/*` artifacts remain as a fallback (and as a cross-check: the diff-stat from the prior run mentioned CHANGELOG.md line counts of 17/27/25/25 matching this run's outputs exactly — two-trial determinism confirmation).
- **Working-tree-leak cleanup added to rollback sequence** — `git checkout main` from the throwaway branch carries the uncommitted changeset-version mutations into main's working tree (since the branch had no commits, nothing is "lost" on switch, but the mutations are now staged against main). Fix: after `git branch -D`, run `git checkout HEAD -- .changeset/v1-2-*.md packages/*/package.json apps/demo/package.json tests/e2e/harness/package.json` to restore tracked files, then `rm -f packages/*/CHANGELOG.md apps/demo/CHANGELOG.md tests/e2e/harness/CHANGELOG.md` to remove the generated untracked files. This is a real-world detail of the "throwaway-branch dry-run" pattern that the plan could not have predicted without running; applied as Rule 3 auto-fix (blocking issue: without cleanup, the iteration-log commit would include stray package.json modifications and leak the rehearsal into main).
- **Diff truncation in iteration log** — full raw diff is 315 lines (under the plan's 400-line truncation threshold), but the log section uses a partially summarized form for readability: the first package.json diff (`acl`) is shown in full; subsequent ones (`runtime`, `services`, `shell`) are shown in compressed form noting "structurally identical" (all four diffs are the same shape: `"version"` line change plus JSON multi-line re-formatting of `files` and `keywords` arrays). Full raw diff was captured to `/tmp/changeset-diff.txt` during branch life and is referenced in the log. This preserves the signal-to-noise ratio while keeping all the essential data (version bumps, peer-dep audit JSON, rollback proof) verbatim.
- **Reused 22-04 idempotency protocol** — `grep -q '^## REL-03 — changeset version dry-run'` before appending; section was not present on retry (confirming the prior attempt's orchestrator-rollback fully cleaned the log), so the append proceeded.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Working-tree leak cleanup after `git checkout main`**
- **Found during:** Task 1 (Step 7 — rollback)
- **Issue:** The plan's Step 7 ran `git checkout main && git branch -D gsd/release-rehearsal-v1.3`, but because the throwaway branch had no commits, the `changeset version` working-tree mutations (4 `.changeset/v1-2-*.md` deletions, 6 package.json modifications, 5 untracked `CHANGELOG.md` files) carried across the `git checkout` and appeared staged against main. Without cleanup, the subsequent iteration-log commit would have bundled those mutations into a single commit on main, violating the hard rule "DO NOT commit the changeset version output to main."
- **Fix:** After `git branch -D`, added: (a) `git checkout HEAD -- .changeset/v1-2-acl.md v1-2-runtime.md v1-2-services.md v1-2-shell.md` to restore the deleted changesets; (b) `git checkout HEAD -- apps/demo/package.json packages/{acl,runtime,services,shell}/package.json tests/e2e/harness/package.json` to restore bumped versions; (c) `rm -f packages/{acl,runtime,shell,services}/CHANGELOG.md apps/demo/CHANGELOG.md tests/e2e/harness/CHANGELOG.md` to remove untracked generated files. Re-verified package versions all back to 0.1.0 and `.changeset/` lists v1-2-*.md files present.
- **Files modified:** No net file change (all restored to pre-rehearsal state before any commit)
- **Verification:** `git status --short` post-cleanup shows only pre-existing `.planning/` modifications (which pre-date this plan); package versions confirmed 0.1.0 via `node -p`; changesets list confirmed via `ls .changeset/`; `git rev-parse HEAD` equals `ad5357c` (still unchanged before the iteration-log commit).
- **Committed in:** Not a committed change — a rollback step. The subsequent iteration-log commit (`dfe09ca`) touched only `22-ITERATION-LOG.md`.

---

**Total deviations:** 1 auto-fixed (1 blocking — Rule 3)
**Impact on plan:** The deviation was necessary to uphold the hard rule that `changeset version` output must not leak onto main. It doesn't affect plan scope, acceptance criteria, or verification — the iteration-log commit still contains only the REL-03 section; main's code-touching files are byte-identical to their pre-rehearsal state. This working-tree-leak cleanup is a generalizable detail of the "throwaway-branch dry-run" pattern and is now documented in the patterns-established frontmatter for future rehearsal plans.

## Issues Encountered

- **Prior attempt hit usage limit mid-execution** — orchestrator rolled back manually before this retry (throwaway branch deleted, package.json mutations reverted via `git checkout`, untracked CHANGELOGs removed, 4 `.changeset/v1-2-*.md` files restored). Retry ran on a clean main HEAD `ad5357c` and reproduced the evidence fresh (Option 1 per retry_context). No state carried from the aborted attempt except informational `/tmp/rel-03-notes/` artifacts, which were used as a cross-check but not as the source of truth.
- **Working-tree leak on rollback** — addressed inline (see Deviations §1). Would be worth folding into the plan template for future `changeset version` rehearsals.
- **No other issues encountered.**

## User Setup Required

None — no external service configuration required. `pnpm dlx` tooling from 22-04 cached; `pnpm changeset version` is a dev-time command with no side effects once the branch is rolled back.

## Next Phase Readiness

- **REL-03 closed** — the last unknown in the release-rehearsal set. Combined with REL-01 (publint clean) and REL-02 (attw ESM-only clean) from 22-04, the @kehto/* packages are publish-ready in all three mechanical dimensions: package.json shape, ESM type-resolution, and changeset-version consumption. The only remaining gate for an actual publish is **D-05's external dependency on @napplet/core upstream npm unblock** (deferred to v1.4+).
- **22-ITERATION-LOG.md ready for Plan 22-06 append** — the idempotency pattern (grep before append) continues to work; 22-06 (REL-04 v1.3 changesets) will add `.changeset/v1-3-{acl,runtime,shell,services}.md` files, which a future (deferred) release will consume in the same way the v1-2-*.md changesets were consumed here. Plan 22-06 is pure file-creation (no branching, no version mutation) per D-06 so no rollback pattern is needed.
- **22-ITERATION-LOG.md ready for Plan 22-07 append** — E2E-10 closure (full green gate re-run) will add its own section after REL-03.
- **Phase 22 remaining plans:** 22-06 (v1.3 changesets — REL-04), 22-07 (full E2E-10 green gate), 22-08 (phase close — E2E-11 closure per D-08).
- **REQUIREMENTS.md REL-03 status:** will be toggled `Pending` → `Complete` via `requirements mark-complete REL-03` in the state-update step.

---
*Phase: 22-docs-refresh-release-rehearsal*
*Completed: 2026-04-18*

## Self-Check: PASSED

- FOUND: `.planning/phases/22-docs-refresh-release-rehearsal/22-05-SUMMARY.md`
- FOUND: `.planning/phases/22-docs-refresh-release-rehearsal/22-ITERATION-LOG.md`
- FOUND: commit `dfe09ca` (Task 1 — REL-03 iteration-log append)
- FOUND: `## REL-03 — changeset version dry-run` section header
- FOUND: `Rollback proof` subsection
- FOUND: `Post-bump versions` subsection
- FOUND: `Peer-dependency audit` subsection
- FOUND: `changeset publish ... NOT invoked` / `explicitly NOT` assertion
- FOUND: on `main` branch (post-plan)
- FOUND: throwaway branch `gsd/release-rehearsal-v1.3` deleted (`git branch --list` empty)
