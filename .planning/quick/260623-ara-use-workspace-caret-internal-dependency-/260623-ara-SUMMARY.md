# Quick Summary: Workspace Caret Internal Ranges

## Result

- Replaced hardcoded internal `@kehto/*` dependency ranges with `workspace:^`
  across package, playground, and e2e harness manifests.
- Refreshed `pnpm-lock.yaml` so internal packages resolve through workspace links.
- Added `tests/unit/internal-workspace-ranges.test.ts` to prevent hardcoded
  internal `@kehto/*` ranges from returning.

## Verification

- `pnpm install --lockfile-only`
- `pnpm test:unit -- tests/unit/internal-workspace-ranges.test.ts`
- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm install --frozen-lockfile`
- `pnpm lint` (no lint tasks configured)
- `npx aislop scan` (83/100 due to pre-existing playground findings outside
  this manifest change)
- `pnpm --dir packages/runtime pack --pack-destination /tmp/kehto-pack-test --json`
  plus tarball inspection confirmed `workspace:^` materializes to semver
  dependencies in the packed package.
- `pnpm test:e2e` failed once in parallel on `paja-single-window`; serial rerun
  of that spec passed.
- `npx playwright test --workers=1` passed: 68/68.
