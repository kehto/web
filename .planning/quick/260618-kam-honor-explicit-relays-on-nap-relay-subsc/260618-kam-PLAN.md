---
status: in_progress
quick_id: 260618-kam
slug: honor-explicit-relays-on-nap-relay-subsc
---

# Quick Task 260618-kam: Honor explicit relay on NAP-RELAY subscribe

## Goal

Ensure runtime `relay.subscribe` honors the canonical explicit `relay` supplied on the NAP-RELAY envelope when routing through the built-in relay pool path. Do not add non-standard `pin` or `relays[]` handling to NAP-RELAY.

## Tasks

1. Add the explicit relay hint to the runtime relay subscribe path.
   - Files: `packages/runtime/src/relay-handler.ts`
   - Action: include canonical `relay?: string` on the runtime relay message shape and pass it into backend delivery as the only target relay.
   - Verify: focused runtime unit test sees the pool subscribe call receive the explicit relay list.
   - Done: no-relays behavior continues to use `selectRelayTier(filters)`.

2. Add regression coverage.
   - Files: `packages/runtime/src/dispatch.test.ts`
   - Action: add a relay pool stub that records `subscribe` relay URLs for a `relay.subscribe` envelope with `relays`.
   - Verify: run the relevant runtime tests.
   - Done: test fails before the code change and passes after it.
