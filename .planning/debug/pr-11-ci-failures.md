---
slug: pr-11-ci-failures
status: resolved
trigger: "all tests are failing in https://github.com/kehto/web/pull/11"
created: 2026-05-23
updated: 2026-05-23T10:12:10Z
---

# Debug: PR 11 CI Failures

## Symptoms

**Expected:** PR #11 checks pass for build/type-check, Vitest, and Playwright on both push and pull_request workflows.

**Actual:** GitHub reports six failed checks for PR #11 on branch `chore/retighten-sandbox`: Build & Type-Check, Unit Tests / Vitest, and E2E / Playwright all fail on both push and pull_request.

**Error messages:** GitHub Actions failed before assertions in all three workflow families with `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@napplet/vite-plugin'` from napplet and fixture Vite configs.

**Timeline:** Failures visible on 2026-05-23 for PR #11 after the v1.12 NIP-5D conformance branch was pushed.

**Reproduction:** Open PR #11 or run the failing workflow commands from GitHub Actions against branch `chore/retighten-sandbox`.

## Current Focus

hypothesis: CONFIRMED. The initial failures shared a checkout/repository-shape fault: local `@napplet/*` sources are submodules, but CI did not check out submodules. Follow-up reruns exposed two more fresh-runner requirements: the referenced `napplet` submodule commit must be published, and all locally linked `@napplet/*` package outputs must be built before napplet app builds import them.
test: Compare failed GitHub Actions logs against local submodule/workspace state, publish the required submodule commit, add an explicit local `@napplet/*` prebuild, then rerun CI-equivalent commands locally and on GitHub.
expecting: Build, unit, audit, type-check, and Playwright commands complete with local submodule package sources and generated `@napplet/*` package outputs in scope.
next_action: Push the final build-order repair commit and watch PR #11 checks rerun.

## Evidence

- timestamp: 2026-05-23T09:52:54Z
  finding: `gh pr view 11 --repo kehto/web` shows PR #11 targets `main`, head branch `chore/retighten-sandbox`, merge state `UNSTABLE`, and six failed checks across duplicated push/pull_request runs.
  confirms: CI failure is on the current branch and affects all workflow families.
- timestamp: 2026-05-23T09:55:00Z
  finding: Failed Build, Vitest, and Playwright job logs all fail while Vite loads napplet or fixture configs because `@napplet/vite-plugin` cannot be resolved.
  confirms: The common failure happens in package resolution before workflow-specific tests run.
- timestamp: 2026-05-23T09:55:30Z
  finding: `git ls-files -s napplet` records `napplet` as a gitlink and `.gitmodules` points `napplet` and `nubs` at external repositories. CI checkout steps did not request submodules.
  confirms: Fresh Actions workspaces were missing the local package sources used by root `pnpm.overrides`.
- timestamp: 2026-05-23T09:57:00Z
  finding: After adding recursive submodule checkout, targeted failing builds pass locally: `pnpm --filter @kehto/demo-config-demo build` and `pnpm --filter @kehto/fixture-nub-identity build`.
  confirms: Materializing submodules resolves the `@napplet/vite-plugin` failure mode.
- timestamp: 2026-05-23T09:58:00Z
  finding: The next local `pnpm test` failure was `@kehto/nip66#test`: Vitest ran from `packages/nip66`, did not match its root-relative include, and exited with "No test files found".
  confirms: Unit CI needed an additional script repair after checkout was fixed.
- timestamp: 2026-05-23T09:59:29Z
  finding: Final local verification passed: `pnpm test`, `pnpm type-check`, `pnpm audit:csp`, `pnpm audit:gateway-artifacts`, and `pnpm test:e2e`.
  confirms: The branch is locally clean across the failing CI surfaces and the NIP-5D static/E2E guard set.
- timestamp: 2026-05-23T10:01:30Z
  finding: First GitHub rerun after recursive checkout failed in `actions/checkout`: `fatal: remote error: upload-pack: not our ref 306d616e422e6fe7489c5e1e99321cc52dd97040`.
  confirms: The superproject referenced a `napplet` submodule commit that was present locally but not fetchable from GitHub.
- timestamp: 2026-05-23T10:02:30Z
  finding: `git -C napplet push origin HEAD:main` fast-forwarded `napplet/napplet` from `344be72` to `306d616`; `git ls-remote https://github.com/napplet/napplet.git refs/heads/main` now returns `306d616e422e6fe7489c5e1e99321cc52dd97040`.
  confirms: The submodule commit required by the superproject is now public/fetchable.
- timestamp: 2026-05-23T10:04:30Z
  finding: The next GitHub rerun got past checkout/install but failed in `pnpm build` because napplet and fixture Vite configs imported `@napplet/vite-plugin/dist/index.js` before the local package output existed.
  confirms: Fresh runners need a deterministic build step for generated local `@napplet/*` package outputs, not just materialized submodule source files.
- timestamp: 2026-05-23T10:05:30Z
  finding: `pnpm turbo run build --dry=json` showed napplet demo build tasks without inferred dependencies on `@napplet/vite-plugin#build`, while `pnpm turbo run build --filter=@napplet/vite-plugin... --dry=json` selected `@napplet/core#build`, `@napplet/nub#build`, and `@napplet/vite-plugin#build`.
  confirms: Turbo does not infer the needed prebuild edge from the override-linked local package graph, so the root build script must make that edge explicit.
- timestamp: 2026-05-23T10:07:00Z
  finding: After removing `napplet/packages/core/dist`, `napplet/packages/nub/dist`, and `napplet/packages/vite-plugin/dist`, `pnpm build` passed with the explicit `@napplet/vite-plugin...` prebuild and `pnpm --filter @kehto/demo-bot build` passed.
  confirms: The root build script now works from the missing-dist state that reproduced the fresh-runner CI failure.
- timestamp: 2026-05-23T10:10:30Z
  finding: The next GitHub rerun got past `@napplet/vite-plugin` resolution but failed while napplet app builds resolved `@napplet/shim`, again because fresh runners lacked generated package output.
  confirms: The prebuild scope must include every locally linked `@napplet/*` package consumed by napplet apps, not only the Vite plugin chain.
- timestamp: 2026-05-23T10:11:30Z
  finding: After removing all active local napplet package outputs (`core`, `nub`, `sdk`, `shim`, and `vite-plugin`), `pnpm build` passed with an explicit five-package `@napplet/*` prebuild before the full Turbo build.
  confirms: The root build now covers the fresh-runner missing-output state for both Vite config imports and app-source imports.

## Eliminated

- Independent Playwright-only regression. Playwright failed at the same package-resolution/build step as Build and Vitest before browser assertions.
- Independent Vitest assertion regression as the original CI root cause. Vitest failed during fixture build for the same missing package.
- Missing package publication. The branch intentionally resolves `@napplet/*` from repo-local submodule sources; CI needed to materialize those sources instead of falling back to published packages.

## Resolution

root_cause: PR #11 moved active package resolution to repo-local `@napplet/*` submodule sources, but GitHub Actions checkout steps fetched only the superproject. The referenced `napplet` gitlink also pointed at a local-only commit. After those were repaired, fresh runners still lacked generated `@napplet/*/dist` outputs, and Turbo did not infer the needed package-build edges before napplet Vite configs and app sources imported those packages. Unit testing also delegated through a package-local Vitest process whose `process.cwd()` broke repo-root static guards and missed the `packages/nip66` test file.
fix: Enable `actions/checkout` recursive submodule checkout in build, unit, e2e, and release workflows. Publish the referenced `napplet` submodule commit. Switch `.gitmodules` to HTTPS public submodule URLs. Prebuild `@napplet/core`, `@napplet/nub`, `@napplet/sdk`, `@napplet/shim`, and `@napplet/vite-plugin` before the full root `turbo run build`. Change root `pnpm test` to run the repo-root build plus repo-root Vitest suite. Narrow `@kehto/nip66`'s package-local test script to its concrete root-relative test file.
verification: `pnpm --filter @kehto/demo-config-demo build`; `pnpm --filter @kehto/fixture-nub-identity build`; `pnpm --filter @kehto/nip66 test`; `rm -rf napplet/packages/core/dist napplet/packages/nub/dist napplet/packages/sdk/dist napplet/packages/shim/dist napplet/packages/vite-plugin/dist && pnpm build`; `pnpm --filter @kehto/demo-bot build`; `pnpm test`; `pnpm type-check`; `pnpm audit:csp`; `pnpm audit:gateway-artifacts`; `pnpm test:e2e`; `git ls-remote https://github.com/napplet/napplet.git refs/heads/main`.
files_changed: `.gitmodules`; `.github/workflows/build.yml`; `.github/workflows/unit.yml`; `.github/workflows/e2e.yml`; `.github/workflows/release.yml`; `package.json`; `packages/nip66/package.json`; `.planning/debug/pr-11-ci-failures.md`.
