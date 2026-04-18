---
"@kehto/acl": patch
---

v1.3 consume-and-showcase — no protocol changes to `@kehto/acl`. The demo's ACL panel (`apps/demo/src`) now drives grant/revoke/block/unblock through the canonical v1.2 `ShellAdapter.acl` hooks, and ACL-capability-matrix Playwright specs prove the package's enforcement contract end-to-end against the v1.3 demo napplet showcase.

Documentation:
- New canonical v1.2 `packages/acl/README.md` with `@example` JSDoc coverage for every non-type public export.
- typedoc reference generated via `pnpm docs:api` at repo root.

Requirement IDs covered:
- DEMO-03 (ACL panel grant/revoke/block/unblock flows)
- E2E-08 (`acl-grant-revoke`, `acl-block-unblock`, `acl-revoke-relay-write`, `acl-revoke-storage-write` specs green)
- DOCS-01, DOCS-02 (typedoc + per-package README)
