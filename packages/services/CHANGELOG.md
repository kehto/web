# @kehto/services

## 0.9.0

### Minor Changes

- 50a3241: feat: implement NAP-INTENT archetype intent dispatch

  Adds shell-side support for NAP-INTENT, which lets a napplet invoke _another_
  napplet by its **archetype** (a shared role like `note` or `emoji-list`) without
  addressing it directly. The napplet names a role, an action, and an opaque
  payload tagged by a NAP-N protocol; the shell resolves the archetype to an
  installed handler (honoring the user's default-handler preference), creates or
  focuses its window, and delivers the payload. Routing (`archetype`) and payload
  format (`protocol`) are orthogonal — the shell owns resolution, default
  handling, window lifecycle, and the cross-napplet trust boundary.

  - `@kehto/acl`: new `intent:read` / `intent:write` capabilities and `intent.*`
    capability resolution (`invoke` → write; `available`/`handlers` → read;
    `changed`/`*.result`/`*.error` pushes → recipient read).
  - `@kehto/runtime`: routes the `intent` domain to a registered `intent` service
    with ACL enforcement; `class-2` excludes `intent:write` (mirrors `relay:write`
    / `outbox:write` — a read-only class can introspect but not dispatch).
  - `@kehto/services`: `createIntentService` (pure `intent.*` envelope router with
    `intent.changed` broadcast) and `createCatalogIntentResolver` (concrete
    catalog-backed resolver: archetype→handler resolution, default handling,
    "open with…" chooser, action/protocol validation, and window create/focus).
    The `IntentRequest`/`IntentResult`/`IntentAvailability` value types are defined
    locally (wire-compatible with the upstream draft), as the pinned
    `@napplet/core` predates them.
  - `@kehto/shell`: advertises `intent` via `shell.supports("intent")` when an
    available intent dispatcher is wired.

### Patch Changes

- Updated dependencies [50a3241]
- Updated dependencies [f5148a3]
  - @kehto/runtime@0.9.0

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
  - @kehto/runtime@0.5.0

## 0.4.0

### Minor Changes

- Release the published NAP-MEDIA and NAP-IDENTITY alignment against `@napplet/nub@0.5.0`.

  The runtime package set now consumes the published NAP helper graph, carries owner-aware media session create/result shapes, validates shell-owned media source requests before returning the current unsupported-owner response, and exposes the identity snapshot-plus-`identity.changed` flow without requiring napplet polling.

### Patch Changes

- Updated dependencies
  - @kehto/runtime@0.4.0

## 0.3.1

### Patch Changes

- Align published package peers and source imports with `@napplet/nub@0.5.0`, the June 12 NAP helper release that carries the NAP-MEDIA and NAP-IDENTITY changes.
- Updated dependencies
  - @kehto/runtime@0.3.1

## 0.3.0

### Minor Changes

- 0fa11f1: NUB-CONFIG reference service (v1.7 Phase 39 / 9th NUB domain).

  New public surface: `createConfigService(options)`, `ConfigServiceOptions`, `ConfigService`, `ConfigSchemaValidation`.

  Shell-side reference implementation of the canonical `@napplet/nub/config` wire protocol (published at `^0.2.1`). Handles `config.get`, `config.subscribe` / `config.unsubscribe`, `config.registerSchema`, `config.openSettings`. Exposes `publishValues(values)` for live fan-out to subscribed napplets.

  Options-as-bridge pattern (v1.6 Decision 18): host apps provide `getValues` (required) and optional `registerSchema`, `openSettings`, `onSubscribe`, `onUnsubscribe` hooks.

  **Scope boundary (CONFIG-04):** NUB-CONFIG is shell-managed per-napplet configuration. Shell writes, napplet reads. There is NO `config.set` wire message — that is intentional. Do NOT use this service as a general key-value store; NUB-STORAGE (`state:read` / `state:write`) remains the general KV surface. See `packages/services/src/config-service.ts` top-of-file for the full anti-overlap documentation.

  Pairs with `@kehto/acl` `config:read` capability and `resolveCapabilitiesNub` `config.*` dispatch wiring (shipped in the same Phase 39 plan batch).

  Additive — no breaking changes. Minor bump because the public service surface expanded.

- 239fa70: Add NUB-RESOURCE reference service (10th NUB domain, v1.7 Phase 40).

  - `@kehto/services`: `createResourceService({ fetch, isOriginGranted, getConnectGrants, resolveIdentity })` factory. All four options required from day one — factory throws on construction if any is missing (H-03 prevention). Implements canonical 4-message protocol: `resource.bytes`, `resource.cancel` inbound; `resource.bytes.result`, `resource.bytes.error` outbound. Cancel correlates to in-flight requests via requestId.
  - `@kehto/acl`: new `'resource:fetch'` capability; `resolveCapabilitiesNub` extended with `resource.*` mapping (asymmetric: napplet requests get sender gate; shell pushes get recipient gate). `acl-state.ts` CAP_MAP extended with bit 15 for `resource:fetch`.
  - `@kehto/runtime`: `handleResourceMessage` dispatch + `nubDispatch.registerNub('resource', ...)` wiring (Phase 39 Dev 1 lesson: missing registerNub silently drops all envelopes).
  - `@kehto/shell`: `CANONICAL_NUB_DOMAINS` extended with `config` and `resource`; provisional-resource wire types re-exported via barrel.

  No breaking changes. See docs/policies/SHELL-RESOURCE-POLICY.md (Phase 40 Plan 40-03) for host-fetch policy surface (redirects, MIME sniffing, private-IP blocking — host-app concerns).

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

- 8890904: Phase 45 (DECRYPT-02..05/07 / v1.8): extend `createIdentityService` with a host decrypt bridge and `verifyEvent` option, then handle `identity.decrypt` for NIP-04, NIP-44 direct, and NIP-17 gift-wrap events with the canonical 8-code error union.
- b7032ab: Phase 44 (DEP-01..02 / v1.8): bump `@napplet/core` and `@napplet/nub` peer deps `^0.2.1` → `^0.3.0`. Inline JSDoc reference updated to point at `internal-resource.ts` (was `provisional-resource.ts`). No behavioral change.

### Patch Changes

- 03c293c: Add `HostCacheBridge` as an additive type alias for `CacheServiceOptions` (kehto#1 naming parity with `HostKeysBridge` / `HostMediaBridge`). Pure alias — no runtime change, no breaking change. The existing `CacheServiceOptions` export remains the primary name; new consumers may prefer `HostCacheBridge` for cross-package consistency (M-02 prevention: do not rename or delete `CacheServiceOptions`).
- d885328: v1.16 structural cleanup and anti-slop pass.

  This release removes the remaining local `aislop` structural warnings through behavior-preserving refactors and comment/import cleanup. The affected public packages keep their existing runtime contracts; the bump is patch-level because the changes are internal decomposition, code-quality cleanup, and packaging hygiene rather than new public API.

  Highlights:

  - Runtime relay, identity, IFC, and fallback domain handling were split into focused helpers.
  - Shell and playground-facing helpers were decomposed without changing public package exports.
  - Service factories and adapter builders were split into smaller private helpers.
  - Public package source now passes the local `aislop` gate with the existing scanner thresholds.

- Updated dependencies
- Updated dependencies [239fa70]
- Updated dependencies [d885328]
- Updated dependencies [93224cd]
- Updated dependencies [8890904]
- Updated dependencies [b7032ab]
- Updated dependencies [597dbdb]
  - @kehto/runtime@0.3.0

## 0.2.0

### Minor Changes

- 226cdca: Reference services realigned to the 8-nub protocol. `signer-service` is deleted; its responsibilities are split into a new `identity-service` (read-only `getPublicKey` / `getRelays` / `getProfile` / `getFollows` / `getList` / `getZaps` / `getMutes` / `getBlocked` / `getBadges`) and shell-mediated signing/encryption inside `relay.publish` / `relay.publishEncrypted`. New reference handlers added for the other four new nub domains: `keys-service` (keyboard actions — bindings/register/forward), `media-service` (MediaSession create/update/destroy + controls), `notify-service` (send/permission/channel register/dismiss/badge), and `theme-service` (get/changed broadcast with `publishTheme`/`getCurrentTheme` host-facing bundle). Legacy `audio-service` and `notification-service` remain for ifc-emit topics and coexist with the new NIP-5D envelope handlers.

  **Breaking changes:**

  - `signer-service` REMOVED. Napplets and hosts depending on `registerService('signer', ...)` must either register an `identity` service or remove the call; signing/encryption happens inside the shell via relay publishes.

  **Migration note:**

  - `tests/unit/shell-runtime-integration.test.ts` was removed in v1.2 — its v1.1 BusKind / signer.\* assertions no longer apply to the 8-nub protocol model. Equivalent coverage is provided by the per-package integration tests added in v1.2 Phases 12-03 (identity), 12-04 (ifc), 12-08 (relay publishEncrypted), and 12-09 (storage).

  **Peer deps:**

  - @napplet/core bumped from >=0.1.0 to ^0.2.0
  - Added @napplet/nub-identity, @napplet/nub-ifc, @napplet/nub-keys, @napplet/nub-media, @napplet/nub-notify, @napplet/nub-relay, @napplet/nub-storage, @napplet/nub-theme (all ^0.2.0)

### Patch Changes

- 41b12b9: v1.3 behavior-alignment rollup — no new services, no breaking changes:

  - **notification-service canonical `notify.*` handling.** The service now handles both canonical v1.2 NIP-5D `notify.create` / `notify.list` / `notify.read` / `notify.dismiss` envelopes AND the legacy `ifc.emit` format for in-flight compatibility (Phase 17 + Phase 19 alignment). Registered under both `'notifications'` (topology key) and `'notify'` (runtime routing key) so the demo topology and the runtime dispatch both resolve correctly from a single handler instance (Phase 19 dual-register pattern).
  - **identity-service `getPublicKey` contract.** The service always returns a result envelope (with an empty pubkey when no signer is present) rather than throwing — matches the `identity.getPublicKey` "Always succeeds" contract. Enables the `profile-viewer` napplet to render a `no-pubkey` sentinel cleanly under the no-signer case (Phase 20).
  - **Documentation surface.** Canonical v1.2 `packages/services/README.md` groups factories by NIP-5D NUB domain with explicit capability-gate annotations (e.g., `createIdentityService` requires `identity:read` ACL entry).

  Requirement IDs covered:

  - DEMO-05 (`createDemoHooks()` registers reference services for keys / media / theme alongside identity / notifications)
  - DEMO-07 (notification demo + kinds panel + constants panel reflect v1.2 data)
  - NAP-05 (toaster creates / lists / dismisses via `notify.*`)
  - NAP-07 (profile-viewer calls `identity.getPublicKey` + `identity.getProfile`)
  - E2E-07 (`notify-lifecycle`, `identity-flow` specs green)
  - DOCS-01, DOCS-02 (typedoc + services README)

  No API renames. Additive behavior; legacy call sites continue to work.

- Updated dependencies [226cdca]
- Updated dependencies [97b7bc8]
  - @kehto/runtime@0.2.0
