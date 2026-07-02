---
status: complete
completed_at: 2026-07-02T04:00:00Z
issue: https://github.com/kehto/web/issues/127
---

# Summary

Implemented Kehto-side NAP-COUNT support against the live `napplet/naps#69`
draft shape: `count.query` / `count.query.result`.

## Changes

- Added runtime validation and dispatch for the `count` domain.
- Added `createCountService()` as the reference count service helper.
- Advertised `count` from shell capabilities only when a count service is wired.
- Wired Paja's memory relay fixture/event store to answer exact `count.query`
  results without event payloads.
- Mapped `count.*` to `relay:read` in ACL while the draft depends on relay
  support and has no separate capability bit.
- Documented count approximation/refusal semantics and Paja's relay dependency.
- Added regression coverage for exact counts, invalid filters, unavailable
  backend refusal, unsupported filters, and no event-payload leaks.
- Repaired the slop gate by declaring the shared playground Vite plugin
  dependency and surfacing preference-storage fallback failures.

## Verification

- `pnpm vitest run --config vitest.config.ts packages/runtime/src/count-dispatch.test.ts packages/services/src/count-service.test.ts packages/shell/src/shell-init.test.ts packages/acl/src/resolve.test.ts packages/paja/src/parity.test.ts`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check`
- `pnpm lint` (no package lint tasks configured)
- `npx aislop scan`
- `git diff --check`
- `npm view @napplet/nap version dist-tags --json` still reports `0.24.0`, so no published count types were available to import.
