---
status: complete
created: "2026-07-03T22:31:57Z"
branch: fix/docs-version-rows-after-version-pr-147
---

# Fix package docs version rows after Version Packages PR 147

## Objective

Repair the post-merge `main` CI and Pages docs audit failures after Version
Packages PR #147 merged.

## Evidence

Failed CI run `28686066689` for merge commit
`6e8bbe1bdc116d245174ae79ff7a24668270aa28` reports seven missing package
version rows in `docs/packages/*.md`:

- `@kehto/acl`: `0.15.4`
- `@kehto/cli`: `0.2.11`
- `@kehto/firewall`: `0.3.8`
- `@kehto/paja`: `0.6.3`
- `@kehto/runtime`: `0.18.2`
- `@kehto/services`: `0.16.1`
- `@kehto/shell`: `0.16.4`

## Plan

1. Update the seven docs package version rows to match package metadata.
2. Run `pnpm docs:check`, the docs audit, diff hygiene, and the slop gate.
3. Commit, push, and open a follow-up PR.
