# @kehto/runtime

Browser-agnostic protocol engine for the napplet protocol.

## Install

```bash
pnpm add @kehto/runtime
```

## Overview

`@kehto/runtime` is the canonical v1.2 NIP-5D protocol engine. It owns every incoming napplet message, gates it through the ACL enforcement layer, routes it to the correct NUB handler, and emits the corresponding reply envelope.

The runtime is built around the canonical dispatch contract from `@napplet/core` — `createDispatch()` + `registerNub()` — so routing is declarative, not a hand-rolled switch. Covers all eight canonical NIP-5D domains end-to-end:

- **identity** — `identity.getProfile`, `identity.getFollows`, `identity.getPublicKey`, …
- **ifc** — `ifc.channel.*`, `ifc.emit`, cross-napplet pub/sub
- **keys** — `keys.forward`, `keys.action`, `keys.bind`
- **media** — `media.*` playback & transport control
- **notify** — `notify.send`, `notify.channel.register`, badge/permission flows
- **relay** — `relay.publish`, `relay.publishEncrypted`, `relay.subscribe`
- **storage** — `storage.get/set/remove/keys` with quota enforcement
- **theme** — `theme.get`, `theme.changed` fan-out

Signing is shell-mediated inside `relay.publish` / `relay.publishEncrypted` (NIP-44 default, NIP-04 opt-in). The legacy signer domain is dissolved — napplets never see a host-injected nostr object and cannot call signer-sign RPCs directly.

Everything plugs into a single factory, `createRuntime()`, via a `RuntimeAdapter` hook bag — persistence, relay pool, auth, services, and so on. No DOM, no postMessage, no localStorage: those live in `@kehto/shell`.

## Quick Start

```ts
import { createRuntime } from '@kehto/runtime';

const runtime = createRuntime({
  aclPersistence: aclStore,
  manifestPersistence: manifestStore,
  relayPool: myRelayPoolAdapter,
  auth: myAuthAdapter,
  // ... further adapter hooks
});

// Incoming canonical v1.2 envelope from a napplet:
runtime.handleMessage('window-1', {
  type: 'relay.publish',
  id: 'evt-42',
  event: { kind: 1, content: 'hello', /* ... */ },
});
```

## Public API

### Runtime factory
- [`createRuntime`](../../docs/api/functions/_kehto_runtime.createRuntime.html) — primary entry point; `Runtime` interface type

### Enforcement gate
- [`createEnforceGate`](../../docs/api/functions/_kehto_runtime.createEnforceGate.html) — legacy pubkey-keyed ACL gate
- [`createNubEnforceGate`](../../docs/api/functions/_kehto_runtime.createNubEnforceGate.html) — NIP-5D windowId-keyed ACL gate
- [`resolveCapabilities`](../../docs/api/functions/_kehto_runtime.resolveCapabilities.html) — map a NIP-01 message to required capabilities
- [`resolveCapabilitiesNub`](../../docs/api/functions/_kehto_runtime.resolveCapabilitiesNub.html) — map a NIP-5D envelope to required capabilities (re-exported from `@kehto/acl`)
- [`formatDenialReason`](../../docs/api/functions/_kehto_runtime.formatDenialReason.html) — `denied: <capability>` canonical string

### Session registry
- [`createSessionRegistry`](../../docs/api/functions/_kehto_runtime.createSessionRegistry.html) — bidirectional windowId ↔ `SessionEntry` store
- `createNappKeyRegistry` — deprecated alias retained for v1.1 migration consumers

### ACL state container
- [`createAclState`](../../docs/api/functions/_kehto_runtime.createAclState.html) — persistence-backed wrapper around `@kehto/acl` state

### Manifest cache
- [`createManifestCache`](../../docs/api/functions/_kehto_runtime.createManifestCache.html) — NIP-5A aggregate-hash cache with persistence hooks

### Replay detection
- [`createReplayDetector`](../../docs/api/functions/_kehto_runtime.createReplayDetector.html) — duplicate-event + timestamp-window guard

### Event buffer
- [`createEventBuffer`](../../docs/api/functions/_kehto_runtime.createEventBuffer.html) — ring buffer with subscription delivery
- [`matchesFilter`](../../docs/api/functions/_kehto_runtime.matchesFilter.html), [`matchesAnyFilter`](../../docs/api/functions/_kehto_runtime.matchesAnyFilter.html) — pure NIP-01 filter helpers
- `RING_BUFFER_SIZE` — default ring buffer capacity constant

### State handler
- [`handleStateRequest`](../../docs/api/functions/_kehto_runtime.handleStateRequest.html) — legacy NIP-01 state operations
- [`handleStorageNub`](../../docs/api/functions/_kehto_runtime.handleStorageNub.html) — canonical `storage.*` NIP-5D handler
- [`cleanupNappState`](../../docs/api/functions/_kehto_runtime.cleanupNappState.html) — remove persisted state when a napplet window closes

### Service dispatch
- [`routeServiceMessage`](../../docs/api/functions/_kehto_runtime.routeServiceMessage.html) — domain-prefix router into the service registry
- [`notifyServiceWindowDestroyed`](../../docs/api/functions/_kehto_runtime.notifyServiceWindowDestroyed.html) — lifecycle fan-out to every service handler

### Service discovery (kind 29010)
- [`createServiceDiscoveryEvent`](../../docs/api/functions/_kehto_runtime.createServiceDiscoveryEvent.html) — synthesize a discovery event from a handler descriptor
- [`handleDiscoveryReq`](../../docs/api/functions/_kehto_runtime.handleDiscoveryReq.html), [`isDiscoveryReq`](../../docs/api/functions/_kehto_runtime.isDiscoveryReq.html) — discovery REQ lifecycle helpers

### Types
40+ interfaces — including `Runtime`, `RuntimeAdapter`, `SendToNapplet`, `RelayPoolAdapter`, `ServiceHandler`, `ServiceRegistry`, `NappletMessage`, `SessionEntry`, `AclEntryExternal`, `AclCheckEvent`, and the per-adapter hook types — are exported from `./types.js` for host-app integration.

### Compat re-exports (DRIFT-CORE-06)

Retained for v1.1 migration consumers; new integrations should use canonical NIP-5D envelope types from `@napplet/core`. Slated for removal once upstream restores those exports.

Re-exported constants cover the v1.1 bus-kind enum, auth event kind, shell bridge URI, protocol version string, the full capability list, destructive-kind set, and the replay window seconds. Re-exported types cover the v1.1 capability union, bus-kind numeric union, and service descriptor shape. See the typedoc API reference below for the exact identifier list and current numeric values.

## API Reference

Full API reference: [docs/api/@kehto/runtime/](../../docs/api/modules/_kehto_runtime.html) (generated via `pnpm docs:api`).

## License

MIT
