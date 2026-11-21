# @kehto/paja

## 0.40.0

### Minor Changes

- 3181ac1: Static Paja can now use an optional resource proxy that you run yourself. Without one it reads resources directly and drops private destinations it can see in the URL. A proxy adds DNS-time private-IP checks, hop-by-hop redirect approval, and reads from hosts that don't send CORS headers. `kehto paja resource-proxy --allow-origin <origin> --port <port>` (or `startPajaResourceProxy`) starts a standalone NAP-RESOURCE proxy that reuses Paja's DNS-pinned transport, so the mandatory DNS-time private-IP checks from napplet/naps#80 @ ae5b9c6 still apply.

  - **What the proxy enforces:** the existing size and time caps, and handing each redirect hop back to the browser.
  - **Who can use it:** only allowlisted origins over CORS, including the preflight. It refuses to start without an allowlist.
  - **Pointing static Paja at it:** set `PAJA_RESOURCE_PROXY_URL` when building the Pages artifact (or pass `resourceProxyUrl` to `createPajaRuntimeHostConfig`), or enter the URL in the new **Resource proxy (optional)** sidebar field. Napplets can't set it.
  - **Browser behaviour:** it sends no cookies to a remote proxy, and it treats a 404 as `not-found` only when the proxy marks it as the upstream reply.
  - **New setting:** `server.resourceProxyPreflightMaxAgeSeconds` controls the preflight cache.

  An origin allowlist isn't authentication. Treat the proxy as an open fetch proxy limited to public addresses, and rate-limit it if you expose it.

### Patch Changes

- 3181ac1: Images load again in the static Paja build (`/web/paja/`). It used to send every `https` and `blossom` read to a `/__kehto/resource` server proxy that a static host doesn't have, so every image came back `not-found`. Without a proxy, static Paja now fetches resources directly from the browser, with no cookies and no referrer, and drops destinations it can tell are private from the URL. That covers `localhost`, `.local` and similar names, names without a dot, private or reserved IP literals, and redirects that end on one. Blossom bytes are still hash-checked. NAP-RESOURCE (napplet/naps#80 @ ae5b9c6) asks for DNS-time private-IP checks, which a browser can't make for its own fetches, so a public-looking name that resolves to a private address isn't caught. That is a recorded spec gap. The Paja server and its proxy now share one public-address check.

## 0.39.1

### Patch Changes

- 1624a3b: Paja no longer freezes when a napplet reads from hundreds of relays. The message log and the Events panel used to re-render for every message and every relay receipt. Each message-log render rebuilt up to 120 rows and forced a layout, and each Events render rebuilt every relay row and author chip. A feed following many authors produces thousands of those within seconds, and that froze the host for close to a minute. Logged data still updates immediately, but each panel now re-renders at most once per animation frame. On a synthetic load of 700 authors across 128 relays, half the notes now reach the napplet in 2.8 s instead of 26 s.

## 0.39.0

### Minor Changes

- 8095c0b: Paja can now find NAP-INTENT handlers that you haven't opened yet. When no installed app handles an invoke (for example Feed's `napplet:note/open`), Paja shows **No installed app opens this** instead of rejecting straight away. **Search for apps** asks your configured relays for manifests whose `i` tag is the exact convention, and it also looks up the request's `handlerHint` coordinate. The results are listed under **Not installed yet**. Picking one runs the ordinary verified pointer load, installs it, and delivers the intent. Nothing is searched until you click, and nothing is installed until you pick. Search results are never shown to napplets. A new **App handlers** sidebar section lists the installed handlers for each archetype, with **Make default**, **Forget default**, and **Uninstall**. The new `intent.discoveryLimit` setting (20 by default, 1–200) caps how many results are offered per search (kehto/web#523).

### Patch Changes

- Updated dependencies [8095c0b]
  - @kehto/services@0.36.0
  - @kehto/shell@0.36.0

## 0.38.0

### Minor Changes

- 5a5aefb: Bound NAP-CVM work per authenticated endpoint. `createCvmService` takes a new
  `concurrency: { maxInFlight, maxQueued }` option (defaults: 8 running, 32 queued
  per endpoint) covering `cvm.discover`, `cvm.request`, and `cvm.registry.*`.
  Queued time counts against the request deadline (`relay timeout`), work past
  both limits is refused with `policy denied`, and one endpoint's backlog never
  delays another's. Slots return on result, error, timeout, `cvm.close`,
  revocation, window destroy, and disposal.

  Behavior changes for `@kehto/services` hosts: `cvm.close` now completes that
  endpoint's pending and queued operations for the server with `session closed`
  before acknowledging; `cvm.request` validates `timeoutMs` before admission; the
  transport always receives the remaining `timeoutMs` and an abort signal; and a
  session is recorded when a request is handed to the transport, so failed
  requests no longer strand a transport session and relay hold.

  Paja reads the limits from `simulation.cvm.concurrency`.

- affae5e: Take the NAP-CVM registry types from `@napplet/core` 0.42.0 and retire Kehto's local copies (kehto/web#441). Checked against NAP-CVM PR #31 at `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f`.

  - `@kehto/services` re-exports `CvmRegistrySelector`, `CvmRegistryEntry`, `CvmRegistryTool` and `CvmRegistryCallOptions` from core under the same names, and adds `CvmRegistryOptions` and `CvmRegistryQuery`. `CvmRegistrySelector` is now core's union, so an empty `{}` selector no longer type-checks (the runtime already rejected it). `CvmRegistryFamily` stays Kehto's host configuration type.
  - `@kehto/mocks`: `MockCvmRegistryEntry` extends core's `CvmRegistryEntry`.
  - Breaking peer change: `@kehto/services`, `@kehto/mocks`, `@kehto/paja` and `@kehto/cli` now need `@napplet/core` `>=0.42.0 <0.43.0`. Install `@napplet/core@^0.42.0` (and `@napplet/nap@^0.41.0` if you want the matching bindings) when upgrading.
  - All host packages admit `@napplet/core` 0.42.x and `@napplet/nap` 0.41.x; `@kehto/acl`, `@kehto/firewall`, `@kehto/runtime` and `@kehto/shell` keep their existing floors.
  - The injected string-family adapter and its `KEHTO_CVM_FAMILY_SELECTOR` warning are unchanged. `@napplet/nap` 0.41.0 does not translate string-family calls, so napplets built against older bindings still rely on it.

- c1a0f12: Keep the shell URL away from napplets and close CSP-exempt resource hints (kehto/web#381).

  - `@kehto/shell` adds `denyNappletReferrer`, `renderNappletReferrerPolicyMeta`, `renderNappletHostBase`, `hasNappletReferrerPolicy` and `hasNappletReferrerPolicyMeta`. A `srcdoc` napplet otherwise reads the host URL from `document.referrer` and, query and fragment included, from `document.baseURI`. `ShellBridge.observeFrame` warns once when a frame has no `referrerpolicy="no-referrer"` or its host page has no referrer meta.
  - New opt-in experimental flag `resourceHintLock`: rejects `<link rel="dns-prefetch" | "preconnect" | "prerender">` on every string sink and attribute writer (browsers act on these outside the napplet CSP), with `assertNappletHasNoResourceHint` / `nappletMarkupHasResourceHint` for static markup. It shares the Trusted Types `default` policy with `nestedContextLock`.
  - `nestedContextLock` now removes `XSLTProcessor`, rejects namespace-prefixed frame tags and inspects `DOMParser.parseFromString` results; XSLT, prefixed XML and DTD-entity XML all minted child frames past the lock in Chromium, Firefox and WebKit, and the bridge revokes a locked napplet whose Window holds a child frame (new `NappletRevocationReason` `nested-context`; `observeFrame` takes `{ nestedContextLock }` for hosts that prepare the srcdoc themselves).
  - `@kehto/paja` sets the referrer meta, a `<base href="./">` and per-frame `referrerpolicy`, and applies the resource-hint lock whenever its nested-context lock resolves on, refusing napplets that ship a static hint link.

- c182b29: Add an OpenAI Responses dialect (`protocol: 'openai-responses'`, `POST <baseUrl>/responses`) to the HTTP LLM provider, with streaming, tool calls, reasoning summaries, an `openai-responses` preset and an opt-in `responses.profile: 'chatgpt-sign-in'` endpoint option for subscription-backed access tokens. The dialect is stateless (`store: false`, full history each turn). Paja accepts connections saved with the new protocol.
- dee1aeb: Report a pointer whose manifest is gone as "not found (N answered, M failed)" instead of a relay connection failure when some relays answered EOSE, with a new `PajaPointerNotFoundError`. For an addressable `nevent` whose event was replaced, Paja now offers the author's current `naddr` coordinates as a user choice (`findPajaPointerReplacements`); nothing loads until the user picks one, and that load is fully re-verified.
- 93fcaa4: Every Paja timeout, interval, cap and abuse bound is now a user-changeable default. A
  top-bar **Settings** dialog with one tab per group, generated from the new settings registry (the single file holding every default), edits them and
  persists overrides per host origin (`kehto:paja:settings.v1`). Config files accept a
  validated `settings` block: server-scope keys apply to the CLI/server process and
  browser-scope keys seed the host page. Bounds keep abuse guards on and security floors
  raise-only. New exports: `PAJA_SETTING_DEFINITIONS`, `getPajaSetting`,
  `setActivePajaSettings`, `normalizePajaSettings`, `normalizePajaConfigSettings`,
  `createPajaSettingsStore` and related types. The LLM vault now persists the iterations
  its unlocked key was derived with.
- ffa9726: Load a `--target-url` napplet that requires `resource` as a network-isolated snapshot instead of refusing it. The frame gets the fetched `index.html` under the closed CSP with no dev origin, so `window.napplet.resource` is exposed with direct network denied, as NAP-RESOURCE requires. The CLI, `GET /__kehto/target-network.json`, and the message log say which mode a target runs in and which references will not load. Adds `planTargetNetwork`, `findExternalAssetReferences`, `PAJA_TARGET_RESOURCE_HINT`, and `PajaServer.inspectTargetNetwork()`.
- 8d8c27c: Carry NAP-WEBRTC byte payloads. `createWebrtcService` gains a `sendBytes` hook that receives the decoded bytes; the service rejects non-canonical base64 with `invalid request`, answers `payload too large` above the session's `maxPayloadBytes` (now enforced for `webrtc.send` too, on the serialized payload), drops non-canonical peer `bytes` events, and still answers `unsupported` without the hook. `encodeWebrtcBytes` / `decodeWebrtcBytes` are exported. Paja's default WebRTC controller sends `sendBytes` as one binary data-channel message, delivers incoming binary as `bytes` events, and reports `maxPayloadBytes`; the `soy-rtc/1` multiplayer profile stays JSON-only. The conformance Kehto target now supports `sendBytes`, and the WebRTC fixture checks that non-canonical bytes are rejected.

### Patch Changes

- d9e4118: Make the Firewall's requirement and grant caps host policy (kehto/web#514).

  - `PermissionPolicyOptions` gains `maxRequirements` (default
    `MAX_PERMISSION_REQUIREMENTS`, 128) and `maxGrants` (default
    `MAX_PERMISSION_GRANTS`, 2048). `permissionLimits()` validates them against
    `MAX_PERMISSION_REQUIREMENTS_CEILING` (1024) and
    `MAX_PERMISSION_GRANTS_CEILING` (16384) and throws a `RangeError` otherwise.
  - `PermissionAdapter` accepts both; the approval coordinator validates them when
    it is built, and services see the first as
    `ServiceRuntimeContext.maxPermissionRequirements`.
  - `ApprovalFailure` gains `capacity`: a full grant table is reported as host
    capacity, not a denial. OUTBOX and runtime `relay.*` answer it with
    `approval capacity reached` (kehto/web#513).
  - OUTBOX plans and COUNT size themselves to the configured `maxRequirements`;
    `createRelayPoolOutboxRouter` takes `maxRelayOrigins` for its coverage selection.
  - Paja exposes `firewall.maxRequirements` (2–1024) and `firewall.maxGrants`
    (64–16384) in its Firewall settings group; they apply on reload.

- 63d0254: Keep the Firewall grant table bounded and fair (kehto/web#513). A default-rule `allow` no longer writes a session grant: the rule is consulted on every check, `RuntimePermissions.rulesChanged()` closes live work admitted under old rules, and `DEFAULT_RULE_GRANT_PREFIX` / `isRuleGrant` are deprecated. Each napplet holds at most `maxGrantsPerPrincipal` grants (default 512, new Paja setting `firewall.maxGrantsPerNapplet`), and `admitPermissionGrants` makes room by evicting the oldest session grants before refusing; persistent and once grants are never evicted.
- 8b72f3b: Stop assuming `crypto.randomUUID()` exists outside the shell's own call sites. Browsers omit it on non-localhost plain HTTP while still exposing `crypto.getRandomValues()`.

  - `@kehto/shell` exports `randomUUID`, the secure host UUID helper: native `crypto.randomUUID()` when present, otherwise a UUID v4 from 16 `crypto.getRandomValues()` bytes, and an explicit error when neither exists.
  - `@kehto/services` uses the same policy for default upload ids, browser media resource-read ids, and CVM registry JSON-RPC ids. The uncaught `crypto.randomUUID is not a function` is gone.
  - `@kehto/paja` uses the shell helper for frame-admission `instanceId`, intent-launcher window ids and correlations, and NIP-46 request ids.

  No wire change. `crypto.subtle` is still unavailable on non-localhost HTTP, so upload, CVM, and other digest paths do not start working there.

- 5146f60: Move the host line to `@napplet/core` 0.44.0 / `@napplet/nap` 0.43.0 (kehto/web#496). Checked NAP-MEDIA PR #10 at `7806f438530251fce5129f8e6239d6b642278759`, NAP-WEBRTC PR #59 at `fb4dd6f0e6294e1837733d2af61931e3e114bd97` and NAP-RESOURCE PR #80 at `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`.

  - All host packages admit `@napplet/core` up to 0.44.x and `@napplet/nap` up to 0.43.x, and develop and build on that line. Other peer floors are unchanged.
  - Breaking peer change for `@kehto/mocks`: it now needs `@napplet/core` `>=0.44.0 <0.45.0` and `@napplet/nap` `>=0.43.0 <0.44.0`. The NAP-WEBRTC mock uses the packaged `WebrtcSession` (delivery fields, `maxPayloadBytes`) and `WebrtcEvent` (`bytes`, `stats`) directly, and `MockMediaPlaybackState` is now the packaged `MediaState`, which carries `reason`.
  - `@kehto/shell`: the injected `window.napplet.webrtc` gains `sendBytes(sessionId, bytes)`, which sends `webrtc.sendBytes` and settles on `webrtc.sendBytes.result` (rejecting with the shell's error, such as `unsupported`). Before this, `@napplet/nap` 0.43's `webrtcSendBytes` hit a missing method. The deprecated positional `media.sendCommand(id, action, value, reason)` and `media.onCommand(id, (action, value, reason) => ...)` now carry `reason`, as nap 0.43 passes it; their `KEHTO-MEDIA-*` warnings are unchanged.
  - `@kehto/services`: the media and WebRTC handlers type `media.session.ended` and `webrtc.sendBytes` with the packaged messages. Wire behavior is unchanged; `webrtc.sendBytes` still answers `unsupported`.
  - `@kehto/conformance`: the operation inventory is regenerated from `@napplet/nap` 0.43.0, so `catalog/package-drift` passes for the pinned media and WebRTC drafts.

- 7d3f35d: Move the host line to `@napplet/core` 0.45.0 / `@napplet/nap` 0.45.0 (kehto/web#518). Checked NAP-CVM PR #31 at `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f`, NAP-INTENT at master `377bf939c6c906817084b43dd21d424de646dbc2`, NAP-RESOURCE PR #80 at `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc` and NAP-UPLOAD PR #33 at `f5cc981e527e2cc1572793a7a6e5082e5271ac49`.

  - All host packages admit `@napplet/core` and `@napplet/nap` up to 0.45.x, and develop and build on that line. No peer floor moves.
  - Breaking type change for `@kehto/services`: `CvmDiscoverResultMessage` is now a union of `CvmDiscoverSuccessResultMessage` (`servers` required) and `CvmDiscoverErrorResultMessage` (`error` only), both exported, matching NAP-CVM's Error Handling and nap 0.45. A value with both `servers` and `error` no longer type-checks. The wire is unchanged.
  - `@kehto/services`, `@kehto/runtime`, `@kehto/mocks`: `intent.available.result` and `intent.handlers.result` failures (invalid archetype, catalog unavailable, policy denial) now carry an empty `availability` (`available: false`, no candidates) or `handlers: []` beside `error`, as the NAP-INTENT wire table requires.
  - `@kehto/shell`: the injected `cvm.discover` rejects a success reply without a `servers` list (`cvm.discover.result missing servers`) instead of resolving `[]`.
  - `@kehto/conformance`: the inventory is regenerated from nap 0.45.0, which clears the CVM and INTENT rows of `catalog/package-field-drift`. `upload.upload.result` `result` is recorded as a NAP-UPLOAD table-versus-Error-Handling contradiction (napplet/naps#33) and reports `spec-gap`. `upload.info.result` / `upload.status.result` still fail as package drift.

- acdb7c5: Stop reporting relay failures as denials. Relays fail from time to time on
  Nostr, and NAP-OUTBOX has codes for that.

  - `@kehto/services`: an approved `outbox.subscribe`, `outbox.query`, or
    `outbox.getEvent` whose relay planning fails now answers
    `relay list unavailable` (or the network reason the router names) instead of
    `policy denied`, and asks for no approval. A transport throw inside an approved
    operation is a network reason too. `policy denied` is kept for an approval that
    did not execute, a revoked approval, a relay-gate refusal, and a router that
    cannot plan. A failing NIP-65 loader now falls back to `fallbackRelays` in
    `planRead`/`resolveRelays`/`planPublish` instead of rejecting. Planned reads
    settle once every relay sends EOSE, skip a relay whose subscribe throws, and
    mark partial results `incomplete: true` (`relay timeout` when none answers).
    Planned subscriptions keep running on the relays that attached. A publish no
    relay accepts is `relay timeout` instead of `publish denied`; a declined
    signer stays `publish denied`; an empty publish plan is
    `relay list unavailable`. A subscription cancelled after it opened is now
    released.
  - `@kehto/runtime`: a relay that throws while an approved `relay.*` operation
    runs reports `relay subscription failed` / `publish failed` /
    `relay query failed` instead of `relay authorization unavailable or denied`.
    A subscription that fails after it opened is now retired, so no late event
    or EOSE follows its `relay.closed`.
  - `@kehto/paja`: `publishToRelays` rejects with `publish denied` when the user
    declines, so a declined OUTBOX publish is no longer indistinguishable from a
    relay failure.
    Paja's message log now highlights every failed shell reply (`*.error`,
    results with `error` or `ok: false`, and `*.closed` with a `reason`), and
    badges a refusal as `denied` and anything else as `failed, not a denial`.

- 2d646ed: Keep large relay plans approvable within one Firewall request (kehto/web#455).
  An `outbox.subscribe` for a 709-follow timeline used to close with
  `policy denied` even under a default allow, because its plan named more relay
  origins than a request may carry.

  - `@kehto/firewall` exports `MAX_PERMISSION_REQUIREMENTS` (128), re-exported by
    `@kehto/runtime`. The cap itself is unchanged.
  - OUTBOX read plans contact at most 127 relay origins. The reference router
    picks a larger plan's relays by author coverage, deterministically and with
    napplet hints last, and the service bounds any router's plan before approval.
    Approval names each origin once. Unusable relay URLs are skipped instead of
    failing the plan, and a read that left an author without relays is
    `incomplete: true` (NAP-OUTBOX napplet/naps#32 at `8865f73d`).
  - An OUTBOX publish keeps every required own/inbox relay. When those cannot fit
    one approval it fails before signing with `too many relays`, never a denial;
    only explicit `options.relays` extras are trimmed.
  - Runtime `relay.*` approval names each origin once, and a host plan over the
    cap fails with `too many relays` instead of a denial. COUNT does the same with
    `too-expensive` (NAP-COUNT napplet/naps#69 at `9353a0c6`).
  - The browser approval prompt shows the origins of one mediated operation as a
    single "contact N origins" row listing the exact origins. Groups up to
    `openOriginLimit` (a new `createBrowserApprovalUi` option, default
    `DEFAULT_PROMPT_OPEN_ORIGINS` = 5) start open; Paja exposes it as the
    `firewall.promptOpenOrigins` setting.

- b796f2f: Signer connect, switch and disconnect no longer reload the napplet frame. Paja pushes NAP-IDENTITY `identity.changed` to loaded napplets (`pubkey: ""` when the identity is cleared), once per real pubkey change. A frame is reloaded only when the signer change adds a domain it declared (for example `webrtc`) or removes one it was admitted, since NIP-5D needs a fresh injection for that.
- 30a019c: An admitted frame Paja retires (revoked grant, tightened rule, closed tab, launch superseded by a reload) now goes through `ShellBridge.revokeNapplet(windowId, 'host')` instead of only unregistering its origin. The bridge drops the port binding, cached shell environment and nested-context lock for that window along with the runtime session, services get `onWindowDestroyed`, and the retire is logged as `paja.napplet.retired` so `paja.napplet.revoked` keeps meaning a revoke the shell found NIP-5D evidence for.
- 261eacf: Require destination operation authority before napplet-supplied relay hints open
  network connections. Runtime scoped subscriptions and its existing query hint
  extension now reject unapproved legacy hint execution, validate WebSocket URLs,
  and detach filters and destination plans before approval waits. Revocation and
  source replacement prevent stale subscription execution and delivery.

  Standalone OUTBOX requests with explicit relay hints now require a permission-enabled
  runtime and immutable planning. Its default router rejects unconfigured local/private
  destinations and malformed or credential-bearing URLs. Host-configured development
  relays remain supported. Paja rejects trailing-dot private hostnames too.
  Planned OUTBOX publishing carries its operation cancellation signal through
  signing and rechecks it before transport, preventing a revoked hinted fanout.
  It plans the complete own-outbox/inbox/hint union and preserves required targets
  in host-only metadata, so explicit hint success cannot mask a required inbox failure
  (reported as `relay timeout`, a relay outcome rather than a denial). Planned publishes
  now resolve `toInboxes` recipients into the approved destinations instead of
  publishing only to the signer's own relays.
  Custom planners must include required destinations for requested own/inbox fanout.

  Unhinted legacy host routing remains temporarily available with documented,
  bounded migration warnings. Relay network approval does not authorize NIP-42
  signing; hosts must keep automatic-authentication pools out of napplet-directed
  traffic.

  The retained noncanonical query relay field warns once per runtime on authorized
  use with `KEHTO_COMPAT_RELAY_QUERY_HINT`, naming scoped subscribe as its replacement.

- 9033fe8: Stop answering message types the owning NAP does not define. NIP-5D
  (nostr-protocol/nips#2303) says they "MUST be silently ignored", which also
  prevents capability probing.

  - `@kehto/services`: `notify`, `keys`, `serial`, `ble`, `common`, `lists` and
    `webrtc` no longer reply `<type>.error` / `Unknown <domain> method`. `notify`
    no longer sends `notify.controls` for an unknown type. A `webrtc.stats`
    request gets no reply, because NAP-WEBRTC defines `stats` only as a pushed
    event. `webrtc.sendBytes` still returns `unsupported`.
  - `@kehto/runtime`: `storage.clear` and other unknown `storage.*` types no
    longer get an error result, and an ACL or firewall denial of an unknown type
    sends nothing in any domain (only `cvm.*` was silent before). New
    `createUnrecognizedTypeDiagnostic()` warns the host once per domain/type as
    `[KEHTO_UNRECOGNIZED_MESSAGE_TYPE]`, at most 16 types per instance, without
    payloads.
  - `@kehto/paja`: the multiplayer `cvm` stub no longer answers unknown types
    with `unsupported`.

  Known types with malformed payloads keep their NAP's failure results.

- Updated dependencies [99353c6]
- Updated dependencies [63d0254]
- Updated dependencies [639f193]
- Updated dependencies [d9e4118]
- Updated dependencies [55f6633]
- Updated dependencies [707904c]
- Updated dependencies [5a5aefb]
- Updated dependencies [477f51d]
- Updated dependencies [b68a4bd]
- Updated dependencies [affae5e]
- Updated dependencies [ac84db4]
- Updated dependencies [985b474]
- Updated dependencies [63d0254]
- Updated dependencies [8b72f3b]
- Updated dependencies [54035cf]
- Updated dependencies [dccda68]
- Updated dependencies [91ca6af]
- Updated dependencies [73207d1]
- Updated dependencies [c45f223]
- Updated dependencies [7ab22de]
- Updated dependencies [0c5f6f8]
- Updated dependencies [8023fbe]
- Updated dependencies [5146f60]
- Updated dependencies [7d3f35d]
- Updated dependencies [c1a0f12]
- Updated dependencies [c182b29]
- Updated dependencies [acdb7c5]
- Updated dependencies [2d646ed]
- Updated dependencies [412aeb8]
- Updated dependencies [261eacf]
- Updated dependencies [76c4ae2]
- Updated dependencies [9033fe8]
- Updated dependencies [5999f03]
- Updated dependencies [4d8e1a8]
- Updated dependencies [1233911]
- Updated dependencies [8d8c27c]
  - @kehto/runtime@0.31.0
  - @kehto/services@0.35.0
  - @kehto/firewall@0.11.0
  - @kehto/acl@0.20.7
  - @kehto/shell@0.36.0
  - @kehto/nip@0.8.1

## 0.37.0

### Minor Changes

- cc8fcd7: Discover CVM providers from nevent references, tool schema hashes, and website discovery documents. Review source-labelled JSON and persist multiple local families alongside the configured registry.

## 0.36.0

### Minor Changes

- e989352: Add explicit multiplayer provider settings, isolated shared CVM/WebRTC transport keys, soy-rtc/1 signaling, and separately approved STUN/TURN endpoint scopes.

### Patch Changes

- e989352: Register newly available host services before reloading napplets after signer changes. WebRTC room requests now reach the handler when a signer is connected after Paja starts.
- Updated dependencies [e989352]
- Updated dependencies [e989352]
  - @kehto/firewall@0.10.0
  - @kehto/services@0.34.0
  - @kehto/shell@0.35.0
  - @kehto/runtime@0.30.1

## 0.35.3

### Patch Changes

- Updated dependencies [90d4703]
  - @kehto/services@0.33.0
  - @kehto/shell@0.34.0

## 0.35.2

### Patch Changes

- 071cef0: Remove obsolete NIP-07 extension relay discovery and its signer-lifecycle cache.
  Use host-configured bootstrap relays for contact, NIP-65 and Blossom discovery.
  Keep NAP identity.getRelays available with an empty map for unsupported external-user metadata rather than forwarding the obsolete extension hook.

## 0.35.1

### Patch Changes

- 226b4ad: Default Paja to no signer without prompting browser extensions. Remember explicit signer methods across reloads, provide a None disconnect control, and ignore stale connection results. Bunker credentials are never persisted.

## 0.35.0

### Minor Changes

- b573414: Stop the Paja Firewall from asking about every exact scope, and make its decisions readable.

  - **Paja** allows every interface and operation by default and asks before each `link.open`. The Firewall panel edits those default rules: change the default, or add an exception per interface or operation, for every napplet or one. Rules persist in the browser. An approved link opens from the approving click instead of raising a second confirmation, and a revoked single-target napplet starts again through admission instead of leaving an empty stage.
  - **Shell** rebuilds `createBrowserApprovalUi`. The prompt asks a plain-language question, lists each exact scope, preselects the narrowest lifetime so one click answers, counts queued requests, and can turn an answer into a standing rule. Grants are a compact tree of single-line rows (napplet, interface, grant) with status dots and icon buttons, expanding for identity and the full scope; scopes allowed by a rule collapse to one counted row. The prompt no longer has a Cancel button or a lifetime select; Escape still cancels. New `rules` and `onAnswer` options, `BrowserApprovalRules` type and `BROWSER_APPROVAL_UI_STYLES` stylesheet.
  - **Runtime** adds `PermissionAdapter.defaultDecision`, consulted before the prompt budget and the prompt. `allow` commits session grants whose ids start with `DEFAULT_RULE_GRANT_PREFIX`. Hosts that set no hook still ask for every scope.
  - **Firewall** adds the pure rule model: `createPermissionRules`, `resolvePermissionRule`, `setPermissionRule`, `permissionRuleSubject`, `serializePermissionRules`, `deserializePermissionRules`.

### Patch Changes

- e291825: Restore voluntary temporal protection with the independent `@kehto/rate-limit` package.
  Runtime no longer constructs operation or prompt limiters implicitly. Hosts opt in
  with `permissions.rateLimiter` and `permissions.promptRateLimiter`; Paja explicitly
  installs both. Limiter configuration is managed on the host-owned instance.

  Move the old behavioral Firewall APIs and runtime `createFirewallState` into the
  explicit `@kehto/rate-limit/legacy` migration subpath. Legacy hosts supply the
  constructed state through `legacyFirewall`; runtime `firewallState` and
  `firewallPersistence` are removed. Legacy allow policies no longer bypass installed
  temporal controls. Firewall now exports only scoped approval/access policy.

- 25311db: Keep Paja Firewall permission prompts visible when the development console or Firewall section is collapsed. Mount prompts separately from grant management so an invisible modal cannot block napplet admission and freeze the host. The shared browser approval UI accepts an optional prompt mount and removes both surfaces on teardown.
- Updated dependencies [b573414]
- Updated dependencies [e291825]
- Updated dependencies [25311db]
  - @kehto/firewall@0.9.0
  - @kehto/runtime@0.30.0
  - @kehto/shell@0.34.0
  - @kehto/rate-limit@0.2.0
  - @kehto/services@0.32.1

## 0.34.0

### Minor Changes

- 11ae71c: Adopt @napplet/core 0.41.x and @napplet/nap 0.40.x, which export the current NAP-INTENT no-ID, string-sender delivery. `@kehto/services` now re-exports its intent types from `@napplet/core` instead of keeping a local copy. Because core releases before 0.41.0 carry the withdrawn delivery ID and nullable sender, `@kehto/services`, `@kehto/paja` and `@kehto/cli` now require `@napplet/core` >=0.41.0. Other packages widen their peer windows to core <0.42.0 and nap <0.41.0 and move development builds and JSR maps to the new line. The shell's injected intent receiver now drops deliveries with an empty sender, matching the nap 0.40 binding.

### Patch Changes

- Updated dependencies [11ae71c]
  - @kehto/services@0.32.0
  - @kehto/shell@0.33.2
  - @kehto/acl@0.20.5
  - @kehto/firewall@0.8.2
  - @kehto/runtime@0.29.2

## 0.33.1

### Patch Changes

- f4e7e8a: Accept @napplet/core 0.40.x and @napplet/nap 0.39.x throughout the Paja host dependency graph and update host development dependencies and JSR maps to that line. Keep existing peer floors. Account for the newly packaged blossom, catalog, navigation, soulseek and torrent domains without advertising unimplemented host backends.
- Updated dependencies [f4e7e8a]
  - @kehto/acl@0.20.4
  - @kehto/firewall@0.8.1
  - @kehto/runtime@0.29.1
  - @kehto/services@0.31.1
  - @kehto/shell@0.33.1

## 0.33.0

### Minor Changes

- 249fe8c: Admit verified and development iframe bytes through shared Firewall approvals before execution. Add exact directive-scoped browser network decisions, a closed CSP, shared prompt and grant management, and source-bound retirement on revocation. Paja now rejects its ineffective firewall simulation mode and resolves development assets only through an approved origin.
- 249fe8c: Require scoped Firewall approval for mediated service operations, with immutable
  resource, device, file, and relay plans, source-owned cancellation, and revocation
  cleanup. Wire Paja's supported backends to the same operation contracts and
  remove the retired NAP-RESOURCE wire inputs.
- 249fe8c: Require shared Firewall approval before gamepad input and notification effects in permission-enabled runtimes. Bind Paja notification permissions to verified app identity, suppress late effects after revocation, and document the retained legacy notification paths.
- 249fe8c: Require relay operations to plan immutable destinations before approval and
  execute only those approved targets across runtime, reference services, shell,
  and Paja integrations.
- 249fe8c: Route resource fetches through a protected one-hop transport with public-address
  pinning, bounded bodies and deadlines, disconnect cancellation, and redirect
  metadata for per-destination authorization. Reject direct proxy access from
  untrusted frames before DNS or network activity.

  Authorize Paja BUD-03 discovery relay sockets individually, preserve NIP-65 author routing, and scope discovery caches to a live source-window generation so cancellation or source replacement cannot deliver stale server lists. Refresh signer-derived bootstrap relays at host signer lifecycle boundaries, then use that cache during resource requests instead of invoking external signer hooks.

- 249fe8c: Require prepared, signer-bound upload plans for runtime approval, authorize exact
  upload resources and selected network origins before signing or egress, and
  cancel progress on revocation. Paja prepares its Blossom destination before
  approval and the reference HTTP uploader rejects unapproved redirects.
  Window teardown invalidates all callbacks before cancellation and continues
  cleaning up sibling uploads when a backend cancellation throws.
- 249fe8c: Require runtime-approved WebRTC signaling plans, reject opaque peer factories,
  and fail closed for configured ICE/TURN endpoints until typed Firewall support exists.

### Patch Changes

- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
  - @kehto/firewall@0.8.0
  - @kehto/runtime@0.29.0
  - @kehto/shell@0.33.0
  - @kehto/services@0.31.0

## 0.32.1

### Patch Changes

- Updated dependencies [6eb1ea4]
- Updated dependencies [6eb1ea4]
- Updated dependencies [6eb1ea4]
- Updated dependencies [6eb1ea4]
  - @kehto/runtime@0.28.0
  - @kehto/shell@0.32.0
  - @kehto/firewall@0.7.0
  - @kehto/services@0.30.1

## 0.32.0

### Minor Changes

- 66beed4: Track NAP-LLM (napplet/naps PR #134 at `5e93bdfce0e84c0de728234cb7b3feed498f8635`) end to end. This is a breaking host API on the 0.x draft contract, with no compatibility path for the removed shapes.

  - Tool calls and results, `thinking` parts, `maxTokens`, `temperature`, `tools`, `toolChoice`, `Model.tools`, `Model.toolChoiceModes`, `Requirements.tools` and extended `Usage` are supported. Kehto validates and relays tool calls and never executes one.
  - `Generation.text` is replaced by `Generation.content` parts and text-only deltas by `start`/`delta`/`end` block events. The shell prelude forwards the full structured delta, and only for the next sequence with valid fields.
  - `@kehto/services`: `LlmConnection` gains required `tools` and `toolChoiceModes`; `LlmGenerateHooks.onDelta` and the `createHttpLlmProvider` callback take a block event while the service assigns `sequence` and `requestId`; `llm-types` re-exports the packaged `@napplet/nap/llm/types`. Provider endpoints accept `requiresOpaqueReasoning` (Gemini 3+ defaults it on), and the dialects map tools, reasoning and usage extras.
  - `@kehto/paja`: connections can opt into tool calling (rows saved earlier load as tools off under the same storage key), consent discloses tool definitions and tool results, and a dialect restriction answers `unsupported` before any prompt.
  - Host packages now build on `@napplet/core` 0.38.0 and `@napplet/nap` 0.37.0; `@kehto/services`, `@kehto/paja` and `@kehto/cli` (through its Paja dependency) require them.

### Patch Changes

- Updated dependencies [66beed4]
- Updated dependencies [66beed4]
  - @kehto/acl@0.20.3
  - @kehto/firewall@0.6.4
  - @kehto/runtime@0.27.3
  - @kehto/services@0.30.0
  - @kehto/shell@0.31.0

## 0.31.0

### Minor Changes

- 4d8a569: Add an experimental, opt-in lock that prevents a napplet from creating a nested
  browsing context (iframe/frame/object/embed/portal/fencedframe). Off by default,
  so downstream hosts are not forced into its opinions.

  Establishes a Kehto **experimental namespace** convention (see
  `docs/policies/EXPERIMENTAL.md`): opinionated host policies that are off by
  default, namespaced under an `experimental` options object, unstable (may change
  without a major bump), and distinct from the NAP `x-` extensions (which are
  experimental protocol domains). `NappletExperimentalOptions.nestedContextLock`
  is its first member.

  When a host sets `experimental: { nestedContextLock: true }` (on
  `prepareNappletSrcdoc` / `NappletSrcdocOptions`, or the Paja host config):

  - The verified napplet srcdoc CSP carries
    `require-trusted-types-for 'script'; trusted-types default`, and the prelude
    registers the single admitted `default` Trusted Types policy before any napplet
    script. It passes canonical HTML through and rejects any string carrying a
    frame tag, closing `innerHTML`, `DOMParser`, `document.write` and the other
    string sinks.
  - The prelude pins `Document.prototype.createElement` / `createElementNS` and
    `DOMImplementation.createDocument`, non-configurable, to reject frame tag
    names — the only element factories on the platform.
  - The new `assertNappletHasNoFrame` / `nappletMarkupHasFrame` reject a napplet
    whose own static markup declares a frame; `@kehto/paja` runs that scan on the
    verified runtime-pointer path, fail-closed.

  The lock is opinionated: it requires Trusted Types in the napplet CSP (so it is
  incompatible with frameworks that register their own Trusted Types policy, e.g.
  Angular) and a string sink carrying a literal frame-tag token is rejected even
  in text or an attribute. Canonical string-sink use is unaffected (the default
  policy passes non-frame HTML through). The contract change is tracked as
  `NIP5D_TRUSTED_TYPES_REQUIRED` in docs/compatibility.md and applies only to hosts
  that opt in. The new `nappletMarkupHasFrame` / `assertNappletHasNoFrame` exports
  and the `experimental` option are always available; nothing changes for existing
  hosts that do not set the flag.

### Patch Changes

- Updated dependencies [4d8a569]
  - @kehto/shell@0.30.0

## 0.30.0

### Minor Changes

- 37457ce: Add a loopback Routstr provider preset and a model dropdown for presets that
  list their models.

  `LLM_PROVIDER_PRESETS` gains `routstr` (`http://127.0.0.1:8008/v1`, OpenAI Chat
  Completions, no credential) plus an optional `modelsPath` field. Paja renders a
  model `<select>` instead of free-text entry for a preset that declares it,
  seeded from one `GET <baseUrl><modelsPath>` (`/models` for Routstr), and shows
  `Connected ✓ — n models` below the field. A failed listing names the cause —
  including a server that does not allow this page cross-origin — and falls back
  to free-text entry so the connection can still be saved. Editing the API base
  URL re-lists the models.

  The listing is a browser request like generation, so a loopback provider must
  answer CORS on that route; nothing else about the connection changes and the
  key is still placed only on requests to the connection's own base URL.

  Switching presets clears the unsaved API key before model discovery and updates
  auto-filled connection names without replacing custom names. Saving a connection
  keeps the model catalogue available for adding another connection.

  Failed Routstr model discovery offers an Install routstrd link to https://routstr.com/routstrd; retrying or switching providers clears the guidance.

### Patch Changes

- Updated dependencies [37457ce]
  - @kehto/services@0.29.0
  - @kehto/shell@0.29.0

## 0.29.0

### Minor Changes

- bfe51a1: Report "no relay connection" distinctly during pointer resolution. The resolver
  now tracks each relay's connection outcome (via the pool's idempotent
  `ensureRelay`) alongside the manifest query. When zero relays open a WebSocket
  it throws the new `PajaRelayUnreachableError` (`code: 'relay-unreachable'`,
  carrying a `PajaRelayConnectionSummary`) with an actionable message — offline,
  blocked relays, or the browser's WebSocket connection limit from too many open
  tabs — instead of a generic "timed out", even when the deadline expires first.
  Paja's pointer status shows that message and logs `paja.relay.unreachable` with
  per-relay detail. Timeouts with at least one connected relay now include the
  connected count; pools without `ensureRelay` keep the previous messages.

## 0.28.2

### Patch Changes

- e1e2b64: Lock napplet frames to their verified `srcdoc`. NIP-5D's replacement evidence (a second `load` or `napplet.hello`, the port closing) cannot see a napplet that navigates its frame before its own first `load`: only the replacement fires `load`, and browsers fire no MessagePort `close` event, so a `data:` or `blob:` document with script could run in the frame. `@kehto/shell` exports `NAPPLET_FRAME_POLICY` (`frame-src 'none'`), `renderNappletFramePolicyMeta()` and `hasNappletFramePolicy()`, and `ShellBridge.observeFrame` warns once when the host page lacks the policy. Browsers check every navigation of a child frame against the embedding page's `frame-src`, including one the frame starts itself, while an unfetched `srcdoc` still loads. The Paja host page now carries the policy, and Paja refuses to load a napplet on a host page without it.
- Updated dependencies [e1e2b64]
  - @kehto/shell@0.29.0

## 0.28.1

### Patch Changes

- Updated dependencies [9add95b]
  - @kehto/shell@0.28.0

## 0.28.0

### Minor Changes

- 902c1d0: Follow NIP-5D port-bound identity
  ([nostr-protocol/nips#2303](https://github.com/nostr-protocol/nips/pull/2303) at
  `51ef0cd`, packaged by napplet/web#302). This is a security fix: a `Window`
  survives same-frame navigation, so a napplet could previously replace itself
  with unverified content that kept its identity and grants.

  - `@kehto/shell`: the injected prelude opens a `MessageChannel` before napplet
    scripts run and hands one port to the shell in a single window-level
    `napplet.hello`. All NAP traffic then uses that port. `ShellBridge` binds the
    registered identity to the port, answers only over it, and revokes the
    binding, sessions and grants on a second hello, any other window-level
    message, an invalid hello, a second load (`observeFrame`) or the port closing.
    New APIs: `NAPPLET_HELLO`, `ShellBridge.observeFrame`, `ShellBridge.revokeNapplet`,
    `ShellAdapter.onNappletRevoked`, `ShellAdapter.onNappletMessage`,
    `originRegistry.bindPort` / `getPort` / `postToNapplet` / `getNappletTarget` /
    `isSpent`, and the `NappletRevocation`, `NappletRevocationReason` and
    `NappletMessageTarget` types.
    **Breaking:** window-level NAP envelopes are no longer processed and revoke
    the frame. `originRegistry.register` throws for a `Window` that already handed
    over its port, so create a fresh iframe for every navigation.
    `ProxyOriginRegistry` now requires `postToNapplet` instead of `getIframeWindow`,
    and `RelayPoolHooks.openScopedRelay` receives a `NappletMessageTarget` instead
    of a `Window`. Napplets on a Kehto host must not import `@napplet/shim`
    alongside the injected namespace, because it sends a second hello.
  - `@kehto/paja`: creates a fresh iframe for every navigation, watches for second
    loads, and removes or replaces revoked frames (logged as
    `paja.napplet.revoked`). It logs port traffic in both directions and tracks
    readiness from the port. Intent delivery and scoped relay traffic use the bound
    port. The signed intent launcher's two host messages are handled outside the
    bridge, and only while its port is bound.

### Patch Changes

- Updated dependencies [902c1d0]
- Updated dependencies [902c1d0]
  - @kehto/acl@0.20.2
  - @kehto/firewall@0.6.3
  - @kehto/runtime@0.27.2
  - @kehto/services@0.28.2
  - @kehto/shell@0.27.0

## 0.27.1

### Patch Changes

- 3620a13: Stop background social warming from running without a signer: Paja warmed the
  active account's contact list and every followed author's kind-0 profile through
  the outbox router, and with a fixed simulation identity configured that happened
  with no signer connected at all. The Events panel then filled `outbox relays
(NIP-65)` with other authors' relays, one kind-0 event each, as if outbox
  activity had been requested.

  Warming now follows `getConnectedAccountPubkey`, so it needs a connected
  NIP-07/NIP-46 pubkey or the Dev signer. A fixed simulation identity stays a
  read-only stand-in: it still answers `identity.getPublicKey`, and
  `identity.getFollows` still loads follows on demand. A signer dropping out also
  ends warming instead of falling back to the simulated identity.

  The Events panel now names the authors each box was routed for as short pubkey
  chips (full pubkey and read count in the tooltip). NIP-65 chips use the router's
  per-relay owners, including option-only author hints, rather than mistaking event
  filter authors for the owners of every selected relay. Host reads still name the
  authors their filters requested.

- Updated dependencies [3620a13]
  - @kehto/services@0.28.1

## 0.27.0

### Minor Changes

- 3089c5e: Harden the NAP-LLM service and add streaming providers (kehto/web#368, #369, #370):

  - `createLlmService` bounds live model handles per window with `maxHandlesPerWindow` (default 32). Selecting beyond the bound evicts the least recently used handle, which then answers `selection-expired`; a successful `describe` or generation refreshes a handle.
  - `LlmConnectionHost.select` and `authorize` receive an optional trailing `{ signal }` (`LlmPromptOptions`). It aborts when the request settles without the host's answer (cancel, deadline, handle invalidation or eviction, revocation, window destruction or unregistration), so hosts can close stale chooser and consent prompts. A pending selection answers `selection-expired` on invalidation and `cancelled` on revocation.
  - `buildLlmProviderRequest(endpoint, request, { stream: true })` and `createHttpLlmProvider({ stream: true })` use each dialect's server-sent-event form. The provider forwards text fragments through a new optional `onDelta` argument and resolves the same generation as the buffered path. `LlmFetch` responses may expose `body` and `headers` (`LlmFetchResponse`), and `readLlmSseData` / `createLlmStreamAccumulator` are exported for custom transports.
  - Paja streams provider output as `llm.delta`, and closes its chooser, consent and vault-unlock prompts when the request dies. `PajaConfirmationRequest` accepts an optional `signal` that withdraws a queued or open confirmation.

### Patch Changes

- Updated dependencies [3089c5e]
  - @kehto/services@0.28.0
  - @kehto/shell@0.26.1

## 0.26.1

### Patch Changes

- f5c3ee8: Widen the `@napplet/*` peer ranges so the `llm` domain installs without peer conflicts: `@napplet/core` now accepts `>=0.32.0 <0.37.0` and `@napplet/nap` accepts `>=0.32.0 <0.36.0`. The `llm` subpath first ships in `@napplet/nap@0.35.0`, and `@napplet/nap@0.35.1` requires `@napplet/core@^0.36.0`. The old `<0.35.0` cap made npm fail with ERESOLVE and made pnpm print unmet-peer warnings (kehto/web#364).
- Updated dependencies [f5c3ee8]
  - @kehto/acl@0.20.1
  - @kehto/firewall@0.6.2
  - @kehto/runtime@0.27.1
  - @kehto/services@0.27.1
  - @kehto/shell@0.26.1

## 0.26.0

### Minor Changes

- fcb5bc9: Add a Language models panel for draft NAP-LLM (napplet/naps PR #134 at `3e10939`): provider presets for the common hosted and local APIs, connection metadata in `localStorage`, API keys either session-only or encrypted with AES-GCM under a PBKDF2-SHA-256 vault password, a chooser for `llm.select`, a configure prompt when nothing compatible exists, and a disclosure consent dialog before every generation. Keys travel only to the connection's base URL. The Interfaces toggle gains a yellow `⚠` unconfigured state next to the existing enabled and disabled states.

### Patch Changes

- Updated dependencies [fcb5bc9]
- Updated dependencies [fcb5bc9]
- Updated dependencies [fcb5bc9]
- Updated dependencies [fcb5bc9]
  - @kehto/acl@0.20.0
  - @kehto/runtime@0.27.0
  - @kehto/services@0.27.0
  - @kehto/shell@0.26.0

## 0.25.1

### Patch Changes

- Updated dependencies [8c49071]
  - @kehto/nip@0.8.0

## 0.25.0

### Minor Changes

- d49b1bf: Add modal approval for all signing and publishing from one napplet version,
  bound to its manifest/artifact identity and signer account. Keep signing-only
  and publishing-only choices separate, retain older signing approvals without
  granting publication, and expose revocation. Development URL approvals now last
  only for their loaded session instead of trusting mutable code across reloads.
  Carry authenticated source context through Paja's publication backends and open
  NAP-LINK destinations directly from the modal approval click.

## 0.24.5

### Patch Changes

- a1a50d7: Implement NAP-MEDIA shell-owned audio/video and live MP3/AAC radio through host resource policy,
  with a shared player in Paja and the playground. Bind sessions to their endpoint,
  validate controls, retire output on destruction or revoked access, and retain
  terminal notifications in the protected injected API. Add canonical command-object
  callbacks and command/onEnded operations; retain warned legacy sendCommand and
  two-argument callbacks. Unary legacy callbacks must migrate to command objects.
  Use a playable one-second silent PCM clip when priming browser OS media controls.
- Updated dependencies [a1a50d7]
  - @kehto/services@0.26.0
  - @kehto/shell@0.25.0
  - @kehto/runtime@0.26.1

## 0.24.4

### Patch Changes

- b4c1b14: Make every verified tab's Share button open a dialog with a selectable app link,
  visible copy confirmation, and manual copying when clipboard access is blocked
  or unavailable. Keep intent-link creation limited to advertised contracts, and
  prevent dialog clicks from reaching the loaded apps underneath it.

## 0.24.3

### Patch Changes

- ff35f6d: Load NIP-5D root 15129 naddr coordinates without a d-tag filter, alongside named 35129 coordinates and exact nevent references for root, named and snapshot 5129 events. Keep distinct snapshots in separate tabs even when the author and artifact bytes match.

## 0.24.2

### Patch Changes

- 216b69d: Keep the toolbar and console expand button onscreen when restoring a collapsed
  console preference. The empty runtime remains usable after reloading without
  needing to discover a hidden hover strip; running napplets keep their state.

## 0.24.1

### Patch Changes

- 14b5dcd: Resolve the NIP-46 user pubkey with `get_public_key` after every successful
  `connect`, as required by NIP-46. Paja previously stored that acknowledgement as the
  connected account, so `identity.getPublicKey` returned `"ack"` and napplets saw
  a signed-in user without a valid 64-hex pubkey. Ownership-gated UI such as the
  View Problem editor's **Edit problem** button therefore stayed disabled even
  though the bunker could sign. Connect replies are never used as identity, even
  when they resemble a public key (for example a hex secret or signer transport
  key), and an invalid `get_public_key` response now fails the connection instead
  of being exposed as identity.

## 0.24.0

### Minor Changes

- bd95181: Notify open napplets of intent availability after verified catalog installs,
  replacements, removals, and default-handler updates. Failed invocations remain
  terminal; callers may retry after receiving `intent.changed`.

## 0.23.0

### Minor Changes

- ea5c039: Show connected controllers beside the console arrow with per-slot colors, numbers, model tooltips and distinct input animations. Respect reduced motion and ignore small stick drift.

### Patch Changes

- c04cb11: Use the active napplet tab name as the browser page title and restore the Paja title when the final tab closes.

## 0.22.0

### Minor Changes

- 0958a8b: Add a collapsible **Events** section to the Paja console below **Messages** that
  groups relay receipts by the routing box that chose the relays, then by relay,
  then by event kind. Boxes render in fixed routing precedence rather than by
  size, so they never reshuffle mid-session:

  - **outbox relays (NIP-65)** — relays resolved from the requested authors'
    NIP-65 write lists. A session that never used author routing renders
    `no author-routed reads` instead of a bare zero, because author-routed relays
    are discovered per read and cannot be listed from configuration.
  - **relay hints** — an outbox read the napplet pointed at relays itself with
    NAP-OUTBOX `relays` hints.
  - **fallback relays** — the host's configured fallback/bootstrap set. Reads can
    start while author discovery is pending and remain counted if NIP-65 relays
    resolve later. Authorless queries read this set alongside valid hints;
    authorless live subscriptions use it only when no valid hints remain. The box
    does not imply discovery failed. Configured relays are listed from boot, so
    idle relays read `unused` and relays that answered with nothing read `silent`.
  - **scoped relay** — a read the napplet pinned to one relay with NAP-RELAY
    `relay.subscribe`'s `relay` field, which the NAP calls a scoped relay rather
    than a hint.
  - **host pool** — Paja's own reads.

  A box is a routing decision, not a relay set: a relay read for two different
  reasons (for example a relay that is both an app hint and a configured fallback)
  now appears in both boxes with its receipt counts kept apart, instead of showing
  one merged count under two chips. Because exactly one box owns each receipt, box
  counts add up to the header total. Each relay row keeps its bar (scaled against
  the busiest relay of the session), receipt count, and `kind - count` rows.
  Counting happens in the relay backend before delivery, covering napplet
  subscriptions and Paja's background fetches, while simulated memory-mode
  fixtures and Paja's own publishes stay excluded. Receipts are cumulative for the
  host session; the header badge's tooltip separates them from unique events, and
  `__KEHTO_PAJA__.getState()` exposes the boxes and the configured relay
  inventory. Count verified, filter-matching receipts at each relay before
  deduplicating napplet delivery; repeated events count again without crediting
  silent relays or reusing earlier reads' provenance. Equivalent relay URL
  spellings share one panel row.

  Two additive, optional `@kehto/services` arguments make the routing boxes
  possible: `RelayPoolServiceOptions.subscribe` now receives a fourth `fromHint`
  argument so a host-backed relay service can distinguish a read pinned by an
  explicit relay hint from one using its own selected relay tier, and
  `OutboxRelayPool.subscribe` receives an `OutboxRelayOrigin` naming why the relays
  of that call are in the read. Existing implementations keep working unchanged.
  Authorless live reads retain their hint-or-fallback routing policy: valid hints
  do not add subscriptions on the configured fallback relays.

### Patch Changes

- 0958a8b: Hide the whole chrome with the collapsed Paja drawer: the bottom status bar
  disappears with the console column, and on hover-capable wide layouts the top bar
  parks off-screen and returns from a 6px strip at the viewport edge (or on
  keyboard focus). Touch and stacked layouts keep the top bar visible, since they
  have no hover to restore it and the drawer toggle lives inside it.
- 0958a8b: Add a `reset` button beside the Events section's receipt total that clears every
  per-reason, per-relay, and per-kind event count, along with the read and unique
  event tallies, so a session can start counting from scratch without a reload.
  Configured relays stay visible at zero exactly as they render at boot.
- 6693f5a: Show FS workspace and native picker support separately from ACL grants. Explain unsupported picker results when the browser lacks the required API, preserving working workspace storage and canonical NAP-FS responses.
- Updated dependencies [0958a8b]
  - @kehto/services@0.25.0
  - @kehto/shell@0.24.4

## 0.21.4

### Patch Changes

- Updated dependencies [5c3234e]
- Updated dependencies [960baba]
- Updated dependencies [ba9125b]
  - @kehto/runtime@0.26.0
  - @kehto/services@0.24.2
  - @kehto/shell@0.24.3

## 0.21.3

### Patch Changes

- 7d47c7f: Normalize internal Blossom references to blossom:<hash> while preserving existing
  read grammar, extensions, hints and integrity checks. Retain the sha256-prefixed
  input alias with one actionable warning per host module lifetime.

## 0.21.2

### Patch Changes

- Updated dependencies [47a34e3]
  - @kehto/runtime@0.25.0
  - @kehto/services@0.24.1
  - @kehto/shell@0.24.1

## 0.21.1

### Patch Changes

- 234a35c: Allow napplets with unavailable required domains to run in Paja with a warning. Unknown optional domains load quietly, so napplets can detect absent namespace objects and gracefully degrade.

## 0.21.0

### Minor Changes

- b89015f: Add host-owned NAP-GAMEPAD snapshots and browser focus/visibility hooks, deny native controller paths in Paja/playground frames, and expose the cached injected API. Bind trusted iframe sessions independently of optional SHELL readiness. Preserve the empty handshake-domain compatibility export and report unavailable native readers using the proposed NAP reasons. The optional native Gamepad API replacement awaits clarification of NIP-5D's namespace-only injection restriction. Publish CLI 0.5.5 before the coordinated napplet CLI release selects it as the private Paja runner.

  Accept both the maintained core/NAP 0.32 baseline and the coordinated 0.34 GAMEPAD package set. Existing package API behavior remains covered against both versions.

### Patch Changes

- Updated dependencies [b89015f]
  - @kehto/services@0.24.0
  - @kehto/shell@0.24.0
  - @kehto/runtime@0.24.1
  - @kehto/firewall@0.6.1
  - @kehto/acl@0.19.1

## 0.20.1

### Patch Changes

- 4b7bcb5: Open shared intent links directly in their verified app. Ask which named app to use when a link conflicts with a saved preference, and preserve that preference across one-time choices and reloads. Remove the recipient URI/payload review form and completed-delivery dialog.

## 0.20.0

### Minor Changes

- b462787: Add NAP-INTENT link creation, verified catalog dispatch, accepted-delivery lifecycle, and Paja review/launcher workflow.

### Patch Changes

- Updated dependencies [b462787]
  - @kehto/nip@0.7.0
  - @kehto/services@0.23.0
  - @kehto/shell@0.23.0

## 0.19.0

### Minor Changes

- 066524c: Add shell-owned NIP-5D CSP construction and verified-srcdoc preparation with validated host overrides. Paja and the playground use the shared preparation path. Hosts can customize source lists and grant exact connection origins while the shell rejects broad JavaScript evaluation, wildcard connections, unsupported meta directives, and policies that disable the mandatory bootstrap.

  Paja runtime configuration accepts CSP overrides. Its compatibility CSP helper now rejects invalid origin grants, and generated meta policies omit ineffective frame-ancestors and unsupported prefetch-src directives. Set frame-ancestors on the host HTTP response when required.

### Patch Changes

- Updated dependencies [066524c]
  - @kehto/shell@0.22.0

## 0.18.1

### Patch Changes

- abb9004: Accept Blossom resource URIs with optional safe extensions, repeated `xs` server and `as` author hints, and exact positive `sz` byte verification. Preserve extensions in blob GET paths without trusting them for MIME, and reuse bounded, source-window-aware discovery through existing BUD-03 lookups. Retain extensionless and mixed-case-hash reads for both `blossom:<hash>` and `blossom:sha256:<hash>`, with the existing public-HTTPS hint/configured-loopback policy, SHA-256 verification, byte caps, and cancellation. Upload descriptors are unchanged; this is local read compatibility, not full BUD-10 conformance.

## 0.18.0

### Minor Changes

- ece45ca: Keep verified-manifest requirement checks scoped to pointer targets so unsigned local HTML files load without a manifest, while retaining pre-execution identity registration and host capability policy.

  Paja runtime-pointer mode can open a napplet from a local single-file `index.html` through an "Open file…" picker or drag and drop. The file's identity comes from its bytes: the NIP-5A single-path aggregate, plus a `dTag` from `<meta name="napplet-id">` or `local-<file-stem>`. It loads through the same sandboxed `srcdoc`, CSP, and `window.napplet` prelude path as verified pointers. Local tabs are development-only. They never enter the installed catalog or receive intents, and they are not restored after a reload. New exports: `createPajaLocalTarget`, `isPajaLocalTarget`, `isPajaLocalHtmlFile`, `readNappletIdMeta`, `findRelativeAssetReferences`, `PAJA_LOCAL_SINGLE_FILE_HINT`, `PajaLocalTarget`, `PajaLocalFileInput`, and `PajaRuntimeTarget`.

### Patch Changes

- ece45ca: Add host-owned extra Blossom resource lookup servers with a newline sidebar setting, atomic origin validation, live all-tab updates, and origin-scoped persistence with truthful session-only fallback. Upload destinations, pointer loading, and napplet CSP remain unchanged.

  Make every development drawer section a flush independent native accordion with keyboard focus and state chevrons. Restore validated origin-local collapsed preferences separately from drawer visibility and resource settings, tolerate unavailable storage, and keep controls and running frames alive. Place Resource servers immediately before Messages, which is last in both modes.

## 0.17.2

### Patch Changes

- 5b3c709: Fix issue #279 by delivering capped, SHA-256-verified opaque Blossom resources
  as `application/octet-stream`. Preserve byte-sniffed MIME for recognized formats,
  reject active markup, and keep HTTP(S)/data resource policies unchanged.
- 62f1c6d: Resolve current NIP-5D single-artifact manifests while preserving legacy aggregate events through an isolated compatibility adapter. Normalize required and optional domains and independent intent advertisements without granting capabilities. Verify both formats before cache writes and iframe execution. Paja checks required domains before rendering and the shell accepts verified root/snapshot identities with an empty d-tag. Existing aggregateHash fields retain their names and carry the current artifact hash or original legacy aggregate.

  Intent catalog role maps also accept valid role names that coincide with JavaScript object prototype properties.

  Host intent catalogs check target intent availability and exclude nameless root/snapshot artifacts from dTag-based routing without preventing ordinary frame loading.

  Deliver intents through one intent.deliver envelope in Paja and playground, with a protected buffered onDelivery binding. Preserve legacy INC consumers through a local adapter that warns once per iframe, and track its removal criteria and regression coverage.

- Updated dependencies [62f1c6d]
- Updated dependencies [62f1c6d]
  - @kehto/nip@0.6.0
  - @kehto/shell@0.21.3
  - @kehto/services@0.22.1

## 0.17.1

### Patch Changes

- 1de4729: Foreground a reused intent handler tab and log intent eligibility.

  When an intent resolved to a handler napplet that already had an open tab, the
  intent was delivered over `postMessage` but the tab stayed in the background, so
  the result was invisible until the user switched tabs manually. The reuse path
  now calls `activateRuntimeTab()` before binding the generation, matching the
  new-tab path, so a delivered intent always selects the handler tab.

  `behavior.focus` is a hint, not a visibility switch: Paja's stage shows exactly
  one tab, so honoring `focus: false` as "keep the handler in the background"
  would report `handled: true` for a surface the user cannot see. Reuse still
  leaves the caller's tab open, so nothing is replaced. Newly created handler tabs
  behave the same way.

  The `paja.pointer.resolved` message-log entry also records each installed
  napplet's declared archetypes,
  `requires` tags, and whether it is intent-eligible, warning when a napplet
  declares archetypes without `["requires","inc"]`.

## 0.17.0

### Minor Changes

- bbbca64: Add a collapsible Paja development console. The left development column starts
  expanded and collapses to the left through one chevron button in the top bar;
  the same button restores it, and the choice is remembered per browser origin.
  Collapsing is CSS-only presentation, so the target iframe keeps its identity and
  the running napplet keeps its shell state while the stage reclaims the full
  width.

## 0.16.5

### Patch Changes

- Updated dependencies [11d9e90]
  - @kehto/services@0.22.0

## 0.16.4

### Patch Changes

- Updated dependencies [b16d64a]
- Updated dependencies [850563b]
  - @kehto/runtime@0.24.0
  - @kehto/services@0.21.2
  - @kehto/shell@0.21.2

## 0.16.3

### Patch Changes

- 7b2f482: Retain verified pointer-manifest Blossom servers as window-scoped resource fallbacks.

## 0.16.2

### Patch Changes

- bdd3a53: Classify checksum-valid Game Boy ROM resources from their canonical header bytes so verified Blossom ROM blobs reach napplets instead of failing MIME decoding.

## 0.16.1

### Patch Changes

- 2cd912d: Let Paja resolve OUTBOX-carried Blossom resources from event-local server hints, hinted authors' and the verified event publisher's BUD-03 lists, and the active shell user's published list before configured runtime fallbacks, independently of upload mode. Resource resolvers now receive the authenticated source window as private runtime context, and OUTBOX hosts can select a source-scoped router for every event-returning read.
- Updated dependencies [2cd912d]
  - @kehto/services@0.21.1

## 0.16.0

### Minor Changes

- 3231957: Adopt the NAP-RESOURCE Blossom server-hint contract across the injected shell API, reference service, and Paja runtime. Single requests now carry optional advisory servers, bulk requests use per-resource request objects, and Paja validates, caps, and tries accepted hints before host defaults.

### Patch Changes

- Updated dependencies [3231957]
  - @kehto/services@0.21.0
  - @kehto/shell@0.21.0
  - @kehto/runtime@0.23.0
  - @kehto/acl@0.19.0
  - @kehto/firewall@0.6.0

## 0.15.2

### Patch Changes

- e5ff746: Permit verified WebAssembly napplets to compile under Paja's runtime-pointer CSP while keeping JavaScript string evaluation blocked.

## 0.15.1

### Patch Changes

- d6a1ecd: Keep Paja ACL controls synchronized with the active resolver-verified napplet identity, and return denied outbox queries through the canonical `outbox.query.result` error shape.
- Updated dependencies [d6a1ecd]
  - @kehto/runtime@0.22.2

## 0.15.0

### Minor Changes

- c8264c6: Forward optional signer caller context through the policy-neutral runtime and
  shell hooks. Add Paja's signer-, napplet-, and target-scoped remembered signing
  choices: one event, one event kind, or warned napplet trust, with explicit
  revocation. Relay publication and host-internal signing confirmations remain
  independent.

### Patch Changes

- b2449e4: Keep NAP resource resolution runtime-owned: the service kernel delegates valid
  URLs by default while retaining optional origin-grant hooks, and Paja permits
  browser-readable HTTP(S) resources alongside data and configured Blossom URLs.
- Updated dependencies [c8264c6]
- Updated dependencies [b2449e4]
  - @kehto/runtime@0.22.1
  - @kehto/shell@0.20.1
  - @kehto/services@0.20.1

## 0.14.0

### Minor Changes

- 8e09918: Allow the static GitHub Pages Paja runtime to be built with explicit live relay and Blossom upload backends. `build-paja-pages.mjs` now honors comma-separated `PAJA_RELAY_URLS` and `PAJA_UPLOAD_SERVERS` environment variables, and `createPajaRuntimeHostConfig` accepts a `simulation` override. When neither env var is set, the static build keeps its previous defaults.

## 0.13.0

### Minor Changes

- 65c53be: Support canonical `blossom:sha256:<hex>` NAP-RESOURCE requests through Paja's host-configured Blossom servers with response caps, MIME sniffing, redirect refusal, and SHA-256 verification.

## 0.12.0

### Minor Changes

- d237979: Complete Paja's advertised NAP adapters with real host backends, including
  NIP-17 direct messages over live relays and an identity-scoped OPFS filesystem.
  Replace native confirmation prompts with serialized in-page consent and make
  notification, device, DM, and filesystem services fail closed when their host
  boundary is unavailable. NAP-DM error results now use the draft's exclusive
  error branch and no longer include legacy success fields such as empty page
  arrays or `ok: false`.

### Patch Changes

- Updated dependencies [d237979]
  - @kehto/services@0.20.0
  - @kehto/acl@0.18.0
  - @kehto/runtime@0.22.0
  - @kehto/shell@0.20.0

## 0.11.0

### Minor Changes

- a8cc3cf: Add Paja's incrementally warmed, active-account-scoped social cache behind standard identity and OUTBOX services, with request-scoped capability checks that prevent OUTBOX-only callers from observing private follow-derived cache entries.

### Patch Changes

- Updated dependencies [a8cc3cf]
  - @kehto/runtime@0.21.0
  - @kehto/services@0.19.0
  - @kehto/shell@0.19.2

## 0.10.0

### Minor Changes

- 9390eca: Move the public Kehto compatibility line to the current Napplet packages and
  align the host implementation with the merged NAP-INC and NAP-INTENT contracts.

### Patch Changes

- Updated dependencies [9390eca]
  - @kehto/acl@0.17.0
  - @kehto/firewall@0.5.0
  - @kehto/nip@0.5.0
  - @kehto/runtime@0.20.0
  - @kehto/services@0.18.0
  - @kehto/shell@0.19.0

## 0.9.0

### Minor Changes

- a1fa730: Route Paja theme updates through ThemeService state-before-single-push integration, preserving the protected recipient-authorized NAP-THEME change path defined by web draft `896c32c92deee68dc4d10fc1132b62df20cccb6f`.
- d8a57e2: Raise the published Napplet compatibility floor to core/nap 0.29.0. This is a
  breaking 0.x change: all affected packages now require the verified
  `>=0.29.0 <0.30.0` peer line. Services publish canonical intent ownership and
  retained acceptance-before-delivery behavior; Paja publishes the corresponding
  host flow. Shell is included because its published peer manifest changed while
  Kehto retains the host-owned mandatory NAP-SHELL prelude for the released
  core/shim omission; this changeset does not publish packages locally.
  Runtime and services also complete the NAP-RELAY publish boundary: the shell
  signs event templates, relay backends receive the signed event, and successful
  results return the full event through canonical `ok` / `event` / `eventId`
  fields. Async relay settlement now precedes success, rejected publishes never
  enter host caches, and failed pending replay reservations are released for
  deterministic retry while concurrent duplicates remain blocked. Paja likewise
  retains and fans out an event only after user authorization and, in live mode,
  at least one relay acknowledgement; its scoped-relay hook also preserves the
  asynchronous result and reports denial or transport failure as false.
  Shell keeps the merged NAP-INC `IncEvent` callback contract; package-based demo
  consumers bridge the released 0.29.0 `(payload, NostrEvent)` projection as
  documented upstream drift.

### Patch Changes

- Updated dependencies [7712950]
- Updated dependencies [7712950]
- Updated dependencies [7712950]
- Updated dependencies [7712950]
- Updated dependencies [a1fa730]
- Updated dependencies [a1fa730]
- Updated dependencies [a1fa730]
- Updated dependencies [a1fa730]
- Updated dependencies [d8a57e2]
  - @kehto/acl@0.16.0
  - @kehto/runtime@0.19.0
  - @kehto/services@0.17.0
  - @kehto/shell@0.18.0
  - @kehto/firewall@0.4.0

## 0.8.2

### Patch Changes

- d3d966a: Harden verified runtime-pointer `srcdoc` documents with Kehto's complete
  Class-1 CSP before the host-owned NIP-5D namespace prelude.
- 19e532a: Diagnose dev servers that block the sandboxed napplet frame. The target iframe is sandboxed without `allow-same-origin`, so the napplet requests its own module scripts with `Origin: null`, which Vite's default `server.cors` allowlist rejects — the frame rendered blank with no signal from Paja. Paja now probes the target through `GET /__kehto/target-cors.json` and reports a `paja.target.cors.error` message-log entry plus a console warning naming the fix. Adds `probeTargetCors`, `classifyTargetCors`, and `PAJA_TARGET_CORS_HINT` exports.
- Updated dependencies [418d22b]
  - @kehto/firewall@0.3.10

## 0.8.1

### Patch Changes

- 8ba8e30: Resolve runtime pointers against Paja's enabled configured live relays after embedded pointer hints, with one bounded deadline and distinct relay failure diagnostics.

## 0.8.0

### Minor Changes

- d4c7da3: Add an opt-in real Blossom upload mode to Paja with shell-owned server policy,
  signer identity checks, upload consent, cache-only BUD-03 discovery, and browser
  proof that the disclosed bytes reached the server. Harden the shared HTTP
  uploader so progress and cancellation are observable and Blossom completion
  requires exact server-confirmed hash and size metadata.

### Patch Changes

- Updated dependencies [bc53f2d]
- Updated dependencies [d4c7da3]
  - @kehto/services@0.16.5

## 0.7.1

### Patch Changes

- fd5faac: Inject mandatory NAP-SHELL across hosted iframe paths, complete its local handshake API, and require Paja readiness to come from `shell.ready`.
- Updated dependencies [fd5faac]
  - @kehto/shell@0.17.2

## 0.7.0

### Minor Changes

- 96130bc: Add static Paja runtime tab share links and restore pointer-loaded tabs across browser sessions.

## 0.6.8

### Patch Changes

- 708176b: Chase the published `@napplet/core` and `@napplet/nap` 0.28 line. Kehto package
  peer and JSR metadata now admit the current NAP contract, local demo napplets
  build against the refreshed Napplet toolchain, and `@kehto/services` implements
  the current NAP-OUTBOX publish fanout fields: `relays`, `toOutbox`, and required
  `toInboxes`. `@kehto/paja` also clears stale iframe ownership during target
  reloads so late messages from an old frame cannot mark the runtime ready before
  the reloaded target receives signer-backed identity.
- 784687c: Ignore stale single-frame iframe messages during reloads and make local server shutdown deterministic for browser tests.
- Updated dependencies [708176b]
  - @kehto/acl@0.15.6
  - @kehto/firewall@0.3.9
  - @kehto/runtime@0.18.5
  - @kehto/services@0.16.4
  - @kehto/shell@0.17.1

## 0.6.7

### Patch Changes

- 7118c31: Make the static Paja Runtime useful for loading multiple pointer-resolved
  napplets by adding closeable runtime tabs and a duplicate-load choice dialog.
  Paja now defaults to a real live relay/outbox backend, bootstraps NIP-65 relay
  lists and kind 3 contact lists for account-backed napplet tests, and only uses
  the generated development signer when explicitly selected.

## 0.6.6

### Patch Changes

- Updated dependencies [a6a0821]
  - @kehto/runtime@0.18.4
  - @kehto/services@0.16.3
  - @kehto/shell@0.17.0

## 0.6.5

### Patch Changes

- 3d14dd7: Improve JSR package scoring metadata by adding entrypoint module docs, public API docs, and explicit public export types without changing runtime behavior.
- Updated dependencies [3d14dd7]
  - @kehto/acl@0.15.5
  - @kehto/nip@0.4.2
  - @kehto/services@0.16.2
  - @kehto/shell@0.16.8
  - @kehto/wm@0.0.2

## 0.6.4

### Patch Changes

- 484630b: Render Paja target-url documents as injected srcdoc so local napplet previews receive runtime-owned window.napplet domains before app bootstrap.

## 0.6.3

### Patch Changes

- 0dbdfe2: Raise the supported `@napplet/core` and `@napplet/nap` peer range through the
  published `0.27.x` line and refresh local demo/fixture napplet package pins.
- Updated dependencies [0dbdfe2]
  - @kehto/acl@0.15.4
  - @kehto/firewall@0.3.8
  - @kehto/runtime@0.18.2
  - @kehto/services@0.16.1
  - @kehto/shell@0.16.4

## 0.6.2

### Patch Changes

- e8cedd0: Resolve Paja runtime pointers against the NIP-5D napplet manifest kinds `5129`, `15129`, and `35129` instead of accepting only the named/addressable manifest kind.
- Updated dependencies [449bede]
  - @kehto/services@0.16.0
  - @kehto/acl@0.15.3

## 0.6.1

### Patch Changes

- 89f4c11: Express peer and development dependency upper bounds with inclusive maximum ranges for clearer supported-version metadata, including the current Napplet 0.26 line.
- Updated dependencies [89f4c11]
  - @kehto/acl@0.15.2
  - @kehto/firewall@0.3.7
  - @kehto/nip@0.4.1
  - @kehto/runtime@0.18.1
  - @kehto/services@0.15.1
  - @kehto/shell@0.16.3

## 0.6.0

### Minor Changes

- 8aa2123: Align read-style NAP event surfaces with `RelayEventResult`.

  Relay and outbox read results now carry raw events as `{ event, sidecar? }`,
  with observed relay URLs in `sidecar.relayHints`. Outbox subscriptions no
  longer expose `outbox.eose`; streams continue until `outbox.close` or
  `outbox.closed`.

### Patch Changes

- Updated dependencies [8aa2123]
  - @kehto/runtime@0.18.0
  - @kehto/services@0.15.0
  - @kehto/shell@0.16.2

## 0.5.1

### Patch Changes

- Accept the released NAP-COUNT-capable `@napplet/core` and `@napplet/nap`
  `0.25.x` line in published package metadata.

  The NAP-COUNT implementation was versioned before the matching napplet package
  release landed, so this patch updates peer/dev ranges and local package graph
  guards without changing Kehto runtime behavior.

- Updated dependencies
  - @kehto/acl@0.15.1
  - @kehto/firewall@0.3.6
  - @kehto/runtime@0.17.1
  - @kehto/services@0.14.1
  - @kehto/shell@0.16.1

## 0.5.0

### Minor Changes

- 7293d4d: Add NAP-COUNT support for the draft `count.query` domain.

  Kehto now routes `count.query` through a registered runtime count service,
  advertises `window.napplet.count` only when that service is wired, exposes a
  reference `createCountService()` helper, and lets Paja answer exact counts from
  its memory relay fixture store without returning event payloads.

### Patch Changes

- Updated dependencies [7293d4d]
  - @kehto/acl@0.15.0
  - @kehto/runtime@0.17.0
  - @kehto/shell@0.16.0
  - @kehto/services@0.14.0

## 0.4.0

### Minor Changes

- feb3176: Add a static Paja Runtime build for browser testing napplets from naddr or nevent pointers without dev-server HMR.

## 0.3.7

### Patch Changes

- c777d32: Show Paja message error details inline and add NIP-07 plus bunker signer controls for local authoring.

## 0.3.6

### Patch Changes

- f3b2cb5: Update managed-command mode to follow local dev servers that bind a different port than the configured target URL.
- c27d886: Add Paja's development console with supported-interface toggles, ACL controls, signer status, filterable message logs, and confirmation-gated signing/publishing.

## 0.3.5

### Patch Changes

- 91a2c01: Accept `@napplet/core` and `@napplet/nap` 0.24.x peer dependencies across compatible Kehto packages.
- Updated dependencies [91a2c01]
  - @kehto/acl@0.14.2
  - @kehto/runtime@0.16.1
  - @kehto/shell@0.15.2
  - @kehto/services@0.13.2
  - @kehto/firewall@0.3.5

## 0.3.4

### Patch Changes

- 968b286: Run global binary symlinks as CLIs and print the Paja runtime URL before managed target readiness waits.

## 0.3.3

### Patch Changes

- a07f3cd: Add a NIP-5D injected-domain namespace prelude helper for srcdoc hosts and
  align napplet package peer ranges with the inject-compatible release line.
- Updated dependencies [cd6e971]
- Updated dependencies [a07f3cd]
  - @kehto/acl@0.14.0
  - @kehto/runtime@0.16.0
  - @kehto/shell@0.15.0
  - @kehto/services@0.13.0
  - @kehto/firewall@0.3.4

## 0.3.2

### Patch Changes

- Updated dependencies [4ab6f12]
  - @kehto/runtime@0.15.0
  - @kehto/services@0.12.3
  - @kehto/shell@0.14.2

## 0.3.1

### Patch Changes

- 2dfdebb: Align Napplet dependency ranges with the `resource.bytesMany` package release.
- Updated dependencies [2dfdebb]
  - @kehto/acl@0.13.1
  - @kehto/firewall@0.3.3
  - @kehto/runtime@0.14.1
  - @kehto/services@0.12.1
  - @kehto/shell@0.14.1

## 0.3.0

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
- Updated dependencies [7dbbdf8]
- Updated dependencies [7c7b019]
- Updated dependencies [4e0f4b9]
- Updated dependencies [4fd5e37]
- Updated dependencies [e1030d8]
- Updated dependencies [b37337b]
- Updated dependencies [272277a]
- Updated dependencies [cacab69]
  - @kehto/runtime@0.14.0
  - @kehto/services@0.12.0
  - @kehto/shell@0.14.0
  - @kehto/acl@0.13.0
  - @kehto/firewall@0.3.2

## 0.2.0

### Minor Changes

- 07a4733: Add the initial Paja single-window development runtime package and the top-level `kehto paja` CLI command with a typed option model, framework-agnostic target URL contract, real Kehto shell/service wiring, and configurable development environment simulation.

### Patch Changes

- Updated dependencies [0090b64]
- Updated dependencies [bdb15b6]
- Updated dependencies [07a4733]
  - @kehto/services@0.11.1
  - @kehto/nip@0.4.0
  - @kehto/shell@0.13.0
