---
status: complete
completed: 2026-07-03
---

# Quick Task 260703-vfz Summary

Aligned Kehto with current NAP-OUTBOX after upstream `napplet/naps` PR #32 removed caller-visible `strategy`, `live`, and `outbox.eose`.

## Changed

- Removed `OutboxStrategy`, `options.strategy`, and `options.live` from `@kehto/services` outbox-facing types and barrel exports.
- Added service-boundary option sanitizers so stale caller fields are dropped before custom routers see them.
- Simplified the relay-pool outbox router so runtime policy owns routing:
  - reads resolve author write relays;
  - directed publishes include recipient read relays;
  - relay EOSE is internal and does not close outbox subscriptions.
- Removed `outbox.eose` from ACL shell-push handling and added regression coverage.
- Added NIP-5D static guards for the removed outbox surface.
- Added a changeset for `@kehto/services` and `@kehto/acl`.

## Verification

- `pnpm exec vitest run packages/services/src/outbox-service.test.ts packages/services/src/relay-pool-outbox-router.test.ts`
- `pnpm exec vitest run packages/acl/src/resolve.test.ts tests/unit/nip5d-conformance-guard.test.ts`
- `pnpm --filter @kehto/services type-check`
- `pnpm --filter @kehto/acl type-check`
- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check`
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main`
- `git diff --check`

## Notes

Build/typecheck emitted existing non-fatal warnings about pnpm override metadata, Vite chunk sizing, and the side-effect-free NIP import in Paja.
