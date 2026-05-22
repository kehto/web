---
phase: 52-regression-guard-full-verification
verified_at: 2026-05-22T13:04:00+02:00
status: passed
score: 5/5
---

# Phase 52 Verification

**Verified:** 2026-05-22
**Status:** Pass

## Command Evidence

| Check | Result |
|-------|--------|
| `pnpm exec vitest run tests/unit/sdk-migration-guard.test.ts packages/shell/src/shell-bridge.test.ts` | Pass: 2 files, 11 tests |
| `pnpm docs:api` | Pass: 0 errors, 15 existing TypeDoc warnings |
| `rg "@napplet/(shim\|vite-plugin\|nub)@0\\.2\\.1\|@napplet/nub-[a-z]+@0\\.2\\.1\|@napplet/core@0\\.2\\.1" pnpm-lock.yaml` | Pass: no matches |
| `rg "requestCounter\|pending\\s*=\\s*new Map\|window\\.parent\\.postMessage\\(\\{ type: 'identity\\.decrypt'\|window\\.parent\\.postMessage\\(\\{ type: \\\"identity\\.decrypt\\\"" apps/playground/napplets/decrypt-demo/src/main.ts` | Pass: no matches |
| `pnpm test:e2e -- tests/e2e/decrypt-demo.spec.ts` | Pass: 27/27 build, 1 Playwright test |
| `pnpm build` | Pass: 27 successful, 27 total |
| `pnpm type-check` | Pass: 11 successful, 11 total |
| `pnpm test:unit` | Pass: 32 files, 548 tests |
| `pnpm test:e2e` | Pass: 86 tests |
| `pnpm lint` | Pass: turbo reported no configured lint tasks |

## Requirement Evidence

### GRAPH-01

- `tests/unit/sdk-migration-guard.test.ts` now checks all helper-migrated manifests, including decrypt-demo, for exact `@napplet/shim`, `@napplet/nub`, and `@napplet/vite-plugin` `0.3.0`.
- Static lockfile search found no old napplet helper graph package keys.

### GUARD-02

- The SDK migration guard now includes decrypt-demo helper graph checks.
- The guard requires `identityDecrypt` from `@napplet/nub/identity/sdk`.
- The guard rejects reintroduced `requestCounter`, pending map plumbing, and raw `window.parent.postMessage({ type: 'identity.decrypt', ... })` requests in decrypt-demo source.

### E2E-31

- Focused shell bridge unit tests pass as part of the two-file Vitest run.
- Focused decrypt-demo Playwright spec passes.

### E2E-32

- Full build, type-check, unit, and E2E baselines pass.
- Playwright remains at the expected 86 passed / 0 failed / 0 skipped baseline.
- Unit count is now 548 because Phase 52 added three guard tests.

### DOCS-09

- Current source comments now point decrypt-demo readers to `identityDecrypt`.
- `RUNTIME-SPEC.md` already lists canonical `identity:changed`.
- v1.10 changesets describe `identity:changed` hard removal and decrypt-demo `identityDecrypt` migration.
- README/config-service current package guidance no longer advertises the old `0.2.1` helper graph as current behavior.

## Residual Risk

- TypeDoc still emits 15 pre-existing warnings about unresolved README links and omitted referenced types; this phase did not introduce or resolve those warnings.
- `pnpm lint` has no configured package lint tasks, so lint coverage is effectively type/test/static-guard coverage for this milestone.
