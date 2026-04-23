---
phase: 36-perf-01-milestone-close
verified: 2026-04-23T00:00:00Z
status: passed
score: 7/7 must-haves verified
---

# Phase 36: PERF-01 + Milestone Close E2E-18 Verification Report

**Phase Goal (rescoped 2026-04-23):** Delete 7 vestigial D-04 AUTH probes from demo napplets; AUTHENTICATED sentinel still fires for all 10 napplets; v1.6 milestone-close fresh-install iteration loop green at 54/0/0 with full v1.6 anti-term sweep clean.

**Verified:** 2026-04-23
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 7 vestigial `storage.getItem('<napplet>-auth-probe')` calls deleted from demo napplets | VERIFIED | `grep -rn "auth-probe" apps/demo/napplets/` returns 0 (excl. dist); 7 probe napplets (composer/feed/hotkey-chord/media-controller/profile-viewer/theme-switcher/toaster) all show `storage.getItem` count = 0 |
| 2 | D-04 / shim-AUTH comment prose scrubbed across napplets + E2E specs | VERIFIED | `grep -rn "D-04 init pattern\|shim AUTH completion\|gates on shim AUTH"` across napplets + tests/e2e returns 0 matches |
| 3 | AUTHENTICATED sentinel still fires for all 10 napplets | VERIFIED | `tests/e2e/demo-concurrent-boot.spec.ts` contains 5 `authenticated` references (E2E-15 regression anchor); all 10 napplets retain their authenticated flip path: composer/feed/hotkey-chord/media-controller/profile-viewer/theme-switcher/toaster via `setStatus('authenticated', 'green')`; bot/chat via `statusEl.textContent = 'authenticated'`; preferences via `setStatus('loaded', 'green')` (documented phase-specific sentinel per Plan 36-01 SUMMARY) |
| 4 | v1.6 milestone-close fresh-install iteration loop green at 54/0/0 | VERIFIED | `36-ITERATION-LOG.md` records final result `54 passed (18.4s)`; 5-stage loop exit codes all 0 (rm -rf / install / build / type-check / test:e2e); log contains 7 occurrences of "54 passed" |
| 5 | Turbo task counts preserved at Phase 35 close baseline | VERIFIED | ITERATION-LOG records `Tasks: 24 successful, 24 total` build + `Tasks: 10 successful, 10 total` type-check (each "24 successful" and "10 successful" appears 2× in log) |
| 6 | v1.6 anti-term sweep clean across full Phase 32-36 cumulative delta | VERIFIED | ITERATION-LOG 10-pattern sweep table: 158 grep-positives all classified as enforcement-prose / regex patterns / documented deviations / shell-internal Signer adapter / pre-existing shell observers; zero napplet-code violations. Spot-check: `core-compat` = 0, `@napplet/nub-` split form = 0 |
| 7 | v1.6 milestone 21/21 REQ-IDs Complete (PERF-01 + E2E-18 closing additions) | VERIFIED | `grep -c "^\| .* Complete" .planning/REQUIREMENTS.md` = 21; PERF-01 and E2E-18 both marked `Phase 36 \| Complete`; ITERATION-LOG contains "21/21" 4× |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.planning/phases/36-perf-01-milestone-close/36-ITERATION-LOG.md` | v1.6 milestone-close iteration evidence + anti-term sweep + storage.getItem delta + v1.6 21/21 closure | VERIFIED | Exists, 299 lines (> min_lines 120); contains `54 passed` (7×), `PERF-01` (20×), `E2E-18` (7×), `21/21` (4×), `24 successful` (2×), `10 successful` (2×), `auth-probe` (13×), `@napplet/nub-` (1×), `window.nostr` (3×), `delta 0` (4×) |
| `apps/demo/napplets/composer/src/main.ts` | Probe deleted + AUTH-trigger replacement (identity.getPublicKey) | VERIFIED | No `auth-probe` / `D-04`; `identity.getPublicKey` count = 2; `setStatus('authenticated'` present (3×) |
| `apps/demo/napplets/theme-switcher/src/main.ts` | Probe deleted + AUTH-trigger replacement | VERIFIED | No `auth-probe` / `D-04`; `identity.getPublicKey` count = 2; authenticated flip present |
| `apps/demo/napplets/toaster/src/main.ts` | Probe deleted + AUTH-trigger replacement | VERIFIED | No `auth-probe` / `D-04`; `identity.getPublicKey` count = 2; authenticated flip present |
| `apps/demo/napplets/{feed,hotkey-chord,media-controller,profile-viewer}/src/main.ts` | Probes deleted (existing non-probe SDK calls remain the AUTH trigger) | VERIFIED | All 4 napplets: 0 `storage.getItem` calls; `setStatus('authenticated'` present |
| `apps/demo/napplets/{bot,chat,preferences}/src/main.ts` | Comment-only scrub (real storage loads preserved) | VERIFIED | bot=1 (RULES_KEY), chat=2 (HISTORY_KEY + re-read), preferences=5 (display-name + theme-preference paired load/save paths) — storage.getItem counts match plan's expected per-napplet inventory |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| 36-ITERATION-LOG.md §Stage 5 | tests/e2e/demo-concurrent-boot.spec.ts (E2E-15) AUTHENTICATED assertion | `pnpm test:e2e` captures `54 passed` summary | WIRED | Log shows Stage 5 exit 0 at 54/0/0; E2E-15 spec unchanged (0 D-04/auth-probe residuals) — regression anchor green |
| 36-ITERATION-LOG.md §Anti-term sweep | v1.6 milestone-wide enforcement (REQUIREMENTS.md + Phase 32 @napplet/nub- addition) | 10-pattern grep across packages/ + apps/demo/ + tests/e2e/ + README.md | WIRED | Sweep table enumerates all 10 patterns; classifications align with Phase 33/35 Decision precedents; zero live violations |
| 36-ITERATION-LOG.md §storage.getItem count delta | Plan 36-01 Task 1 + Task 2 commits (c45e4e1 + ce1c005) | Per-napplet grep inventory pre/post | WIRED | Log records 28 → 8 actual (delta -20; exceeds planned -7 minimum — plan's 28 conflated storage.* with storage.getItem per 36-01 SUMMARY §Storage.getItem demo-wide count) |
| 3 OUTBOUND-ONLY napplets (composer/theme-switcher/toaster) init() | Shell Path B AUTH detection | `await identity.getPublicKey()` first envelope on boot (dd9b5af regression fix) | WIRED | All 3 napplets contain 2 `identity.getPublicKey` references; E2E-15 passes AUTHENTICATED-for-all-10 within 10s |

### Data-Flow Trace (Level 4)

Not applicable as a standalone check — Phase 36 is a dead-code-delete + comment-scrub + milestone-close-evidence phase. The regression-fix data flow (init() → identity.getPublicKey envelope → shell Path B AUTH detection → AUTHENTICATED sentinel → `#<napplet>-status` DOM) is already traced by the E2E-15 `demo-concurrent-boot.spec.ts` regression anchor inside the 54-spec run.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Auth probe deletion | `grep -rn "auth-probe" apps/demo/napplets/ \| grep -v dist \| wc -l` | 0 | PASS |
| D-04 comment scrub | `grep -rn "D-04 init pattern\|shim AUTH completion\|gates on shim AUTH" napplets/ tests/e2e/ \| grep -v dist \| wc -l` | 0 | PASS |
| E2E-15 regression anchor unchanged | `grep -c "authenticated" tests/e2e/demo-concurrent-boot.spec.ts` | 5 | PASS |
| ITERATION-LOG 54 passed | `grep -c "54 passed" 36-ITERATION-LOG.md` | 7 | PASS |
| storage.getItem count | `grep -rn "storage.getItem" apps/demo/napplets/*/src/main.ts \| wc -l` | 8 (was 28 pre-fix; delta -20) | PASS |
| v1.6 21/21 requirements | `grep -c "^\| .* Complete" .planning/REQUIREMENTS.md` | 21 | PASS |
| identity.getPublicKey regression fix | `grep -c "identity.getPublicKey" apps/demo/napplets/{composer,theme-switcher,toaster}/src/main.ts` | 2 / 2 / 2 | PASS |
| Working tree clean | `git status --porcelain` | (empty) | PASS |
| core-compat anti-term (v1.6 scope) | `grep -rn --exclude-dir=dist 'core-compat' packages/ apps/demo/ tests/e2e/ README.md \| wc -l` | 0 | PASS |
| @napplet/nub- split form anti-term | `grep -rn --exclude-dir=dist --exclude=CHANGELOG.md '@napplet/nub-' packages/ apps/demo/ tests/e2e/ README.md \| wc -l` | 0 | PASS |

All 10 spot-checks pass.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PERF-01 | 36-01-PLAN.md (requirements: PERF-01) | Delete 7 vestigial D-04 AUTH probes + scrub D-04 comment prose across 10 napplets | SATISFIED | `grep -rn "auth-probe"` = 0; D-04 comment scrub = 0 residuals; storage.getItem 28 → 8 (delta -20); REQUIREMENTS.md row `\| PERF-01 \| Phase 36 \| Complete \|` |
| E2E-18 | 36-02-PLAN.md (requirements: E2E-18) | Canonical v1.6 milestone-close iteration loop at ≥ 54/0/0 with full anti-term sweep | SATISFIED | ITERATION-LOG records `54 passed (18.4s)` final result; 10-pattern anti-term sweep classified clean; REQUIREMENTS.md row `\| E2E-18 \| Phase 36 \| Complete \|` |

Orphan check: REQUIREMENTS.md maps Phase 36 to exactly PERF-01 + E2E-18 — no orphaned requirement IDs.

### Anti-Patterns Found

None. Dedicated scans:

- No TODO/FIXME/placeholder comments introduced by Phase 36 in the touched napplets
- No empty implementations — all 3 regression-fix napplets (composer/theme-switcher/toaster) contain real `await identity.getPublicKey()` calls, not stubs
- No hardcoded empty data — storage.getItem count reductions correspond to deleted probe calls, not silenced data paths
- Preferences uses `setStatus('loaded', 'green')` not `setStatus('authenticated', ...)` — this is a pre-Phase-36 documented phase-specific sentinel (Plan 36-01 SUMMARY line 179 explicitly cites "Preferences uses `setStatus('loaded', 'green')` inside `loadPreferences()` — not touched by scope"). Not a stub.

### Human Verification Required

None. All Phase 36 must-haves are programmatically verifiable via grep counts, file existence, iteration-log assertions, and REQUIREMENTS.md status rows. The E2E-15 regression anchor (`demo-concurrent-boot.spec.ts`) is the canonical assertion that the 10-napplet AUTHENTICATED sentinel fires, and it passed in-band as part of the 54/0/0 run recorded in the iteration log.

### Gaps Summary

No gaps. All 7 observable truths verified. All 10 required artifacts verified at all three levels (exists, substantive, wired). All 4 key links wired. All 10 behavioral spot-checks pass. Both Phase 36 requirements (PERF-01 + E2E-18) satisfied with evidence. v1.6 milestone 21/21 REQ-IDs Complete.

**Noted (not a gap):** Plan 36-02 executed one Rule 1 auto-fix — added `await identity.getPublicKey()` to composer/theme-switcher/toaster init after Plan 36-01's initial probe deletion caused AUTHENTICATED detection regressions for the 3 OUTBOUND-ONLY napplets. Fix is documented in 36-02-SUMMARY.md §Deviations from Plan §Auto-fixed Issues (commit `dd9b5af`). Verified in place: each of the 3 files contains 2 `identity.getPublicKey` references; the final `pnpm test:e2e` re-run produced the 54/0/0 evidence captured in the iteration log.

---

*Verified: 2026-04-23*
*Verifier: Claude (gsd-verifier)*
