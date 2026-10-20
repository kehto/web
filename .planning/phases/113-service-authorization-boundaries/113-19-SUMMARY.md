---
phase: 113-service-authorization-boundaries
plan: "19"
subsystem: relay-host-adapters
tags: [relay, firewall, adapter, shell, paja, playground]
requires: [113-03]
provides: [explicit-target-relay-adapters, host-relay-plan-parity]
affects: [113-17, 113-18]
tech-stack:
  added: []
  patterns: [explicit-target-execution, compatibility-diagnostic]
key-files:
  modified:
    - packages/runtime/src/types.ts
    - packages/shell/src/hooks-adapter.ts
    - packages/paja/src/browser-relay-runtime.ts
    - apps/playground/src/playground-relay-service.ts
decisions:
  - Authorized fallback adapters must execute explicit approved relay URLs instead of using implicit methods.
  - Publish planning may use a dedicated pure write selector while retaining the read-selector fallback for compatible hosts.
metrics:
  completed: 2026-10-17
status: complete
---

# Phase 113 Plan 19: Relay Host Adapter Migration Summary

Runtime fallback, shell, Paja, and playground relay consumers now execute the exact destination snapshot approved by the runtime.

## Protocol Authority

Checked NAP-RELAY PR #2 at `9f30b3505335a52c574ff570576687d6467021ff` and NIP-5D PR #2303 at `5560820fa4f37f45b8ab742a11aeb3001b17dc67`. Explicit relay hints remain top-level `relay` fields and bypass selection without bypassing approval.

## Delivered

- Added explicit `subscribeToRelays(relayUrls, filters, callback)` and `publishToRelays(relayUrls, event)` execution boundaries to the runtime fallback and shell adapter.
- Migrated Paja and playground relay consumers to plan/execute behavior and extended conformance checks across hosts.
- Added a compatible `selectPublishRelayTier()` hook so Paja plans approved publications from write relays while existing hosts retain `selectRelayTier([])` fallback behavior.
- Kept source cancellation, abort propagation, exact-generation checks, and canonical query/publish failure fields across host consumers.

## Evidence

- `79619ca2` `feat(relay): preserve plans in playground relay service`
- `033662ba` `fix(relay): preserve explicit adapter lifecycle`
- Combined relay regression suite: 242 tests passed.
- Runtime, services, shell, and Paja build/type gates passed.
- AI-slop scan reported no errors; its warnings are pre-existing file-size and wrapper findings outside the relay changes.

## Compatibility

`FW-RELAY-ADAPTER-LEGACY-001` warns once when an invoked adapter retains only implicit subscribe/publish behavior, names the explicit replacement, and fails closed before signing, delivery, or I/O. The compatibility register records its source site, tests, retention purpose, migration path, and 0.x removal prerequisites.

## Deferred Integration Gate

`pnpm exec tsc -p apps/playground/tsconfig.json --noEmit` remains deferred to Plan 113-17 because of pre-existing resource-service option drift in `apps/playground/src/demo-hooks.ts:261-263`. The relay combined regression suite and every affected package build/type gate pass; Plan 113-17 owns the remaining playground-wide repair.

The final `pnpm docs:check` rerun is also deferred behind concurrent common-service work: Typedoc reports that `CommonRelayOperation` is referenced from `packages/services/src/common-service.ts` but is not included in generated documentation. Relay package documentation had already passed before that unrelated concurrent edit; the common-service owner must restore the aggregate docs gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Planned Paja publications from its configured write relay set**
- **Found during:** Combined relay gate.
- **Issue:** Generic publish planning used the Paja read selector, so an approved publication could target read relays rather than Paja's configured outbox.
- **Fix:** Added optional pure `selectPublishRelayTier()` selection with existing `selectRelayTier([])` fallback, and wired Paja to its write relays.
- **Files modified:** `packages/services/src/relay-pool-service.ts`, `packages/paja/src/browser-adapter.ts`.
- **Commit:** `033662ba`.

## Self-Check: PASSED

All listed source files and commits exist on the phase branch.
