# Quick Plan: Workspace Caret Internal Ranges

## Goal

Keep internal `@kehto/*` package manifest dependency ranges managed by the workspace
and Changesets release flow instead of hardcoded package versions.

## Scope

- Normalize internal `@kehto/*` dependency specs in package manifests to
  `workspace:^`.
- Refresh lockfile metadata for those specifier changes.
- Add a unit guard so future package manifests cannot reintroduce hardcoded
  internal `@kehto/*` ranges.

## Verification

- `pnpm install --lockfile-only`
- `pnpm test:unit -- tests/unit/internal-workspace-ranges.test.ts`
- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check` if docs change
