---
phase: 113-service-authorization-boundaries
plan: 09
subsystem: direct-message authorization
tags: [nap-dm, nip17, relay, firewall, revocation]
dependency_graph:
  requires: [113-02, 113-05]
  provides: [approved-dm-relay-plans, revocable-dm-subscriptions]
  affects: [services, paja]
tech_stack:
  added: []
  patterns: [side-effect-free-relay-planning, exact-destination-approval, source-owned-subscriptions]
key_files:
  modified:
    - packages/services/src/dm-service.ts
    - packages/services/src/dm-types.ts
    - packages/services/src/dm-nip17-adapter.ts
    - packages/services/src/dm-service.test.ts
    - packages/paja/src/browser-dev-runtime.ts
decisions:
  - NIP-17 relay selection is exposed as a detached plan before authorization; wrapping and relay transport receive only that approved plan.
  - Legacy adapters retain their host-only path with a once-per-service migration warning until they implement relay planning.
metrics:
  tasks_completed: 2
status: complete
---

# Phase 113 Plan 09: DM Authorization and Subscription Boundaries Summary

NAP-DM now authorizes immutable NIP-17 relay plans before history retrieval, message encryption, signing, publishing, or subscription setup, and revokes source-owned live delivery precisely.

## Delivered

- Added side-effect-free `planRelays` and approved execution hooks to the DM adapter contract. The NIP-17 adapter passes only the approved relay list to query, publish, and subscribe.
- Composes exact recipient or conversation resource requirements with every selected WebSocket origin before a DM operation runs under runtime approval.
- Validates send recipient/content before approval, keeps generic NAP-DM terminal envelopes, and never invokes wrapping or relay transport after a denied operation.
- Binds message callbacks to the active source generation and subscription ownership. Permission revocation physically unsubscribes live relay work and blocks later `dm.message` delivery.
- Updated Paja's NIP-17 relay bridge so its publish path receives the approved relay list instead of reselecting destinations.

## Protocol Authority

Checked NAP-DM PR #74 at `2c4e4423f40e72675822225acacea2ee5889ade2` and NIP-5D PR #2303 at `5560820fa4f37f45b8ab742a11aeb3001b17dc67`. The change keeps the draft's canonical `dm.status`, `dm.conversations`, `dm.messages`, `dm.send`, `dm.subscribe`, `dm.unsubscribe`, and `dm.message` envelopes.

## Verification

- `pnpm exec vitest run packages/services/src/fs-service.test.ts packages/paja/src/browser-fs.test.ts packages/paja/src/browser-dm-fs.test.ts packages/services/src/dm-service.test.ts tests/unit/dm-nip17-nak.test.ts` — 5 files, 36 tests passed.
- `pnpm --filter @kehto/services type-check` — passed.
- `pnpm --filter @kehto/services build` — passed.
- `pnpm --filter @kehto/paja type-check` — passed after rebuilding services declarations.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 2 - Critical functionality] Added an approved-relay execution seam to the generic adapter contract.**
   - A service-only guard could not prevent NIP-17 from selecting and contacting relays while loading history or publishing wraps.
   - The adapter now separates plan selection from all side effects, and Paja consumes the resulting immutable plan.

## Self-Check: PASSED
