# @kehto/runtime

## 0.18.1

### Patch Changes

- 89f4c11: Express peer and development dependency upper bounds with inclusive maximum ranges for clearer supported-version metadata, including the current Napplet 0.26 line.
- Updated dependencies [89f4c11]
  - @kehto/acl@0.15.2
  - @kehto/firewall@0.3.7

## 0.18.0

### Minor Changes

- 8aa2123: Align read-style NAP event surfaces with `RelayEventResult`.

  Relay and outbox read results now carry raw events as `{ event, sidecar? }`,
  with observed relay URLs in `sidecar.relayHints`. Outbox subscriptions no
  longer expose `outbox.eose`; streams continue until `outbox.close` or
  `outbox.closed`.

## 0.17.1

### Patch Changes

- Accept the released NAP-COUNT-capable `@napplet/core` and `@napplet/nap`
  `0.25.x` line in published package metadata.

  The NAP-COUNT implementation was versioned before the matching napplet package
  release landed, so this patch updates peer/dev ranges and local package graph
  guards without changing Kehto runtime behavior.

- Updated dependencies
  - @kehto/acl@0.15.1
  - @kehto/firewall@0.3.6

## 0.17.0

### Minor Changes

- 7293d4d: Add NAP-COUNT support for the draft `count.query` domain.

  Kehto now routes `count.query` through a registered runtime count service,
  advertises `window.napplet.count` only when that service is wired, exposes a
  reference `createCountService()` helper, and lets Paja answer exact counts from
  its memory relay fixture store without returning event payloads.

### Patch Changes

- Updated dependencies [7293d4d]
  - @kehto/acl@0.15.0

## 0.16.1

### Patch Changes

- 91a2c01: Accept `@napplet/core` and `@napplet/nap` 0.24.x peer dependencies across compatible Kehto packages.
- Updated dependencies [91a2c01]
  - @kehto/acl@0.14.2
  - @kehto/firewall@0.3.5

## 0.16.0

### Minor Changes

- cd6e971: Add runtime-owned NAP-DM service support with ACL capability mapping, shell capability advertisement, and NIP-17/NDR/Cordn service adapters.

### Patch Changes

- a07f3cd: Add a NIP-5D injected-domain namespace prelude helper for srcdoc hosts and
  align napplet package peer ranges with the inject-compatible release line.
- Updated dependencies [cd6e971]
- Updated dependencies [a07f3cd]
  - @kehto/acl@0.14.0
  - @kehto/firewall@0.3.4

## 0.15.0

### Minor Changes

- 4ab6f12: relay.query one-shot now resolves to matched events (NAP RelayQueryResultMessage) and delegates to the registered relay service, instead of returning a count.

## 0.14.1

### Patch Changes

- 2dfdebb: Align Napplet dependency ranges with the `resource.bytesMany` package release.
- Updated dependencies [2dfdebb]
  - @kehto/acl@0.13.1
  - @kehto/firewall@0.3.3

## 0.14.0

### Minor Changes

- 272277a: Add NAP-WEBRTC runtime parity.

  The runtime now dispatches the `webrtc` domain, `@kehto/services` exports a reference service for shell-mediated WebRTC open/send/close sessions and host-pushed events, shell capabilities can advertise NAP-WEBRTC, and Paja/playground hosts register deterministic WebRTC support.

### Patch Changes

- 7dbbdf8: Add NAP-BLE runtime parity.

  The runtime now dispatches the `ble` domain, `@kehto/services` exports a reference service for shell-mediated BLE/GATT sessions, shell capabilities can advertise NAP-BLE, and Paja/playground hosts register deterministic BLE support.

- 7c7b019: Add NAP-COMMON runtime parity for the current `@napplet/nap` contract.

  The runtime now dispatches the `common` domain, `@kehto/services` exports a reference service for public NIP-19 helpers and shell-mediated common social actions, shell capabilities can advertise NAP-COMMON, and Paja/playground hosts register deterministic common support.

- 4e0f4b9: Add NAP-LINK runtime parity for the current `@napplet/nap` contract.

  The runtime now dispatches the `link` domain, `@kehto/services` exports a reference `link.open` service, shell capabilities can advertise NAP-LINK, and Paja/playground hosts register link support. Package peer ranges now track the current `@napplet` 0.20 line.

- 4fd5e37: Add NAP-LISTS runtime parity for the current `@napplet/nap` contract.

  The runtime now dispatches the `lists` domain, `@kehto/services` exports a reference service for supported list metadata and shell-mediated add/remove mutations, shell capabilities can advertise NAP-LISTS, and Paja/playground hosts register deterministic list support.

- b37337b: Add NAP-SERIAL runtime parity.

  The runtime now dispatches the `serial` domain, `@kehto/services` exports a reference service for shell-mediated serial open/write/close sessions, shell capabilities can advertise NAP-SERIAL, and Paja/playground hosts register deterministic serial support.

- cacab69: Pin internal `@kehto/*` dependencies to explicit caret version ranges instead of
  the `workspace:*` protocol, so published packages (npm and JSR) carry correct,
  resolvable dependency versions. The ranges mirror the existing `jsr.json` imports.
- Updated dependencies [4e0f4b9]
- Updated dependencies [e1030d8]
  - @kehto/acl@0.13.0
  - @kehto/firewall@0.3.2

## 0.13.0

### Minor Changes

- 8ecfdd1: Remove NAP-CLASS, NAP-CLASS-1, and NAP-CONNECT (clean break, no aliases).

  **@kehto/runtime**: Remove `NappletClass` type, `SessionEntry.class` field, `CLASS_CAPABILITY_ALLOWLIST`,
  and the class pre-filter from `enforceNap`. `EnforceResult.reason` is now `'allowed' | 'capability-missing'`
  (no `'class-forbidden'`). `AclCheckEvent.reason` likewise drops `'class-forbidden'`.
  `resolveIdentityByWindowId` no longer returns a `class` field.

  **@kehto/shell**: Remove `connectStore` singleton, `ConnectStore`, `ConnectGrant`, `ConnectGrantKey`,
  `ConnectConsentRequest`, `ConsentResult`, `connectGrantKey`, `NappletClass` re-export, and
  `classToWireCode`. Remove `'connect'` and `'class'` from `NAP_DOMAINS`.
  `ShellBridge.connectStore` getter removed. `onNip5dIframeCreate` hook return type drops the `class`
  field. `ResourceErrorCode` drops `'class-forbidden'`.

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

### Patch Changes

- 8c7a39f: Honor the canonical NAP-RELAY `relay` hint on `relay.subscribe` envelopes when routing through the runtime relay pool path.
- Updated dependencies [3a4d2cd]
- Updated dependencies [8ca8fc1]
  - @kehto/acl@0.12.0

## 0.12.1

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

- Updated dependencies
  - @kehto/acl@0.11.1
  - @kehto/firewall@0.3.1

## 0.12.0

### Minor Changes

- ac0bf74: feat(runtime): per-instance storage scope via the per-call `scope` wire field

  Implements NAP-STORAGE per-instance storage (napplet/naps#3) so multiple open
  windows of the _same_ napplet (e.g. several Feed windows) keep isolated,
  independently-persisted state.

  - Every `storage.{get,set,remove,keys}` request now honors an optional
    `scope: "shared" | "instance"` (default `"shared"`). `"instance"` folds a
    stable per-window discriminator (`@i/<windowId>:`) into the storage key; the
    napplet never sees or names an instance id — it sets `scope` and relies on the
    shell's **Unique** (windows never share a namespace) and **Stable** (same
    window resolves to the same namespace across reloads) guarantees.
  - `scope: "shared"` (or absent) addresses the napplet-wide `(dTag, aggregateHash)`
    namespace and is **byte-identical to prior behavior**, including the triple-read
    migration path. Existing napplets that never set `scope` are unaffected.
  - `storage.keys` with `scope: "shared"` excludes per-instance sub-keys (reserved
    `@i/` marker) so per-window data never leaks into a shared listing; with
    `scope: "instance"` it returns only the calling window's keys. `remove` is
    likewise scoped.
  - Per-napplet quota is unchanged: instance sub-keys draw from the same identity
    budget.
  - An unrecognized `scope` value is an invalid request and yields a `.result`
    envelope with `error` set.

  This is the per-call model from the canonical spec — instancing is a property of
  the _data_, not the napplet — and **supersedes** the earlier per-napplet
  `SessionEntry.instanceable` capability shape on `feat/instanceable-storage-scope`.
  No `SessionEntry` change; `scope` is read off the wire, so kehto is forward-
  compatible once the published `@napplet/nap` storage SDK exposes `scope` / the
  `storage.instance.*` sugar surface (tracked separately on napplet/web).

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

### Patch Changes

- Updated dependencies [d37ef25]
  - @kehto/acl@0.11.0
  - @kehto/firewall@0.3.0

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

### Patch Changes

- Updated dependencies [968e664]
  - @kehto/acl@0.10.0

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

- f5148a3: Add `@kehto/firewall` — a behavioral anti-abuse gate, and integrate it into `@kehto/runtime`.

  **New package `@kehto/firewall`** (pure, zero-dependency, WASM-ready, mirrors `@kehto/acl`): a normalized `Observation` plus a pure `evaluate(config, state, observation)` decision engine implementing per-`(napplet, opClass)` token-bucket rate limiting, an init-burst guard, declarative content matchers (event kind / payload size / focus conditions), a soft `unfocusedMultiplier`, and first-match-wins rule precedence (per-napplet policy → init-burst → content matchers → op-class rate → global rate → defaults). Includes pure config mutations with serialize/deserialize (defensive, falls back to defaults on malformed input) and conservative built-in defaults (exceed-action `flag`, init-burst `block`, `0.25×` unfocused).

  **`@kehto/runtime` integration:** every napplet message that passes the ACL check is now evaluated by the firewall before dispatch. Adds a `firewall-state` container, three new **optional** `RuntimeAdapter` hooks (`firewallPersistence`, `onFirewallEvent`, `getFocusContext`), and an allow/deny/ask per-napplet policy that reuses the consent handler ("reject now, prompt async, remember choice"). Config persists; counters are ephemeral. Focus is sourced shell-side (forge-proof), never self-reported by napplets.

  **Note (`@kehto/runtime` public API):** the `ConsentRequest` type gains a `'firewall-policy'` variant and its `event` field is now optional (a firewall consent prompt carries no Nostr event). Existing consent handlers continue to work; handlers that exhaustively switch on `ConsentRequest.type` should add the new variant.

### Patch Changes

- Updated dependencies [50a3241]
- Updated dependencies [f5148a3]
  - @kehto/acl@0.9.0
  - @kehto/firewall@0.2.0

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

## 0.4.0

### Minor Changes

- Release the published NAP-MEDIA and NAP-IDENTITY alignment against `@napplet/nap@0.5.0`.

  The runtime package set now consumes the published NAP helper graph, carries owner-aware media session create/result shapes, validates shell-owned media source requests before returning the current unsupported-owner response, and exposes the identity snapshot-plus-`identity.changed` flow without requiring napplet polling.

### Patch Changes

- Updated dependencies
  - @kehto/acl@0.4.0

## 0.3.1

### Patch Changes

- Align published package peers and source imports with `@napplet/nap@0.5.0`, the June 12 NAP helper release that carries the NAP-MEDIA and NAP-IDENTITY changes.
- Updated dependencies
  - @kehto/acl@0.3.1

## 0.3.0

### Minor Changes

- **Fix #14** — `handleStorageNap` now returns storage errors as the canonical `storage.<action>.result` envelope with an `error` field, instead of a non-canonical `storage.<action>.error` type. The `@napplet/nap/storage` protocol defines no `*.error` message, so conformant shims silently dropped the old envelope and napplets hung until their request timeout. Clean break: the `storage.*.error` envelope is removed entirely (no backwards-compat).

  **Fix #15** — NIP-5D source-identity napplets are now registered into `runtime.sessionRegistry` during the `shell.ready` handshake. Previously `originRegistry` identity was never bridged into the runtime registry, so `getEntryByWindowId` always returned `undefined` and every storage (and other `sessionRegistry`-keyed) operation failed with `not registered`. The `shell.ready` handler resolves identity from the `onNip5dIframeCreate` hook (preferred) or `originRegistry.getIdentity` (fallback) and registers a source-identity `SessionEntry` (`provenance: 'nip-5d'`, `pubkey: ''`); it skips registration cleanly when neither source yields identity.

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

- 8890904: Phase 45 (DECRYPT-01/06 / v1.8): route `identity.decrypt` through the NAP enforcement gate and return typed decrypt errors for ACL denial. Class-forbidden decrypt attempts now emit `identity.decrypt.error` with `error: 'class-forbidden'` before any identity service handler runs.
- b7032ab: Phase 44 (DEP-01..02 / v1.8): bump `@napplet/core` and `@napplet/nap` peer deps `^0.2.1` → `^0.3.0`. No source code change in `@kehto/runtime` itself; consumers should resolve `@napplet/{core,nap}` at `^0.3.0` alongside.
- 597dbdb: **RENAME-01 (v1.8 Phase 42)** — `SessionEntry.identitySource: 'auth' | 'source'` is renamed to `SessionEntry.provenance: 'nip-5d' | 'legacy-auth'` across both `@kehto/shell` and `@kehto/runtime`. The new field name and variant values name the actual provenance (canonical NIP-5D origin registration vs legacy AUTH handshake) instead of the obsolete `'auth'`/`'source'` shorthand.

  **Migration:** Downstream consumers reading `entry.identitySource === 'source'` must rewrite to `entry.provenance === 'nip-5d'`. Consumers reading `entry.identitySource === 'auth'` must rewrite to `entry.provenance === 'legacy-auth'`. The old field is hard-removed; no compatibility shim ships.

  RENAME-02 (the `'auth:identity-changed'` topic rename in this same milestone) ships as a soft-rename with dual-emit — see its changeset for that migration window.

  Pre-1.0 minor bump is breaking per kehto's convention. The v1.6 carryover note flagged this rename as low-risk because the field is internal-leaning and the test surface is the primary live producer in this repo. Additional consumers updated in the same pass: `apps/playground/src/shell-host.ts` and `tests/e2e/harness/harness.ts`.

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

- Updated dependencies [d4e733e]
- Updated dependencies [239fa70]
- Updated dependencies [d885328]
- Updated dependencies [93224cd]
- Updated dependencies [8890904]
- Updated dependencies [b7032ab]
  - @kehto/acl@0.3.0

## 0.2.0

### Minor Changes

- 226cdca: NIP-5D 8-nap dispatch and shell-mediated signing. Runtime now uses `createDispatch()` + `registerNap()` from `@napplet/core` instead of a hand-rolled 8-case switch. All eight nap domains (identity, inc, keys, media, notify, relay, storage, theme) are registered through `registerNap()` adapters at runtime startup. The `signer` domain is deleted; `relay.publishEncrypted` is now the canonical NIP-44 path and synthesizes a `relay.publish` into the registered relay service after shell-side encryption. inc channel sub-protocol routed via per-runtime registry; `inc.subscribe` emits the canonical `subscribe.result` envelope. `theme` dispatch added with a fallback default theme envelope so napplets without a registered theme service still get spec-correct replies.

  **Breaking changes:**

  - Removed `case 'signer'` and all signer.\* dispatch paths
  - Removed the hand-rolled domain switch in `runtime.ts`; inbound routing delegates to `dispatch()`
  - `storage.clear` no longer dispatched (not in `@napplet/nap-storage`); internal cleanup helper retained for lifecycle use only

  **Peer deps:**

  - @napplet/core bumped from >=0.1.0 to ^0.2.0
  - Added @napplet/nap-identity, @napplet/nap-inc, @napplet/nap-keys, @napplet/nap-media, @napplet/nap-notify, @napplet/nap-relay, @napplet/nap-storage, @napplet/nap-theme (all ^0.2.0)

  **Known carry-over:**

  - `packages/runtime/src/core-compat.ts` is retained as a v1.2-deviation compat shim (DRIFT-CORE-06) to re-export legacy @napplet/core symbols (Capability, BusKind, ALL*CAPABILITIES, DESTRUCTIVE_KINDS, REPLAY_WINDOW_SECONDS, TOPICS.STATE*\*, AUTH_KIND, SHELL_BRIDGE_URI, PROTOCOL_VERSION, ServiceDescriptor) removed in @napplet/core v0.2.0. Slated for deletion once @napplet/core restores those exports or consumers migrate.

### Patch Changes

- 97b7bc8: v1.3 bug-fix rollup — no protocol changes. Fixes landed during the demo-rewire and napplet-migration phases:

  - **Session registry registration on napplet load.** `sessionRegistry.register()` is now invoked inside the loadNapplet path so `storage.*` / `notify.*` NAP handlers resolve napplet identity correctly in the demo shell host (Phase 19 fix).
  - **Identity error-path shim routing.** The napplet-shim central handler now forwards `identity.*.error` envelopes so denial paths propagate to the napplet SDK (Phase 21 fix).
  - **Documentation surface.** 8 runtime source files received `@example` JSDoc blocks on non-type factory exports (`createManifestCache`, `createReplayDetector`, `createEventBuffer`, `matchesFilter`, `matchesAnyFilter`, `handleStateRequest`, `handleStorageNap`, `cleanupNappState`) so the typedoc-generated API reference is complete.

  Behavioral fan-out of these fixes is proved green end-to-end by the Phase 18-21 Layer-A + Layer-B Playwright specs.

  Requirement IDs covered:

  - NAP-01, NAP-02 (bot + chat SDK migration consuming runtime routing)
  - NAP-03..09 (single-domain napplets exercising runtime dispatch)
  - E2E-07 (napplet-auth, inc-roundtrip, relay-publish, relay-publish-encrypted, relay-subscribe, identity-flow, storage-persist, notify-lifecycle, theme-broadcast specs)
  - E2E-09 (Layer-A nap-\* specs against the harness)
  - DOCS-01, DOCS-02 (typedoc + runtime README)

  No new public API. Compat re-exports under `packages/runtime/src/core-compat.ts` (DRIFT-CORE-06) unchanged; removal awaits @napplet/core upstream export restoration.

- Updated dependencies [226cdca]
- Updated dependencies [97b7bc8]
  - @kehto/acl@0.2.0
