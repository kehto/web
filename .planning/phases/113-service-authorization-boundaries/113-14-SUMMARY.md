---
phase: 113-service-authorization-boundaries
plan: 14
subsystem: local-state-authorization
tags: [relay-cache, config, theme, firewall, revocation]
dependency_graph:
  requires: [113-02, 113-03, 113-19]
  provides: [source-safe-cache-delivery, revocable-config-delivery, eligible-theme-broadcast]
  affects: [services]
tech_stack:
  added: []
  patterns: [source-generation, interface-only-local-approval, runtime-eligible-push]
key_files:
  modified:
    - packages/services/src/cache-service.ts
    - packages/services/src/config-service.ts
    - packages/services/src/theme-service.ts
decisions:
  - Cache remains an internal NAP-RELAY optimization and adds neither a NAP-CACHE wire nor another authorization operation.
  - Theme delivery uses runtime recipient eligibility so hosts cannot broadcast to domains the runtime has not exposed.
metrics:
  tasks_completed: 2
status: complete
---

# Phase 113 Plan 14: Local State Authorization Summary

Cache, CONFIG, and THEME now have explicit local-only lifecycle boundaries without invented network permissions.

## Delivered

- Cache tracks relay subscription generations per source and suppresses delayed cache events and EOSE after revocation, teardown, or replacement. It still accepts only internal `relay.subscribe` and `relay.publish` traffic.
- CONFIG removes source-owned schemas and subscribers on permission revocation; queued host commits can no longer push through a retired subscription.
- THEME keeps its read local: `theme.get` uses interface-only approval, and host `theme.changed` delivery runs through `sendToEligibleNapplet` for current domain/ACL eligibility.

## Protocol Authority

Checked NAP-CONFIG PR #14 at `bed9cb5b1e7c9b5babee8870aa18b12949af1d62`, NAP-THEME master at `19de5ce1cea40cd4c76089cdd8126e9f87648049`, and NIP-5D PR #2303 at `5560820fa4f37f45b8ab742a11aeb3001b17dc67`. No NAP-CACHE exists at the checked authority; cache remains an implementation detail beneath approved NAP-RELAY work.

## Verification

- `pnpm exec vitest run packages/services/src/cache-service.test.ts packages/services/src/config-service.test.ts packages/services/src/theme-service.test.ts` — 3 files, 26 tests passed.
- `pnpm --filter @kehto/services type-check` is blocked by concurrent `intent-service.ts` work passing an `ApprovalSignal` where an `AbortSignal` is required; Plan 14 files type-check through the focused suites.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 2 - Critical functionality] Routed theme broadcasts through runtime eligibility.**
   - The legacy host callback could broadcast an exposed-domain push to stale or unexposed recipients.
   - The service now asks the runtime to deliver each current recipient while retaining the host callback for host integrations.

## Self-Check: PASSED
