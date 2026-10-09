# @kehto/shell

Browser adapter over `@kehto/runtime` for iframe/session hosting.

> **Alpha status:** Kehto is an early runtime toolkit for a draft NIP-5D
> protocol. Injected-domain behavior and NAP contracts are not final.

## Install

```bash
pnpm add @kehto/shell @kehto/runtime @kehto/acl @napplet/core @napplet/nap nostr-tools
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/shell/package.json`, `packages/shell/src/index.ts` |
| Version | `0.21.2` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/acl`, `@kehto/runtime` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.32.0 <0.33.0` |
| `@napplet/nap` | `>=0.32.0 <0.33.0` |
| `nostr-tools` | `>=2.23.3 <=2.x` |

## Primary APIs

| Area | Exports |
|------|---------|
| Factory | `createShellBridge`, `ShellBridge` |
| Hooks | `adaptHooks`, `BrowserDeps`, `ShellAdapter`, `ShellCapabilities`, `UploadHooks`, `IntentHooks`, `LinkHooks`, `CommonHooks`, `ListsHooks`, `SerialHooks`, `BleHooks`, `WebrtcHooks`, `DmHooks`, `UnroutedMessageInfo` |
| Protocol and capability types | `NostrEvent`, `NostrFilter`, `NappletMessage`, `Capability`, `ALL_CAPABILITIES` |
| Shell init and bootstrap | `buildShellCapabilities`, `injectNappletNamespacePrelude`, `renderNappletNamespacePrelude`, `NappletNamespacePreludeOptions` |
| Registries and caches | `sessionRegistry`, `nappKeyRegistry`, `originRegistry`, `manifestCache`, `audioManager`, `PendingUpdate`, `ManifestCacheEntry`, `AudioSource` |
| Enforcement re-exports | `createEnforceGate`, `createNapEnforceGate`, `formatDenialReason`, `EnforceResult`, `EnforceConfig`, `NapEnforceConfig`, `IdentityResolver`, `AclChecker`, `NapMessage` |
| Proxies | `createIdentityProxy`, `createThemeProxy`, `createKeysProxy`, `createMediaProxy`, `createNotifyProxy` |
| Shell-owned internal models | resource request/result/error types |
| Topics | `TOPICS`, `TopicKey`, `TopicValue` |

## Scope Boundaries

- Owns browser integration: `window`, `postMessage`, iframe session identity, gateway loading, shell capabilities, origin/session registries, and browser-specific adapters.
- Forwards an asynchronous `RelayPoolLike.publish()` promise through its
  runtime adapter so `relay.publish.result` reflects transport settlement.
- Forwards the originating runtime window to `AuthHooks.getSigner(windowId?)`
  when available. The optional context lets a host implement caller-aware
  signer consent without making that policy part of Kehto's shell adapter.
- Preserves an asynchronous `RelayPoolHooks.publishToScopedRelay()` result so
  scoped publication does not report success before transport acceptance.
- Provides `injectNappletNamespacePrelude()` for optional NIP-5D domains plus mandatory NAP-SHELL before authored `srcdoc` scripts execute. The prelude installs its receiver before one `shell.ready`, caches the first parent `shell.init`, and prevents napplet namespace reassignment from removing `shell`.
- Its injected resource projection carries NAP-RESOURCE's optional per-resource Blossom `servers`, including the canonical bulk `requests: [{ url, servers? }]` shape.
- The published `@napplet/core@0.32.0` and `@napplet/shim@0.30.0` line does not supply a generic mandatory shell surface. Kehto therefore retains this host-owned prelude under NAP-SHELL `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24` until an upstream correction is reviewed.
- Advertises `count` in shell capabilities and the injected `window.napplet` namespace only when `ShellAdapter.services.count` is wired, so `shell.supports("count")` tracks an actual NAP-COUNT backend.
- Surfaces unroutable inbound messages via the optional `ShellAdapter.onUnroutedMessage` hook (`UnroutedMessageInfo`) — observe-only; the bridge still drops messages from unidentified or unregistered windows, but hosts can now log them instead of debugging a silent vanish.
- Advertises and injects `dm` or `fs` only when the matching runtime service is registered and host domain policy permits it.
- Treats `keys.forward` as napplet-to-shell only; shell-initiated key actions are emitted as `keys.action` through the keys proxy/runtime service path.
- Keeps identity/theme proxy delivery fail-closed. Hosts publish automatic changes only through `ShellBridge.publishIdentityChanged()` / `publishTheme()`, which filter by live session, granted domain, and current ACL.
- Must not expose `window.nostr` to napplets.
- Does not implement service behavior itself; register reference services from `@kehto/services` on the underlying runtime.

## API Reference

- Generated module: <a href="../api/modules/_kehto_shell.html" target="_self"><code>docs/api/modules/_kehto_shell.html</code></a>

## NIP-5D event compatibility

Current manifests use a direct artifact `x` hash, plain-text `content`, independent
`z`/`i` routing declarations, and required `R` / optional `O` domains. Kehto also
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
This aligns delivery with NAP-INTENT at `25b29ee`; broader invocation/result
changes and the packaged SDK upgrade remain deferred.
