# Quick Task 260626-ugy Summary

Status: complete

## Result

Hardened PR #103 so the injected `window.napplet` prelude is no longer prototype-only.

## Changes

- Removed the private `__kehtoInjectedDomains` property from the injected namespace.
- Kept `shell` as an explicit transition domain in the playground allowlist for current `@napplet/shim` compatibility.
- Added public API examples for the exported namespace prelude helpers.
- Updated unit and e2e assertions to prove behavior through actual `window.napplet` keys.
- Updated package docs to describe assignment filtering and the transition domain.

## Verification

- `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts tests/unit/playground-gateway-guard.test.ts` passed, 15 tests.
- `pnpm --filter @kehto/playground build` passed.
- `pnpm exec playwright test tests/e2e/gateway-artifact-parity.spec.ts --workers=1` passed, 2 tests.
- `pnpm type-check` passed.
- `pnpm test:unit` passed, 93 files / 1214 tests.
- `pnpm docs:check` passed.
- `pnpm test:e2e` passed, 69 tests.
- `pnpm dlx aislop@0.9.3 scan --changes` passed, 100/100.
- `git diff --check` passed.

## Remaining Baseline

Full repo-wide `pnpm dlx aislop@0.9.3 scan` still reports pre-existing warnings outside this PR. The changed-file gate is clean.
