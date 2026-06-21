---
status: complete
quick_id: 260621-4bv
slug: split-dev-runtime-into-kehto-paja-implem
date: 2026-06-21
commit: 1990451
---

# Quick Task 260621-4bv Summary

## Task

Split the local authoring runtime naming into `@kehto/paja` for the
implementation and `@kehto/cli` for the top-level `kehto paja` command.

## Completed

- Renamed the implementation package from `packages/dev-runtime` /
  `@kehto/dev-runtime` to `packages/paja` / `@kehto/paja`.
- Renamed the public implementation API from `DevRuntime*` / `DEV_RUNTIME_*` to
  `Paja*` / `PAJA_*`.
- Added `packages/cli` / `@kehto/cli` with the `kehto` binary and `kehto paja`
  dispatch to `@kehto/paja/cli`.
- Updated docs, how-to pages, TypeDoc inputs, package reference tables,
  changesets, lockfile, and e2e coverage to use Paja naming.
- Kept `@kehto/paja` as the implementation surface and avoided a second package
  claiming the `kehto` binary.

## Verification

- `pnpm --filter @kehto/paja build`
- `pnpm --filter @kehto/paja test`
- `pnpm --filter @kehto/cli build`
- `pnpm --filter @kehto/cli test`
- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm docs:check`
- `pnpm dlx aislop@0.12.0 scan --changes --base HEAD`
- `git diff --check`
- `node packages/cli/dist/index.js --help`
- `node packages/cli/dist/index.js paja --help`
