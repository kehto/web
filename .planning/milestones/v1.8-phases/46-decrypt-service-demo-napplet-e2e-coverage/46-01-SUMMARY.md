---
phase: 46-decrypt-service-demo-napplet-e2e-coverage
plan: 01
requirements-completed: [DECRYPT-08, DECRYPT-09, DECRYPT-10, E2E-27, E2E-28]
---

# Plan 46-01 Summary

**Phase:** 46 — Decrypt Service + Demo Napplet + E2E Coverage
**Plan:** 01 — decrypt demo, fixture hooks, Layer-A/Layer-B coverage, and verification
**Requirements:** 5 (DECRYPT-08, DECRYPT-09, DECRYPT-10, E2E-27, E2E-28)

## What shipped

### Service reference surface (DECRYPT-08)

- Kept Phase 45's `createIdentityService({ getDecryptor })` as the reference decrypt handler instead of adding a separate `createDecryptService` wrapper.
- Exported and reused the `HostDecryptBridge` contract for host-provided NIP-04, NIP-44 direct, and NIP-17 gift-wrap decrypt backends.
- Extended the E2E harness to install the identity decrypt service with deterministic decrypt fixtures and bridge-level error controls.

### Playground decrypt demo (DECRYPT-09, DECRYPT-10)

- Added `apps/playground/napplets/decrypt-demo/` as the 13th playground demo napplet.
- Added `decrypt-demo` to `DEMO_NAPPLETS` and `CLASS_BY_DTAG` with class-1/permissive default posture.
- Added deterministic host-side NIP-04, NIP-44-direct, and NIP-17 fixtures generated from the demo decrypt key.
- Exposed `__publishDecryptFixtures__`, `__getDecryptBridgeCallCount__`, and `__resetDecryptBridgeCallCount__` playground test hooks.
- The demo writes stable DOM sentinels for all three happy paths:
  - `#decrypt-nip04-status`
  - `#decrypt-nip44-status`
  - `#decrypt-nip17-status`
- The demo also exposes a class-2 retry control and writes `#decrypt-class2-status` with `error:class-forbidden` when the posture is flipped by the test hook.
- Added `identity:decrypt` persistence/display support in shell ACL storage and playground ACL controls.

### Layer-A runtime/harness coverage (E2E-27)

- Added `tests/e2e/identity-decrypt.spec.ts`.
- Covered all three decrypt modes through the harness/runtime path:
  - NIP-04
  - NIP-44 direct
  - NIP-17 gift-wrap
- Added a negative fanout assertion proving a second loaded napplet receives no `identity.decrypt.result` or `identity.decrypt.error` for the requesting napplet's decrypt call.
- Covered all 8 typed decrypt errors:
  - `class-forbidden`
  - `signer-denied`
  - `signer-unavailable`
  - `decrypt-failed`
  - `malformed-wrap`
  - `impersonation`
  - `unsupported-encryption`
  - `policy-denied`

### Layer-B preview coverage (E2E-28)

- Added `tests/e2e/decrypt-demo.spec.ts`.
- The spec boots the built preview, verifies the demo count grew to 13, publishes deterministic fixtures to `decrypt-demo`, and asserts all three mode sentinels.
- The spec flips `decrypt-demo` to class-2, triggers a decrypt request, asserts `class-forbidden`, and verifies the host decrypt bridge call count did not increase on the forbidden path.

## Verifications performed

- `pnpm install` -> passed; new workspace package linked. Existing peer warnings remain around transitive `@unocss/oxc-*` / `@emnapi` packages.
- `pnpm --filter @kehto/demo-decrypt-demo build` -> passed.
- `pnpm --filter @test/harness build` -> passed.
- `pnpm --filter @kehto/playground build` -> passed.
- Focused Layer-A: `npx playwright test tests/e2e/identity-decrypt.spec.ts --project=chromium` -> 12/12 passed.
- Focused Layer-B: `npx playwright test tests/e2e/decrypt-demo.spec.ts --project=chromium` -> 1/1 passed.
- Full repo build: `pnpm build` -> 27/27 turbo tasks successful.
- Full repo type-check: `pnpm type-check` -> 11/11 turbo tasks successful.
- Full unit suite: `pnpm test:unit` -> 31 files, 543 tests passed.
- Full e2e suite: `pnpm test:e2e` -> 86 Playwright tests passed.

## Anti-actions

- Did NOT add a second always-on class-2 demo napplet; the class-2 path uses the existing posture flip hook.
- Did NOT introduce a `createDecryptService` wrapper; the documented reference remains `createIdentityService({ getDecryptor })`.
- Did NOT add dependencies; fixtures and decrypt paths use existing `nostr-tools` and workspace tooling.
- Did NOT migrate demo napplets to the `@napplet/sdk@0.3.0` function-export API; that remains the v1.9 SDK migration follow-up.

## Files modified

| File | Action |
|------|--------|
| `apps/playground/napplets/decrypt-demo/**` | Added decrypt demo package, Vite config, HTML, and napplet logic |
| `apps/playground/src/shell-host.ts` | Added decrypt demo registration, deterministic fixtures, fixture publishing, and bridge call counting |
| `apps/playground/src/main.ts` | Exposed decrypt fixture/call-count hooks |
| `apps/playground/src/acl-modal.ts` | Added `identity:decrypt` ACL modal surface |
| `apps/playground/src/acl-panel.ts` | Added `identity:decrypt` ACL labels and per-napplet toggle |
| `packages/shell/src/acl-store.ts` | Persisted `identity:decrypt` ACL bit |
| `tests/e2e/harness/harness.ts` | Added identity decrypt service install hook, fixtures, and error controls |
| `tests/e2e/harness/globals.d.ts` | Typed new harness globals |
| `tests/e2e/identity-decrypt.spec.ts` | Added Layer-A decrypt coverage |
| `tests/e2e/decrypt-demo.spec.ts` | Added Layer-B preview coverage |
| `pnpm-lock.yaml` | Linked the new decrypt-demo workspace package |

## Milestone handoff

Phase 46 closes the remaining v1.8 requirements. v1.8 now has all 27 requirements complete, with full build/type-check/unit/E2E proof and the E2E suite closing at 86/0/0.
