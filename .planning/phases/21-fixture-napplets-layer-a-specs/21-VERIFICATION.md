---
phase: 21-fixture-napplets-layer-a-specs
verified: 2026-04-17T00:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 21: Fixture Napplets & Layer-A Specs Verification Report

**Phase Goal:** Protocol correctness is independently verifiable at the harness layer, without the demo server — one fixture napplet per non-stub NUB domain drives the runtime via harness globals and a `nub-*.spec.ts` spec asserts canonical request/response behavior.
**Verified:** 2026-04-17T00:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 3 legacy fixture napplets deleted | VERIFIED | `auth-napplet`, `publish-napplet`, `pure-napplet` confirmed absent from filesystem |
| 2 | 6 new nub-* fixture directories exist | VERIFIED | `nub-identity`, `nub-ifc`, `nub-notify`, `nub-relay`, `nub-storage`, `nub-theme` all present under `tests/fixtures/napplets/` |
| 3 | Each fixture builds clean | VERIFIED | All 6 `dist/` directories populated (2 items each); iteration log records `pnpm build` FULL TURBO 20/20 tasks |
| 4 | 8 Layer-A spec files exist | VERIFIED | All 8 `nub-{identity,ifc,notify,relay,storage,theme,keys,media}.spec.ts` present under `tests/e2e/` |
| 5 | Anti-term grep clean (zero `addEventListener('message')` in fixture src) | VERIFIED | Grep of `tests/fixtures/napplets/nub-*/src/` returns 0 matches for all banned terms |
| 6 | `turbo.json build:napplets` outputs include fixture dists | VERIFIED | `turbo.json` `build:napplets.outputs` contains `"tests/fixtures/napplets/*/dist/**"` |
| 7 | Full v1.3 suite green (47 passed / 0 failed) | VERIFIED | Iteration log records single iteration: 47 passed, 0 failed, 68 skipped (legacy describe.skip by design) |
| 8 | `21-ITERATION-LOG.md` documents the cycle | VERIFIED | File exists at 164 lines with pre-flight checks, test output, coverage summary, anti-term hygiene, and NAP-09 regression check |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/fixtures/napplets/nub-identity/` | Fixture directory | VERIFIED | Present; `src/main.ts` 57 lines, `dist/` populated |
| `tests/fixtures/napplets/nub-ifc/` | Fixture directory | VERIFIED | Present; `src/main.ts` 50 lines, `dist/` populated |
| `tests/fixtures/napplets/nub-notify/` | Fixture directory | VERIFIED | Present; `src/main.ts` 37 lines, `dist/` populated |
| `tests/fixtures/napplets/nub-relay/` | Fixture directory | VERIFIED | Present; `src/main.ts` 61 lines, `dist/` populated |
| `tests/fixtures/napplets/nub-storage/` | Fixture directory | VERIFIED | Present; `src/main.ts` 37 lines, `dist/` populated |
| `tests/fixtures/napplets/nub-theme/` | Fixture directory | VERIFIED | Present; `src/main.ts` 41 lines, `dist/` populated |
| `tests/fixtures/napplets/auth-napplet` | MUST NOT EXIST | VERIFIED | Directory absent |
| `tests/fixtures/napplets/publish-napplet` | MUST NOT EXIST | VERIFIED | Directory absent |
| `tests/fixtures/napplets/pure-napplet` | MUST NOT EXIST | VERIFIED | Directory absent |
| `tests/fixtures/napplets/README.md` | Removal rationale + v1.3 pattern | VERIFIED | "Removed in Phase 21" section present; nub-* pattern documented |
| `tests/e2e/nub-identity.spec.ts` | Layer-A spec | VERIFIED | 57 lines, 1 test, 6 expects; uses `__loadNapplet__` + `__getNubMessage__` |
| `tests/e2e/nub-ifc.spec.ts` | Layer-A spec | VERIFIED | 75 lines, 1 test, 7 expects |
| `tests/e2e/nub-notify.spec.ts` | Layer-A spec | VERIFIED | 60 lines, 1 test, 6 expects |
| `tests/e2e/nub-relay.spec.ts` | Layer-A spec | VERIFIED | 79 lines, 1 test, 7 expects |
| `tests/e2e/nub-storage.spec.ts` | Layer-A spec | VERIFIED | 52 lines, 1 test, 4 expects |
| `tests/e2e/nub-theme.spec.ts` | Layer-A spec | VERIFIED | 79 lines, 1 test, 7 expects |
| `tests/e2e/nub-keys.spec.ts` | Layer-A spec (stub domain) | VERIFIED | 126 lines, 1 test, 8 expects; uses `__injectEnvelope__` + `__registerService__` (no fixture napplet) |
| `tests/e2e/nub-media.spec.ts` | Layer-A spec (stub domain) | VERIFIED | 126 lines, 1 test, 8 expects; uses `__injectEnvelope__` (no fixture napplet) |
| `turbo.json` | `build:napplets` task with fixture outputs | VERIFIED | `outputs` contains `"tests/fixtures/napplets/*/dist/**"` |
| `.planning/phases/21-fixture-napplets-layer-a-specs/21-ITERATION-LOG.md` | Iteration cycle log | VERIFIED | 164 lines; 1 iteration; 47 passed / 0 failed documented |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `nub-identity.spec.ts` | `nub-identity` fixture | `window.__loadNapplet__('nub-identity')` | WIRED | Spec calls `__loadNapplet__` and `__getNubMessage__` to assert envelope dispatch |
| `nub-keys.spec.ts` | harness (no fixture) | `window.__injectEnvelope__` + `window.__registerService__` | WIRED | Stub-domain path: spec registers a stub service and injects envelope directly |
| `turbo.json build:napplets` | fixture dists | `"tests/fixtures/napplets/*/dist/**"` output glob | WIRED | Output glob matches all 6 fixture dist directories |
| fixture `src/main.ts` | `@napplet/shim` + `@napplet/sdk` | ESM import | WIRED | Verified in `nub-identity/src/main.ts`; pattern repeated across all 6 fixtures |

### Data-Flow Trace (Level 4)

Not applicable. Fixture napplets are not rendering-layer components consuming async state — they are self-contained TypeScript modules that perform SDK calls on init. The iteration log's passing tests (47/47) are the definitive data-flow proof: each spec asserts that envelope dispatch and harness sentinel updates actually occur at runtime.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Fixture dist dirs populated | `ls tests/fixtures/napplets/nub-*/dist/` | 6 dirs, 2 items each | PASS |
| All 8 nub-*.spec.ts files exist | `ls tests/e2e/nub-*.spec.ts` | 8 files listed | PASS |
| Anti-term clean (src) | `grep -rn "addEventListener.*message" tests/fixtures/napplets/nub-*/src/` | 0 matches | PASS |
| Legacy dirs absent | `test -d tests/fixtures/napplets/{auth,publish,pure}-napplet` | All 3 DELETED | PASS |
| turbo.json fixture outputs | grep for `tests/fixtures/napplets/*/dist/**` in turbo.json | Found | PASS |
| Spec substantiveness | Count `test()` and `expect()` calls per spec | 1 test / 4-8 expects each | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| E2E-09 | 21-01-PLAN.md through 21-05-PLAN.md | Layer-A fixture napplets under `tests/fixtures/napplets/` — one per non-stub nub (identity, ifc, notify, relay, storage, theme). Matching `nub-<domain>.spec.ts` specs drive the runtime via harness driver globals only. | SATISFIED | 6 fixture napplets exist with dist builds; 8 nub-*.spec.ts files exist and are substantive; iteration log records 47/0 pass/fail |

E2E-09 is marked `Complete` in `REQUIREMENTS.md` phase mapping table.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No anti-patterns found |

No TODOs, FIXMEs, placeholders, empty implementations, or banned terms detected in fixture `src/` files or `nub-*.spec.ts` files. The `ANTI_TERM_RE` constant in each spec is the definition of the pattern being checked — not an occurrence of the anti-term.

### Human Verification Required

None. All checks are automatable for this phase:
- File existence and deletion: programmatic
- Build artifacts: programmatic (dist presence)
- Anti-term hygiene: grep
- Test suite results: documented in iteration log with explicit pass/fail counts and individual test names

### Gaps Summary

No gaps. All 8 must-haves pass.

---

_Verified: 2026-04-17T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
