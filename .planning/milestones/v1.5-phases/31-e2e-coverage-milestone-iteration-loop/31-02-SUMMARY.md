---
phase: 31-e2e-coverage-milestone-iteration-loop
plan: 02
subsystem: testing
tags: [playwright, e2e, shell-ui, acl-matrix, sequence-diagram, iteration-loop, anti-term, v1.5-milestone-gate]

# Dependency graph
requires:
  - phase: 30-shell-ui-state-wiring
    provides: live DOM element IDs and interaction paths (topology-node-service-*, topology-node-acl, debugger shadow root) that UI-01/02/03 assert against
  - plan: 31-01
    provides: E2E-15 demo-concurrent-boot spec (provides pre-31 baseline = 49 tests + 28 spec files)
provides:
  - E2E-16 Playwright spec shell-ui-state-surfaces.spec.ts locking UI-01/02/03 in CI
  - Phase 31 iteration loop evidence (31-ITERATION-LOG.md) with v1.5 milestone-gate anti-term sweep
  - v1.5 milestone ready for gsd:audit-milestone handoff
affects: [milestone-v1.5-audit, milestone-v1.5-complete]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "afterEach modal cleanup: document.getElementById('acl-policy-modal')?.remove() prevents cross-test DOM pollution"
    - "shadow-root drill pattern: page.evaluate(() => document.getElementById('debugger').shadowRoot.querySelector(...).click()) for UI-03"
    - "expect.poll().not.toHaveLength(0) to await SVG lane population before final assertion"
    - "Auth-complete polling via napplet status sentinels before opening ACL/debugger panels"

key-files:
  created:
    - tests/e2e/shell-ui-state-surfaces.spec.ts
    - .planning/phases/31-e2e-coverage-milestone-iteration-loop/31-ITERATION-LOG.md
  modified: []

key-decisions:
  - "Iterate twice: Iteration 1 hit pre-existing demo-node-inspector.spec.ts flakiness (timing race, not Phase 31 regression); Iteration 2 green 53/0/0"
  - "Spec-file delta +2 (28→30); Playwright-reported test count delta +4 (49→53) — CONTEXT.md Area 3 says document actual number not hardcoded value"
  - "Anti-term: 3 raw matches, all false-positive class 2 (signer.signEvent NIP-46 client) or class 3 (spec ANTI_TERM_RE declarations) — 0 real violations per Phase 28 precedent"
  - "UI-03 uses explicit shadow-root drill via page.evaluate (not Playwright locator piercing) per Phase 30 UAT confirmed pattern"

patterns-established:
  - "Poll auth-complete (10 napplets) via status sentinels before opening topology panels that depend on auth state"
  - "afterEach modal removal as cross-test DOM hygiene for serial describe blocks"

requirements-completed: [E2E-16]

# Metrics
duration: 5min
completed: 2026-04-19
---

# Phase 31 Plan 02: E2E-16 + v1.5 Milestone Iteration Loop Summary

**E2E-16 spec (3 tests: UI-01 service counters, UI-02 ACL matrix, UI-03 sequence lanes) + canonical fresh-build iteration loop green at 53/0/0 + v1.5 anti-term milestone-gate sweep with 0 real violations**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-19T23:54:15Z
- **Completed:** 2026-04-19T23:59:33Z
- **Tasks:** 2 of 2
- **Files modified:** 2 (1 created per task)

## Accomplishments

### Task 1: E2E-16 Spec File

- Created `tests/e2e/shell-ui-state-surfaces.spec.ts` (254 lines) with 3 tests in a serial describe block:
  - **UI-01** — polls `topology-node-service-{storage,relay,identity}` innerText for `/activity:\s*(\d+)\s*recent/i` ≥ 1 via `expect.poll` (10s timeout, 250/500/1000ms intervals)
  - **UI-02** — clicks `#topology-node-acl` → "Open Policy Matrix" button → asserts `#acl-policy-modal` visible + `tbody tr` count = 10 + no "No authenticated napplets" placeholder
  - **UI-03** — explicit shadow-root drill to click Sequence tab → polls SVG for lane header texts → asserts ≥ 4 lanes including 'Shell'
  - **afterEach** removes `#acl-policy-modal` to prevent cross-test DOM pollution (UI-02 modal leaking into UI-03 debugger)
- All 12 acceptance criteria verified; isolated run: **3 passed / 0 failed / 0 skipped (5.9s)**

### Task 2: Iteration Loop + Anti-Term Sweep

- Fresh-build clean: rm -rf dist/ + .turbo/ trees. Exit 0.
- Build cold: 22 successful, 22 total (6.32s). Unchanged from Phase 28.
- E2E full suite Iteration 1: 49 passed / 1 failed / 3 skipped — pre-existing flakiness in `demo-node-inspector.spec.ts:50` (timing race under 8-worker parallel execution, not Phase 31 regression; passes in isolation).
- E2E full suite Iteration 2: **53 passed / 0 failed / 0 skipped (22.1s)**. Canonical green.
- Spec-file count: 28 → 30 (+2). Playwright test count: 49 → 53 (+4: +1 E2E-15, +3 E2E-16).
- Anti-term sweep: 3 raw matches, 0 real violations — all classified per Phase 28 precedent.
- Skip-marker audit: 0 matches across all `tests/e2e/*.ts`.

## Task Commits

1. **Task 1: Create shell-ui-state-surfaces.spec.ts (E2E-16)** — `08b4ec6` (feat)
2. **Task 2: Write 31-ITERATION-LOG.md** — `4d17d32` (feat)

## Files Created/Modified

- `tests/e2e/shell-ui-state-surfaces.spec.ts` — E2E-16 Layer-B regression gate (UI-01/02/03); 254 lines; 3 tests in serial describe block
- `.planning/phases/31-e2e-coverage-milestone-iteration-loop/31-ITERATION-LOG.md` — Phase 31 iteration-loop evidence + v1.5 milestone-gate anti-term sweep; 193 lines

## Decisions Made

- **Iterate twice:** Iteration 1 showed pre-existing `demo-node-inspector.spec.ts:50` flakiness (inspector pane empty under parallel worker race). Iteration 2 confirmed green 53/0/0. Documented as pre-existing out-of-scope flakiness; root cause is timing-dependent serial test ordering in a non-serial describe block.
- **Test count vs file count:** Playwright reports 53 individual tests; spec-file count is 30 (delta +2). CONTEXT.md Area 3 instructs to document actual number — both recorded.
- **Anti-term classification:** 3 raw matches. Class 2: `signer.signEvent` in `main.ts:457` (NIP-46 local client, not signer-service NUB). Class 3: `ANTI_TERM_RE` declarations in both new spec files (per demo-boot.spec.ts structural template). Per Phase 28 precedent cited in 31-ITERATION-LOG.md.

## Full-Suite Iteration Loop Result

```
Running 53 tests using 8 workers
  53 passed (22.1s)
```

**53 passed / 0 failed / 0 skipped** (Iteration 2 — canonical green result).

## Anti-Term Sweep Result

| Raw matches | Real violations | Classification |
|---|---|---|
| 3 | 0 | 1× class 2 (signer.signEvent NIP-46); 2× class 3 (ANTI_TERM_RE declarations) |

## Skip-Marker Audit Result

0 matches across `tests/e2e/` — no skip markers anywhere.

## Deviations from Plan

### Pre-existing Flakiness Discovered (Out of Scope)

**[Out of scope — logged to deferred-items, not fixed]**

`demo-node-inspector.spec.ts:50` ("napplet node (chat) shows capability state and recent envelopes") has a timing-dependent failure under 8-worker parallel execution. The `#inspector-pane` element is empty when the test runs before another test in the same serial block has opened the inspector. This predates Phase 31 (Phase 28 iteration log recorded 49/0/0 due to favorable run ordering, not absence of the race). Fixing this would require architectural changes to `demo-node-inspector.spec.ts` — out of Phase 31 scope. Deferred to v1.6+.

All other deviations: None — plan executed exactly as written for both spec contents and iteration loop.

## Known Stubs

None — spec-only phase. No data stubs.

## Cross-reference

- E2E-15 (`demo-concurrent-boot.spec.ts`) → **31-01-SUMMARY.md**
- Full iteration evidence → **31-ITERATION-LOG.md**
- v1.5 milestone handoff → `gsd:audit-milestone v1.5`

## Self-Check

- [x] `tests/e2e/shell-ui-state-surfaces.spec.ts` exists
- [x] `.planning/phases/31-e2e-coverage-milestone-iteration-loop/31-ITERATION-LOG.md` exists
- [x] Commit `08b4ec6` exists (Task 1)
- [x] Commit `4d17d32` exists (Task 2)
- [x] Full suite: 53 passed / 0 failed / 0 skipped

---
*Phase: 31-e2e-coverage-milestone-iteration-loop*
*Completed: 2026-04-19*
