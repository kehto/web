---
phase: 113-service-authorization-boundaries
plan: 11
subsystem: common-and-lists-authorization
tags: [nap-common, nap-lists, firewall, relay, revocation]
dependency_graph:
  requires: [113-02]
  provides: [approved-common-relay-plans, approved-list-transactions]
  affects: [services, paja]
tech_stack:
  added: []
  patterns: [side-effect-free-relay-planning, exact-resource-approval, source-generation-cancellation]
key_files:
  modified:
    - packages/services/src/common-service.ts
    - packages/services/src/lists-service.ts
    - packages/paja/src/browser-common.ts
    - packages/paja/src/browser-lists.ts
    - packages/paja/src/browser-adapter.ts
decisions:
  - COMMON grants local NIP-19 work interface authority only, and grants relay work against a detached actual-destination plan.
  - LISTS validates and snapshots a stable list identity before one approval encloses the whole read-modify-sign-publish operation.
metrics:
  tasks_completed: 2
status: complete
---

# Phase 113 Plan 11: COMMON and LISTS Authorization Boundaries Summary

COMMON and LISTS now plan their actual relay destinations before approval, bind all relay reads and signed publications to that approved plan, and suppress outputs after the source lifetime ends.

## Delivered

- Added COMMON interface, exact target-resource, and complete WebSocket-origin requirements. Local NIP-19 encode/decode receives no network requirement, while Paja profile, follows, follow/unfollow, react, and report execute only with the approved relay list and live signal.
- Added LISTS interface-only approval for discovery plus exact stable list-resource and every relay-origin requirement for mutations. Paja validates list/items and snapshots the relay plan before it reads current state or invokes the signer.
- Added source generation checks around both service boundaries and signal checks before Paja signing and publishing, so revocation and late callbacks cannot publish or reply.
- Preserved canonical domain terminals and retained a once-only legacy host warning for integrations that have not supplied a relay plan.

## Protocol Authority

Checked NAP-COMMON PR #67 at `8cd0eae8550575771bb616a384e2dfbcade31673`, NAP-LISTS PR #68 at `7cf00cdb7bca6bb59dc5ef082e9fe8ac9278fa46`, and NIP-5D PR #2303 at `5560820fa4f37f45b8ab742a11aeb3001b17dc67`. The implementation keeps COMMON `ok/error` terminals and rejects secret NIP-19 values through the existing decoder contract; LISTS keeps its draft domain-owned validation errors.

## Verification

- `pnpm exec vitest run packages/services/src/common-service.test.ts packages/paja/src/browser-common.test.ts packages/services/src/lists-service.test.ts packages/paja/src/browser-lists.test.ts` — 4 files, 34 tests passed.
- `pnpm --filter @kehto/services type-check` and `pnpm --filter @kehto/paja type-check` passed before concurrent WebRTC edits.
- The final services type-check was blocked by concurrent `packages/services/src/webrtc-service.test.ts` narrowing errors, outside this plan's ownership.
- `npx --yes aislop@0.12.0 scan --changes --base origin/main --json .` has no findings in COMMON or LISTS after cleanup; remaining repository findings belong to other concurrent work.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 2 - Critical functionality] Wired approved contexts through Paja's browser adapter.**
   - Service approval signals and immutable relay plans were otherwise discarded before reaching the COMMON and LISTS browser backends.
   - Added the minimal adapter forwarding needed for Paja to execute only approved plans.

## Self-Check: PASSED
