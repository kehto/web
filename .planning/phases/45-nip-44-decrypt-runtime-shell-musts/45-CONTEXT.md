# Phase 45: NIP-44 Decrypt Runtime + Shell MUSTs - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 4 grey areas presented as batch tables; user accepted all recommended answers.

<domain>
## Phase Boundary

`@kehto/runtime` dispatches `identity.decrypt` and `@kehto/shell` enforces all 4 canonical MUSTs (outer-sig-verify, impersonation-check, outer-`created_at`-hide, class-2-rejection). The auto-detect router classifies events as NIP-04 / NIP-44-direct / NIP-17 gift-wrap and routes to matching paths. A class-1 napplet receives `identity.decrypt.result` with cleartext for all three modes; a class-2 napplet receives `identity.decrypt.error { error: 'class-forbidden' }` BEFORE the signer is invoked.

**In scope (DECRYPT-01..07):** runtime dispatcher, enforce.ts class-gate, identity-service `decrypt` action with `getDecryptor` option, auto-detect router, outer-sig-verify, impersonation check, outer-`created_at` hide, 8-code error union, single-target routing.

**Out of scope (Phase 46):** demo napplet, Layer-A/Layer-B Playwright specs, services package re-exports of decrypt-only factories, class-2 demo variant, end-to-end against built preview.

</domain>

<decisions>
## Implementation Decisions

### Area 1: Decrypt implementation siting

- **Q1 — Handler location:** Extend `packages/services/src/identity-service.ts` with a `decrypt` action branch. Keeps the 10-action identity surface in one file; matches the existing `switch(message.type)` pattern. No new file in Phase 45.
- **Q2 — Bridge timing:** Add `getDecryptor` host bridge option to `createIdentityService` in Phase 45 (not deferred to Phase 46). Avoids an inter-phase refactor of the same surface; Phase 46 only adds the demo, the Layer-A/B specs, and the class-2 negative variant.
- **Q3 — Bridge shape:** Three-method bridge — `getDecryptor(): { nip04Decrypt(senderPub, ciphertext): Promise<string>; nip44Decrypt(senderPub, ciphertext): Promise<string>; unwrapGiftWrap(wrap: NostrEvent): Promise<{ seal: NostrEvent; rumor: Rumor }> } | null`. Mirrors keys/media bridge shape; the host owns key material (not exposed to shell or napplet).
- **Q4 — Playground wiring:** `apps/playground/src/shell-host.ts` provides an in-memory `getDecryptor` implementation backed by `nostr-tools` (`nip04.decrypt`, `nip44.decrypt`, `nip17.unwrapEvent`) using a test-fixture privkey. The `__publishDecryptFixtures__` per-napplet hook (D15 pattern) is deferred to Phase 46. Layer-A specs use a deterministic mock bridge.

### Area 2: Auto-detect router (DECRYPT-07)

- **Q1 — NIP-04:** `event.kind === 4`. Canonical kind for legacy DMs.
- **Q2 — NIP-17 gift-wrap:** `event.kind === 1059`. Canonical gift-wrap kind.
- **Q3 — NIP-44-direct:** `event.kind === 14` OR `(event.kind !== 4 && event.kind !== 1059 && base64-decode(content).first-byte === 0x02)`. Catches both the explicit NIP-17 direct kind and the "encrypted content on arbitrary kind" use case via the NIP-44 v2 version byte.
- **Q4 — Fallthrough:** Unknown kind/shape → `identity.decrypt.error { error: 'unsupported-encryption' }` immediately. Do NOT try-all paths.

### Area 3: Class-2 gate (DECRYPT-06)

- **Q1 — Capability:** New capability string `'identity:decrypt'` added to `ALL_CAPABILITIES` in `packages/acl/src/capabilities.ts`. class-1 allowlist gets it; class-2 allowlist excludes it (mirrors the existing `relay:write` exclusion). Preserves D24's "class enforcement centralized in enforce.ts" intent — the per-class gate stays in `CLASS_CAPABILITY_ALLOWLIST`, no per-action checks in the handler.
- **Q2 — resolveCapabilitiesNub mapping:** `identity.decrypt` → `{ senderCap: 'identity:decrypt', recipientCap: null }` in `identityMap()`. Other identity actions unchanged.
- **Q3 — Error envelope:** Runtime enforce path returns `EnforceResult { reason: 'class-forbidden' }`. Identity-service translates this signal to `identity.decrypt.error { error: 'class-forbidden' }` envelope on the wire. Signer/bridge never invoked.
- **Q4 — Check ordering:** enforce.ts class-gate (1) → identity-service handler entry (2) → outer-sig-verify (3) → auto-detect router (4) → impersonation check on NIP-17 path (5) → bridge invoke (6). Class-2 short-circuits before signature verification — saves verify work AND satisfies "BEFORE signer invocation" success criterion.

### Area 4: Shell MUSTs surface

- **Q1 — Outer-sig-verify call site:** Reuse existing `shellHooks.crypto.verifyEvent` (consumed by relay paths today; `packages/shell/src/hooks-adapter.ts:219`). Inject into identity-service via a new `verifyEvent` option on `IdentityServiceOptions`. On `false` return: `identity.decrypt.error { error: 'malformed-wrap' }`. No new dep in `@kehto/services`.
- **Q2 — Impersonation check site:** Inside identity-service decrypt handler after `unwrapGiftWrap` returns `{ seal, rumor }`. Compare `seal.pubkey === rumor.pubkey`; mismatch → `identity.decrypt.error { error: 'impersonation' }`. Helper extracted to a private `checkImpersonation(seal, rumor): boolean` for unit testability.
- **Q3 — Outer `created_at` hide:** Shape-enforced through the upstream `IdentityDecryptResultMessage` type — the envelope carries `rumor: Rumor` directly; `Rumor` is `UnsignedEvent & { id }` with its own `created_at`. Service handler builds the result envelope from the rumor object only, never copies the outer wrap's `created_at`. Defensive runtime assertion is deferred to Phase 46 E2E-27 (verifies privacy floor end-to-end).
- **Q4 — Single-target routing:** The `send` closure in identity-service is `(resp) => hooks.sendToNapplet(windowId, resp)` — single-`windowId` captured from `handleMessage`'s signature. `getAllWindowIds` is naturally unreferenced. Add an inline comment block in the decrypt handler citing C-06 (v1.7 Phase 42 draft pitfall) so future readers understand why the closure shape is load-bearing.

### Claude's Discretion

- Exact file:line layout of the decrypt branch inside `identity-service.ts` (single switch case vs extracted `handleDecrypt(...)` private function — pick whichever keeps the file under ~400 LOC).
- Test fixture privkey value (any deterministic seed; document the chosen seed in the playground wiring comment).
- Naming of the helper functions (`detectEncryption`, `checkImpersonation`, etc.) — Claude picks names matching existing conventions in the file.
- Whether to add a `verifyEvent` injection to `IdentityServiceOptions` as a required option or default it to a permissive `async () => true` for backward compatibility with the existing 9-action surface (recommend: default to `async () => true` to preserve back-compat; document that decrypt callers MUST override).
- Internal type aliases for `EncryptionMode = 'nip04' | 'nip44-direct' | 'nip17'` — Claude's call whether to export from services or keep private.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`packages/runtime/src/enforce.ts`** — `CLASS_CAPABILITY_ALLOWLIST` is the single class-gate; add `'identity:decrypt'` to class-1's set and (by omission) exclude from class-2's. `EnforceResult.reason: 'class-forbidden'` already exists (v1.7 D7).
- **`packages/acl/src/capabilities.ts`** — `ALL_CAPABILITIES` array (15 entries today). Add `'identity:decrypt'`. Note historical context: v1.1's `sign:nip04`/`sign:nip44` were removed because no napplet-visible signing exists in NIP-5D; the new `identity:decrypt` is the SHELL-internal class gate for the decrypt envelope, not a "napplet signs" surface.
- **`packages/acl/src/resolve.ts:identityMap()`** — extend to map `decrypt → identity:decrypt`. Existing logic already special-cases `getPublicKey`/`getRelays` as `null/null`.
- **`packages/runtime/src/runtime.ts:handleIdentityMessage`** (lines ~720-770) — already delegates to a registered identity service. No changes needed in the dispatcher itself; identity-service does the work. Enforce gate fires upstream of this call.
- **`packages/services/src/identity-service.ts:createIdentityService`** — extend `IdentityServiceOptions` with `getDecryptor?` and `verifyEvent?`. Add `case 'decrypt'` branch in the `switch(message.type)`.
- **`packages/runtime/src/types.ts:Signer`** — existing `nip04`/`nip44` optional fields are not used for decrypt (Signer interface cannot do NIP-17 unwrap; getDecryptor is the right surface).
- **`packages/shell/src/hooks-adapter.ts:219`** — `crypto.verifyEvent` already wired; reuse as the verify source.
- **`@napplet/nub/identity/types`** (upstream v0.3.0) — `IdentityDecryptMessage`, `IdentityDecryptResultMessage`, `IdentityDecryptErrorMessage`, `IdentityDecryptErrorCode` (8-code union). Import directly from upstream.
- **`@napplet/core` Rumor type** — `UnsignedEvent & { id }`; the envelope result field shape.
- **`nostr-tools/nip17`** — `unwrapEvent(wrap, privateKey): UnsignedEvent`. Useful in playground wiring; bridge consumers can ship their own backends (Electron, Tauri, hyprgate).

### Established Patterns

- **Options-as-bridge (D18):** `getDecryptor` follows the v1.4 `HostKeysBridge`/`HostMediaBridge` and v1.7 `getConnectGrants` shape. Required injection at factory construction; throws/no-ops if missing (recommend no-op → `signer-unavailable` error envelope, not factory throw — decrypt is opt-in capability, identity service should still serve the other 9 actions when the host hasn't wired decrypt yet).
- **Class-gate centralization (D24):** capability allowlist in `enforce.ts` is the only class-discriminating site. Identity-service does NOT check class.
- **Synchronous class resolution (D23):** `session.class` is set at iframe creation; enforce-gate reads it inline. No async class resolution in the decrypt path.
- **Single-target routing (C-06 v1.7 prevention):** handler `send` closures capture `windowId` from `handleMessage`. Per-domain proxies follow the same shape (`identity-proxy.ts:emit`).
- **8-action result envelope shape:** each identity action sends `{ type: '${typeBase}.result', id, ...payload }` or `{ type: '${typeBase}.error', id, error }`. Decrypt follows the same shape with `error: IdentityDecryptErrorCode` (typed instead of free string).
- **Test-fixture hooks (D15):** `__publishDecryptFixtures__` per-napplet hook deferred to Phase 46 demo.

### Integration Points

- **Runtime → identity-service:** `runtime.ts:handleIdentityMessage` already routes through `serviceRegistry['identity']`. No new wiring.
- **enforce.ts → identity-service handler:** enforce.ts fires before `handleIdentityMessage` reaches the service; on class-forbidden, the runtime sends the error envelope. We must verify the runtime's existing enforce path emits the right `identity.decrypt.error { error: 'class-forbidden' }` envelope (vs a generic `acl-denied`). Plan must include a small runtime-side patch to translate `EnforceResult.reason === 'class-forbidden'` for identity.decrypt into the typed envelope.
- **identity-service → shell crypto:** new `verifyEvent` option injected at construction; host (`shell-host.ts`) passes `(event) => shellBridge.crypto.verifyEvent(event)`.
- **identity-service → getDecryptor:** new option; host (`shell-host.ts`) provides a `() => DecryptorBridge | null` closure. Bridge holds privkey state (in the playground: a test fixture; in real shells: NIP-07 extension wrapper or backend RPC).
- **Build/test surfaces:**
  - `pnpm build` should add no new turbo tasks (existing 26).
  - `pnpm test:unit` baseline 523/523 must stay green; new unit tests in `identity-service.test.ts` and `enforce.test.ts` (if added) bump the baseline.
  - `pnpm test:e2e` baseline 73/0/0 must stay green; new specs ship in Phase 46.
  - Type-check across all 4 `@kehto/*` packages must pass after the new capability + envelope-type additions.
- **Changesets:** patch bumps for `@kehto/acl` (new capability), `@kehto/runtime` (enforce translation), `@kehto/services` (new options + decrypt action), `@kehto/shell` (potentially the playground if it lives there — verify in plan-phase). One changeset per affected package, prose explains the new surfaces.

</code_context>

<specifics>
## Specific Ideas

- `getDecryptor` returns `null` (not throws) when decrypt is unwired — identity-service emits `identity.decrypt.error { error: 'signer-unavailable' }`. Other identity actions remain serviceable.
- Defensive runtime assertion for outer-`created_at` hide is deferred to Phase 46 E2E-27 (Layer-A spec asserts the rumor result's `created_at` matches the rumor's, not the wrap's). Phase 45 shape-enforces only.
- `__publishDecryptFixtures__` per-napplet hook is Phase 46 demo concern.
- Phase 45 unit tests should cover at minimum: NIP-04 happy path, NIP-44-direct happy path, NIP-17 gift-wrap happy path, all 8 error codes (parameterized), class-2 rejection short-circuit (assert getDecryptor never called), single-target routing (assert send only called with the requesting windowId), outer-sig-verify failure → `malformed-wrap`, impersonation mismatch → `impersonation`.
- The playground `shell-host.ts` wiring uses a deterministic test-fixture privkey (any 32-byte hex constant; document its provenance in a comment). NEVER ship a real key.
- Run `pnpm build && pnpm test:unit && pnpm test:e2e` at phase close to confirm baselines preserved.

</specifics>

<deferred>
## Deferred Ideas

- **Demo napplet (`decrypt-demo` class-1 + class-2 variant)** — Phase 46 DECRYPT-09/10.
- **Layer-A parameterized spec covering all 3 modes + all 8 errors** — Phase 46 E2E-27.
- **Layer-B Playwright spec against built preview** — Phase 46 E2E-28.
- **`getDecryptor` reference handler factory in `@kehto/services` standalone export (e.g. `createDecryptService`)** — not needed; the decrypt action lives inside the existing `createIdentityService`. If a separate factory becomes useful for testability or downstream split, defer to a future milestone.
- **NIP-07 extension `nostr.nip17` interface** — upstream/browser-extension concern; out of scope for kehto.
- **Migrating real Signer.nip04/nip44 consumers to getDecryptor** — no current consumers in kehto (they are interface-only). Defer.
- **Public `DecryptorBridge` interface re-export from `@kehto/services`** — Claude's discretion in Phase 45 plan; recommend yes (host apps need the type) but defer if scope creeps.
- **Runtime defensive assertion that rumor.created_at !== outerEvent.created_at** — deferred to Phase 46 E2E-27 (asserts behavior, not shape).

</deferred>
