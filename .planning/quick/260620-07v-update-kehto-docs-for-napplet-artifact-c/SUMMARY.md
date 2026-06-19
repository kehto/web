---
quick_id: 260620-07v
slug: update-kehto-docs-for-napplet-artifact-c
status: complete
completed_at: 2026-06-20T00:18:00+02:00
---

# Summary

Updated Kehto documentation for the shipped NIP-5D napplet artifact cache.

## Changed

- Added `docs/how-tos/implement-napplet-artifact-cache.md`.
- Added navigation/index links for the new how-to.
- Updated package and root docs so `@kehto/nip` includes NIP-5A/5D artifact
  verification and optional Cache Storage reuse.
- Added generated API landing links for the cache opener, cache adapter, and
  cache interfaces.
- Cross-linked the guide from the host-shell tutorials.

## Verification

- `pnpm docs:check`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm build`
- `pnpm lint`
- `git diff --check`
- `npx aislop scan` (exit 0; existing 82/100 warnings are unrelated baseline)
