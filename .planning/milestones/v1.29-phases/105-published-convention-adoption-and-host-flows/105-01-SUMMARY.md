---
phase: 105-published-convention-adoption-and-host-flows
plan: 01
subsystem: package-compatibility
tags: [pnpm, npm, jsr, napplet-core, napplet-nap, napplet-shim]
requires: []
provides:
  - "Published Kehto peer/dev declarations restricted to the verified @napplet/core/@napplet/nap 0.29 line."
  - "First install-consistent pnpm lock checkpoint with core/nap 0.29.0 and shim 0.27.0."
affects: [105-02, 105-03, 105-04, package-release]
tech-stack:
  added: []
  patterns:
    - "Public peer and matching development declarations stay within one verified upstream minor line."
    - "JSR import maps retain the repository caret convention while resolving the same released npm lineage."
key-files:
  created: []
  modified:
    - packages/acl/package.json
    - packages/acl/jsr.json
    - packages/cli/package.json
    - packages/firewall/package.json
    - packages/firewall/jsr.json
    - packages/paja/package.json
    - packages/paja/jsr.json
    - packages/runtime/package.json
    - packages/runtime/jsr.json
    - packages/services/package.json
    - packages/services/jsr.json
    - packages/shell/package.json
    - packages/shell/jsr.json
    - pnpm-lock.yaml
key-decisions:
  - "Use >=0.29.0 <0.30.0 for public core/nap peer and matching development ranges; retain JSR's established ^0.29.0 mapping convention."
  - "Pin @napplet/shim to 0.27.0 for shell development only; Kehto retains its host-owned NAP-SHELL prelude because the published generic packages omit mandatory shell."
patterns-established:
  - "Regenerate then frozen-materialize each ordered lock checkpoint before compiling package consumers."
requirements-completed: [PKG-01, PKG-02, PKG-04]
coverage:
  - id: D1
    description: "Published Kehto package declarations, JSR mappings, and lock importer checkpoint use the verified 0.29 release line."
    requirement: PKG-04
    verification:
      - kind: integration
        ref: "pnpm install --lockfile-only && pnpm install --frozen-lockfile; six published-package type-check commands"
        status: pass
      - kind: other
        ref: "git diff --check"
        status: pass
      - kind: unit
        ref: "pnpm test:unit"
        status: pass
    human_judgment: false
  - id: D2
    description: "Shell development keeps the non-shell shim separate from Kehto's retained mandatory host-owned NAP-SHELL prelude."
    requirement: PKG-02
    verification:
      - kind: other
        ref: "NAP-SHELL at napplet/naps@c5cd06f7be6d4690b303949abb26e87ff62f4729 plus npm and JSR release metadata inspection"
        status: pass
    human_judgment: false
metrics:
  duration: 6m
  completed: 2026-07-27
status: complete
---

# Phase 105 Plan 01: Published Package Compatibility Summary

**Kehto's published package declarations and generated lock checkpoint now consistently consume the official core/nap 0.29.0 line, with shim 0.27.0 retained only for non-shell development support.**

## Performance

- **Duration:** 6m
- **Started:** 2026-07-27T08:39:42Z
- **Completed:** 2026-07-27T08:46:04Z
- **Tasks:** 1
- **Files modified:** 15

## Accomplishments

- Raised the seven published Kehto package declarations to `>=0.29.0 <0.30.0` wherever their emitted declarations use core or nap.
- Moved all six JSR core/nap mappings to the released 0.29 lineage and pinned shell's development-only generic shim to `0.27.0`.
- Generated, frozen-materialized, inspected, and compiled against the first ordered package lock checkpoint.

## Task Commits

1. **Task 1: Align published Kehto declarations and generate lock checkpoint 1** - `6a502b9` (chore)
2. **Post-wave Rule 1: Align stale SDK migration range guard** - `ed1506b` (fix)

## Files Created/Modified

- `packages/{acl,firewall,paja,runtime,services,shell}/jsr.json` - Resolve the released core/nap 0.29.0 JSR line.
- `packages/{acl,cli,firewall,paja,runtime,services,shell}/package.json` - Publish 0.29-bounded core/nap declarations and exact development shim 0.27.0.
- `pnpm-lock.yaml` - Generated importer and shared package snapshots for the first sequential checkpoint.

## Decisions Made

- Checked NAP-SHELL at `napplet/naps@c5cd06f7be6d4690b303949abb26e87ff62f4729`; it still mandates `window.napplet.shell`, exactly-once init, and local synchronous `supports()`. The published core/nap/shim release metadata confirms the planned 0.29.0/0.29.0/0.27.0 line, but does not replace Kehto's host-owned shell prelude.
- Kept existing JSR caret import-map style at `^0.29.0`, which resolves the verified current 0.29.0 release and remains aligned with the npm public-range boundary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated stale public-package range assertions in the SDK migration guard**
- **Found during:** Post-wave integration gate after Task 1
- **Issue:** `tests/unit/sdk-migration-guard.test.ts` still required the retired `>=0.23.0 <=0.28.x` public core/nap range and described the 0.28 line, causing the full unit suite to reject this plan's intentional 0.29 package declarations.
- **Fix:** Updated only the published-package-line test title and peer/development expectations to `>=0.29.0 <0.30.0`.
- **Files modified:** `tests/unit/sdk-migration-guard.test.ts`
- **Verification:** Focused guard passed; `pnpm test:unit` passed (115 files, 1,495 tests); `git diff --check` passed.
- **Committed in:** `ed1506b` (separate Rule 1 fix commit)

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Necessary regression-guard maintenance only; no app or fixture pins, package declarations beyond Task 1, or later-plan guard work were changed.

## Issues Encountered

`pnpm` reported existing unrelated peer-dependency warnings and ignored `esbuild` build scripts. The frozen install, generated lock checkpoint, all six package type-checks, focused migration guard, and full unit suite still completed successfully; no dependency or configuration changes were made outside the plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plans 02 through 04 can now make their strictly ordered app, fixture, and final package-line updates from an install-consistent 0.29 lock baseline.

## Self-Check

PASSED - all 14 planned artifacts plus the Rule 1 guard update and summary exist; commits `6a502b9` and `ed1506b` are present in git history; focused and full unit checks plus `git diff --check` pass.

---
*Phase: 105-published-convention-adoption-and-host-flows*
*Plan: 01*
*Completed: 2026-07-27*
