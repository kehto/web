---
status: complete
completed_at: 2026-06-28T16:16:23+02:00
branch: fix/docs-version-strings-for-release
---

# Quick Task 260628-mkr Summary

Fixed stale package documentation version rows that blocked `main` CI after the Version Packages PR merged.

## Completed

- Updated docs package version rows for `@kehto/acl`, `@kehto/cli`, `@kehto/firewall`, `@kehto/paja`, `@kehto/runtime`, `@kehto/services`, and `@kehto/shell`.
- Matched the versions to the current package manifests already on `main`.

## Verification

- `pnpm docs:check`
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main`
- `git diff --check`
