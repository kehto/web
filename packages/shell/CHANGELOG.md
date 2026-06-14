# @kehto/shell

## 0.8.0

### Minor Changes

- fix!: remove the identity:decrypt capability (spec violation)

  **BREAKING.** Removes the `identity:decrypt` capability and the
  `identity.decrypt` service surface. This capability was added in v1.8 framed as
  "upstream alignment" but has **no backing NAP** — canonical NAP-IDENTITY
  explicitly states napplets "cannot sign events, encrypt, or decrypt" (encryption
  is delegated to the shell via `relay.publishEncrypted`), and `@napplet/nap`
  exposes no decrypt. Decryption belongs to the runtime, inline over the wire (via
  the `Signer` NIP-04/44 primitives), never to napplets. The `decrypt-demo` napplet
  was already removed for breaking the NAP-IDENTITY contract; this removes the
  orphaned shell-side surface and restores conformance.

  - `@kehto/acl`: removes the `identity:decrypt` capability string,
    `CAP_IDENTITY_DECRYPT`, and the `identity.decrypt` capability resolution
    (identity is now strictly read-only).
  - `@kehto/runtime`: removes the `identity.decrypt` enforce special-case and the
    `class-2` exclusion entry; retires the `1<<16` ACL bit as a permanent gap (not
    renumbered, so persisted grants stay valid).
  - `@kehto/services`: removes the `identity.decrypt` handler and the
    `HostDecryptBridge` / `GiftWrapDecryptResult` / `Rumor` / `IdentityDecrypt*` /
    `VerifyEvent` exports and the `getDecryptor` / `verifyEvent` options from
    `createIdentityService`. The 9 read-only identity queries are unchanged, as is
    the runtime-internal `Signer` NIP-04/44 crypto.
  - `@kehto/shell`: retires the `identity:decrypt` bitfield entry (gap preserved).

### Patch Changes

- Updated dependencies
  - @kehto/acl@0.8.0
  - @kehto/runtime@0.8.0

## 0.7.0

### Minor Changes

- 0e1f4c3: feat: implement NAP-UPLOAD shell-mediated file/blob upload

  Adds shell-side support for NAP-UPLOAD: a napplet hands the shell raw bytes plus
  upload intent; the shell selects a storage backend, signs the rail's
  authorization, performs the HTTP upload, and returns a stable URL plus NIP-94
  integrity metadata. The interface is deliberately abstract over the backend — the
  runtime decides _how_ it uploads (NIP-96, Blossom, …). Napplets never receive
  signing keys, server credentials, or direct network access.

  - `@kehto/acl`: new `upload:write` capability and `upload.*` capability
    resolution (napplet requests → sender gate; shell→napplet result/status pushes
    → recipient gate). No NAP-CLASS restriction — upload is bytes over
    postMessage with the shell as the policy boundary; any guardrails are
    runtime/shell policy behind the Uploader seam, not a class contract.
  - `@kehto/runtime`: routes the `upload` domain to a registered `upload` service
    with ACL enforcement, and registers the `upload:write` ACL-state bit.
  - `@kehto/services`: `createUploadService` (pure `upload.*` envelope router that
    owns the per-napplet uploadId, tracks status for `upload.status` queries, and
    streams `upload.status.changed` progress) and `createHttpUploader` (concrete
    reference backend implementing the NIP-96 (NIP-98 auth) and Blossom (kind
    24242 auth) rails over an injected `signEvent` + `fetch`).
  - `@kehto/shell`: advertises `upload` via `shell.supports("upload")` when an
    upload backend (`ShellAdapter.upload`) is wired.

### Patch Changes

- Updated dependencies [0e1f4c3]
  - @kehto/acl@0.7.0
  - @kehto/runtime@0.7.0

## 0.6.0

### Minor Changes

- 3ed7d04: feat: implement NAP-OUTBOX outbox-aware relay routing

  Adds shell-side support for NAP-OUTBOX, which centralizes the outbox-model relay
  logic (NIP-65 discovery, write/read relay selection, fallback, deduplication,
  signature validation, and publish fanout) in the runtime so napplets no longer
  reimplement it. This complements — and does not deprecate — NAP-RELAY.

  - `@kehto/acl`: new `outbox:read` / `outbox:write` capabilities and `outbox.*`
    capability resolution; `class-2` excludes `outbox:write` (mirrors `relay:write`).
  - `@kehto/runtime`: routes the `outbox` domain to a registered `outbox` service
    with ACL enforcement (`outbox.query/subscribe/close/resolveRelays` → read,
    `outbox.publish` → write).
  - `@kehto/services`: `createOutboxService` (pure `outbox.*` envelope router) and
    `createRelayPoolOutboxRouter` (concrete outbox-model router: per-relay fanout,
    dedup with relay attribution, signature validation, and signed publish fanout
    to author write relays plus recipient inbox relays).
  - `@kehto/shell`: advertises `outbox` via `shell.supports("outbox")` when a relay
    pool is wired.

### Patch Changes

- Updated dependencies [3ed7d04]
  - @kehto/acl@0.6.0
  - @kehto/runtime@0.6.0

## 0.5.0

### Minor Changes

- 4e0c4db: Add NAP-CVM (ContextVM bridge): napplets can call ContextVM / MCP-over-Nostr
  servers through the shell.

  - `@kehto/acl`: new `cvm:call` capability and `cvm` domain resolution.
  - `@kehto/services`: `createCvmService` (pure NIP-5D envelope router over an
    injected `CvmTransport`) plus `createNostrCvmTransport` — a concrete
    ContextVM transport (CEP-4 gift-wrapped kind-25910, kind-11316/11317
    discovery, JSON-RPC id correlation) shipped on the nostr-isolated subpath
    `@kehto/services/cvm-nostr-transport`.
  - `@kehto/runtime`: routes the `cvm` domain to the registered CVM service.
  - `@kehto/shell`: advertises `cvm` so `shell.supports("cvm")` is true.

### Patch Changes

- Updated dependencies [4e0c4db]
  - @kehto/acl@0.5.0
  - @kehto/runtime@0.5.0

## 0.4.0

### Minor Changes

- Release the published NAP-MEDIA and NAP-IDENTITY alignment against `@napplet/nub@0.5.0`.

  The runtime package set now consumes the published NAP helper graph, carries owner-aware media session create/result shapes, validates shell-owned media source requests before returning the current unsupported-owner response, and exposes the identity snapshot-plus-`identity.changed` flow without requiring napplet polling.

### Patch Changes

- Updated dependencies
  - @kehto/acl@0.4.0
  - @kehto/runtime@0.4.0

## 0.3.1

### Patch Changes

- Align published package peers and source imports with `@napplet/nub@0.5.0`, the June 12 NAP helper release that carries the NAP-MEDIA and NAP-IDENTITY changes.
- Updated dependencies
  - @kehto/acl@0.3.1
  - @kehto/runtime@0.3.1

## 0.3.0

### Minor Changes

- 4c3a3eb: Breaking: `ShellAdapter.onNip5dIframeCreate` return type now includes a required `class: NappletClass` field.

  The hook is the canonical synchronous class-posture resolution point for NUB-CLASS (CLASS-01 / Phase 38). Host apps implementing this hook MUST update their return shape to include `class` (value may be `null` for the permissive default). The full new shape is:

      { dTag: string; aggregateHash: string; class: NappletClass } | null

  where `NappletClass = string | null`.

  This is a minor bump (not patch) because the public hook contract expanded in a backwards-incompatible way — host apps must update. The change is coordinated in parallel with downstream consumers (hyprgate primary); no dedicated coordination phase is required.

  See `packages/shell/src/types/provisional-class.ts` for the `NappletClass` type. Class tokens (`'class-1'`, `'class-2'`, etc.) are NUB-defined; kehto does not prescribe a taxonomy.

  The resolved class flows through `SessionEntry.class` and is carried inline in the `shell.init` envelope (NO async `class.assigned` envelope — synchronous resolution is the C-01 pre-assignment race fix).

- 6b01607: NUB-CONNECT (v1.7 Phase 39): new `connectStore` singleton and `ShellBridge.connectStore` public surface.

  The store persists per-napplet connect grants keyed on `(dTag, aggregateHash)` under localStorage key `napplet:connect`. Surface: `grant`, `revoke`, `check`, `getOrigins`, `getAllGrants`, `persist`, `load`, `clear`.

  The composite key enforces CONNECT-06: a napplet rebuild with a new aggregate hash cannot inherit prior grants silently — the new hash has no entry, `check()` returns `false`.

  Additionally exports `ConnectGrant`, `ConnectGrantKey`, `ConnectConsentRequest`, and `ConsentResult` types from `./types/provisional-connect.ts` (provisional — swap to `@napplet/nub/connect` when upstream publishes at `^0.3.0`).

  Minor bump: additive public API. No breaking changes.

- **Fix #14** — `handleStorageNub` now returns storage errors as the canonical `storage.<action>.result` envelope with an `error` field, instead of a non-canonical `storage.<action>.error` type. The `@napplet/nub/storage` protocol defines no `*.error` message, so conformant shims silently dropped the old envelope and napplets hung until their request timeout. Clean break: the `storage.*.error` envelope is removed entirely (no backwards-compat).

  **Fix #15** — NIP-5D source-identity napplets are now registered into `runtime.sessionRegistry` during the `shell.ready` handshake. Previously `originRegistry` identity was never bridged into the runtime registry, so `getEntryByWindowId` always returned `undefined` and every storage (and other `sessionRegistry`-keyed) operation failed with `not registered`. The `shell.ready` handler resolves identity from the `onNip5dIframeCreate` hook (preferred) or `originRegistry.getIdentity` (fallback) and registers a source-identity `SessionEntry` (`provenance: 'nip-5d'`, `pubkey: ''`); it skips registration cleanly when neither source yields identity.

- 55cb07f: **RENAME-HARD-01/02 (v1.10 Phase 50)** — remove the v1.8 soft-rename compatibility branch from `ShellBridge.injectEvent()`.

  `bridge.injectEvent('identity:changed', payload)` now forwards exactly one `identity:changed` event. The deprecated `auth:identity-changed` topic no longer fans out to the canonical topic; if callers still pass it, the bridge forwards that literal topic once like any other custom event topic.

  Host integrations should emit and subscribe to `identity:changed`. The compatibility window announced in the v1.8 changeset is closed in v1.10.

- 93224cd: Consolidate NUB peer dependencies from 8 split `@napplet/nub-{identity,ifc,keys,media,notify,relay,storage,theme}@^0.2.1` packages onto the single `@napplet/nub@^0.2.1` package. All in-repo imports now read from the `@napplet/nub/<domain>/types` subpath (type-only consumers) or the root `@napplet/nub/<domain>` subpath.

  Addresses kehto#4 (hyprgate v2.0 Kehto Migration gap analysis). Eliminates the dual-instance pitfall where downstream shells consuming both the split-package and consolidated NUB shapes ended up with two copies of every NUB module on disk.

  Downstream consumers note: `@napplet/nub@0.2.1` was published with an unresolved `workspace:*` specifier for its `@napplet/core` dependency. Until upstream re-publishes, workspace consumers should add the following `pnpm.overrides` entry at their workspace root to pin the transitive resolution:

  ```json
  "pnpm": {
    "overrides": {
      "@napplet/nub>@napplet/core": "^0.2.1"
    }
  }
  ```

  Public peer-dep surface changed — minor bump (not patch).

  REQ-IDs: DEP-01, DEP-02, DEP-03, DEP-04, DEP-05.

- 8890904: Phase 45/46 (DECRYPT-02/07/09/10 + E2E-28 / v1.8): playground shell host wires the identity service with event verification and a deterministic demo decrypt bridge, exposes fixture/call-count hooks for the decrypt demo, and persists/displays the `identity:decrypt` ACL capability. The bridge is fixture-only; downstream shells should inject their own key or backend implementation.
- b7032ab: Phase 44 (DEP-01..06 / v1.8): bump `@napplet/core` and `@napplet/nub` peer deps `^0.2.1` → `^0.3.0`. Internal file paths renamed: `packages/shell/src/types/provisional-{class,connect,resource}.ts` → `internal-{class,connect,resource}.ts`. Per PROJECT.md Decisions #31 + #32, the three files are kehto-internal shell-side models, not staging-ground duplicates of upstream `@napplet/nub/{class,connect,resource}` — upstream's surfaces describe napplet-side accessor types (class/connect) or diverging wire shapes (resource: different field names + 5- vs 8-code error vocabularies). Public re-exports from `packages/shell/src/index.ts` keep the same names + shapes; no consumer break.
- 597dbdb: **RENAME-01 (v1.8 Phase 42)** — `SessionEntry.identitySource: 'auth' | 'source'` is renamed to `SessionEntry.provenance: 'nip-5d' | 'legacy-auth'` across both `@kehto/shell` and `@kehto/runtime`. The new field name and variant values name the actual provenance (canonical NIP-5D origin registration vs legacy AUTH handshake) instead of the obsolete `'auth'`/`'source'` shorthand.

  **Migration:** Downstream consumers reading `entry.identitySource === 'source'` must rewrite to `entry.provenance === 'nip-5d'`. Consumers reading `entry.identitySource === 'auth'` must rewrite to `entry.provenance === 'legacy-auth'`. The old field is hard-removed; no compatibility shim ships.

  RENAME-02 (the `'auth:identity-changed'` topic rename in this same milestone) ships as a soft-rename with dual-emit — see its changeset for that migration window.

  Pre-1.0 minor bump is breaking per kehto's convention. The v1.6 carryover note flagged this rename as low-risk because the field is internal-leaning and the test surface is the primary live producer in this repo. Additional consumers updated in the same pass: `apps/playground/src/shell-host.ts` and `tests/e2e/harness/harness.ts`.

- e3cc899: **RENAME-02 (v1.8 Phase 42)** — the shell-bridge `bridge.injectEvent` topic `'auth:identity-changed'` is renamed to `'identity:changed'` (matches NIP-5D `identity` NUB domain naming).

  **Soft-rename window.** For the v1.8 release, both `'auth:identity-changed'` and `'identity:changed'` trigger dual-emit so subscribers of either topic continue to receive events. Callers may pass either topic name — the wrapper always emits OLD first, then NEW, regardless of which input topic was supplied. Hard-removal of the legacy `'auth:identity-changed'` topic is scheduled for v1.9.

  **Migration.** Subscribers (host shells subscribing to shell-injected `ifc.event` topics) should migrate to `'identity:changed'` before v1.9. After v1.9 the dual-emit branch is removed and `bridge.injectEvent('auth:identity-changed', …)` will forward the literal string — at which point any remaining subscribers of the old topic will silently stop receiving events. See PROJECT.md Known Tech Debt entry; the v1.9 deletion sweep can locate the branch by grepping for `remove this branch in v1.9` in `packages/shell/src/shell-bridge.ts`.

### Patch Changes

- 239fa70: Add NUB-RESOURCE reference service (10th NUB domain, v1.7 Phase 40).

  - `@kehto/services`: `createResourceService({ fetch, isOriginGranted, getConnectGrants, resolveIdentity })` factory. All four options required from day one — factory throws on construction if any is missing (H-03 prevention). Implements canonical 4-message protocol: `resource.bytes`, `resource.cancel` inbound; `resource.bytes.result`, `resource.bytes.error` outbound. Cancel correlates to in-flight requests via requestId.
  - `@kehto/acl`: new `'resource:fetch'` capability; `resolveCapabilitiesNub` extended with `resource.*` mapping (asymmetric: napplet requests get sender gate; shell pushes get recipient gate). `acl-state.ts` CAP_MAP extended with bit 15 for `resource:fetch`.
  - `@kehto/runtime`: `handleResourceMessage` dispatch + `nubDispatch.registerNub('resource', ...)` wiring (Phase 39 Dev 1 lesson: missing registerNub silently drops all envelopes).
  - `@kehto/shell`: `CANONICAL_NUB_DOMAINS` extended with `config` and `resource`; provisional-resource wire types re-exported via barrel.

  No breaking changes. See docs/policies/SHELL-RESOURCE-POLICY.md (Phase 40 Plan 40-03) for host-fetch policy surface (redirects, MIME sniffing, private-IP blocking — host-app concerns).

- d885328: v1.16 structural cleanup and anti-slop pass.

  This release removes the remaining local `aislop` structural warnings through behavior-preserving refactors and comment/import cleanup. The affected public packages keep their existing runtime contracts; the bump is patch-level because the changes are internal decomposition, code-quality cleanup, and packaging hygiene rather than new public API.

  Highlights:

  - Runtime relay, identity, IFC, and fallback domain handling were split into focused helpers.
  - Shell and playground-facing helpers were decomposed without changing public package exports.
  - Service factories and adapter builders were split into smaller private helpers.
  - Public package source now passes the local `aislop` gate with the existing scanner thresholds.

- Updated dependencies [d4e733e]
- Updated dependencies
- Updated dependencies [239fa70]
- Updated dependencies [d885328]
- Updated dependencies [93224cd]
- Updated dependencies [93224cd]
- Updated dependencies [8890904]
- Updated dependencies [8890904]
- Updated dependencies [b7032ab]
- Updated dependencies [b7032ab]
- Updated dependencies [597dbdb]
  - @kehto/acl@0.3.0
  - @kehto/runtime@0.3.0

## 0.2.0

### Minor Changes

- 226cdca: Canonical NIP-5D shell posture. `window.nostr` injection is removed — napplet iframes no longer see a host-provided `window.nostr` at any lifecycle point. `shell.supports()` now uses the `perm:<permission>` namespace for sandbox permissions (e.g., `shell.supports('perm:popups')`); bare names continue to resolve NUB capabilities. Signing and NIP-44 encryption are shell-mediated exclusively via `relay.publish` / `relay.publishEncrypted` — napplets never receive raw signing keys or plaintext of encrypted payloads. New per-domain proxies (identity, keys, media, notify, storage) are available as optional composition seams for host-app interception. `keys-forwarder` module published for host-app DOM-event bridging. `ShellBridge.publishTheme()` added as a first-class broadcast API so host apps can push theme changes to every registered napplet.

  **Breaking changes:**

  - `window.nostr` injection REMOVED (reverses v1.1 SH-I02). Napplets relying on `window.nostr` must migrate to `nostr.publish(...)` / `nostr.publishEncrypted(...)` via the shell bridge.
  - `shell.supports('<permission>')` renamed to `shell.supports('perm:<permission>')` for sandbox-permission checks.
  - Signer-side shell exports removed (no `signEvent` / `nip04` / `nip44` surface).

  **Peer deps:**

  - @napplet/core bumped from >=0.1.0 to ^0.2.0
  - Added @napplet/nub-identity, @napplet/nub-ifc, @napplet/nub-keys, @napplet/nub-media, @napplet/nub-notify, @napplet/nub-relay, @napplet/nub-storage, @napplet/nub-theme (all ^0.2.0)

### Patch Changes

- 41b12b9: v1.3 additive + bug-fix rollup — no protocol changes to `@kehto/shell`:

  - **publishTheme fan-out.** `originRegistry.getAllWindowIds()` is now the canonical enumeration for the `publishTheme()` broadcast so every loaded napplet (not only pubkey-bound sessions) receives `theme.changed` push events (Phase 20 fix).
  - **PendingUpdate type re-export.** `PendingUpdate` is now exported from the `@kehto/shell` package index, resolving a typedoc documentation-surface warning and providing host-app integrators a public type import path for `sessionRegistry.getPendingUpdate()` (Phase 22 Plan 22-02).
  - **Documentation surface.** Canonical v1.2 `packages/shell/README.md` with `@example` JSDoc coverage for every factory function (`createShellBridge`, per-domain proxies, `createKeysForwarder`); v1.2 anti-feature posture is framed descriptively (no host-injected 'nostr' object; shell-mediated signing via `relay.publish` / `relay.publishEncrypted`).

  Requirement IDs covered:

  - DEMO-02 (signer modal + NIP-46 connect flow via canonical identity + relay publishEncrypted)
  - NAP-08 (theme-switcher dispatches `publishTheme()` that other napplets observe)
  - E2E-07 (`theme-broadcast` spec green: theme-switcher → preferences propagation)
  - DOCS-01, DOCS-02 (typedoc + shell README)

  Additive only. No API renames. No breaking changes.

- Updated dependencies [226cdca]
- Updated dependencies [226cdca]
- Updated dependencies [97b7bc8]
- Updated dependencies [97b7bc8]
  - @kehto/acl@0.2.0
  - @kehto/runtime@0.2.0
