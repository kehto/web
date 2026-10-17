---
phase: 113-service-authorization-boundaries
plan: 01
subsystem: resource authorization and transport
tags: [resource, authorization, paja, ssrf, cancellation]
dependency_graph:
  requires: [phase-112-approval-lifecycle]
  provides: [canonical-resource-authorization, one-hop-proxy-transport]
  affects: [services, paja, shell, playground]
tech_stack:
  added: []
  patterns: [request-held-network-lease, DNS-address-pinning, explicit-redirect-reauthorization]
key_files:
  modified:
    - packages/services/src/resource-service.ts
    - packages/services/src/resource-authorization.ts
    - packages/paja/src/browser-resource.ts
    - packages/paja/src/server-resource-transport.ts
    - packages/paja/src/server.ts
decisions:
  - Retain a network approval through body delivery and reuse an already approved origin only within that resource request.
  - Keep proxy redirects as explicit metadata so the browser authorizes each next destination before a new request.
metrics:
  tasks_completed: 2
status: complete
---

# Phase 113 Plan 01: Resource Authorization and Trusted Transport Summary

Canonical resource requests now hold composed authorization from exact URL validation through body delivery, and Paja's one-hop proxy verifies the real destination before it connects.

## Delivered

- Enforced interface, byte-exact resource URL, and actual network-origin authorization for every resolver contact, including HTTP(S), WS(S), redirects, cache delivery, and response-body lifetime.
- Made explicit cancellation silent; live permission revocation aborts work and produces one current-source `blocked-by-policy` terminal. Source replacement and teardown discard stale outcomes.
- Added ordered `bytesMany` per-URL outcomes, canonical padded base64 results, bounded per-window replay protection, and cancellation controls that bypass rate and approval gates.
- Added a host-only Paja resource endpoint with origin/Host/capability checks, public-address DNS validation and pinning, timeout and byte limits, disconnect abort propagation, and redirect metadata for a separately approved next hop.
- Added regressions for DNS/address policy, redirects, credential and origin rejection, cancellation, replay, network-lifetime/revocation, same-origin redirects, concurrent approval, and denied resolver transport.

## Protocol Authority

Rechecked before completion against NAP-RESOURCE PR #80 at `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc` and NIP-5D at `5560820fa4f37f45b8ab742a11aeb3001b17dc67`. The implementation uses the PR #80 canonical `url`/`urls` request fields and padded base64 wire values.

## Combined Plan 01 + 02 Verification

- `pnpm build` — 32/32 tasks passed (`/tmp/kehto-resource-combined-build-final.log`).
- `pnpm type-check` — 17/17 tasks passed (`/tmp/kehto-resource-combined-type-final.log`).
- `pnpm test:unit` — 196 files and 2472 tests passed (`/tmp/kehto-resource-combined-unit-final-2.log`).
- `pnpm docs:check` — passed after the completed build (`/tmp/kehto-resource-combined-docs-final-2.log`).
- `pnpm dlx aislop@0.12.0 scan --changes --json` — score 100 (`/tmp/kehto-resource-combined-quality-final-2.json`).
- `KEHTO_HARNESS_PORT=42873 pnpm test:e2e` — 126 browser tests passed in 2.2 minutes (`/tmp/kehto-resource-combined-e2e-final.log`).

## Phase 114 Prerequisite

This plan secures service-initiated resolver contacts and the Paja transport. It does not claim end-to-end iframe isolation: Phase 114 still owns direct-network and subresource admission for host frames. The resource service must not be presented as permission for an otherwise unrestricted napplet frame to fetch directly.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Bug] Closed resolver discovery authorization and lifetime gaps.**
   - Discovery relay contacts, including bootstrap and selected-author BUD03 relays, now require their own exact authorization and receive cancellation before a query can open a socket.
   - Updated the newest valid NIP-65 selection, cache generation invalidation, and signer bootstrap lifetime to avoid stale or unapproved discovery delivery.

## Self-Check: PASSED
