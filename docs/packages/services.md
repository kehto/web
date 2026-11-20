# @kehto/services

Relay reference services plan normalized URLs before runtime approval and execute
the supplied immutable plan. Custom registered relay services implement
`RelayPlanningServiceHandler`; selection belongs in planning, never in
`executeRelayOperation()`. Reference publish services require `publishToRelays`;
a generic publisher cannot enforce the approved destination list.

Standalone OUTBOX calls with nonempty `options.relays` require a permission-enabled
runtime and planned execution. The default router rejects unconfigured private
destinations. Planned publishing honors cancellation before and after signing.
The router also rejects
credentials, fragments and malformed WebSocket URLs; configured
development fallbacks remain host policy. DNS-time validation is the transport's
responsibility. See [relay destination policy](/firewall-approvals#relay-destination-policy).

Publish planning captures the complete own-outbox/inbox/hint union before
approval, including host-only `requiredRelays` metadata. Required recipient
fanout cannot be replaced by a successful hint; missing required-plan metadata
is rejected before authorization or signing.

Reference service handlers for Kehto runtime implementations.

WebRTC opening uses a side-effect-free signaling plan before runtime approval.
The reference handler requires separate `network` permissions with typed `ice`
scopes for each configured STUN/TURN endpoint. This does not constrain direct
iframe networking, which remains a launch-policy concern. Without a byte hook,
`webrtc.sendBytes` returns a correlated `unsupported` result, as NAP-WEBRTC
requires. A `webrtc.stats` request gets no reply: NAP-WEBRTC defines `stats`
only as a pushed event. `ctx.emit` delivers a `webrtc.event` only for a session
the window owns: from its `webrtc.open.result` until `webrtc.close` starts,
revocation or window destroy, plus early `state` events while the open is still
pending. Close removes the session from delivery before the host `close` hook
runs, so teardown notifications and late peer `message`, `peer`, `state` or
`stats` events for it are dropped (NAP-WEBRTC "MUST NOT deliver messages for an
unknown sessionId"). A failed close keeps the session deliverable, unless the
backend reported it `closed` meanwhile. When the backend ends a session itself
(peer gone, ICE failure, signaling or policy), the service forgets it as soon as
it delivers that `closed` event: nothing later is delivered, a later
`webrtc.send` or `webrtc.close` gets `session not found` without reaching the
host hooks, and the session map no longer grows over a long-lived window. A
`closed` reported while the open is still pending is delivered right after the
`webrtc.open.result`, and that session is never kept. A napplet-initiated
`webrtc.close` gets no `closed` event; the NAP only asks for one when a peer,
ICE, signaling or policy ends the session (spec-gap decision). When policy
revokes WebRTC for a window (`onPermissionRevoked`, or an ACL block through
`onCapabilityRevoked(windowId, null)`), each live session gets one `closed` with
reason `policy denied` and is then forgotten the same way; the host
`revokeWindow` hook runs after that, so its own teardown events are dropped.
Requests in flight at revocation still get their result (an open still waiting
on approval gets `policy denied`). Window destroy stays silent. The
`@kehto/mocks` WebRTC mock gives the same answers, held together by
`tests/unit/webrtc-session-lifecycle-parity.test.ts`.

OUTBOX and COUNT resolve relay destinations before approval. Their remote
backends receive the approved immutable URL list and cancellation signal; local
COUNT plans remain network-prompt-free and revoked sources cannot receive late
results. OUTBOX `getEvent` uses the same planned query boundary as `query`,
including author hints and request cancellation. A configured runtime fails
closed when a router lacks planning hooks; standalone legacy use warns once per
service instance with `FW-OUTBOX-LEGACY-001`. See [compatibility](/compatibility).

The reference LINK service integrates shared runtime approvals after URL
validation. A LINK grant never gives direct network access. Runtime cancellation
and source replacement prevent stale opens/results; repeated request IDs cannot
reopen a link. The temporary host-only opener path
emits `FW-LINK-LEGACY-001` once per instance. See
[the approval guide](/firewall-approvals) for its migration contract and the
remaining launch admission and host approval UI work.

> **Alpha status:** Kehto is an early runtime toolkit for a draft NIP-5D
> protocol. Service envelopes and NAP contracts are not final.


Every reference service drops a message whose type its NAP does not define,
with no reply, as NIP-5D requires. That includes a `webrtc.stats` request, which
NAP-WEBRTC defines only as a pushed event. The host gets one
`[KEHTO_UNRECOGNIZED_MESSAGE_TYPE]` warning per domain/type through
`createUnrecognizedTypeDiagnostic` from `@kehto/runtime`. A known type with a
bad payload still gets the domain's specified failure result.
## Install

```bash
pnpm add @kehto/services @kehto/runtime @napplet/core @napplet/nap
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/services/package.json`, `packages/services/src/index.ts` |
| Version | `0.34.0` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/runtime` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.42.0 <0.45.0` |
| `@napplet/nap` | `>=0.37.0 <0.44.0` |

## Primary APIs

| Area | Exports |
|------|---------|
| Direct-domain notifications | `createNotifyService`, `NotifyServiceOptions`, `NotifyPresentation`; legacy `createNotificationService`, `NotificationServiceOptions` |
| Identity | `createIdentityService`, `IdentityServiceOptions` |
| Relay/cache/count | `createRelayPoolService`, `RelayPoolServiceOptions`, `createCacheService`, `CacheServiceOptions`, `HostCacheBridge`, `createCoordinatedRelay`, `CoordinatedRelayOptions`, `createCountService`, `CountServiceOptions`, `CountRequest`, `CountResult` |
| Keys | `createKeysService`, `KeysServiceOptions`, `HostKeysBridge`, `HostKeyEvent` |
| Media | `createMediaService`, `createBrowserMediaBridge`, `MediaServiceOptions`, `HostMediaBridge`, `MediaAction` |
| Notify/theme/config/resource | `createNotifyService`, `NotifyServiceOptions`, `createThemeService`, `ThemeServiceOptions`, `ThemeService`, `createConfigService`, `ConfigServiceOptions`, `ConfigService`, `ConfigSchemaValidation`, `createResourceService`, `ResourceServiceOptions`, `ResourceFetchInit`, `AuthorizeNetwork`, `ResourceAuthorizationError`, `ResourceBytesRequest`, `ResourceInfo`, `ResourceService` |
| Outbox | `createOutboxService`, `OutboxServiceOptions`, `createRelayPoolOutboxRouter`, `OutboxRouter`, `StreamingOutboxRouter`, `OutboxQueryStream`, `OutboxQueryStreamSink` |
| Shell-mediated helpers | `createLinkService`, `LinkServiceOptions`, `LinkOpenContext`, `createCommonService`, `CommonServiceOptions`, `CommonServiceContext`, `createListsService`, `ListsServiceOptions`, `ListsServiceContext`, `createSerialService`, `SerialServiceOptions`, `SerialServiceContext`, `createBleService`, `BleServiceOptions`, `BleServiceContext`, `createWebrtcService`, `WebrtcServiceOptions`, `WebrtcServiceContext` |
| DM | `createDmService`, `createNip17DmAdapter`, `createNdrDmAdapter`, `createNdrRelayTransport`, `createCordnDmAdapter`, `createCordnRelayCoordinatorClient`, `DmServiceOptions`, `DmAdapter`, `DmRelayPool`, `Nip17DmAdapterOptions`, `NdrDmAdapterOptions`, `NdrRelayTransportOptions`, `CordnDmAdapterOptions`, `CordnRelayCoordinatorOptions` |
| FS | `createFsService`, `FsServiceError`, `FsServiceOptions`, `FsBackend`, `FsBackendWatch`, `FsBackendChange` |

## Scope Boundaries

`createCvmService` accepts optional `registry: CvmRegistryFamily[]`. The selector,
entry, tool and option types (`CvmRegistrySelector`, `CvmRegistryEntry`,
`CvmRegistryTool`, `CvmRegistryOptions`, `CvmRegistryCallOptions`,
`CvmRegistryQuery`) are re-exported from `@napplet/core` 0.42.0 or newer. Each entry
names an operator-selected provider and a family of tool name/hash pins. The
registry verifies live schemas with `computeCvmToolSchemaHash` (CEP-15) before
selection or invocation. A hash selector takes precedence over a family label;
provider pins are mandatory when supplied. Registry calls use ordinary CVM
authorization and one deadline across schema checks and invocation. No result
cache, provider retry or paginated tool inventory is supported. Without configured
families, `registry.has` returns false and other registry methods return
`unsupported method`. The injected namespace accepts canonical selectors and
warns once per iframe on old string-family calls; see the compatibility register.

### CVM admission

`createCvmService({ transport, concurrency })` bounds each authenticated endpoint
(runtime window id) separately, following the NAP-CVM
[draft #31](https://github.com/napplet/naps/blob/28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f/naps/NAP-CVM.md)
Security Considerations (shells SHOULD apply per-napplet concurrency limits).

| Option | Default | Meaning |
|--------|---------|---------|
| `concurrency.maxInFlight` | `8` (`DEFAULT_CVM_MAX_IN_FLIGHT`) | Operations one endpoint may have running. Integer >= 1. |
| `concurrency.maxQueued` | `32` (`DEFAULT_CVM_MAX_QUEUED`) | Operations one endpoint may have waiting, first in first out. Integer >= 0; `0` refuses instead of queueing. |

- One `cvm.discover`, `cvm.request`, or `cvm.registry.*` envelope holds one slot
  from receipt until it settles. A registry call keeps its single slot across its
  schema check and invocation. `cvm.close` is never queued or refused.
- The deadline starts at receipt. Queueing and approval spend the same budget, and
  the transport receives only the time left. A request that expires in the queue
  returns `relay timeout` and is never published. `cvm.request` now validates
  `timeoutMs` (integer 1..300,000, default 30,000) before admission.
- `cvm.request` validates its MCP `message` against the NAP-CVM form table before
  admission: a request (`method` + `id`), a notification (`method`, no `id`) or a
  response (`id` + exactly one of `result`/`error`, no `method`/`params`), with a
  string or integer `id` and object `params`/`result`/`error`. Anything else (a
  missing message, a batch, `id: null`, both `result` and `error`, …) returns
  `invalid message` and is never authorized, admitted or published.
- Notifications and responses complete on publication: the result has only
  `type` and `id`, with no `message`, and no MCP response is awaited. They go
  through the new optional `CvmTransport.publish()`, which sends the message as
  given (no id added to a notification, a response keeps the napplet's id).
  `createNostrCvmTransport` implements it under the same deadline. A transport
  without `publish()` falls back to `request()` and warns once
  (`KEHTO_CVM_TRANSPORT_PUBLISH`, see `docs/compatibility.md`). The injected
  `window.napplet.cvm.request()` from `@kehto/shell` resolves `null` for these,
  as the NAP's API column says; a request still resolves with its MCP response.
- MCP ids are tracked per endpoint, server and direction, typed (`1` is not
  `"1"`). A client request id already used in the session, and a response that
  matches no server request delivered to that napplet (or one already answered),
  return `invalid message` at receipt, before approval or publication. A request
  rejected before admission (for example `invalid timeout`) does not use up its
  id. `cvm.close`, revocation and window destroy clear the books; shell-owned
  registry and initialization ids never enter them.
- A server request delivered to a napplet stays answerable for
  `serverRequestTimeoutMs` (default `30000`; an integer from 1 through 300,000,
  the NAP's Timeouts bounds, otherwise `createCvmService` throws a
  `RangeError`). NAP-CVM: server requests "still require a response or expire
  under session policy". After that a response to it is unmatched and gets
  `invalid message`. Expired entries are dropped whenever the session's books
  are touched, so a napplet that never answers can't grow them. The deadline
  bounds how long an entry lives, not how many a busy server can deliver within
  it.
- `notifications/cancelled` "may refer only to this napplet's requests". Its
  `params.requestId` must name a request this napplet sent in the session:
  - one still queued for admission or awaiting approval is dropped before
    publication: it never reaches the transport, its approval prompt is
    withdrawn and no approval is asked for the cancellation;
  - one already handed to the transport goes to the optional
    `CvmTransport.cancel()` with that request's handle (passed to `request()`
    as `execution.handle`). `createNostrCvmTransport` rewrites `requestId` to
    the correlation id it actually sent, keeping the rest of the message, and
    publishes nothing if the request settled meanwhile or was not sent yet;
  - one that already settled, or is already being cancelled, is acknowledged
    (only `type` and `id`) under the same policy as any `cvm.request` to that
    server, and not published;
  - any other `requestId`, or none, is `invalid message` and never published
    (spec-gap decision: the NAP names the restriction but no error for it).

  Once a cancellation is dropped locally or published, the napplet's own
  `cvm.request` settles with `session closed` before the cancellation is
  acknowledged, and a late server answer is ignored (MCP: the sender "SHOULD
  ignore any response to the request that arrives afterward"). A transport
  still preparing the request sees its signal abort and never sends it.
  Spec-gap decision: NAP-CVM names no error for a request its own napplet
  cancelled, and `session closed` is its one code for pending work the calling
  endpoint ended. If publishing the cancellation fails, the cancellation gets
  that error and the request keeps running. A cancellation never takes an
  admission slot; it keeps its own deadline and still ends on close or
  teardown. A transport without `cancel()` gets the cancellation through
  `publish()` unchanged and the service warns once
  (`KEHTO_CVM_TRANSPORT_CANCEL`, see `docs/compatibility.md`); the request is
  still settled locally.
- A malformed `server` reference returns `invalid request` on `cvm.request` and
  `cvm.close` (it used to be `server not found` and `session closed`). An
  unknown but well-formed server is still `server not found`.
- With slots and queue both full, the operation is refused at once with
  `policy denied`. Spec gap: the draft's error table has no load-shedding entry,
  so the service reuses the shell-policy error rather than inventing a string.
- Slots return on result, error, deadline, `cvm.close` (pending and queued work
  for that server completes with `session closed` before the acknowledgement),
  approval cancellation, permission revocation, window destroy, unregistration,
  and `dispose()`. Aborted work also aborts the signal the transport was given.
- Endpoints never share a budget. Two windows of the same napplet are two
  endpoints. When the runtime retires an endpoint and registers a new source under
  the same window id, the new source starts with a full budget. Hosts that
  replace a source without notifying services keep counting the old source's
  running work against that window id until it settles.
- A session is recorded when a request is handed to the transport, not when it
  succeeds, so a failed or timed-out request no longer leaves a transport session
  and relay hold behind after its endpoint closes or goes away. The number of
  distinct server sessions one endpoint may hold open is not capped.

- Provides reference service handlers that host apps register with `runtime.registerService()`.
- The CVM Nostr transport rejects noninteger request durations or values outside
  1..300,000ms with `invalid timeout` before session acquisition or publication
  (default 30,000ms). One fixed deadline covers initialization, shared-init waits,
  initialized-notification publication, and the final response; expiry returns
  `relay timeout`. CEP-22 buffers live for the remaining request budget, bounded
  by `min(request timeout, 300_000)`; progress never extends it. CEP-41 closes with
  remaining gaps fail immediately, including boundless closes. Outbound oversized requests
  are unsupported; encrypted arguments must fit one NIP-44 message. The transport
  has no caller principal and no pending-request cap of its own; `createCvmService`
  admits work per endpoint before invoking it (see CVM admission below). Transport
  sessions and relay holds remain until close or disposal.
  Correlation IDs and ping nonces use random bytes rather than per-ID key derivation. These policies follow [NAP-CVM #31 at
  `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f`](https://github.com/napplet/naps/blob/28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f/naps/NAP-CVM.md)
  and [CEP-41](https://github.com/contextvm/contextvm-docs/blob/3b4f9dc9f9012a418abd9faec6a70db774754862/src/content/docs/reference/ceps/cep-41.md).
- Default upload ids, browser media `media-resource-*` read ids, and CVM registry
  JSON-RPC ids are secure UUID v4 values: native `crypto.randomUUID()`, or 16
  `crypto.getRandomValues()` bytes where the browser omits it (non-localhost plain
  HTTP), and an explicit error when neither exists. This is host identifier policy
  with no wire change, and it does not make `crypto.subtle` paths (approval-scoped
  uploads, the default HTTP uploader digest, CVM schema hashes) work on such
  origins. The full per-identifier contract is in the
  [shell package doc](https://github.com/kehto/web/blob/main/docs/packages/shell.md#uuid-support-on-http-origins).
- Uploads belong to exact window IDs, including IDs containing colons. Window
  teardown and service removal invalidate callbacks before backend cancellation;
  late progress, results, and errors cannot reach destroyed or replacement
  requesters. Cancellation errors do not prevent cleanup of other uploads. This
  host lifecycle policy preserves live response shapes from [NAP-UPLOAD draft
  #33 at `f5cc981e527e2cc1572793a7a6e5082e5271ac49`](https://github.com/napplet/naps/blob/f5cc981e527e2cc1572793a7a6e5082e5271ac49/naps/NAP-UPLOAD.md).
- The runtime selects a handler by the exact `message.type` domain (for example,
  `notify.create` selects `notify`). INC topics are opaque, queryless identities
  matched only by exact equality; they never select a service handler. The
  runtime attaches the sender to delivered INC events from the authenticated
  endpoint, so a service must not fabricate an INC delivery.
- Host apps provide backing bridges/callbacks for browser, native, signer, relay, fetch, notification, and media behavior.
- Keys actions belong to the trusted runtime window plus the app-local action ID.
  Two windows can register the same ID independently in both document and
  `hostBridge` backends. Unregister and window teardown affect only the owner;
  binding/action pushes preserve the original action ID. Same-window re-registration
  retains the existing rebind behavior. This is an explicit ownership policy for
  the uniqueness scope left implicit by [NAP-KEYS PR #9 at
  `cecb642`](https://github.com/napplet/naps/blob/cecb64257e0ac29926bb746832a477c553ab307c/naps/NAP-KEYS.md),
  with no wire changes.
- Relay services receive runtime-signed events and always settle publish calls
  with the NAP-RELAY result shape: `{ ok: true, event, eventId }` on success or
  `{ ok: false, error }` on failure. Relay subscribe adapters can provide
  observed source URLs as a second callback argument; those become event
  sidecar hints instead of treating every requested relay as an observed source.
- `createCountService()` implements the NAP-COUNT `count.query` service shape. Backends count NIP-01 filter matches through relay COUNT support, local indexes, or caches and may return exact counts, approximate/HLL metadata, relays, or refusal errors such as `unsupported-filter` and `too-expensive`; they must not return matching events.
- Serial and BLE hook contexts expose `emit(...)` so host bridges can send runtime-owned event envelopes back to the requesting napplet. Browser device bridges call `authorizeDevice(hostPrivateScope, connect)` after chooser selection and before physical connection; later session and GATT operations require source-bound, operation-specific approval and revocation closes hardware state.
- NAP-DM support keeps request correlation, per-window subscriptions, and packaged message shapes in `createDmService`; the concrete NIP-17 adapter verifies gift wraps and hydrates encrypted relay history, while NDR and Cordn specifics remain behind structural adapters.
- NAP-FS support keeps same-id results and per-window watch ownership in `createFsService`; injected backends own real persistence, virtual-path policy, picker mediation, byte validation, revisions, mutation atomicity, and watch observation.
- `createRelayPoolOutboxRouter()` starts validated relay hints or fallback reads before asynchronous NIP-65 discovery settles. Its host-side `queryStream()` emits verified results incrementally and exposes the existing aggregate through `result`; the draft NAP-OUTBOX wire query remains one-shot.
- `OutboxRelayPool.subscribe(filters, relayUrls, callback, origin?, authors?)`
  receives host-only routing provenance. For `nip65`, the fifth argument contains
  only requested authors whose policy-allowed write lists selected that relay;
  missing or denied authors are not credited. Hint and fallback reads receive the
  deduplicated authors derived from both filters and `options.authors`. The router
  always supplies an array, including `[]` for authorless reads. Event filters,
  relay selection, and napplet wire messages are unchanged; pool adapters may
  ignore the optional metadata argument. This follows the routing inputs in
  [NAP-OUTBOX draft #32 at `8865f73`](https://github.com/napplet/naps/blob/8865f73d52a4864afee145f28d26520476273927/naps/NAP-OUTBOX.md).
- OUTBOX relay failures are never reported as `policy denied`. A failing
  relay-list loader falls back to configured relays (Shell Behavior: "SHOULD fall
  back to configured relays when NIP-65 data is absent, stale, or unreachable");
  planning and transport failures carry `relay list unavailable` or
  `relay timeout`; planned reads settle on EOSE and mark partial relay failure
  `incomplete: true`. Only an approval that did not execute, a revoked approval,
  a relay-gate refusal, or an unplannable router is `policy denied`; a declined
  publish is `publish denied`. A required own-outbox or `toInboxes` relay that
  does not accept is `relay timeout`, even when hinted relays did. Spec gap: the draft has no "no relay reachable" or
  "relay refused" code, so the closest defined codes are used. See the
  [services README](https://github.com/kehto/web/blob/main/packages/services/README.md#approval-aware-relay-services).
- `createOutboxService()` accepts a source-scoped `getReadRouter` for
  `outbox.getEvent`, `outbox.query`, and `outbox.subscribe`, while the optional
  `getQueryRouter` can layer query-only policy or caching on top.
- `createResourceService()` implements the canonical resource wire from
  [NAP-RESOURCE at `ae5b9c6`](https://github.com/napplet/naps/blob/ae5b9c64ab8a4d8909f288829a01e99d6bd713bc/naps/NAP-RESOURCE.md):
  `id`, a single `url` or ordered `urls`, and padded-base64 response bytes.
  The web binding converts these bytes to `Blob`; the service does not put
  JavaScript Blob objects on the wire. Bulk outcomes preserve input order.
- Registered resource operations compose interface authority, the exact input
  resource URL, and independently approved resolver network origins. The
  `ResourceFetchInit.authorizeNetwork` callback guards each actual HTTP(S) or WebSocket
  destination, including redirects and fallback hosts. Its approval remains live
  through resource body processing; same-origin resolver work shares that
  request's approval without authorizing another resource request.
  `init.windowId` carries authenticated private host context, never app identity
  supplied on the wire. Resolver callbacks own scheme support, byte/MIME policy,
  and enforcement at the actual connection boundary. Paja supplies a protected
  DNS-pinned proxy; a generic browser fetch cannot provide DNS-time protection.
- `resource.info` scheme disclosure is advisory. Explicit cancellation is silent;
  live permission revocation returns `blocked-by-policy` without late delivery.
  Direct standalone service use without runtime authorization retains the
  bounded `FW-RESOURCE-LEGACY-001` warning described in the
  [compatibility register](/compatibility). That path does not provide
  Firewall approval enforcement. The old wire `servers` and object-form
  `requests` fields have been retired; use URI hints or host-owned discovery.
- Does not create a runtime or shell bridge by itself.

## API Reference

- Generated module: <a href="../api/modules/_kehto_services.html" target="_self"><code>docs/api/modules/_kehto_services.html</code></a>

## NIP-5D event compatibility

Current manifests use a direct artifact `x` hash, plain-text `content`, role-matched
`z`/`i` intent declarations, and required `R` / optional `O` domains. Kehto also
accepts legacy aggregate events through an isolated compatibility adapter.
Existing `aggregateHash` host/cache/ACL fields carry the verified artifact hash
for current events; legacy identities keep their original aggregate. Both paths
verify signatures and bytes before runtime injection and `srcdoc` execution.
For the schema and removal boundary, see [event migration](https://kehto.github.io/web/docs/migrations/NIP-5D-EVENT-SCHEMA.html).

## Canonical intent contracts

`@kehto/services` temporarily owns the canonical NAP-INTENT PR #106 contracts. `@napplet/nap@0.32.0` (the fixture line) has not published them; `@napplet/nap@0.37.0` now exports `IntentCandidate` and related types and `@napplet/core@0.38.0` declares `intent.onDelivery`, so adopting the upstream types and removing the local mirror is a tracked follow-up, not part of the NAP-LLM change. Candidates use opaque `id` plus exact `contracts`; successful results contain only `ok`, `archetype`, `action`, `convention`, and `handler` (never `handled`, `windowId`, or `newWindow`). `createIntentService` requires `resolveSender(windowId)` and rejects caller-supplied sender fields. `IntentResolverContext.sourceWindowId` and `IntentDispatchParams.sourceWindowId` are host-only correlation fields: they must never appear in `intent.deliver` or `intent.invoke.result`. A target controller accepts retained work as `{ completion }`; completion failure is host observation, not a second canonical result. Remove these local types only when an upstream package exports the checked PR #106 surface and Kehto's service/runtime regression suite proves direct replacement.

## GAMEPAD integration

This non-normative guidance defers to [NAP-GAMEPAD at `napplet/naps@19de5ce1`](https://github.com/napplet/naps/blob/19de5ce1cea40cd4c76089cdd8126e9f87648049/naps/NAP-GAMEPAD.md). Services export `createGamepadService` and `browserGamepadOptions`; shell exports `denyNappletControllerAccess`. Paja registers one host reader and denies native gamepad/HID/USB paths before frame execution. The first subscription is approved as the host-private `gamepad:input` resource before the native reader or listeners start. The NAP exposes all controllers to the focused source and has no per-device handle, so this scope deliberately covers the shared input surface. Source-bound subscriptions receive immediate full snapshots; only the visible host's input owner gets live controls. Focus loss supplies neutral controls and timestamp zero; denial emits a `gamepad.state` with `reason: "blocked"`. Unsubscribe, permission revocation, window destruction, and service removal release polling. See [Controller input](https://github.com/kehto/web/blob/main/docs/gamepad.md).

## LLM integration

This non-normative guidance defers to the living [NAP-LLM](https://github.com/napplet/naps/pull/134) (checked at `5e93bdf`). Services export `createLlmService`, `LlmServiceError`, the provider mappers (OpenAI Chat Completions, OpenAI Responses, Anthropic Messages and Gemini `generateContent` dialects) and `LLM_PROVIDER_PRESETS`; shell exports `getShellDomainState` and the `LlmHooks` adapter field; acl exports `llm:generate`. The runtime routes `llm.*` to one registered service and answers every sanctioned request with exactly one `llm.<op>.result`, shaping missing-service and ACL failures as `{ code: 'unsupported' }`. Hosts implement `LlmConnectionHost`; the service enforces schema, handle ownership, a per-window live-handle bound (`maxHandlesPerWindow`), consent before submission, duplicate ids, cancellation and deadline races, ordered deltas and safe errors, and passes `select`/`authorize` a `{ signal }` that withdraws stale prompts. `createHttpLlmProvider({ stream: true })` streams provider output into `llm.delta` as block start/delta/end events. Results carry `content` parts (text, thinking and tool calls); tool calls and results are validated and relayed, and Kehto never executes one. Advertisement stays binary on the wire while hosts report a third `unconfigured` state until the user adds a connection. See [Language models](https://github.com/kehto/web/blob/main/docs/llm.md).

## Media sessions

See [Media playback](https://github.com/kehto/web/blob/main/docs/media.md) for NAP-MEDIA draft authority, shell-owned audio/video,
shared host controls, endpoint cleanup, and command API migration.
Live HTTPS MP3/AAC uses `createBrowserMediaStreamFetch`, the host-only
`ResourceService.openStream` grant boundary, and bounded MediaSource buffering;
complete audio/video files retain atomic resource resolution.

## Notification approvals

`createNotifyService` follows [NAP-NOTIFY PR #11 at `67877ef6`](https://github.com/napplet/naps/blob/67877ef6c31ec8acee3125c1d8b4c781010e37dc/naps/NAP-NOTIFY.md). Under a permission-enabled runtime, `notify.send`, `notify.permission.request`, badge writes, and channel registration require exact operation/channel resource approval. Interface access alone does not permit presentation. Payloads are bounded and detached before approval; denial yields the canonical `notify.send.result` error or `notify.permission.result` with `granted: false`. Dismiss remains an owner-only cleanup action after permission loss. Revocation removes active notifications and host state and suppresses late permission answers or interaction callbacks. The reference service rejects remote icon URLs until a host can fetch them through an approved NAP-RESOURCE path; Paja renders text and does not fetch icons.

The older `createNotificationService` registry uses `notify.create/list/read`, which are outside NAP-NOTIFY. It remains a bounded Kehto compatibility path: calls warn once per service instance, and a permission-enabled runtime authorizes create/read/list before exposing state. New hosts should register `createNotifyService`. See [the compatibility register](/compatibility).


### Resource request lifecycle

Resource requests are tracked before asynchronous metadata resolution. Cancelling
byte requests before that resolution prevents a fetch; cancelling an active fetch
aborts its signal and suppresses its terminal response. Window destruction and
service detachment cancel outstanding work, including advisory info responses.
Bulk URLs and server hints are copied before awaiting host work. A duplicate
in-flight ID cannot replace the original request's cancellation handle, and old
source cleanup cannot remove a replacement source's request.

These lifecycle rules were checked against NAP-RESOURCE PR #80 at
`ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`. This does not establish full conformance
to that draft: the existing `requests`/server-hint and Blob transport contract
still needs migration to its `urls` and base64 wire contract, alongside resource
approval and host network-isolation integration.


### Scoped resource authorization

When attached to a runtime configured with `permissions`, the resource service
checks each original URL against a resource grant and, for HTTP(S) or WebSocket destinations, a separate
origin grant. Interface permission remains required. Bulk requests authorize each
item independently. The authorization covers fetching and reading the response
body, so revocation can abort active work and discard late bytes. Request
cancellation also dismisses a pending approval without granting a late answer.

This service boundary does not authorize indirect resolver destinations or make
browser redirects safe. Paja pairs mediated resource approval
with pre-execution frame admission and a closed browser CSP. Current configured
ingress uses independent rate budgets; the old temporal gate remains only for
hosts without a permission adapter.

Standalone or unmigrated hosts retain resolver-owned policy with diagnostic
`FW-RESOURCE-LEGACY-001`, once per service instance on actual fetch use. Configure
`RuntimeAdapter.permissions` and trusted session `permissionPrincipal` to use
shared grants. No old origin list is imported into Firewall permission grants.

### Resource request replay policy

Kehto retains the latest 1,024 completed resource request IDs per source window.
Reusing a retained ID, including with a different resource operation or malformed
payload, causes no additional resolver call or terminal response. Active IDs are
tracked separately and cannot be evicted by completed requests. Cancellation
always reaches active work; cancelled IDs enter the replay ledger when their
work settles. Source destruction and service detachment clear the corresponding
history. This bounded Kehto policy supplements NAP-RESOURCE's cancellation rules;
callers should generate fresh IDs because older completed entries are evicted.
