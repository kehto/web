---
phase: 105-published-convention-adoption-and-host-flows
plan: 02
subsystem: package-compatibility
tags: [pnpm, napplet-core, napplet-nap, napplet-shim, napplet-sdk, vite]
requires:
  - phase: 105-01
    provides: "Published Kehto 0.29 package declarations and the first generated lock checkpoint."
provides:
  - "Exact published Napplet pins for the playground host and application group A."
  - "Second generated and frozen-materialized pnpm lock checkpoint."
affects: [105-03, package-release, playground, napplet-fixtures]
tech-stack:
  added: []
  patterns:
    - "App manifests use exact published Napplet versions and each ordered lock checkpoint is regenerated then frozen-materialized."
    - "Migration guards accept only complete known package lines while manifests are upgraded in planned groups."
key-files:
  created: []
  modified:
    - apps/playground/package.json
    - apps/playground/napplets/feed/package.json
    - pnpm-lock.yaml
    - tests/unit/sdk-migration-guard.test.ts
key-decisions:
  - "Keep the active lock guard on the published 0.29 release line while allowing only complete legacy or published lines in manifests until Plan 03 finishes the ordered migration."
patterns-established:
  - "Regenerate then frozen-materialize each ordered app lock checkpoint before compiling consumers."
requirements-completed: [PKG-03, PKG-04]
coverage:
  - id: D1
    description: "Playground host and the first eight napplet apps consume exact published core/nap 0.29.0, shim 0.27.0, SDK 0.25.0, and Vite plugin 0.12.0 versions where present."
    requirement: PKG-03
    verification:
      - kind: integration
        ref: "pnpm install --lockfile-only && pnpm install --frozen-lockfile && pnpm --filter @kehto/playground build && pnpm --filter @kehto/demo-feed build"
        status: pass
      - kind: unit
        ref: "tests/unit/sdk-migration-guard.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The second generated lock checkpoint resolves the exact group-A application dependencies and the verified package snapshots."
    requirement: PKG-04
    verification:
      - kind: integration
        ref: "pnpm install --lockfile-only && pnpm install --frozen-lockfile"
        status: pass
      - kind: other
        ref: "git diff --check"
        status: pass
    human_judgment: false
metrics:
  duration: 10m
  completed: 2026-07-27
status: complete
---

# Phase 105 Plan 02: Playground Application Group A Summary

**The playground host and its first eight napplet apps now pin the verified published Napplet release line, backed by a regenerated and frozen-materialized lock checkpoint.**

## Performance

- **Duration:** 10m
- **Started:** 2026-07-27T08:48:00Z
- **Completed:** 2026-07-27T08:57:25Z
- **Tasks:** 1
- **Files modified:** 11

## Accomplishments

- Pinned every present Group-A app dependency to core/nap `0.29.0`, shim `0.27.0`, SDK `0.25.0`, and Vite plugin `0.12.0` without adding unused packages.
- Regenerated lock checkpoint 2, frozen-materialized the workspace, and confirmed the scoped importer and installed-link versions.
- Preserved the Plan 01 host-owned NAP-SHELL exception: NAP-SHELL remains mandatory under `napplet/naps@5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`, while the published generic shim remains non-shell.

## Task Commits

1. **Task 1: Pin playground application group A and regenerate its lock importers** - `73edcea` (chore)
2. **Rule 1: Preserve staged package graph guard** - `43ca36c` (fix)

## Files Created/Modified

- `apps/playground/package.json` - Pins the playground host Vite plugin to `0.12.0`.
- `apps/playground/napplets/{ble-demo,bot,chat,common-demo,composer,cvm-relatr,feed,link-demo}/package.json` - Pins each consumed published Napplet package exactly.
- `pnpm-lock.yaml` - Records the generated Group-A importer and shared package snapshots.
- `tests/unit/sdk-migration-guard.test.ts` - Enforces a complete release line per manifest during the planned, ordered upgrade.

## Decisions Made

- Rechecked npm release metadata for core/nap `0.29.0`, shim `0.27.0`, SDK `0.25.0`, and Vite plugin `0.12.0`; their integrity data and dependency links match the Phase 105 research matrix.
- Rechecked NAP-SHELL from `napplet/naps@5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`; Kehto retains its conformant host-owned prelude because the published generic shim does not provide the mandatory shell surface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved the staged package-graph guard during the ordered migration**
- **Found during:** Task 1 post-task full unit suite
- **Issue:** `tests/unit/sdk-migration-guard.test.ts` required the retired 0.28/0.26.8/0.24.4/0.11.2 line for every app, so it rejected Group-A's planned exact 0.29/0.27.0/0.25.0/0.12.0 pins before Plan 03 updates the remaining manifests.
- **Fix:** Kept the lock-snapshot assertion on the published 0.29 line and changed manifest assertions to allow only a complete legacy or published line; mixed package versions still fail.
- **Files modified:** `tests/unit/sdk-migration-guard.test.ts`
- **Verification:** Focused guard and full `pnpm test:unit` pass (115 files, 1,495 tests).
- **Committed in:** `43ca36c`

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Necessary stale-guard maintenance only; all Group-B app and fixture manifests remain reserved for Plan 03.

## Issues Encountered

- Existing peer-dependency warnings and ignored `esbuild` build scripts were reported by pnpm, but both required install modes and all build/test verification completed successfully.
- The repository’s `.aislop` configuration is present, but its scanner is CI-only in this checkout; no local executable was available to run and no unverified package was installed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03 can pin Group-B apps and browser fixtures from this frozen Group-A lock baseline; the staged graph guard will reject any mixed manifest until that completion step lands.

## Self-Check

PASSED - all ten planned dependency artifacts, the Rule 1 guard update, and this summary exist; commits `73edcea` and `43ca36c` are present; `git diff --check` passes.

---
*Phase: 105-published-convention-adoption-and-host-flows*
*Plan: 02*
*Completed: 2026-07-27*
