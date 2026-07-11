# @kehto/services

## 0.16.5

### Patch Changes

- bc53f2d: Start outbox reads before asynchronous NIP-65 discovery, add discovered relays to the same deduplicating collector, bound planning and collection with one deadline, and expose incremental query results through `queryStream()` while preserving `query()` aggregation.
- d4c7da3: Add an opt-in real Blossom upload mode to Paja with shell-owned server policy,
  signer identity checks, upload consent, cache-only BUD-03 discovery, and browser
  proof that the disclosed bytes reached the server. Harden the shared HTTP
  uploader so progress and cancellation are observable and Blossom completion
  requires exact server-confirmed hash and size metadata.
- [#173](https://github.com/kehto/web/pull/173): Ensure authorless outbox query relay
  hints augment the shell-owned fallback relay plan instead of replacing it.

## 0.16.4

### Patch Changes

- 708176b: Chase the published `@napplet/core` and `@napplet/nap` 0.28 line. Kehto package
  peer and JSR metadata now admit the current NAP contract, local demo napplets
  build against the refreshed Napplet toolchain, and `@kehto/services` implements
  the current NAP-OUTBOX publish fanout fields: `relays`, `toOutbox`, and required
  `toInboxes`. `@kehto/paja` also clears stale iframe ownership during target
  reloads so late messages from an old frame cannot mark the runtime ready before
  the reloaded target receives signer-backed identity.
- Updated dependencies [708176b]
  - @kehto/runtime@0.18.5

## 0.16.3

### Patch Changes

- a6a0821: Align NAP-KEYS forwarding and action bindings with the active `napplet/naps` draft: `keys.forward` remains napplet-to-shell only, bound keys are delivered through `keys.bindings` for local suppression, registration errors use `keys.registerAction.result`, reserved/default bindings are left unbound, and the non-conforming shell host-keydown forwarder export is removed.
- Updated dependencies [a6a0821]
  - @kehto/runtime@0.18.4

## 0.16.2

### Patch Changes

- 3d14dd7: Improve JSR package scoring metadata by adding entrypoint module docs, public API docs, and explicit public export types without changing runtime behavior.

## 0.16.1

### Patch Changes

- 0dbdfe2: Raise the supported `@napplet/core` and `@napplet/nap` peer range through the
  published `0.27.x` line and refresh local demo/fixture napplet package pins.
- Updated dependencies [0dbdfe2]
  - @kehto/runtime@0.18.2

## 0.16.0

### Minor Changes

- 449bede: Align NAP-OUTBOX with the current draft by removing caller-visible routing controls.

  `createOutboxService` and `createRelayPoolOutboxRouter` no longer expose or consume `OutboxStrategy`, `options.strategy`, or `options.live`. The service strips stale option fields at the envelope boundary, while the relay-pool router keeps outbox routing runtime-owned: reads use author write relays, directed publish fanout includes recipient read relays, and subscriptions remain open until `outbox.close` or `outbox.closed`.

  `resolveCapabilitiesNap` no longer treats `outbox.eose` as a valid shell-originated outbox push; relay EOSE stays internal to relay routing.

## 0.15.1

### Patch Changes

- 89f4c11: Express peer and development dependency upper bounds with inclusive maximum ranges for clearer supported-version metadata, including the current Napplet 0.26 line.
- Updated dependencies [89f4c11]
  - @kehto/runtime@0.18.1

## 0.15.0

### Minor Changes

- 8aa2123: Align read-style NAP event surfaces with `RelayEventResult`.

  Relay and outbox read results now carry raw events as `{ event, sidecar? }`,
  with observed relay URLs in `sidecar.relayHints`. Outbox subscriptions no
  longer expose `outbox.eose`; streams continue until `outbox.close` or
  `outbox.closed`.

### Patch Changes

- Updated dependencies [8aa2123]
  - @kehto/runtime@0.18.0

## 0.14.1

### Patch Changes

- Accept the released NAP-COUNT-capable `@napplet/core` and `@napplet/nap`
  `0.25.x` line in published package metadata.

  The NAP-COUNT implementation was versioned before the matching napplet package
  release landed, so this patch updates peer/dev ranges and local package graph
  guards without changing Kehto runtime behavior.

- Updated dependencies
  - @kehto/runtime@0.17.1

## 0.14.0

### Minor Changes

- 7293d4d: Add NAP-COUNT support for the draft `count.query` domain.

  Kehto now routes `count.query` through a registered runtime count service,
  advertises `window.napplet.count` only when that service is wired, exposes a
  reference `createCountService()` helper, and lets Paja answer exact counts from
  its memory relay fixture store without returning event payloads.

### Patch Changes

- Updated dependencies [7293d4d]
  - @kehto/runtime@0.17.0

## 0.13.2

### Patch Changes

- 91a2c01: Accept `@napplet/core` and `@napplet/nap` 0.24.x peer dependencies across compatible Kehto packages.
- Updated dependencies [91a2c01]
  - @kehto/runtime@0.16.1

## 0.13.1

### Patch Changes

- 0a0b61f: Add NAP-OUTBOX `outbox.getEvent` support for single-event outbox-aware relay lookups.
- 5415c74: Add NAP-RESOURCE `resource.info` support so shells can expose advisory resource schemes and coarse policy limits before napplets call `resource.bytes` or `resource.bytesMany`.
- 8b6f89e: Add NAP-UPLOAD `upload.info` support so shells can expose advisory upload rails and coarse policy limits before napplets call `upload.upload`.

## 0.13.0

### Minor Changes

- cd6e971: Add runtime-owned NAP-DM service support with ACL capability mapping, shell capability advertisement, and NIP-17/NDR/Cordn service adapters.

### Patch Changes

- a07f3cd: Add a NIP-5D injected-domain namespace prelude helper for srcdoc hosts and
  align napplet package peer ranges with the inject-compatible release line.
- Updated dependencies [cd6e971]
- Updated dependencies [a07f3cd]
  - @kehto/runtime@0.16.0

## 0.12.3

### Patch Changes

- Updated dependencies [4ab6f12]
  - @kehto/runtime@0.15.0

## 0.12.2

### Patch Changes

- dbd6810: Add `BleServiceContext.emit()` so `createBleService()` host hooks can forward NAP-BLE event notifications to the requesting napplet.

## 0.12.1

### Patch Changes

- 2dfdebb: Align Napplet dependency ranges with the `resource.bytesMany` package release.
- Updated dependencies [2dfdebb]
  - @kehto/runtime@0.14.1

## 0.12.0

### Minor Changes

- e1030d8: Add draft NAP-RESOURCE `resource.bytesMany` support. The resource service now accepts bulk byte requests, returns ordered per-URL result items, keeps per-URL failures local, and emits current `id`/`blob`/`mime` fields while preserving legacy single-fetch compatibility fields.
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
- Updated dependencies [7dbbdf8]
- Updated dependencies [7c7b019]
- Updated dependencies [4e0f4b9]
- Updated dependencies [4fd5e37]
- Updated dependencies [b37337b]
- Updated dependencies [272277a]
- Updated dependencies [cacab69]
  - @kehto/runtime@0.14.0

## 0.11.1

### Patch Changes

- 0090b64: Allow hosts to provide read-only identity data through `createIdentityService` hooks, including `getFollows`, without replacing the whole identity service.

## 0.11.0

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

### Patch Changes

- Updated dependencies [8ecfdd1]
- Updated dependencies [3a4d2cd]
- Updated dependencies [8ca8fc1]
- Updated dependencies [8c7a39f]
  - @kehto/runtime@0.13.0

## 0.10.2

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
  - @kehto/runtime@0.12.1

## 0.10.1

### Patch Changes

- Updated dependencies [ac0bf74]
  - @kehto/runtime@0.12.0

## 0.10.0

### Minor Changes

- dd65bec: feat(services): manifest → IntentCatalogEntry adapter for NAP-INTENT (ARCH-02 + ARCH-04)

  Adds `manifestToIntentCatalogEntry`, a pure adapter that maps a resolved
  NIP-5A/5D napplet manifest's archetype tags into an `IntentCatalogEntry` — the
  shape `createCatalogIntentResolver.loadCatalog` consumes. This sources NAP-INTENT
  availability and handler candidacy from verified manifests instead of
  host-injected catalog data.

  Each archetype `{ slug, nap }` becomes a keyed support record with `actions`
  defaulting to `['open']` (the NAP-INTENT default action) and `protocols` derived
  from the archetype tag's NAP-N (`[]` when absent).

  The adapter takes a minimal structural input (`ManifestArchetypeInput =
{ dTag, title?, archetypes: {slug, nap?}[] }`) so `@kehto/services` stays free of
  any `@kehto/nip` dependency — callers pass `resolved.manifest` directly by duck
  typing. An integration test wires manifest tag → adapter → resolver → service
  dispatch end-to-end (ARCH-04).

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
  - @kehto/runtime@0.11.0

## 0.9.1

### Patch Changes

- Updated dependencies [968e664]
  - @kehto/runtime@0.10.0

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

- Release the published NAP-MEDIA and NAP-IDENTITY alignment against `@napplet/nap@0.5.0`.

  The runtime package set now consumes the published NAP helper graph, carries owner-aware media session create/result shapes, validates shell-owned media source requests before returning the current unsupported-owner response, and exposes the identity snapshot-plus-`identity.changed` flow without requiring napplet polling.

### Patch Changes

- Updated dependencies
  - @kehto/runtime@0.4.0

## 0.3.1

### Patch Changes

- Align published package peers and source imports with `@napplet/nap@0.5.0`, the June 12 NAP helper release that carries the NAP-MEDIA and NAP-IDENTITY changes.
- Updated dependencies
  - @kehto/runtime@0.3.1

## 0.3.0

### Minor Changes

- 0fa11f1: NAP-CONFIG reference service (v1.7 Phase 39 / 9th NAP domain).

  New public surface: `createConfigService(options)`, `ConfigServiceOptions`, `ConfigService`, `ConfigSchemaValidation`.

  Shell-side reference implementation of the canonical `@napplet/nap/config` wire protocol (published at `^0.2.1`). Handles `config.get`, `config.subscribe` / `config.unsubscribe`, `config.registerSchema`, `config.openSettings`. Exposes `publishValues(values)` for live fan-out to subscribed napplets.

  Options-as-bridge pattern (v1.6 Decision 18): host apps provide `getValues` (required) and optional `registerSchema`, `openSettings`, `onSubscribe`, `onUnsubscribe` hooks.

  **Scope boundary (CONFIG-04):** NAP-CONFIG is shell-managed per-napplet configuration. Shell writes, napplet reads. There is NO `config.set` wire message — that is intentional. Do NOT use this service as a general key-value store; NAP-STORAGE (`state:read` / `state:write`) remains the general KV surface. See `packages/services/src/config-service.ts` top-of-file for the full anti-overlap documentation.

  Pairs with `@kehto/acl` `config:read` capability and `resolveCapabilitiesNap` `config.*` dispatch wiring (shipped in the same Phase 39 plan batch).

  Additive — no breaking changes. Minor bump because the public service surface expanded.

- 239fa70: Add NAP-RESOURCE reference service (10th NAP domain, v1.7 Phase 40).

  - `@kehto/services`: `createResourceService({ fetch, isOriginGranted, getConnectGrants, resolveIdentity })` factory. All four options required from day one — factory throws on construction if any is missing (H-03 prevention). Implements canonical 4-message protocol: `resource.bytes`, `resource.cancel` inbound; `resource.bytes.result`, `resource.bytes.error` outbound. Cancel correlates to in-flight requests via requestId.
  - `@kehto/acl`: new `'resource:fetch'` capability; `resolveCapabilitiesNap` extended with `resource.*` mapping (asymmetric: napplet requests get sender gate; shell pushes get recipient gate). `acl-state.ts` CAP_MAP extended with bit 15 for `resource:fetch`.
  - `@kehto/runtime`: `handleResourceMessage` dispatch + `napDispatch.registerNap('resource', ...)` wiring (Phase 39 Dev 1 lesson: missing registerNap silently drops all envelopes).
  - `@kehto/shell`: `CANONICAL_NAP_DOMAINS` extended with `config` and `resource`; provisional-resource wire types re-exported via barrel.

  No breaking changes. See docs/policies/SHELL-RESOURCE-POLICY.md (Phase 40 Plan 40-03) for host-fetch policy surface (redirects, MIME sniffing, private-IP blocking — host-app concerns).

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

- 8890904: Phase 45 (DECRYPT-02..05/07 / v1.8): extend `createIdentityService` with a host decrypt bridge and `verifyEvent` option, then handle `identity.decrypt` for NIP-04, NIP-44 direct, and NIP-17 gift-wrap events with the canonical 8-code error union.
- b7032ab: Phase 44 (DEP-01..02 / v1.8): bump `@napplet/core` and `@napplet/nap` peer deps `^0.2.1` → `^0.3.0`. Inline JSDoc reference updated to point at `internal-resource.ts` (was `provisional-resource.ts`). No behavioral change.

### Patch Changes

- 03c293c: Add `HostCacheBridge` as an additive type alias for `CacheServiceOptions` (kehto#1 naming parity with `HostKeysBridge` / `HostMediaBridge`). Pure alias — no runtime change, no breaking change. The existing `CacheServiceOptions` export remains the primary name; new consumers may prefer `HostCacheBridge` for cross-package consistency (M-02 prevention: do not rename or delete `CacheServiceOptions`).
- d885328: v1.16 structural cleanup and anti-slop pass.

  This release removes the remaining local `aislop` structural warnings through behavior-preserving refactors and comment/import cleanup. The affected public packages keep their existing runtime contracts; the bump is patch-level because the changes are internal decomposition, code-quality cleanup, and packaging hygiene rather than new public API.

  Highlights:

  - Runtime relay, identity, INC, and fallback domain handling were split into focused helpers.
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

- 226cdca: Reference services realigned to the 8-nap protocol. `signer-service` is deleted; its responsibilities are split into a new `identity-service` (read-only `getPublicKey` / `getRelays` / `getProfile` / `getFollows` / `getList` / `getZaps` / `getMutes` / `getBlocked` / `getBadges`) and shell-mediated signing/encryption inside `relay.publish` / `relay.publishEncrypted`. New reference handlers added for the other four new nap domains: `keys-service` (keyboard actions — bindings/register/forward), `media-service` (MediaSession create/update/destroy + controls), `notify-service` (send/permission/channel register/dismiss/badge), and `theme-service` (get/changed broadcast with `publishTheme`/`getCurrentTheme` host-facing bundle). Legacy `audio-service` and `notification-service` remain for inc-emit topics and coexist with the new NIP-5D envelope handlers.

  **Breaking changes:**

  - `signer-service` REMOVED. Napplets and hosts depending on `registerService('signer', ...)` must either register an `identity` service or remove the call; signing/encryption happens inside the shell via relay publishes.

  **Migration note:**

  - `tests/unit/shell-runtime-integration.test.ts` was removed in v1.2 — its v1.1 BusKind / signer.\* assertions no longer apply to the 8-nap protocol model. Equivalent coverage is provided by the per-package integration tests added in v1.2 Phases 12-03 (identity), 12-04 (inc), 12-08 (relay publishEncrypted), and 12-09 (storage).

  **Peer deps:**

  - @napplet/core bumped from >=0.1.0 to ^0.2.0
  - Added @napplet/nap-identity, @napplet/nap-inc, @napplet/nap-keys, @napplet/nap-media, @napplet/nap-notify, @napplet/nap-relay, @napplet/nap-storage, @napplet/nap-theme (all ^0.2.0)

### Patch Changes

- 41b12b9: v1.3 behavior-alignment rollup — no new services, no breaking changes:

  - **notification-service canonical `notify.*` handling.** The service now handles both canonical v1.2 NIP-5D `notify.create` / `notify.list` / `notify.read` / `notify.dismiss` envelopes AND the legacy `inc.emit` format for in-flight compatibility (Phase 17 + Phase 19 alignment). Registered under both `'notifications'` (topology key) and `'notify'` (runtime routing key) so the demo topology and the runtime dispatch both resolve correctly from a single handler instance (Phase 19 dual-register pattern).
  - **identity-service `getPublicKey` contract.** The service always returns a result envelope (with an empty pubkey when no signer is present) rather than throwing — matches the `identity.getPublicKey` "Always succeeds" contract. Enables the `profile-viewer` napplet to render a `no-pubkey` sentinel cleanly under the no-signer case (Phase 20).
  - **Documentation surface.** Canonical v1.2 `packages/services/README.md` groups factories by NIP-5D NAP domain with explicit capability-gate annotations (e.g., `createIdentityService` requires `identity:read` ACL entry).

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
