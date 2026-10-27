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
| Version | `0.24.5` |
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
| Verified documents and CSP | `prepareNappletSrcdoc`, `NappletSrcdocOptions`, `buildNappletCsp`, `renderNappletCspMeta`, `injectNappletCsp`, `NappletCspOptions`, `NappletCspDirectives`, `NappletCspDirective` |
| Registries and caches | `sessionRegistry`, `nappKeyRegistry`, `originRegistry`, `manifestCache`, `audioManager`, `PendingUpdate`, `ManifestCacheEntry`, `AudioSource` |
| Enforcement re-exports | `createEnforceGate`, `createNapEnforceGate`, `formatDenialReason`, `EnforceResult`, `EnforceConfig`, `NapEnforceConfig`, `IdentityResolver`, `AclChecker`, `NapMessage` |
| Proxies | `createIdentityProxy`, `createThemeProxy`, `createKeysProxy`, `createMediaProxy`, `createNotifyProxy` |
| Shell-owned internal models | resource request/result/error types |
| Topics | `TOPICS`, `TopicKey`, `TopicValue` |

## Scope Boundaries

- Owns browser integration: `window`, `postMessage`, iframe session identity, verified document preparation, shell capabilities, origin/session registries, and browser-specific adapters.
- Forwards an asynchronous `RelayPoolLike.publish()` promise through its
  runtime adapter so `relay.publish.result` reflects transport settlement.
- Forwards the originating runtime window to `AuthHooks.getSigner(windowId?)`
  when available. The optional context lets a host implement caller-aware
  signer consent without making that policy part of Kehto's shell adapter.
- Preserves an asynchronous `RelayPoolHooks.publishToScopedRelay()` result so
  scoped publication does not report success before transport acceptance.
- Provides `prepareNappletSrcdoc()` outside verified bytes and exposes only host-selected domains before authored scripts. Optional SHELL provides environment information; source-bound routing does not depend on readiness. See [NAP-SHELL](https://github.com/napplet/naps/blob/master/naps/NAP-SHELL.md).
- Its injected resource projection carries NAP-RESOURCE's optional per-resource Blossom `servers`, including the canonical bulk `requests: [{ url, servers? }]` shape.
- Advertises `count` in shell capabilities and the injected `window.napplet` namespace only when `ShellAdapter.services.count` is wired, so `shell.supports("count")` tracks an actual NAP-COUNT backend.
- Surfaces unroutable inbound messages via the optional `ShellAdapter.onUnroutedMessage` hook (`UnroutedMessageInfo`) — observe-only; the bridge still drops messages from unidentified or unregistered windows, but hosts can now log them instead of debugging a silent vanish.
- Advertises and injects `dm` or `fs` only when the matching runtime service is registered and host domain policy permits it.
- Treats `keys.forward` as napplet-to-shell only; shell-initiated key actions are emitted as `keys.action` through the keys proxy/runtime service path.
- Keeps identity/theme proxy delivery fail-closed. Hosts publish automatic changes only through `ShellBridge.publishIdentityChanged()` / `publishTheme()`, which filter by live session, granted domain, and current ACL.
- Lets `bridge.runtime.aclState.persist()` and `clear()` report a browser
  `localStorage` write failure as `false`. The mutation remains live, while a
  fresh bridge continues to load the previous durable ACL until a retry
  succeeds. This host adapter behavior changes no NAP wire message or field;
  unrelated persistence adapters remain best-effort.
- Must not expose `window.nostr` to napplets.
- Does not implement service behavior itself; register reference services from `@kehto/services` on the underlying runtime.

## API Reference

### Source environment lifetime

Retire a window with `bridge.runtime.destroyWindow(windowId)`,
`bridge.runtime.sessionRegistry.unregister(windowId)`, and
`originRegistry.unregister(windowId)`. A replacement `originRegistry.register()`
gets its own environment, even if it reuses the source object and logical window
ID. Set its snapshot with `originRegistry.setEnvironment()` before dispatch;
otherwise the bridge resolves current host defaults. Retired cached domains and
service names cannot carry into the replacement's `shell.init` or domain admission.
Other domains remain usable before optional readiness, and duplicate readiness
messages do not replace a live session or send another snapshot.

This host lifecycle policy follows
[NAP-SHELL at `19de5ce`](https://github.com/napplet/naps/blob/19de5ce1cea40cd4c76089cdd8126e9f87648049/naps/NAP-SHELL.md)
and changes no wire messages.

For host CSP examples and validation rules, see
[Host CSP overrides](https://github.com/kehto/web/blob/main/packages/shell/README.md#host-csp-overrides) and the
[CSP enforcement contract](https://github.com/kehto/web/blob/main/docs/policies/NIP-5D-CONFORMANCE.md#shell-csp-enforcement).
The preparation API accepts already-verified HTML; it does not replace artifact
verification, iframe sandboxing, identity registration or message-source checks.

- Generated module: <a href="../api/modules/_kehto_shell.html" target="_self"><code>docs/api/modules/_kehto_shell.html</code></a>

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

## URI invocation

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

## GAMEPAD integration

This non-normative guidance defers to the living [NAP-GAMEPAD](https://github.com/napplet/naps/pull/108). Services export `createGamepadService` and `browserGamepadOptions`; shell exports `denyNappletControllerAccess`. Paja and the playground register one host reader and deny native gamepad/HID/USB paths before frame execution. Source-bound subscriptions receive immediate full snapshots; only the visible host's input owner gets live controls. Focus loss supplies neutral controls and timestamp zero; unsubscribe, window destruction, and service removal release polling. Non-browser or denied native readers report the proposal's unavailable reasons. See [Controller input](https://github.com/kehto/web/blob/main/docs/gamepad.md).

## UUID support on HTTP origins

Shell event injection, cache queries, and source-session registration use native
`crypto.randomUUID()` when available. On browsers that omit it (including
non-localhost plain HTTP origins), the shell generates UUID v4 identifiers from
16 `crypto.getRandomValues()` bytes. If both methods are unavailable, UUID
creation throws an explicit capability error. This internal host UUID helper
never falls back to weak randomness; other identifier generators are outside
its scope. It does not provide secure-context APIs such as `crypto.subtle` on
HTTP, so this change does not establish HTTP support for uploads or other domains.

This is a supported platform capability choice, not a deprecated caller API.
Both standard Web Crypto paths remain quiet. Source-bound identity and optional
shell readiness are unchanged (NAP-SHELL at `napplet/naps`
`1e1046bcadabbc552804f6d3354f565184f9fefb`).
