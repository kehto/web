---
status: complete
quick_id: 260628-l1y
description: Add NAP-RESOURCE resource.info runtime support
commit: 5415c74
---

# Quick Task 260628-l1y Summary

Implemented NAP-RESOURCE `resource.info` support for the Kehto runtime stack.

## Changed

- Added `resource.info` handling to `createResourceService`.
- Added advisory `ResourceInfo`/provider types and public service exports.
- Updated ACL mapping so `resource.info.result` and `resource.info.error` are shell-to-napplet responses gated by `resource:fetch`.
- Updated shell internal resource wire types for the new request/result/error envelopes.
- Updated `@kehto/services` README and added a patch changeset for `@kehto/acl`, `@kehto/services`, and `@kehto/shell`.

## Verification

- `pnpm exec vitest run --config vitest.config.ts packages/services/src/resource-service.test.ts packages/acl/src/resolve.test.ts`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check`
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main`
- `git diff --check`

## Result

Ready for PR as the standalone NAP-RESOURCE slice.
