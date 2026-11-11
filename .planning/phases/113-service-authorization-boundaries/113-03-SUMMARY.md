---
phase: 113-service-authorization-boundaries
plan: "03"
subsystem: relay-runtime
tags: [relay, firewall, approval, lifecycle]
requires: [113-02]
provides: [runtime-owned-relay-authorization, immutable-relay-service-plan]
affects: [113-19, 113-17]
tech-stack:
  added: []
  patterns: [plan-approve-execute, exact-generation-lifecycle]
key-files:
  modified:
    - packages/runtime/src/relay-handler.ts
    - packages/runtime/src/service-types.ts
    - packages/runtime/src/runtime.ts
    - packages/services/src/relay-pool-service.ts
    - packages/services/src/coordinated-relay.ts
decisions:
  - Runtime owns one relay approval before buffer, cache, cryptography, service execution, or transport.
  - Registered relay services receive an immutable RelayOperationPlan and cannot reselect during execution.
metrics:
  completed: 2026-10-17
status: complete
---

# Phase 113 Plan 03: Runtime Relay Authorization Summary

Relay operations now plan exact destinations and receive one runtime authorization before local delivery, encryption, signing, or relay I/O.

## Protocol Authority

Checked the complete NAP-RELAY draft at `napplet/naps` PR #2 head
`9f30b3505335a52c574ff570576687d6467021ff` and NIP-5D PR #2303 head
`5560820fa4f37f45b8ab742a11aeb3001b17dc67`. The implementation preserves top-level
`relay`, event sidecars under `result`, and string error/reason fields; it introduces no
Firewall wire envelope.

## Delivered

- Added `RelayOperationPlan` and `RelayPlanningServiceHandler` for pure destination planning followed by approved exact-plan execution.
- Routed subscribe, query, publish, and encrypted publish through the runtime permission coordinator before buffer/cache delivery, encryption, signing, service dispatch, or transport.
- Made reference relay pool and coordinated relay services execute frozen relay URL lists with abort and exact-generation guards.
- Preserved source-owned close cleanup after denial or exhausted approval grants, and retained canonical relay result shapes.

## Evidence

- `949cf7a1` `feat(relay): authorize immutable relay plans`
- `471dfbe0` `refactor(relay): extract planned operation executor`
- `033662ba` `fix(relay): preserve explicit adapter lifecycle`
- Combined relay regression suite: 242 tests passed across runtime, services, shell, Paja, playground, conformance, and revocation coverage.
- `@kehto/runtime` and `@kehto/services` builds and type checks passed.

## Compatibility

`FW-RELAY-SERVICE-LEGACY-001` fails closed and warns once per legacy registered service instance. It directs integrations to `RelayPlanningServiceHandler`; canonical planned services are quiet. Its retention, warning, coverage, and removal prerequisites are tracked in `docs/compatibility.md`.

## Deferred Integration Gate

The aggregate playground TypeScript check is deferred to Plan 113-17. It currently fails in
`apps/playground/src/demo-hooks.ts` because its `ResourceServiceOptions` object still supplies
`isOriginGranted` and has consequential implicit-`any` parameters. This is outside the relay
contract and owned by Plan 113-17; relay-focused tests and package builds/type checks are green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Distinguished unavailable explicit adapters from legacy adapters**
- **Found during:** Plan 19 combined gate.
- **Issue:** An explicit adapter reporting unavailable was treated as a legacy adapter and emitted the wrong closed response.
- **Fix:** Legacy handling now checks only for the absent explicit execution method; the normal unavailable path returns canonical EOSE.
- **Files modified:** `packages/runtime/src/relay-handler.ts`, `packages/runtime/src/dispatch.test.ts`.
- **Commit:** `033662ba`.

## Self-Check: PASSED

All listed source files and commits exist on the phase branch.
