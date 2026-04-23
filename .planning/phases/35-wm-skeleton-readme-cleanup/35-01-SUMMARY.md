---
phase: 35-wm-skeleton-readme-cleanup
plan: 1
subsystem: infra
tags: [monorepo, turbo, pnpm-workspaces, pr-merge, wm, typescript, skeleton]

# Dependency graph
requires:
  - phase: 34-kehto-nip66-extract-publish
    provides: Baseline turbo task counts (23 build / 9 type-check) against which @kehto/wm's +1 delta is measured.
  - phase: 32-nub-dep-consolidation
    provides: Turbo-cache purge discipline (rm -rf .turbo packages/*/.turbo ... before evidenced builds) applied here.
provides:
  - "@kehto/wm@0.0.0 skeleton workspace on main (squash-merged from PR #7, dskvr authorship preserved)"
  - "Canonical WM type vocabulary (WindowId, WorkspaceId, Rect, Layout) + WmHostHooks + WmService interface + throwing createWmService factory stub — locked for downstream consumers to pin against"
  - "Turbo pipeline auto-pickup evidence: build 23 → 24 tasks (+1), type-check 9 → 10 tasks (+1), zero regressions"
  - "In-repo skeleton PR squash-merge pattern: `gh pr ready N && gh pr merge N --squash` + rebase onto origin/main (when local has unpushed docs commits) preserves author attribution and lands the new workspace in one commit"
affects:
  - Phase 35-02 (root README cleanup — may add @kehto/wm row to Packages table per CONTEXT.md discretion)
  - Future v1.7+ WM implementation milestone (BSP / master-stack / floating layout primitives replace the throwing factory)
  - Downstream shells (hyprgate first) — can now `pnpm add @kehto/wm` against the registry once the skeleton is first-published (v1.7+)

# Tech tracking
tech-stack:
  added: []  # zero new runtime deps; typescript@^5.9.3 devDep was already hoisted at workspace root
  patterns:
    - "In-repo skeleton PR squash-merge via `gh pr merge N --squash` — preserves author attribution while collapsing draft commits to a single main commit; triggers auto-pickup by pnpm workspace + turbo task graph without manual registration"
    - "PR draft-state gate: `gh pr merge` rejects drafts with `Pull Request is still a draft (mergePullRequest)` — resolved by `gh pr ready N` before retrying merge"
    - "Rebase-over-merge for local post-PR sync when local main has unpushed docs commits: `git pull --rebase origin main` preserves local planning commits on top of the squash merge; fast-forward would require no-local-commits"

key-files:
  created:
    - packages/wm/package.json  # Landed via PR #7 squash (d7df669), not authored in this plan
    - packages/wm/tsconfig.json
    - packages/wm/src/index.ts
    - packages/wm/README.md
  modified:
    - pnpm-lock.yaml  # +6 lines: new `importers: packages/wm:` block registering typescript@5.9.3 devDep (no external package additions)

key-decisions:
  - "Squash-merge (not merge-commit or rebase-merge) via `gh pr merge 7 --squash` — user-locked in CONTEXT.md Decisions §Merge Approach; preserves dskvr authorship via GitHub's auto co-author attribution."
  - "Rebase local main onto origin/main post-merge (instead of fast-forward) because local had 3 unpushed docs commits (968edc3 docs(35): create phase plan, c42f221 docs(35): smart discuss context, 294d808 docs(phase-34): complete phase execution) authored between origin/main snapshot and PR merge. 39-commit rebase succeeded cleanly with zero conflicts."
  - "Did NOT pass `--delete-branch` to `gh pr merge` — the `wm-package-skeleton` branch may be useful as a reference point for v1.7+ implementation milestones (per CONTEXT.md `<deferred>`)."
  - "Plan 35-01 `<action>` text predicted `pnpm type-check → 24 successful, 24 total` but the real Phase 34 close baseline was 9 type-check tasks (not 23 — that was the build baseline; plan conflated the two pipelines). Actual result: 10/10 (baseline 9 + 1 for @kehto/wm). Tracked as Deviation Rule 1 (plan assertion bug). Real acceptance criterion is the +1 delta, which holds."

patterns-established:
  - "Pattern: In-repo skeleton PR squash-merge drops directly into turbo's task graph via the `packages/*` glob in pnpm-workspace.yaml — no turbo.json edit needed when the new package's `scripts` block declares matching `build` / `type-check` names."
  - "Pattern: pnpm-lock.yaml delta for a new workspace-only-add (no external deps) is a single `importers: packages/<name>:` block — ~6 lines. Zero new `packages:` entries under the global section confirms no leaked runtime deps."
  - "Pattern: tsc --noEmit-only skeleton package produces a benign turbo warning `no output files found for task @<pkg>#build. Please check your outputs key` — this is expected for signature-only stubs; not a failure."
  - "Pattern: `gh pr ready N` precedes `gh pr merge N --squash` when the PR was opened as a draft. Add to the squash-merge playbook for any future draft-PR skeleton merges."

requirements-completed: [WM-01, WM-02, WM-03]

# Metrics
duration: 4 min
completed: 2026-04-23
---

# Phase 35 Plan 1: Merge PR #7 @kehto/wm Skeleton Summary

**Squash-merged PR #7 (`@kehto/wm@0.0.0` skeleton — canonical WM type vocabulary + throwing factory stub) from dskvr, rebased local main onto the squash commit preserving 3 local docs commits, and verified turbo auto-pickup at 24/24 build + 10/10 type-check with zero source edits authored by the executor.**

## Performance

- **Duration:** 4 min (214 sec wall-clock)
- **Started:** 2026-04-23T11:18:39Z
- **Completed:** 2026-04-23T11:22:13Z
- **Tasks:** 3 (Task 1 committed as `dd3a2d4`; Tasks 2-3 were verification-only, no commits)
- **Files committed in Task 1:** 1 (pnpm-lock.yaml — +6 lines)
- **Files landed via squash merge:** 4 (packages/wm/{package.json, tsconfig.json, src/index.ts, README.md})

## Accomplishments

- **PR #7 MERGED** on GitHub (squash commit `d7df669a4456f66446030c7a00b7d3e7710ea28e`, merged at 2026-04-23T11:18:53Z) — dskvr authorship preserved via GitHub's auto co-author attribution on squash.
- **`packages/wm/` workspace landed on main** with the exact 4 files + 175 additions / 0 deletions shape predicted by PR #7's diff totals (package.json 43 lines, tsconfig.json 9 lines, src/index.ts 88 lines, README.md 35 lines).
- **Public API surface locked** — `WindowId`, `WorkspaceId`, `Rect`, `Layout`, `WmHostHooks` (4 methods: selectLayout/onWindowCreated/onWindowDestroyed/onWindowMoved), `WmService` (window.{create,close,focus,move} + workspace.{switch,list} + state.get + destroy), `createWmService` throwing factory stub whose error message cites `https://github.com/hyprgate/gui/blob/master/specs/wm-package-design.md`.
- **Turbo pipeline auto-pickup confirmed**:
  - `pnpm build`: 23 → **24 successful / 24 total** (0 cached post-purge, 5.872s wall-clock; `@kehto/wm:build` prefix appeared 5× in log)
  - `pnpm type-check`: 9 → **10 successful / 10 total** (4 cached from upstream build deps, 1.308s wall-clock; `@kehto/wm:type-check` prefix appeared 5× in log)
- **Zero new external runtime deps** — pnpm-lock.yaml delta is purely the new `importers: packages/wm:` block (6 lines); zero new `packages:` entries under the global section.
- **Anti-term sweep clean** on `packages/wm/` — zero occurrences of `window.nostr`, `@napplet/nub-` (split-package form), `signer.`, `BusKind`, `core-compat`, or `allow-same-origin`.

## Task Commits

1. **Task 1: Squash-merge PR #7 and pull main** — `dd3a2d4` (chore) — registers @kehto/wm in pnpm-lock
2. **Task 2: Verify public API surface matches WM-02 contract** — verification-only, no commit (all 7 top-level exports + method signatures confirmed via grep + `pnpm --filter @kehto/wm type-check` exit 0)
3. **Task 3: Verify turbo build + type-check green at 24/10 tasks (WM-03)** — verification-only, no commit (turbo cache purged; both pipelines green with exactly +1 delta for @kehto/wm)

**Upstream (from PR #7 squash):** `d7df669` — `[wm] Draft: add @kehto/wm package skeleton — hyprgate Phase 11 proposal (#7)`

**Plan metadata:** [to be added by `git_commit_metadata` step]

## Files Created/Modified

### Created (via PR #7 squash merge — NOT authored by the plan executor)

- `packages/wm/package.json` — @kehto/wm@0.0.0 manifest: ESM-only, zero runtime deps, `type: module`, `sideEffects: false`, `publishConfig.access: public`, `scripts.{build,type-check}: tsc --noEmit`, `typescript@^5.9.3` sole devDep (hoisted).
- `packages/wm/tsconfig.json` — Extends `../../tsconfig.json`; `rootDir: src`, `noEmit: true`, `lib: [ES2022, DOM, DOM.Iterable]`.
- `packages/wm/src/index.ts` — Public API barrel: 4 type exports + 2 interface exports + 1 factory function = 7 top-level exports. Zero imports.
- `packages/wm/README.md` — Skeleton status + cross-link to hyprgate design note + PR #7 provenance.

### Modified (via Task 1 chore commit)

- `pnpm-lock.yaml` — +6 lines adding `importers: packages/wm:` block registering the new workspace. Zero external package additions (typescript@5.9.3 was already hoisted at workspace root).

## Decisions Made

- **Rebase-over-merge for local post-PR sync** — Local main had 3 unpushed docs commits (`968edc3`, `c42f221`, `294d808`) authored between the origin/main snapshot and the PR merge. Fast-forward was impossible; `git pull --rebase origin main` cleanly rebased 39 commits onto the squash commit, preserving local planning commits on top. Zero merge conflicts.
- **`gh pr ready 7` before `gh pr merge 7 --squash`** — PR #7 was in draft state. First merge attempt returned `GraphQL: Pull Request is still a draft (mergePullRequest)`. `gh pr ready 7` marked it ready for review; merge retry succeeded silently (gh CLI emits no stdout on success, but `gh pr view 7 --json state` confirmed MERGED state). Add to squash-merge playbook for future draft PRs.
- **Zero source edits authored by executor** — Plan 35-01 is explicitly MERGE + VERIFY only. The 4 files under `packages/wm/` arrive via PR #7 content verbatim; executor only touches pnpm-lock.yaml (an auto-generated side effect of `pnpm install` picking up the new workspace).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan `<action>` predicted wrong type-check task count (24 vs. actual 10)**

- **Found during:** Task 3 (turbo type-check verification)
- **Issue:** Plan 35-01 Task 3 `<action>` Step 4 predicted `pnpm type-check` would output `Tasks: 24 successful, 24 total` — same as the build pipeline. Plan's `<verify>` shell chain encoded this as a grep for `"Tasks:[[:space:]]+24 successful, 24 total"`. The prediction was wrong: Phase 34 close baseline was 23 **build** tasks and 9 **type-check** tasks (cross-referenced against `34-01-SUMMARY.md:79` which states "full-repo `pnpm type-check` at 9/9 successful"). The plan conflated the two pipeline scales. Only 6 packages declare `type-check` scripts (acl, nip66, runtime, services, shell + now wm) vs. 13+ packages with `build` scripts.
- **Fix:** No code change needed. Actual result (10/10 type-check) reflects the correct baseline-plus-one delta (9 → 10 for `@kehto/wm`). The real success criterion is "+1 delta for @kehto/wm in both pipelines" which holds cleanly. Recorded actual counts in this SUMMARY (build 24/24, type-check 10/10) to correct the forward record.
- **Files modified:** None (verification-level deviation).
- **Verification:** `grep -E "Tasks:" /tmp/35-01-typecheck.log` returned `Tasks: 10 successful, 10 total`; `grep -c "^@kehto/wm:type-check:" /tmp/35-01-typecheck.log` returned `5` (confirming @kehto/wm was picked up). `pnpm --filter @kehto/wm type-check` exit 0 independently confirms the package is contract-valid.
- **Committed in:** No commit (verification deviation; documentation-only).

**2. [Rule 3 - Blocking] PR #7 in draft state blocked `gh pr merge`**

- **Found during:** Task 1 Step 2 (squash-merge)
- **Issue:** First `gh pr merge 7 --squash` returned `GraphQL: Pull Request is still a draft (mergePullRequest)`. Plan assumed PR was ready for merge (CONTEXT.md line 32: "PR #7 head ref: `wm-package-skeleton`, SHA `f43a48b076be4ff488930d1e71250ecbda46616b`, mergeable" — but the pre-merge sanity check at Task 1 Step 1 DID show `state: OPEN, mergeable: MERGEABLE`; draft status is a separate gate not surfaced by the `mergeable` field).
- **Fix:** Ran `gh pr ready 7` (returned `✓ Pull request kehto/monorepo#7 is marked as "ready for review"`), then retried `gh pr merge 7 --squash`. Second attempt succeeded; `gh pr view 7 --json state,mergedAt,mergeCommit` confirmed MERGED with commit oid `d7df669a4456f66446030c7a00b7d3e7710ea28e` at `2026-04-23T11:18:53Z`.
- **Files modified:** None (GitHub-side operation).
- **Verification:** `gh pr view 7 --json state --jq .state` returns `MERGED`; packages/wm/ files present locally with exact predicted line counts (43 + 9 + 88 + 35 = 175).
- **Committed in:** N/A (upstream GitHub side-effect).

**3. [Rule 3 - Blocking] Local main diverged from origin/main post-merge (3 unpushed docs commits)**

- **Found during:** Task 1 Step 4 (`git pull origin main`)
- **Issue:** Plan Step 4 said simply `git pull origin main` but local main had 3 unpushed commits (`968edc3`, `c42f221`, `294d808` — phase/plan docs authored between the origin snapshot and the PR merge). Plain `git pull` failed with `fatal: Need to specify how to reconcile divergent branches`.
- **Fix:** Stashed the in-progress `.planning/STATE.md` edit (init-tooling change), ran `git pull --rebase origin main` which successfully rebased 39 commits (all the main-branch work between the origin snapshot and local HEAD) onto the squash commit, then `git stash pop` restored the working-tree STATE.md change. Zero merge conflicts. Preserves planning commits on top of the squash — exactly what the plan intended, just with explicit reconciliation strategy.
- **Files modified:** None (history reconciliation, not content change).
- **Verification:** `git log --oneline -50 | grep d7df669` shows the squash commit at position 40 in history; `git log --oneline main | head -5` shows local docs commits preserved on top; `git status --short` shows only the expected working-tree changes (`.planning/STATE.md` + about-to-be-committed `pnpm-lock.yaml`).
- **Committed in:** N/A (git reconciliation, not a content commit).

---

**Total deviations:** 3 auto-fixed (1 plan-assertion bug [Rule 1], 2 blocking-issue [Rule 3])
**Impact on plan:** Zero scope creep. All three deviations were local-environment or GitHub-state issues not anticipated by the plan text. Plan intent (MERGE + VERIFY, zero executor-authored source edits) was honored 100%. The type-check count disagreement is a documentation correction, not a functional regression — baseline verification against `34-01-SUMMARY.md` confirms the +1 delta holds on the correct baseline.

## Authentication Gates

None — `gh pr merge`, `git pull`, and `pnpm install` all ran against already-authenticated local state. No auth prompts, no env-var gates, no secrets handled.

## Issues Encountered

None beyond the 3 deviations above — all auto-resolved within single-digit seconds of detection.

## Known Stubs

The entire `@kehto/wm` package IS a documented skeleton. Its single stub is **intentional and locked in the plan scope**:

- `packages/wm/src/index.ts:81-88` — `createWmService({ hooks })` throws `'[@kehto/wm] createWmService is a signature-only skeleton (version 0.0.0). See https://github.com/hyprgate/gui/blob/master/specs/wm-package-design.md ...'` — the whole point of the v0.0.0 release per PR #7 design: shells (hyprgate first) pin the canonical type vocabulary NOW and consume a real implementation in a future milestone (v1.7+ per REQUIREMENTS.md Future Requirements §WM-04..0N).

This stub does NOT prevent v1.6 from achieving its goal (downstream unblock via published type vocabulary) — it IS the v1.6 deliverable. REQUIREMENTS.md line 55 explicitly scopes WM-01 to "skeleton lands on main", not "implementation lands". Cross-linked at `packages/wm/README.md` and in the factory's throw message so any consumer hitting the stub has a forward pointer.

## User Setup Required

None — no external service configuration required. Package is pre-publish (`0.0.0`), lives in-repo as a workspace, consumed by turbo + pnpm locally only. First npm publish awaits the first real implementation in v1.7+ per CONTEXT.md `<deferred>`.

## Next Phase Readiness

- **Ready for Plan 35-02** (root README cleanup — DOCS-04/05). Path: `.planning/phases/35-wm-skeleton-readme-cleanup/35-02-PLAN.md`. Plan 35-02 may optionally add a `@kehto/wm` row to the root README Packages table per CONTEXT.md §Claude's Discretion (alongside the @kehto/nip66 row carryover). No blockers.
- **Turbo baseline for Phase 36 iteration loop** updated: build 24 tasks, type-check 10 tasks. Phase 36 milestone-close E2E-18 iteration loop should see these counts (possibly +1 more if PERF-01's fix introduces a new workspace, but that's unlikely — chat napplet lives in `apps/demo/napplets/chat/` already).
- **WM-01, WM-02, WM-03 all satisfied** — reviewer/verifier can confirm via:
  - `gh pr view 7 --json state --jq .state` returns `MERGED`
  - `grep -c '^export function createWmService' packages/wm/src/index.ts` returns `1`
  - `grep -c 'throw new Error' packages/wm/src/index.ts` returns `1`
  - `grep -c 'hyprgate/gui/blob/master/specs/wm-package-design' packages/wm/src/index.ts` returns `1`
  - `pnpm build 2>&1 | grep -oE "Tasks:[[:space:]]+[0-9]+ successful"` returns `Tasks:    24 successful`
  - `pnpm type-check 2>&1 | grep -oE "Tasks:[[:space:]]+[0-9]+ successful"` returns `Tasks:    10 successful`
  - Anti-term sweep on `packages/wm/` returns 0 for all 6 forbidden terms.

---

## Self-Check

Verification of SUMMARY claims against disk state + git history:

**1. Created files exist:**
- `packages/wm/package.json` — FOUND (43 lines)
- `packages/wm/tsconfig.json` — FOUND (9 lines)
- `packages/wm/src/index.ts` — FOUND (88 lines)
- `packages/wm/README.md` — FOUND (35 lines)

**2. Commits exist:**
- `dd3a2d4` (Task 1 chore commit) — FOUND in `git log --oneline -5`
- `d7df669` (PR #7 squash merge) — FOUND in `git log --oneline main --grep="wm-package-skeleton"`

**3. PR state:**
- `gh pr view 7 --json state --jq .state` returns `MERGED` — CONFIRMED

**4. Pipeline evidence:**
- `/tmp/35-01-build.log` trailing `Tasks: 24 successful, 24 total` — CONFIRMED
- `/tmp/35-01-typecheck.log` trailing `Tasks: 10 successful, 10 total` — CONFIRMED
- `@kehto/wm:build:` appears 5× in build log, `@kehto/wm:type-check:` appears 5× in type-check log — CONFIRMED

## Self-Check: PASSED

---

*Phase: 35-wm-skeleton-readme-cleanup*
*Completed: 2026-04-23*
