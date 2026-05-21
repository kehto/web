---
phase: 45-nip-44-decrypt-runtime-shell-musts
plan: 01
requirements-completed: [DECRYPT-01, DECRYPT-02, DECRYPT-03, DECRYPT-04, DECRYPT-05, DECRYPT-06, DECRYPT-07]
---

# Plan 45-01 Summary

**Phase:** 45 — NIP-44 Decrypt Runtime + Shell MUSTs
**Plan:** 01 — ACL, runtime, service handler, host bridge, and verification
**Requirements:** 7 (DECRYPT-01, DECRYPT-02, DECRYPT-03, DECRYPT-04, DECRYPT-05, DECRYPT-06, DECRYPT-07)

## What shipped

### ACL + runtime class gate (DECRYPT-01, DECRYPT-06)

- Added canonical `identity:decrypt` capability in `@kehto/acl`, exported `CAP_IDENTITY_DECRYPT`, and mapped `identity.decrypt` envelopes to sender capability `identity:decrypt`.
- Added the runtime ACL bit for `identity:decrypt`.
- Updated `enforce.ts` so class-2 napplets continue to receive all class-2-safe capabilities except `relay:write` and `identity:decrypt`.
- Runtime ACL denial now preserves typed decrypt errors:
  - class denial => `identity.decrypt.error` with `error: 'class-forbidden'`
  - policy denial => `identity.decrypt.error` with `error: 'policy-denied'`
- Runtime dispatch tests prove class-2 rejection happens before the registered identity service handler is invoked.

### Identity decrypt reference handler (DECRYPT-02, DECRYPT-03, DECRYPT-04, DECRYPT-05, DECRYPT-07)

- Extended `createIdentityService` with `getDecryptor?: () => HostDecryptBridge | null` and `verifyEvent?: VerifyEvent`.
- Exported `HostDecryptBridge`, `GiftWrapDecryptResult`, and `VerifyEvent` from `@kehto/services`.
- Added `identity.decrypt` handling for:
  - NIP-04 (`kind: 4`)
  - NIP-44 direct (`kind: 14` or base64/base64url content with first decoded byte `0x02`)
  - NIP-17 gift-wrap (`kind: 1059`)
- Outer event verification runs before any decrypt bridge call.
- NIP-17 gift-wrap path performs `seal.pubkey === rumor.pubkey` impersonation check.
- NIP-17 result returns the decrypted rumor only; the outer wrap `created_at` is not surfaced.
- All 8 typed error codes map to `identity.decrypt.error`: `class-forbidden`, `signer-denied`, `signer-unavailable`, `decrypt-failed`, `malformed-wrap`, `impersonation`, `unsupported-encryption`, `policy-denied`.

### Playground host bridge

- Wired the playground identity service with `crypto.verifyEvent` and a deterministic demo-only decrypt bridge.
- The bridge uses the existing `nostr-tools` dependency for NIP-04, NIP-44 direct, and NIP-17 fixture decrypt support.
- Phase 46 demo napplet remains deferred, but the preview host now has the bridge needed for the demo and E2E layer.

### Changesets

- Added 4 minor-bump changesets for `@kehto/acl`, `@kehto/runtime`, `@kehto/services`, and `@kehto/shell`.

## Verifications performed

- Focused unit tests: `pnpm exec vitest run packages/acl/src/resolve.test.ts packages/runtime/src/dispatch.test.ts packages/services/src/identity-service.test.ts` -> 3 files, 159 tests passed.
- Package checks/builds:
  - `pnpm --filter @kehto/acl build` -> passed.
  - `pnpm --filter @kehto/acl type-check` -> passed.
  - `pnpm --filter @kehto/runtime type-check` -> passed after rebuilding `@kehto/acl` generated types.
  - `pnpm --filter @kehto/services type-check` -> passed.
  - `pnpm --filter @kehto/services build` -> passed.
  - `pnpm --filter @kehto/playground build` -> passed.
- Full repo build: `pnpm build` -> 26/26 turbo tasks successful.
- Full repo type-check: `pnpm type-check` -> 11/11 turbo tasks successful.
- Full unit suite: `pnpm test:unit` -> 31 files, 543 tests passed.
- Full e2e suite: `pnpm test:e2e` -> 73 Playwright tests passed.
- Broadcast safety grep: `rg -n "getAllWindowIds|identity\\.decrypt|decrypt" packages/shell/src packages/services/src packages/runtime/src apps/playground/src/shell-host.ts` shows `getAllWindowIds` only in the existing shell broadcast bridge, not in any decrypt response path.

## Anti-actions

- Did NOT add a `decrypt-demo` napplet or Playwright decrypt-demo spec; that remains Phase 46 scope.
- Did NOT add dependencies; playground bridge uses existing `nostr-tools`.
- Did NOT introduce a shell broadcast decrypt path; responses stay on the runtime/service send closure for the requesting window.
- Did NOT replace downstream host decrypt implementations; Phase 45 exports the bridge contract and deterministic playground bridge only.

## Files modified

| File | Action |
|------|--------|
| `packages/acl/src/capabilities.ts` | Added `identity:decrypt` capability and constant |
| `packages/acl/src/index.ts` | Exported `CAP_IDENTITY_DECRYPT` |
| `packages/acl/src/resolve.ts` | Mapped `identity.decrypt` to `identity:decrypt` |
| `packages/acl/src/resolve.test.ts` | Added resolver/capability coverage |
| `packages/runtime/src/acl-state.ts` | Added runtime ACL bit for `identity:decrypt` |
| `packages/runtime/src/enforce.ts` | Excluded `identity:decrypt` from class-2 allowlist |
| `packages/runtime/src/runtime.ts` | Mapped decrypt ACL denial to typed decrypt errors |
| `packages/runtime/src/dispatch.test.ts` | Added class-forbidden and policy-denied decrypt dispatch tests |
| `packages/services/src/identity-service.ts` | Added host bridge types and `identity.decrypt` handler |
| `packages/services/src/index.ts` | Re-exported decrypt bridge types |
| `packages/services/src/identity-service.test.ts` | Added happy-path, error-code, and MUST coverage |
| `apps/playground/src/shell-host.ts` | Injected demo verify/decrypt bridge |
| `.changeset/v1-8-decrypt-{acl,runtime,services,shell}.md` | Added minor-bump changesets |

## Phase 46 handoff

- Existing playground shell host now has deterministic decrypt bridge support.
- Phase 46 should add the `decrypt-demo` napplet, fixture publishing hook, class-2 variant/posture test, and Layer-A/Layer-B e2e coverage.
