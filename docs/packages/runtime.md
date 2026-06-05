# @kehto/runtime

Browser-agnostic protocol engine for NIP-5D napplet hosting.

> **Alpha status:** Kehto is an early runtime implementation for a draft NIP-5D
> protocol. Runtime APIs and NUB dispatch contracts are not final.

## Install

```bash
pnpm add @kehto/runtime @kehto/acl @napplet/core @napplet/nub
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/runtime/package.json`, `packages/runtime/src/index.ts` |
| Version | `0.3.0` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/acl`, `@noble/hashes`, `@noble/curves` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `^0.3.0` |
| `@napplet/nub` | `^0.3.0` |

## Primary APIs

| Area | Exports |
|------|---------|
| Factory | `createRuntime`, `Runtime` |
| Adapter types | `RuntimeAdapter`, `SendToNapplet`, `RelayPoolAdapter`, `CacheAdapter`, `AuthAdapter`, `Signer`, `ConfigAdapter`, `HotkeyAdapter`, `CryptoAdapter`, `WindowManagerAdapter`, `RelayConfigAdapter`, `DmAdapter` |
| Enforcement | `createEnforceGate`, `createNubEnforceGate`, `resolveCapabilitiesNub`, `formatDenialReason`, `EnforceResult`, `EnforceConfig`, `NubEnforceConfig`, `IdentityResolver`, `AclChecker`, `NubMessage` |
| Session and manifests | `createSessionRegistry`, `createNappKeyRegistry`, `createManifestCache`, `SessionRegistry`, `NappKeyRegistry`, `ManifestCache` |
| State and replay | `createAclState`, `handleStorageNub`, `cleanupNappState`, `createReplayDetector`, `createEventBuffer`, `matchesFilter`, `matchesAnyFilter`, `RING_BUFFER_SIZE` |
| Service dispatch | `routeServiceMessage`, `notifyServiceWindowDestroyed`, `ServiceHandler`, `ServiceRegistry`, `ServiceInfo` |
| Re-exports | `Capability`, `ALL_CAPABILITIES`, `ServiceDescriptor` |

## Scope Boundaries

- Owns message dispatch, ACL gates, service routing, storage handling, manifest cache, replay checks, and runtime lifecycle.
- Does not own browser `window`, iframe creation, DOM, `postMessage` listeners, or localStorage implementation details.
- Browser concerns live in `@kehto/shell`.

## API Reference

- Generated module: <a href="../api/modules/_kehto_runtime.html" target="_self"><code>docs/api/modules/_kehto_runtime.html</code></a>
