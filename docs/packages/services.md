# @kehto/services

Reference service handlers for Kehto runtime implementations.

> **Alpha status:** Kehto is an early runtime implementation for a draft NIP-5D
> protocol. Service envelopes and NUB contracts are not final.

## Install

```bash
pnpm add @kehto/services @kehto/runtime @napplet/core @napplet/nub
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/services/package.json`, `packages/services/src/index.ts` |
| Version | `0.8.0` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/runtime` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `^0.5.0` |
| `@napplet/nub` | `^0.5.0` |

## Primary APIs

| Area | Exports |
|------|---------|
| Legacy/reference basics | `createAudioService`, `createNotificationService`, `AudioSource`, `AudioServiceOptions`, `Notification`, `NotificationServiceOptions` |
| Identity | `createIdentityService`, `IdentityServiceOptions` |
| Relay/cache | `createRelayPoolService`, `RelayPoolServiceOptions`, `createCacheService`, `CacheServiceOptions`, `HostCacheBridge`, `createCoordinatedRelay`, `CoordinatedRelayOptions` |
| Keys | `createKeysService`, `KeysServiceOptions`, `HostKeysBridge`, `HostKeyEvent` |
| Media | `createMediaService`, `createBrowserMediaBridge`, `MediaServiceOptions`, `HostMediaBridge`, `MediaAction` |
| Notify/theme/config/resource | `createNotifyService`, `NotifyServiceOptions`, `createThemeService`, `ThemeServiceOptions`, `ThemeService`, `createConfigService`, `ConfigServiceOptions`, `ConfigService`, `ConfigSchemaValidation`, `createResourceService`, `ResourceServiceOptions`, `ResourceService` |

## Scope Boundaries

- Provides reference service handlers that host apps register with `runtime.registerService()`.
- Host apps provide backing bridges/callbacks for browser, native, signer, relay, fetch, notification, and media behavior.
- Does not create a runtime or shell bridge by itself.

## API Reference

- Generated module: <a href="../api/modules/_kehto_services.html" target="_self"><code>docs/api/modules/_kehto_services.html</code></a>
