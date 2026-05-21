---
phase: 45-nip-44-decrypt-runtime-shell-musts
verified_at: 2026-05-21
status: passed
score: 7/7
---

# Phase 45 — NIP-44 Decrypt Runtime + Shell MUSTs — Verification

## Goal Restatement

Add the canonical `identity.decrypt` runtime path, enforce the class-1-only decrypt gate before signer/decryptor invocation, verify outer events before decrypting, enforce NIP-17 impersonation safety, hide outer gift-wrap timestamps, map all typed decrypt errors, and auto-detect NIP-04 / NIP-44-direct / NIP-17 inputs.

## Per-Criterion Verdicts (7 REQ-IDs)

### DECRYPT-01: Runtime identity dispatcher handles `identity.decrypt`
**Verdict:** PASS
**Evidence:** `packages/acl/src/resolve.ts` maps `identity.decrypt` to `identity:decrypt`; `packages/runtime/src/runtime.ts` emits `identity.decrypt.error` for ACL denial cases; `packages/services/src/identity-service.ts` handles the service branch and returns `identity.decrypt.result` / `identity.decrypt.error` with correlated `id`.

### DECRYPT-02: Outer signature verified before decrypt
**Verdict:** PASS
**Evidence:** `handleIdentityDecrypt` calls `verifyEvent` before `getDecryptor`; `identity-service.test.ts` verifies a failed signature returns `malformed-wrap` and never invokes the bridge.

### DECRYPT-03: NIP-17 impersonation check
**Verdict:** PASS
**Evidence:** NIP-17 path checks `unwrapped.seal.pubkey !== unwrapped.rumor.pubkey` and returns `impersonation`; test coverage asserts the mismatch error.

### DECRYPT-04: Outer `created_at` hidden from rumor result
**Verdict:** PASS
**Evidence:** NIP-17 result returns `unwrapped.rumor` rather than the outer gift-wrap event. Tests assert rumor `created_at` is preserved and the outer value is absent from the response.

### DECRYPT-05: 8-code error union maps cleanly
**Verdict:** PASS
**Evidence:** Runtime maps class/policy denials to typed decrypt errors; service normalizes all bridge-thrown typed codes and unknown bridge failures to `decrypt-failed`. Parameterized service tests cover all 8 typed codes.

### DECRYPT-06: Class-2 `identity.decrypt` denied before signer/decryptor
**Verdict:** PASS
**Evidence:** `enforce.ts` excludes `identity:decrypt` from class-2; runtime dispatch test registers an identity handler spy and proves it is not called while the napplet receives `class-forbidden`.

### DECRYPT-07: Auto-detect router
**Verdict:** PASS
**Evidence:** Service handler routes kind `4` to NIP-04, kind `1059` to NIP-17, kind `14` and version-byte `0x02` content to NIP-44 direct, and returns `unsupported-encryption` for unknown encrypted shapes. Tests cover each path.

## Iteration loop spot-check

- `pnpm exec vitest run packages/acl/src/resolve.test.ts packages/runtime/src/dispatch.test.ts packages/services/src/identity-service.test.ts` -> 159/159 passed.
- `pnpm build` -> 26/26 turbo tasks successful.
- `pnpm type-check` -> 11/11 turbo tasks successful.
- `pnpm test:unit` -> 31/31 files, 543/543 tests passed.
- `pnpm test:e2e` -> 73/73 Playwright tests passed.
- `rg -n "getAllWindowIds|identity\\.decrypt|decrypt" packages/shell/src packages/services/src packages/runtime/src apps/playground/src/shell-host.ts` -> `getAllWindowIds` appears only in the existing shell broadcast helper, not in the decrypt response path.

## Anti-pattern check

- **No new dependency:** playground bridge uses existing `nostr-tools`.
- **Class gate stays centralized:** class-2 decrypt rejection is enforced in `enforce.ts` / runtime ACL, not duplicated in the service.
- **Single-target routing:** no decrypt path uses `originRegistry.getAllWindowIds()`.
- **Phase discipline:** demo napplet and Playwright decrypt-demo coverage stay in Phase 46.

## Final Verdict

**VERIFICATION PASSED** (7/7). Phase 45 ready to close. 22/27 v1.8 requirements complete. Phase 46 (Decrypt Service + Demo Napplet + E2E Coverage) is next.
