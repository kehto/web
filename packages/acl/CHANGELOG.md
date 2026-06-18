# @kehto/acl

## 0.12.0

### Minor Changes

- 3a4d2cd: Make INC the only event-channel protocol vocabulary and remove pre-INC aliases.

  **@kehto/runtime** now registers and dispatches only canonical `inc.*` message
  types, with the runtime handler renamed to INC terminology throughout.

  **@kehto/acl** now resolves only canonical `inc:*` capability actions for
  event-channel permissions.

  **@kehto/services** now emits and subscribes through canonical `inc.emit` and
  `inc.event` runtime topics.

  **@kehto/shell** now reports NAP-INC capability protocols only and no longer
  mirrors older event-channel protocol strings.

- 8ca8fc1: Complete the NAP rename: remove retired helper vocabulary from the public API
  and the `shell.init` wire (clean break, no aliases).

  **@kehto/acl**: Export the NAP message and capability resolver names only:
  `NapMessage` and `resolveCapabilitiesNap`.

  **@kehto/runtime**: Export the NAP enforcement, storage, message, and resolver
  names only: `createNapEnforceGate`, `NapEnforceConfig`, `handleStorageNap`,
  `NapMessage`, and `resolveCapabilitiesNap`.

  **@kehto/shell**: Remove the retired mirror field from `ShellCapabilities` and
  the dual-emit in `buildShellCapabilities` — the `shell.init` payload now carries
  only the NAP-vocabulary `naps` array plus the conformant `domains`/`protocols`
  shape. Drop the retired capability-lookup alias and re-export only the NAP
  enforcement/message names.

## 0.11.1

### Patch Changes

- fix(deps): widen @napplet peer range to admit 0.13 (kehto/web#48)

  On a `0.x` line a caret pins the minor, so `@napplet/{core,nap}` peers of `^0.12.0`
  resolved to `>=0.12.0 <0.13.0` and excluded the current `@napplet` 0.13 line —
  consumers installing `@napplet 0.13` (e.g. hyprgate's shell) hit a peer mismatch.

  The `@napplet/core` and `@napplet/nap` peer ranges on `@kehto/{acl,runtime,shell,services}`
  (and `@napplet/core` on `@kehto/firewall`) are widened to `>=0.12.0 <0.14.0`, which keeps
  0.12 working while admitting 0.13. kehto's dev deps are bumped to the 0.13 line so its own
  build, type-check, and full unit suite validate against it (all green). No source change —
  kehto consumes `@napplet` for protocol types + the wire format, which is stable across
  0.12 → 0.13.

## 0.11.0

### Minor Changes

- d37ef25: chore: modernize to @napplet 0.12/0.13 (peer dep + core API rename)

  All runtime packages move off the legacy `@napplet/nap` toolchain onto the
  current `@napplet` line:

  - **Peer dependency** `@napplet/core ^0.5` → `^0.12`, and `@napplet/nap ^0.5`
    → `@napplet/nap ^0.12` (the package was renamed upstream; `@napplet/firewall`
    consumers only need `@napplet/core ^0.12`).
  - **Core dispatch API** `registerNap` → `registerNap` and the `NapHandler` type
    → `NapHandler`. The runtime's domain dispatcher now calls `registerNap(...)`
    for every domain.

  **Migration for consumers:** install `@napplet/core@^0.12` and `@napplet/nap`
  (replacing `@napplet/nap`). The kehto wire protocol is unchanged — the legacy
  `inc`/`naps` envelopes are still dual-emitted for the installed 0.5.0 shim
  (removal is tracked as CLEANUP-01) — so no napplet-side code change is required;
  this is a host-side dependency and core-API modernization only.

  Internal kehto identifiers that still carry "nap"/"inc" vocabulary
  (`createNapEnvelopeDispatcher`, `IncDomain`, `inc-handler.ts`, …) are unchanged:
  they are private and the runtime dual-routes `inc`+`inc`.

## 0.10.0

### Minor Changes

- 968e664: feat: NAP ontology alignment — inc domain, inc:NAP-0N protocol IDs, dual-emit back-compat window

  Aligns `@kehto/*` with the `@napplet/*` 0.9.0 rename from the `inc`/`NAP-NN`
  vocabulary to the canonical NAP vocabulary (`inc`/`NAP-NN`). Resolves kehto/web#24.

  ### @kehto/shell — `ShellCapabilities` public interface change

  `buildShellCapabilities` now dual-emits two arrays in the `shell.init` payload:

  - **`naps`** (new, primary): NAP-vocabulary capability set consumed by
    `@napplet/shim >=0.9.0`. Advertises bare domain `inc` (the NAP rename of
    `inc`) and protocol IDs `inc:NAP-01..inc:NAP-06` (the `inc:NAP-01..06` aliases
    renamed, plus `inc:NAP-01` replaced). Contains NO `inc` or `NAP-NN` identifiers.
    Conditional entries: `relay`+`outbox` when a relay pool is wired; `upload` when
    an upload backend is wired; `intent` when an intent dispatcher is available.

  - **`naps`** (retained, legacy): legacy `inc`/`inc:NAP-01..06`/`inc:NAP-01`
    vocabulary retained unchanged for one back-compat release, consumed by
    `@napplet/nap` and `@napplet/shim <=0.8.x`. No content change from prior
    releases.

  The dual-emit is intentional and slated for removal in a future cleanup milestone
  (CLEANUP-01) once all downstreams have migrated to `@napplet/shim >=0.9.0`.

  **Downstream consumer impact — hyprgate MUST consume `naps`:**
  The `@napplet/shim >=0.9.0` `createShellSupports` function reads ONLY
  `capabilities.naps`; it ignores `capabilities.naps`. Any consumer (hyprgate or
  custom shell host) that builds `supports()` from `shell.init.capabilities` must
  switch from reading `naps` to reading `naps` to work correctly with napplets
  built against `@napplet/* >=0.9.0`. Legacy napplets (using `@napplet/nap` /
  `@napplet/shim <=0.8.x`) continue to read `naps` and are unaffected.

  ### @kehto/runtime — `inc.*` dispatch acceptance

  The nap envelope dispatcher now registers the INC handler under **both** the
  `inc` and `inc` dispatch keys. A napplet that sends `inc.subscribe`,
  `inc.emit`, or `inc.channel.*` messages reaches the same handler as one that
  sends the legacy `inc.*` messages. The INC handler is domain-aware: responses
  to a requester echo the requester's own domain prefix (`inc.subscribe` →
  `inc.subscribe.result`); push events to other napplets use the recipient's
  tracked domain prefix, so each napplet receives its own vocabulary.

  Legacy `inc.*` routing is byte-for-byte unchanged — no regression for napplets
  on `@napplet/nap` or `@napplet/shim <=0.8.x`.

  ### @kehto/acl — `inc.*` ACL gating

  `resolveCapabilitiesNap` now maps the `inc` domain identically to `inc` via a
  fall-through `case 'inc':` in the domain switch. `inc.emit` and
  `inc.channel.emit/broadcast` require `relay:write`; `inc.subscribe`,
  `inc.unsubscribe`, `inc.channel.open/list/close` require `relay:read`. This
  closes the ACL bypass that would have allowed `inc.emit` to fall through to the
  `unknown → null/null` branch, bypassing the relay:write gate that `inc.emit`
  enforces.

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

## 0.4.0

### Minor Changes

- Release the published NAP-MEDIA and NAP-IDENTITY alignment against `@napplet/nap@0.5.0`.

  The runtime package set now consumes the published NAP helper graph, carries owner-aware media session create/result shapes, validates shell-owned media source requests before returning the current unsupported-owner response, and exposes the identity snapshot-plus-`identity.changed` flow without requiring napplet polling.

## 0.3.1

### Patch Changes

- Align published package peers and source imports with `@napplet/nap@0.5.0`, the June 12 NAP helper release that carries the NAP-MEDIA and NAP-IDENTITY changes.

## 0.3.0

### Minor Changes

- d4e733e: NAP-CONFIG (v1.7 Phase 39): add `config:read` capability and extend `resolveCapabilitiesNap` for the `config.*` domain.

  Sender gate: `config:read` for all napplet-originated config requests (`config.get`, `config.subscribe`, `config.unsubscribe`, `config.registerSchema`, `config.openSettings`).

  Recipient gate: `config:read` for shell-originated config pushes (`config.values`, `config.registerSchema.result`, `config.schemaError`) — napplets without the cap never see the pushes.

  Anti-overlap with NAP-STORAGE: CONFIG is shell-managed per-napplet configuration (napplet reads, shell writes). STORAGE remains the general key-value surface. See `packages/services/src/config-service.ts` (Plan 39-02) for the scope boundary documentation.

  Additive — no breaking changes. Minor bump because the public capability surface expanded.

- 93224cd: Consolidate NAP peer dependencies from 8 split `@napplet/nap-{identity,inc,keys,media,notify,relay,storage,theme}@^0.2.1` packages onto the single `@napplet/nap@^0.2.1` package. All in-repo imports now read from the `@napplet/nap/<domain>/types` subpath (type-only consumers) or the root `@napplet/nap/<domain>` subpath.

  Addresses kehto#4 (hyprgate v2.0 Kehto Migration gap analysis). Eliminates the dual-instance pitfall where downstream shells consuming both the split-package and consolidated NAP shapes ended up with two copies of every NAP module on disk.

  Downstream consumers note: `@napplet/nap@0.2.1` was published with an unresolved `workspace:*` specifier for its `@napplet/core` dependency. Until upstream re-publishes, workspace consumers should add the following `pnpm.overrides` entry at their workspace root to pin the transitive resolution:

  ```json
  "pnpm": {
    "overrides": {
      "@napplet/nap>@napplet/core": "^0.2.1"
    }
  }
  ```

  Public peer-dep surface changed — minor bump (not patch).

  REQ-IDs: DEP-01, DEP-02, DEP-03, DEP-04, DEP-05.

- 8890904: Phase 45 (DECRYPT-06 / v1.8): add the `identity:decrypt` capability and map `identity.decrypt` to it. This keeps decrypt class gating explicit and separate from the read-only `identity:read` surface.
- b7032ab: Phase 44 (RENAME-01-DEP / v1.8): bump `@napplet/core` and `@napplet/nap` peer deps `^0.2.1` → `^0.3.0`. No source code change; consumers using `@kehto/acl@^0.2` may need to also bump their `@napplet/{core,nap}` resolutions.

### Patch Changes

- 239fa70: Add NAP-RESOURCE reference service (10th NAP domain, v1.7 Phase 40).

  - `@kehto/services`: `createResourceService({ fetch, isOriginGranted, getConnectGrants, resolveIdentity })` factory. All four options required from day one — factory throws on construction if any is missing (H-03 prevention). Implements canonical 4-message protocol: `resource.bytes`, `resource.cancel` inbound; `resource.bytes.result`, `resource.bytes.error` outbound. Cancel correlates to in-flight requests via requestId.
  - `@kehto/acl`: new `'resource:fetch'` capability; `resolveCapabilitiesNap` extended with `resource.*` mapping (asymmetric: napplet requests get sender gate; shell pushes get recipient gate). `acl-state.ts` CAP_MAP extended with bit 15 for `resource:fetch`.
  - `@kehto/runtime`: `handleResourceMessage` dispatch + `napDispatch.registerNap('resource', ...)` wiring (Phase 39 Dev 1 lesson: missing registerNap silently drops all envelopes).
  - `@kehto/shell`: `CANONICAL_NAP_DOMAINS` extended with `config` and `resource`; provisional-resource wire types re-exported via barrel.

  No breaking changes. See docs/policies/SHELL-RESOURCE-POLICY.md (Phase 40 Plan 40-03) for host-fetch policy surface (redirects, MIME sniffing, private-IP blocking — host-app concerns).

- d885328: v1.16 structural cleanup and anti-slop pass.

  This release removes the remaining local `aislop` structural warnings through behavior-preserving refactors and comment/import cleanup. The affected public packages keep their existing runtime contracts; the bump is patch-level because the changes are internal decomposition, code-quality cleanup, and packaging hygiene rather than new public API.

  Highlights:

  - Runtime relay, identity, INC, and fallback domain handling were split into focused helpers.
  - Shell and playground-facing helpers were decomposed without changing public package exports.
  - Service factories and adapter builders were split into smaller private helpers.
  - Public package source now passes the local `aislop` gate with the existing scanner thresholds.

## 0.2.0

### Minor Changes

- 226cdca: ACL full 8-domain coverage. `resolveCapabilitiesNap` now maps capabilities for identity, inc, keys, media, notify, relay, storage, theme. Signer domain removed (getPublicKey/getRelays moved to identity; signEvent/nip04/nip44 are shell-mediated via relay.publish/publishEncrypted). New capability constants: identity:read, keys:bind, keys:forward, media:control, notify:send, notify:channel, theme:read.

  **Breaking changes:**

  - Removed capability constants: sign:event, sign:nip04, sign:nip44
  - Removed `resolveCapabilitiesNap` case 'signer'

  **Peer deps:**

  - @napplet/core bumped from >=0.1.0 to ^0.2.0
  - Added @napplet/nap-identity, @napplet/nap-inc, @napplet/nap-keys, @napplet/nap-media, @napplet/nap-notify, @napplet/nap-relay, @napplet/nap-storage, @napplet/nap-theme (all ^0.2.0)

### Patch Changes

- 97b7bc8: v1.3 consume-and-showcase — no protocol changes to `@kehto/acl`. The demo's ACL panel (`apps/demo/src`) now drives grant/revoke/block/unblock through the canonical v1.2 `ShellAdapter.acl` hooks, and ACL-capability-matrix Playwright specs prove the package's enforcement contract end-to-end against the v1.3 demo napplet showcase.

  Documentation:

  - New canonical v1.2 `packages/acl/README.md` with `@example` JSDoc coverage for every non-type public export.
  - typedoc reference generated via `pnpm docs:api` at repo root.

  Requirement IDs covered:

  - DEMO-03 (ACL panel grant/revoke/block/unblock flows)
  - E2E-08 (`acl-grant-revoke`, `acl-block-unblock`, `acl-revoke-relay-write`, `acl-revoke-storage-write` specs green)
  - DOCS-01, DOCS-02 (typedoc + per-package README)
