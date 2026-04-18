# @kehto/shell

Browser adapter over @kehto/runtime — ShellBridge, domain proxies, keys-forwarder.

## Install

```bash
pnpm add @kehto/shell
```

## Overview

`@kehto/shell` is the browser-specific integration layer for kehto. It wraps `@kehto/runtime` with the window/postMessage transport, localStorage persistence hooks, an audio manager, and the five canonical per-domain proxies defined by NIP-5D.

The primary entry point is `createShellBridge()` — it owns the postMessage listener, AUTH handshake, manifest verification, and every dispatch back into the runtime engine.

Canonical v1.2 behaviors this package enforces:

- The shell does not inject a host-provided nostr object into napplets — NIP-5D explicitly forbids napplet-visible signing. Napplets call `relay.publish` / `relay.publishEncrypted` and the shell mediates the signing flow internally (NIP-44 default, NIP-04 opt-in for encrypted envelopes).
- `shell.supports(capability)` uses the `perm:<permission>` namespace for sandbox permissions, not the v1.1 bare capability list.
- Five optional per-domain proxies — `createIdentityProxy`, `createThemeProxy`, `createKeysProxy`, `createMediaProxy`, `createNotifyProxy` — can be composed between napplet and runtime to intercept or augment traffic per NUB. They are NOT wired by default (the runtime already owns 8-domain dispatch); they exist as host-app composition seams.
- The keys-forwarder pumps host keydown events into `keys.forward` envelopes for napplets that hold the `keys:forward` capability.

## Quick Start

```ts
import { createShellBridge } from '@kehto/shell';
import { createNotificationService } from '@kehto/services';

const bridge = createShellBridge({
  adapter: myShellAdapter,
  hooks: myHooks,
  target: window,
});

// Register a reference service against the underlying runtime.
bridge.runtime.registerService(
  'notifications',
  createNotificationService({ onChange: updateBadge }),
);
```

## Public API

### Bridge factory
- [`createShellBridge`](../../docs/api/functions/_kehto_shell.createShellBridge.html) — primary entry point; returns a `ShellBridge` (exposed `runtime`, `shell.ready`, lifecycle hooks)
- `ShellBridge` — interface type for the returned bridge

### Hooks adapter
- [`adaptHooks`](../../docs/api/functions/_kehto_shell.adaptHooks.html) — convert a `ShellAdapter` + `BrowserDeps` into the canonical `RuntimeAdapter` hook bag consumed by `@kehto/runtime`

### Shell init
- [`buildShellCapabilities`](../../docs/api/functions/_kehto_shell.buildShellCapabilities.html) — construct the `ShellCapabilities` payload emitted during the `shell.ready` / `shell.init` handshake

### Domain proxies (NIP-5D composition seams)
- [`createIdentityProxy`](../../docs/api/functions/_kehto_shell.createIdentityProxy.html) — intercept `identity.getProfile/getFollows/...` traffic
- [`createThemeProxy`](../../docs/api/functions/_kehto_shell.createThemeProxy.html) — intercept `theme.get/theme.changed`
- [`createKeysProxy`](../../docs/api/functions/_kehto_shell.createKeysProxy.html) — intercept `keys.bind/unbind/bindings`
- [`createMediaProxy`](../../docs/api/functions/_kehto_shell.createMediaProxy.html) — intercept `media.*` playback control
- [`createNotifyProxy`](../../docs/api/functions/_kehto_shell.createNotifyProxy.html) — intercept `notify.send/list/read/dismiss`

### Keys forwarder
- [`createKeysForwarder`](../../docs/api/functions/_kehto_shell.createKeysForwarder.html) — host-keydown pump into `keys.forward` envelopes; auto-attached by `createShellBridge`, also exported for hosts that manage their own forwarder instance

### Session / origin registry
- `sessionRegistry` — canonical windowId ↔ verified-napplet registry singleton
- `nappKeyRegistry` — deprecated alias for `sessionRegistry`
- `originRegistry` — origin-to-windowId map used by proxies and the keys-forwarder
- `PendingUpdate` — type for pending aggregate-hash change prompts

### Manifest cache
- `manifestCache` — browser-specific manifest cache singleton
- `ManifestCacheEntry` — manifest cache entry type

### Audio manager
- `audioManager` — browser audio registry singleton (audio element pool)
- `AudioSource` — per-windowId audio source shape

### Topic constants
- `TOPICS` — canonical shell topic namespace for command routing
- `TopicKey`, `TopicValue` — typed topic lookup helpers

### Types
Exported for host-app integration: `ShellAdapter`, `ShellCapabilities`, `RelayPoolHooks`, `RelayPoolLike`, `RelayConfigHooks`, `WindowManagerHooks`, `AuthHooks`, `ConfigHooks`, `HotkeyHooks`, `WorkerRelayHooks`, `WorkerRelayLike`, `CryptoHooks`, `DmHooks`, `SessionEntry`, `NappKeyEntry` (deprecated), `AclEntry`, `AclCheckEvent`, `ServiceDescriptor`, `ServiceHandler`, `ServiceRegistry`, `NostrEvent`, `NostrFilter`, `NappletMessage`, `ConsentRequest`, and per-proxy `*Deps`/`*Proxy` interfaces.

### Enforcement re-exports (from @kehto/runtime)
`createEnforceGate`, `resolveCapabilities`, `formatDenialReason`, plus `CapabilityResolution`, `EnforceResult`, `EnforceConfig`, `IdentityResolver`, `AclChecker`.

### Compat re-exports (DRIFT-CORE-06)

Retained for v1.1 migration consumers; new integrations should use canonical NIP-5D envelope types from `@napplet/core`. Slated for removal once upstream restores those exports.

Re-exported from `@kehto/runtime`: the v1.1 bus-kind enum, auth event kind, shell bridge URI constant, protocol version string, the full capability list, destructive-kind set, and the replay window seconds constant. Re-exported types cover the v1.1 capability union and bus-kind numeric union. See the typedoc API reference below for the exact identifier list.

## API Reference

Full API reference: [docs/api/@kehto/shell/](../../docs/api/modules/_kehto_shell.html) (generated via `pnpm docs:api`).

## License

MIT
