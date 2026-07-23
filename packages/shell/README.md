# @kehto/shell

Browser adapter over @kehto/runtime — ShellBridge and domain proxies.

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
- `injectNappletNamespacePrelude()` implements the NIP-5D injected-domain bootstrap and mandatory NAP-SHELL shim: hosts prepend it to `srcdoc` outside verified artifact bytes, install the parent-bound `shell.init` receiver, emit one `shell.ready`, and expose callable NAP interfaces before authored scripts run. Optional namespaces are filtered to the bare-domain allowlist; `shell` is always retained.
- `window.napplet.shell.supports(domain)` answers synchronously and locally from the cached first `shell.init` environment. It returns `false` before `shell.init`, for unknown values, and for domains that are not live and granted to that napplet; it never sends a support-query message.
- Five optional per-domain proxies — `createIdentityProxy`, `createThemeProxy`, `createKeysProxy`, `createMediaProxy`, `createNotifyProxy` — can be composed between napplet and runtime to intercept or augment traffic per NAP. They are NOT wired by default (Kehto's runtime already owns dispatch for the currently supported domains); they exist as host-app composition seams.
- `keys.forward` is napplet-to-shell only. Active napplets suppress locally-bound keys from `keys.bindings` before forwarding; shell-initiated action triggers use `keys.action`.
- `buildShellCapabilities()` advertises only live domains (including `dm` when the host adapter provides `hooks.dm`); disabled domains are absent from the delivered `domains` and named services snapshots.

### NAP-INC binding and channel contract

The injected INC binding tracks [NAP-INC PR #89 at
`4593ce9e301ce098fd3dad64206fcd6f144fa7af`](https://github.com/napplet/naps/pull/89),
the [web projection PR #90 at
`896c32c92deee68dc4d10fc1132b62df20cccb6f`](https://github.com/napplet/naps/pull/90),
and the stacked [symmetric-channel clarification PR #92 at
`c5cd06f7be6d4690b303949abb26e87ff62f4729`](https://github.com/napplet/naps/pull/92).
They are draft living references, so this package links to them rather than
copying normative protocol text.

`window.napplet.inc` alone owns projection-side query-to-text-payload
transposition: it converts a convention URI query before emitting a stable,
exact queryless topic identity. Subscriptions reject query-bearing identities.
The binding never creates a normalized query-bearing wire/discovery identity,
does not do prefix/wildcard/query-aware matching or service-over-INC prefix
dispatch, and does not infer payload kinds. Runtime delivery supplies the
**runtime-attested dTag**; no caller sender is accepted, topic source exclusion
is runtime-owned, and IDs and payloads are opaque.

For channels, runtime ACL checks are open-only rather than per-message. The
target `inc.channel.opened` before the opener result creates an equivalent target
handle; `channel.onOpened` exposes it, while symmetric handles expose `on` and
`onClosed`. The binding retains inbound, early, and terminal lifecycle state in
order, closes on bounded overflow, and treats teardown as deterministic.
`channel.list()` is informational only. The downstream tracker is
[`kehto/web#203`](https://github.com/kehto/web/issues/203), with its [upstream
resolution reply](https://github.com/kehto/web/issues/203#issuecomment-5060904495);
the prior opener-only interpretation is obsolete.

Phase scope remains explicit: **Phase 104** owns public #91 NAP-INTENT binding,
resolution, and delivery changes; **Phase 105** owns released package adoption.
Do not claim published package conformance before Phase 105. Preserve historical
changelogs and archived planning rather than rewriting them as active guidance.

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
  'notify',
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
- `buildShellCapabilities` — construct the immutable domain-only `ShellCapabilities` payload emitted during the `shell.ready` / `shell.init` handshake
- `resolveShellEnvironment(hooks, identity)` — host-integrator-only utility that narrows the live environment for a trusted creation-time identity before `shell.init`; it is not installed on `window.napplet` and is not a shim-facing napplet API
- `injectNappletNamespacePrelude` — insert a host-owned NIP-5D `window.napplet` callable-domain prelude into verified HTML before authored scripts
- `renderNappletNamespacePrelude` — render only the bootstrap `<script>` for hosts that already own HTML insertion

### Domain proxies (NIP-5D composition seams)
- `createIdentityProxy` — intercept `identity.getProfile/getFollows/...` traffic
- `createThemeProxy` — intercept `theme.get/theme.changed`
- `createKeysProxy` — intercept `keys.bind/unbind/bindings`
- `createMediaProxy` — intercept `media.*` playback control
- `createNotifyProxy` — intercept `notify.send/list/read/dismiss`

### Session / origin registry
- `sessionRegistry` — canonical windowId ↔ verified-napplet registry singleton
- `nappKeyRegistry` — deprecated alias for `sessionRegistry`
- `originRegistry` — origin-to-windowId map used by proxies and bridge broadcasts
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
Exported for host-app integration: `ShellAdapter`, `ShellCapabilities`, `CapabilityHooks`, `OriginIdentity`, `RelayPoolHooks`, `RelayPoolLike`, `RelayConfigHooks`, `WindowManagerHooks`, `AuthHooks`, `ConfigHooks`, `HotkeyHooks`, `WorkerRelayHooks`, `WorkerRelayLike`, `CryptoHooks`, `DmHooks`, `UploadHooks`, `IntentHooks`, `LinkHooks`, `CommonHooks`, `ListsHooks`, `SerialHooks`, `BleHooks`, `WebrtcHooks`, `SessionEntry`, `NappKeyEntry` (deprecated), `AclEntry`, `AclCheckEvent`, `UnroutedMessageInfo`, `ServiceDescriptor`, `ServiceHandler`, `ServiceRegistry`, `NostrEvent`, `NostrFilter`, `NappletMessage`, `ConsentRequest`, and per-proxy `*Deps`/`*Proxy` interfaces.

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
