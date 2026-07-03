---
status: complete
completed: "2026-07-03T22:33:00Z"
branch: fix/docs-version-rows-after-version-pr-147
---

# Summary

Fixed stale public package docs version rows after Version Packages PR #147
merged and bumped package metadata.

## Changes

- `docs/packages/acl.md`: `0.15.3` -> `0.15.4`
- `docs/packages/cli.md`: `0.2.10` -> `0.2.11`
- `docs/packages/firewall.md`: `0.3.7` -> `0.3.8`
- `docs/packages/paja.md`: `0.6.2` -> `0.6.3`
- `docs/packages/runtime.md`: `0.18.1` -> `0.18.2`
- `docs/packages/services.md`: `0.16.0` -> `0.16.1`
- `docs/packages/shell.md`: `0.16.3` -> `0.16.4`

## Verification

- `pnpm docs:check`
- `node scripts/audit-docs.mjs`
- `git diff --check`
