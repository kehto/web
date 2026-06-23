---
quick_id: 260623-cxc
slug: prepare-and-ship-the-changesets-release-
status: planned
---

# Quick Task 260623-cxc: Prepare and ship the Changesets release for the merged NAP parity stack

## Tasks

1. Run the Changesets version ceremony on a release branch from current `origin/main`.
2. Verify generated package versions, changelogs, JSR versions, and consumed changesets.
3. Run release PR validation gates.
4. Push, open, merge the release PR, then push the release tag that triggers publishing.

## Verification

- `pnpm version-packages`
- `git diff --check`
- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check`
- `npx aislop scan`
- GitHub PR checks
- Release workflow status after pushing the `v*` tag
