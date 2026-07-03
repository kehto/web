---
status: complete
completed: "2026-07-03T22:02:00Z"
branch: fix/docs-version-rows-after-napplet-catchup
---

# Summary

Fixed the stale package docs version rows that broke the post-merge `main`
CI and Pages docs audit for merge commit `09cc32368b653bb2243323121480176ee64f7b29`.

## Changes

- `docs/packages/acl.md`: `0.15.2` -> `0.15.3`
- `docs/packages/paja.md`: `0.6.1` -> `0.6.2`
- `docs/packages/services.md`: `0.15.1` -> `0.16.0`

## Verification

- `pnpm docs:check`
- `git diff --check`
