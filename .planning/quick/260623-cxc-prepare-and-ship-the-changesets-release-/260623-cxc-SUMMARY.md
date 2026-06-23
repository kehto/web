---
quick_id: 260623-cxc
slug: prepare-and-ship-the-changesets-release-
status: complete
---

# Summary

Prepared the Changesets release branch for the merged NAP parity stack.

## Completed

- Ran `pnpm version-packages`, consuming the pending changesets and writing package changelogs.
- Synced package and JSR versions:
  - `@kehto/acl` `0.13.0`
  - `@kehto/cli` `0.2.1`
  - `@kehto/firewall` `0.3.2`
  - `@kehto/paja` `0.3.0`
  - `@kehto/runtime` `0.14.0`
  - `@kehto/services` `0.12.0`
  - `@kehto/shell` `0.14.0`
  - `@kehto/playground` `0.1.0`
  - `@test/harness` `0.0.16`
- Updated package docs version rows and stale `@napplet/*` peer ranges.
- Removed explicit pnpm versions from GitHub workflows so `pnpm/action-setup` reads `packageManager: pnpm@10.8.0`.

## Verification

- `pnpm version-packages`
- `git diff --check`
- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check`
- `npx --no-install aislop scan`

## Follow-up

- Push release PR branch.
- Merge release PR after GitHub checks pass.
- Push `v1.35` tag to trigger the publish workflow.
