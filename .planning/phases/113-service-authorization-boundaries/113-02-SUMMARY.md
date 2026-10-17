---
phase: 113-service-authorization-boundaries
plan: 02
subsystem: resource wire consumers and browser projection
tags: [resource, nap-resource, shell, paja, playground]
dependency_graph:
  requires: [113-01]
  provides: [canonical-shell-resource-projection, authorized-paja-discovery]
  affects: [shell, paja, playground, active-media-consumers]
tech_stack:
  added: []
  patterns: [strict-base64-wire-validation, host-owned-signer-relay-cache, source-generation-cancellation]
key_files:
  modified:
    - packages/shell/src/napplet-namespace.ts
    - packages/shell/src/types/internal-resource.ts
    - packages/paja/src/browser-adapter.ts
    - packages/paja/src/browser-blossom-events.ts
    - packages/paja/src/browser-relay-runtime.ts
    - tests/e2e/nap-resource.spec.ts
decisions:
  - The injected API decodes canonical base64 wire bytes to Blob values only after trusted-parent validation.
  - Signer relay candidates are refreshed by host lifecycle hooks, never by a resource request.
metrics:
  tasks_completed: 3
status: complete
---

# Phase 113 Plan 02: Canonical Resource Consumers and Browser Flow Summary

The shell, Paja, playground, and active media consumers now use the same canonical NAP-RESOURCE URL/base64 wire and retain authorization through actual resolver discovery and browser delivery.

## Delivered

- Migrated the injected `resource.bytes` and `resource.bytesMany` projection to canonical `url`/`urls` messages and strict padded-base64 result decoding into browser `Blob` values.
- Rejected retired `requestId`, `requests`, server-hint, Blob, malformed base64, and stale-parent-result forms, while preserving trusted-parent, request correlation, cancellation, partial-bulk, and object-URL lifecycle behavior.
- Registered Paja's enforcing resolver rather than direct browser HTTP fetches. Its Blossom bootstrap, NIP-65 author selection, BUD03 discovery, redirects, and raw resource transport authorize actual destinations before each contact.
- Migrated the resource demo plus feed/profile media consumers from the published shim wire to the host-injected projection, with browser proof that canonical base64 produces usable Blob content.
- Added source-generation cache protection and socket cancellation so an old window or revoked approval cannot populate or deliver a discovery result to a replacement source.
- Updated package and policy documentation, compatibility retirement guidance, conformance guards, and changesets for the canonical wire and protected proxy.

## Signer Bootstrap Cache Policy

Supported signer relay candidates are refreshed at adapter initialization and signer-change lifecycle events, then read from a host-owned cache during resource discovery. Resource requests never call `signer.getRelays()`, so an extension or remote signer cannot perform unapproved I/O on a resource request path. A synchronous or asynchronous signer failure leaves configured host relays available as the bounded fallback.

## Protocol Authority

Rechecked before completion against NAP-RESOURCE PR #80 at `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc` and NIP-5D at `5560820fa4f37f45b8ab742a11aeb3001b17dc67`. The consumer contract follows PR #80 canonical URL inputs and RFC 4648 padded base64 wire output.

## Combined Plan 01 + 02 Verification

- `pnpm build` — 32/32 tasks passed (`/tmp/kehto-resource-combined-build-final.log`).
- `pnpm type-check` — 17/17 tasks passed (`/tmp/kehto-resource-combined-type-final.log`).
- `pnpm test:unit` — 196 files and 2472 tests passed (`/tmp/kehto-resource-combined-unit-final-2.log`).
- `pnpm docs:check` — passed after the completed build (`/tmp/kehto-resource-combined-docs-final-2.log`).
- `pnpm dlx aislop@0.12.0 scan --changes --json` — score 100 (`/tmp/kehto-resource-combined-quality-final-2.json`).
- `KEHTO_HARNESS_PORT=42873 pnpm test:e2e` — 126 browser tests passed in 2.2 minutes (`/tmp/kehto-resource-combined-e2e-final.log`).

## Phase 114 Prerequisite

The authorized resource transport and canonical browser projection are complete, but full host-frame isolation remains Phase 114 work. That phase must govern direct network and subresource admission before the system can claim end-to-end iframe network confinement.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Bug] Repaired live Blossom discovery authorization.**
   - Existing relay discovery could query before resource network approval or return a stale result after window replacement. The resolver now preserves normal NIP-65 discovery behavior while authorizing each real contact and invalidating stale generations.

2. **[Rule 2 - Critical functionality] Preserved signer-derived bootstrap capability without request-time extension calls.**
   - A host lifecycle cache retains supported signer relay candidates and handles synchronous and asynchronous signer failures without narrowing discovery to configured relays.

## Self-Check: PASSED
