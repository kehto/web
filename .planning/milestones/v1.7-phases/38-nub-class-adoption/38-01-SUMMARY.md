---
phase: 38-nub-class-adoption
plan: 01
subsystem: runtime
tags: [nub-class, session-entry, shell-bridge, types, changeset]

# Dependency graph
requires:
  - phase: 37-spec-resync-foundation-gates
    provides: provisional-class.ts with NappletClass + ClassAssignmentPayload; 54/0/0 E2E baseline
provides:
  - "NappletClass inline alias in packages/runtime/src/types.ts (module-boundary safe)"
  - "SessionEntry.class: NappletClass field in runtime + shell types"
  - "onNip5dIframeCreate hook return type expanded with required class: NappletClass (breaking CLASS-01)"
  - "shell.init envelope carries inline class read from session entry (CLASS-02, C-01 prevention)"
  - "registerSessionEntry stamps class: null for all 10 DEMO_NAPPLETS (D2 preserved)"
  - "Minor-bump changeset .changeset/class-01-breaking-hook.md for @kehto/shell"
affects: [38-02, 38-03, hyprgate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline type alias duplication for module-boundary isolation (NappletClass in runtime mirrors shell provisional file)"
    - "Synchronous class posture resolution at iframe creation — no async envelope (C-01 prevention)"
    - "D2 permissive default: class null for all existing napplets at session-entry registration"

key-files:
  created:
    - ".changeset/class-01-breaking-hook.md"
    - ".planning/phases/38-nub-class-adoption/38-ITERATION-LOG.md"
  modified:
    - "packages/runtime/src/types.ts"
    - "packages/shell/src/types.ts"
    - "packages/shell/src/shell-bridge.ts"
    - "packages/shell/src/shell-bridge.test.ts"
    - "packages/shell/src/keys-forwarder.test.ts"
    - "packages/runtime/src/test-utils.ts"
    - "packages/runtime/src/types.test.ts"
    - "apps/demo/src/shell-host.ts"

key-decisions:
  - "NappletClass duplicated inline in runtime/types.ts (not imported from shell) to preserve module-boundary isolation"
  - "shell.init carries class synchronously (read from session entry) — no async class.assigned envelope (C-01)"
  - "class: null is the permissive default for all 10 DEMO_NAPPLETS (D2)"
  - "Breaking hook change is minor bump for @kehto/shell; coordinated in parallel with hyprgate (not blocking)"

patterns-established:
  - "SessionEntry.class: NappletClass is the canonical class posture storage; all registries stamp it at creation"
  - "shell.init carries class inline immediately after shell.ready — before any NUB request can arrive"

requirements-completed: [CLASS-01, CLASS-02, CLASS-06]

# Metrics
duration: 25min
completed: 2026-04-24
---

# Phase 38 Plan 01: Type + Session Foundation Summary

**NappletClass inline alias in runtime/types.ts + SessionEntry.class field + breaking onNip5dIframeCreate hook + shell.init class inline emission, all with permissive null defaults for 10 DEMO_NAPPLETS**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-24T12:45:00Z
- **Completed:** 2026-04-24T13:10:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Added `NappletClass = string | null` inline alias in `packages/runtime/src/types.ts` (module-boundary safe — runtime never imports from shell)
- Extended `SessionEntry` in both `packages/runtime/src/types.ts` and `packages/shell/src/types.ts` with required `class: NappletClass` field (CLASS-02)
- Broke `ShellAdapter.onNip5dIframeCreate` hook with new required `class: NappletClass` in return type (CLASS-01); changeset documents minor bump for `@kehto/shell`
- Wired synchronous class into `shell.init` envelope in `shell-bridge.ts` — reads `runtime.sessionRegistry.getEntryByWindowId(windowId)?.class` before postMessage; no async `class.assigned` envelope (C-01 prevention)
- Stamped `class: null` in `apps/demo/src/shell-host.ts::registerSessionEntry` for all 10 DEMO_NAPPLETS (D2 permissive default)
- Updated all SessionEntry test fixtures across 4 test files with `class: null` to satisfy the required field

## Task Commits

All three tasks committed as a single atomic plan commit (per Task 3 Step 4 specification):

1. **Tasks 1-3 combined** — `4c3a3eb` (feat: CLASS-01, CLASS-02, CLASS-06 type foundation)

## Files Created/Modified

- `packages/runtime/src/types.ts` — Added `NappletClass` inline alias + `SessionEntry.class: NappletClass` field
- `packages/shell/src/types.ts` — Added `NappletClass` import + `SessionEntry.class` + expanded `onNip5dIframeCreate` return type
- `packages/shell/src/shell-bridge.ts` — Added `NappletClass` import + inline class emission in `shell.init` handler
- `packages/shell/src/shell-bridge.test.ts` — Updated `makeSessionEntry` factory with `class: null`
- `packages/shell/src/keys-forwarder.test.ts` — Updated `makeSessionEntry` factory with `class: null`
- `packages/runtime/src/test-utils.ts` — Updated `createNip5dSessionEntry` with `class: null`
- `packages/runtime/src/types.test.ts` — Updated `makeEntry` factory with `class: null`
- `apps/demo/src/shell-host.ts` — Updated `registerSessionEntry` with `class: null` (D2 permissive default)
- `.changeset/class-01-breaking-hook.md` — Minor bump changeset for `@kehto/shell`
- `.planning/phases/38-nub-class-adoption/38-ITERATION-LOG.md` — Plan 38-01 incremental gate log

## Decisions Made

- Duplicated `NappletClass = string | null` inline in `packages/runtime/src/types.ts` rather than importing from `packages/shell/src/types/provisional-class.ts` — module boundary mandates runtime not import from shell; trivial 1-line type is the minimum viable surface until `@napplet/nub/class@^0.3.0` publishes
- Shell's `types.ts` also has its own `SessionEntry` re-declaration (not just re-exporting from runtime) — both needed `class` field to stay in sync

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Additional SessionEntry fixtures in packages/runtime/src/test-utils.ts and packages/runtime/src/types.test.ts**
- **Found during:** Task 1 (type-check iteration after SessionEntry.class added)
- **Issue:** Plan's `read_first` noted `shell-bridge.test.ts` fixture; type-check revealed two additional runtime fixture factories (`createNip5dSessionEntry` in test-utils.ts, `makeEntry` in types.test.ts) also needed `class: null`
- **Fix:** Added `class: null` to both factories
- **Files modified:** `packages/runtime/src/test-utils.ts`, `packages/runtime/src/types.test.ts`
- **Verification:** `pnpm --filter @kehto/runtime type-check` exits 0
- **Committed in:** `4c3a3eb`

**2. [Rule 3 - Blocking] Shell's keys-forwarder.test.ts makeSessionEntry factory**
- **Found during:** Task 1 (shell type-check iteration)
- **Issue:** Plan noted `shell-bridge.test.ts` explicitly; type-check also flagged `keys-forwarder.test.ts::makeSessionEntry` which had its own factory
- **Fix:** Added `class: null` to keys-forwarder.test.ts factory
- **Files modified:** `packages/shell/src/keys-forwarder.test.ts`
- **Verification:** `pnpm --filter @kehto/shell type-check` exits 0
- **Committed in:** `4c3a3eb`

**3. [Rule 2 - Missing Critical] Shell types.ts has its own SessionEntry declaration**
- **Found during:** Task 1 (reading shell/src/types.ts line 41)
- **Issue:** Plan mentioned runtime/src/types.ts as the canonical SessionEntry; shell/src/types.ts separately re-declares SessionEntry (not importing from runtime). Both needed `class: NappletClass` for the shell's type-check to pass.
- **Fix:** Added `class: NappletClass` field to shell/src/types.ts SessionEntry
- **Files modified:** `packages/shell/src/types.ts`
- **Verification:** `pnpm --filter @kehto/shell type-check` exits 0
- **Committed in:** `4c3a3eb`

---

**Total deviations:** 3 auto-fixed (all Rule 2/3 — blocking type errors from SessionEntry fixtures not explicitly listed in plan + shell's independent SessionEntry declaration)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Verification Grid

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `grep -c "class: NappletClass" packages/shell/src/types.ts` | >= 1 | 2 (SessionEntry + onNip5dIframeCreate) | PASS |
| `grep -c "class: NappletClass" packages/runtime/src/types.ts` | 1 | 1 | PASS |
| `grep -c "export type NappletClass" packages/runtime/src/types.ts` | 1 | 1 | PASS |
| `grep -c "import type { NappletClass } from './types/provisional-class" packages/shell/src/types.ts` | 1 | 1 | PASS |
| `grep -c "class: resolvedClass" packages/shell/src/shell-bridge.ts` | 1 | 1 | PASS |
| `grep -c "class: null" apps/demo/src/shell-host.ts` | >= 1 | 2 | PASS |
| `grep -rl "from '@kehto/shell'" packages/runtime/src/` | empty | empty | PASS |
| `class.assigned` in shell/runtime/demo (non-comment) | 0 | 0 (2 doc-comments only) | PASS |
| `test -f .changeset/class-01-breaking-hook.md` | exists | exists | PASS |
| `grep -c '"@kehto/shell": minor' .changeset/class-01-breaking-hook.md` | 1 | 1 | PASS |
| `pnpm type-check` | 0 (10/10 tasks) | 0 (10/10 tasks) | PASS |
| `pnpm build` | 0 (24/24 tasks) | 0 (24/24 tasks) | PASS |

## Issues Encountered

None beyond the auto-fixed deviations above.

## Next Phase Readiness

- Plan 38-02 (enforce.ts class pre-filter) is unblocked: `SessionEntry.class` is now readable via `sessionRegistry.getEntryByWindowId(windowId)?.class`
- `NappletClass` type is available in both runtime and shell without cross-boundary imports
- Changeset staged for publish at v1.7 milestone close
- Hyprgate can coordinate `onNip5dIframeCreate` update in parallel (breaking change documented in changeset)

---
*Phase: 38-nub-class-adoption*
*Completed: 2026-04-24*
