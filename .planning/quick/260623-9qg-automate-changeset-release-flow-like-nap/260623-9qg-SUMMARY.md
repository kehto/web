---
status: complete
completed: 2026-06-23
task: automate changeset release flow like napplet/web
---

# Quick Task 260623-9qg Summary

Added push-to-main Changesets automation modeled after `napplet/web`.

## Changes

- Added `.github/workflows/publish.yml`.
  - On `push` to `main`, runs full Kehto gates.
  - Uses `changesets/action@v1` to create/update the Version Packages PR when pending changesets exist.
  - Publishes npm packages through `pnpm publish-packages` when the Version Packages PR is merged.
  - Publishes JSR packages afterward through OIDC, serially and topologically.
- Updated `pnpm version-packages` to run `scripts/sync-jsr-versions.mjs`, so Version Packages PRs include `jsr.json` version/import sync like `napplet/web`.
- Updated `AGENTS.md` release instructions and added a README Publish badge.
- Kept the existing tag/manual `release.yml` as a fallback path.

## Verification

- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/publish.yml"); puts "publish.yml yaml ok"'`
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/publish.yml`
- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check`
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main`
- `git diff --check`

## Notes

- The `github-workflows` skill expects `scripts/ci_monitor.cjs`, but this repo does not have that script. Workflow validation used official GitHub Actions docs, napplet/web's local workflow, YAML parsing, and upstream `actionlint` instead.
