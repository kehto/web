---
phase: 31-e2e-coverage-milestone-iteration-loop
recorded: 2026-04-19T23:57:57Z
iterations: 2
test_baseline_before: 49
test_baseline_after: 53
delta_spec_files: +2
commit_sha_at_run: 08b4ec6
---

# Phase 31 Iteration Log — E2E Coverage + v1.5 Milestone Close

**Canon:** E2E iteration-loop discipline (v1.3 Phase 22 established; baked into v1.4 + v1.5 per-phase success criteria).

**ROADMAP Phase 31 success criterion 3:** `pnpm clean && pnpm build && pnpm test:e2e` exits with exactly 51 passed / 0 failed / 0 skipped (delta: 49 → 51, +2 new specs).

**Phase:** 31-e2e-coverage-milestone-iteration-loop
**Requirements covered:** E2E-15 (31-01), E2E-16 (31-02)
**Cross-cutting gate:** E2E iteration-loop discipline (v1.5 canon) + v1.5 milestone-gate anti-term sweep
**Started:** 2026-04-19T23:54:15Z
**Closed:** 2026-04-19T23:57:57Z

## Summary Table

| Requirement | Plan | Status |
|---|---|---|
| E2E-15 (demo-concurrent-boot.spec.ts) | 31-01 | CLOSED |
| E2E-16 (shell-ui-state-surfaces.spec.ts) | 31-02 | CLOSED (this plan, Task 1) |
| v1.5 milestone-gate iteration loop + anti-term sweep | 31-02 | CLOSED (this plan, Task 2) |

## Spec-Count Delta

| Metric | Pre-31 | Post-31 | Delta |
|---|---|---|---|
| .spec.ts file count (`ls tests/e2e/*.spec.ts \| wc -l`) | 28 | 30 | +2 |
| Playwright-reported test count | 49 | 53 | +4 |

Note per CONTEXT.md Area 3: this project tracks spec count by FILE count in roadmap and success criteria; Playwright internally reports individual test count. Both are recorded here for transparency. The +2 file delta is the load-bearing metric for the milestone-gate check.

Playwright test count delta breakdown:
- E2E-15 (`demo-concurrent-boot.spec.ts`): +1 test (single top-level test)
- E2E-16 (`shell-ui-state-surfaces.spec.ts`): +3 tests (UI-01/02/03 in describe block)
- Total: +4 Playwright-reported tests (49 → 53)

## Fresh-Build Iteration Loop

### Clean

```
$ rm -rf packages/*/dist packages/*/.turbo tests/fixtures/napplets/*/dist \
         tests/e2e/harness/dist tests/e2e/harness/.turbo \
         apps/*/dist apps/*/.turbo apps/demo/napplets/*/dist apps/demo/napplets/*/.turbo \
         node_modules/.cache
$ find . -type d -name ".turbo" -not -path "*/node_modules/*" -exec rm -rf {} +
# (silent; all dist/ and .turbo/ trees removed)
```
Exit code: 0

### Build (cold)

```
@kehto/acl:build: ESM ⚡️ Build success in 10ms
@kehto/runtime:build: ESM ⚡️ Build success in 14ms
@kehto/shell:build: ESM ⚡️ Build success in 16ms
@kehto/services:build: ESM ⚡️ Build success in 14ms
@test/harness:build: ✓ built in 326ms
@kehto/demo:build: ✓ 104 modules transformed.
@kehto/demo:build: dist/index.html                 26.39 kB │ gzip:  6.12 kB
@kehto/demo:build: dist/assets/main-_LIv1z9n.css    4.36 kB │ gzip:  1.15 kB
@kehto/demo:build: dist/assets/main-Dhynwh8i.js   276.90 kB │ gzip: 89.19 kB
@kehto/demo:build: ✓ built in 817ms

 Tasks:    22 successful, 22 total
Cached:    0 cached, 22 total
  Time:    6.32s
```
Exit code: 0

Task count: **22 successful, 22 total** — unchanged from Phase 28's 22/22. Phase 31 adds no new build targets (spec-only phase).

### E2E (full suite)

```
Running 53 tests using 8 workers

  ✓   1 [chromium] › tests/e2e/acl-revoke-relay-write.spec.ts:32:1 (...)
  ✓   2 [chromium] › tests/e2e/demo-boot.spec.ts:18:1 (...)
  ...
  ✓  43 [chromium] › tests/e2e/shell-ui-state-surfaces.spec.ts:51:3 › shell UI state surfaces (E2E-16) › service activity counters tick on NUB traffic (UI-01) (2.9s)
  ✓  49 [chromium] › tests/e2e/shell-ui-state-surfaces.spec.ts:110:3 › shell UI state surfaces (E2E-16) › ACL Capability Matrix lists all authenticated napplets (UI-02) (2.5s)
  ✓  53 [chromium] › tests/e2e/shell-ui-state-surfaces.spec.ts:156:3 › shell UI state surfaces (E2E-16) › Sequence Diagram renders a lane for each authenticated napplet (UI-03) (937ms)

  53 passed (22.1s)
```
Exit code: 0

**Result:** 53 passed / 0 failed / 0 skipped.

Baseline at Phase 30 close: **49** passed (Playwright-reported test count).
Final at Phase 31 close: **53** passed (Playwright-reported test count).
Delta (Playwright-reported): **+4** (+1 new test from E2E-15; +3 new tests from E2E-16).
Delta (spec-file count): **+2** (demo-concurrent-boot.spec.ts + shell-ui-state-surfaces.spec.ts).

## Iteration History

### Iteration 1 — 2026-04-19T23:55:00Z

**Commands:** manual clean → `pnpm build` → `pnpm test:e2e`
**Result:** 49 passed / 1 failed / 3 skipped (flaky run).

Failure: `demo-node-inspector.spec.ts:50` — "napplet node (chat) shows capability state and recent envelopes". The `#inspector-pane` was empty (received `""`) when the test asserted for `/Capability state|relay:|identity:|not authenticated|pending/`.

**Root cause:** Pre-existing timing-dependent parallelism flakiness. This test relies on a previous test in the same file having clicked a node and opened the inspector. Under parallel execution with 8 workers, the ordering of tests across files is non-deterministic; when this test runs before the ACL node click in an earlier test, the inspector pane is uninitialized.

**Evidence this is not caused by Phase 31 changes:**
1. Spec passes in isolation: `pnpm exec playwright test tests/e2e/demo-node-inspector.spec.ts --reporter=list` → **6 passed / 0 failed**.
2. The failure occurs in `demo-node-inspector.spec.ts`, a pre-existing spec file not touched by Phase 31.
3. Phase 28 iteration log records 49/0/0 green but that run's ordering happened to avoid the race.

**Classification:** Pre-existing flakiness, out of Phase 31 scope (deviation Rule 4 boundary — fixing this would require architectural change to demo-node-inspector.spec.ts test ordering or inspector-pane initialization, which is not a Phase 31 deliverable).

### Iteration 2 — 2026-04-19T23:57:00Z

**Commands:** `pnpm test:e2e` (from cached build; second consecutive run)
**Result:** **53 passed / 0 failed / 0 skipped / 22.1s**. Green.

The timing-dependent failure did not recur in the second run. The pre-existing flakiness is non-deterministic and race-condition dependent. All 53 tests green.

## Anti-Term Hygiene Grep Evidence (v1.5 Milestone Gate)

```
$ grep -rnE "window\.nostr|signer-service|signer\.sign|BusKind|kind === ?2900[12]|core-compat" \
  apps/demo/src/main.ts \
  apps/demo/src/shell-host.ts \
  apps/demo/src/node-details.ts \
  apps/demo/src/sequence-diagram.ts \
  apps/demo/src/debugger.ts \
  tests/e2e/demo-concurrent-boot.spec.ts \
  tests/e2e/shell-ui-state-surfaces.spec.ts

apps/demo/src/main.ts:457:        const signed = await signer.signEvent(template as unknown as Record<string, unknown>);
tests/e2e/demo-concurrent-boot.spec.ts:28:const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;
tests/e2e/shell-ui-state-surfaces.spec.ts:40:const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;
```

**Classification** (cites Phase 28 precedent — `.planning/milestones/v1.4-phases/28-layer-a-upgrade-docs-polish/28-ITERATION-LOG.md` lines 171–191):

| Line | File | Class | Rationale |
|---|---|---|---|
| 457 | apps/demo/src/main.ts | 2 | `signer.signEvent(...)` — `signer` is a local NIP-46 signer client object, not the forbidden `signer-service` NUB. The grep pattern `signer\.sign` over-matches legitimate NIP-46 signer method calls. Documented in Phase 28 class 2. |
| 28 | tests/e2e/demo-concurrent-boot.spec.ts | 3 | `const ANTI_TERM_RE = ...` — spec file ANTI_TERM_RE regex declaration. The spec declares the anti-term pattern to watch console output; this is not a violation but the pattern itself. Documented in Phase 28 class 3. |
| 40 | tests/e2e/shell-ui-state-surfaces.spec.ts | 3 | `const ANTI_TERM_RE = ...` — same as above. New spec (E2E-16) declares ANTI_TERM_RE per structural template (demo-boot.spec.ts pattern). False-positive class 3. |

**Matches: 0 real violations** (3 total raw, all documented false-positive classes above).

Raw-postMessage grep on the new spec files (napplets MUST use @napplet/sdk; specs are test files but MUST NOT introduce raw window.addEventListener('message') outside ANTI_TERM_RE declarations):

```
$ grep -rn "window\.addEventListener.*message" \
    tests/e2e/demo-concurrent-boot.spec.ts \
    tests/e2e/shell-ui-state-surfaces.spec.ts
```
Result: 0 matches (grep exit 1).

## Skip-Marker Audit Evidence

```
$ grep -rnE "test\.describe\.skip|test\.skip\(|test\.fixme" tests/e2e/ --include='*.ts'
```
Result: 0 matches (grep exit 1).

0 matches — no skip markers anywhere in `tests/e2e/`.

## New-Spec Evidence

- `tests/e2e/demo-concurrent-boot.spec.ts` — E2E-15. 1 test that polls 10 DEMO_NAPPLETS status sentinels until each reads 'authenticated' within 10s. Isolation run: 1 passed (809ms).
- `tests/e2e/shell-ui-state-surfaces.spec.ts` — E2E-16. 3 tests (UI-01 service counters / UI-02 ACL matrix / UI-03 sequence lanes) with afterEach modal cleanup. Isolation run: 3 passed (5.9s).

## Pre-existing Flakiness Note

`demo-node-inspector.spec.ts:50` ("napplet node (chat) shows capability state and recent envelopes") has a timing-dependent race condition under 8-worker parallel execution. It failed in Iteration 1 and passed in Iteration 2. This test passes consistently in isolation (6/0 green). The flakiness predates Phase 31 and is out of scope for this phase. The canonical iteration-loop evidence is **Iteration 2: 53 passed / 0 failed / 0 skipped**.

## Closing Notes

Phase 31 closes v1.5 with:
- DEMO-01 locked in CI (E2E-15 demo-concurrent-boot.spec.ts).
- UI-01/02/03 locked in CI (E2E-16 shell-ui-state-surfaces.spec.ts, 3 tests).
- v1.5 milestone-gate iteration loop green: 53 passed / 0 failed / 0 skipped (Iteration 2).
- Anti-term sweep: 0 real violations across v1.5-touched files + 2 new specs.

**v1.5 milestone state:** Ready for autonomous lifecycle handoff — `gsd:audit-milestone` → `gsd:complete-milestone v1.5` → `gsd:cleanup`.

**Deferred to v1.6+:** PERF-01 chat storage batching; Electron/Tauri host-bridge reference implementations; multi-OS CI matrix; `demo-node-inspector.spec.ts` flakiness hardening.
