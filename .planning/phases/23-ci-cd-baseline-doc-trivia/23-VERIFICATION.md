---
phase: 23-ci-cd-baseline-doc-trivia
verified: 2026-04-19T10:38:02Z
status: human_needed
score: 4/5 must-haves verified (criterion 5 requires push to origin — human checkpoint)
requirements_covered:
  - CI-01
  - CI-02
  - CI-03
  - DOCS-04
requirements_out_of_scope:
  - CI-04  # Phase 25, not Phase 23
human_verification:
  - test: "Push main to origin and capture green-run URLs for all three workflows (build.yml, unit.yml, e2e.yml)"
    expected: "All three workflows complete successfully against the merge commit; URLs recorded in the phase iteration log; the Playwright run reports the full v1.3 baseline (47 specs / 0 skipped) green"
    why_human: "GitHub Actions only execute after `git push origin main`. Phase 23 committed workflow files locally (commits c03cd70 / bf708dc / 0989ac9 / 1be0e25) but has NOT pushed. No automated verifier inside this repo can trigger or observe a remote CI run; the green-bar evidence must be captured by a human after push."
---

# Phase 23: CI/CD Baseline & Doc Trivia — Verification Report

**Phase Goal:** Every push and PR is gated by GitHub Actions running build, type-check, unit tests, and the full Playwright suite — so subsequent v1.4 phases land on a green-bar floor; cosmetic doc citations of deleted fixtures are corrected.

**Verified:** 2026-04-19T10:38:02Z
**Status:** human_needed (4/5 automated, 1/5 human)
**Re-verification:** No — initial verification

## Goal Achievement

### Success Criteria (from ROADMAP.md Phase 23)

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `build.yml` runs `pnpm install --frozen-lockfile && pnpm build && pnpm type-check` on push and PR | PASS | File exists at `.github/workflows/build.yml`; triggers `on: [push, pull_request]`; runs all three pnpm commands verbatim; YAML parses cleanly; concurrency `cancel-in-progress: true`. |
| 2 | `unit.yml` runs `pnpm test` (Vitest) on push and PR with cached pnpm store | PASS | File exists at `.github/workflows/unit.yml`; runs exact `pnpm test` (NOT `pnpm test:e2e`); uses `actions/setup-node@v4` with `cache: 'pnpm'` for store caching; YAML parses cleanly. |
| 3 | `e2e.yml` runs `pnpm test:e2e` on push and PR with `~/.cache/ms-playwright` cache restored from versioned key; full v1.3 baseline (47 specs / 0 skipped) reports green | PASS (automated bits) / PENDING (green-run on GitHub) | Workflow file exists; uses `actions/cache@v4` with path `~/.cache/ms-playwright`; cache key includes Playwright version + `pnpm-lock.yaml` hash with restore-keys fallback; cache-hit/miss branches handled; runs `pnpm test:e2e`. Green run on GitHub is criterion 5's evidence. |
| 4 | `tests/e2e/harness/harness.ts:10` and `tests/e2e/helpers/wait-for-napplet-ready.ts:21` JSDoc cite extant `nub-*` fixtures; zero `auth-napplet` references in `tests/e2e/**/*.ts` JSDoc | PASS | harness.ts line 10 cites `'nub-identity'`; wait-for-napplet-ready.ts line 21 cites `'nub-identity'`; `grep auth-napplet tests/e2e/**/*.ts` returns zero matches. |
| 5 | A green run of all three workflows recorded against the merge commit (URLs captured in phase iteration log) | HUMAN_NEEDED | Workflow files committed locally (210ff36 and earlier) but NOT pushed to origin. GitHub Actions cannot execute until push. URLs will only exist post-push. |

**Automated score:** 4/4 automated criteria pass. **Overall:** 4/5 with criterion 5 routed to human.

### Observable Truths (aggregated from all 4 plans)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Every push/PR triggers build.yml | VERIFIED | `on: {push, pull_request}` present. |
| 2 | Every push/PR triggers unit.yml | VERIFIED | `on: {push, pull_request}` present. |
| 3 | Every push/PR triggers e2e.yml | VERIFIED | `on: {push, pull_request}` present. |
| 4 | Failing build/type-check/unit/e2e exits non-zero (red check) | VERIFIED (structural) | No `continue-on-error`; plain `run:` shell exit codes propagate. |
| 5 | Concurrency cancels in-flight runs on new commit | VERIFIED | All three workflows have `concurrency.cancel-in-progress: true`. |
| 6 | Playwright browsers restored from `~/.cache/ms-playwright` (cache key from lock hash + PW version) | VERIFIED | `actions/cache@v4` with `path: ~/.cache/ms-playwright`; key `${{ runner.os }}-playwright-${{ steps.pw-version.outputs.version }}-${{ hashFiles('pnpm-lock.yaml') }}` with restore-keys fallback. |
| 7 | JSDoc in harness.ts and wait-for-napplet-ready.ts cites `nub-identity` (extant) | VERIFIED | Lines 10 and 21 both contain `window.__loadNapplet__('nub-identity')`. |
| 8 | Zero `auth-napplet` references in `tests/e2e/**/*.ts` | VERIFIED | `grep -r auth-napplet tests/e2e --include='*.ts'` returns 0 matches. |
| 9 | Green-bar run recorded on GitHub | HUMAN_NEEDED | Requires `git push origin main`. |

### Required Artifacts

| Artifact | Expected | Exists | Substantive | Wired | Status |
| --- | --- | --- | --- | --- | --- |
| `.github/workflows/build.yml` | CI-01 build+type-check workflow | yes | yes (38 LOC, all required steps + concurrency) | yes (invokes package.json scripts verbatim) | VERIFIED |
| `.github/workflows/unit.yml` | CI-02 Vitest workflow | yes | yes (35 LOC, Vitest via `pnpm test`) | yes | VERIFIED |
| `.github/workflows/e2e.yml` | CI-03 Playwright workflow with browser cache | yes | yes (60 LOC, cache-aware install + runtime) | yes | VERIFIED |
| `tests/e2e/harness/harness.ts` | JSDoc cites nub-identity | yes | yes (unchanged behavior, only comment edited) | n/a (doc-only) | VERIFIED |
| `tests/e2e/helpers/wait-for-napplet-ready.ts` | JSDoc @example cites nub-identity | yes | yes | n/a (doc-only) | VERIFIED |

gsd-tools `verify artifacts`: 4/4 plans passed (5/5 total artifacts).

### Key Link Verification

gsd-tools `verify key-links` across all four plans:

| Plan | From | To | Via | Status |
| --- | --- | --- | --- | --- |
| 23-01 | build.yml | package.json scripts (build, type-check) | `pnpm build && pnpm type-check` | WIRED |
| 23-01 | build.yml | pnpm/action-setup@v3 | `uses: pnpm/action-setup@v3` | WIRED |
| 23-02 | unit.yml | package.json scripts (test) | `pnpm test` | WIRED |
| 23-02 | unit.yml | pnpm/action-setup@v3 | `uses: pnpm/action-setup@v3` | WIRED |
| 23-03 | e2e.yml | package.json scripts (test:e2e) | `pnpm test:e2e` | WIRED |
| 23-03 | e2e.yml | actions/cache@v4 | Cache key composed from lock hash + PW version | WIRED |
| 23-03 | e2e.yml | `~/.cache/ms-playwright` | `path: ~/.cache/ms-playwright` | WIRED |
| 23-04 | harness.ts | nub-identity fixture | JSDoc @example string | WIRED (fixture exists at `tests/fixtures/napplets/nub-identity/`) |
| 23-04 | wait-for-napplet-ready.ts | nub-identity fixture | JSDoc @example string | WIRED |

All 9 key links verified. Fixture `nub-identity` confirmed to exist at `tests/fixtures/napplets/nub-identity/`.

### Package.json Script Linkage (upstream of each workflow)

| Workflow invocation | package.json resolution | Status |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | native pnpm 10 | WIRED (packageManager pinned to pnpm@10.8.0) |
| `pnpm build` | `"build": "turbo run build"` | WIRED |
| `pnpm type-check` | `"type-check": "turbo run type-check"` | WIRED |
| `pnpm test` | `"test": "turbo run test"` | WIRED |
| `pnpm test:e2e` | `"test:e2e": "pnpm test:build && npx playwright test"` | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| All three workflow YAMLs parse cleanly | `python3 yaml.safe_load` on each file | OK (3/3) | PASS |
| build.yml contains `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm type-check` | grep | all three found | PASS |
| unit.yml runs `pnpm test` and NOT `pnpm test:e2e` | grep | `pnpm test` present; `test:e2e` absent | PASS |
| e2e.yml wires Playwright cache with path + key | grep `~/.cache/ms-playwright`, `actions/cache@v4` | both present | PASS |
| harness.ts:10 cites nub-identity | Read line 10 | `window.__loadNapplet__('nub-identity')` | PASS |
| wait-for-napplet-ready.ts:21 cites nub-identity | Read line 21 | `window.__loadNapplet__('nub-identity')` | PASS |
| Zero `auth-napplet` in `tests/e2e/**/*.ts` | ripgrep | 0 matches | PASS |
| Workflows actually run on GitHub and report green for the merge commit | needs push | n/a until pushed | SKIP (routed to human) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| CI-01 | 23-01 | `build.yml` runs install+build+type-check on push/PR; failure blocks merge | SATISFIED (automated) / HUMAN_NEEDED (blocks-merge branch protection) | Workflow file verified; "blocks merge" depends on branch protection rules configured on GitHub — outside repo scope and covered implicitly by criterion 5's human checkpoint. |
| CI-02 | 23-02 | `unit.yml` runs Vitest on push/PR; failure blocks merge | SATISFIED | Workflow file verified; `pnpm test` runs Vitest via turbo. |
| CI-03 | 23-03 | `e2e.yml` runs Playwright with ms-playwright cache on push/PR | SATISFIED | Cache + runtime wired per spec; v1.3 green-bar 47 specs will be validated by criterion 5's post-push run. |
| DOCS-04 | 23-04 | JSDoc examples refreshed to extant fixtures | SATISFIED | Both files updated; zero remaining references in `tests/e2e/**/*.ts`. |

No CI-04 work detected — correct boundary: CI-04 is assigned to Phase 25 in REQUIREMENTS.md. No `release.yml`, no `NPM_TOKEN`, no `changeset publish` strings appear anywhere under `.github/`.

Note on REQUIREMENTS.md tracking ledger: at time of verification, CI-01 still shows `[ ]` (unchecked) and the phase-status table marks CI-01 as "Pending" — this is a stale-doc artifact; the implementation is complete. The ledger will be updated as part of phase closure / milestone bookkeeping.

### Scope Boundary Checks

| Check | Expected | Actual | Status |
| --- | --- | --- | --- |
| `.github/workflows/` contains only build.yml, unit.yml, e2e.yml | 3 files | 3 files (build.yml, e2e.yml, unit.yml) | PASS |
| No `release.yml` | absent | absent | PASS |
| No `NPM_TOKEN` / `changeset publish` references | absent | `grep -r NPM_TOKEN .github` returns 0 | PASS |
| unit.yml does NOT run `test:e2e` | absent | confirmed via grep | PASS |
| SUMMARY files for each plan | 4 | 4 (23-01, 23-02, 23-03, 23-04) | PASS |

### Anti-Patterns Found

None. Scanned all three workflow YAMLs and both edited .ts files for TODO/FIXME/XXX/HACK/PLACEHOLDER/"coming soon"/"not implemented" — zero matches. Workflow files contain clean verbatim YAML matching plan specifications exactly.

### Human Verification Required

Only criterion 5 is routed to human — as anticipated and documented in the phase plan and verification brief.

#### 1. Push to origin and capture green-run URLs

**Test:**
1. Review the four Phase 23 commits (`c03cd70`, `bf708dc`, `0989ac9`, `1be0e25` and their doc counterparts) then execute `git push origin main`.
2. Navigate to the GitHub Actions tab of the `kehto` repo.
3. Observe the three workflow runs triggered by the push against the merge commit SHA.
4. Record the run URLs (one for Build, one for Unit Tests, one for E2E) in the Phase 23 iteration log.

**Expected:**
- All three workflows complete with green status.
- The E2E run reports the full v1.3 baseline: 47 specs executed, 0 skipped, all passing.
- Workflow durations are reasonable (e2e run may take multiple minutes on a cache-miss first run; should be faster on subsequent runs once `~/.cache/ms-playwright` is populated).
- If any workflow fails, treat as a gap and capture the failing-job URL plus the first error from the logs for triage.

**Why human:**
GitHub Actions execute only on a remote ref. There is no way — and no desire — for an in-repo verifier to push on the user's behalf, and no API call this verifier can make to observe a run that has not yet been triggered. The push + observe + record loop is a natural human checkpoint and is called out as such in the phase plan's success criterion 5.

### Gaps Summary

No automatable gaps. All four Phase 23 plans produced the artifacts they promised, wired them to package.json scripts and to the expected GitHub Actions dependencies, and respected scope boundaries (no CI-04 work, no collateral source/test changes). The phase-level goal — "every push and PR is gated by GitHub Actions" — is structurally achieved locally; the single outstanding item is the green-run observation on GitHub, which requires a push the verifier cannot perform.

---

_Verified: 2026-04-19T10:38:02Z_
_Verifier: Claude (gsd-verifier)_
