---
status: complete
quick_id: 260703-ghc
completed: 2026-07-03
commit: 8aa2123
---

# Quick Task 260703-ghc Summary

## Result

Kehto read-style raw event surfaces now use `RelayEventResult` records with optional `sidecar.resources` and `sidecar.relayHints`. NAP-OUTBOX no longer emits or grants `outbox.eose`; outbox streams continue until `outbox.close` or `outbox.closed`, while NAP-RELAY keeps its relay-local `relay.eose` lifecycle.

## Changed Files

- Added `packages/runtime/src/relay-result.ts` and exported shared result helpers/types from runtime.
- Updated runtime relay handling to emit/query `RelayEventResult` and normalize old registered-service `relay.event` carriers during migration.
- Updated reference relay/cache/coordinated/outbox services, Paja, and playground relay adapters to emit result-shaped events with relay hints.
- Updated tests and conformance guards for result-shaped events, sidecar relay hints, and absence of outbox EOSE.
- Updated resource-policy and migration docs plus a changeset for runtime/services/paja.

## Verification

- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check`
- `npx aislop scan`
- `git diff --check`

## Not Tested

- `pnpm test:e2e`
