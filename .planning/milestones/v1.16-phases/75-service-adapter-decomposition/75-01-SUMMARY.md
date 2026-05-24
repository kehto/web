# Phase 75 Plan 01 Summary: Service and Adapter Decomposition

**Completed:** 2026-05-24
**Status:** Complete

## Result

Phase 75 removed all remaining `aislop` structural long-function warnings. The local scanner now reports a clean run.

## Changes

- Split `apps/playground/src/acl-modal.ts` so `openPolicyModal()` delegates row snapshotting, modal layout, services controls, table rows, legend, and close wiring to private helpers.
- Simplified `apps/playground/src/nip46-client.ts` by deleting the dead duplicate request helper and moving NIP-46 client state, request sending, relay message handling, websocket setup, connection flow, and signer adapter creation into private helpers.
- Split `packages/services/src/media-service.ts` so the public factory creates the descriptor, bridge, state, and handler, while private helpers own session registry mutation and per-message behavior.
- Split `packages/services/src/notification-service.ts` into private store operations and protocol handlers for `notify.*` and legacy `notifications:*` IFC envelopes.
- Split `packages/services/src/resource-service.ts` into construction validation, request tracking, bytes handling, cancel, and teardown helpers.
- Split `packages/shell/src/hooks-adapter.ts` into private builder helpers for each `RuntimeAdapter` facet while preserving `adaptHooks()` as the public composition function.

## Scanner Outcome

`npx --no-install aislop scan -d` now reports:

- Clean run
- `100 / 100 Healthy`
- 0 errors
- 0 warnings
- 0 fixable
- Formatting, Linting, Code Quality, AI Slop, and Security all clean

## Requirements Closed

- PLAY-05: `openPolicyModal` no longer triggers `complexity/function-too-long`.
- PLAY-06: `createNip46Client` no longer triggers `complexity/function-too-long`.
- SVC-01: `createMediaService` no longer triggers `complexity/function-too-long`.
- SVC-02: `createNotificationService` no longer triggers `complexity/function-too-long`.
- SVC-03: `createResourceService` no longer triggers `complexity/function-too-long`.
- ADAPT-01: `adaptHooks` no longer triggers `complexity/function-too-long`.

## Verification

- `pnpm type-check`
- `pnpm test:unit packages/services/src/media-service.test.ts packages/services/src/notification-service.test.ts packages/services/src/resource-service.test.ts tests/unit/nip46-client.test.ts packages/shell/src/shell-bridge.test.ts`
- `pnpm test:build`
- `npx playwright test tests/e2e/shell-ui-state-surfaces.spec.ts --grep "ACL Capability Matrix"`
- `npx --no-install aislop scan -d`
- `git diff --check`

