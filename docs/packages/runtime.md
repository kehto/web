# @kehto/runtime

Browser-agnostic protocol engine for NIP-5D napplet hosting.

> **Alpha status:** Kehto is an early runtime implementation for a draft NIP-5D
> protocol. Runtime APIs and NAP dispatch contracts are not final.

## Install

```bash
pnpm add @kehto/runtime @kehto/acl @napplet/core @napplet/nap
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/runtime/package.json`, `packages/runtime/src/index.ts` |
| Version | `0.20.1` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/acl`, `@noble/hashes`, `@noble/curves` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.31.0 <0.32.0` |
| `@napplet/nap` | `>=0.31.0 <0.32.0` |

## Primary APIs

| Area | Exports |
|------|---------|
| Factory | `createRuntime`, `Runtime` |
| Adapter types | `RuntimeAdapter`, `SendToNapplet`, `RelayPoolAdapter`, `CacheAdapter`, `AuthAdapter`, `Signer`, `ConfigAdapter`, `HotkeyAdapter`, `CryptoAdapter`, `WindowManagerAdapter`, `RelayConfigAdapter`, `DmAdapter` |
| Enforcement | `createEnforceGate`, `createNapEnforceGate`, `resolveCapabilitiesNap`, `formatDenialReason`, `EnforceResult`, `EnforceConfig`, `NapEnforceConfig`, `IdentityResolver`, `AclChecker`, `NapMessage` |
| Session and manifests | `createSessionRegistry`, `createNappKeyRegistry`, `createManifestCache`, `SessionRegistry`, `NappKeyRegistry`, `ManifestCache` |
| State and replay | `createAclState`, `handleStorageNap`, `cleanupNappState`, `createReplayDetector`, `createEventBuffer`, `matchesFilter`, `matchesAnyFilter`, `RING_BUFFER_SIZE` |
| Service dispatch | `routeServiceMessage`, `notifyServiceWindowDestroyed`, `ServiceHandler`, `ServiceRegistry`, `ServiceInfo` |
| Re-exports | `Capability`, `ALL_CAPABILITIES`, `ServiceDescriptor` |

## Scope Boundaries

- Owns message dispatch, ACL gates, service routing, storage handling, manifest cache, replay checks, and runtime lifecycle.
- Follows draft NAP-RELAY PR #2 at
  `0be8abce18beb46ca37bd4ddd042f58d30b4eedc`: `relay.publish` accepts an
  unsigned template, signs it through the shell-owned signer, publishes only
  the signed event, and returns canonical `{ ok, event, eventId }` or
  `{ ok: false, error }`. Async relay adapters settle before success is
  reported; failures are not buffered and release their pending replay
  reservation so the same deterministic signed event can be retried.
- Routes the NAP-COUNT `count.query` domain through a registered `count` service. The runtime validates non-empty filters and returns `count.query.result` refusals such as `invalid-filter` or `count-unavailable` instead of emulating counts by fetching event payloads.
- Routes service-only NAP domains such as `dm` through registered handlers, so chat backends stay outside core runtime dispatch.
- Does not own browser `window`, iframe creation, DOM, `postMessage` listeners, or localStorage implementation details.
- Browser concerns live in `@kehto/shell`.

## API Reference

- Generated module: <a href="../api/modules/_kehto_runtime.html" target="_self"><code>docs/api/modules/_kehto_runtime.html</code></a>
