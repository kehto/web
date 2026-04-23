---
phase: 36-perf-01-milestone-close
plan: 2
subsystem: testing
tags: [e2e-18, milestone-close, v1.6, iteration-loop, anti-term-sweep, regression-fix]

# Dependency graph
requires:
  - phase: 35-wm-skeleton-readme-cleanup
    provides: "Phase 35 close baseline — 24/24 build + 10/10 type-check + 54/0/0 E2E"
  - phase: 36-01 (this phase, preceding plan)
    provides: "7 auth-probes deleted + D-04 prose scrubbed across 10 napplets + 6 E2E specs"
provides:
  - "54 passed / 0 failed / 0 skipped E2E baseline preserved post-PERF-01"
  - "v1.6 milestone-wide anti-term sweep (10 patterns, full Phase 32-36 cumulative delta) — zero napplet-code violations"
  - "Regression fix for 3 OUTBOUND-ONLY napplets (composer / theme-switcher / toaster) — replaced deleted AUTH-probe with honest identity.getPublicKey() boot call"
  - "36-ITERATION-LOG.md — canonical v1.6 milestone-close iteration evidence + pre/post storage.getItem count delta + anti-term sweep table"
affects:
  - "v1.6 milestone lifecycle (/gsd:complete-milestone)"
  - "Future phases that delete vestigial SDK calls (must check AUTH-trigger role before delete)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AUTH-trigger lightweight-replacement pattern — when deleting a vestigial envelope-generating call on boot, check whether the napplet has any OTHER boot-time SDK call; if not, replace with a honest lightweight call (e.g., identity.getPublicKey) rather than leaving the napplet with no boot envelope"
    - "Two-phase probe retirement — Phase 36-01 deletes the pattern (feat+docs); Phase 36-02 iteration loop catches the regression + applies the replacement (fix). Separation preserves bisect-clean history and makes the load-bearing-ness of the deleted call explicit in git log"
    - "Cumulative milestone anti-term sweep — the milestone-close phase runs the sweep across the FULL milestone delta (here: Phases 32-36), not just the close-phase's own touch paths. This is the first pass that would catch a v1.6-introduced anti-term that Phases 32-35 individual sweeps might have missed if confined to narrower touch scopes"

key-files:
  created:
    - ".planning/phases/36-perf-01-milestone-close/36-ITERATION-LOG.md"
  modified:
    - "apps/demo/napplets/composer/src/main.ts"
    - "apps/demo/napplets/theme-switcher/src/main.ts"
    - "apps/demo/napplets/toaster/src/main.ts"

key-decisions:
  - "Replaced 3 vestigial storage-probe AUTH-triggers with identity.getPublicKey() rather than re-introducing the probe (would undo PERF-01) or making D-04 SDK callouts optional (would require runtime changes outside scope) — identity.getPublicKey is the natural 'introduce the napplet' call already used by profile-viewer and has zero anti-term residue"
  - "Classified the signer-demo observer in apps/demo/src/main.ts:608 (eventKind === 29001) as 'shell-scoped, pre-existing, out of PERF-01 scope' per CONTEXT.md — the v1.6 anti-feature ban is explicitly 'in napplet code' (REQUIREMENTS.md), the demo shell's signer-request observer for the inspector UI is a legitimate shell-side monitor and predates v1.6"
  - "Classified 158 grep-positives across 10 anti-term patterns into 6 categories (enforcement-prose / regex patterns / documented deviations / shell-internal Signer adapter / resolve-to-null test assertions / pre-existing shell observers) with zero napplet-code violations — extends Phase 33/35 Decision precedent to the full v1.6 milestone cumulative scope"
  - "storage.getItem delta actual 28→8 (delta -20), not the planned 28→~21 (delta -7) — the plan's post-fix estimate undercounted because preferences has 5 calls (paired load/save re-reads), not the 3 the plan guessed. Exceeds <= 22 success threshold comfortably"
  - "Plan 36-01 SUMMARY already documented the storage count interpretation (pre=28 was conflating storage.* with storage.getItem); this plan records the post-fix number truthfully at 8, aligned with per-napplet inventory"

patterns-established:
  - "Milestone-close iteration loop shape — this was the first v1.6 sweep that covers every Phase 32-36 touch path in one pass (prior phase sweeps scoped to only that phase's delta). The resulting 10-pattern table is a template for future milestone-close phases: each new milestone's anti-term list adds rows, but the cumulative-delta scope remains a milestone-close convention"
  - "Dead-code-delete + comment-scrub phase contract — when a phase's work is 'remove vestigial pattern', the E2E count is deliberately unchanged (54 → 54). The regression validation is the existing canonical spec (demo-concurrent-boot.spec.ts for PERF-01) catching any silent behavior regression. Iteration log explicitly records 'delta 0 is the contract, not a failure' — matches Phase 34 (publish-only) and Phase 35 (docs-only) phase-scope contract notes"
  - "Pre-loop git status check — git status --porcelain must be empty before running the fresh-install loop. A dirty tree contaminates the evidence (rm -rf eats the uncommitted work). Phase 36 formalizes this as Step 1 of the loop workflow"
  - "Regression-fix-during-iteration-loop discipline — when the iteration loop catches a regression from the preceding plan's work, apply the fix as a fix(XX-NN) commit PRIOR to writing the iteration log, then re-run the loop, then write the log recording both the first-attempt failure + the fix + the successful re-run. Preserves evidence of what the loop caught while allowing the log to report a green final state"

requirements-completed:
  - E2E-18

# Metrics
duration: 9min
completed: 2026-04-23
---

# Phase 36 Plan 2: v1.6 Milestone-Close Iteration Loop + E2E-18 Summary

**Ran canonical v1.6 fresh-install iteration loop against post-Plan-36-01 tree; caught a 3-napplet AUTHENTICATED regression introduced by the probe deletions in OUTBOUND-ONLY napplets (composer / theme-switcher / toaster); applied a semantically honest identity.getPublicKey() AUTH-trigger replacement; re-ran to 54/0/0; captured the full v1.6 milestone-wide anti-term sweep (10 patterns, 158 grep-positives, zero napplet-code violations) in 36-ITERATION-LOG.md — closes E2E-18 and v1.6 milestone at 21/21 reqs.**

## Performance

- **Duration:** ~9 min (plan-start to iteration-log commit)
- **Started:** 2026-04-23T13:25:55Z (post-Plan-36-01 evidence capture)
- **Completed:** 2026-04-23T13:35:03Z (iteration log commit 24a0887)
- **Tasks:** 1 (type="auto") + 1 implicit regression-fix commit
- **Files modified:** 4 (3 napplets for regression fix + 1 new iteration log)

## Accomplishments

- **E2E-18 gate satisfied** — canonical v1.6 fresh-install loop (rm -rf + install + build + type-check + test:e2e) green at 54 passed / 0 failed / 0 skipped
- **Turbo task counts preserved** — 24/24 build + 10/10 type-check unchanged from Phase 35 close baseline
- **v1.6 milestone-wide anti-term sweep clean** — 10 patterns swept across Phases 32-36 cumulative delta; 158 grep-positives all classified as enforcement-prose / regex patterns / documented deviations / shell-internal Signer adapter / resolve-to-null test assertions / pre-existing signer-demo observer (out of PERF-01 scope). Zero napplet-code violations.
- **Regression caught + fixed** — first e2e attempt failed at 50 passed / 3 failed / 1 did not run because Plan 36-01's probe deletion removed the SOLE boot-time SDK envelope for 3 OUTBOUND-ONLY napplets (composer / theme-switcher / toaster), breaking shell's Path B AUTH detection. Added `await identity.getPublicKey()` to each init — a single honest AUTH-trigger call, not a probe.
- **PERF-01 closure validated** — `auth-probe` grep returns 0 across `apps/demo/napplets/`; demo-wide `storage.getItem` count 28 → 8 (delta -20); `demo-concurrent-boot.spec.ts` (E2E-15) passes AUTHENTICATED for all 10 napplets within 10s.
- **v1.6 milestone complete at 21/21** — PERF-01 + E2E-18 added to the 19 already closed through Phase 35. Ready for `/gsd:complete-milestone`.

## Task Commits

1. **Regression fix (implicit — called out in plan FAILURE HANDLING)** — `dd9b5af` (fix) — `fix(36-01): restore composer/theme-switcher/toaster authenticated flip`
2. **Task 1: Canonical v1.6 iteration loop + anti-term sweep + 36-ITERATION-LOG.md** — `24a0887` (docs) — `docs(36-02): record Phase 36 iteration loop — 54/0/0 preserved, v1.6 milestone close`

**Plan metadata:** (this summary + STATE.md/ROADMAP.md/REQUIREMENTS.md update commit — to follow)

## Files Created/Modified

### Regression fix (dd9b5af)

- `apps/demo/napplets/composer/src/main.ts` — added `identity` to sdk import; added `await identity.getPublicKey()` as first statement of `init()`; tidied error fallback `auth/storage failure` → `init failure`
- `apps/demo/napplets/theme-switcher/src/main.ts` — added `identity` import; added `await identity.getPublicKey()` to init; updated JSDoc to describe the new AUTH-trigger role; tidied error fallback
- `apps/demo/napplets/toaster/src/main.ts` — added `identity` import; added `await identity.getPublicKey()` to init; updated comment describing the new AUTH-trigger role

### Iteration log (24a0887)

- `.planning/phases/36-perf-01-milestone-close/36-ITERATION-LOG.md` — 299 lines canonical v1.6 milestone-close iteration evidence; full 5-stage fresh-install loop; 10-pattern anti-term sweep table; PERF-01 per-napplet storage.getItem inventory; Plan-36-02 AUTH-trigger replacement map; v1.6 21/21 closure summary

## Verification Evidence

### Iteration loop 5-stage result

| Stage | Command | Exit | Wall | Detail |
|-------|---------|------|------|--------|
| 1 | rm -rf (workspace + .turbo purge) | 0 | <1s | Full workspace + turbo cache purged |
| 2 | pnpm install | 0 | 666ms | 25 workspace projects; lockfile up to date; no @napplet/nub* warnings |
| 3 | pnpm build | 0 | 5.459s | Tasks: 24 successful, 24 total; Cached: 0 cached, 24 total |
| 4 | pnpm type-check | 0 | 1.304s | Tasks: 10 successful, 10 total; Cached: 4 cached, 10 total |
| 5 (first attempt) | pnpm test:e2e | 1 | 26.5s | 50 passed / 3 failed / 1 did not run — 3-napplet AUTHENTICATED regression caught |
| 5 (post-fix re-run) | pnpm test:e2e | 0 | 18.4s | **54 passed / 0 failed / 0 skipped** |

### v1.6 milestone-wide anti-term sweep (10 patterns)

| # | Pattern | Count | Classification |
|---|---------|-------|----------------|
| 1 | `window.nostr` | 17 | enforcement-prose + test assertion (no-window-nostr.test.ts enforces absence) |
| 2 | `signer-service` | 39 | regex patterns (34 ANTI_TERM_RE) + enforcement-prose (5 JSDoc mentions) |
| 3 | `signer.` literal dot | 31 | resolve-to-null tests (6) + shell-internal Signer adapter (4) + migration JSDoc (7) + shell-scoped Signer references (14) |
| 4 | `window.addEventListener('message'` | 13 | 2 documented deviations (preferences + toaster) + shell listeners + harness + JSDoc (all not napplet violations) |
| 5 | `BusKind` | 46 | 34 ANTI_TERM_RE regex + 12 enforcement-prose mentions |
| 6 | `29001` / `29002` | 10 | 1 pre-existing signer-demo observer (apps/demo/src/main.ts:608, shell-scoped, out of PERF-01 per CONTEXT.md) + 9 enforcement-prose/regex |
| 7 | `core-compat` | 0 | clean (v1.4 Phase 24 deleted) |
| 8 | `allow-same-origin` | 2 | enforcement-prose (README + harness comment documenting absence) |
| 9 | `@napplet/nub-` split form | 0 | clean (Phase 32 DEP consolidation; CHANGELOG.md excluded) |
| 10 | `auth-probe` | 0 | **clean — PERF-01 core evidence** (Plan 36-01 Task 1 deletions) |

**Total:** 158 grep-positives; zero napplet-code violations per Phase 33/35 Decision precedent classification.

### PERF-01 pre/post delta

| Metric | Pre (Plan-36-01 pre-edit) | Post (after 36-02 fix) | Delta |
|--------|--------------------------|------------------------|-------|
| `auth-probe` grep (apps/demo/napplets/) | 7 | 0 | -7 |
| `D-04` grep (apps/demo/napplets/) | 20 | 0 | -20 |
| `D-04` / `AUTH probe` grep (tests/e2e/) | 10 | 0 | -10 |
| Demo-wide `storage.getItem` count | 28 | 8 | **-20** |
| OUTBOUND-ONLY napplets with boot AUTH envelope | 3 (via probe) | 3 (via identity.getPublicKey) | 0 net |

### HEAD SHAs

| Role | SHA | Subject |
|------|-----|---------|
| Plan 36-01 Task 1 | `c45e4e1` | feat(36-01): delete 7 vestigial auth-probes from demo napplets |
| Plan 36-01 Task 2 | `ce1c005` | docs(36-01): scrub D-04 / AUTH-probe comment prose across napplets + E2E specs |
| Plan 36-01 SUMMARY | `b7c5d9a` | docs(36-01): complete PERF-01 auth-probe deletion plan |
| Plan 36-02 regression fix | `dd9b5af` | fix(36-01): restore composer/theme-switcher/toaster authenticated flip |
| Plan 36-02 iteration log | `24a0887` | docs(36-02): record Phase 36 iteration loop — 54/0/0 preserved, v1.6 milestone close |
| Phase 35 close (reference) | `9dd6589` | docs(35-02): record Phase 35 iteration loop — 54/0/0 preserved, DOCS-04/05 closed |

## Decisions Made

See frontmatter `key-decisions`. Summary:

1. **Replaced probes with identity.getPublicKey() for 3 OUTBOUND-ONLY napplets** — rather than re-introducing the probe (would undo PERF-01) or requiring a runtime change (out of scope). `identity.getPublicKey()` is a natural semantic boot call used by profile-viewer; zero anti-term residue.
2. **Classified signer-demo observer in apps/demo/src/main.ts:608 as out-of-scope** — the v1.6 anti-feature ban per REQUIREMENTS.md scopes kind 29001/29002 "in napplet code"; the demo shell's signer-request observer is a legitimate shell-side monitor for the signer-demo inspector UI and predates v1.6.
3. **Reported actual storage.getItem count (8) instead of plan's estimate (21)** — plan 36-01 SUMMARY already documented the plan's estimate conflated storage.* with storage.getItem; this iteration log records the truthful per-napplet inventory (bot=1, chat=2, preferences=5, all others=0).
4. **Committed regression fix BEFORE iteration log** — the plan's FAILURE HANDLING explicitly instructs "fix the regression, commit as fix(36-01), re-run, then write the log". Separation preserves bisect-clean history and makes the load-bearing-ness of the deleted probe explicit in git log.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 3-napplet AUTHENTICATED regression from Plan 36-01**

- **Found during:** Task 1 Step 4 Stage 5 (first pnpm test:e2e attempt)
- **Issue:** `demo-concurrent-boot.spec.ts` (E2E-15) failed with a clean diff showing composer / theme-switcher / toaster stuck at `loading...` instead of `authenticated`. Cascading failures: media-controller.spec.ts and shell-ui-state-surfaces.spec.ts UI-02 (3 failed / 1 did not run total).
- **Root cause:** Plan 36-01 deleted the vestigial `storage.getItem('<slug>-auth-probe')` calls from 7 napplets. For 4 of them (feed, hotkey-chord, media-controller, profile-viewer) other boot-time SDK calls still produced the first `napplet->shell` envelope that triggers shell's Path B AUTH detection. For the remaining 3 (composer, theme-switcher, toaster) the probe was the SOLE boot-time SDK call — all their real flows fire from button handlers. Deleting the probe removed the AUTH-detection trigger entirely.
- **Fix:** Added `await identity.getPublicKey()` as the first statement of `init()` in composer / theme-switcher / toaster. Single envelope; result discarded; semantically honest ('introduce the napplet' — same pattern profile-viewer already uses). Also tidied stale error fallbacks from `auth/storage failure` to `init failure`.
- **Files modified:** `apps/demo/napplets/{composer,theme-switcher,toaster}/src/main.ts`
- **Verification:** Post-fix `pnpm build` + `pnpm type-check` clean at 24/24 + 10/10; `pnpm test:e2e` re-ran green at 54/0/0.
- **Committed in:** `dd9b5af` (fix — applied BEFORE writing the iteration log, per plan's FAILURE HANDLING guidance)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug regression from preceding plan, surfaced by the iteration loop's load-bearing E2E gate).

**Impact on plan:** Scope-expanded by one additional commit (the regression fix) that the plan explicitly anticipated in its FAILURE HANDLING section: "Plan 36-01 broke a status-sentinel flip. Look at demo-concurrent-boot.spec.ts output... Likely cause: dropped storage import was load-bearing OR the init function collapse removed a setStatus('authenticated') call. Re-run Plan 36-01's edits against the failed napplet. Commit the fix as `fix(36-01): restore <napplet> authenticated flip`, then re-run this step." Executed exactly as the plan instructed. No deviation from the plan's designed failure-path.

## Issues Encountered

None beyond the anticipated regression handling above. The two-stage iteration-loop-catches-regression pattern worked exactly as designed — `demo-concurrent-boot.spec.ts` (E2E-15) delivered a clean diff showing the 3 regressing napplets immediately.

## User Setup Required

None — no external service configuration; regression fix + evidence-capture only.

## Reusable Patterns Established

- **AUTH-trigger lightweight-replacement pattern:** when deleting a vestigial envelope-generating call on boot, check whether the napplet has any OTHER boot-time SDK call; if not, replace with a honest lightweight call (e.g., `identity.getPublicKey()`) rather than leaving the napplet with no boot envelope. Preserves AUTH-detection semantics without re-introducing the probe's anti-term.
- **Milestone-close iteration loop shape:** first v1.6 sweep that covers every Phase 32-36 touch path in one pass (prior phase sweeps scoped only to that phase's delta). The resulting 10-pattern table is a template for future milestone-close phases.
- **Dead-code-delete + comment-scrub phase contract:** when a phase's work is 'remove vestigial pattern', the E2E count is deliberately unchanged (54 → 54). The regression validation is the existing canonical spec (`demo-concurrent-boot.spec.ts` for PERF-01) catching any silent behavior regression. Iteration log explicitly records 'delta 0 is the contract, not a failure'.
- **Regression-fix-during-iteration-loop discipline:** when the iteration loop catches a regression from the preceding plan's work, apply the fix as a `fix(XX-NN)` commit PRIOR to writing the iteration log, then re-run the loop, then write the log recording both the first-attempt failure + the fix + the successful re-run.
- **Pre-loop git status check:** `git status --porcelain` must be empty before running the fresh-install loop. A dirty tree contaminates the evidence (rm -rf eats the uncommitted work). Formalized as Step 1 of the iteration-loop workflow.

## Next Phase Readiness

**v1.6 Milestone: Downstream Unblock & Shell Service Surface — COMPLETE. 5 phases, 12 plans, 21/21 reqs, 54/0/0 E2E baseline. Ready for /gsd:complete-milestone.**

Pre-conditions for milestone-close lifecycle:
- All 21 v1 requirements closed (DEP-01..05, KEYS-04..06, E2E-17, NIP66-01..05, WM-01..03, DOCS-04..05, PERF-01, E2E-18)
- E2E baseline at Phase 35 close (54) preserved through Phase 36 close
- Turbo task counts stable (24 build + 10 type-check; +1 both from Phase 34 close due to @kehto/wm skeleton)
- Anti-term sweep clean across full milestone cumulative delta (10 patterns, 158 grep-positives all classified, zero napplet-code violations)
- Working tree clean post-plan (2 commits landed: `dd9b5af` regression fix + `24a0887` iteration log)

## Self-Check: PASSED

All claimed files exist and contain the expected content:

- [x] `.planning/phases/36-perf-01-milestone-close/36-ITERATION-LOG.md` — exists, 299 lines, contains `54 passed`, `PERF-01`, `E2E-18`, `21/21`, `24 successful`, `10 successful`, `auth-probe`, `@napplet/nub-`, `window.nostr`, `delta 0`
- [x] `apps/demo/napplets/composer/src/main.ts` — contains `identity.getPublicKey`, no `auth-probe`, no `D-04`
- [x] `apps/demo/napplets/theme-switcher/src/main.ts` — contains `identity.getPublicKey`, no `auth-probe`, no `D-04`
- [x] `apps/demo/napplets/toaster/src/main.ts` — contains `identity.getPublicKey`, no `auth-probe`, no `D-04`
- [x] Commit `dd9b5af` present in `git log` (fix — regression restore)
- [x] Commit `24a0887` present in `git log` (docs — iteration log)
- [x] `pnpm test:e2e` exited 0 at 54 passed / 0 failed / 0 skipped (evidenced by /tmp/36-02-e2e.log tail + iteration log Stage 5 quote)
- [x] `pnpm build` exited 0 at 24/24 (evidenced by /tmp/36-02-build.log tail)
- [x] `pnpm type-check` exited 0 at 10/10 (evidenced by /tmp/36-02-typecheck.log tail)
- [x] `git status --porcelain` empty post-commit

---

*Phase: 36-perf-01-milestone-close*
*Completed: 2026-04-23*
*v1.6 Milestone: Downstream Unblock & Shell Service Surface — COMPLETE. 5 phases, 12 plans, 21/21 reqs, 54/0/0 E2E baseline. Ready for /gsd:complete-milestone.*
