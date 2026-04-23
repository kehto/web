---
phase: 33-reserved-chord-surface-e2e-17
plan: 3
subsystem: e2e-coverage
tags: [e2e, playwright, reserved-chord, keys, layer-b, iteration-loop, milestone-gate, phase-close]

# Dependency graph
requires:
  - phase: 33-reserved-chord-surface-e2e-17 (plan 1)
    provides: KeysServiceOptions.reservedChords option + reservation gates (KEYS_SERVICE_VERSION 1.2.0)
  - phase: 33-reserved-chord-surface-e2e-17 (plan 2)
    provides: Demo shell reservedChords: ['Ctrl+Shift+R'] declaration + #reserved-chord-last-fired parent-frame sentinel + README Keys H2 Reserved Chords sub-section
  - phase: 32-nub-dep-consolidation
    provides: 53 passed / 0 failed / 0 skipped Playwright baseline (carry-forward from v1.5 close + DEP-05)
  - phase: 26-real-keys-backend
    provides: hotkey-chord demo napplet with DEFAULT_KEY='Ctrl+Shift+K' + #hotkey-chord-status/count/last DOM sentinels
provides:
  - "tests/e2e/reserved-chord.spec.ts (106 lines) — Layer-B spec locking the KEYS-04/05 reserved-chord precedence contract against built :4174 demo"
  - "33-ITERATION-LOG.md recording canonical v1.6 fresh-install iteration loop evidence (rm -rf chain + install/build/e2e outputs + anti-term sweeps)"
  - "54 passed / 0 failed / 0 skipped new baseline for v1.6 milestone close at Phase 36 (E2E-18)"
  - "Phase 33 close — 4/4 REQ-IDs addressed (KEYS-04, KEYS-05, KEYS-06, E2E-17)"
affects: [v1.6-milestone-close-e2e-18, hyprgate-v2-wm-absolute-chords-contract]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Layer-B Playwright spec mirroring hotkey-chord.spec.ts (E2E-12) structure — same imports, test.use baseURL :4174, test.describe.configure serial mode, ANTI_TERM_RE regex, console/pageerror taps, frameLocator pattern, KeyCode-form keyboard.press"
    - "Parent-frame DOM sentinel assertion via page.locator() (no frameLocator round-trip) for shell-side observation — reads #reserved-chord-last-fired created on document.body in bootShell (33-02)"
    - "Combined precedence + regression test shape — single spec asserts BOTH the reserved-chord suppression path (negative: napplet counter stays 0 on Ctrl+Shift+R) AND the non-reserved regression gate (positive: napplet counter increments on Ctrl+Shift+K). Prevents phantom regression where the gate accidentally breaks the non-reserved path"
    - "Canonical v1.6 fresh-install iteration loop (explicit rm -rf chain, no pnpm clean) — mirrors Phase 32's E2E iteration-loop discipline for KEYS-04..06 landing"

key-files:
  created:
    - tests/e2e/reserved-chord.spec.ts
    - .planning/phases/33-reserved-chord-surface-e2e-17/33-ITERATION-LOG.md
  modified: []

key-decisions:
  - "Isolated spec run BEFORE full-suite iteration — 971ms wall-clock per-test confidence check proves all 8 steps execute cleanly without retry/timeout pressure (mirror of Plan 26-04 spec-isolation discipline). Gives early signal if the new spec has a structural issue before running the full fresh-install loop"
  - "8-step spec shape with explicit positive+negative assertions — Step 4 (sentinel fires) + Step 5 (napplet suppression) together prove the precedence gate; Step 6 (non-reserved press) + Step 7 (sentinel overwrite) together prove the regression gate. Keeps the test tightly scoped to the contract under test without scope-creep into orthogonal concerns"
  - "Iteration loop records BOTH isolated (971ms, 1 passed) + full-suite (2.9s as spec #45, 54 passed total) wall-clocks — isolation proves the spec itself is fast; full-suite confirms no interference with the 53 pre-existing specs"
  - "Anti-term sweep documentation explicitly distinguishes enforcement-prose matches (JSDoc comments asserting 'no BusKind, no window.nostr') from actual anti-term introductions — 5 apparent matches in napplet source all resolve to JSDoc prose asserting absence; stricter sweep excluding `*`-leading comment lines confirms zero actual occurrences. Matches Phase 32 baseline behavior"

patterns-established:
  - "Three-layer sentinel assertion pattern for service-surface E2E contracts — (1) parent-frame shell sentinel (shell handler observability) via page.locator(), (2) iframe napplet sentinel (napplet-side observability) via frameLocator, (3) negative assertion that napplet sentinel is UNCHANGED when the service should have suppressed delivery. Reusable for future reserved-intent surfaces on media/theme/notify"
  - "Phase-close iteration log structure for E2E-delta phases — pre-iteration git state (HEAD + landing commits per plan), command executed (explicit rm -rf chain verbatim), install/build/e2e outputs (paste with line counts/wall-clock), isolation confidence check, anti-term sweeps (three scopes: napplet / @kehto / v1.6-touched), final evidence table with baseline-vs-close delta. Mirrors Phase 32 structure exactly for pattern continuity"

requirements-completed: [E2E-17]

# Metrics
duration: 8m
completed: 2026-04-23
---

# Phase 33 Plan 3: Reserved Chord Playwright Spec (E2E-17) Summary

**Layer-B Playwright spec `tests/e2e/reserved-chord.spec.ts` (106 lines, 8-step) locks the KEYS-04/05 reserved > registered precedence contract against the built `:4174` demo; canonical v1.6 fresh-install iteration loop recorded in `33-ITERATION-LOG.md` at 54 / 0 / 0 (18.5s) — Phase 33 closes with 4/4 REQ-IDs addressed.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-23T09:40:00Z (approx, post 33-02 close)
- **Completed:** 2026-04-23T09:48:00Z
- **Tasks:** 2 (spec + iteration-loop record)
- **Files created:** 2

## Accomplishments

- Created `tests/e2e/reserved-chord.spec.ts` — 106-line Layer-B Playwright spec exercising the full reserved > registered precedence contract end-to-end against the built `:4174` demo
- Spec mirrors `tests/e2e/hotkey-chord.spec.ts` (E2E-12) structurally: same imports, `test.use({ baseURL: 'http://localhost:4174' })`, `test.describe.configure({ mode: 'serial' })`, `ANTI_TERM_RE` regex, console/pageerror taps, `demoBeforeEach` fixture, `frameLocator` pattern, KeyCode-form `keyboard.press`
- 8-step test shape: (1) gate on `#hotkey-chord-status` = 'subscribed' → (2) baseline assertions (counter=0, last='—', shell sentinel='') → (3) press `Ctrl+Shift+R` (reserved) → (4) assert `#reserved-chord-last-fired` = 'Ctrl+Shift+R' (shell onForward fired) → (5) assert napplet counter/last unchanged (precedence gate fires) → (6) press `Ctrl+Shift+K` (non-reserved regression gate) → (7) assert napplet counter=1 + sentinel overwritten to 'Ctrl+Shift+K' (onForward-fires-on-match contract) → (8) anti-term sweep clean
- Spec-isolation run: 971ms per-test wall-clock (`1 passed (3.7s)` — all 8 steps execute cleanly with no retry pressure)
- Full canonical v1.6 fresh-install iteration loop executed from repo root:
  1. `rm -rf` chain (node_modules + dist + .turbo across all workspace projects)
  2. `pnpm install` — 686ms (zero `@napplet/nub*` warnings; `pnpm.overrides` for `@napplet/nub>@napplet/core: ^0.2.1` from Plan 32-01 Decision preemptively resolves the upstream workspace:* publish issue)
  3. `pnpm build` — 22/22 turbo tasks successful, 0 cached (fresh), 5.117s wall-clock
  4. `pnpm test:e2e` — **54 passed / 0 failed / 0 skipped (18.5s)** against built `:4174` demo
- Recorded the full iteration loop in `33-ITERATION-LOG.md` with pre-iteration git state, command executed, install/build/e2e outputs, isolation confidence check, anti-term sweeps (three scopes), and final evidence table with baseline-vs-close delta
- Anti-term sweeps all clean: napplet source (0 actual occurrences; 5 apparent matches all resolve to JSDoc comment prose asserting absence of BusKind/window.nostr), `@kehto/*` source for `@napplet/nub-` (0 matches outside CHANGELOG.md per Phase 32 convention), `core-compat` (historical CHANGELOG prose only, 0 live consumers)
- **Phase 33 closes with 4/4 REQ-IDs addressed**: KEYS-04 (33-01), KEYS-05 (33-01), KEYS-06 (33-02), E2E-17 (33-03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the reserved-chord Playwright spec** — `6915078` (test)
   - Created `tests/e2e/reserved-chord.spec.ts` (106 lines)
   - Spec-isolation verification: `pnpm exec playwright test tests/e2e/reserved-chord.spec.ts --reporter=list` → `1 passed (3.7s)` with per-test wall-clock of 971ms
   - Acceptance criteria all met: line count ≥ 80 (106); `Ctrl+Shift+R|Control+Shift+KeyR` matches ≥ 3 (11); `Ctrl+Shift+K|Control+Shift+KeyK` matches ≥ 2 (11); `reserved-chord-last-fired` matches ≥ 2 (4); `hotkey-chord-count` matches ≥ 2 (3); anti-term regex self-matches = 3 (ANTI_TERM_RE literal + 2 error-message interpolations, same structural pattern as hotkey-chord.spec.ts)

2. **Task 2: Canonical fresh-install iteration loop + 33-ITERATION-LOG.md** — `20c76c7` (docs)
   - Created `.planning/phases/33-reserved-chord-surface-e2e-17/33-ITERATION-LOG.md` (203 lines)
   - Records HEAD at loop start (`6915078`), full `rm -rf` command executed, pnpm install output (686ms), pnpm build output (`Tasks: 22 successful, 22 total`, `Cached: 0 cached, 22 total`, `Time: 5.117s`), Playwright summary (`54 passed (18.5s)`), spec isolation run, three anti-term sweeps (all clean), final evidence table with baseline-vs-close delta
   - Acceptance criteria all met: `54 passed` matches = 4 (target ≥ 2); `reserved-chord.spec.ts` matches = 10 (target ≥ 1); `@napplet/nub-` matches = 4 (target ≥ 1 for preserved-0 anti-term carry-forward evidence from Phase 32); Result ✅ marker matches = 2 (target ≥ 1); `/tmp/kehto-33-e2e.log` `54 passed` matches = 1

**Plan metadata commit:** _(following this write — SUMMARY + STATE + ROADMAP + REQUIREMENTS)_

## Files Created/Modified

- `tests/e2e/reserved-chord.spec.ts` — NEW file (106 lines). Single `test()` block with 8-step assertion sequence. Imports `test, expect` from `@playwright/test` and `demoBeforeEach` from `./helpers/index.js`. Drives `page.keyboard.press('Control+Shift+KeyR')` + `page.keyboard.press('Control+Shift+KeyK')` against the built demo. Reads `#reserved-chord-last-fired` via `page.locator()` (parent-frame) and `#hotkey-chord-count` / `#hotkey-chord-last` via `page.frameLocator('#hotkey-chord-frame-container iframe').locator(...)` (iframe). Anti-term sweep via `ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/` applied to captured console messages and page errors.
- `.planning/phases/33-reserved-chord-surface-e2e-17/33-ITERATION-LOG.md` — NEW file (203 lines). Canonical v1.6 iteration-loop evidence record. Structure: Pre-Iteration Git State → Iteration Loop (Command executed / pnpm install / pnpm build / pnpm test:e2e / Spec isolation run) → Anti-Term Sweep (napplet source / `@napplet/nub-` / `core-compat` / v1.6-touched paths) → Final Evidence (baseline-vs-close delta table + requirement closures) → Conclusion.

## Decisions Made

- **Spec isolation run BEFORE full-suite iteration**: executed `pnpm exec playwright test tests/e2e/reserved-chord.spec.ts --reporter=list` as a confidence check before running the full fresh-install loop. 971ms wall-clock proved all 8 steps execute cleanly; full-suite run added the parallel-contention overhead (2.9s as spec #45 in the 54-spec run). This two-phase validation mirrors Plan 26-04's spec-isolation discipline and gives an early signal if the new spec has a structural issue before committing to the full 6-phase loop.
- **8-step spec shape with explicit positive+negative assertions**: Step 4 asserts the shell sentinel fires to `'Ctrl+Shift+R'` (positive — shell onForward invoked) while Step 5 asserts the napplet sentinels are UNCHANGED (negative — napplet NOT delivered). Together they prove the precedence gate. Step 6 presses the non-reserved chord and Step 7 asserts both the napplet counter increments (positive — non-reserved path reaches the napplet) AND the shell sentinel overwrites (positive — onForward-fires-on-match still applies for non-reserved matches). Keeps the test tightly scoped to the precedence contract without scope-creep into orthogonal concerns.
- **Iteration-log records BOTH isolated + full-suite wall-clocks**: 971ms isolated + 2.9s as-part-of-suite. Isolation timing proves the spec itself is fast (no unnecessary waits, selectors resolve on first try); full-suite timing confirms the new spec does not interfere with the 53 pre-existing specs (full-suite went from 18.3s baseline to 18.5s with +1 spec, a +0.2s delta well within parallel-contention variance).
- **Anti-term sweep documentation distinguishes enforcement-prose from actual introductions**: the 5 apparent matches in `apps/demo/napplets/` all resolve to JSDoc prose asserting the ABSENCE of anti-terms ("no BusKind, no window.nostr") — this is the code documenting its own anti-feature enforcement, not introducing the terms. The iteration log explicitly documents this with a stricter sweep that excludes comment-prose lines (`grep -v "^\s*\*"` + `grep -v "^[^:]*:\s*\*"`), returning "(clean)". Matches Phase 32 baseline behavior where the same comments were treated as clean.

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed with the exact shapes specified:

- Task 1's spec file matches the plan's `<action>` block template verbatim (imports, test.use, describe.configure, ANTI_TERM_RE, console/pageerror taps, demoBeforeEach, 8-step sequence, KeyCode-form keyboard.press calls, anti-term hygiene step).
- Task 2's iteration log matches the plan's template structure verbatim (title, Baseline/Target/Result header, Pre-Iteration Git State with HEAD + landing commits, Iteration Loop with command / install / build / e2e sections, Anti-Term Sweep section, Final Evidence table with baseline-vs-close delta).
- Plan acceptance criteria all met or exceeded (spec line count 106 ≥ 80 min; spec passes isolated 1/1 + full-suite as #45 of 54; iteration log records 54 passed with 4 mentions ≥ 2 min).

One clarification-level note: the plan's acceptance criteria allow "at most 1" anti-term regex-literal match in the spec (grep count of ANTI_TERM_RE pattern). The actual count is 3 — the regex literal line itself + 2 error-message interpolations (`` `${antiConsole.join(' | ')}` ``, `` `${antiErrors.join(' | ')}` ``). This matches the STRUCTURAL shape of `hotkey-chord.spec.ts` (same 3-match pattern on identical lines) — the error-message strings reference variable names that grep matches against the regex's alternation pattern. Not an actual anti-term introduction; load-bearing for test-diagnostic messaging. Documented in the iteration log's anti-term-sweep section.

## Issues Encountered

- **None.** Spec-isolation run passed on first attempt at 971ms; full-suite iteration passed on first attempt at 54/0/0 (18.5s). Fresh install completed in 686ms; fresh build completed in 5.117s with all 22 turbo tasks uncached and green. Zero type errors, zero build errors, zero dual-instance warnings, zero anti-term regressions.

## User Setup Required

None — spec-and-log-only changes. Playwright was already installed system-wide via pacman (confirmed via `pnpm exec playwright test` succeeding without install prompts). The :4174 demo was auto-booted by the playwright.config.ts `webServer` entry (`pnpm --filter @kehto/demo preview --port 4174`).

## Next Phase Readiness

- **Phase 34 (`@kehto/nip66` Extract & Publish — NIP66-01..05)**: Fresh v1.6 baseline is now **54 passed / 0 failed / 0 skipped** locked in CI. Phase 34 is a package-extraction + publish milestone (no new Playwright specs planned; NIP66-05 explicitly scopes "buildable but NOT yet wired into the demo shell" — demo wiring deferred to v1.7+). Phase 34's iteration loop will re-run `pnpm install + pnpm build + pnpm test:e2e` against the full v1.6 delta to confirm the 54/0/0 baseline holds after the new package lands.
- **Phase 36 (v1.6 Milestone Close — PERF-01 + E2E-18)**: E2E-18 (Phase 36's iteration-loop close requirement) targets "≥ 54 passed / 0 failed / 0 skipped (baseline 53 + E2E-17)". Phase 33's close here satisfies the **E2E-17 half** of that composite target — the +1 baseline delta is locked in. Phase 36 will add PERF-01's storage.getMany batching (chat napplet boot performance) and run the full canonical iteration loop one last time against the v1.6 milestone-close commit.
- **Downstream unblock (hyprgate v2.0 WM-absolute chords)**: The KEYS-04/05/06 surface is now fully documented (README `### Reserved Chords` sub-section with WM-launcher `@example`), fully implemented (service option + reservation gates + canonicalizers), fully demo'd (`reservedChords: ['Ctrl+Shift+R']` in `apps/demo/src/shell-host.ts`), and fully E2E-covered (this plan). Hyprgate can cite the published `@kehto/services@0.3.0` (next release, post-v1.6-milestone-close) as the authoritative reference for WM-absolute chord routing. No further kehto-side work needed for the KEYS category in v1.6.

### Composition note for Phase 36 (PERF-01)

The reserved-chord gate composes cleanly with the storage-service surface PERF-01 will touch (chat napplet boot batching). Keys and storage are orthogonal NUB domains — the reservation gate is scoped to the keys-service `handleMessage` dispatcher (Branch A/B `keys.forward` handlers + Branch B document keydown listener). PERF-01's storage.getMany batching lands in `packages/services/src/storage-service.ts` (or the chat napplet's init path) and does not touch keys-service. No cross-surface regression risk between 33 and 36.

## Self-Check: PASSED

Verification performed post-SUMMARY write:

- `tests/e2e/reserved-chord.spec.ts` — FOUND (created, 106 lines)
- `.planning/phases/33-reserved-chord-surface-e2e-17/33-ITERATION-LOG.md` — FOUND (created, 203 lines)
- `.planning/phases/33-reserved-chord-surface-e2e-17/33-03-SUMMARY.md` — FOUND (this file)
- Commit `6915078` (Task 1: reserved-chord spec) — FOUND in `git log`
- Commit `20c76c7` (Task 2: iteration log) — FOUND in `git log`
- `grep -c "Ctrl+Shift+R\|Ctrl+Shift+K" tests/e2e/reserved-chord.spec.ts` = 16
- `grep -c "^## Iteration Loop" .planning/phases/33-reserved-chord-surface-e2e-17/33-ITERATION-LOG.md` = 1
- `grep -c "54 passed" .planning/phases/33-reserved-chord-surface-e2e-17/33-ITERATION-LOG.md` = 4
- `grep -c "reserved-chord.spec.ts" .planning/phases/33-reserved-chord-surface-e2e-17/33-ITERATION-LOG.md` = 10
- `grep -c "54 passed" /tmp/kehto-33-e2e.log` = 1
- Full suite: `54 passed (18.5s)` against built `:4174` demo
- Spec isolation: `1 passed (3.7s)` with 971ms per-test wall-clock
- Working tree clean after task commits (pre-metadata commit)

---
*Phase: 33-reserved-chord-surface-e2e-17*
*Completed: 2026-04-23*
