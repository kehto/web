---
phase: 31-e2e-coverage-milestone-iteration-loop
plan: 01
subsystem: testing
tags: [playwright, e2e, concurrent-boot, napplet, authenticated, status-sentinel]

# Dependency graph
requires:
  - phase: 29-concurrent-boot-auth-fix-demo-stability
    provides: refreshAclPanelsIfNeeded() data-driven loop over DEMO_NAPPLETS that makes all 10 napplets reach 'authenticated'
  - phase: 30-shell-ui-state-wiring
    provides: shell UI state wiring that 31-02 will assert
provides:
  - E2E-15 Playwright spec demo-concurrent-boot.spec.ts locking DEMO-01 in CI
  - Concurrent-boot regression gate: any future change that stalls a napplet on 'loading...' will fail this spec
affects: [31-02, milestone-v1.5-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "expect.poll().toMatchObject() for asserting all-napplet state in one diff"
    - "page.evaluate(napplets => ...) for reading outer topology card DOM sentinels"
    - "NAPPLETS const array alphabetically ordered as contract guard (distinct from DEMO_NAPPLETS ordering)"

key-files:
  created:
    - tests/e2e/demo-concurrent-boot.spec.ts
  modified: []

key-decisions:
  - "Hardcode 10-napplet list in spec rather than dynamic-import from shell-host.ts — spec is a contract guard, not a shell internals consumer (CONTEXT.md Area 1 locked decision)"
  - "Alphabetical NAPPLETS ordering in spec (bot, chat, ...) distinct from DEMO_NAPPLETS ordering (chat, bot, ...); toMatchObject() is key-order-agnostic"
  - "Timeout 10s with intervals [250, 500, 1000]ms — Phase 29 UAT showed all 10 napplets auth within 8s; 10s gives CI headroom"

patterns-established:
  - "statusId naming quirks locked in spec: profile-viewer→profile-status, theme-switcher→theme-status"
  - "expect.poll().toMatchObject() pattern for concurrent multi-napplet status polling"

requirements-completed: [E2E-15]

# Metrics
duration: 2min
completed: 2026-04-19
---

# Phase 31 Plan 01: E2E-15 Concurrent Boot Spec Summary

**Layer-B Playwright spec polling all 10 DEMO_NAPPLETS status sentinels via expect.poll().toMatchObject() to lock the Phase-29 concurrent-boot AUTH fix in CI**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-19T23:50:51Z
- **Completed:** 2026-04-19T23:52:07Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments

- Created `tests/e2e/demo-concurrent-boot.spec.ts` with verbatim spec body from plan action block (80 lines)
- Spec polls all 10 napplet status sentinels (`bot`, `chat`, `composer`, `feed`, `hotkey-chord`, `media-controller`, `preferences`, `profile-viewer`, `theme-switcher`, `toaster`) and asserts each reads `'authenticated'` within 10s
- Isolation run: 1 passed / 0 failed / 0 skipped (809ms)
- All 12 acceptance criteria verified; TypeScript type-check passes; anti-term grep returns 0 real violations

## Task Commits

1. **Task 1: Create demo-concurrent-boot.spec.ts (E2E-15)** - `52013af` (feat)

**Plan metadata:** (included in final docs commit)

## Files Created/Modified

- `tests/e2e/demo-concurrent-boot.spec.ts` — E2E-15 Layer-B concurrent-boot regression gate; polls 10 napplet status sentinels; 80 lines

## Decisions Made

- Hardcode NAPPLETS array in spec (not dynamic import from shell-host.ts) — per CONTEXT.md Area 1 locked decision; spec is a contract guard, not a shell-internals consumer
- Alphabetical ordering in NAPPLETS array (bot, chat, ...) for readability; toMatchObject() key order is irrelevant to the assertion
- `__loadNapplet__` appears only in the JSDoc docblock as an anti-feature note (verbatim from plan action body); acceptance criterion AC11 checks for actual code usage — confirmed 0 actual usages

## Deviations from Plan

None — plan executed exactly as written. Spec contents match the verbatim action body. No modifications to NAPPLETS array, statusId strings, polling intervals, or timeout.

## Issues Encountered

None.

## Spec Isolation Run Result

```
Running 1 test using 1 worker
  ✓  1 [chromium] › tests/e2e/demo-concurrent-boot.spec.ts:45:1 › all 10 DEMO_NAPPLETS reach authenticated within 10s on concurrent boot at :4174 (809ms)
  1 passed (3.5s)
```

## Anti-term Grep Result

```bash
grep -nE "window\.nostr|signer-service|signer\.sign|BusKind|kind === ?2900[12]|core-compat" \
  tests/e2e/demo-concurrent-boot.spec.ts | grep -v "ANTI_TERM_RE"
# → 0 real violations
```

The `ANTI_TERM_RE` regex declaration line itself is the documented false-positive class per Phase 28 precedent.

## Acceptance Criteria Verification

| # | Criterion | Result |
|---|-----------|--------|
| AC1 | File exists | PASS |
| AC2 | `import { test, expect }` line present | PASS |
| AC3 | `demoBeforeEach` count ≥ 2 (import + call) | PASS (2) |
| AC4 | `http://localhost:4174` present | PASS |
| AC5 | `expect.poll` present | PASS |
| AC6 | `toMatchObject` present | PASS |
| AC7 | `'authenticated'` present | PASS |
| AC8 | Both `profile-status` and `theme-status` | PASS (4 total) |
| AC9 | All 10 napplet names present (1 each) | PASS |
| AC10 | No `test.skip`/`test.fixme` markers | PASS (0) |
| AC11 | No `__loadNapplet__` code usage | PASS (docblock only, not code) |
| AC12 | Spec passes in isolation (`1 passed`) | PASS |

## Known Stubs

None — spec-only phase. No data stubs.

## Cross-reference

- Full-suite iteration loop (49→51 spec delta) + anti-term milestone sweep → **31-02-PLAN.md**
- E2E-16 (`shell-ui-state-surfaces.spec.ts`) → **31-02-PLAN.md**

## Next Phase Readiness

- 31-02 can run in parallel (zero file overlap); no blocking dependency on 31-01 other than spec count context
- `pnpm test:e2e` full-suite delta (+1 spec) will be verified in 31-02's iteration loop

---
*Phase: 31-e2e-coverage-milestone-iteration-loop*
*Completed: 2026-04-19*
