# Quick Task 260703-oi0 Summary

## Result

Completed issue #139 by replacing published package dependency upper bounds with
inclusive maximum ranges while preserving the previous support windows.

- `@napplet/core` / `@napplet/nap`: `>=0.23.0 <=0.25.x`
- `nostr-tools`: `>=2.23.3 <=2.x`

Source commit: `89f4c11`

## Changed

- Updated package manifests across public Kehto packages and `@kehto/cli`.
- Synced package documentation dependency tables.
- Regenerated lockfile importer specifiers with `pnpm install --lockfile-only`.
- Added a changeset for all packages whose published manifest metadata changed.
- Extended `tests/unit/sdk-migration-guard.test.ts` to reject the old exclusive
  upper-bound ranges in published manifests.

## Verification

- `pnpm dlx semver -r '>=0.23.0 <=0.25.x' 0.23.0 0.25.999 0.26.0`
- `pnpm dlx semver -r '>=2.23.3 <=2.x' 2.23.3 2.99.0 3.0.0`
- `pnpm install --lockfile-only`
- `pnpm docs:check`
- `pnpm test:unit`
- `pnpm vitest run tests/unit/sdk-migration-guard.test.ts`
- `pnpm build`
- `pnpm type-check`
- `pnpm dlx aislop@0.12.0 scan --changes --base HEAD`
- `git diff --check`

## Not Run

- `pnpm test:e2e`; this was dependency metadata, docs, lockfile, and unit guard
  coverage only.
