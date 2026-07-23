# @kehto/services

Reference service handlers for Kehto runtime implementations.

> **Alpha status:** Kehto is an early runtime implementation for a draft NIP-5D
> protocol. Service envelopes and NAP contracts are not final.

## Install

```bash
pnpm add @kehto/services @kehto/runtime @napplet/core @napplet/nap
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/services/package.json`, `packages/services/src/index.ts` |
| Version | `0.16.5` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/runtime` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.23.0 <=0.28.x` |
| `@napplet/nap` | `>=0.23.0 <=0.28.x` |

## Primary APIs

| Area | Exports |
|------|---------|
| Direct-domain notifications | `createNotifyService`, `NotifyServiceOptions` |
| Identity | `createIdentityService`, `IdentityServiceOptions` |
| Relay/cache/count | `createRelayPoolService`, `RelayPoolServiceOptions`, `createCacheService`, `CacheServiceOptions`, `HostCacheBridge`, `createCoordinatedRelay`, `CoordinatedRelayOptions`, `createCountService`, `CountServiceOptions`, `CountRequest`, `CountResult` |
| Keys | `createKeysService`, `KeysServiceOptions`, `HostKeysBridge`, `HostKeyEvent` |
| Media | `createMediaService`, `createBrowserMediaBridge`, `MediaServiceOptions`, `HostMediaBridge`, `MediaAction` |
| Notify/theme/config/resource | `createNotifyService`, `NotifyServiceOptions`, `createThemeService`, `ThemeServiceOptions`, `ThemeService`, `createConfigService`, `ConfigServiceOptions`, `ConfigService`, `ConfigSchemaValidation`, `createResourceService`, `ResourceServiceOptions`, `ResourceService` |
| Outbox | `createOutboxService`, `createRelayPoolOutboxRouter`, `OutboxRouter`, `StreamingOutboxRouter`, `OutboxQueryStream`, `OutboxQueryStreamSink` |
| Shell-mediated helpers | `createLinkService`, `LinkServiceOptions`, `LinkOpenContext`, `createCommonService`, `CommonServiceOptions`, `CommonServiceContext`, `createListsService`, `ListsServiceOptions`, `ListsServiceContext`, `createSerialService`, `SerialServiceOptions`, `SerialServiceContext`, `createBleService`, `BleServiceOptions`, `BleServiceContext`, `createWebrtcService`, `WebrtcServiceOptions`, `WebrtcServiceContext` |
| DM | `createDmService`, `createNip17DmAdapter`, `createNdrDmAdapter`, `createNdrRelayTransport`, `createCordnDmAdapter`, `createCordnRelayCoordinatorClient`, `DmServiceOptions`, `DmAdapter`, `DmRelayPool`, `Nip17DmAdapterOptions`, `NdrDmAdapterOptions`, `NdrRelayTransportOptions`, `CordnDmAdapterOptions`, `CordnRelayCoordinatorOptions` |

## Scope Boundaries

- Provides reference service handlers that host apps register with `runtime.registerService()`.
- The runtime selects a handler by the exact `message.type` domain (for example,
  `notify.create` selects `notify`). INC topics are opaque, queryless identities
  matched only by exact equality; they never select a service handler. The
  runtime attaches the sender to delivered INC events from the authenticated
  endpoint, so a service must not fabricate an INC delivery.
- Host apps provide backing bridges/callbacks for browser, native, signer, relay, fetch, notification, and media behavior.
- `createCountService()` implements the NAP-COUNT `count.query` service shape. Backends count NIP-01 filter matches through relay COUNT support, local indexes, or caches and may return exact counts, approximate/HLL metadata, relays, or refusal errors such as `unsupported-filter` and `too-expensive`; they must not return matching events.
- BLE and WebRTC hook contexts expose `emit(...)` so host bridges can send runtime-owned event envelopes back to the requesting napplet.
- NAP-DM support keeps request correlation, subscriptions, and normalized message shape in `createDmService`; NIP-17, NDR, and Cordn specifics live behind adapters. Relay-backed helper bridges cover NDR runtime hooks and Cordn coordinator methods without adding hard package dependencies.
- `createRelayPoolOutboxRouter()` starts validated relay hints or fallback reads before asynchronous NIP-65 discovery settles. Its host-side `queryStream()` emits verified results incrementally and exposes the existing aggregate through `result`; the draft NAP-OUTBOX wire query remains one-shot.
- Does not create a runtime or shell bridge by itself.

## API Reference

- Generated module: <a href="../api/modules/_kehto_services.html" target="_self"><code>docs/api/modules/_kehto_services.html</code></a>
