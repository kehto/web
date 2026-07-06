# @kehto/shell

Browser adapter over @kehto/runtime — ShellBridge, domain proxies, keys-forwarder.

> **Alpha status:** Kehto is an early runtime implementation for a draft NIP-5D
> protocol. NAP contracts and injected-domain behavior are still draft; treat
> this package as current implementation guidance.

## Install

```bash
pnpm add @kehto/shell
```

## Overview

`@kehto/shell` is the browser-specific integration layer for kehto. It wraps `@kehto/runtime` with the window/postMessage transport, localStorage persistence hooks, an audio manager, and the five canonical per-domain proxies defined by NIP-5D.

The primary entry point is `createShellBridge()` — it owns the postMessage listener, the NAP-SHELL `shell.ready` / `shell.init` handshake, manifest verification, and every dispatch back into the runtime engine.

Current draft behaviors this package enforces:

- The shell does not inject a host-provided nostr object into napplets — NIP-5D explicitly forbids napplet-visible signing. Napplets call `relay.publish` / `relay.publishEncrypted` and the shell mediates the signing flow internally (NIP-44 default, NIP-04 opt-in for encrypted envelopes).
- `injectNappletNamespacePrelude()` implements the current draft NIP-5D injected-domain bootstrap: hosts prepend a `window.napplet` prelude to `srcdoc` outside the verified artifact bytes, so callable NAP domain interfaces exist before napplet-authored scripts run. Assigned namespaces are filtered back to the explicit bare-domain allowlist; the playground does not inject `shell`.
- Legacy `window.napplet.shell.supports()` compatibility is not the current NIP-5D availability primitive. New host and napplet availability checks should use injected `window.napplet.<domain>` presence and leave per-domain semantic checks to the matching NAP.
- Five optional per-domain proxies — `createIdentityProxy`, `createThemeProxy`, `createKeysProxy`, `createMediaProxy`, `createNotifyProxy` — can be composed between napplet and runtime to intercept or augment traffic per NAP. They are NOT wired by default (Kehto's runtime already owns dispatch for the currently supported domains); they exist as host-app composition seams.
- The keys-forwarder pumps host keydown events into `keys.forward` envelopes for napplets that hold the `keys:forward` capability.
- `buildShellCapabilities()` advertises `dm` when the host adapter provides `hooks.dm`, and disabled-domain overrides remove it from both `domains` and `naps`.

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
- `createShellBridge` — primary entry point; returns a `ShellBridge` (exposed `runtime`, `shell.ready`, lifecycle hooks)
- `ShellBridge` — interface type for the returned bridge

### Hooks adapter
- `adaptHooks` — convert a `ShellAdapter` + `BrowserDeps` into the canonical `RuntimeAdapter` hook bag consumed by `@kehto/runtime`

### Diagnostics
- `ShellAdapter.onUnroutedMessage?(info)` — optional observe-only hook fired when `ShellBridge.handleMessage` drops an incoming postMessage it can't route to a registered napplet window. `info` is an `UnroutedMessageInfo` (`{ type?, origin, reason }`) where `reason` is `'no-source-window'` or `'unregistered-window'`. The message is still dropped — this exists so otherwise-silent drops (e.g. an intent/`srcdoc` iframe whose `contentWindow` was never registered in `originRegistry`, or was swapped by a reload) are diagnosable instead of vanishing. Host can `console.warn` inside its own hook; the bridge adds no console output and swallows hook errors so routing is never broken.

```ts
const bridge = createShellBridge({
  ...myShellAdapter,
  onUnroutedMessage: ({ type, origin, reason }) => {
    console.warn(`[shell] dropped ${type ?? '<unknown>'} from ${origin}: ${reason}`);
  },
});
```

### Shell init
- `buildShellCapabilities` — construct the current draft `ShellCapabilities` payload emitted during the `shell.ready` / `shell.init` handshake
- `injectNappletNamespacePrelude` — insert a host-owned NIP-5D `window.napplet` callable-domain prelude into verified HTML before authored scripts
- `renderNappletNamespacePrelude` — render only the bootstrap `<script>` for hosts that already own HTML insertion

### Domain proxies (NIP-5D composition seams)
- `createIdentityProxy` — intercept `identity.getProfile/getFollows/...` traffic
- `createThemeProxy` — intercept `theme.get/theme.changed`
- `createKeysProxy` — intercept `keys.bind/unbind/bindings`
- `createMediaProxy` — intercept `media.*` playback control
- `createNotifyProxy` — intercept `notify.send/list/read/dismiss`

### Keys forwarder
- `createKeysForwarder` — host-keydown pump into `keys.forward` envelopes; auto-attached by `createShellBridge`, also exported for hosts that manage their own forwarder instance

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
Exported for host-app integration: `ShellAdapter`, `ShellCapabilities`, `RelayPoolHooks`, `RelayPoolLike`, `RelayConfigHooks`, `WindowManagerHooks`, `AuthHooks`, `ConfigHooks`, `HotkeyHooks`, `WorkerRelayHooks`, `WorkerRelayLike`, `CryptoHooks`, `DmHooks`, `UploadHooks`, `IntentHooks`, `LinkHooks`, `CommonHooks`, `ListsHooks`, `SerialHooks`, `BleHooks`, `WebrtcHooks`, `SessionEntry`, `NappKeyEntry` (deprecated), `AclEntry`, `AclCheckEvent`, `UnroutedMessageInfo`, `ServiceDescriptor`, `ServiceHandler`, `ServiceRegistry`, `NostrEvent`, `NostrFilter`, `NappletMessage`, `ConsentRequest`, and per-proxy `*Deps`/`*Proxy` interfaces.

### Enforcement re-exports (from @kehto/runtime)
`createEnforceGate`, `createNapEnforceGate`, `formatDenialReason`, plus `EnforceResult`, `EnforceConfig`, `NapEnforceConfig`, `IdentityResolver`, `AclChecker`, `NapMessage`.

### Compat re-exports (DRIFT-CORE-06)

Retained for migration consumers; new integrations should use current NIP-5D envelope types from `@napplet/core`. Slated for removal once upstream restores those exports.

Re-exported from `@kehto/runtime`: the v1.1 bus-kind enum, auth event kind, shell bridge URI constant, protocol version string, the full capability list, destructive-kind set, and the replay window seconds constant. Re-exported types cover the v1.1 capability union and bus-kind numeric union. See the typedoc API reference below for the exact identifier list.

## API Reference

Full package docs: [`docs/packages/shell.md`](../../docs/packages/shell.md).
Generated API module: `docs/api/modules/_kehto_shell.html` (run `pnpm docs:api`).

## License

MIT
