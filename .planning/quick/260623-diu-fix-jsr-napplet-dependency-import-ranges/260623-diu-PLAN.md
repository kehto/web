---
quick_id: 260623-diu
slug: fix-jsr-napplet-dependency-import-ranges
status: planned
---

# Quick Task 260623-diu: Fix JSR napplet dependency import ranges for release rerun

## Tasks

1. Align public package `jsr.json` imports for `@napplet/core` and `@napplet/nap` with the current `^0.20.0` package dependency range.
2. Verify no stale `jsr:@napplet/*@^0.12.0` imports remain.
3. Run package validation before pushing the metadata fix.

## Verification

- `rg 'jsr:@napplet/(core|nap)@\\^0\\.12\\.0' packages/*/jsr.json`
- `pnpm build`
- `pnpm type-check`
- `pnpm docs:check`
