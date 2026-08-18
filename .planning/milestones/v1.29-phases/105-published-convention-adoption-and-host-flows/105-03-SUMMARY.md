---
phase: 105-published-convention-adoption-and-host-flows
plan: 03
subsystem: package-compatibility
tags: [pnpm, napplet-core, napplet-nap, napplet-shim, napplet-sdk, vite]
requires:
  - phase: 105-02
    provides: "Exact published Napplet pins for the playground host and application group A."
provides:
  - "Exact published Napplet pins for the remaining playground apps and browser fixtures."
  - "Third generated and frozen-materialized pnpm lock checkpoint."
affects: [105-04, package-release, playground, napplet-fixtures]
tech-stack:
  added: []
  patterns:
    - "Every direct app and fixture consumer uses exact published Napplet versions."
    - "Each ordered lock checkpoint is regenerated, frozen-materialized, and checked against installed links."
key-files:
  created: []
  modified:
    - apps/playground/napplets/lists-demo/package.json
    - apps/playground/napplets/preferences/package.json
    - apps/playground/napplets/profile-viewer/package.json
    - apps/playground/napplets/resource-demo/package.json
    - apps/playground/napplets/serial-demo/package.json
    - apps/playground/napplets/toaster/package.json
    - apps/playground/napplets/webrtc-demo/package.json
    - tests/fixtures/napplets/nap-identity/package.json
    - tests/fixtures/napplets/nap-inc/package.json
    - tests/fixtures/napplets/nap-notify/package.json
    - tests/fixtures/napplets/nap-relay/package.json
    - tests/fixtures/napplets/nap-storage/package.json
    - tests/fixtures/napplets/nap-theme/package.json
    - pnpm-lock.yaml
key-decisions:
  - "Keep each remaining direct consumer on exact core/nap 0.29.0, shim 0.27.0, SDK 0.25.0, and Vite plugin 0.12.0 pins where applicable."
  - "Retain the approved host-owned NAP-SHELL prelude exception; the published generic shim remains non-shell."
metrics:
  duration: 10m
  completed: 2026-07-27
status: complete
---

# Phase 105 Plan 03: Remaining Consumer Pins Summary

**Every remaining playground napplet and existing browser fixture now resolves the same exact published Napplet release line from the third generated lock checkpoint.**

## Performance

- **Duration:** 10m
- **Completed:** 2026-07-27
- **Tasks:** 1/1
- **Files modified:** 14

## Accomplishments

- Pinned each present group-B application and fixture dependency to core/nap `0.29.0`, shim `0.27.0`, SDK `0.25.0`, and Vite plugin `0.12.0` without adding unused dependencies or a new intent fixture.
- Regenerated lock checkpoint 3 with `pnpm install --lockfile-only`, then frozen-materialized it successfully.
- Confirmed all 13 manifest pins, corresponding lock importers, and installed package links select the audited release line.

## Verification

- `pnpm install --lockfile-only` — passed.
- `pnpm install --frozen-lockfile` — passed.
- `pnpm --filter @kehto/demo-profile-viewer build` — passed.
- `pnpm --filter @kehto/demo-resource-demo build` — passed.
- `pnpm exec vitest run tests/unit/sdk-migration-guard.test.ts` — passed (1 file, 9 tests).
- `pnpm test:unit` — passed (115 files, 1,495 tests).
- Exact manifest, generated-importer, and installed-link inspection — passed for all 13 consumers.
- `git diff --check` — passed.

## Task Commits

1. **Task 1: Pin application group B and every existing browser fixture** — `ee339ab` (chore)

## Decisions Made

- Rechecked npm metadata and integrity for core/nap `0.29.0`, shim `0.27.0`, SDK `0.25.0`, and Vite plugin `0.12.0`; the published dependency links remain coherent with the Phase 105 package matrix.
- Rechecked NAP-SHELL at local `napplet/naps@c5cd06f7be6d4690b303949abb26e87ff62f4729`: it still mandates `window.napplet.shell`, a one-time `shell.init` after the first `shell.ready`, and synchronous local `supports()`. This manifest-only plan preserves the approved Kehto host-owned prelude exception.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Repaired the obsolete shared-worktree sentinel**
- **Found during:** Task 1 commit precondition.
- **Issue:** The executor sentinel still recorded the removed sibling worktree path `/Users/sandwich/Develop/kehto-napplet-scheme-conformance`, while Git registered the approved canonical worktree at `/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance`; the mandatory cwd guard therefore halted staging.
- **Fix:** With explicit orchestrator approval, updated only `.git/worktrees/kehto-napplet-scheme-conformance/gsd-spawn-toplevel` to the registered canonical root, then re-ran the cwd and approved-branch guards successfully.
- **Files modified:** Git worktree metadata sentinel only; no repository file changed as part of the repair.
- **Verification:** `git rev-parse --show-toplevel` matches the repaired sentinel, and the task commit was created on the approved `chore/napplet-scheme-conformance` branch.
- **Commit:** N/A — Git administrative metadata is outside the repository worktree.

**Total deviations:** 1 auto-fixed (Rule 3).
**Impact on plan:** The repair restored the mandated guard after an intentional worktree move; it did not broaden dependency, fixture, or lockfile scope.

## Issues Encountered

- `pnpm` reported pre-existing peer-dependency warnings and ignored `esbuild` build scripts; both required install modes, builds, and all unit checks passed without dependency/configuration changes.
- The local AI-slop scanner is CI-only in this checkout; no executable is installed. This matches the prior plan checkpoint and did not block the required verification gates.

## User Setup Required

None.

## Next Phase Readiness

Plan 04 can now validate the complete active package graph and retain the host-owned NAP-SHELL prelude guard against a single exact consumer line.

## Self-Check

PASSED - all 14 planned artifacts and this summary exist; task commit `ee339ab` is present in history; the manifest, importer, installed-link, build, focused guard, full unit, and diff checks pass.
