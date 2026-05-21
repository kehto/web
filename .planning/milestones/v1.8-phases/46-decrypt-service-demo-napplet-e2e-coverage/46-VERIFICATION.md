---
phase: 46-decrypt-service-demo-napplet-e2e-coverage
verified_at: 2026-05-21
status: passed
score: 5/5
---

# Phase 46 — Decrypt Service + Demo Napplet + E2E Coverage — Verification

## Goal Restatement

Ship the reference `identity.decrypt` service surface through `createIdentityService({ getDecryptor })`, add a class-1 `decrypt-demo` playground napplet, prove the class-2 forbidden path, and lock the contract with Layer-A harness coverage plus Layer-B built-preview coverage.

## Per-Criterion Verdicts (5 REQ-IDs)

### DECRYPT-08: Reference decrypt service handler takes `{ getDecryptor }`

**Verdict:** PASS
**Evidence:** `packages/services/src/identity-service.ts` exposes `createIdentityService({ getDecryptor })` and `HostDecryptBridge`; `tests/e2e/harness/harness.ts` installs that handler with deterministic bridge fixtures for browser-level runtime tests.

### DECRYPT-09: 13th `decrypt-demo` class-1 napplet exercises all modes

**Verdict:** PASS
**Evidence:** `apps/playground/src/shell-host.ts` registers `decrypt-demo` in `DEMO_NAPPLETS`; `apps/playground/napplets/decrypt-demo/src/main.ts` handles published fixtures and writes `#decrypt-nip04-status`, `#decrypt-nip44-status`, and `#decrypt-nip17-status`. `tests/e2e/decrypt-demo.spec.ts` asserts all three sentinels against the built preview.

### DECRYPT-10: Class-2 variant returns `class-forbidden`

**Verdict:** PASS
**Evidence:** `tests/e2e/decrypt-demo.spec.ts` flips the loaded `decrypt-demo` to class-2 with `__setNappletClass__`, triggers a decrypt request, asserts `#decrypt-class2-status` is `error:class-forbidden`, and verifies the bridge call count does not increase.

### E2E-27: Layer-A covers modes and error codes

**Verdict:** PASS
**Evidence:** `tests/e2e/identity-decrypt.spec.ts` covers NIP-04, NIP-44 direct, NIP-17 gift-wrap, all 8 typed decrypt errors, and a negative fanout assertion proving an observer napplet receives no decrypt response for another napplet's request. Focused run: 12/12 passed.

### E2E-28: Layer-B walks preview happy and forbidden paths

**Verdict:** PASS
**Evidence:** `tests/e2e/decrypt-demo.spec.ts` boots the built preview, verifies 13 demo napplets, publishes fixtures, asserts all happy-path sentinels, then asserts the class-2 forbidden sentinel. Focused run: 1/1 passed.

## Iteration loop spot-check

- `pnpm install` -> passed; workspace linked.
- `pnpm --filter @kehto/demo-decrypt-demo build` -> passed.
- `pnpm --filter @test/harness build` -> passed.
- `pnpm --filter @kehto/playground build` -> passed.
- `npx playwright test tests/e2e/identity-decrypt.spec.ts --project=chromium` -> 12/12 passed.
- `npx playwright test tests/e2e/decrypt-demo.spec.ts --project=chromium` -> 1/1 passed.
- `pnpm build` -> 27/27 turbo tasks successful.
- `pnpm type-check` -> 11/11 turbo tasks successful.
- `pnpm test:unit` -> 31/31 files, 543/543 tests passed.
- `pnpm test:e2e` -> 86/86 Playwright tests passed.

## Anti-pattern check

- **Scope discipline:** No separate `createDecryptService` wrapper was added; the Phase 45 identity service extension remains the reference surface.
- **Class gate proof:** The class-2 preview path proves the decrypt bridge is not invoked after the class posture flip.
- **Demo count stability:** v1.8 closes with one new visible demo napplet, moving `DEMO_NAPPLETS` from 12 to 13 without adding a duplicate class-2 entry.
- **No dependency expansion:** The phase uses existing workspace tooling and existing `nostr-tools`.

## Final Verdict

**VERIFICATION PASSED** (5/5). Phase 46 ready to close. All 27/27 v1.8 requirements are complete. The full E2E suite closes at 86/0/0.
