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
| Version | `0.12.3` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/runtime` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.20.0 <0.21.0` |
| `@napplet/nap` | `>=0.20.0 <0.21.0` |

## Primary APIs

| Area | Exports |
|------|---------|
| Legacy/reference basics | `createAudioService`, `createNotificationService`, `AudioSource`, `AudioServiceOptions`, `Notification`, `NotificationServiceOptions` |
| Identity | `createIdentityService`, `IdentityServiceOptions` |
| Relay/cache | `createRelayPoolService`, `RelayPoolServiceOptions`, `createCacheService`, `CacheServiceOptions`, `HostCacheBridge`, `createCoordinatedRelay`, `CoordinatedRelayOptions` |
| Keys | `createKeysService`, `KeysServiceOptions`, `HostKeysBridge`, `HostKeyEvent` |
| Media | `createMediaService`, `createBrowserMediaBridge`, `MediaServiceOptions`, `HostMediaBridge`, `MediaAction` |
| Notify/theme/config/resource | `createNotifyService`, `NotifyServiceOptions`, `createThemeService`, `ThemeServiceOptions`, `ThemeService`, `createConfigService`, `ConfigServiceOptions`, `ConfigService`, `ConfigSchemaValidation`, `createResourceService`, `ResourceServiceOptions`, `ResourceService` |
| Shell-mediated helpers | `createLinkService`, `LinkServiceOptions`, `LinkOpenContext`, `createCommonService`, `CommonServiceOptions`, `CommonServiceContext`, `createListsService`, `ListsServiceOptions`, `ListsServiceContext`, `createSerialService`, `SerialServiceOptions`, `SerialServiceContext`, `createBleService`, `BleServiceOptions`, `BleServiceContext`, `createWebrtcService`, `WebrtcServiceOptions`, `WebrtcServiceContext` |
| DM | `createDmService`, `createNip17DmAdapter`, `createNdrDmAdapter`, `createNdrRelayTransport`, `createCordnDmAdapter`, `createCordnRelayCoordinatorClient`, `DmServiceOptions`, `DmAdapter`, `DmRelayPool`, `Nip17DmAdapterOptions`, `NdrDmAdapterOptions`, `NdrRelayTransportOptions`, `CordnDmAdapterOptions`, `CordnRelayCoordinatorOptions` |

## Scope Boundaries

- Provides reference service handlers that host apps register with `runtime.registerService()`.
- Host apps provide backing bridges/callbacks for browser, native, signer, relay, fetch, notification, and media behavior.
- BLE and WebRTC hook contexts expose `emit(...)` so host bridges can send runtime-owned event envelopes back to the requesting napplet.
- NAP-DM support keeps request correlation, subscriptions, and normalized message shape in `createDmService`; NIP-17, NDR, and Cordn specifics live behind adapters. Relay-backed helper bridges cover NDR runtime hooks and Cordn coordinator methods without adding hard package dependencies.
- Does not create a runtime or shell bridge by itself.

## API Reference

- Generated module: <a href="../api/modules/_kehto_services.html" target="_self"><code>docs/api/modules/_kehto_services.html</code></a>
