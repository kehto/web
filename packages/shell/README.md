# @kehto/shell

Browser adapter over @kehto/runtime — ShellBridge and domain proxies.

> **Alpha status:** Kehto is an early runtime toolkit for a draft NIP-5D
> protocol. NAP contracts and injected-domain behavior are still draft; treat
> this package as current implementation guidance.

## Install

```bash
pnpm add @kehto/shell
```

## Published Napplet Compatibility

`@kehto/shell` publishes against `@napplet/core` and `@napplet/nap`
`>=0.32.0 <0.33.0`. The installed core 0.32.0 / nap 0.32.0 contracts follow
NAP-INTENT authority `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`, napplet/web#199
source `3037200c932488f14f7f369b8583c39c9c16510a` / merge
`b3f0007867eac109fa4917fac9c285d3b7cc6155`, and Version Packages #198 release
source `dc1d24153c759152b6ba31a6ec9bea967798f2df`.

## Overview

`@kehto/shell` is the browser-specific integration layer for kehto. It wraps `@kehto/runtime` with the window/postMessage transport, localStorage persistence hooks, an audio manager, and the five canonical per-domain proxies defined by NIP-5D.

The primary entry point is `createShellBridge()` — it owns the postMessage listener, the NAP-SHELL `shell.ready` / `shell.init` handshake, manifest verification, and every dispatch back into the runtime engine.

Current draft behaviors this package enforces:

- The shell does not inject a host-provided nostr object into napplets — NIP-5D explicitly forbids napplet-visible signing. Napplets call `relay.publish` / `relay.publishEncrypted` and the shell mediates the signing flow internally (NIP-44 default, NIP-04 opt-in for encrypted envelopes).
- `AuthHooks.getSigner(windowId?)` receives the originating iframe window ID
  when the runtime can identify it. The shell forwards this optional context
  without imposing a consent policy; host runtimes may ignore it or use it to
  resolve their own identity-scoped signer decisions.
- `prepareNappletSrcdoc()` inserts validated CSP first, then the NIP-5D bootstrap and mandatory NAP-SHELL shim, outside verified artifact bytes. The shim installs the parent-bound `shell.init` receiver, emits one `shell.ready`, and exposes callable NAP interfaces before authored scripts run. Optional namespaces are filtered to the bare-domain allowlist; `shell` is always retained. Published core 0.32.0 and shim 0.30.0 omit generic mandatory shell, so Kehto retains this host-owned prelude under NAP-SHELL `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24` until an upstream correction is reviewed.
- The injected resource projection follows draft NAP-RESOURCE `9511232f69313aa7953d110e35d32cc28d506f66`: `bytes(url, { servers? })` carries advisory Blossom locations and `bytesMany(requests)` keeps each `{ url, servers? }` entry intact.
- `window.napplet.shell.supports(domain)` answers synchronously and locally from the cached first `shell.init` environment. It returns `false` before `shell.init`, for unknown values, and for domains that are not live and granted to that napplet; it never sends a support-query message.
- Five optional per-domain proxies — `createIdentityProxy`, `createThemeProxy`, `createKeysProxy`, `createMediaProxy`, `createNotifyProxy` — can be composed between napplet and runtime to intercept request traffic per NAP. They are NOT wired by default. Identity/theme proxy `emit()` compatibility members fail closed; hosts must deliver automatic changes through `ShellBridge.publishIdentityChanged()` / `publishTheme()`, which enforce live session, granted domain, and current ACL.
- `keys.forward` is napplet-to-shell only. Active napplets suppress locally-bound keys from `keys.bindings` before forwarding; shell-initiated action triggers use `keys.action`.
- `buildShellCapabilities()` advertises only live domains. Registered `dm` and `fs` services are injected only when their handlers exist; disabled domains are absent from the delivered `domains` and named services snapshots.

### NAP-INC binding and channel contract

The injected INC binding follows merged
[`naps/NAP-INC.md`](https://github.com/napplet/naps/blob/5ac0490461ca6fec2f0d2e45b4835cf9bc08de24/naps/NAP-INC.md)
on `napplet/naps` master
`5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`. The specification remains marked
draft, but its merged path is the protocol authority.

The released package projection and `window.napplet.inc` binding own
query-to-text-payload
transposition: it converts a convention URI query before emitting a stable,
exact stable convention topic identity. Subscriptions reject query- or fragment-bearing
**convention** identities; arbitrary opaque topics remain byte-for-byte exact,
including `?` and `#`. The binding never creates a normalized query-bearing
wire/discovery identity,
does not do prefix/wildcard/query-aware matching or service-over-INC prefix
dispatch, and does not infer payload kinds. Runtime delivery supplies the
**runtime-attested dTag**; no caller sender is accepted, topic source exclusion
is runtime-owned, and IDs and payloads are opaque.

Merged NAP-INC and released `@napplet/nap@0.32.0` both deliver one `IncEvent`
to `on(topic, callback)`.

For channels, runtime ACL checks are open-only rather than per-message. The
target `inc.channel.opened` before the opener result creates an equivalent target
handle; `channel.onOpened` exposes it, while symmetric handles expose `on` and
`onClosed`. The binding retains inbound, early, and terminal lifecycle state in
order, closes on bounded overflow, and treats teardown as deterministic.
`channel.list()` is informational only. The downstream tracker is
[`kehto/web#203`](https://github.com/kehto/web/issues/203), with its [upstream
resolution reply](https://github.com/kehto/web/issues/203#issuecomment-5060904495);
the prior opener-only interpretation is obsolete.

### NAP-INTENT binding and delivery

Kehto follows [NAP-INTENT PR #106](https://github.com/napplet/naps/blob/fc121fc264615482143eda86125863d2e1f741a2/naps/NAP-INTENT.md) at `fc121fc264615482143eda86125863d2e1f741a2`. The protected binding supports
`window.napplet.intent.invoke('napplet:profile/open?pubkey=abc%2B123')` and
`invoke(uri, { payload, handler, handlerHint, behavior })`. Query fields decode
once into text; `+` remains literal. An explicit payload cannot accompany an
inner query, and a `#naddr` recommendation cannot accompany `handlerHint`.
Unsupported options and caller-supplied sender data are rejected. Only a
parent-originated correlated result can settle the call.

Successful results identify retained delivery responsibility with `ok`,
`archetype`, `action`, `convention`, and an opaque `handler`. A target receives
one parent-attested `intent.deliver`, buffered by `onDelivery` until registration.
Acceptance is separate from later target completion.

Legacy object-form `invoke(request)` and `open(archetype, payload?, opts?)`
remain bounded compatibility adapters and warn once per iframe with
`KEHTO_COMPAT_INTENT_OBJECT_INVOKE`. Their removal conditions are tracked in
[compatibility](https://github.com/kehto/web/blob/main/docs/compatibility.md).

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
- `prepareNappletSrcdoc` — recommended verified-document entry point; applies CSP and namespace together
- `buildNappletCsp`, `renderNappletCspMeta`, `injectNappletCsp` — shared policy construction and CSP-only composition utilities
- `buildShellCapabilities` — construct the immutable domain-only `ShellCapabilities` payload emitted during the `shell.ready` / `shell.init` handshake
- `resolveShellEnvironment(hooks, identity)` — host-integrator-only utility that narrows the live environment for a trusted creation-time identity before `shell.init`; it is not installed on `window.napplet` and is not a shim-facing napplet API
- `injectNappletNamespacePrelude` — low-level bootstrap-only insertion for development wrappers; does not apply CSP
- `renderNappletNamespacePrelude` — render only the bootstrap `<script>` for hosts that already own HTML insertion

### Host CSP overrides

Resolve and verify the signed manifest, aggregate and artifact bytes before
calling `prepareNappletSrcdoc`. Keep the verified bytes for identity and caching;
only the rendered copy receives policy and bootstrap. Bind the iframe window to
the verified identity before assigning `srcdoc`, with `sandbox="allow-scripts"`.

```ts
import { prepareNappletSrcdoc } from '@kehto/shell';

const srcdoc = prepareNappletSrcdoc(verifiedHtml, {
  domains: ['theme'],
  csp: {
    connectOrigins: ['https://api.example'],
    directives: { 'media-src': ['blob:'], 'img-src': ['data:'] },
  },
});
```

Omitting `csp` applies NIP-5D's conservative baseline, including WASM compilation.
Directive overrides replace individual source lists. They cannot disable CSP
insertion, allow `'unsafe-eval'`, or suppress the inline namespace bootstrap.
`connect-src` defaults to the exact `connectOrigins` grants and can be narrowed;
wildcards, scheme-wide grants, credentials, paths, query strings and fragments
are rejected. Empty source lists are rejected; use `["'none'"]` to deny a
directive. Hosts may remove WASM permission by setting
`'script-src': ["'unsafe-inline'"]`.

`script-src` and an explicit `script-src-elem` must permit the inline bootstrap.
Nonce/hash/`strict-dynamic` combinations that suppress that allowance are rejected;
nonce-based bootstrap authorization is not supported by this API. Existing
artifact CSP and inherited response policies still apply cumulatively and may
block execution; this helper never strips them to make a napplet run.

Meta-unsupported directives (`frame-ancestors`, `sandbox`, `report-uri`) and
unsupported directive names are rejected. Configure embedding restrictions on
the host HTTP response. See the [CSP enforcement contract](https://github.com/kehto/web/blob/main/docs/policies/NIP-5D-CONFORMANCE.md#shell-csp-enforcement)
for normative requirements, enforced recommendations and configurable defaults.

### Domain proxies (NIP-5D composition seams)
- `createIdentityProxy` — intercept identity read requests; direct `emit()` is prohibited
- `createThemeProxy` — intercept `theme.get`; direct `emit()` is prohibited
- `createKeysProxy` — intercept `keys.bind/unbind/bindings`
- `createMediaProxy` — intercept `media.*` playback control

### Protected identity and theme delivery

The injected identity/theme bindings follow NAP-IDENTITY and NAP-THEME at
`napplet/naps` master `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`.
They are readonly protected objects: identity exposes supported reads and
`onChanged`, while theme exposes `get` and `onChanged` only. Results and
automatic changes are accepted only when their `MessageEvent.source` is
`window.parent`; direct-domain and whole-namespace assignment cannot replace
the canonical operations.

`ShellBridge` delivers `identity.changed` and `theme.changed` exactly once per
eligible recipient: a live authenticated `shell.ready` session, its frozen
environment includes the relevant domain, and its current recipient read
capability is still granted. Identity sign-out is `pubkey: ""`. Theme updates
arrive only after the service has stored the complete color state. These are
automatic change messages, not NAP-INC/intent delivery and not a subscription
protocol. Kehto's denied/unavailable theme read policy is a complete fixed
normal result without `error`, deliberately avoiding a mixed theme/error
payload.
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

`RelayPoolLike.publish()` may return `Promise<void>` when transport acceptance
is asynchronous. The shell adapter forwards that promise so the runtime does
not acknowledge or buffer an event before the relay operation settles.
`RelayPoolHooks.publishToScopedRelay()` may likewise return
`Promise<boolean>` so asynchronous hosts report the settled outcome.

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

## NIP-5D event compatibility

Current manifests use a direct artifact `x` hash, plain-text `content`, role-matched
`z`/`i` intent declarations, and required `R` / optional `O` domains. Kehto also
accepts legacy aggregate events through an isolated compatibility adapter.
Existing `aggregateHash` host/cache/ACL fields carry the verified artifact hash
for current events; legacy identities keep their original aggregate. Both paths
verify signatures and bytes before runtime injection and `srcdoc` execution.
For the schema and removal boundary, see [event migration](https://kehto.github.io/web/docs/migrations/NIP-5D-EVENT-SCHEMA.html).

### Intent delivery

The injected `window.napplet.intent.onDelivery(handler)` returns a closeable
subscription and drains buffered parent deliveries in order. Register it to
receive `{ sender, archetype, action, convention, payload? }`; INC is not required.
Its receiver is installed before `shell.ready` and survives namespace reassignment.
A throwing listener does not prevent delivery to other listeners.

When no canonical listener is registered, matching legacy INC listeners can
consume the delivery locally. This emits `KEHTO_COMPAT_INTENT_INC` once per
iframe; a delivery is never replayed to both APIs. See [compatibility tracking](https://github.com/kehto/web/blob/main/docs/compatibility.md).
Delivery and URI invocation follow NAP-INTENT PR #106 at
`fc121fc264615482143eda86125863d2e1f741a2`; the packaged SDK still trails that
contract, as documented in the conformance policy.

## Paja URL integration

The shell normalizer also powers Paja intent links. See the
[Paja guide](https://kehto.github.io/web/docs/packages/paja.html#nap-intent-links-and-lifecycle)
for outer URL encoding, review, routing, and verified launcher behavior.
