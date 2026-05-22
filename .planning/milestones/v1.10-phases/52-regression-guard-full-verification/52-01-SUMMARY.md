---
phase: 52-regression-guard-full-verification
plan: 01
status: completed
completed_at: 2026-05-22T13:04:00+02:00
requirements_completed:
  - GRAPH-01
  - GUARD-02
  - E2E-31
  - E2E-32
  - DOCS-09
---

# Phase 52 Plan 01 Summary

**Completed:** 2026-05-22
**Plan:** 52-01
**Status:** Complete

## Changes Made

### Regression Guard

- Extended `tests/unit/sdk-migration-guard.test.ts` with separate SDK and helper target groups.
- Kept the original 18 SDK-migrated demo/fixture package assertions requiring exact `@napplet/sdk`, `@napplet/shim`, `@napplet/nub`, and `@napplet/vite-plugin` `0.3.0`.
- Added `apps/playground/napplets/decrypt-demo` to the helper graph guard requiring exact `@napplet/shim`, `@napplet/nub`, and `@napplet/vite-plugin` `0.3.0` without requiring `@napplet/sdk`.
- Added lockfile assertions rejecting old active helper graph package keys for `@napplet/{core,shim,vite-plugin}@0.2.1` and split `@napplet/nub-* @0.2.1` packages.
- Added decrypt-demo source assertions requiring `identityDecrypt` and rejecting the deleted manual request counter, pending response map, and raw `identity.decrypt` postMessage request pattern.

### Current Documentation / Release Notes

- Updated decrypt-demo and playground E2E comments to describe the current `identityDecrypt` helper path.
- Updated README package-graph guidance to reflect the current `0.3.0` napplet helper graph with no workspace override.
- Updated the config service header from the old `@napplet/nub/config` `^0.2.1` reference to `^0.3.0`.
- Added `.changeset/v1-10-decrypt-demo-helper-parity.md` for the playground-facing decrypt-demo helper migration.

## Requirements Closed

- GRAPH-01
- GUARD-02
- E2E-31
- E2E-32
- DOCS-09

## Verification Summary

- Focused guard/shell unit tests: 2 files passed, 11 tests passed.
- Focused decrypt-demo Playwright spec: 1 passed after 27/27 build.
- API docs generation: 0 errors, 15 existing TypeDoc warnings.
- Full build: 27/27 packages successful.
- Full type-check: 11/11 tasks successful.
- Full unit suite: 32 files passed, 548 tests passed.
- Full Playwright suite: 86 passed.
- Lint: command succeeded; turbo reported no configured lint tasks.

## Notes

- Unit count increased from the v1.9 baseline by three because this phase added three guard assertions.
- Historical changesets and migration documents that mention older `0.2.1` behavior remain as point-in-time records.
