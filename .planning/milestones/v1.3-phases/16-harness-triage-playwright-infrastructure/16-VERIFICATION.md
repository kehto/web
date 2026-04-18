---
phase: 16-harness-triage-playwright-infrastructure
verified: 2026-04-17T00:00:00Z
status: passed
score: 6/6 must-haves verified
---

# Phase 16: Harness Triage & Playwright Infrastructure Verification Report

**Phase Goal:** A clean, trustworthy Playwright baseline where every spec reflects the current v1.2 API surface — no legacy specs, no timing pitfalls, and the harness driver exposes all NIP-5D envelope helpers needed by subsequent phases.
**Verified:** 2026-04-17
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Zero legacy specs remain — no `window.nostr`, `signer-service`, `BusKind`, or `kind === 2900[12]` hits in `tests/e2e/*.spec.ts` | VERIFIED | `grep` returned exit 1 (zero matches) across all 11 surviving specs |
| 2 | `@playwright/test` at `^1.54.0` in root `package.json`; installed version >= 1.54 | VERIFIED | `package.json` devDependencies shows `^1.54.0`; `pnpm exec playwright --version` reports `1.59.1` |
| 3 | `playwright.config.ts` uses array `webServer` with 2 entries (ports 4173 and 4174) | VERIFIED | `webServer: [` found; entries target `@test/harness preview` on `:4173` and `@kehto/demo preview --port 4174` on `:4174` |
| 4 | `turbo.json` contains a `build:napplets` task with correct outputs | VERIFIED | `tasks["build:napplets"]` exists with `dependsOn: ["^build"]` and `outputs: ["apps/demo/napplets/*/dist/**"]`; `tasks["@kehto/demo#build"]` depends on it |
| 5 | All 7 new NIP-5D globals in `harness.ts` and declared in `globals.d.ts`; `__nappletReady__` also present | VERIFIED | All 8 tokens confirmed in both files; `harness.ts` is 482 lines (> 450 minimum); triple-slash reference replaces inline `declare global`; `NappletMessage` imported from `@napplet/core` |
| 6 | `tests/e2e/helpers/` exists with 3 files; `acl-enforcement.spec.ts` imports from `./helpers/index.js` | VERIFIED | `wait-for-napplet-ready.ts`, `acl-beforeEach.ts`, `index.ts` all present; `acl-enforcement.spec.ts` imports `aclBeforeEach` from `'./helpers/index.js'`; `await aclBeforeEach(page)` used in `beforeEach`; `page.reload` appears zero times in helpers |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/e2e/auth-handshake.spec.ts` | DELETED | VERIFIED | Does not exist |
| `tests/e2e/auth.spec.ts` | DELETED | VERIFIED | Does not exist |
| `tests/e2e/signer-delegation.spec.ts` | DELETED | VERIFIED | Does not exist |
| `tests/e2e/acl-matrix-signer.spec.ts` | DELETED | VERIFIED | Does not exist |
| `tests/e2e/acl-matrix-hotkey.spec.ts` | DELETED | VERIFIED | Does not exist |
| `tests/e2e/inter-pane.spec.ts` | DELETED | VERIFIED | Does not exist |
| `tests/e2e/state-isolation.spec.ts` | DELETED | VERIFIED | Does not exist |
| `package.json` | `@playwright/test: ^1.54.0` + `test:serve:demo` script | VERIFIED | Both confirmed |
| `playwright.config.ts` | Array `webServer` with 2 entries | VERIFIED | `webServer: [` present with correct commands |
| `turbo.json` | `build:napplets` task | VERIFIED | Task present with correct `dependsOn` and `outputs`; `@kehto/demo#build` override also present |
| `tests/e2e/harness/harness.ts` | 7 new globals + `__nappletReady__`; >= 450 lines | VERIFIED | 482 lines; all 8 globals assigned on `window.*` |
| `tests/e2e/harness/globals.d.ts` | `interface Window` declaring all globals | VERIFIED | File present; all 8 new + all legacy globals declared |
| `tests/e2e/helpers/wait-for-napplet-ready.ts` | Exports `waitForNappletReady`; polls `__nappletReady__` | VERIFIED | One named export; `__nappletReady__` referenced in body |
| `tests/e2e/helpers/acl-beforeEach.ts` | Exports `aclBeforeEach`; page.reload() ban documented; zero `page.reload()` calls | VERIFIED | Export present; "BANNED" token in leading doc-comment; 0 `page.reload` calls in function body |
| `tests/e2e/helpers/index.ts` | Re-exports both helpers | VERIFIED | Both `waitForNappletReady` and `aclBeforeEach` exported |
| `tests/e2e/acl-enforcement.spec.ts` | Imports from `./helpers/index.js` | VERIFIED | Import at line 9; `await aclBeforeEach(page)` at line 33 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tests/e2e/*.spec.ts` | zero legacy API terms | grep returns no matches | VERIFIED | `grep -rE "window\.nostr\|signer-service\|BusKind\|kind === 2900[12]"` exits 1 across all 11 surviving specs |
| `playwright.config.ts` | harness preview on :4173 | `command: 'pnpm --filter @test/harness preview'` | VERIFIED | Literal confirmed in file |
| `playwright.config.ts` | demo preview on :4174 | `command: 'pnpm --filter @kehto/demo preview --port 4174'` | VERIFIED | Literal confirmed in file |
| `turbo.json build:napplets` | `apps/demo/napplets/*/dist/**` | `outputs` glob | VERIFIED | `outputs` array contains the glob |
| `tests/e2e/helpers/wait-for-napplet-ready.ts` | `window.__nappletReady__(windowId)` | `page.waitForFunction` polling the harness global | VERIFIED | `__nappletReady__` appears in body |
| `tests/e2e/helpers/acl-beforeEach.ts` | `__aclClear__` + `__clearLocalStorage__` | `page.evaluate` invocations | VERIFIED | Both tokens present in function body |
| `tests/e2e/acl-enforcement.spec.ts` | helpers barrel | `import { aclBeforeEach } from './helpers/index.js'` | VERIFIED | Import at line 9 |
| `tests/e2e/harness/harness.ts` | `tests/e2e/harness/globals.d.ts` | `/// <reference path="./globals.d.ts" />` directive | VERIFIED | Directive at line 1; inline `declare global` block removed |

---

### Data-Flow Trace (Level 4)

Not applicable — this phase is infrastructure-only (no user-facing components, no data-rendering artifacts).

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — the test suite requires a running Playwright server (`pnpm preview`) and per E2E-11 cross-cutting rule, Playwright gates belong to Phase 17+. File-structure and type-check verification is the specified gate for Phase 16.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| E2E-01 | 16-01 | Obsolete legacy specs deleted; anti-term grep returns zero hits | SATISFIED | 7 specs deleted; grep exits 1 (no matches); 11 survivors match planning inventory |
| E2E-02 | 16-02 | `@playwright/test` at `^1.54.0`+ | SATISFIED | `package.json` shows `^1.54.0`; installed version is `1.59.1` |
| E2E-03 | 16-02 | Array `webServer` in `playwright.config.ts`; `build:napplets` in `turbo.json` | SATISFIED | Both confirmed in respective files |
| E2E-04 | 16-03 | Harness driver extended with 7 NIP-5D globals, all returning structured-clone-safe values | SATISFIED | All 7 globals assigned on `window.*` in `harness.ts`; all declared in `globals.d.ts`; returns are primitives/plain objects/deep clones |
| E2E-05 | 16-04 | `waitForNappletReady` and `aclBeforeEach` helpers exist; `acl-enforcement.spec.ts` migrated | SATISFIED | All 3 helper files exist; `acl-enforcement.spec.ts` imports from barrel and uses `aclBeforeEach(page)` |

All 5 requirement IDs declared in phase plans are accounted for. No orphaned requirements found for Phase 16 in REQUIREMENTS.md.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `tests/e2e/helpers/acl-beforeEach.ts` lines 4, 7 | `page.reload()` token appears | Info | These are inside the doc-comment block (the "WHY page.reload() IS BANNED" warning), not live code. Zero calls to `page.reload` in the function body. Not a stub. |
| `tests/e2e/acl-enforcement.spec.ts` line 379 | `__aclClear__()` call outside `beforeEach` | Info | Located inside a specific `ACL-09` test body simulating a clear-then-reload cycle. This is a legitimate targeted call to test ACL persistence, not a leftover from the old inline `beforeEach`. Not a regression. |

No blockers found.

---

### Human Verification Required

None. All automated checks pass and the phase is infrastructure-only (no visual, real-time, or external-service behavior to validate).

---

### Gaps Summary

No gaps. All 6 observable truths are verified against the actual codebase:

1. Seven legacy specs are permanently deleted.
2. Playwright is at the required version.
3. Both preview servers are wired into the Playwright config.
4. The turbo pipeline includes `build:napplets`.
5. All 7 NIP-5D harness globals (plus `__nappletReady__`) are implemented and type-declared.
6. The shared helpers module is complete and `acl-enforcement.spec.ts` has been migrated to use it.

Phase 16 goal is fully achieved. The E2E baseline is clean, trustworthy, and ready for Phase 17 work.

---

_Verified: 2026-04-17_
_Verifier: Claude (gsd-verifier)_
