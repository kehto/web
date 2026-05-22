---
quick_id: 260522-kvd
status: complete
date: 2026-05-22
commit: b844b25
---

# Quick Task 260522-kvd: Remove old inter-frame terminology - Summary

## Result

Active project surfaces now use IFC vocabulary:

- Playground ACL copy, debugger paths, system messages, and sequence labels now render `ifc` / `ifc-send` / `ifc-receive`.
- The targeted Playwright audit spec now asserts `Relay Publish / IFC Send` and `path:ifc-send`.
- RUNTIME-SPEC.md, runtime/shell comments, and service README examples no longer teach the old term.
- `tests/unit/sdk-migration-guard.test.ts` now fails if the old term reappears in active `apps`, `packages`, `tests`, or `RUNTIME-SPEC.md` text files.

## Scope Boundary

Archived milestone and migration history was intentionally left untouched after the operator clarified this was about active development surfaces, not historical artifacts.

## Verification

- Active tracked grep over `apps packages tests RUNTIME-SPEC.md` for the old acronym -> no matches
- Active filesystem grep excluding archived `.planning`/migration history and lockfile -> no matches
- `pnpm test:unit tests/unit/sdk-migration-guard.test.ts` -> 1 file, 6 tests passed
- `pnpm type-check` -> passed
- `pnpm --filter @kehto/playground build` -> passed
- `pnpm exec playwright test tests/e2e/demo-audit-correctness.spec.ts` -> 3 tests passed
- `pnpm lint` -> no lint tasks configured/executed by turbo
- `pnpm test:unit` -> 32 files, 549 tests passed
- `git diff --check` -> clean

## Remaining Risk

The full Playwright suite was not rerun; the targeted debugger/ACL audit spec passed.
