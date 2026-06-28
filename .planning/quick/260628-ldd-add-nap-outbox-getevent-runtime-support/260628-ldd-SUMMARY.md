---
status: complete
completed_at: 2026-06-28T15:28:27+02:00
branch: fix/nap-outbox-get-event
---

# Quick Task 260628-ldd Summary

Added Kehto support for the NAP-OUTBOX `outbox.getEvent` single-event lookup request.

## Completed

- Added local `OutboxEventOptions` and `OutboxEventResult` types.
- Added `outbox.getEvent` handling to `createOutboxService`, including compatibility fallback through `query` for routers without a native method.
- Added native `getEvent` support to `createRelayPoolOutboxRouter`, reusing verified query fanout and enforcing requested event ID matching.
- Added service, relay-pool router, ACL, and runtime dispatch regression tests.
- Exported the new outbox event types, documented service support, and added a patch changeset for `@kehto/services`.

## Verification

- `pnpm exec vitest run --config vitest.config.ts packages/services/src/outbox-service.test.ts packages/services/src/relay-pool-outbox-router.test.ts packages/acl/src/resolve.test.ts packages/runtime/src/outbox-dispatch.test.ts`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check`
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main`
- `git diff --check`
