---
phase: 40-nub-resource-demo-policy
plan: "03"
subsystem: e2e/docs/policy
tags:
  - nub-resource
  - e2e
  - class-invariant
  - policy-docs
  - docs-07
  - e2e-25
  - e2e-20
  - phase-close
dependency_graph:
  requires:
    - 40-01 (createResourceService + resource:fetch capability wired)
    - 40-02 (resource-demo napplet + demo-data.json + auto-grant + shell-host wiring)
    - 38-05 (class-invariant.spec.ts Phase 38 origin — extended here)
    - 39-05 (SHELL-CONNECT-POLICY.md header pattern mirrored)
  provides:
    - docs/policies/SHELL-RESOURCE-POLICY.md (canonical napplet/napplet@27e1624 verbatim + kehto cross-refs)
    - tests/e2e/nub-resource.spec.ts (2 tests: E2E-25 granted + denied)
    - class-invariant.spec.ts extended to 10 domains (E2E-20 complete)
    - README.md Policies section with all 3 policy file links (DOCS-07)
    - 40-ITERATION-LOG.md with 71/0/0 close record
  affects:
    - Phase 41 (Polish Wave) — unblocked
    - Phase 42 (NIP-44 Decrypt, soft-gated)
tech_stack:
  added: []
  patterns:
    - frameLocator pattern for cross-origin iframe E2E assertions (nub-resource.spec.ts)
    - canonical policy doc mirror pattern (header + kehto cross-refs — CLASS, CONNECT, RESOURCE)
    - parameterized NUB domain invariant tests (class-invariant.spec.ts)
key_files:
  created:
    - docs/policies/SHELL-RESOURCE-POLICY.md (canonical + kehto cross-refs, 250 lines)
    - tests/e2e/nub-resource.spec.ts (2 tests E2E-25)
    - .planning/phases/40-nub-resource-demo-policy/40-ITERATION-LOG.md
  modified:
    - tests/e2e/class-invariant.spec.ts (NubDomain union + ACTIVE_NUB_DOMAINS 8→10)
    - README.md (Policies section: 2→3 policy file links, DOCS-07 closure)
    - apps/demo/napplets/resource-demo/src/main.ts (GRANTED_URL 5174→4174 Rule 1 fix)
    - apps/demo/src/main.ts (auto-grant URL 5174→4174 Rule 1 fix)
    - tests/e2e/shell-ui-state-surfaces.spec.ts (ACL modal row count 11→12 Rule 1 fix)
decisions:
  - "GRANTED_URL corrected to 4174 (demo origin hosts demo-data.json in public/); port 5174 is napplet dev server — not available in preview mode"
  - "Canonical upstream SHELL-RESOURCE-POLICY.md existed at napplet/napplet@27e1624 — verbatim copy (no placeholder required)"
  - "Auto-approve checkpoint: autonomous milestone execution; E2E 71/0/0 is the verification gate"
requirements-completed:
  - RESOURCE-05
  - E2E-25
  - DOCS-07
  - E2E-20
metrics:
  duration: ~18 minutes
  completed_date: "2026-04-24"
  tasks_completed: 3
  files_modified: 7
  files_created: 3
---

# Phase 40 Plan 03: Policy Doc + E2E Specs + Phase Close Summary

**SHELL-RESOURCE-POLICY.md mirrored from napplet/napplet@27e1624 with 15-entry kehto cross-ref appendix; nub-resource.spec.ts (2 tests E2E-25) + class-invariant.spec.ts extended to 10 NUB domains (E2E-20 complete); canonical phase-close loop records 71/0/0.**

## Performance

- **Duration:** ~18 minutes
- **Started:** 2026-04-24
- **Completed:** 2026-04-24
- **Tasks:** 3 (+ 2 Rule 1 auto-fixes)
- **Files modified:** 7

## Accomplishments

- `docs/policies/SHELL-RESOURCE-POLICY.md` created from canonical napplet/napplet source (HTTP 200, SHA 27e1624) with 15 kehto file:line cross-references and D7 host-app-responsibility surface documented in header
- `tests/e2e/nub-resource.spec.ts` — 2 Layer-B tests: granted JSON round-trip (`"kehto demo"`) + denied origin (`code=denied`); H-03 coupling proof: denied populates before network timeout would fire
- `tests/e2e/class-invariant.spec.ts` extended 8→10 NUB domains (`config`, `resource` added) — E2E-20 checkbox complete
- README Policies section updated with all 3 policy file links — DOCS-07 closed
- Canonical phase-close iteration loop: 71 passed / 0 failed / 0 skipped; `pnpm audit:csp` exit 0 (12 napplets)

## Task Commits

1. **Task 1: SHELL-RESOURCE-POLICY.md + README Policies** - `e31d392` (feat)
2. **Task 2: nub-resource.spec.ts + class-invariant extension + Rule 1 URL fix** - `7584f05` (feat)
3. **Rule 1 fix: shell-ui-state-surfaces ACL modal count 11→12** - `ccd8d78` (fix)
4. **Phase-close checkpoint: iteration log + SUMMARY** - (docs commit below)

## Files Created/Modified

| File | Action | Notes |
|------|--------|-------|
| `docs/policies/SHELL-RESOURCE-POLICY.md` | Created | Canonical verbatim mirror + kehto cross-ref appendix (250 lines) |
| `tests/e2e/nub-resource.spec.ts` | Created | 2 tests: granted JSON + denied code=denied (E2E-25) |
| `.planning/phases/40-nub-resource-demo-policy/40-ITERATION-LOG.md` | Created | Phase-close loop record with 71/0/0 |
| `tests/e2e/class-invariant.spec.ts` | Modified | NubDomain union + ACTIVE_NUB_DOMAINS 8→10 (E2E-20) |
| `README.md` | Modified | Policies section: all 3 policy files linked (DOCS-07) |
| `apps/demo/napplets/resource-demo/src/main.ts` | Modified | GRANTED_URL 5174→4174 (Rule 1) |
| `apps/demo/src/main.ts` | Modified | auto-grant URL 5174→4174 (Rule 1) |
| `tests/e2e/shell-ui-state-surfaces.spec.ts` | Modified | ACL modal row count 11→12 (Rule 1) |

## Decisions Made

1. **Canonical source available** — `https://raw.githubusercontent.com/napplet/napplet/main/specs/SHELL-RESOURCE-POLICY.md` returned HTTP 200 at copy time (SHA 27e1624). Policy is verbatim mirror + kehto cross-ref appendix. No placeholder required.
2. **GRANTED_URL port** — demo-data.json lives in `apps/demo/public/` (served at demo origin 4174). Port 5174 is the napplet Vite dev server — unavailable in preview mode (E2E context). Corrected across napplet src and auto-grant fixture.
3. **Auto-approve checkpoint** — `workflow._auto_chain_active` is true; human-verify checkpoint auto-approved with rationale "autonomous milestone execution; E2E 71/0/0 is the verification gate."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] GRANTED_URL corrected from localhost:5174 → localhost:4174**
- **Found during:** Task 2 — pre-verification spec run
- **Issue:** `apps/demo/napplets/resource-demo/src/main.ts` had `GRANTED_URL = 'http://localhost:5174/demo-data.json'`. Port 5174 is the Vite napplet dev server (dev-mode only); `demo-data.json` lives in `apps/demo/public/` served by the demo at 4174. In E2E preview mode: network-error on granted fetch.
- **Fix:** Changed `GRANTED_URL` to `http://localhost:4174/demo-data.json`; updated `apps/demo/src/main.ts` auto-grant from `http://localhost:5174` to `http://localhost:4174`; updated `SHELL-RESOURCE-POLICY.md` cross-ref.
- **Files modified:** `apps/demo/napplets/resource-demo/src/main.ts`, `apps/demo/src/main.ts`, `docs/policies/SHELL-RESOURCE-POLICY.md`
- **Verification:** nub-resource.spec.ts `granted fetch` test passes
- **Committed in:** `7584f05` (Task 2 commit)

**2. [Rule 1 - Bug] shell-ui-state-surfaces ACL modal row count 11→12**
- **Found during:** Task 3 — canonical phase-close E2E loop (first run, 1 failure)
- **Issue:** `tests/e2e/shell-ui-state-surfaces.spec.ts:148` asserted `toHaveCount(11)` for ACL policy modal rows. Plan 40-02 added `resource-demo` as the 12th napplet without updating this assertion.
- **Fix:** Updated assertion to `toHaveCount(12)` with updated comment.
- **Files modified:** `tests/e2e/shell-ui-state-surfaces.spec.ts`
- **Verification:** Full E2E suite 71/0/0 on second run
- **Committed in:** `ccd8d78`

---

**Total deviations:** 2 auto-fixed (2× Rule 1 — both bugs introduced by Wave 2 shipping 12th napplet without updating dependent assertions/URLs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Known Stubs

None — all files are production-complete:
- `SHELL-RESOURCE-POLICY.md` is a verbatim canonical mirror (not a placeholder)
- E2E tests assert real observable DOM sentinels from the built demo
- `ACTIVE_NUB_DOMAINS` extension adds real domain labels (not mocks)

## Self-Check: PASSED

| Item | Result |
|------|--------|
| `docs/policies/SHELL-RESOURCE-POLICY.md` | FOUND |
| `tests/e2e/nub-resource.spec.ts` | FOUND |
| `40-ITERATION-LOG.md` | FOUND |
| `ls docs/policies/*.md \| wc -l` | 3 |
| README.md SHELL-RESOURCE-POLICY ref | FOUND |
| `class-invariant.spec.ts` has 'config', 'resource' | FOUND |
| Commit `e31d392` (Task 1) | FOUND |
| Commit `7584f05` (Task 2 + Rule 1) | FOUND |
| Commit `ccd8d78` (Rule 1 fix) | FOUND |
| `pnpm test:e2e` | 71/0/0 PASS |
| `pnpm audit:csp` | exit 0, 12 napplets |
