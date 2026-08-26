# @kehto/services

Reference service handlers for Kehto runtime implementations.

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
| Version | `0.20.1` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/runtime` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.31.0 <0.32.0` |
| `@napplet/nap` | `>=0.31.0 <0.32.0` |

## Primary APIs

| Area | Exports |
|------|---------|
| Direct-domain notifications | `createNotifyService`, `NotifyServiceOptions` |
| Identity | `createIdentityService`, `IdentityServiceOptions` |
| Relay/cache/count | `createRelayPoolService`, `RelayPoolServiceOptions`, `createCacheService`, `CacheServiceOptions`, `HostCacheBridge`, `createCoordinatedRelay`, `CoordinatedRelayOptions`, `createCountService`, `CountServiceOptions`, `CountRequest`, `CountResult` |
| Keys | `createKeysService`, `KeysServiceOptions`, `HostKeysBridge`, `HostKeyEvent` |
| Media | `createMediaService`, `createBrowserMediaBridge`, `MediaServiceOptions`, `HostMediaBridge`, `MediaAction` |
| Notify/theme/config/resource | `createNotifyService`, `NotifyServiceOptions`, `createThemeService`, `ThemeServiceOptions`, `ThemeService`, `createConfigService`, `ConfigServiceOptions`, `ConfigService`, `ConfigSchemaValidation`, `createResourceService`, `ResourceServiceOptions`, `ResourceFetchInit`, `ResourceBytesRequest`, `ResourceInfo`, `ResourceService` |
| Outbox | `createOutboxService`, `createRelayPoolOutboxRouter`, `OutboxRouter`, `StreamingOutboxRouter`, `OutboxQueryStream`, `OutboxQueryStreamSink` |
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
- Relay services receive runtime-signed events and always settle publish calls
  with the NAP-RELAY result shape: `{ ok: true, event, eventId }` on success or
  `{ ok: false, error }` on failure. Relay subscribe adapters can provide
  observed source URLs as a second callback argument; those become event
  sidecar hints instead of treating every requested relay as an observed source.
- `createCountService()` implements the NAP-COUNT `count.query` service shape. Backends count NIP-01 filter matches through relay COUNT support, local indexes, or caches and may return exact counts, approximate/HLL metadata, relays, or refusal errors such as `unsupported-filter` and `too-expensive`; they must not return matching events.
- BLE and WebRTC hook contexts expose `emit(...)` so host bridges can send runtime-owned event envelopes back to the requesting napplet.
- NAP-DM support keeps request correlation, per-window subscriptions, and packaged message shapes in `createDmService`; the concrete NIP-17 adapter verifies gift wraps and hydrates encrypted relay history, while NDR and Cordn specifics remain behind structural adapters.
- NAP-FS support keeps same-id results and per-window watch ownership in `createFsService`; injected backends own real persistence, virtual-path policy, picker mediation, byte validation, revisions, mutation atomicity, and watch observation.
- `createRelayPoolOutboxRouter()` starts validated relay hints or fallback reads before asynchronous NIP-65 discovery settles. Its host-side `queryStream()` emits verified results incrementally and exposes the existing aggregate through `result`; the draft NAP-OUTBOX wire query remains one-shot.
- `createResourceService()` is a policy-neutral NAP-RESOURCE kernel. Its required
  `fetch` callback owns resolution and accepts every syntactically valid URL by
  default. Canonical single and bulk requests preserve optional per-resource
  Blossom `servers`; resolver `init.servers` is populated only for `blossom:`.
  `resource.info` can disclose `maxServers` alongside byte and URL caps. The
  optional `resource.info.schemes` disclosure is advisory and is
  never used as an authorization gate. A runtime may opt into Kehto's origin
  grant adapter by supplying `isOriginGranted`, `getConnectGrants`, and
  `resolveIdentity` together. Resolver-specific policy, scheme support, redirect
  behavior, hint validation/fallback, MIME classification, and browser CORS
  handling remain runtime decisions. An ordinary browser fetch rejection maps to `network-error` unless
  the injected resolver returns a more specific `ResourceServiceError`.
- Does not create a runtime or shell bridge by itself.

## API Reference

- Generated module: <a href="../api/modules/_kehto_services.html" target="_self"><code>docs/api/modules/_kehto_services.html</code></a>
