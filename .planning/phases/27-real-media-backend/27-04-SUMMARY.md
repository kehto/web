---
phase: 27-real-media-backend
plan: 04
subsystem: testing
tags: [playwright, e2e, media-controller, navigator.mediaSession, dual-path-assertion, iteration-log, E2E-13]

requires:
  - phase: 27-real-media-backend
    plan: 03
    provides: media-controller napplet + __grantMediaControl__ hook + STUB_ONLY_SERVICES=[]
  - phase: 26-real-keys-backend
    plan: 04
    provides: hotkey-chord.spec.ts structural template + 26-ITERATION-LOG.md format

provides:
  - tests/e2e/media-controller.spec.ts — Layer-B E2E spec with DUAL-PATH assertion (DOM sentinel + navigator.mediaSession via page.evaluate)
  - tests/e2e/demo-boot.spec.ts cascaded stub-badge assertion update (STUB_ONLY_SERVICES=[])
  - .planning/phases/27-real-media-backend/27-ITERATION-LOG.md — fresh-build iteration loop evidence (49 passed, +1 delta from Phase 26 baseline of 48)

affects:
  - 28 (Phase 28 Layer-A upgrade — E2E-14 nub-keys.spec.ts + nub-media.spec.ts; iteration loop baseline now 49)

tech-stack:
  added: []
  patterns:
    - DUAL-PATH E2E assertion (DOM sentinel + browser API read via page.evaluate) for navigator.mediaSession verification
    - page.bringToFront() before iframe button clicks — prevents Chromium background-tab JS throttling under parallel Playwright workers
    - Status-sentinel wait ('session-ready') as canonical substitute for waitForNappletReady on :4174 demo (Phase 26 precedent confirmed)
    - Cascaded topology-change test update (demo-boot.spec.ts) in same phase that changed the topology

key-files:
  created:
    - tests/e2e/media-controller.spec.ts
    - .planning/phases/27-real-media-backend/27-ITERATION-LOG.md
  modified:
    - tests/e2e/demo-boot.spec.ts

key-decisions:
  - "page.bringToFront() before each frameLocator button click prevents Chromium background-tab JS throttling — required because media-controller is the only spec that clicks inside a sandboxed iframe (hotkey-chord dispatches keyboard events to the top-level page; background throttling only affects iframe onclick in background tabs)"
  - "DUAL-PATH assertion (DOM + navigator.mediaSession page.evaluate) is the E2E-13-specific structural deviation from E2E-12 (DOM-only); reads from the TOP-LEVEL page since Plan 27-01's createBrowserMediaBridge writes navigator.mediaSession on the shell window, not the iframe"
  - "Status-sentinel wait (toContainText('session-ready')) is the canonical napplet-ready substitute for :4174 demo — documented in spec docblock + iteration log per Phase 26-04 precedent"
  - "demo-boot.spec.ts cascaded update (stub-badge count 1→0) committed before the fresh-build run — unlike Phase 26's Iteration 1 regression, no iteration-1 demo-boot failure occurred"

requirements-completed:
  - E2E-13

duration: 7min
completed: 2026-04-19
---

# Phase 27 Plan 04: E2E-13 Layer-B Spec + Iteration Log Summary

**Layer-B media-controller.spec.ts with DUAL-PATH assertion (DOM sentinel + navigator.mediaSession.playbackState + metadata.title via page.evaluate), plus cascaded demo-boot.spec.ts fix and 49-test fresh-build iteration loop closing Phase 27**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-19T17:38:17Z
- **Completed:** 2026-04-19T17:45:14Z
- **Tasks:** 3 (+ 1 Rule 1 auto-fix)
- **Files created:** 2 (media-controller.spec.ts, 27-ITERATION-LOG.md)
- **Files modified:** 1 (demo-boot.spec.ts)

## Accomplishments

- Wrote `tests/e2e/media-controller.spec.ts` — the Layer-B E2E-13 contract spec proving the Phase 27 real media backend end-to-end: `demoBeforeEach` → 'session-ready' sentinel wait → `__grantMediaControl__()` hook → Play click → DOM 'playing' + `navigator.mediaSession.playbackState === 'playing'` + `metadata.title === 'Kehto Demo Track'` → Pause click → DOM 'paused' + `playbackState === 'paused'`; ANTI_TERM_RE hygiene; serial mode; ROADMAP §4 deviation documented
- Updated `tests/e2e/demo-boot.spec.ts` — cascaded stub-badge assertion update: all three assertions now assert `toHaveCount(0)` (keys=0, media=0, .stub-badge=0); docblock reflects both Phase 26 + Phase 27 graduated to real-backend; Plan 26-04 cascaded-topology-update precedent
- Recorded fresh-build iteration loop in `27-ITERATION-LOG.md` — 22/22 tasks build (0 cache hits); 49 passed / 0 failed / 0 skipped on iteration 2; baseline 48 (Phase 26 close) + 1 (media-controller.spec.ts) = 49 total (+1 delta); anti-term grep clean; dual-path + capability-gate + ROADMAP §4 deviation decisions recorded; Phase 27 closed

## Task Commits

1. **Task 1: Write tests/e2e/media-controller.spec.ts** — `13276ea` (test)
2. **Task 1 fix: bringToFront background-tab throttling** — `a652ec5` (fix — Rule 1 auto-fix)
3. **Task 2: Update tests/e2e/demo-boot.spec.ts** — `9203999` (fix)
4. **Task 3: Fresh-build iteration loop + 27-ITERATION-LOG.md** — `4efdc9e` (chore)

## Files Created/Modified

- `tests/e2e/media-controller.spec.ts` — Layer-B E2E-13 spec: demoBeforeEach + status-sentinel wait + __grantMediaControl__ hook + Play/Pause DOM clicks with page.bringToFront() + navigator.mediaSession.playbackState + metadata.title reads via page.evaluate + ANTI_TERM_RE hygiene
- `tests/e2e/demo-boot.spec.ts` — Cascaded stub-badge assertions: media stub count 1→0, .stub-badge count 1→0; docblock reflects STUB_ONLY_SERVICES=[] (both keys Phase 26 + media Phase 27 graduated)
- `.planning/phases/27-real-media-backend/27-ITERATION-LOG.md` — Full iteration log per v1.4 canon: build/test evidence, iteration history (2 iterations), anti-term grep, new-spec isolated run, dual-path and capability-gate decisions, Phase 27 closing notes

## Decisions Made

- `page.bringToFront()` is required before iframe button clicks when tests run in parallel — Chromium throttles JS in background tabs, causing onclick handlers to not fire within the 5s assertion window. Hotkey-chord avoids this because it dispatches keyboard events to the top-level page; media-controller requires iframe clicks.
- Reads of `navigator.mediaSession.playbackState` and `metadata.title` use `page.evaluate` (top-level context) because Plan 27-01's `createBrowserMediaBridge` writes to the shell's singleton `navigator.mediaSession`, not the iframe's.
- `expect.poll()` wraps the `navigator.mediaSession.playbackState` read to absorb async propagation lag between `mediaReportState` postMessage dispatch and `bridge.setPlaybackState` execution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added page.bringToFront() before iframe button clicks**
- **Found during:** Task 1 verification — full-suite `pnpm test:e2e` run (iteration 1)
- **Issue:** `frameLocator('#media-controller-frame-container iframe').locator('#media-controller-play').click()` resulted in the iframe status staying 'session-ready' in the full-suite parallel run (8 workers). Chromium background-tab JS throttling suppressed the iframe's onclick handler execution. Isolated single-worker run passed consistently.
- **Fix:** Added `await page.bringToFront()` before each button click (Play and Pause) to ensure the browser tab is active and not throttled.
- **Files modified:** `tests/e2e/media-controller.spec.ts`
- **Verification:** Full-suite `pnpm test:e2e` passes 49/0/0 across two consecutive runs after the fix.
- **Committed in:** `a652ec5` (separate fix commit following Task 1 commit `13276ea`)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** Essential for reliable parallel test execution. No scope creep. The background-tab throttling issue is a Chromium/Playwright parallel-worker interaction specific to iframe button clicks; keyboard events to the top-level page are unaffected (hotkey-chord.spec.ts has no such issue).

## Issues Encountered

The background-tab throttling failure appeared only in full-suite parallel runs (8 workers) and not in isolated single-spec runs. This made it initially appear as a flaky test, but two consecutive full-suite failures confirmed the pattern was systematic. Root cause: sandboxed iframes in non-focused Chromium tabs have their JS event loop throttled. `page.bringToFront()` is the canonical fix.

## Known Stubs

None. The spec drives real behavior end-to-end. No placeholder values, no mock data paths in the E2E layer.

## Next Phase Readiness

- Phase 27 is complete: all four requirements (MEDIA-01, MEDIA-02, MEDIA-03, E2E-13) satisfied. STUB_ONLY_SERVICES = [].
- Phase 28 (Layer-A Upgrade & Docs Polish) starts from a 49-test baseline. E2E-14 upgrades `nub-keys.spec.ts` + `nub-media.spec.ts` from stub-scope to full Layer-A coverage — no new spec count delta, only coverage-depth delta.
- The `page.bringToFront()` pattern is now established for any future spec that clicks buttons inside sandboxed iframes in the demo.

## Self-Check

- `tests/e2e/media-controller.spec.ts` — FOUND
- `tests/e2e/demo-boot.spec.ts` (modified) — FOUND
- `.planning/phases/27-real-media-backend/27-ITERATION-LOG.md` — FOUND
- Commit `13276ea` — Task 1 (test: media-controller spec initial)
- Commit `a652ec5` — Task 1 Rule 1 fix (bringToFront)
- Commit `9203999` — Task 2 (fix: demo-boot cascaded update)
- Commit `4efdc9e` — Task 3 (chore: iteration log)

## Self-Check: PASSED
