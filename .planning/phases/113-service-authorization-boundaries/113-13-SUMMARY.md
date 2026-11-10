---
phase: 113-service-authorization-boundaries
plan: 13
subsystem: intent
tags: [firewall, approval, intent, cancellation]
dependency_graph:
  requires: [113-02]
  provides: [source-bound-intent, abortable-retained-delivery]
  affects: [services, paja, playground]
tech_stack:
  added: []
  patterns: [approval-lifetime, verified-target-dispatch]
key_files:
  modified:
    - packages/services/src/intent-service.ts
    - packages/services/src/catalog-intent-resolver.ts
    - packages/paja/src/browser-intent-controller.ts
    - apps/playground/src/playground-intent-controller.ts
decisions:
  - Approval lifetime is host-private dispatch metadata and never appears in the intent wire delivery.
metrics:
  focused_tests: 13
status: complete
---

# Phase 113 Plan 13: Intent authorization Summary

Intent invocation now authorizes a source-bound action before resolver retention and threads that approval lifetime to Paja and playground target delivery.

## Protocol authority

Checked NAP-INTENT PR #106 at `fc121fc264615482143eda86125863d2e1f741a2` and NIP-5D PR #2303 at `5560820fa4f37f45b8ab742a11aeb3001b17dc67` on 2026-10-17. Canonical intent result and delivery envelopes remain unchanged.

## Verification

- `pnpm exec vitest run packages/services/src/intent-service.test.ts packages/paja/src/browser-intent-controller.test.ts tests/unit/playground-intent-controller.test.ts` — 13 passed

## Decisions

- `AbortSignal` is passed only through host-owned `IntentDispatchParams`, checked before and after readiness, and omitted from `intent.deliver` payloads.

## Self-Check: PASSED

- Task 1 commits: `135db9a0`, `bc35ae6d`.
- Task 2 commit: `fd9e50f0`.
