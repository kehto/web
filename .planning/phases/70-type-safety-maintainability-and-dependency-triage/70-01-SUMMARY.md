# Summary 70-01: Type Safety, Maintainability, and Dependency Triage

**Phase:** 70 - Type Safety, Maintainability, and Dependency Triage
**Completed:** 2026-05-24
**Status:** Complete

## Delivered

- Narrowed production message-router casts in runtime and services from `as any` access to local envelope types with branch-level guards.
- Replaced runtime relay and IFC double assertions with local single-boundary message types after the message branch is already selected.
- Removed private thin wrappers in playground detail/signer paths while retaining public helper APIs that still act as named boundaries.
- Replaced repeated napplet `supports()` double assertions with direct access to the `@napplet/shim` global typing.
- Upgraded direct `turbo` to `^2.9.14` and added pnpm overrides for transitive `postcss@8.5.15` and `brace-expansion@5.0.6`.
- Documented the remaining VitePress Vite/esbuild audit path as a deferral because VitePress 1.6.4 still declares Vite `^5.4.14`, while the current advisory requires the Vite 6 line.
- Deferred broad function-length, file-size, and duplicate-block decomposition to a structural refactor milestone with dedicated UI behavior locks.

## Requirements Closed

- SLOP-03
- TYPE-01
- TYPE-02
- QUAL-01
- DEPS-01

## Verification

- `pnpm audit --audit-level moderate`
- `pnpm docs:check`
- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm vitest run tests/unit/sdk-migration-guard.test.ts tests/unit/nip5d-conformance-guard.test.ts`
- `git diff --check`

## Notes

The dependency audit now reports only the two deferred moderate advisories under `docs>vitepress>vite`. The original PostCSS, brace-expansion, and turbo audit findings are resolved by the lockfile and manifest changes.
