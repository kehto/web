---
status: complete
completed: 2026-07-06
branch: fix/shell-docs-version-0-16-5
---

# Quick Task 260706-pa2 Summary

Updated `docs/packages/shell.md` so the `@kehto/shell` manifest facts row matches the release version `0.16.5` from PR #152.

## Evidence

- GitHub CI failure `28805376658`: docs audit failed because `docs/packages/shell.md` was missing the `@kehto/shell` `0.16.5` version row.
- GitHub Pages failure `28805375584`: same docs audit failure under `VITEPRESS_BASE=/web/docs/`.
- Local recovery: normal docs gate, Pages-base docs gate, gateway artifact audit, page pack/audit, type-check, unit tests, lint, diff check, and aislop all passed.

## Notes

Initial parallel docs-check verification corrupted VitePress generated temp output. Re-running sequentially after removing ignored generated docs output passed.
