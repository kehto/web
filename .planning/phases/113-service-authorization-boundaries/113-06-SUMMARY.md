---
phase: 113-service-authorization-boundaries
plan: 06
subsystem: serial and BLE authorization
tags: [firewall, serial, ble, paja, lifecycle]
dependency_graph:
  requires: [113-02]
  provides: [source-owned-device-sessions, staged-device-approval]
  affects: [services, paja]
tech_stack:
  added: []
  patterns: [host-private-device-scope, approval-signal-lifecycle, source-owned-session]
key_files:
  modified:
    - packages/services/src/serial-service.ts
    - packages/services/src/ble-service.ts
    - packages/paja/src/browser-device-services.ts
decisions:
  - Browser controllers retain selected device identity in host state and authorize it before physical connection.
  - Device session IDs on the napplet wire are never accepted as authority; source ownership and exact operation scopes are checked by the service.
metrics:
  tasks_completed: 2
status: complete
---

# Phase 113 Plan 06: Serial and BLE Device Authorization Summary

Serial and BLE browser integrations now require staged Firewall approval, retain opaque selected-device scopes in host code, and close hardware state when authority ends.

## Delivered

- Validates serial requests, BLE chooser filters, UUID targets, and byte payloads before approval or browser access.
- Composes interface, chooser, selected-device, and operation-specific requirements for serial writes and BLE GATT service/read/write/notification operations.
- Binds service sessions to their source window; a session ID from another source cannot invoke host hooks.
- Makes Paja call `authorizeDevice` after a chooser returns but before `SerialPort.open()` or GATT `connect()`; device keys never appear on the napplet wire.
- Propagates approval signals through host hooks, physically closes ports/disconnects GATT on revocation, and drops late serial/BLE events.
- Updates services and Paja documentation with the staged-controller contract.

## Protocol Authority

Rechecked before implementation against NAP-SERIAL PR #61 at `0c6e88ab8003f5bf88c8ddee5b5e3cd382ab7e1c`, NAP-BLE PR #62 at `b46b86913c23cd509d2ace14f1de55b0c451e0f9`, and NIP-5D at `5560820fa4f37f45b8ab742a11aeb3001b17dc67`. The wire message names and host-owned opaque-handle rules remain conformant. The additional device scope is host policy; it does not alter the NAP wire.

## Verification

- `pnpm exec vitest run packages/services/src/serial-service.test.ts packages/services/src/ble-service.test.ts packages/paja/src/browser-device-services.test.ts` — 28 tests passed.
- `pnpm --filter @kehto/services build` — passed.
- `pnpm --filter @kehto/paja type-check` — passed.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 2 - Critical functionality] Made generic host hooks fail closed under runtime approvals.**
   - **Found during:** Tasks 1 and 2.
   - **Issue:** A host hook that did not bind the chooser result to a private scope could otherwise establish a browser-backed session after only chooser approval.
   - **Fix:** Runtime-bound services require the hook to call `ctx.authorizeDevice(...)`; legacy hooks retain only the warning-backed no-runtime path.
   - **Files modified:** `packages/services/src/serial-service.ts`, `packages/services/src/ble-service.ts`.

## Known Follow-up

`apps/playground/src/demo-hooks.ts` still supplies simulated legacy device hooks. It needs the same `ctx.authorizeDevice(...)` migration before a runtime-approval-enabled playground release. This is app-owned follow-up work, not a Paja browser-device path.

## Self-Check: PASSED
