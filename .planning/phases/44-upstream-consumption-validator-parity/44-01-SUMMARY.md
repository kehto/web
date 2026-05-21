# Plan 44-01 Summary

**Phase:** 44 — Upstream Consumption + Validator Parity
**Plan:** 01 — single atomic plan covering DEP-01..07 + VALIDATOR-01..02
**Requirements:** 9 (DEP-01, DEP-02, DEP-03, DEP-04, DEP-05, DEP-06, DEP-07, VALIDATOR-01, VALIDATOR-02)

## What shipped

### Peer dep bumps (DEP-01, DEP-02)

- `@napplet/core` peer dep `^0.2.1` → `^0.3.0` in 4 packages: `@kehto/{acl, runtime, shell, services}`.
- `@napplet/nub` peer dep same bump across same 4 packages.
- Also bumped `devDependencies` mirror copies in each package.

### pnpm.overrides retirement (DEP-03)

- Root `package.json` `pnpm.overrides` block removed entirely. The `@napplet/nub>@napplet/core: ^0.2.1` workaround is no longer needed — upstream `@napplet/nub@0.3.0` ships with proper `@napplet/core: ^0.3.0` semver (SEED-001 / napplet/napplet#4 fix landed in upstream PR #5 + JSR dual-publish PR #8 merge on 2026-05-21).
- `pnpm install` resolves cleanly without the override; lockfile updated.

### Provisional files reclassified (DEP-04, DEP-05, DEP-06)

- `git mv` rename: `packages/shell/src/types/provisional-{class,connect,resource}.ts` → `internal-{class,connect,resource}.ts`.
- Each file's header comment rewritten to mark it as a kehto-internal shell-side model (not a staging-ground duplicate of upstream), with explicit pointers to PROJECT.md Decisions #31 + #32.
- 5 import sites updated to the new file paths: `packages/shell/src/{types.ts, index.ts, shell-bridge.ts, connect-store.ts}`, `packages/runtime/src/types.ts`. 1 inline JSDoc reference also updated: `packages/services/src/resource-service.ts`.
- File contents (exported types + runtime values) byte-identical otherwise.

### Changesets (DEP-07)

- 4 minor-bump changesets staged under `.changeset/v1-8-dep-{acl,runtime,shell,services}.md`, one per affected package, documenting the dep bump + provisional-file renames.

### Validator parity (VALIDATOR-01, VALIDATOR-02)

- VALIDATOR-01 (audit): zero local `normalizeConnectOrigin` implementation exists in kehto (verified by `grep -rn normalizeConnectOrigin packages/ apps/` returning empty).
- VALIDATOR-02 (decision record): PROJECT.md Key Decisions table extended with Decision #32 — upstream `@napplet/nub/connect`'s `normalizeConnectOrigin` (21 rules, 28 smoke tests) is the canonical validator for any future kehto origin-validation work.

### Bulk napplet workspace dep bumps (downstream side-effect)

- `@napplet/nub` and `@napplet/core` references in 18 napplet workspace packages (12 demo napplets in `apps/playground/napplets/*` + 6 nub-fixture napplets in `tests/fixtures/napplets/*`) bumped from `^0.2.1` to `^0.3.0`.
- `@napplet/sdk` / `@napplet/shim` / `@napplet/vite-plugin` were **deliberately kept pinned at `^0.2.1`** in those same 18 packages — upstream `@napplet/sdk@0.3.0` removed the `ipc`/`storage`/`relay`/`identity`/etc. namespace exports in favor of individual function exports (e.g. `ifcEmit`, `storageGetItem`). Migrating 18 napplet main.ts files to the new function-based API is a substantial scope expansion that does NOT belong in v1.8 Phase 44.
- Carried forward as v1.9 follow-up: SDK-migration phase (see PROJECT.md Known Tech Debt note added at phase close).

## Verifications performed

- `pnpm install` → exit 0; lockfile now has `@napplet/nub@0.3.0` and `@napplet/core@0.3.0` (verified by `grep`).
- `pnpm build` → 26/26 turbo tasks successful, 19 cached.
- `pnpm test:unit` → 523/523 (unchanged from Phase 42 baseline).
- `pnpm test:e2e` → 73/0/0 (unchanged from Phase 42 baseline).
- `grep -rn "types/provisional-" packages/ apps/` returns 0 matches (excluding `dist/` artifacts that regenerate on next clean build).
- `grep -rE '@napplet/(nub|core).*\^0\.2' packages/*/package.json apps/playground/napplets/*/package.json tests/fixtures/napplets/*/package.json` returns 0 matches.

## Anti-actions (deliberate)

- Did NOT migrate napplet SDK consumers to the new function-based imports. Sized out of v1.8 Phase 44; scheduled as v1.9 follow-up.
- Did NOT delete `internal-{class,connect,resource}.ts` files — Decision #31 documents the intentional divergence from upstream.
- Did NOT touch `packages/shell/dist/` artifacts — they regenerate via `pnpm build` and are not hand-edited.
- Did NOT update `.planning/REQUIREMENTS.md` — owned by Phase 44's verifier or downstream finalization.

## Files modified

| File | Action |
|------|--------|
| `packages/{acl,runtime,shell,services}/package.json` | Peer dep bumps + devDep bumps (`^0.2.1` → `^0.3.0`) |
| `package.json` (root) | Deleted `pnpm.overrides` block |
| `packages/shell/src/types/internal-class.ts` | Renamed from `provisional-class.ts`; header rewritten |
| `packages/shell/src/types/internal-connect.ts` | Renamed from `provisional-connect.ts`; header rewritten |
| `packages/shell/src/types/internal-resource.ts` | Renamed from `provisional-resource.ts`; header rewritten |
| `packages/shell/src/{types,index,shell-bridge,connect-store}.ts` | Import path updates (`./types/provisional-*` → `./types/internal-*`) |
| `packages/runtime/src/types.ts` | Same import update |
| `packages/services/src/resource-service.ts` | Inline JSDoc reference update + concept-divergence note |
| 18 napplet `package.json` files | Bumped `@napplet/{nub,core}` to `^0.3.0`; pinned `@napplet/{sdk,shim,vite-plugin}` at `^0.2.1` |
| `pnpm-lock.yaml` | Re-resolved against `@napplet/nub@0.3.0` + `@napplet/core@0.3.0` |
| `.changeset/v1-8-dep-{acl,runtime,shell,services}.md` | 4 new minor-bump changesets |
