---
phase: 113-service-authorization-boundaries
plan: 12
subsystem: services-identity-keys
tags: [firewall, approvals, identity, keys]
dependency_graph:
  requires: [113-02]
  provides: [attested-identity-reads, source-owned-key-bindings]
  affects: [services, paja]
tech_stack:
  added: []
  patterns: [runtime-attested-signer, source-generation, exact-resource-approval]
key_files:
  modified:
    - packages/services/src/identity-service.ts
    - packages/services/src/keys-service.ts
    - packages/services/src/identity-service.test.ts
    - packages/services/src/keys-service.test.ts
decisions:
  - Identity reads use the runtime-owned signer captured inside approval and suppress output if its source changes.
  - NAP-KEYS has no current upstream owner document; Kehto preserves its existing wire format and treats action/chord binding as host-private resources.
metrics:
  focused_tests: 119
status: complete
---

# Phase 113 Plan 12: Identity and keys authorization Summary

Identity reads now run through operation approval with an attested signer snapshot, while key registrations are exact, source-owned host resources that revocation removes.

## Delivered

- Applied interface and account-resource authorization to identity operations without inventing relay/network scopes for local reads.
- Captured the runtime-owned signer inside the approved identity operation and blocked result delivery when the signer or source generation changes.
- Validated key action IDs and normalized chords before prompting; approved registrations against exact action and chord resources.
- Bound document and host-bridge registrations to source generations, removed owned bindings on revocation, and retained unregister outside approval/rate gates.

## Protocol authority

Checked `napplet/naps` master `naps/NAP-IDENTITY.md` at `e897ba0e09bf0a85d9d045ba1211714389372409` on 2026-10-17. The implementation preserves its read-only identity result envelopes. The current upstream `naps` tree has no `NAP-KEYS.md`; this is a bounded host-policy decision only, retaining existing KEYS wire fields and applying no protocol extension.

## Verification

- `pnpm exec vitest run packages/services/src/identity-service.test.ts packages/services/src/keys-service.test.ts packages/services/src/keys-ownership.test.ts packages/paja/src/browser-host-signer.test.ts` — 119 passed
- `pnpm --filter @kehto/services type-check` is blocked by concurrent `webrtc-service.test.ts` type errors on `WebrtcScope.pubkey`.
- `pnpm --filter @kehto/paja type-check` is blocked because the concurrently modified services package has stale `dist` declarations; the focused Paja signer test passes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Invalid key actions and chords are rejected before authorization**
- **Found during:** Task 2
- **Fix:** Validate action ID and normalize the chord before constructing approval requirements.
- **Files modified:** `packages/services/src/keys-service.ts`

## Self-Check: PASSED

- RED regressions are committed in `11f503ea`.
- Implementation is committed in `15d5f4af`.
