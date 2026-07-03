# @kehto/shell

Browser adapter over `@kehto/runtime` for iframe/session hosting.

> **Alpha status:** Kehto is an early runtime implementation for a draft NIP-5D
> protocol. Injected-domain behavior and NAP contracts are not final.

## Install

```bash
pnpm add @kehto/shell @kehto/runtime @kehto/acl @napplet/core @napplet/nap nostr-tools
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/shell/package.json`, `packages/shell/src/index.ts` |
| Version | `0.16.3` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/acl`, `@kehto/runtime` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.23.0 <=0.27.x` |
| `@napplet/nap` | `>=0.23.0 <=0.27.x` |
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
| Proxies and forwarders | `createIdentityProxy`, `createThemeProxy`, `createKeysProxy`, `createMediaProxy`, `createNotifyProxy`, `createKeysForwarder` |
| Shell-owned internal models | resource request/result/error types |
| Topics | `TOPICS`, `TopicKey`, `TopicValue` |

## Scope Boundaries

- Owns browser integration: `window`, `postMessage`, iframe session identity, gateway loading, shell capabilities, origin/session registries, and browser-specific adapters.
- Provides `injectNappletNamespacePrelude()` for NIP-5D `window.napplet.<domain>` availability bootstraps before authored `srcdoc` scripts execute. Napplet-owned namespace assignments are filtered through the explicit bare-domain allowlist; the playground does not inject `shell`.
- Advertises `count` in shell capabilities and the injected `window.napplet` namespace only when `ShellAdapter.services.count` is wired, so `shell.supports("count")` tracks an actual NAP-COUNT backend.
- Surfaces unroutable inbound messages via the optional `ShellAdapter.onUnroutedMessage` hook (`UnroutedMessageInfo`) — observe-only; the bridge still drops messages from unidentified or unregistered windows, but hosts can now log them instead of debugging a silent vanish.
- Advertises `dm` in shell capabilities when `hooks.dm` is present, unless disabled by host domain policy.
- Must not expose `window.nostr` to napplets.
- Does not implement service behavior itself; register reference services from `@kehto/services` on the underlying runtime.

## API Reference

- Generated module: <a href="../api/modules/_kehto_shell.html" target="_self"><code>docs/api/modules/_kehto_shell.html</code></a>
