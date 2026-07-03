# Quick Summary: Fix docs package version rows after release version bump

## Result

Updated package docs version rows to match the versions currently declared in
`packages/*/package.json` after the release PR.

## Root Cause

The versioning PR bumped package metadata but did not update the docs package
pages that `scripts/audit-docs.mjs` checks.

## Verification

- `pnpm docs:check`
- `git diff --check`
