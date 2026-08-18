# Phase 89 — Deferred Items

Items discovered during execution but out of phase 89's scope (docs + changesets
only; phases 86–88 own runtime/behavior/test changes). Tracked for follow-up.

## Pre-existing stale guard-test failures (owned by phases 86–88 modernization)

`pnpm test:unit` reports **9 failures**, all in three `tests/unit/*-guard.test.ts`
files. None were caused by phase 89 (the failing files were not modified this
phase; the unit tests in every file phase 89 *did* touch pass — 261/261 in the
swept files). These guards assert the **pre-modernization 0.5.0 / `@napplet/nub`**
graph, which the phase 86–88 modernization (now committed on this branch) already
replaced with the `@napplet/core@0.12` + `@napplet/nap@0.12` + `shim 0.13` +
`vite-plugin 0.8.1` graph. The guards were not updated when the modernization
landed, so they now assert the opposite of the milestone's intent.

Failing specs:

- `tests/unit/sdk-migration-guard.test.ts` (5):
  - `resolves active protocol packages from published registry artifacts`
  - `keeps all SDK-migrated manifests on the exact 0.5.0 NAP package graph`
    — asserts `@napplet/sdk`/`@napplet/shim`/`@napplet/nub` `== 0.5.0`,
    `@napplet/vite-plugin == 0.4.0`. Actual: `sdk 0.12.0`, `shim 0.13.0`,
    `@napplet/nap 0.12.0` (no `@napplet/nub`), `vite-plugin 0.8.1`.
  - `keeps all helper-migrated manifests on the exact 0.5.0 NAP helper graph`
  - `keeps published kehto packages on @napplet/nub peers and dev deps`
    — asserts peer/dev `@napplet/nub ^0.5.0`. Actual: peer `@napplet/nap ^0.12`.
  - `uses the renamed NAP relay union type at the runtime boundary`
    — asserts `relay-handler.ts` imports `@napplet/nub/relay/types`. Actual
    (committed in phase 88, `acdbc69`): `@napplet/nap/relay/types`.
- `tests/unit/playground-gateway-guard.test.ts` (3):
  - `keeps every playground napplet on the shared single-file build config`
  - `keeps the feed napplet identity-bound, following-scoped, and unseeded`
    — asserts feed `src/main.ts` imports `@napplet/nub/identity/sdk` /
    `@napplet/nub/ifc/sdk`. Actual (phase 88 migration): `@napplet/nap/inc/sdk`.
  - `keeps profile-viewer on the NAP-01 profile-open flow`
- `tests/unit/nip5d-conformance-guard.test.ts` (1):
  - `requires every playground napplet to declare and preflight its NAP contract`

### Why not fixed in phase 89

Phase 89 is scoped to docs + changesets and is explicitly instructed not to change
tests (phases 86–88 own runtime/behavior/test changes). Rewriting these guards to
the 0.12/0.13 / `@napplet/nap` / `inc` graph is a phase 86–88 correction (the
guards should have moved in lockstep with `acdbc69` / the SDK-migration commits),
not phase-89 docs work, and touching them risks masking a real regression behind a
hand-edited assertion. They are recorded here for the owning follow-up.

### Recommended fix (follow-up)

Update the three guard specs to assert the current graph:
`@napplet/core@^0.12`, `@napplet/nap@0.12` (peer `^0.12`), `@napplet/sdk 0.12.0`,
`@napplet/shim 0.13.0`, `@napplet/vite-plugin 0.8.1`, `relay-handler.ts` →
`@napplet/nap/relay/types`, and the playground napplet imports →
`@napplet/nap/inc/sdk` (with the `ifc`→`inc` rename). These guards predate and
contradict the v1.21 modernization and should be realigned (or retired in favor
of the newer conformance guards) in a runtime/test-owning change.
