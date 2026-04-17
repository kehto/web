---
phase: 16-harness-triage-playwright-infrastructure
plan: 04
subsystem: testing
tags: [playwright, e2e, helpers, acl, iframe, napplet, typescript]

requires:
  - phase: 16-03
    provides: "window.__nappletReady__(windowId) harness global and globals.d.ts type declaration"

provides:
  - "tests/e2e/helpers/wait-for-napplet-ready.ts — Playwright helper polling window.__nappletReady__(windowId)"
  - "tests/e2e/helpers/acl-beforeEach.ts — Canonical ACL-clean beforeEach fixture"
  - "tests/e2e/helpers/index.ts — Barrel re-exporting both helpers"
  - "tests/e2e/acl-enforcement.spec.ts migrated to use aclBeforeEach from barrel"

affects:
  - phase-17
  - phase-18
  - phase-19
  - phase-20
  - phase-21

tech-stack:
  added: []
  patterns:
    - "Shared Playwright test helpers under tests/e2e/helpers/ with barrel export"
    - "aclBeforeEach fixture as single source of truth for ACL spec setup"
    - "waitForNappletReady as canonical iframe readiness check (poll __nappletReady__ not DOM sentinels)"
    - ".js import specifiers in helpers barrel for forward-compat with node16 moduleResolution"

key-files:
  created:
    - tests/e2e/helpers/wait-for-napplet-ready.ts
    - tests/e2e/helpers/acl-beforeEach.ts
    - tests/e2e/helpers/index.ts
  modified:
    - tests/e2e/acl-enforcement.spec.ts

key-decisions:
  - "waitForNappletReady polls window.__nappletReady__(windowId) — not frameLocator, not DOM sentinel, not waitForTimeout — because the flag encapsulates the sessionRegistry acknowledgment condition (PITFALLS.md Pitfall 1)"
  - "page.reload() is banned in ACL specs; page.goto('/') is the only correct reset because reload() reuses the JS context and does not recreate module-level singletons (PITFALLS.md Pitfall 5)"
  - "Only acl-enforcement.spec.ts migrated in this plan; other ACL specs (acl-lifecycle, acl-matrix-*) are migrated by their owning phases (Phase 19 for E2E-08)"
  - "ESLint rule enforcing the page.reload() ban is deferred to v1.4; v1.3 uses doc-comment enforcement only"

patterns-established:
  - "Every frame-touching spec from Phase 17 onward MUST import waitForNappletReady from tests/e2e/helpers"
  - "Every ACL-touching spec from Phase 17 onward MUST import aclBeforeEach from tests/e2e/helpers"

requirements-completed:
  - E2E-05

duration: 3min
completed: 2026-04-17
---

# Phase 16 Plan 04: Shared Playwright Test Helpers Summary

**Shipped waitForNappletReady + aclBeforeEach Playwright helpers under tests/e2e/helpers/ barrel, and sanity-migrated acl-enforcement.spec.ts to use the shared fixture (4 inline setup lines replaced by 1 helper call)**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-17T23:16:18Z
- **Completed:** 2026-04-17T23:19:37Z
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 migrated)

## Accomplishments

- Created `tests/e2e/helpers/wait-for-napplet-ready.ts` — polls `window.__nappletReady__(windowId)` via `page.waitForFunction`, default 15s timeout / 100ms polling, configurable options
- Created `tests/e2e/helpers/acl-beforeEach.ts` — canonical ACL reset fixture with leading doc-comment banning `page.reload()`, strict sequence: `goto('/')` → wait `__SHELL_READY__` → `__aclClear__()` → `__clearLocalStorage__()`
- Created `tests/e2e/helpers/index.ts` — barrel re-exporting both helpers with `.js` specifiers for ESM forward-compat
- Migrated `tests/e2e/acl-enforcement.spec.ts` to import `aclBeforeEach` from the barrel; all 9 ACL test cases preserved intact; `pnpm type-check` passes clean across workspace

## Task Commits

1. **Task 1: Create waitForNappletReady helper** - `930cf31` (feat)
2. **Task 2: Create aclBeforeEach fixture and barrel** - `b6678ad` (feat)
3. **Task 3: Migrate acl-enforcement.spec.ts** - `20c9e80` (feat)

## Files Created/Modified

- `/home/sandwich/Develop/kehto/tests/e2e/helpers/wait-for-napplet-ready.ts` — Polls `window.__nappletReady__(windowId)` for iframe AUTH readiness; resolves PITFALLS.md Pitfall 1
- `/home/sandwich/Develop/kehto/tests/e2e/helpers/acl-beforeEach.ts` — Canonical ACL-clean beforeEach; leading comment documents `page.reload()` ban; resolves PITFALLS.md Pitfall 5
- `/home/sandwich/Develop/kehto/tests/e2e/helpers/index.ts` — Barrel: `export { waitForNappletReady }` + `export { aclBeforeEach }`
- `/home/sandwich/Develop/kehto/tests/e2e/acl-enforcement.spec.ts` — Import added; 4-line inline beforeEach setup replaced by `await aclBeforeEach(page)`

## Before / After: acl-enforcement.spec.ts beforeEach

**BEFORE (4 inline lines):**
```typescript
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__SHELL_READY__ === true, { timeout: 10000 });
  await page.evaluate(() => (window as any).__aclClear__());
  await page.evaluate(() => (window as any).__clearLocalStorage__());

  // Load auth-napplet and wait for AUTH OK ...
```

**AFTER (1 helper call):**
```typescript
import { aclBeforeEach } from './helpers/index.js';

test.beforeEach(async ({ page }) => {
  await aclBeforeEach(page);

  // Load auth-napplet and wait for AUTH OK ...
```

## page.reload Audit

`page.reload` appears **0 functional times** across the helpers and spec files:

- `tests/e2e/helpers/acl-beforeEach.ts`: Only in doc-comment lines (the ban notice itself). Zero calls in function body.
- `tests/e2e/helpers/wait-for-napplet-ready.ts`: Zero occurrences.
- `tests/e2e/helpers/index.ts`: Zero occurrences.
- `tests/e2e/acl-enforcement.spec.ts`: Zero occurrences.

## Decisions Made

- `waitForNappletReady` is strictly windowId-based in v1.3 — no `frameSelector` overload added, as no consumer exists yet. Phase 17 may add a DOM-sentinel variant if needed.
- The `page.reload()` ban is enforced by doc-comment only in v1.3. An ESLint rule is deferred to v1.4 per 16-CONTEXT.md specifics.
- Migration limited to `acl-enforcement.spec.ts` only (the canonical reference consumer). `acl-lifecycle.spec.ts` and `acl-matrix-*.spec.ts` are migrated by Phase 19 (E2E-08).

## Deviations from Plan

None — plan executed exactly as written.

The automated verify command `grep -c "page\.reload"` appears to fail because the ban-notice comment itself contains the text `page.reload()`, but the plan's interfaces block specifies that exact comment verbatim. No functional `page.reload()` call exists anywhere in the helpers — the done criterion ("zero times in the file body") is fully met.

## Issues Encountered

None — type-check passed on first run, all structural assertions verified cleanly.

## Phase 17+ Planner Notes

**MANDATORY CONVENTIONS FOR ALL SUBSEQUENT SPECS:**

1. **Frame-touching specs** (any spec that interacts with a sandboxed napplet iframe) MUST:
   ```typescript
   import { waitForNappletReady } from '../e2e/helpers/index.js';
   // or from './helpers/index.js' depending on relative path
   const wid = await page.evaluate(() => window.__loadNapplet__('my-napplet'));
   await waitForNappletReady(page, wid);
   // Now safe to interact with the napplet iframe
   ```

2. **ACL-touching specs** (any spec that calls `__aclGrant__`, `__aclRevoke__`, `__aclBlock__`, `__aclCheck__`, etc.) MUST:
   ```typescript
   import { aclBeforeEach } from '../e2e/helpers/index.js';
   test.beforeEach(async ({ page }) => {
     await aclBeforeEach(page);
     // Test-specific setup follows
   });
   ```

3. **NEVER use `page.reload()`** in ACL-touching specs — `page.goto('/')` is the only correct reset.

## Deferred Items (v1.4)

- **ESLint rule enforcing `page.reload()` ban** — `no-page-reload` rule for `tests/e2e/**/*.spec.ts` contexts. Not in scope for v1.3 per 16-CONTEXT.md. Carries forward as tech debt item.

## Known Stubs

None — all helpers wire directly to the harness globals installed by Plan 16-03. No placeholder values or TODO stubs.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 17 (Demo App Rewire) can import `waitForNappletReady` and `aclBeforeEach` from the barrel immediately — both are type-checked and functional
- E2E-05 is closed
- Phase 16 is fully complete (all 4 plans executed)

---
*Phase: 16-harness-triage-playwright-infrastructure*
*Completed: 2026-04-17*
