---
slug: pr-12-test-failing
status: resolved
trigger: "test is failing: https://github.com/kehto/web/pull/12"
created: 2026-05-23
updated: 2026-05-23T14:22:21Z
---

# Debug: PR 12 Test Failing

## Symptoms

**Expected:** PR #12 checks pass for build/type-check, docs quality, Vitest, and Playwright.

**Actual:** GitHub reports PR #12 branch `feat/docs` as unstable because the Build workflow's `Build & Type-Check` job fails at the docs quality gate.

**Error messages:** `pnpm docs:check` fails in `typedoc --treatWarningsAsErrors`; TypeDoc reports 52 warnings for README links whose relative targets under `../../docs/api/functions/` and `../../docs/api/modules/` are not generated files.

**Timeline:** Failure visible on 2026-05-23 after the v1.13 documentation milestone commits were pushed to PR #12.

**Reproduction:** Run `pnpm docs:check` on branch `feat/docs`, or inspect GitHub Actions run `26335012261`, job `77527170353`.

## Current Focus

hypothesis: CONFIRMED. Package README links pointed at ignored/generated `docs/api` HTML, so fresh CI workspaces failed TypeDoc's link validation before the generated targets existed.
test: Remove generated-HTML links from package READMEs, keep checked-in package docs links, delete local ignored `docs/api`, and rerun the docs quality gate from a fresh-output state.
expecting: `pnpm docs:check` completes without TypeDoc warnings when warning-as-error mode is enabled.
next_action: Push the README link repair and watch PR #12 checks rerun.

## Evidence

- timestamp: 2026-05-23T14:19:19Z
  finding: `gh pr view 12` reports PR #12 `feat/docs` -> `main` with `Build & Type-Check` failing and Vitest passing on the first run.
  confirms: The failing surface is the docs/build workflow, not the unit-test workflow.
- timestamp: 2026-05-23T14:19:19Z
  finding: Latest Build workflow rerun `26335012261` completed build, CSP audit, and type-check successfully, then failed the `Docs quality gate` step.
  confirms: The current blocker is isolated to `pnpm docs:check`.
- timestamp: 2026-05-23T14:19:19Z
  finding: Failed job logs show `typedoc --treatWarningsAsErrors` produced 52 warnings for README links such as `../../docs/api/functions/_kehto_acl..createState.html`, while generated API files are under categories such as `docs/api/types` and `docs/api/interfaces`.
  confirms: The docs gate failure is caused by broken generated API links.
- timestamp: 2026-05-23T14:22:21Z
  finding: `docs/api` is ignored by git, and local generated output can mask the failure; after deleting `docs/api`, `pnpm docs:check` passed with the package README links converted to checked-in docs links or plain generated module paths.
  confirms: The fix works under fresh-clone output conditions.
- timestamp: 2026-05-23T14:22:21Z
  finding: `pnpm --filter @kehto/docs docs:build` passed without relying on the cached Turbo replay used during the first `docs:check` run.
  confirms: The VitePress docs site still builds after the README link repair.

## Eliminated

- Build output generation failure. The latest GitHub job completed `Build all packages` successfully before the docs gate.
- TypeScript type-check failure. The latest GitHub job completed `Type-check all packages` successfully before the docs gate.
- Unit-test failure as the current blocker. The first visible Vitest check for PR #12 passed.

## Resolution

root_cause: Package READMEs ingested by TypeDoc linked directly to ignored/generated `docs/api` HTML. In local workspaces where `docs/api` already existed, `typedoc --treatWarningsAsErrors` passed. In a fresh GitHub Actions checkout, TypeDoc validated those README links before generating `docs/api`, emitted 52 warnings, and failed the docs quality gate because warnings are treated as errors.
fix: Convert generated API deep links in `packages/acl`, `packages/runtime`, `packages/shell`, and `packages/services` READMEs to plain API symbol names, and point the package-level reference section at checked-in `docs/packages/*.md` plus a plain generated module path.
verification: `rm -rf docs/api`; `pnpm docs:check`; `pnpm --filter @kehto/docs docs:build`; `git diff --check`.
files_changed: `packages/acl/README.md`; `packages/runtime/README.md`; `packages/shell/README.md`; `packages/services/README.md`; `.planning/debug/pr-12-test-failing.md`.
