---
phase: 113-service-authorization-boundaries
plan: 08
subsystem: services-cvm
tags: [firewall, approvals, nap-cvm, lifecycle]
dependency_graph:
  requires: [113-02]
  provides: [approved-cvm-relay-plans, source-owned-cvm-sessions]
  affects: [services, paja]
tech_stack:
  added: []
  patterns: [detached-relay-plan, exact-origin-approval, generation-guard]
key_files:
  modified:
    - packages/services/src/cvm-service.ts
    - packages/services/src/cvm-nostr-transport.ts
    - packages/services/src/cvm-service.test.ts
    - packages/services/src/cvm-nostr-transport.test.ts
decisions:
  - Relay origin selection is a side-effect-free transport plan that the service authorizes before Nostr contact.
  - CVM sessions are owned by a window generation and physical transport closes only when no sibling retains the server.
metrics:
  tests: 56
status: complete
---

# Phase 113 Plan 08: CVM authorization boundaries Summary

CVM now authorizes selected discovery and server relay origins before relay contact, and binds active sessions to their source generation.

## Delivered

- Added detached discovery and request relay plans to the Nostr transport, with canonical `ws:`/`wss:` origin validation.
- Applied interface, server-resource, and exact network-origin requirements through `authorizeOperation` before discovery, signing, encryption, subscriptions, or publish work.
- Propagated approval abort signals through live discovery and request execution.
- Kept NAP-CVM terminal messages in their canonical `cvm.*.result` envelopes.
- Bound sessions and event delivery to a window generation; a revoked or destroyed source cannot receive late results/events or close another source's session.
- Retained physical transport state while a sibling source still owns the same server, and released it only after the final owner closes or is revoked.

## Protocol conformance

Checked NAP-CVM draft PR #31 at `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f` and NIP-5D PR #2303 at `5560820fa4f37f45b8ab742a11aeb3001b17dc67` on 2026-10-17. The implementation preserves the specified `cvm.discover`, `cvm.request`, `cvm.close`, and `cvm.event` directions and their terminal `*.result` shapes; authorization is host-side and does not alter wire payloads.

## Verification

- `pnpm exec vitest run packages/services/src/cvm-service.test.ts packages/services/src/cvm-nostr-transport.test.ts packages/paja/src/browser-cvm.test.ts` — 56 passed
- `pnpm --filter @kehto/services type-check` — passed
- `pnpm --filter @kehto/paja type-check` — passed

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- CVM service and Nostr transport changes are committed in `bc7b80b9`.
- Lifecycle and detached-plan regressions are committed in `caf8687a`.
