---
status: complete
created: "2026-07-03T22:00:57Z"
branch: fix/docs-version-rows-after-napplet-catchup
---

# Fix package docs version rows after Napplet catch-up merge

## Objective

Repair the post-merge `main` CI and Pages docs audit failures after PR #145
merged behind the release/version package PR.

## Evidence

Failed workflow logs for merge commit `09cc32368b653bb2243323121480176ee64f7b29`
reported:

- `docs/packages/acl.md` missing `| Version | \`0.15.3\` |`
- `docs/packages/paja.md` missing `| Version | \`0.6.2\` |`
- `docs/packages/services.md` missing `| Version | \`0.16.0\` |`

## Plan

1. Update only those package docs version rows.
2. Run `pnpm docs:check`, targeted audit proof, and diff hygiene.
3. Commit, push, and open a follow-up PR.
