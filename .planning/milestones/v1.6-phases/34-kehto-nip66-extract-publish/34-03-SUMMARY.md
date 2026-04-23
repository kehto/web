---
phase: 34-kehto-nip66-extract-publish
plan: 3
subsystem: infra
tags: [nip66, readme, changeset, iteration-log, publish-only, documentation, shell-adapter]

# Dependency graph
requires:
  - phase: 34-kehto-nip66-extract-publish
    plan: 1
    provides: Locked public API surface (5 exports) + @kehto/nip66 workspace scaffold. The README's verbatim type signatures are pulled from the Plan 34-01 src/index.ts; package.json version 0.1.0 is what the changeset semver-bumps against.
  - phase: 34-kehto-nip66-extract-publish
    plan: 2
    provides: Real factory impl + 9-test vitest suite + dist/index.js at 1.70 KB. The README integration example type-checks against this impl; the iteration log's 9/9 nip66 test count comes from the Plan 34-02 suite.
  - phase: 33-reserved-chord-surface-e2e-17
    provides: 54/0/0 E2E baseline (E2E-17 spec added — reserved-chord precedence contract). Plan 34-03 preserves this baseline exactly (delta 0).
provides:
  - packages/nip66/README.md (194 lines) — consumer-facing reference doc with H1 + 7 H2 sections, all 5 public exports documented, canonical SimplePool + ShellAdapter wiring examples
  - .changeset/v1-6-nip66.md (21 lines) — @kehto/nip66@0.1.0 initial-publish changeset (minor bump from the private 0.0.0 scaffold), NIP66-01..05 + kehto#2 citations
  - .planning/phases/34-kehto-nip66-extract-publish/34-ITERATION-LOG.md (248 lines) — canonical fresh-install loop evidence at 54/0/0 (23 turbo tasks, 495 unit tests, 6 anti-term sweeps clean, 2 demo-wiring guards clean)
  - Artifact-complete @kehto/nip66@0.1.0 (build + test + publish-shape green; NOT YET PUBLISHED — deferred to v1.6 milestone close alongside the other @kehto/* minor bumps)
affects:
  - 35-wm-skeleton-readme-cleanup (next phase in v1.6) — Phase 34 closes cleanly at 54/0/0; Phase 35 starts from this baseline
  - 36-perf-01-milestone-close-e2e-18 (milestone close) — this phase's changeset is one of the N changesets that feed into the changeset publish at milestone close
  - Future consumers of @kehto/nip66 (hyprgate v2.0, nadar, community shells) — README is the canonical reference doc they read before adopting

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Framework-agnostic discipline in docs: README + changeset author prose describing framework-agnosticism WITHOUT using the strings '@napplet/core' or '@napplet/nub'. Phrased as 'zero dependencies on the napplet protocol packages' / 'zero protocol-package peer deps' instead — satisfies grep-guard `grep -c '@napplet/core\\|@napplet/nub' == 0` without losing the meaning."
    - "Consumer-doc structural template (H1 + 7 H2s): Install, Overview, Quick Start, API, Integration with @kehto/<target>, Scope, License. Mirrors packages/services/README.md. Every public export gets a row in the API H2 (either a table or an H3 sub-section); integration H2 names the target hook verbatim (getNip66Suggestions here) for grep-verifiable link to the shell."
    - "Iteration-log shape for publish-only phases: delta 0 from prior close. Explicit comparison (`54 → 54 (delta 0)`) + callout that this is the NIP66-05 'publish-only' contract. Prevents future planners from interpreting a flat E2E count as evidence of incomplete work."

key-files:
  created:
    - "packages/nip66/README.md (194 lines) — H1 + 7 H2 sections; Quick Start + Integration with @kehto/shell both show `Array.from(aggregator.getRelaySet())` wiring into `ShellAdapter.relayConfig.getNip66Suggestions`"
    - ".changeset/v1-6-nip66.md (21 lines) — frontmatter `'@kehto/nip66': minor` verbatim; body cites NIP66-01..05 + kehto#2"
    - ".planning/phases/34-kehto-nip66-extract-publish/34-ITERATION-LOG.md (248 lines) — 9-step loop: clean → install → build → nip66 unit → full unit → e2e → anti-term → demo-wiring-guard → working-tree check; every step records exit code + wall clock + output summary"
  modified: []

key-decisions:
  - "Framework-agnostic discipline phrased without the literal @napplet/core / @napplet/nub strings. The plan's grep guard `grep -c '@napplet/core\\|@napplet/nub' == 0` on README + changeset forced rewording on three occurrences (README §Overview, README §Scope, changeset §Peer dependencies). Rewrote as 'napplet protocol packages' and 'protocol-package peer deps' — preserves meaning, satisfies grep. First draft had the literals; caught on first automated verify pass; fixed in-place before any commit. Reusable pattern for future kehto docs that need to assert absence of @napplet deps."
  - "Iteration-log captures the `pnpm --filter @kehto/nip66 test` exit-non-zero pre-existing monorepo behavior EXPLICITLY as a Not-a-regression footnote, not as a step failure. Plan 34-02 SUMMARY already documented this (root vitest.config.ts `include` glob resolves relative to the filtered package's cwd, not root). The log records the equivalent root-cwd invocation `npx vitest run --config vitest.config.ts packages/nip66/src/index.test.ts` and its 9/9 green output — evidence matches reality without pretending the filter form works."
  - "Iteration-log turbo-task delta arithmetic called out explicitly. Phase 33 close logged 22 build tasks (22 total); Phase 34 close logs 23 total (+1 for the new @kehto/nip66#build task). Rationale included in the log body so future readers can reconcile the task-count-vs-workspace-count discrepancy (harness counts as a workspace for pnpm but doesn't build in the Phase 33 era; that changed when @kehto/nip66 landed because nip66 is the 24th workspace and IS built)."
  - "Both task commits are docs(...) type. Plan 34-03 ships zero source changes — every artifact is documentation (README, changeset, iteration log). Commit type discipline: `docs(34-03): add ... (NIP66-04, NIP66-05)` and `docs(34-03): record canonical fresh-install iteration loop at 54/0/0 (E2E unaffected)`. No feat / fix / refactor commits in this plan."

patterns-established:
  - "Grep-guard-driven doc authorship: when a plan specifies `grep -c '<pattern>' file == 0` as an acceptance criterion, first-draft the doc normally then run the grep before committing. If the count is non-zero, reword the prose to preserve meaning while eliminating the literal string. Commit only after grep returns 0. This plan's Task 1 caught three instances on first verify pass; all three reworded in <1 minute without losing semantic content."
  - "Publish-only phase closure: iteration log delta is `0` from prior close. Log must explicitly call out `delta 0 from Phase N-1 close` and tie it to the requirement that defines the publish-only contract (here: NIP66-05). Distinguishes 'no regression detected' from 'no work done' — the phase DID do work (scaffold + impl + docs + changeset), but the E2E dimension is deliberately unchanged."

requirements-completed: [NIP66-04, NIP66-05]

# Metrics
duration: 6min
completed: 2026-04-23
---

# Phase 34 Plan 03: `@kehto/nip66` README + Changeset + Iteration Log Summary

**Shipped `@kehto/nip66@0.1.0` publish-shape evidence: 194-line consumer README with canonical SimplePool + ShellAdapter wiring, 21-line initial-publish changeset, 248-line fresh-install iteration log recording 54/0/0 E2E preserved — Phase 34 artifact-complete, closes NIP66-04 + NIP66-05.**

## Performance

- **Duration:** ~6 min (~331s wall clock, of which ~45s was the fresh-install loop)
- **Started:** 2026-04-23T09:58:59Z
- **Completed:** 2026-04-23T10:04:30Z
- **Tasks:** 2 (both committed atomically as `docs(...)`; zero source changes across the entire plan)
- **Files created:** 3 (`packages/nip66/README.md`, `.changeset/v1-6-nip66.md`, `.planning/phases/34-kehto-nip66-extract-publish/34-ITERATION-LOG.md`)
- **Files modified:** 0

## Accomplishments

- **Task 1 — README + changeset** (`b97a3cf`): `packages/nip66/README.md` lands at 194 lines with H1 + 7 H2 sections (Install, Overview, Quick Start, API, Integration with `@kehto/shell`, Scope, License). All 5 public exports documented with verbatim type signatures from Plan 34-02's `src/index.ts`. Quick Start + Integration sections both show `Array.from(aggregator.getRelaySet())` wiring. `.changeset/v1-6-nip66.md` lands at 21 lines with frontmatter `'@kehto/nip66': minor` verbatim. Both type-check green (README example resolves against the published barrel).
- **Task 2 — iteration loop** (`f2b68c7`): `.planning/phases/34-kehto-nip66-extract-publish/34-ITERATION-LOG.md` records the canonical v1.6 fresh-install loop. **Result: 54 passed / 0 failed / 0 skipped (17.8s) — zero delta from Phase 33 close**, exactly matching NIP66-05's publish-only contract. 23/23 turbo tasks (22 Phase-33 baseline + 1 new `@kehto/nip66#build`). 495/495 unit tests pass (486 v1.5 baseline + 9 new nip66). Anti-term sweep 6/6 clean. Demo-wiring guard 0/0 clean.
- **Requirement closures:** NIP66-04 (README + integration example) and NIP66-05 (initial-publish changeset + 54/0/0 iteration loop + zero demo wiring) — both REQ-IDs closed. Phase 34 is now 5/5 (NIP66-01 via Plan 34-01, NIP66-02 via Plan 34-02, NIP66-03 via Plan 34-01, NIP66-04 + NIP66-05 via this plan). Phase artifact-complete.
- **Framework-agnostic discipline enforced on docs:** Neither the README nor the changeset contains the literal strings `@napplet/core` or `@napplet/nub`. The framework-agnostic property is described via periphrasis ("napplet protocol packages", "protocol-package peer deps") — preserves meaning, satisfies the plan's grep-guard acceptance criterion. Caught on first automated verify pass; reworded in-place before commit.

## Task Commits

1. **Task 1 — README + changeset** — `b97a3cf` `docs(34-03): add @kehto/nip66 README + initial-publish changeset (NIP66-04, NIP66-05)` — 2 files created, 215 insertions. README 194 lines; changeset 21 lines.
2. **Task 2 — iteration log** — `f2b68c7` `docs(34-03): record canonical fresh-install iteration loop at 54/0/0 (E2E unaffected)` — 1 file created, 248 insertions. Log records every step with exit code + wall clock + output.

**Plan metadata commit (to follow):** `docs(34-03): complete @kehto/nip66 README + changeset + iteration-log plan`

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `packages/nip66/README.md` | 194 | Consumer-facing public-API reference + ShellAdapter integration example |
| `.changeset/v1-6-nip66.md` | 21 | Initial-publish changeset for `@kehto/nip66@0.1.0` (minor bump) |
| `.planning/phases/34-kehto-nip66-extract-publish/34-ITERATION-LOG.md` | 248 | Canonical fresh-install loop evidence (9 steps, 6 anti-term sweeps, 2 demo-wiring guards) |

All three within plan's expected ranges (`README: ~120–180` — ran slightly over at 194 due to H3 anchor explicitness and one extra code block; `changeset: ~20` — exactly at the target; `iteration-log: ~100–200` — ran over at 248 due to captured command output + explicit footnotes for the `pnpm --filter` pre-existing-monorepo-quirk and the turbo-task-delta arithmetic).

## Iteration Loop Evidence — Top-Level Metrics

| Metric | Phase 33 close | Phase 34 close | Delta | Interpretation |
|--------|---------------|---------------|-------|---------------|
| E2E specs passed | 54 | 54 | **0** | NIP66-05 publish-only contract satisfied |
| E2E specs failed | 0 | 0 | 0 | baseline preserved |
| E2E specs skipped | 0 | 0 | 0 | baseline preserved |
| E2E wall-clock | 18.5s | 17.8s | -0.7s | noise |
| Turbo build tasks | 22 | **23** | **+1** | new `@kehto/nip66#build` task |
| Turbo cached on fresh install | 0/22 | 0/23 | cold as expected | cache purge honored |
| pnpm workspace projects | 23 | **24** | **+1** | `packages/nip66` auto-picked by `packages/*` glob |
| Full unit-test count | 486 (v1.5) | **495** | **+9** | 9 new tests from Plan 34-02's vitest suite |
| pnpm install wall-clock | 686ms | 724ms | +38ms | noise |
| Fresh `pnpm build` wall-clock | 5.117s | 5.395s | +278ms | noise + 1 new cold task |
| Anti-term sweep on packages/nip66/ | n/a | 0/0/0/0/0/0 | — | 6 patterns, all clean |
| Demo-wiring guard | n/a | 0/0 | — | `apps/demo/` + `tests/e2e/` both clean |

## Decisions Made

**1. Framework-agnostic discipline phrased without literal strings.**
First-draft README + changeset used `@napplet/core` and `@napplet/nub` in prose asserting their ABSENCE ("no `@napplet/core` peer dep", "zero dependencies on `@napplet/core`, `@napplet/nub`"). The plan's acceptance criterion `grep -c '@napplet/core\|@napplet/nub' packages/nip66/README.md == 0` and the corresponding changeset check rejected this. Reworded to "zero dependencies on the napplet protocol packages" (README §Overview), "protocol-package peer deps" (changeset §Peer dependencies), and "protocol-level `ServiceHandler` integration" (README §Scope). Meaning preserved; grep satisfied. Caught on first automated verify pass; reworded + re-verified before committing Task 1. This is a reusable pattern — any future kehto doc that needs to assert independence from the napplet side should describe the property rather than name the packages it doesn't depend on.

**2. Iteration-log calls out the `pnpm --filter @kehto/nip66 test` pre-existing-monorepo-quirk EXPLICITLY as a footnote, not a failure.**
The root `vitest.config.ts` `include` glob (`packages/*/src/**/*.test.ts`) resolves relative to the filtered package's cwd (`packages/nip66`), not the workspace root — so `pnpm --filter @kehto/nip66 test` exits code 1 with "No test files found". Plan 34-02 SUMMARY already documented this behavior as not a regression (sibling `@kehto/acl` exhibits the same); this iteration log quotes the reference and records the equivalent root-cwd invocation (`npx vitest run --config vitest.config.ts packages/nip66/src/index.test.ts`) with its 9/9 green output. Evidence matches reality; no pretending the filter form works. Future debugging wouldn't be misled by a log that glossed this over.

**3. Iteration-log turbo-task delta arithmetic called out explicitly.**
Phase 33 close logged 22 turbo build tasks (22 total); Phase 34 close logs 23. The +1 task is the new `@kehto/nip66#build`. The log body explains this explicitly so future readers don't have to reconcile the task-count vs. workspace-count discrepancy (workspace went 23→24, turbo tasks went 22→23; the `tests/e2e/harness` workspace's build task was already in the 22 total in Phase 33 — Phase 34 adds the 23rd task, not the 24th). Arithmetic transparency prevents future "wait, did we lose a task?" confusion.

**4. Both task commits are `docs(...)` type.**
Plan 34-03 ships zero source changes — every artifact is documentation. Commit type discipline: `docs(34-03): add @kehto/nip66 README + initial-publish changeset (NIP66-04, NIP66-05)` and `docs(34-03): record canonical fresh-install iteration loop at 54/0/0 (E2E unaffected)`. No `feat` / `fix` / `refactor` commits. This is load-bearing for downstream semver automation — if a future bot parses commits to compute release notes, it needs to know Plan 34-03 contributed documentation only.

## Deviations from Plan

**None.** Plan executed exactly as written. Both tasks hit every acceptance criterion on first pass (modulo the one-pass grep-guard rewording described in Decision 1 above, which happened BEFORE the Task 1 commit — the committed files passed the grep guard on the first commit attempt).

No auto-fixes invoked (Rules 1-3). No architectural decisions surfaced (Rule 4). No auth gates.

## Issues Encountered

None. Single-pass execution for both tasks.

Pre-existing npm warnings observed during `npx vitest run ...`:
- `npm warn Unknown project config "auto-install-peers"`
- `npm warn Unknown project config "strict-peer-dependencies"`

These are repo-wide `.npmrc` warnings — not scoped to Plan 34-03, not introduced by this plan, present throughout v1.5 / v1.6. Out-of-scope per the Executor's SCOPE BOUNDARY rule. Same as Plan 34-02 SUMMARY §Issues.

One benign pnpm warning during install:
- `Ignored build scripts: esbuild. Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.`

Pre-existing in Phase 32/33 baselines; unrelated to this phase.

## Confirmations (NIP66-05 scope contract)

The plan's output specification requires explicit confirmation of each contract clause. Recorded for completeness:

- ✅ **NO demo-shell changes.** `git log --name-only b97a3cf f2b68c7` shows zero files under `apps/demo/`. Live guard `grep -rn '@kehto/nip66' apps/demo/` returns 0.
- ✅ **NO new Playwright specs.** `git log --name-only b97a3cf f2b68c7` shows zero files under `tests/e2e/`. Live guard `grep -rn '@kehto/nip66' tests/e2e/` returns 0.
- ✅ **E2E count stays at 54.** Phase 33 close: 54. Phase 34 close (this plan's iteration log): 54. Delta: 0.
- ✅ **Package is publish-shaped but NOT YET PUBLISHED.** `packages/nip66/dist/` rebuilds successfully; `changeset publish` was NOT invoked (only the `.changeset/v1-6-nip66.md` file was authored).
- ✅ **Changeset publish deferred to milestone close** (Phase 36 or whichever phase handles `changeset version` + `changeset publish` for v1.6). The staged changesets at `.changeset/v1-6-*.md` — `v1-6-dep-acl.md`, `v1-6-dep-shell.md`, `v1-6-dep-runtime.md`, `v1-6-dep-services.md`, and now `v1-6-nip66.md` — will all be consumed in one pass at that gate.

## Handoff to Phase 35

**Phase 34 complete, 54/0/0 preserved; ready to plan WM Skeleton + README Cleanup (WM-01..03, DOCS-04..05).**

- **v1.6 milestone progress:** 2/5 → **3/5 phases complete** post-Phase 34 close (32 + 33 + 34 done; 35 + 36 remaining).
- **Requirement progress:** 13 of 21 v1 reqs complete (DEP-01..05, KEYS-04..06, E2E-17, NIP66-01..05) after Phase 34; 8 remaining (WM-01..03, DOCS-04..05, PERF-01, E2E-18).
- **E2E baseline entering Phase 35:** 54/0/0. Phase 35 is another publish-only/docs-only phase per ROADMAP.md — expected to preserve 54/0/0 (zero new Playwright specs). Phase 36 (milestone close) is the one that may shift the count (E2E-18 is the milestone-close iteration loop spec; PERF-01 is a perf regression fix with no new E2E spec planned).
- **Zero blockers.** Clean working tree at `f2b68c7`. Phase 35 can start immediately.

## Self-Check: PASSED

- [x] `packages/nip66/README.md` — FOUND (194 lines, H1 + 7 H2 sections)
- [x] `.changeset/v1-6-nip66.md` — FOUND (21 lines, `'@kehto/nip66': minor` frontmatter)
- [x] `.planning/phases/34-kehto-nip66-extract-publish/34-ITERATION-LOG.md` — FOUND (248 lines, 9-step loop evidence)
- [x] `.planning/phases/34-kehto-nip66-extract-publish/34-03-SUMMARY.md` — FOUND (this file)
- [x] Commit `b97a3cf` — FOUND (`docs(34-03): add @kehto/nip66 README + initial-publish changeset (NIP66-04, NIP66-05)`)
- [x] Commit `f2b68c7` — FOUND (`docs(34-03): record canonical fresh-install iteration loop at 54/0/0 (E2E unaffected)`)
- [x] No stub patterns in created files (`grep -nE 'coming soon|not available|placeholder|TODO|FIXME'` returns nothing across README + changeset)
- [x] Framework-agnostic discipline satisfied (`grep -c '@napplet/core\|@napplet/nub'` == 0 on both README and changeset)
- [x] E2E baseline preserved (54/0/0, delta 0 from Phase 33 close)
- [x] Anti-term sweep on `packages/nip66/` clean (6/6 patterns at 0 matches)
- [x] Demo-wiring guard clean (0 refs in `apps/demo/` and `tests/e2e/`)

---
*Phase: 34-kehto-nip66-extract-publish*
*Completed: 2026-04-23*
