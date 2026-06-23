---
status: complete
completed: 2026-06-23
task: implement bytesMany from updated NAP-RESOURCE
---

# Quick Task 260623-8is Summary

Implemented `resource.bytesMany` from the updated NAP-RESOURCE draft while preserving Kehto's legacy single-fetch wire fields for existing callers.

## Changes

- Added `resource.bytesMany` handling to `createResourceService` with ordered per-URL result items, per-item failures, and top-level invalid-request errors.
- Shared single and bulk fetch behavior through common per-URL policy/fetch logic so each bulk URL is grant-equivalent to `resource.bytes(url)`.
- Updated shell internal resource types and exports for bulk request/result/error envelopes.
- Updated ACL capability resolution so `resource.bytesMany` and its result/error pushes map to `resource:fetch`.
- Switched the playground resource demo and static guards to exercise `resource.bytesMany`.
- Added a changeset for `@kehto/acl`, `@kehto/services`, and `@kehto/shell`.
- Added explicit Turbo build edges for caret-pinned internal packages so package builds no longer race on stale or missing `dist` outputs.

## Verification

- `pnpm exec vitest run packages/services/src/resource-service.test.ts packages/acl/src/resolve.test.ts tests/unit/nip5d-conformance-guard.test.ts tests/unit/playground-gateway-guard.test.ts`
- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check`
- `CI=1 pnpm test:e2e`
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main`
- `git diff --check`

## Notes

- `pnpm test:e2e` without `CI=1` failed locally because the parallel run lost the `:4173` harness server and one playground persistence test observed parallel localStorage interference. The same failed harness slice passed with `--workers=1`, and full `CI=1 pnpm test:e2e` passed with 68/68 tests.
