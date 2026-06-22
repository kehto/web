---
quick_id: 260622-8oy
slug: repair-v1-34-release-workflow-after-part
status: complete
date: 2026-06-22
---

# Summary

Added JSR publish metadata for the v1.34 `@kehto/paja` and `@kehto/cli` packages, synced stale committed JSR package versions/import constraints to the v1.34 package versions, and added a unit guard that fails if a future public `@kehto/*` package under `packages/*` lacks `jsr.json`.

## Verification

- `npx -y jsr publish --dry-run --allow-slow-types --allow-dirty` in `packages/paja` passed.
- `npx -y jsr publish --dry-run --allow-slow-types --allow-dirty` in `packages/cli` currently fails because `@kehto/paja@0.2.0` is not yet visible on JSR; the release workflow publishes `packages/paja` before `packages/cli`.
- `pnpm -r --workspace-concurrency=1 --filter='./packages/*' exec pwd` confirmed `packages/paja` runs before `packages/cli`.
- `pnpm build` passed.
- `pnpm type-check` passed.
- `pnpm test:unit` passed: 84 files, 1103 tests.
- `pnpm docs:check` passed.
- `git diff --check` passed.
- `pnpm dlx aislop@0.12.0 scan . --changes --base origin/main --verbose` returned 100/100 but reported `0 changed vs origin/main`; path-scoped scans did not analyze the single test file with this tool version.

## Remaining Blocker

Registry state still blocks a successful publish retry:

- npm shows `@kehto/paja` latest is `0.1.0`.
- npm returns 404 for `@kehto/cli`.
- JSR returns 404 for `@kehto/paja` and `@kehto/cli`.

Before rerunning Release for v1.34 recovery, configure npm Trusted Publisher access for `@kehto/paja` and create/configure `@kehto/cli`; also link `@kehto/paja` and `@kehto/cli` on JSR to `kehto/web` under the `@kehto` scope.
