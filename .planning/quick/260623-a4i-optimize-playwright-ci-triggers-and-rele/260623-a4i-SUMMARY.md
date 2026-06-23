---
status: complete
completed: 2026-06-23
task: optimize Playwright CI triggers and relevant spec selection
---

# Quick Task 260623-a4i Summary

Playwright CI is now gated by a changed-file selector instead of always running the full browser suite.

## Changes

- Added `scripts/select-e2e-tests.mjs`.
  - Docs, planning, changesets, and unit-only changes return `run_e2e=false`.
  - Direct `tests/e2e/*.spec.ts` changes run only those specs.
  - Narrow domains such as relay, storage, identity, notify, theme, resource, CVM, gateway/NIP, ACL, and Paja map to relevant browser specs.
  - Shared workflow/config/runtime/shell surfaces conservatively run the full `tests/e2e` suite.
- Added `tests/unit/select-e2e-tests.test.ts` for selector policy coverage.
- Updated `.github/workflows/ci.yml`.
  - Added `Detect Playwright Scope`.
  - Made `Playwright` depend on build, unit, and selector output.
  - The Playwright job skips when `run_e2e=false` and passes selected specs to `pnpm test:e2e -- ...` when targeted.
- Added explicit Turbo build dependencies for runtime/services/shell/paja to keep the existing main-branch build race from blocking CI after Playwright optimization.

## Verification

- `node scripts/select-e2e-tests.mjs --json --files README.md docs/packages/runtime.md .planning/STATE.md`
- `node scripts/select-e2e-tests.mjs --json --files tests/e2e/nap-resource.spec.ts`
- `node scripts/select-e2e-tests.mjs --json --files packages/services/src/relay-pool-service.ts`
- `node scripts/select-e2e-tests.mjs --json --files packages/paja/src/server.ts`
- `node scripts/select-e2e-tests.mjs --json --files .github/workflows/ci.yml scripts/select-e2e-tests.mjs`
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/ci.yml`
- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check`
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main`
- `git diff --check`
- `CI=1 pnpm test:e2e -- tests/e2e/paja-single-window.spec.ts` (2 passed)
- `CI=1 pnpm test:e2e` (68 passed)

## Notes

- Release-tag publishing still keeps its full e2e gate because a release job is a publication gate rather than a PR-change trigger.
- GitHub workflow-level path filters were intentionally avoided so required checks do not remain pending when a workflow is skipped by path filtering.
