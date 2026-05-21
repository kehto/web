# Phase 46: Decrypt Service + Demo Napplet + E2E Coverage - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 3 grey areas presented as batch tables; user accepted all recommended answers.

<domain>
## Phase Boundary

`@kehto/services` exposes the Phase 45 `identity.decrypt` reference handler through `createIdentityService({ getDecryptor })`; the playground gains a 13th demo napplet (`decrypt-demo`) that exercises NIP-04, NIP-44-direct, and NIP-17 gift-wrap decrypt flows; Layer-A and Layer-B Playwright specs lock the runtime/service and built-preview behavior. The class-2 forbidden posture is tested through the existing class test hook rather than by adding a second always-on demo napplet.

**In scope (DECRYPT-08..10, E2E-27..28):** decrypt demo package, host fixture publication hook, deterministic encrypted fixtures, class-2 posture flip, Layer-A parameterized decrypt coverage, Layer-B built-preview coverage, completion artifacts.

**Out of scope:** separate `createDecryptService` wrapper factory, real downstream host decrypt implementations, SDK 0.3 namespace migration, changing the Phase 45 decrypt service contract.

</domain>

<decisions>
## Implementation Decisions

### Demo Napplet Posture + UI Contract

- Use one visible `decrypt-demo` entry in `DEMO_NAPPLETS`, class-1 by default.
- Prove the class-2 path by flipping `decrypt-demo` through the existing test posture hook in Playwright instead of adding a second always-on class-2 napplet.
- Publish deterministic decrypt fixtures through a host hook named `__publishDecryptFixtures__`.
- Use compact per-mode DOM sentinels: `#decrypt-nip04-status`, `#decrypt-nip44-status`, `#decrypt-nip17-status`, and `#decrypt-class2-status`.
- Match existing resource/config demo density: small controls and status rows, no explanatory landing copy.

### Fixture + Coverage Shape

- Generate encrypted fixtures host-side in `apps/playground/src/shell-host.ts`, using the deterministic Phase 45 demo decrypt key and publishing them through `__publishDecryptFixtures__`.
- Decrypted fixture payloads should be structured JSON strings with mode labels and stable IDs so DOM assertions prove the correct mode returned.
- Build NIP-17 fixtures with `nostr-tools/nip17` where possible and assert the returned rumor fields rather than the outer wrap fields.
- Layer-A coverage should parameterize all 8 typed decrypt errors at runtime/service level, plus all 3 happy modes.

### Service Surface + Test Placement

- Do not add a separate `createDecryptService` factory. Treat Phase 45's `createIdentityService({ getDecryptor })` as the reference handler and document the roadmap wording as satisfied by that existing identity service extension.
- Add Layer-A coverage in `tests/e2e/identity-decrypt.spec.ts`, using the existing harness/runtime path and parameterizing across 3 modes plus 8 error codes.
- Add Layer-B coverage in `tests/e2e/decrypt-demo.spec.ts` against built preview `:4174`, asserting class-1 success and class-2 forbidden sentinels.
- Phase 46 is done only when full build, typecheck, unit, and e2e pass; `DEMO_NAPPLETS` count is 13; and the class-2 forbidden path proves no decrypt bridge call through the sentinel/debug path.

### the agent's Discretion

- Exact demo component markup and copy, as long as sentinels are stable and the UI matches existing demo density.
- Exact fixture helper names and test helper factoring.
- Whether Layer-A uses a dedicated harness fixture napplet or the existing test harness primitives, provided it covers runtime/service behavior without full preview UI.
- Exact stable IDs in JSON payloads.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `apps/playground/src/shell-host.ts` owns `DEMO_NAPPLETS`, `CLASS_BY_DTAG`, service construction, message taps, and existing test hooks.
- Phase 45 added `DEMO_DECRYPT_PUBKEY`, a deterministic demo decrypt secret key, `createDemoDecryptBridge()`, and identity-service `getDecryptor` / `verifyEvent` wiring.
- Existing demo napplets under `apps/playground/napplets/*` use compact HTML pages and SDK namespace imports pinned at `@napplet/sdk@^0.2.1`.
- Existing Playwright specs under `tests/e2e` already exercise both preview `:4174` and harness-level flows.
- `tests/e2e/class-invariant.spec.ts` and `apps/playground/src/shell-host.ts` expose the class-posture hook pattern for toggling napplet class.

### Established Patterns

- `DEMO_NAPPLETS` is the single source of truth for demo topology cards, ACL rows, sequence lanes, and concurrent boot.
- New demo napplets add a package directory under `apps/playground/napplets/<slug>` and are rendered dynamically by the playground topology.
- Playwright tests prefer stable DOM sentinels inside iframe documents rather than outer placeholder status cards.
- Host bridge interfaces follow the options-as-bridge pattern from PROJECT.md Decision #18.
- Class enforcement stays centralized in runtime `enforce.ts`; demos and services should not duplicate class checks.

### Integration Points

- `createIdentityService({ getDecryptor })` is the Phase 45 reference decrypt handler and satisfies DECRYPT-08.
- `shell-host.ts` should publish fixtures to the `decrypt-demo` iframe, likely via a test hook and/or host-injected custom event/message path.
- `decrypt-demo` should call `identity.decrypt` for all three fixtures and write compact statuses for Playwright.
- Layer-B Playwright should boot preview, inspect the `decrypt-demo` iframe, publish fixtures, assert all three happy-mode statuses, flip the class to class-2, assert `class-forbidden`, and verify the bridge was not invoked for the forbidden attempt through a deterministic host-side counter/debug signal.
- Verification should preserve the existing broad suite while adding the new decrypt specs.

</code_context>

<specifics>
## Specific Ideas

- Keep `DEMO_NAPPLETS` at 13 entries after adding `decrypt-demo`; do not add an always-on second class-2 demo entry.
- Use JSON payload examples such as `{"mode":"nip04","id":"fixture-nip04"}` for decrypted content.
- Prefer DOM sentinel values that include `ok:` / `error:` prefixes so failures are easy to read in Playwright output.
- Layer-A can reuse Phase 45 service tests conceptually but must exist as an e2e/harness-level artifact for E2E-27 traceability.
- Layer-B should assert the class-2 path returns `class-forbidden` before decrypt bridge invocation; a bridge call counter exposed by the host hook is acceptable evidence.

</specifics>

<deferred>
## Deferred Ideas

- Real NIP-07 / native host decrypt backends for Electron, Tauri, or hyprgate.
- A separate `createDecryptService` wrapper factory.
- Migrating demo napplets from `@napplet/sdk@^0.2.1` namespace imports to `@napplet/sdk@^0.3.0` function exports.
- More elaborate user-facing decrypt demo education or onboarding copy.

</deferred>
