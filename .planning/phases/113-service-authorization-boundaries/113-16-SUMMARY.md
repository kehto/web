---
phase: 113-service-authorization-boundaries
plan: 16
subsystem: runtime-ingress
tags: [runtime, firewall, approval, rate-limit]
dependency_graph:
  requires: [113-03, 113-04]
  provides: [single-configured-authorization-owner]
  affects: [runtime]
status: complete
---

# Phase 113 Plan 16: Runtime Ingress Summary

Configured runtimes no longer run the legacy temporal Firewall gate after authenticated source, domain, ACL, and interface admission; registered services now own the sole operation authorization boundary.

## Delivered

- Retained source/domain/ACL/interface admission at runtime ingress.
- Bypassed the old temporal gate only when the shared permission coordinator is configured, preventing a second approval authority for service-owned operations.
- Kept the legacy gate for hosts without the permission coordinator, preserving existing standalone firewall-rate behavior while the independent rate matrix is finalized by Plan 04.

## Verification

- `pnpm exec vitest run packages/runtime/src/runtime.test.ts packages/runtime/src/service-dispatch.test.ts packages/runtime/src/service-extension-approvals.test.ts` — 51 tests passed.
- `pnpm exec vitest run packages/runtime/src/firewall-dispatch.test.ts packages/runtime/src/rate-limit.test.ts packages/runtime/src/runtime.test.ts` — 54 tests passed.

## Deferred Integration

Plan 04 OUTBOX/COUNT is concurrent and not yet landed. Re-run the ingress/rate matrix against its finalized service contracts before phase closure.

## Self-Check: PASSED
