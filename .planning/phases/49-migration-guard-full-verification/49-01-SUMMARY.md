---
phase: 49-migration-guard-full-verification
plan: 01
status: completed
completed_at: 2026-05-22T12:03:14+02:00
requirements:
  - SDK-03
  - GUARD-01
  - E2E-29
  - E2E-30
  - DOCS-08
---

# Phase 49 - Plan 01 Summary

## Result

Phase 49 locked the v1.9 SDK migration with a unit guard, cleaned stale namespace-import prose, proved the active 18-package graph no longer resolves old `@napplet/sdk`, and restored the full v1.8 Playwright baseline at 86/86.

## Changes Made

- Added `tests/unit/sdk-migration-guard.test.ts` covering all 18 migrated demo/fixture package directories.
- The guard asserts exact `0.3.0` versions for `@napplet/sdk`, `@napplet/shim`, `@napplet/nub`, and `@napplet/vite-plugin`, and fails on any migrated source import from `@napplet/sdk`.
- Updated fixture README, E2E descriptions, and active napplet comments so current examples refer to direct helper imports and preserve dotted names only as wire-envelope/debugger strings.
- Fixed `nub-identity` E2E setup to install a deterministic mock signer before loading the fixture, because `@napplet/nub@0.3.0`'s `identityGetPublicKey()` helper resolves `identity.getPublicKey.result` rather than the runtime fallback error envelope.
- Verified the remaining old split-nub lockfile entries are outside the active 18-package graph; they are retained only by the explicitly out-of-scope `decrypt-demo` legacy shim/vite-plugin graph.

## Verification Evidence

- `node` lockfile importer scan -> `active_importers=18`, `old_sdk_graph_offenders=0`.
- `rg "@napplet/sdk@(?:0\\.2\\.1|\\^0\\.2\\.1|0\\.2)" pnpm-lock.yaml` -> no matches.
- `rg "from ['\\\"]@napplet/sdk['\\\"]" apps/playground/napplets tests/fixtures/napplets --glob 'src/**/*.ts'` -> no matches.
- `pnpm test:e2e -- tests/e2e/nub-identity.spec.ts` -> build 27/27, targeted Playwright 1/1 passed.
- `pnpm test:e2e` -> build 27/27, Playwright 86 passed / 0 failed / 0 skipped.
- `pnpm type-check` -> 11/11 turbo tasks successful.
- `pnpm test:unit` -> 32 files, 545 tests passed, including the new migration guard.

## Requirement Status

- SDK-03: complete
- GUARD-01: complete
- E2E-29: complete
- E2E-30: complete
- DOCS-08: complete

## Notes

`decrypt-demo` remains outside the v1.9 18-package scope. Its old shim/vite-plugin dependency entries continue to explain the remaining `@napplet/nub-*@0.2.1` lockfile packages and should be handled only in a separate decrypt helper migration.
