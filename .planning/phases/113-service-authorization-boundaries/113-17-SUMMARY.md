---
phase: 113-service-authorization-boundaries
plan: 17
subsystem: host-service-registration
tags: [paja, playground, resource, network, service-authorization]
dependency_graph:
  requires: [113-03, 113-04, 113-16]
  provides: [host-service-consumer-matrix]
  affects: [paja, playground, services]
status: complete
---

# Phase 113 Plan 17: Host service consumers

Paja and the playground now register the migrated service contracts with their actual destinations, cancellation signals, and source-owned controllers. Paja keeps its resource resolver capability in the trusted main-frame adapter. The playground approves its first HTTP(S) destination through the runtime and rejects redirects that it cannot reauthorize per hop.

The [consumer matrix](../../research/firewall-approvals.md) names each service's authority, interface and scoped requirements, rate and lifecycle owner, host consumer, and regression surface. The static host registration guard checks the constructor contracts, including Paja's immutable COUNT relay plan and OUTBOX signer identity. Phase 114 still owns launch admission, approval UI, and CSP enforcement.

## Verification

- `pnpm exec vitest run packages/paja/src/browser-adapter-host-actions.test.ts tests/unit/nip5d-conformance-guard.test.ts tests/unit/playground-relay-service.test.ts tests/unit/host-service-registration.test.ts` — 55 tests passed.
- `pnpm --filter @kehto/playground exec tsc --noEmit` — passed.
- `pnpm docs:check` — TypeDoc and docs audit passed.

## Authority

The matrix records exact NAP refs. Phase 113 checked NAP-RESOURCE PR #80 at `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`, NAP-OUTBOX PR #32 at `8865f73d52a4864afee145f28d26520476273927`, NAP-COUNT PR #69 at `9353a0c6c02c595f7e65ebd6df3802a7a45fc6bf`, and NIP-5D PR #2303 at `5560820fa4f37f45b8ab742a11aeb3001b17dc67`. The browser resolver and direct-network policy remain bounded host behavior where the current draft does not specify an enforceable browser mechanism.
