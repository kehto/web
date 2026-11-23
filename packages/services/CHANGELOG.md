# @kehto/services

## 0.36.0

### Minor Changes

- 8095c0b: `createCatalogIntentResolver` takes a new optional `offerUninstalledHandlers(request, context)` hook. It runs only when no installed handler is compatible with an invoke and the request isn't for an explicit catalog `handler`. A host can use it to search for a handler, install one through its own verified load, and return the new catalog ID. The resolver delivers only if the reloaded, verified catalog entry supports the exact convention. `available()` and `handlers()` stay installed-only. If the offer is declined, finds nothing, or throws, the original `no handler` / `unsupported *` rejection is kept. This follows the MAY in NAP-INTENT's "Recommended handler resolution" on napplet/naps master @ 377bf939 (kehto/web#523).

## 0.35.1

### Patch Changes

- aaa7f41: Failed `upload.info` replies now carry the `info` the NAP-UPLOAD wire table requires. The runtime's policy denial (ACL and legacy Firewall) and `createUploadService`'s info-provider failure send `info: { rails: [] }` beside `error`, the fully redacted disclosure the NAP allows (napplet/naps#33 @ f5cc981e). Failed `upload.status` replies still send only `error`: a lookup that failed has no honest rail, state or timestamp, so that is recorded as a bounded spec gap instead of inventing a status (kehto/web#518).
- Updated dependencies [aaa7f41]
  - @kehto/runtime@0.31.1

## 0.35.0

### Minor Changes

- 707904c: NAP-CVM cancellation and server-request expiry (napplet/naps#31 at `28cf1bdb`):

  - A napplet's `notifications/cancelled` now names the request the transport
    actually sent. The service passes each napplet request's handle to
    `CvmTransport.request()` as `execution.handle` and hands a cancellation of an
    in-flight request to the new optional `CvmTransport.cancel()`.
    `createNostrCvmTransport` rewrites `params.requestId` to its correlation id,
    and publishes nothing once that request has settled. A transport without
    `cancel()` publishes the cancellation unchanged and warns once
    (`KEHTO_CVM_TRANSPORT_CANCEL`).
  - A cancellation of the napplet's own settled request is acknowledged without
    publication. One whose `requestId` names no request of that napplet in the
    session (or is missing) is now `invalid message` and never published.
  - Server requests delivered to a napplet expire after the new
    `serverRequestTimeoutMs` option (default 30000, an integer from 1 through
    300000, the NAP's Timeouts bounds); a later response is `invalid message`.
    Expired entries are pruned, so the correlation books stay bounded.
  - `@kehto/mocks`: the CVM mock applies the same cancellation check and the same
    server-request expiry (`serverRequestTimeoutMs`, on its scheduler). The
    `invalid message` for a cancellation naming another id is why this is minor.
  - `@kehto/conformance` adds `cvm/request-cancel-settled`, and its in-memory
    transport implements `cancel()`.

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

- b68a4bd: NAP-CVM: a napplet's `notifications/cancelled` now ends its own request in the
  shell (napplet/naps#31 at `28cf1bdb`):

  - A request still queued for admission or awaiting approval is dropped before
    publication. It never reaches the transport and its approval prompt is
    withdrawn. Before, the cancellation was lost and the request went out anyway.
  - A request already handed to the transport still gets the mapped cancellation
    through `CvmTransport.cancel()`, and is then settled locally. A late server
    answer is ignored.
  - The cancelled `cvm.request` settles with `session closed` before the
    cancellation is acknowledged. Before, it waited for the server's answer or
    `relay timeout`. NAP-CVM names no cancellation error; this is a documented
    spec-gap decision.
  - A cancellation no longer takes an admission slot, so a saturated endpoint can
    still cancel its own work.

- affae5e: Take the NAP-CVM registry types from `@napplet/core` 0.42.0 and retire Kehto's local copies (kehto/web#441). Checked against NAP-CVM PR #31 at `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f`.

  - `@kehto/services` re-exports `CvmRegistrySelector`, `CvmRegistryEntry`, `CvmRegistryTool` and `CvmRegistryCallOptions` from core under the same names, and adds `CvmRegistryOptions` and `CvmRegistryQuery`. `CvmRegistrySelector` is now core's union, so an empty `{}` selector no longer type-checks (the runtime already rejected it). `CvmRegistryFamily` stays Kehto's host configuration type.
  - `@kehto/mocks`: `MockCvmRegistryEntry` extends core's `CvmRegistryEntry`.
  - Breaking peer change: `@kehto/services`, `@kehto/mocks`, `@kehto/paja` and `@kehto/cli` now need `@napplet/core` `>=0.42.0 <0.43.0`. Install `@napplet/core@^0.42.0` (and `@napplet/nap@^0.41.0` if you want the matching bindings) when upgrading.
  - All host packages admit `@napplet/core` 0.42.x and `@napplet/nap` 0.41.x; `@kehto/acl`, `@kehto/firewall`, `@kehto/runtime` and `@kehto/shell` keep their existing floors.
  - The injected string-family adapter and its `KEHTO_CVM_FAMILY_SELECTOR` warning are unchanged. `@napplet/nap` 0.41.0 does not translate string-family calls, so napplets built against older bindings still rely on it.

- ac84db4: Close the remaining NAP-CVM `cvm.request` lifecycle gaps (napplet/naps#31 at
  `28cf1bdb`, Message handling and Errors):

  - Notifications and responses complete on publication with a result that has
    only `type` and `id`, and no MCP response is awaited. `CvmTransport` gains an
    optional `publish()` that sends the message as given, and
    `createNostrCvmTransport` implements it under the request deadline. A
    transport without `publish()` falls back to `request()` and warns once
    (`KEHTO_CVM_TRANSPORT_PUBLISH`).
  - A client request id already used in the session, and a response matching no
    server request delivered to that napplet, return `invalid message` before
    approval or publication.
  - A malformed `server` reference returns `invalid request` on `cvm.request` and
    `cvm.close`, instead of `server not found` and `session closed`.

  The injected `window.napplet.cvm.request()` in `@kehto/shell` resolves `null`
  for a notification or response instead of rejecting on the missing `message`.
  `@kehto/mocks` matches server-request ids by type as well as value, like the
  service. `@kehto/conformance` adds `cvm/semantics` cases for each rule,
  including a server-request push answered by a napplet response.

- 8023fbe: Answer ACL and legacy Firewall denials on each NAP's own failure wire instead
  of an invented `<type>.error`.

  - `cvm.discover`, `cvm.request`, `cvm.close` and each `cvm.registry.*` get the
    matching `.result` with `error: "policy denied"` and no success fields;
    denied unknown `cvm.*` types stay silent (NAP-CVM napplet/naps#31 at
    `28cf1bdb`).
  - `relay.publish`/`publishEncrypted` → `.result` with `ok: false`;
    `relay.query` → `.result` with `error`; `relay.subscribe` → `relay.closed`.
  - `outbox.getEvent`/`publish` → `.result`; `outbox.subscribe` →
    `outbox.closed`.
  - `upload.upload`, `notify.send`, every `dm.*` and `fs.*` request → `.result`
    with `error`; `count.query` → `ok: false, error: "policy-denied"`; a denied
    `notify.permission.request` → `granted: false`.
  - Requests whose NAP defines no reply (`relay.close`, `outbox.close`,
    `notify.dismiss`/`badge`/`channel.register`) are denied silently.

  Breaking for napplets or hosts that matched on these `.error` types.
  `@kehto/shell`'s injected client already accepts the `.result` form.

  `@kehto/services` (breaking): a failed `cvm.discover.result` no longer
  carries `servers: []` next to `error`, and `CvmDiscoverResultMessage.servers`
  is now optional, so code that reads `servers` unguarded must check for it.

- 7d3f35d: Move the host line to `@napplet/core` 0.45.0 / `@napplet/nap` 0.45.0 (kehto/web#518). Checked NAP-CVM PR #31 at `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f`, NAP-INTENT at master `377bf939c6c906817084b43dd21d424de646dbc2`, NAP-RESOURCE PR #80 at `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc` and NAP-UPLOAD PR #33 at `f5cc981e527e2cc1572793a7a6e5082e5271ac49`.

  - All host packages admit `@napplet/core` and `@napplet/nap` up to 0.45.x, and develop and build on that line. No peer floor moves.
  - Breaking type change for `@kehto/services`: `CvmDiscoverResultMessage` is now a union of `CvmDiscoverSuccessResultMessage` (`servers` required) and `CvmDiscoverErrorResultMessage` (`error` only), both exported, matching NAP-CVM's Error Handling and nap 0.45. A value with both `servers` and `error` no longer type-checks. The wire is unchanged.
  - `@kehto/services`, `@kehto/runtime`, `@kehto/mocks`: `intent.available.result` and `intent.handlers.result` failures (invalid archetype, catalog unavailable, policy denial) now carry an empty `availability` (`available: false`, no candidates) or `handlers: []` beside `error`, as the NAP-INTENT wire table requires.
  - `@kehto/shell`: the injected `cvm.discover` rejects a success reply without a `servers` list (`cvm.discover.result missing servers`) instead of resolving `[]`.
  - `@kehto/conformance`: the inventory is regenerated from nap 0.45.0, which clears the CVM and INTENT rows of `catalog/package-field-drift`. `upload.upload.result` `result` is recorded as a NAP-UPLOAD table-versus-Error-Handling contradiction (napplet/naps#33) and reports `spec-gap`. `upload.info.result` / `upload.status.result` still fail as package drift.

- c182b29: Add an OpenAI Responses dialect (`protocol: 'openai-responses'`, `POST <baseUrl>/responses`) to the HTTP LLM provider, with streaming, tool calls, reasoning summaries, an `openai-responses` preset and an opt-in `responses.profile: 'chatgpt-sign-in'` endpoint option for subscription-backed access tokens. The dialect is stateless (`store: false`, full history each turn). Paja accepts connections saved with the new protocol.
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

- 8d8c27c: Carry NAP-WEBRTC byte payloads. `createWebrtcService` gains a `sendBytes` hook that receives the decoded bytes; the service rejects non-canonical base64 with `invalid request`, answers `payload too large` above the session's `maxPayloadBytes` (now enforced for `webrtc.send` too, on the serialized payload), drops non-canonical peer `bytes` events, and still answers `unsupported` without the hook. `encodeWebrtcBytes` / `decodeWebrtcBytes` are exported. Paja's default WebRTC controller sends `sendBytes` as one binary data-channel message, delivers incoming binary as `bytes` events, and reports `maxPayloadBytes`; the `soy-rtc/1` multiplayer profile stays JSON-only. The conformance Kehto target now supports `sendBytes`, and the WebRTC fixture checks that non-canonical bytes are rejected.

### Patch Changes

- 63d0254: Report `capacity`, `busy` and `unavailable` approval outcomes as host conditions, not policy denials (kehto/web#513). CVM, OUTBOX, UPLOAD, WEBRTC, SERIAL, BLE, IDENTITY, THEME, COMMON, MEDIA, INTENT and NOTIFY use `approval capacity reached` / `approval busy` / `approval unavailable` (NOTIFY busy is `rate limited`); COUNT uses `count-unavailable`, DM `unavailable`, LISTS `list-unavailable`, FS `io-error`, GAMEPAD `unavailable`, and LINK keeps `status: "denied"` with the approval reason in `error`. Runtime `relay.*` reports `approval busy` and `approval unavailable` instead of `relay authorization unavailable or denied`.
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

- 55f6633: `createCountService` now reports a refused or withdrawn approval as `error: "policy-denied"`, the code NAP-COUNT lists, instead of `"policy denied"`. The runtime's own COUNT denial already used the hyphenated code, so napplets now see one code for both paths.
- 477f51d: `cvm.request` now validates its MCP `message` against the NAP-CVM form table
  (napplet/naps#31 @ 28cf1bdb) before admission. A missing message, a batch, an
  invalid id (`null`, boolean, fractional), an empty method, non-object params or
  an invalid field combination (both `result` and `error`, a response with
  `params`, neither `method` nor `id`, …) now returns `invalid message` instead of
  `unsupported method` or being published. Rejected messages are never authorized,
  admitted or handed to the transport. `CvmTransportError` gains `'invalid message'`.
- 8b72f3b: Stop assuming `crypto.randomUUID()` exists outside the shell's own call sites. Browsers omit it on non-localhost plain HTTP while still exposing `crypto.getRandomValues()`.

  - `@kehto/shell` exports `randomUUID`, the secure host UUID helper: native `crypto.randomUUID()` when present, otherwise a UUID v4 from 16 `crypto.getRandomValues()` bytes, and an explicit error when neither exists.
  - `@kehto/services` uses the same policy for default upload ids, browser media resource-read ids, and CVM registry JSON-RPC ids. The uncaught `crypto.randomUUID is not a function` is gone.
  - `@kehto/paja` uses the shell helper for frame-admission `instanceId`, intent-launcher window ids and correlations, and NIP-46 request ids.

  No wire change. `crypto.subtle` is still unavailable on non-localhost HTTP, so upload, CVM, and other digest paths do not start working there.

- 91ca6af: `keys.registerAction` now gets exactly one `keys.registerAction.result` when its
  approval doesn't execute (kehto/web#520), as NAP-KEYS (napplet/naps#9 at
  `8869a4cf`) requires. `denied`/`cancelled` reply `policy denied`;
  `capacity`/`busy`/`unavailable` reply `approval capacity reached`/`approval
busy`/`approval unavailable`. A request with no `action` now gets `invalid
action` with `actionId: ''` instead of throwing, and a destroyed window's
  pending approval stays silent.
- 0c5f6f8: Reject malformed NAP-LLM tool `parameters` with `invalid-request` for every keyword the JSON Schema draft 2020-12 meta-schema describes, not only `type`, `required`, `enum` and the common subschema keywords. Wrong-typed length, count and numeric bounds (including the draft 4 boolean `exclusiveMinimum`/`exclusiveMaximum`), repeated `required` or `type` entries, non-schema `dependentSchemas`, `unevaluatedProperties`, `unevaluatedItems`, `contentSchema` and `definitions`, and wrong-typed annotations and core keywords now fail before consent and before any provider call. Unknown keywords still pass, and no napplet-supplied pattern is compiled or run.
- 5146f60: Move the host line to `@napplet/core` 0.44.0 / `@napplet/nap` 0.43.0 (kehto/web#496). Checked NAP-MEDIA PR #10 at `7806f438530251fce5129f8e6239d6b642278759`, NAP-WEBRTC PR #59 at `fb4dd6f0e6294e1837733d2af61931e3e114bd97` and NAP-RESOURCE PR #80 at `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`.

  - All host packages admit `@napplet/core` up to 0.44.x and `@napplet/nap` up to 0.43.x, and develop and build on that line. Other peer floors are unchanged.
  - Breaking peer change for `@kehto/mocks`: it now needs `@napplet/core` `>=0.44.0 <0.45.0` and `@napplet/nap` `>=0.43.0 <0.44.0`. The NAP-WEBRTC mock uses the packaged `WebrtcSession` (delivery fields, `maxPayloadBytes`) and `WebrtcEvent` (`bytes`, `stats`) directly, and `MockMediaPlaybackState` is now the packaged `MediaState`, which carries `reason`.
  - `@kehto/shell`: the injected `window.napplet.webrtc` gains `sendBytes(sessionId, bytes)`, which sends `webrtc.sendBytes` and settles on `webrtc.sendBytes.result` (rejecting with the shell's error, such as `unsupported`). Before this, `@napplet/nap` 0.43's `webrtcSendBytes` hit a missing method. The deprecated positional `media.sendCommand(id, action, value, reason)` and `media.onCommand(id, (action, value, reason) => ...)` now carry `reason`, as nap 0.43 passes it; their `KEHTO-MEDIA-*` warnings are unchanged.
  - `@kehto/services`: the media and WebRTC handlers type `media.session.ended` and `webrtc.sendBytes` with the packaged messages. Wire behavior is unchanged; `webrtc.sendBytes` still answers `unsupported`.
  - `@kehto/conformance`: the operation inventory is regenerated from `@napplet/nap` 0.43.0, so `catalog/package-drift` passes for the pinned media and WebRTC drafts.

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

- 5999f03: `createWebrtcService` now forgets a session as soon as the backend's `closed`
  event for it is delivered (napplet/naps#59 at `fb4dd6f0`: the shell "MUST NOT
  deliver messages for an unknown sessionId"). Later events for it are dropped,
  and a later `webrtc.send` or `webrtc.close` gets `session not found` without
  reaching the host hooks. A `closed` reported while the open is still pending is
  delivered right after the open result, and that session is never kept. A
  failing close no longer brings back a session the backend closed in the
  meantime.
- 4d8e1a8: `createWebrtcService` no longer delivers `webrtc.event` for a session after the
  napplet sends `webrtc.close` (NAP-WEBRTC napplet/naps#59 @ fb4dd6f0: the shell
  "MUST NOT deliver messages for an unknown sessionId"). Close takes the session
  out of delivery before the host `close` hook runs, so teardown notifications
  and late peer messages, state changes and stats are dropped; a failed close
  keeps the session deliverable. `ctx.emit` also drops events for a sessionId the
  window never opened, except early `state` updates while its open is pending.
- 1233911: NAP-WEBRTC revocation and after-close answers (napplet/naps#59 at `fb4dd6f0`):

  - `createWebrtcService` now sends `closed` with reason `policy denied` for each
    live session when policy revokes WebRTC for a window (`onPermissionRevoked`,
    or an ACL block through `onCapabilityRevoked(windowId, null)`), then forgets
    the session. The draft lists "policy revokes the capability" among the
    `closed` triggers. Requests already in flight still get their result, and an
    open still waiting on approval gets `policy denied`. Window destroy stays
    silent.
  - `@kehto/mocks`: the WebRTC mock now answers `webrtc.send`, `webrtc.sendBytes`
    and `webrtc.close` on an ended session with `session not found`, like the
    service. Before, it answered `session closed` to a send and succeeded on a
    second close. This is a minor bump because tests asserting the old answers
    will need updating. The mock also handles `onPermissionRevoked`.
  - `@kehto/conformance` adds the `webrtc/event-closed-on-revoke` push and the
    `webrtc.revoke` host control.

- Updated dependencies [99353c6]
- Updated dependencies [63d0254]
- Updated dependencies [639f193]
- Updated dependencies [d9e4118]
- Updated dependencies [affae5e]
- Updated dependencies [985b474]
- Updated dependencies [63d0254]
- Updated dependencies [54035cf]
- Updated dependencies [dccda68]
- Updated dependencies [c45f223]
- Updated dependencies [8023fbe]
- Updated dependencies [5146f60]
- Updated dependencies [7d3f35d]
- Updated dependencies [acdb7c5]
- Updated dependencies [2d646ed]
- Updated dependencies [412aeb8]
- Updated dependencies [261eacf]
- Updated dependencies [9033fe8]
  - @kehto/runtime@0.31.0

## 0.34.0

### Minor Changes

- e989352: Expose CVM registry selectors in the injected namespace and allow hosts to configure provider families pinned to CEP-15 tool hashes. Verify live schemas before selecting or calling a provider and bound operations by their requested deadlines. Existing string-family API calls translate to canonical selectors with one migration warning per iframe.

### Patch Changes

- @kehto/runtime@0.30.1

## 0.33.0

### Minor Changes

- 90d4703: Bound CEP-22 reassembly by the request deadline (at most five minutes), keep
  deadlines fixed despite progress, and fail CEP-41 closes that still have chunk
  gaps. Generate correlation and ping nonce suffixes from random bytes instead of deriving keypairs. Document
  outbound oversized-request limits and host-owned concurrency admission.

  Requests no longer extend their timeout when progress arrives; callers must
  select a sufficient duration before starting an operation.

  Reject invalid timeout durations before acquiring sessions or publishing. Include
  initialization, shared-init waits and initialized-notification publication in the
  original request budget, preserving `relay timeout` on expiry.

## 0.32.1

### Patch Changes

- Updated dependencies [b573414]
- Updated dependencies [e291825]
  - @kehto/runtime@0.30.0

## 0.32.0

### Minor Changes

- 11ae71c: Adopt @napplet/core 0.41.x and @napplet/nap 0.40.x, which export the current NAP-INTENT no-ID, string-sender delivery. `@kehto/services` now re-exports its intent types from `@napplet/core` instead of keeping a local copy. Because core releases before 0.41.0 carry the withdrawn delivery ID and nullable sender, `@kehto/services`, `@kehto/paja` and `@kehto/cli` now require `@napplet/core` >=0.41.0. Other packages widen their peer windows to core <0.42.0 and nap <0.41.0 and move development builds and JSR maps to the new line. The shell's injected intent receiver now drops deliveries with an empty sender, matching the nap 0.40 binding.

### Patch Changes

- Updated dependencies [11ae71c]
  - @kehto/runtime@0.29.2

## 0.31.1

### Patch Changes

- f4e7e8a: Accept @napplet/core 0.40.x and @napplet/nap 0.39.x throughout the Paja host dependency graph and update host development dependencies and JSR maps to that line. Keep existing peer floors. Account for the newly packaged blossom, catalog, navigation, soulseek and torrent domains without advertising unimplemented host backends.
- Updated dependencies [f4e7e8a]
  - @kehto/runtime@0.29.1

## 0.31.0

### Minor Changes

- 249fe8c: Require scoped Firewall approval for mediated service operations, with immutable
  resource, device, file, and relay plans, source-owned cancellation, and revocation
  cleanup. Wire Paja's supported backends to the same operation contracts and
  remove the retired NAP-RESOURCE wire inputs.
- 249fe8c: Require shared Firewall approval before gamepad input and notification effects in permission-enabled runtimes. Bind Paja notification permissions to verified app identity, suppress late effects after revocation, and document the retained legacy notification paths.
- 249fe8c: Require relay operations to plan immutable destinations before approval and
  execute only those approved targets across runtime, reference services, shell,
  and Paja integrations.
- 249fe8c: Adopt the NAP-RESOURCE draft's canonical exact `url`/ordered `urls` requests and
  padded base64 result bytes. Resource authorization now covers the immutable
  resource URL plus every resolver-reported HTTP(S) or WebSocket destination, with cancellation,
  live revocation, and stale completion handling at the service boundary.
- 249fe8c: Integrate NAP-LINK with runtime-scoped interface and destination approvals, preserving canonical results and cancelling stale source work. Freeze trusted permission principals through shell source registration. Add live-source permission revocation handling, bounded replay protection, and a migration warning for host-only LINK openers. Unknown LINK actions are ignored and forbidden local/code schemes cannot be enabled by configuration.

  Authorize each resource URL and immediate HTTP(S) origin through shared runtime grants. Hold authorization through response body consumption, propagate request cancellation, retain bulk partial outcomes, and diagnose resolver-only compatibility use once per service instance.

- 249fe8c: Require prepared, signer-bound upload plans for runtime approval, authorize exact
  upload resources and selected network origins before signing or egress, and
  cancel progress on revocation. Paja prepares its Blossom destination before
  approval and the reference HTTP uploader rejects unapproved redirects.
  Window teardown invalidates all callbacks before cancellation and continues
  cleaning up sibling uploads when a backend cancellation throws.
- 249fe8c: Require runtime-approved WebRTC signaling plans, reject opaque peer factories,
  and fail closed for configured ICE/TURN endpoints until typed Firewall support exists.

### Patch Changes

- 249fe8c: Authorize immutable OUTBOX and COUNT relay plans before transport, signing, or
  fanout, and suppress work and results after source revocation.
- 249fe8c: Prevent resource fetches after cancellation during asynchronous metadata lookup.
  Capture bulk inputs, preserve cancellation ownership across duplicate IDs and
  source replacement, and cancel outstanding work when the service detaches.

  Require network approval for WebSocket resolver destinations and reject unsupported
  network schemes or embedded credentials before invoking transport callbacks.

  Retain the latest 1,024 completed resource IDs per source window to suppress
  repeated side effects and terminal responses, while preserving cancellation and
  clearing replay history on source destruction or service detachment.

- 249fe8c: Prevent duplicate `theme.changed` delivery when a host bridge owns theme broadcasts.
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
  - @kehto/runtime@0.29.0

## 0.30.1

### Patch Changes

- Updated dependencies [6eb1ea4]
- Updated dependencies [6eb1ea4]
  - @kehto/runtime@0.28.0

## 0.30.0

### Minor Changes

- 66beed4: Track NAP-LLM (napplet/naps PR #134 at `5e93bdfce0e84c0de728234cb7b3feed498f8635`) end to end. This is a breaking host API on the 0.x draft contract, with no compatibility path for the removed shapes.

  - Tool calls and results, `thinking` parts, `maxTokens`, `temperature`, `tools`, `toolChoice`, `Model.tools`, `Model.toolChoiceModes`, `Requirements.tools` and extended `Usage` are supported. Kehto validates and relays tool calls and never executes one.
  - `Generation.text` is replaced by `Generation.content` parts and text-only deltas by `start`/`delta`/`end` block events. The shell prelude forwards the full structured delta, and only for the next sequence with valid fields.
  - `@kehto/services`: `LlmConnection` gains required `tools` and `toolChoiceModes`; `LlmGenerateHooks.onDelta` and the `createHttpLlmProvider` callback take a block event while the service assigns `sequence` and `requestId`; `llm-types` re-exports the packaged `@napplet/nap/llm/types`. Provider endpoints accept `requiresOpaqueReasoning` (Gemini 3+ defaults it on), and the dialects map tools, reasoning and usage extras.
  - `@kehto/paja`: connections can opt into tool calling (rows saved earlier load as tools off under the same storage key), consent discloses tool definitions and tool results, and a dialect restriction answers `unsupported` before any prompt.
  - Host packages now build on `@napplet/core` 0.38.0 and `@napplet/nap` 0.37.0; `@kehto/services`, `@kehto/paja` and `@kehto/cli` (through its Paja dependency) require them.

### Patch Changes

- Updated dependencies [66beed4]
  - @kehto/runtime@0.27.3

## 0.29.0

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

## 0.28.2

### Patch Changes

- 902c1d0: Admit the NIP-5D port-bound napplet release lines in published peers:
  `@napplet/core >=0.32.0 <0.38.0` and `@napplet/nap >=0.32.0 <0.37.0`
  (core 0.37.0 / nap 0.36.0, napplet/web#302). Development stays on the 0.32.0
  baseline.
- Updated dependencies [902c1d0]
  - @kehto/runtime@0.27.2

## 0.28.1

### Patch Changes

- 3620a13: Pass routing-author provenance as the optional fifth argument to
  `OutboxRelayPool.subscribe`. NIP-65 reads name only the requested authors whose
  allowed write lists selected each relay, including authors supplied through query
  options. Hint and fallback reads name the requested routing authors; authorless
  reads explicitly carry an empty array. This host-only metadata leaves event
  filters, relay selection, and wire results unchanged. Existing pool adapters can
  continue to ignore the additional optional argument.

## 0.28.0

### Minor Changes

- 3089c5e: Harden the NAP-LLM service and add streaming providers (kehto/web#368, #369, #370):

  - `createLlmService` bounds live model handles per window with `maxHandlesPerWindow` (default 32). Selecting beyond the bound evicts the least recently used handle, which then answers `selection-expired`; a successful `describe` or generation refreshes a handle.
  - `LlmConnectionHost.select` and `authorize` receive an optional trailing `{ signal }` (`LlmPromptOptions`). It aborts when the request settles without the host's answer (cancel, deadline, handle invalidation or eviction, revocation, window destruction or unregistration), so hosts can close stale chooser and consent prompts. A pending selection answers `selection-expired` on invalidation and `cancelled` on revocation.
  - `buildLlmProviderRequest(endpoint, request, { stream: true })` and `createHttpLlmProvider({ stream: true })` use each dialect's server-sent-event form. The provider forwards text fragments through a new optional `onDelta` argument and resolves the same generation as the buffered path. `LlmFetch` responses may expose `body` and `headers` (`LlmFetchResponse`), and `readLlmSseData` / `createLlmStreamAccumulator` are exported for custom transports.
  - Paja streams provider output as `llm.delta`, and closes its chooser, consent and vault-unlock prompts when the request dies. `PajaConfirmationRequest` accepts an optional `signal` that withdraws a queued or open confirmation.

## 0.27.1

### Patch Changes

- f5c3ee8: Widen the `@napplet/*` peer ranges so the `llm` domain installs without peer conflicts: `@napplet/core` now accepts `>=0.32.0 <0.37.0` and `@napplet/nap` accepts `>=0.32.0 <0.36.0`. The `llm` subpath first ships in `@napplet/nap@0.35.0`, and `@napplet/nap@0.35.1` requires `@napplet/core@^0.36.0`. The old `<0.35.0` cap made npm fail with ERESOLVE and made pnpm print unmet-peer warnings (kehto/web#364).
- Updated dependencies [f5c3ee8]
  - @kehto/runtime@0.27.1

## 0.27.0

### Minor Changes

- fcb5bc9: Add the NAP-LLM reference service (napplet/naps PR #134 at `3e10939`): `createLlmService({ host })` with endpoint-scoped handles, schema and capability checks, consent before submission, duplicate-id rejection, cancellation and deadline races, ordered deltas and safe typed errors behind a `LlmConnectionHost` seam. Also exports the mirrored NAP-LLM types, `LlmServiceError`, pure request/response mappers for the OpenAI Chat Completions, Anthropic Messages and Google Gemini dialects, `createHttpLlmProvider()` and `LLM_PROVIDER_PRESETS`.

### Patch Changes

- Updated dependencies [fcb5bc9]
  - @kehto/runtime@0.27.0

## 0.26.0

### Minor Changes

- a1a50d7: Implement NAP-MEDIA shell-owned audio/video and live MP3/AAC radio through host resource policy,
  with a shared player in Paja and the playground. Bind sessions to their endpoint,
  validate controls, retire output on destruction or revoked access, and retain
  terminal notifications in the protected injected API. Add canonical command-object
  callbacks and command/onEnded operations; retain warned legacy sendCommand and
  two-argument callbacks. Unary legacy callbacks must migrate to command objects.
  Use a playable one-second silent PCM clip when priming browser OS media controls.

### Patch Changes

- Updated dependencies [a1a50d7]
  - @kehto/runtime@0.26.1

## 0.25.1

### Patch Changes

- 6670c6f: Scope upload teardown to the exact requesting window and invalidate callbacks
  before cancellation. Suppress late progress, results, and errors after window
  destruction or service removal, including when window/upload IDs are reused.

## 0.25.0

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

## 0.24.2

### Patch Changes

- Updated dependencies [5c3234e]
- Updated dependencies [960baba]
- Updated dependencies [ba9125b]
  - @kehto/runtime@0.26.0

## 0.24.1

### Patch Changes

- Updated dependencies [47a34e3]
  - @kehto/runtime@0.25.0

## 0.24.0

### Minor Changes

- b89015f: Add host-owned NAP-GAMEPAD snapshots and browser focus/visibility hooks, deny native controller paths in Paja/playground frames, and expose the cached injected API. Bind trusted iframe sessions independently of optional SHELL readiness. Preserve the empty handshake-domain compatibility export and report unavailable native readers using the proposed NAP reasons. The optional native Gamepad API replacement awaits clarification of NIP-5D's namespace-only injection restriction. Publish CLI 0.5.5 before the coordinated napplet CLI release selects it as the private Paja runner.

  Accept both the maintained core/NAP 0.32 baseline and the coordinated 0.34 GAMEPAD package set. Existing package API behavior remains covered against both versions.

### Patch Changes

- Updated dependencies [b89015f]
  - @kehto/runtime@0.24.1

## 0.23.0

### Minor Changes

- b462787: Add NAP-INTENT link creation, verified catalog dispatch, accepted-delivery lifecycle, and Paja review/launcher workflow.

## 0.22.1

### Patch Changes

- 62f1c6d: Resolve current NIP-5D single-artifact manifests while preserving legacy aggregate events through an isolated compatibility adapter. Normalize required and optional domains and independent intent advertisements without granting capabilities. Verify both formats before cache writes and iframe execution. Paja checks required domains before rendering and the shell accepts verified root/snapshot identities with an empty d-tag. Existing aggregateHash fields retain their names and carry the current artifact hash or original legacy aggregate.

  Intent catalog role maps also accept valid role names that coincide with JavaScript object prototype properties.

  Host intent catalogs check target intent availability and exclude nameless root/snapshot artifacts from dTag-based routing without preventing ordinary frame loading.

  Deliver intents through one intent.deliver envelope in Paja and playground, with a protected buffered onDelivery binding. Preserve legacy INC consumers through a local adapter that warns once per iframe, and track its removal criteria and regression coverage.

## 0.22.0

### Minor Changes

- 11d9e90: Add ContextVM CEP-22 oversized-transfer and CEP-41 open-stream framing to
  the Nostr CVM transport with strict admission and bounded reassembly:

  - progress frames are admitted only for progress tokens this client issued
    to the signing server; explicit caller tokens are bound on any MCP method
    and automatic injection covers `tools/call`
  - CEP-22 reassembly lives on its originating request: the full start shape
    (render completion mode, sha256 digest, totals) is required before
    buffering, declared chunk counts and an independent memory cap are
    enforced, transfer ranges must stay within safe integers, and exact byte
    length plus digest are verified on the joined payload
  - CEP-41 streams run a receiver state machine: start-gating, monotonic
    progress, contiguous chunk ordering with a bounded gap buffer, typed
    ping/pong keepalive with idle and probe timeouts, and terminal-state
    handling that ends the stream without ending request admission, so an
    oversized final response remains admissible after stream close
  - closing a server settles its in-flight requests and releases their token
    bindings, buffers, and stream state

## 0.21.2

### Patch Changes

- 850563b: Scope keys action registrations and bridge unsubscribe handles to their owning
  runtime window. Multiple windows may use the same app-local action ID without
  replacing or unregistering each other's bindings. Preserve same-window rebinding,
  original wire action IDs, and independent window destruction/reload in both
  document and hostBridge backends.
- Updated dependencies [b16d64a]
  - @kehto/runtime@0.24.0

## 0.21.1

### Patch Changes

- 2cd912d: Let Paja resolve OUTBOX-carried Blossom resources from event-local server hints, hinted authors' and the verified event publisher's BUD-03 lists, and the active shell user's published list before configured runtime fallbacks, independently of upload mode. Resource resolvers now receive the authenticated source window as private runtime context, and OUTBOX hosts can select a source-scoped router for every event-returning read.

## 0.21.0

### Minor Changes

- 3231957: Adopt the NAP-RESOURCE Blossom server-hint contract across the injected shell API, reference service, and Paja runtime. Single requests now carry optional advisory servers, bulk requests use per-resource request objects, and Paja validates, caps, and tries accepted hints before host defaults.

### Patch Changes

- Updated dependencies [3231957]
  - @kehto/runtime@0.23.0

## 0.20.1

### Patch Changes

- b2449e4: Keep NAP resource resolution runtime-owned: the service kernel delegates valid
  URLs by default while retaining optional origin-grant hooks, and Paja permits
  browser-readable HTTP(S) resources alongside data and configured Blossom URLs.
- Updated dependencies [c8264c6]
  - @kehto/runtime@0.22.1

## 0.20.0

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
  - @kehto/runtime@0.22.0

## 0.19.0

### Minor Changes

- a8cc3cf: Add Paja's incrementally warmed, active-account-scoped social cache behind standard identity and OUTBOX services, with request-scoped capability checks that prevent OUTBOX-only callers from observing private follow-derived cache entries.

### Patch Changes

- Updated dependencies [a8cc3cf]
  - @kehto/runtime@0.21.0

## 0.18.1

### Patch Changes

- 9d70803: Fix INC delivery retention and revocation cleanup, align INTENT resolution with the canonical contract, and reject invalid NIP-5D manifest identities.
- Updated dependencies [9d70803]
  - @kehto/runtime@0.20.1

## 0.18.0

### Minor Changes

- 9390eca: Move the public Kehto compatibility line to the current Napplet packages and
  align the host implementation with the merged NAP-INC and NAP-INTENT contracts.

### Patch Changes

- Updated dependencies [9390eca]
  - @kehto/runtime@0.20.0

## 0.17.0

### Minor Changes

- 7712950: Retire legacy `audio:*` and `notifications:*` INC compatibility surfaces under draft NAP-INC PR #89 (`4593ce9e301ce098fd3dad64206fcd6f144fa7af`) and web projection PR #90 (`896c32c92deee68dc4d10fc1132b62df20cccb6f`). Services now ignore opaque `inc.emit` traffic; canonical direct `notify.*` and `media.*` behavior remains available.
- a1fa730: Make reference identity and theme services match draft `896c32c92deee68dc4d10fc1132b62df20cccb6f`: public-key failures resolve once with `pubkey: ""`, supported reads retain safe result shapes, and ThemeService stores its complete fallback-normalized state before its one change callback.
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
- Updated dependencies [a1fa730]
- Updated dependencies [d8a57e2]
  - @kehto/runtime@0.19.0

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
