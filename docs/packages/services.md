# @kehto/services

Relay reference services plan normalized URLs before runtime approval and execute
the supplied immutable plan. Custom registered relay services implement
`RelayPlanningServiceHandler`; selection belongs in planning, never in
`executeRelayOperation()`.

Reference service handlers for Kehto runtime implementations.

WebRTC opening uses a side-effect-free signaling plan before runtime approval.
The reference host rejects configured ICE/TURN endpoints until Firewall gains a
typed endpoint scope; this does not claim to constrain direct iframe networking,
which remains a launch-policy concern.

OUTBOX and COUNT resolve relay destinations before approval. Their remote
backends receive the approved immutable URL list and cancellation signal; local
COUNT plans remain network-prompt-free and revoked sources cannot receive late
results.

The reference LINK service integrates shared runtime approvals after URL
validation. A LINK grant never gives direct network access. Runtime cancellation
and source replacement prevent stale opens/results; repeated request IDs cannot
reopen a link. Unknown methods are silent. The temporary host-only opener path
emits `FW-LINK-LEGACY-001` once per instance. See
[the approval guide](/firewall-approvals) for its migration contract and the
remaining service integrations.

> **Alpha status:** Kehto is an early runtime toolkit for a draft NIP-5D
> protocol. Service envelopes and NAP contracts are not final.

## Install

```bash
pnpm add @kehto/services @kehto/runtime @napplet/core @napplet/nap
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/services/package.json`, `packages/services/src/index.ts` |
| Version | `0.24.2` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/runtime` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.32.0 <0.33.0` |
| `@napplet/nap` | `>=0.32.0 <0.33.0` |

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

- Provides reference service handlers that host apps register with `runtime.registerService()`.
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

`@kehto/services` temporarily owns the canonical NAP-INTENT PR #106 contracts because `@napplet/nap@0.32.0` has not yet published them. Candidates use opaque `id` plus exact `contracts`; successful results contain only `ok`, `archetype`, `action`, `convention`, and `handler` (never `handled`, `windowId`, or `newWindow`). `createIntentService` requires `resolveSender(windowId)` and rejects caller-supplied sender fields. `IntentResolverContext.sourceWindowId` and `IntentDispatchParams.sourceWindowId` are host-only correlation fields: they must never appear in `intent.deliver` or `intent.invoke.result`. A target controller accepts retained work as `{ completion }`; completion failure is host observation, not a second canonical result. Remove these local types only when an upstream package exports the checked PR #106 surface and Kehto's service/runtime regression suite proves direct replacement.

## GAMEPAD integration

This non-normative guidance defers to [NAP-GAMEPAD at `napplet/naps@19de5ce1`](https://github.com/napplet/naps/blob/19de5ce1cea40cd4c76089cdd8126e9f87648049/naps/NAP-GAMEPAD.md). Services export `createGamepadService` and `browserGamepadOptions`; shell exports `denyNappletControllerAccess`. Paja and the playground register one host reader and deny native gamepad/HID/USB paths before frame execution. The first subscription is approved as the host-private `gamepad:input` resource before the native reader or listeners start. The NAP exposes all controllers to the focused source and has no per-device handle, so this scope deliberately covers the shared input surface. Source-bound subscriptions receive immediate full snapshots; only the visible host's input owner gets live controls. Focus loss supplies neutral controls and timestamp zero; denial emits a `gamepad.state` with `reason: "blocked"`. Unsubscribe, permission revocation, window destruction, and service removal release polling. See [Controller input](https://github.com/kehto/web/blob/main/docs/gamepad.md).

## Notification approvals

`createNotifyService` follows [NAP-NOTIFY PR #11 at `67877ef6`](https://github.com/napplet/naps/blob/67877ef6c31ec8acee3125c1d8b4c781010e37dc/naps/NAP-NOTIFY.md). Under a permission-enabled runtime, `notify.send`, `notify.permission.request`, badge writes, and channel registration require exact operation/channel resource approval. Interface access alone does not permit presentation. Payloads are bounded and detached before approval; denial yields the canonical `notify.send.result` error or `notify.permission.result` with `granted: false`. Dismiss remains an owner-only cleanup action after permission loss. Revocation removes active notifications and host state and suppresses late permission answers or interaction callbacks. The reference service rejects remote icon URLs until a host can fetch them through an approved NAP-RESOURCE path; Paja renders text and does not fetch icons.

The older `createNotificationService` registry uses `notify.create/list/read`, which are outside NAP-NOTIFY. It remains a bounded Kehto compatibility path: calls warn once per service instance, and a permission-enabled runtime authorizes create/read/list before exposing state. New hosts should register `createNotifyService`; the playground migration is tracked separately. See [the compatibility register](/compatibility).


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
browser redirects safe. Resolver destination hooks, canonical `urls`/base64 wire
migration, and Paja/playground network isolation remain migration work. Current
configured ingress still includes the old temporal gate until that migration.

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
