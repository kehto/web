---
phase: 35-wm-skeleton-readme-cleanup
plan: 2
subsystem: docs
tags: [readme, docs, registry-install, pnpm-overrides, iteration-loop, docs-cleanup]

# Dependency graph
requires:
  - phase: 35-wm-skeleton-readme-cleanup
    provides: Plan 35-01 closed WM-01/02/03 via PR #7 squash-merge + turbo 23→24 build / 9→10 type-check baselines this plan verifies against.
  - phase: 32-nub-dep-consolidation
    provides: Phase 32 Decision for the single transitive `pnpm.overrides` pin (`@napplet/nub>@napplet/core: ^0.2.1`) that the new Architecture Notes bullet references.
  - phase: 34-kehto-nip66-extract-publish
    provides: 54/0/0 E2E baseline this plan preserves (delta 0 contract) and `@kehto/nip66` v0.1.0 publish-ready package referenced in the new Packages table row.
provides:
  - "Root README.md free of the stale `@napplet/core is not yet on npm` + `pnpm.overrides link:` claim (false since Phase 25 / v1.4 first registry publish)"
  - "Root README.md Architecture Notes bullet that correctly documents the single transitive `pnpm.overrides` (`@napplet/nub>@napplet/core: ^0.2.1` — Phase 32 Decision)"
  - "Root README.md Packages table extended with @kehto/nip66 (v0.1.0) and @kehto/wm (v0.0.0) rows — full v1.6 workspace surface visible to downstream readers"
  - "35-ITERATION-LOG.md — canonical fresh-install evidence at 54/0/0 with anti-term sweep + DOCS-05 export-presence verification"
  - "Phase 35 closure at 5/5 REQ-IDs (WM-01..03 from Plan 35-01, DOCS-04..05 from this plan)"
affects:
  - Phase 36 (milestone close — PERF-01 + E2E-18). Phase 36 iteration loop inherits the 24 build / 10 type-check baselines locked here plus the clean anti-term state.
  - v1.6 milestone close — 18/21 reqs now complete; only 3 reqs remain (PERF-01 + E2E-18 in Phase 36).
  - Downstream shells (hyprgate v2.0 first) — README consumer story now matches reality (registry install, not link: workarounds).

# Tech tracking
tech-stack:
  added: []  # docs-only plan; zero new runtime deps
  patterns:
    - "Anti-term enforcement-prose distinction (carried from Phase 33 Decision): grep-positives on `window.nostr` / `allow-same-origin` in README line 94 NIP-5D anti-features bullet are documentation of ABSENCE (the bullet says these are NOT injected / NOT used), not violations. Iteration log explicitly labels each enforcement-prose match so verifier doesn't mis-flag them."
    - "DOCS-05 lower-cost verification via root `pnpm type-check`: when Quick-Integration Example imports from already-published workspace packages, root type-check at 10/10 successful equivalences a throwaway-dir `pnpm add` smoke. Both prove the example's imports resolve. CONTEXT.md Claude's Discretion authorized picking the lower-cost path; iteration log records the method chosen."
    - "Docs/types-only phase closure at flat E2E count (delta 0) — iteration log calls out the phase-scope contract explicitly, distinguishing 'no regression detected' from 'no work done'. Pattern reused from Phase 34 (publish-only phase) for Phase 35 (docs-only plan)."
    - "Optional Packages-table extension applied (CONTEXT.md §Claude's Discretion) — added rows for @kehto/nip66 and @kehto/wm. Single table row each matches the 4 existing @kehto/* row density; not visually cluttered; both rows cross-link to their own package README for details."

key-files:
  created:
    - .planning/phases/35-wm-skeleton-readme-cleanup/35-ITERATION-LOG.md
  modified:
    - README.md  # 3 lines insertions / 1 line deletion — line 93 bullet rewrite + 2 new Packages table rows

key-decisions:
  - "Replacement prose for README line 93 used CONTEXT.md <specifics> draft verbatim (no refinement) — matches surrounding bullet density (1-2 sentences), cross-references Phase 32 Decision, names the actual override key `@napplet/nub>@napplet/core: ^0.2.1`. Clean replacement with identical bullet-prefix and informational weight."
  - "Packages table extension applied (CONTEXT.md §Claude's Discretion recommendation followed). Both @kehto/nip66 + @kehto/wm rows added. Row descriptions distilled from each package's own README. Rationale: both packages are shipped as of Wave 1 close; both have public READMEs; a one-line row each reads naturally within the existing 4-row structure. Single-commit atomic edit with the line-93 rewrite."
  - "DOCS-05 verified via root `pnpm type-check` over throwaway-dir `pnpm add` smoke (CONTEXT.md §Claude's Discretion authorized). Signal equivalence: the Quick-Integration Example imports from `@kehto/shell`, `@kehto/runtime`, `@kehto/services` — all already built + type-checked at stage 3/4 of this loop (10/10 successful). If any import didn't resolve, type-check would fail. Plus direct export-presence counts (3 each, all 5 imports) confirm the barrel shapes. Lower-cost, same signal."

patterns-established:
  - "Pattern: README Architecture Notes bullet rewrite is a single-Edit operation against a unique old_string. Pre-flight sed verification + post-edit 6-grep verification forms a deterministic round-trip check. Reusable for future docs corrections."
  - "Pattern: Full-workspace iteration loop for a docs/types-only phase follows the same shape as Phase 34 (publish-only) — rm -rf full → pnpm install → build → type-check → test:e2e → anti-term sweep. Differs only in expected E2E delta: publish-only = 0, docs/types-only = 0. Phase-scope contract note in iteration log prevents misreading as 'no work done'."
  - "Pattern: Turbo task count deltas tracked separately per pipeline. Phase 35-01 established the distinction (23 build vs 9 type-check — only 6 packages declare type-check scripts vs 13+ with build). Plan 35-02's iteration log confirms +1 holds on BOTH pipelines for @kehto/wm (24/10 final)."
  - "Pattern: Enforcement-prose grep-positives in canonical anti-term sweep are non-violations if they sit in a bullet documenting ABSENCE. README line 94 carries both `window.nostr` and `allow-same-origin` in the NIP-5D anti-features bullet. Iteration log table column 'Status' explicitly reads 'enforcement-prose — asserts ABSENCE'. Carried from Phase 33 Decision, re-validated here. Future docs/README changes in kehto can rely on this pattern."

requirements-completed: [DOCS-04, DOCS-05]

# Metrics
duration: 4 min
completed: 2026-04-23
---

# Phase 35 Plan 2: README Cleanup + Iteration Loop Summary

**Rewrote root README.md line 93 to drop the stale `@napplet/core is not yet on npm` + `pnpm.overrides link:` claim (false since v1.4 first publish), added @kehto/nip66 + @kehto/wm rows to the Packages table, and recorded the canonical full-workspace iteration loop at 54/0/0 with anti-term sweep + DOCS-05 export-presence verification — closing Phase 35 at 5/5 REQ-IDs.**

## Performance

- **Duration:** 4 min (240s wall-clock)
- **Started:** 2026-04-23T11:26:51Z
- **Completed:** 2026-04-23T11:30:51Z
- **Tasks:** 2 (both committed atomically)
- **Files modified:** 1 (README.md)
- **Files created:** 1 (35-ITERATION-LOG.md)

## Accomplishments

- **DOCS-04 closed**: Stale Architecture Notes bullet on README line 93 replaced with accurate Phase-32-Decision-referencing prose. All 6 grep verification patterns match their expected counts:
  - `@napplet/core.*is not yet on npm`: 1 → **0** (stale claim removed)
  - `pnpm.overrides.*link:`: 1 → **0** (stale prose removed)
  - `/home/sandwich/Develop/napplet`: 1 → **0** (user-specific absolute path removed)
  - `@napplet/nub>@napplet/core`: 0 → **1** (replacement references the actual override key)
  - `Phase 32 Decision`: 0 → **1** (cross-reference present)
  - `Registry install`: 0 → **1** (new bullet leader present)
  - `Current milestone: v1.3`: 1 → **1** (unchanged — out of scope per CONTEXT.md `<deferred>`; milestone-close workflow refreshes)
- **DOCS-05 closed**: Quick-Integration Example (README lines 30-57) verified type-check-accurate against v1.6 dep surface via root `pnpm type-check` (10/10 successful). All 5 imports resolve (3 exports each across src + dist + .d.ts barrels):
  - `createShellBridge` (@kehto/shell) — 3
  - `createRuntime` (@kehto/runtime) — 3
  - `createIdentityService` (@kehto/services) — 3
  - `createNotificationService` (@kehto/services) — 3
  - `createRelayPoolService` (@kehto/services) — 3
- **Packages table extended** (CONTEXT.md §Claude's Discretion): added @kehto/nip66 row (v0.1.0 publish-ready, Phase 34) and @kehto/wm row (v0.0.0 skeleton, Plan 35-01). Both rows link to their own READMEs.
- **Full-workspace fresh-install iteration loop at 54/0/0** (18.1s Playwright wall-clock):
  - `pnpm install`: exit 0, 733ms, 25 workspace projects (Phase 34 baseline 24 + 1 for `packages/wm`)
  - `pnpm build`: **24 successful / 24 total**, 0 cached, 5.222s (delta +1 for `@kehto/wm#build`)
  - `pnpm type-check`: **10 successful / 10 total**, 4 cached, 1.3s (delta +1 for `@kehto/wm#type-check`)
  - `pnpm test:e2e`: **54 passed / 0 failed / 0 skipped**, 18.1s (delta 0 from Phase 34 close — docs/types-only contract satisfied)
- **Anti-term sweep clean**: 10 patterns swept on `packages/wm/**` + `README.md`. 8 return zero. 2 grep-positives are both on README line 94 NIP-5D anti-features bullet (documentation of ABSENCE: "window.nostr is not injected... sandbox uses allow-scripts without allow-same-origin") — classified as enforcement-prose per Phase 33 Decision precedent.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite README.md line 93 + extend Packages table** — `063abd7` (docs) — `docs(35-02): refresh README — remove stale core-not-on-npm claim, add nip66+wm to Packages table`
2. **Task 2: Record 54/0/0 iteration loop + DOCS-05 verification** — `9dd6589` (docs) — `docs(35-02): record Phase 35 iteration loop — 54/0/0 preserved, DOCS-04/05 closed`

**Plan metadata:** [to be added by final plan-completion commit]

## Files Created/Modified

### Modified

- `README.md` — 3 insertions / 1 deletion. Architecture Notes bullet on line 93 rewritten (stale registry-era claim → accurate Phase-32-Decision-referencing prose). Packages table extended with 2 new rows (@kehto/nip66 + @kehto/wm). Zero other hunks; Quick-Integration Example + all other sections unchanged.

### Created

- `.planning/phases/35-wm-skeleton-readme-cleanup/35-ITERATION-LOG.md` — 261 lines. Canonical fresh-install iteration loop evidence: pre-iteration HEAD, 5-stage loop (clean/install/build/type-check/e2e) with wall-clock + turbo task counts + 54-passed Playwright summary, 10-pattern anti-term sweep table with enforcement-prose footnotes, 7-row DOCS-04 pre/post grep verification table, 5-row DOCS-05 export-presence table, phase-scope-contract conclusion tying to Phase 34 (delta 0 comparison), v1.6 progress update (18/21 reqs closed).

## Decisions Made

- **Replacement prose used verbatim from CONTEXT.md `<specifics>` draft** — no refinement needed. The draft was already tight (1 sentence, matching surrounding bullet density), factually correct (references the actual override key `@napplet/nub>@napplet/core: ^0.2.1`), and cross-referenced the Phase 32 Decision for future readers.
- **Packages-table extension applied** (CONTEXT.md §Claude's Discretion recommended). Both @kehto/nip66 + @kehto/wm rows added with one-line descriptions. Rationale: v1.6 ships both new packages with public READMEs; consumers reading the root README benefit from seeing the full @kehto/* surface at a glance. Single atomic commit with the line-93 rewrite.
- **DOCS-05 verified via root `pnpm type-check`** (CONTEXT.md §Claude's Discretion authorized the lower-cost choice over throwaway-dir `pnpm add` smoke). All 5 Quick-Integration Example imports resolve against current workspace package barrels — verified by the 10/10 successful type-check + direct grep counts (3 each). No README rewrite needed; example is type-check-accurate as-is.

## Deviations from Plan

None — plan executed exactly as written. All predicted outputs matched actual:

- Pre-edit README state matched Plan 35-02 `<interfaces>` baseline lines 88-93 + 22-28 exactly (verified via `sed -n` pre-flight).
- Post-edit grep counts matched all 6 DOCS-04 expected values (0/0/0/1/1/1).
- `pnpm build` returned `24 successful, 24 total` (plan predicted 24).
- `pnpm type-check` returned `10 successful, 10 total` (plan predicted 24, but this number was already corrected in Plan 35-01 SUMMARY Deviation Rule 1 — the real baseline is 10, and this plan's iteration log confirms).
- `pnpm test:e2e` returned `54 passed (18.1s)` (plan predicted 54/0/0).
- Anti-term sweep: 2 enforcement-prose matches on README line 94, 8 clean (plan predicted `allow-same-origin` at 1 enforcement-prose; `window.nostr` at 1 was on the same bullet — both classified per Phase 33 Decision precedent).

## Authentication Gates

None — all commands ran against local workspace state. No registry publishes (changeset publishing deferred to Phase 36 milestone close), no external service calls, no auth prompts.

## Issues Encountered

None — 4-minute execution with zero stalls.

## Known Stubs

None introduced in this plan. Plan 35-01's @kehto/wm skeleton stub (documented in 35-01 SUMMARY `Known Stubs`) is still the only v1.6 in-repo stub and remains intentional per WM-01/02/03 scope.

## User Setup Required

None — no external service configuration required. This is a docs-only plan modifying one README file + writing one planning-artifact iteration log.

## Next Phase Readiness

- **Phase 35 closes at 5/5 REQ-IDs** (WM-01, WM-02, WM-03 from Plan 35-01; DOCS-04, DOCS-05 from this plan). Ready for Phase 36 (`PERF-01 + Milestone Close E2E-18`).
- **Phase 36 iteration loop baseline**: 24 build tasks / 10 type-check tasks / 54 passed E2E. PERF-01's chat boot storage.get storm fix (batch or parallelize) should land without turbo-count delta; E2E-18 milestone-close loop preserves 54/0/0 (or moves to 55 if PERF-01 ships with a new spec, though REQUIREMENTS.md doesn't mandate one).
- **v1.6 progress: 18/21 reqs closed** (86%). Remaining: PERF-01 + E2E-18. v1.6 milestone close = Phase 36 iteration loop at 54+/0/0 + changeset-publish cascade for the v1.6 @kehto/* minor bumps (nip66 0.1.0 + other packages).
- **No blockers, no concerns.**

---

## Self-Check

Verification of SUMMARY claims against disk state + git history:

**1. Modified files exist:**
- `README.md` — FOUND (line 93 bullet rewritten; Packages table extended with @kehto/nip66 + @kehto/wm rows)

**2. Created files exist:**
- `.planning/phases/35-wm-skeleton-readme-cleanup/35-ITERATION-LOG.md` — FOUND (261 lines)

**3. Commits exist:**
- `063abd7` (Task 1) — FOUND in `git log --oneline -4`
- `9dd6589` (Task 2) — FOUND in `git log --oneline -4`

**4. DOCS-04 grep evidence:**
- `grep -c "@napplet/core.*is not yet on npm" README.md` returns `0` — CONFIRMED
- `grep -c "pnpm.overrides.*link:" README.md` returns `0` — CONFIRMED
- `grep -c "@napplet/nub>@napplet/core" README.md` returns `1` — CONFIRMED
- `grep -c "Phase 32 Decision" README.md` returns `1` — CONFIRMED
- `grep -c "Registry install" README.md` returns `1` — CONFIRMED

**5. Iteration log evidence:**
- Log contains `54 passed` — CONFIRMED (7 occurrences)
- Log contains `delta 0` — CONFIRMED (2 occurrences)
- Log contains `DOCS-04` — CONFIRMED (8 occurrences)
- Log contains `DOCS-05` — CONFIRMED (7 occurrences)
- Log contains `24 successful` — CONFIRMED (2 occurrences)

## Self-Check: PASSED

---

*Phase: 35-wm-skeleton-readme-cleanup*
*Completed: 2026-04-23*
