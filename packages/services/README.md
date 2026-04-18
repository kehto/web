# @kehto/services

Reference service handlers for the napplet protocol — audio, notifications, identity, relay pool, cache, keys (stub), media (stub), notify, theme.

## Install

```bash
pnpm add @kehto/services
```

## Overview

`@kehto/services` ships the reference implementations of the `ServiceHandler` contract defined by `@kehto/runtime`. Each factory returns an object that the runtime routes NIP-5D envelopes to based on the domain prefix of the incoming message type (e.g., `identity.*` goes to the handler registered under `identity`).

Host apps wire services into the runtime via `runtime.registerService(name, handler)`. The services are browser-agnostic — they have no DOM dependency. Browser-specific behaviors (audio element pool, OS notifications) are delivered through host-supplied callbacks.

Canonical v1.2 posture:

- The v1.1 signer service is deleted outright. Its responsibilities split into two: read-only identity lookups go through `createIdentityService` (`getPublicKey`, `getRelays`, `getProfile`, `getFollows`, `getList`, `getZaps`, `getMutes`, `getBlocked`, `getBadges`); signing happens inside the shell as part of `relay.publish` / `relay.publishEncrypted` and is never exposed to napplets.
- `createKeysService` and `createMediaService` are stub-only in v1.3 — they accept the canonical envelopes and return well-formed responses, but real host backends (OS keybinding registration, audio/video playback control) must be plugged in by the host app in future milestones.
- `createNotifyService` (NIP-5D `notify.*` NUB) coexists with the legacy `createNotificationService` (ifc-emit `notifications:*` channel). Both may be registered simultaneously until the legacy handler is retired.

## Quick Start

```ts
import {
  createIdentityService,
  createNotificationService,
} from '@kehto/services';

// Identity service — read-only lookups backed by a signer adapter.
runtime.registerService(
  'identity',
  createIdentityService({
    getPublicKey: () => signer.getPublicKey(),
    getRelays: () => signer.getRelays(),
    getProfile: (pk) => nostrClient.fetchProfile(pk),
  }),
);

// Notification service — legacy ifc-emit channel, browser badge fan-out.
runtime.registerService(
  'notifications',
  createNotificationService({ onChange: (list) => updateBadge(list) }),
);
```

## Public API

Each factory returns a `ServiceHandler` registrable via `runtime.registerService()`. The bullets below note the canonical NIP-5D domain the handler owns and the ACL capability napplets need in order to reach it.

### Identity NUB
- [`createIdentityService`](../../docs/api/functions/_kehto_services.createIdentityService.html) — `identity.*` reads (`identity:read`). No signing surface; shell mediates signing internally.

### Notify NUB
- [`createNotifyService`](../../docs/api/functions/_kehto_services.createNotifyService.html) — canonical `notify.*` envelopes (`notify:send` / `notify:channel`).
- [`createNotificationService`](../../docs/api/functions/_kehto_services.createNotificationService.html) — legacy ifc-emit `notifications:*` channel; coexists with `createNotifyService` until retired.

### Relay NUB
- [`createRelayPoolService`](../../docs/api/functions/_kehto_services.createRelayPoolService.html) — `relay.publish`, `relay.publishEncrypted`, `relay.subscribe` fan-out (`relay:read` / `relay:write`).
- [`createCacheService`](../../docs/api/functions/_kehto_services.createCacheService.html) — offline event cache (`cache:read` / `cache:write`).
- [`createCoordinatedRelay`](../../docs/api/functions/_kehto_services.createCoordinatedRelay.html) — composite service that bundles relay-pool + cache with read-through behavior.

### Keys NUB (stub in v1.3)
- [`createKeysService`](../../docs/api/functions/_kehto_services.createKeysService.html) — `keys.bind/unbind/bindings` stub (`keys:bind` / `keys:forward`). Plug a real backend via the `onBind`/`onForward` hooks when the host supports OS key registration.

### Media NUB (stub in v1.3)
- [`createMediaService`](../../docs/api/functions/_kehto_services.createMediaService.html) — `media.*` playback/transport stub (`media:control`). Plug a real media backend via the service options.

### Theme NUB
- [`createThemeService`](../../docs/api/functions/_kehto_services.createThemeService.html) — `theme.get` + `theme.changed` fan-out (`theme:read`). Returns a `ThemeService` with `publishTheme()` / `setTheme()` utilities for host-side updates.

### Audio (legacy ifc-emit)
- [`createAudioService`](../../docs/api/functions/_kehto_services.createAudioService.html) — `audio:*` ifc-emit topic handler. Browser-agnostic registry of per-window audio sources; host wires `onChange` to update transport UI.

### Types
`AudioSource`, `AudioServiceOptions`, `Notification`, `NotificationServiceOptions`, `IdentityServiceOptions`, `RelayPoolServiceOptions`, `CacheServiceOptions`, `CoordinatedRelayOptions`, `KeysServiceOptions`, `MediaServiceOptions`, `NotifyServiceOptions`, `ThemeServiceOptions`, `ThemeService`.

## API Reference

Full API reference: [docs/api/@kehto/services/](../../docs/api/modules/_kehto_services.html) (generated via `pnpm docs:api`).

## License

MIT
