---
status: fixing
trigger: "version packages and release CI have been failing. please fix and make sure published releases are up to date."
created: 2026-11-12
updated: 2026-11-12
---

# Version Packages and registry recovery

## Symptoms

Expected: generated version PRs run their checks; released package versions on
npm and JSR match validated main.
Actual: version PR checks expire awaiting approval; npm rejects mocks and
rate-limit; JSR rejects rate-limit and stops before later packages.

## Current Focus

Hypothesis: GITHUB_TOKEN-created PRs need approval, the Changesets action now
requires its explicit github-token input, and registry registration is incomplete.
Next action: repair credential wiring and registry failure isolation, verify all
gates, ship a PR, then recover the validated release and audit both registries.

## Evidence

- Primary checkout is on merged PR #421's branch with unrelated package.json
  and untracked shell skills changes. Preserved in place; this task uses
  ~/.worktrees/kehto/release-ci-registry-recovery from origin/main b2d15ab6.
- CI run 43259631332 and Changeset Guard 43259630941 have zero jobs. GitHub's
  run annotation says approval expired. Both were created by github-actions[bot].
- GitHub documents that GITHUB_TOKEN-created PRs require approval; App/PAT
  tokens avoid it. No repository Actions secrets are currently configured.
- changesets/action v1 action.yml now defines github-token, defaulting to
  github.token. Its documentation says setting GITHUB_TOKEN env is insufficient.
- Release 43262917698 runs as dskvr, so the old JSR bot-actor problem is absent.
  npm successfully publishes acl 0.20.6 but rejects mocks 0.1.4 and rate-limit
  0.2.0 with E404. JSR publishes acl, then rate-limit fails actorNotAuthorized.
- api.jsr.io/scopes/kehto/packages/rate-limit reports githubRepository: null,
  versionCount: 0. mocks is linked to kehto/web, latest JSR version 0.1.3.
- npm public metadata has mocks 0.1.0 and rate-limit 0.1.0; the other nine
  package targets are published. Local npm authentication returns E401;
  browser npm settings are blocked by Cloudflare. User asked asynchronously
  to repair the two npm Trusted Publishers and the JSR repository link.
- Release target b2d15ab68f60655b3d380fe9b28b7718fc85adb9 has successful main
  CI 43262664045, Pages 43262663809, and Version Packages 43262917548.

## Scope

Workflow/release infrastructure only; no NAP message, implementation, or
protocol policy changes. No package output changes or changeset required.
Execute gsd-debug inline per skill spawn restriction.

## Implementation and verification

- Pass the dedicated token to checkout and the action's github-token input.
  Keep the manual-approval fallback, but warn and write a run summary when
  changesets are pending and no dedicated token is configured.
- Require successful build and metadata sync before JSR; continue independent
  JSR packages after failure with pnpm --no-bail, retaining nonzero exit status.
- Add a release runbook and regressions that execute the approval warning
  script and the real pnpm command with a fake registry CLI.
- pnpm build PASS; pnpm type-check PASS; pnpm test:unit PASS (267 files,
  3418 tests); pnpm docs:check PASS (11 public package docs); metadata sync
  produces no changes; pinned aislop 0.12.0 scores 100/100. One pre-existing
  Paja function-length warning remains; no new findings or config changes.
- Browser tests not run locally: no browser/runtime or harness behavior changed.
- Rechecked exact target prerequisites, then dispatched recovery 43272633903
  against b2d15ab6 with npm skipped and eight linked JSR packages selected.
  rate-limit and its Paja/CLI dependents remain held for registry registration.

## Recovery progress

- PR #430: https://github.com/kehto/web/pull/430. GitHub build/type/docs and
  unit gates pass; Playwright is running.
- Recovery 43272633903 succeeded: runtime 0.30.0, services 0.32.1, mocks
  0.1.4, and shell 0.34.0 published to JSR.
- User repaired npm/JSR settings. Public JSR API confirms rate-limit now
  links to kehto/web. Recovery 43273088163 published rate-limit 0.2.0,
  Paja 0.35.0, and CLI 0.7.1 to JSR, completing that registry. npm mocks
  0.1.4 also published; rate-limit was rejected before settings confirmation.
- Retrying the full release after the settings confirmation. Target remains
  b2d15ab6; exact main CI, Pages, and versioning prerequisites rechecked green.
- Explained fine-grained PAT creation and the CHANGESETS_GITHUB_TOKEN secret
  directly to the user. Awaiting secret configuration; no credentials in chat.
- actionlint 1.7.7 passed both changed workflows. Final docs and pinned quality
  gates pass after the runbook edit; primary checkout remains unchanged.
