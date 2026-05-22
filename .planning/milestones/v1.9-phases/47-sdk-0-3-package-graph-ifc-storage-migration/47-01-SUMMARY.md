---
phase: 47-sdk-0-3-package-graph-ifc-storage-migration
plan: 01
status: completed
completed_at: 2026-05-22T09:46:04.452Z
requirements:
  - SDK-01
  - SDK-02
  - FUNC-01
  - FUNC-02
---

# Phase 47 — Plan 01 Summary

## Result

Phase 47 migrated the 18 scoped demo/fixture package manifests to the `0.3.0` SDK package graph and rewrote the IFC/storage call sites to direct helper functions.

## Changes Made

- Pinned all 18 target package manifests to exact `@napplet/sdk: 0.3.0`, `@napplet/shim: 0.3.0`, and `@napplet/vite-plugin: 0.3.0`.
- Added exact `@napplet/nub: 0.3.0` to the 18 package manifests so direct `@napplet/nub/<domain>/sdk` helper imports are explicit dependencies.
- Migrated bot, chat, and `nub-ifc` from old `ipc` namespace calls to `ifcEmit` / `ifcOn`.
- Migrated bot, chat, preferences, `nub-storage`, and `nub-theme` from `storage.*` calls to `storageGetItem` / `storageSetItem`.
- Updated Phase 47 comments/log strings from `ipc` terminology to `ifc` where they described the helper surface.
- Regenerated `pnpm-lock.yaml` with `pnpm install`.

## Verification Evidence

- `pnpm install` → exit 0; lockfile updated. Pre-existing peer warning remains under `apps/playground -> unocss -> oxc-parser` for optional `@emnapi/*`.
- Manifest scan across the 18 target package files showed every target at:
  - `@napplet/sdk: 0.3.0`
  - `@napplet/shim: 0.3.0`
  - `@napplet/vite-plugin: 0.3.0`
  - `@napplet/nub: 0.3.0`
- `rg '\bipc\b|ipc\.' apps/playground/napplets/{bot,chat}/src/main.ts tests/fixtures/napplets/nub-ifc/src/main.ts` → no matches.
- `rg 'storage\.(getItem|setItem|removeItem|keys)|import \{ storage \}' apps/playground/napplets/{bot,chat,preferences}/src/main.ts tests/fixtures/napplets/{nub-storage,nub-theme}/src/main.ts` → no call/import matches; the only remaining storage dotted strings are E2E wire-envelope names in comments.
- Targeted build command passed:
  `pnpm --filter @kehto/demo-bot --filter @kehto/demo-chat --filter @kehto/demo-preferences --filter @kehto/fixture-nub-ifc --filter @kehto/fixture-nub-storage --filter @kehto/fixture-nub-theme build`

## Requirement Status

- SDK-01: complete
- SDK-02: complete
- FUNC-01: complete
- FUNC-02: complete

## Notes

`decrypt-demo` still carries old shim/vite-plugin ranges and old split-nub lockfile entries because it is explicitly outside the 18-package SDK-bearing scope. Phase 49 will prove remaining legacy lockfile entries are unrelated to the migrated active graph.
