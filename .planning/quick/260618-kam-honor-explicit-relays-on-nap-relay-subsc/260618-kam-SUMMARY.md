---
status: complete
quick_id: 260618-kam
slug: honor-explicit-relays-on-nap-relay-subsc
commit: 3167eaa
---

# Quick Task 260618-kam Summary

## Result

Runtime `relay.subscribe` now honors the canonical NAP-RELAY `relay?: string` hint on the built-in relay-pool path. When a napplet supplies `relay`, the runtime passes that relay as the sole relay target to `RelayPoolAdapter.subscribe`; when it is absent, the existing `selectRelayTier(filters)` behavior remains unchanged.

## Protocol Finding

- `@napplet/nap@0.13.0` NAP-RELAY declares `RelaySubscribeMessage.relay?: string`.
- `@napplet/nap@0.13.0` NAP-OUTBOX declares `options.relays?: string[]`.
- Neither installed contract declares `pin`; kehto did not add `pin` handling.

## Files Changed

- `packages/runtime/src/relay-handler.ts`
- `packages/runtime/src/dispatch.test.ts`
- `.changeset/nap-relay-subscribe-relay-hint.md`

## Verification

- `pnpm vitest run packages/runtime/src/dispatch.test.ts` — 63 passed
- `pnpm test:unit` — 70 files / 1062 tests passed
- `pnpm type-check` — passed
- `pnpm build` — passed
- `pnpm lint` — no lint tasks configured/executed
- `npx --no-install aislop scan -d` — 82/100, no findings in modified runtime files; five pre-existing playground warnings remain
- `git diff --check` — passed

## Remaining Risks

- `pnpm test:e2e` was not run; this change is covered at the runtime unit boundary.
