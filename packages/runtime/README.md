# @kehto/runtime

Browser-agnostic protocol engine for the napplet protocol.

> **Alpha status:** Kehto is an early runtime implementation for a draft NIP-5D
> protocol. NAP contracts and runtime APIs are not final; treat this package as
> current implementation guidance, not as a stable protocol guarantee.

## Install

```bash
pnpm add @kehto/runtime
```

## Overview

`@kehto/runtime` is Kehto's NIP-5D protocol engine. It owns every incoming napplet message, gates it through the ACL enforcement layer, routes it to the correct NAP handler, and emits the corresponding reply envelope.

The runtime is built around the current draft dispatch contract from `@napplet/core` — `createDispatch()` + `registerNub()` — so routing is declarative, not a hand-rolled switch. It covers the NIP-5D domains currently supported by Kehto:

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

// Incoming NIP-5D draft envelope from a napplet:
runtime.handleMessage('window-1', {
  type: 'relay.publish',
  id: 'evt-42',
  event: { kind: 1, content: 'hello', /* ... */ },
});
```

## Public API

### Runtime factory
- `createRuntime` — primary entry point; `Runtime` interface type

### Enforcement gate
- `createEnforceGate` — legacy pubkey-keyed ACL gate
- `createNubEnforceGate` — NIP-5D windowId-keyed ACL gate
- `resolveCapabilitiesNub` — map a NIP-5D envelope to required capabilities (re-exported from `@kehto/acl`)
- `formatDenialReason` — `denied: <capability>` canonical string

### Session registry
- `createSessionRegistry` — bidirectional windowId ↔ `SessionEntry` store
- `createNappKeyRegistry` — deprecated alias retained for v1.1 migration consumers

### ACL state container
- `createAclState` — persistence-backed wrapper around `@kehto/acl` state

### Manifest cache
- `createManifestCache` — NIP-5A aggregate-hash cache with persistence hooks

### Replay detection
- `createReplayDetector` — duplicate-event + timestamp-window guard

### Event buffer
- `createEventBuffer` — ring buffer with subscription delivery
- `matchesFilter`, `matchesAnyFilter` — pure NIP-01 filter helpers
- `RING_BUFFER_SIZE` — default ring buffer capacity constant

### State handler
- `handleStorageNub` — canonical `storage.*` NIP-5D handler
- `cleanupNappState` — remove persisted state when a napplet window closes

### Service dispatch
- `routeServiceMessage` — domain-prefix router into the service registry
- `notifyServiceWindowDestroyed` — lifecycle fan-out to every service handler

### Types
40+ interfaces — including `Runtime`, `RuntimeAdapter`, `SendToNapplet`, `RelayPoolAdapter`, `ServiceHandler`, `ServiceRegistry`, `NappletMessage`, `SessionEntry`, `AclEntryExternal`, `AclCheckEvent`, and the per-adapter hook types — are exported from `./types.js` for host-app integration.

### Compat re-exports (DRIFT-CORE-06)

Retained for migration consumers; new integrations should use current NIP-5D envelope types from `@napplet/core`. Slated for removal once upstream restores those exports.

Re-exported constants cover the v1.1 bus-kind enum, auth event kind, shell bridge URI, protocol version string, the full capability list, destructive-kind set, and the replay window seconds. Re-exported types cover the v1.1 capability union, bus-kind numeric union, and service descriptor shape. See the typedoc API reference below for the exact identifier list and current numeric values.

## API Reference

Full package docs: [`docs/packages/runtime.md`](../../docs/packages/runtime.md).
Generated API module: `docs/api/modules/_kehto_runtime.html` (run `pnpm docs:api`).

## License

MIT
