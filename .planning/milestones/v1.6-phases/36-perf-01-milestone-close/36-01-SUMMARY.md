---
phase: 36-perf-01-milestone-close
plan: 1
subsystem: testing
tags: [perf-01, demo-napplets, auth-probe-cleanup, d-04-deprecation, storage-sdk]

# Dependency graph
requires:
  - phase: 35-wm-skeleton-readme-cleanup
    provides: "Phase 35 close baseline — 24/24 build + 10/10 type-check + 54 E2E green at commit 837eab0"
  - phase: 24-runtime-drift-core-cleanup (v1.4)
    provides: "AUTH deprecation — deleted AUTH_KIND / BusKind runtime consumers; shim fires AUTHENTICATED from bootstrap signal directly"
provides:
  - "7 vestigial storage.getItem('<slug>-auth-probe') calls deleted from composer/feed/hotkey-chord/media-controller/profile-viewer/theme-switcher/toaster"
  - "D-04 / AUTH-probe / shim AUTH completion prose scrubbed from all 10 demo napplets + 6 E2E specs"
  - "Unused storage imports dropped where the probe was the last consumer (7 napplets)"
  - "AUTHENTICATED sentinel still fires for all 10 napplets (preserved — setStatus calls intact)"
affects:
  - "36-02 (milestone-close E2E-18 iteration loop — validates 54/0/0 regression anchor)"
  - "Future napplet authors (init pattern no longer needs AUTH gate)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-commit vestigial-cleanup discipline — feat() commit for behavior delete, docs() commit for prose scrub (bisect-clean separation)"
    - "Comment-only task build gate — run pnpm build + type-check even on comment edits (targeted Edit can accidentally touch adjacent code near function boundaries)"

key-files:
  created: []
  modified:
    - "apps/demo/napplets/composer/src/main.ts"
    - "apps/demo/napplets/feed/src/main.ts"
    - "apps/demo/napplets/hotkey-chord/src/main.ts"
    - "apps/demo/napplets/media-controller/src/main.ts"
    - "apps/demo/napplets/profile-viewer/src/main.ts"
    - "apps/demo/napplets/theme-switcher/src/main.ts"
    - "apps/demo/napplets/toaster/src/main.ts"
    - "apps/demo/napplets/bot/src/main.ts"
    - "apps/demo/napplets/chat/src/main.ts"
    - "apps/demo/napplets/preferences/src/main.ts"
    - "tests/e2e/identity-flow.spec.ts"
    - "tests/e2e/napplet-auth.spec.ts"
    - "tests/e2e/media-controller.spec.ts"
    - "tests/e2e/hotkey-chord.spec.ts"
    - "tests/e2e/relay-subscribe.spec.ts"
    - "tests/e2e/nub-theme.spec.ts"

key-decisions:
  - "Collapsed the try/catch wrapping each auth-probe call — probe was the sole wrapped statement in all 7 files; setStatus('authenticated') now fires directly as first statement of init body (CONTEXT.md Claude's Discretion authorization)"
  - "Dropped unused `storage` imports from 7 napplets where the probe was the last consumer (composer, feed, hotkey-chord, media-controller, profile-viewer, theme-switcher, toaster) — tsup would warn on unused, and the code is cleaner"
  - "Scrubbed ALL D-04 tag mentions (not just AUTH-related ones) — several napplets carried `Per CONTEXT D-04:` as a historical section label for unrelated behavior (theme-switcher button click, toaster notify flow); rewritten as 'Behavior:' to match plan's literal grep acceptance (`grep -rn 'D-04' ... returns 0`)"
  - "Extended comment-scrub to file-header JSDocs that Task 1 did not explicitly enumerate — composer line 7 ('authenticated' (D-04) status flow), composer line 102 (my own new comment referenced 'AUTH probe'), profile-viewer line 12, chat line 10 — all surfaced during Task 2 Step 4 residual sweep and handled with targeted Edits"
  - "Error-message in toaster init().catch rewritten from 'auth/storage failure' → 'init failure' — the probe was removed, 'storage' no longer triggers the error path; 'init failure' is accurate"

patterns-established:
  - "Vestigial-probe deletion discipline — grep for the specific probe key pattern (`<slug>-auth-probe`), locate each call site, collapse the surrounding try/catch when the probe was its sole wrapped statement, drop the import if it was the last consumer. Comment prose scrub runs as a separate task (one commit for behavior delete, one commit for prose cleanup) so git history cleanly separates 'removed dead code' from 'documentation sweep'."
  - "Comment-only task guard — run `pnpm build` + `pnpm type-check` after comment edits even though no code changed, because targeted Edit tool applications can accidentally touch adjacent code when the BEFORE/AFTER strings are close to function boundaries. Build/type-check catches this."
  - "Residual sweep after Task 1 — when Task 1 edits JSDoc+code blocks together, Task 2's pre-flight grep across the same files surfaces residuals that Task 1's targeted BEFORE/AFTER patterns didn't cover (e.g., file-header mentions, status-flow tags). Residual sweep is a required Task 2 step, not optional."
  - "D-04 as a widespread tag — not just for AUTH-probe framing. Many napplets used `Per CONTEXT D-04:` as a historical section marker referring to original CONTEXT.md §D-04 (various behaviors per napplet). Grep-based scrubbing treats the tag literally; rewrites preserve the actual section content but drop the now-orphaned reference."

requirements-completed:
  - PERF-01

# Metrics
duration: 8min
completed: 2026-04-23
---

# Phase 36 Plan 1: PERF-01 Auth-Probe Deletion + D-04 Comment Scrub

**Deleted 7 vestigial `storage.getItem('<slug>-auth-probe')` calls across 7 demo napplets (composer/feed/hotkey-chord/media-controller/profile-viewer/theme-switcher/toaster) and scrubbed all D-04 / AUTH-probe / shim AUTH completion comment prose from 10 napplet main.ts files and 6 E2E spec files — zero new anti-feature strings introduced, build + type-check still at Phase-35-close baselines of 24/24 and 10/10.**

## Performance

- **Duration:** ~8 min (plan execution wall-clock; Task 1 commit at 15:18, Task 2 commit at 15:21)
- **Started:** 2026-04-23T15:13:48Z (first edit after baseline verification)
- **Completed:** 2026-04-23T15:21:20Z (Task 2 commit)
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 16 (10 napplets + 6 E2E specs)

## Accomplishments

- 7 `storage.getItem('<slug>-auth-probe')` calls deleted; surrounding try/catch collapsed in all 7 files (probe was sole wrapped statement)
- 7 unused `storage` imports dropped from napplets where the probe was the last consumer
- All D-04 / AUTH-probe / shim AUTH completion prose scrubbed from demo napplets (0 matches post-edit; 26 pre-edit)
- All D-04 / AUTH-probe prose scrubbed from E2E specs (0 matches post-edit; 10 pre-edit)
- Status-sentinel flip to `'authenticated'` preserved for all 7 edited napplets — `setStatus('authenticated', 'green')` fires as first statement of init body in each
- Build + type-check unchanged at Phase 35 close baselines (24/24 + 10/10 FULL TURBO)
- Zero test modifications beyond comment-only scrubs; E2E regression anchor `demo-concurrent-boot.spec.ts` UNCHANGED

## Task Commits

1. **Task 1: Delete 7 auth-probe calls + collapse surrounding scaffolding (7 napplets)** — `c45e4e1` (feat)
2. **Task 2: Scrub D-04 / shim-AUTH comment prose across 10 napplets + 6 E2E specs** — `ce1c005` (docs)

**Plan metadata:** (to be added after SUMMARY commit)

## Files Created/Modified

### Napplets (Task 1 — probe delete + import cleanup)

- `apps/demo/napplets/composer/src/main.ts` — probe deleted; try/catch collapsed; `storage` import removed (unused post-edit); D-04 comment block replaced with short init description
- `apps/demo/napplets/feed/src/main.ts` — probe deleted; try/catch collapsed; `storage` import removed; D-04 inline comment replaced
- `apps/demo/napplets/hotkey-chord/src/main.ts` — probe deleted; try/catch collapsed; `storage` import removed; file-header JSDoc D-04 mention rewritten
- `apps/demo/napplets/media-controller/src/main.ts` — probe deleted; try/catch collapsed; `storage` import line removed entirely; file-header JSDoc D-04 mention rewritten
- `apps/demo/napplets/profile-viewer/src/main.ts` — single-line probe try/catch deleted; `storage` import removed; Step A + file-header D-04 mentions rewritten
- `apps/demo/napplets/theme-switcher/src/main.ts` — probe deleted; try/catch collapsed; section-header `── Init (D-04 AUTH probe) ──` + JSDoc block rewritten; `storage` import line removed entirely
- `apps/demo/napplets/toaster/src/main.ts` — probe deleted; try/catch collapsed; file-header JSDoc mention rewritten; `storage` import line removed entirely; error label `auth/storage failure` → `init failure`

### Napplets (Task 2 — comment-only scrub; storage loads preserved)

- `apps/demo/napplets/bot/src/main.ts` — 3 edits (file-header D-04 mention, init pre-await comment, `AUTH complete` log label); `loadRules()` storage call preserved
- `apps/demo/napplets/chat/src/main.ts` — 3 edits (file-header D-04 mention, SDK Init banner, init comment, `AUTH complete` log label); `loadHistory()` storage call preserved
- `apps/demo/napplets/preferences/src/main.ts` — 4 edits (file-header D-01 line, loadPreferences pre-try comment, init one-liner, catch comment); both `loadPreferences` storage.getItem calls preserved

### E2E specs (Task 2 — comment-only scrub)

- `tests/e2e/identity-flow.spec.ts` — 1 edit (AUTH probe wait comment)
- `tests/e2e/napplet-auth.spec.ts` — 1 edit (file-header D-04 mention → "shim AUTHENTICATED bootstrap")
- `tests/e2e/media-controller.spec.ts` — 2 edits (JSDoc Step 1 + inline init pattern comment)
- `tests/e2e/hotkey-chord.spec.ts` — 2 edits (JSDoc Step 1 + inline init pattern comment)
- `tests/e2e/relay-subscribe.spec.ts` — 1 edit (Step 1 AUTH probe wait comment)
- `tests/e2e/nub-theme.spec.ts` — 3 edits (file-header line 7 + file-header line 16 + inline line 37)

## Verification Evidence

### Grep counts (pre vs post)

| Pattern | File tree | Pre-edit | Post-edit |
|---------|-----------|----------|-----------|
| `auth-probe` | `apps/demo/napplets/` | 7 | 0 |
| `auth-probe` | `tests/e2e/` | 0 | 0 |
| `D-04` | `apps/demo/napplets/` | 20 | 0 |
| `AUTH probe` | `apps/demo/napplets/` | 3 | 0 |
| `shim AUTH completion` / `gates on AUTH` | `apps/demo/napplets/` | 5 | 0 |
| `D-04` / `AUTH probe` | `tests/e2e/` | 10 | 0 |

### Per-napplet edit classification

| Napplet | Probe deleted? | Import dropped? | Reason |
|---------|---------------|-----------------|--------|
| composer | Yes | Yes | Probe was sole `storage.*` consumer |
| feed | Yes | Yes | Probe was sole `storage.*` consumer |
| hotkey-chord | Yes | Yes | Probe was sole `storage.*` consumer |
| media-controller | Yes | Yes | Probe was sole `storage.*` consumer |
| profile-viewer | Yes | Yes | Probe was sole `storage.*` consumer |
| theme-switcher | Yes | Yes | Probe was sole `storage.*` consumer |
| toaster | Yes | Yes | Probe was sole `storage.*` consumer (docs-only mention remains in JSDoc) |
| bot | No (real load) | No | `loadRules()` uses `storage.getItem(RULES_KEY)` + `storage.setItem` |
| chat | No (real load) | No | `loadHistory()` / `saveToHistory()` use `storage.getItem(HISTORY_KEY)` + `storage.setItem` |
| preferences | No (real load) | No | `loadPreferences()` + `savePreferences()` use 2 + 2 storage calls (display-name + theme-preference) |

### Storage.getItem demo-wide count

- **Pre-fix:** plan claim = 28; actual was lower but not re-counted pre-edit
- **Post-fix:** 8 total across 10 napplets — bot=1, chat=2, preferences=5, all others=0
- **Interpretation:** the plan's "28" figure conflated `storage.*` (20 pre-fix when counting all storage mentions) with `storage.getItem` (~15 pre-fix). The -7 delta on `storage.getItem` is directly attributable to the 7 deleted probes. The remaining 8 calls are all load-bearing real data reads in the 3 data-load napplets. Plan's success-criterion threshold `<= 22` comfortably satisfied.

### Build + type-check

- `pnpm build` → `Tasks: 24 successful, 24 total` (Phase 35 close baseline preserved; 16 cached on second run, Full Turbo)
- `pnpm type-check` → `Tasks: 10 successful, 10 total` (Phase 35 close baseline preserved; Full Turbo)

### setStatus preservation

All 7 edited napplets still contain `setStatus('authenticated', 'green')` (or `setStatus('authenticated',` variant) — verified via grep at post-edit:

| Napplet | Occurrences of `setStatus('authenticated'` |
|---------|---------------------------------------------|
| composer | 1 |
| feed | 1 |
| hotkey-chord | 1 |
| media-controller | 1 |
| profile-viewer | 1 |
| theme-switcher | 1 |
| toaster | 1 |

Bot + chat use direct `statusEl.textContent = 'authenticated'` assignment instead of `setStatus`; both preserved. Preferences uses `setStatus('loaded', 'green')` inside `loadPreferences()` — not touched by scope.

## Decisions Made

See frontmatter `key-decisions`. Summary:

1. **Collapsed try/catch entirely** (per CONTEXT.md Claude's Discretion) — the probe was the sole wrapped statement in every file; the fallthrough `setStatus` now fires as init body's first statement. No timing regression expected (shim AUTHENTICATED already fires from bootstrap, not probe resolution).
2. **Dropped unused storage imports** from 7 napplets — probe was the last `storage.*` consumer in each; keeping the import triggers tsup unused-import noise.
3. **Scrubbed ALL D-04 tag mentions** — plan's grep acceptance is literal. Several napplets carried `Per CONTEXT D-04:` as a historical section marker referring to the original CONTEXT.md §D-04 for various different behaviors (theme-switcher button click, toaster notify flow, composer status transitions). Rewrote each as `Behavior:` / dropped the parenthetical tag, preserving the actual section content.
4. **Extended scrub scope to file-header JSDocs** — Task 1's targeted Edit patterns only covered the init-function region. Task 2's residual sweep surfaced 5 additional file-header mentions (composer line 7, composer line 102 I introduced in Task 1, profile-viewer line 12 I introduced in Task 1, chat line 10, theme-switcher line 4, toaster line 4). All handled with targeted Edits.
5. **Error-message rewrite in toaster** — `auth/storage failure` → `init failure`. The probe was removed; 'storage' no longer triggers the error path; 'init failure' is accurate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Auto-add missing critical functionality] Extended scrub to unplanned residuals**

- **Found during:** Task 2 Step 4 (residual-sweep grep across Task-1-edited napplets)
- **Issue:** Task 1's targeted Edits only covered the init-function region of each napplet. Pre-Task-2 grep surfaced 5 additional `D-04` / `AUTH probe` mentions in file-header JSDocs + one in composer's new comment I had just written in Task 1 Step 2: (a) composer line 7 `'authenticated' (D-04)` status flow, (b) composer line 102 `No AUTH probe needed` in my new comment, (c) profile-viewer line 12 `no AUTH probe` in my new comment, (d) chat line 10 `(D-04)`, (e) theme-switcher line 4 `Per CONTEXT D-04:`, (f) toaster line 4 `Per CONTEXT D-04:`. Plan's success criteria require `grep -rn 'D-04' ... == 0`, so all residuals had to go.
- **Fix:** 6 targeted Edits scrubbing each residual while preserving the actual section content (Behavior: / init summary phrases).
- **Files modified:** composer/src/main.ts (2 spots), profile-viewer/src/main.ts, chat/src/main.ts, theme-switcher/src/main.ts, toaster/src/main.ts
- **Verification:** Post-edit grep `grep -rn 'D-04\|auth-probe\|AUTH probe' apps/demo/napplets/ tests/e2e/` returns 0
- **Committed in:** `ce1c005` (Task 2 commit, included in the comment-scrub batch)

---

**Total deviations:** 1 auto-fixed (Rule 2 — extended scope to cover residuals surfaced by Task 2's mandatory residual-sweep step)
**Impact on plan:** Scope-aligned, not scope-expanded. Plan Step 4 of Task 2 explicitly says "run the grep again across the 7 napplets Task 1 already edited to catch any stale mentions" — the deviation is executing the plan's own instruction. No new files touched beyond the 10 napplets + 6 E2E specs enumerated in `<files>`.

## Issues Encountered

None. Both commits landed without pre-commit hook failures; build + type-check ran clean on first invocation post-edit.

## User Setup Required

None — no external service configuration; comment-only + dead-code-delete changes.

## Next Phase Readiness

**Plan 36-02 (milestone close E2E-18) is unblocked.** Required pre-conditions:

- Code delete landed — `grep -rn 'auth-probe' apps/demo/napplets/` returns 0
- Comment scrub landed — `grep -rn 'D-04\|AUTH probe' apps/demo/napplets/ tests/e2e/` returns 0
- Build + type-check baselines preserved — 24/24 + 10/10 — Plan 36-02's iteration loop (`pnpm install && pnpm build && pnpm test:e2e`) should produce identical build output to Phase 35 close
- Regression anchor (`tests/e2e/demo-concurrent-boot.spec.ts`) UNCHANGED — the AUTHENTICATED-for-all-10-napplets within-10s assertion will validate that the probe removal didn't silently break any init path
- E2E baseline expectation: 54 passed / 0 failed / 0 skipped (unchanged from Phase 35 close; no new specs added, no specs removed)

**v1.6 milestone progress:** 18/21 → 19/21 reqs closed (PERF-01 lands here); remaining = E2E-18 (Plan 36-02).

## Self-Check: PASSED

All claimed files exist and contain the expected changes:

- [x] `apps/demo/napplets/composer/src/main.ts` — exists, contains `setStatus('authenticated'`, no `auth-probe`, no `D-04`
- [x] `apps/demo/napplets/feed/src/main.ts` — exists, contains `setStatus('authenticated'`, no `auth-probe`, no `D-04`
- [x] `apps/demo/napplets/hotkey-chord/src/main.ts` — exists, contains `setStatus('authenticated'`, no `auth-probe`, no `D-04`
- [x] `apps/demo/napplets/media-controller/src/main.ts` — exists, contains `setStatus('authenticated'`, no `auth-probe`, no `D-04`
- [x] `apps/demo/napplets/profile-viewer/src/main.ts` — exists, contains `setStatus('authenticated'`, no `auth-probe`, no `D-04`
- [x] `apps/demo/napplets/theme-switcher/src/main.ts` — exists, contains `setStatus('authenticated'`, no `auth-probe`, no `D-04`
- [x] `apps/demo/napplets/toaster/src/main.ts` — exists, contains `setStatus('authenticated'`, no `auth-probe`, no `D-04`
- [x] `apps/demo/napplets/bot/src/main.ts` — exists, `loadRules` present, no `D-04`
- [x] `apps/demo/napplets/chat/src/main.ts` — exists, `loadHistory` present, no `D-04`
- [x] `apps/demo/napplets/preferences/src/main.ts` — exists, `loadPreferences` present, no `D-04`
- [x] 6 E2E spec files edited — no `D-04` / `AUTH probe` residuals
- [x] Task 1 commit `c45e4e1` present in `git log`
- [x] Task 2 commit `ce1c005` present in `git log`
- [x] Build passes 24/24, type-check passes 10/10

---
*Phase: 36-perf-01-milestone-close*
*Completed: 2026-04-23*
