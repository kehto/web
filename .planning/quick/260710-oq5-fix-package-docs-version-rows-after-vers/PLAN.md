---
status: complete
created: 2026-07-10
branch: fix/docs-version-rows-after-pr-182
---

# Fix Package Docs Version Rows After Version Packages PR 182

Task: repair the failed `Publish Web to GitHub Pages` run after Version Packages PR 182 merged to `main`.

## Evidence

Run `29103597508` failed in `Docs quality gate with Pages base` while executing `pnpm docs:check`.

The audit reported stale version rows for:

- `docs/packages/acl.md` expected `0.15.6`
- `docs/packages/cli.md` expected `0.2.14`
- `docs/packages/firewall.md` expected `0.3.9`
- `docs/packages/paja.md` expected `0.6.8`
- `docs/packages/runtime.md` expected `0.18.5`
- `docs/packages/services.md` expected `0.16.4`
- `docs/packages/shell.md` expected `0.17.1`

## Plan

1. Update only the stale package docs version rows to match `packages/*/package.json`.
2. Run the failing docs gate locally.
3. Commit, push, and open a follow-up PR.
