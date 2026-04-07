# Feature Landscape: NIP-5D Migration & Gap Analysis

**Domain:** Napplet protocol runtime — shell-side implementation
**Researched:** 2026-04-07
**Confidence:** HIGH — all findings sourced directly from live code in napplet/ and kehto/

---

## Context: What Changed in NIP-5D

The NIP-5D spec (v0.1.0, JSON envelope era) replaces the prior NIP-01 bus wire format with a structured JSON envelope protocol. The core change:

**Before (NIP-01 bus):**
```
napplet → shell:  ['EVENT', event]  ['REQ', subId, ...filters]  ['REGISTER', payload]
shell → napplet:  ['EVENT', subId, event]  ['OK', id, true, '']  ['IDENTITY', payload]
```

**After (NIP-5D JSON envelope):**
```
napplet → shell:  { type: 'relay.subscribe', id, subId, filters }
shell → napplet:  { type: 'relay.event', subId, event }
```

The new spec also eliminates the explicit REGISTER/IDENTITY/AUTH handshake verbs. Identity is now assigned at iframe creation via `MessageEvent.source` mapping — no negotiation. NUBs (Napplet Unified Blueprints) define all message domains. `window.napplet.shell.supports(nubName)` replaces the old capability flags.

The shim (`@napplet/shim`) has already been fully migrated to envelope format. The kehto runtime still handles only NIP-01 arrays. This is the primary gap.

---

## Table Stakes

Features that must exist for the migration to be complete. Missing any = kehto does not implement current NIP-5D.

| Feature | Why Required | Complexity | Depends On |
|---------|--------------|------------|------------|
| **Runtime: JSON envelope dispatch** | `shell-bridge.ts` currently rejects non-array messages (`!Array.isArray(msg)`). The shim sends `{ type: 'relay.subscribe', ... }`. Nothing works without this. | Medium | @napplet/core dispatch infra already exists (`registerNub`, `dispatch`) |
| **Runtime: relay NUB handler** | Replaces NIP-01 REQ/CLOSE/EVENT verbs. Shell must handle `relay.subscribe`, `relay.close`, `relay.publish`, `relay.query`. | Medium | @napplet/nub-relay types already defined |
| **Runtime: signer NUB handler** | Replaces NIP-01 signer-over-bus. Shell must handle `signer.getPublicKey`, `signer.signEvent`, `signer.getRelays`, `signer.nip04.*`, `signer.nip44.*`. | Medium | @napplet/nub-signer types already defined |
| **Runtime: storage NUB handler** | Replaces NIP-01 state-handler. Shell must handle `storage.get`, `storage.set`, `storage.remove`, `storage.keys`. | Low | @napplet/nub-storage types; StatePersistence adapter unchanged |
| **Runtime: ifc NUB handler** | Replaces NIP-01 IPC-PEER (kind 29003) routing. Must handle `ifc.emit`, `ifc.subscribe`, `ifc.unsubscribe`, `ifc.event`, and optionally channel messages. | Medium | @napplet/nub-ifc types already defined |
| **Runtime: `SendToNapplet` signature change** | Currently `SendToNapplet = (windowId, msg: unknown[]) => void`. Must also support sending JSON envelope objects. Options: union type or replace entirely. | Low | All call sites in runtime.ts and service-dispatch.ts |
| **Shell: `handleMessage` accepts objects** | `shell-bridge.ts` line 155: `if (!Array.isArray(msg) || msg.length < 2) return;` — this guard drops all envelope messages. Must route objects to envelope handler and arrays to legacy handler (or drop legacy). | Low | envelope dispatch in runtime |
| **Migration doc: @kehto/acl** | Package itself doesn't change (pure capability bitfield module). Doc must confirm ACL caps map correctly to new NUB domains. | Low | No code changes expected |
| **Migration doc: @kehto/runtime** | Largest surface area. Documents removed NIP-01 verbs, new NUB handlers, changed internal types (SendToNapplet, ServiceHandler). | High | All other migration docs |
| **Migration doc: @kehto/shell** | ShellBridge.handleMessage guard change. ShellAdapter interface audit. Services interface change if ServiceHandler changes. | Medium | @kehto/runtime migration |
| **Migration doc: @kehto/services** | ServiceHandler.handleMessage currently receives NIP-01 arrays. Under envelope format it would receive typed NUB messages. Must document the interface change and provide before/after. | Medium | @kehto/runtime migration |
| **Gap analysis document** | Comparison of previous spec vs NIP-5D v0.1.0. Identifies removed, changed, and added concepts. | Medium | All of the above |

---

## window.napplet Interface Changes

The `NappletGlobal` interface in `@napplet/core` defines five namespaces. Per the milestone context, "almost all are now optional." Here is the current state sourced from the code:

### Current NappletGlobal (from @napplet/core/src/types.ts)

All five namespaces are **required** (no `?` modifier) in the TypeScript interface:

```ts
interface NappletGlobal {
  relay: { subscribe, publish, query }     // required
  ipc: { emit, on }                        // required
  services: { list, has }                  // required
  storage: { getItem, setItem, removeItem, keys }  // required
  shell: NappletGlobalShell                // required (just supports())
}
```

The shim (`@napplet/shim/src/index.ts`) installs all five at runtime. The `shell.supports()` stub returns `false` with a TODO comment — it is not yet connected to actual shell capability data.

### NUB Domains (from @napplet/core/src/envelope.ts)

Five NUB domains are recognized by the type system:
- `relay` — NIP-01 relay proxy (subscribe, publish, query)
- `signer` — NIP-07/NIP-44 signing delegation
- `storage` — Scoped key-value storage proxy
- `ifc` — Inter-frame communication (topic pub/sub + channels)
- `theme` — Read-only shell theme access (NEW)

The `theme` NUB is entirely new — not present in the previous NIP-01 bus implementation.

### NIP-5D Spec Position on Optional Interfaces

NIP-5D v0.1.0 specifies:
- Shells MUST implement `window.napplet.shell.supports()` — the only mandatory method
- `window.napplet.services.has()` is mentioned as service discovery API
- All NUB interfaces are optional: shells MAY support any subset
- Napplets MUST gracefully degrade when a capability is absent

This means the migration impact on kehto is: the packages must handle NUB messages when they exist, but the ShellAdapter interface gains optional fields, not required ones.

---

## New NUBS Interfaces

### Theme NUB (window.napplet.theme) — Net New

The `@napplet/nub-theme` package defines a theme interface not present in the previous system:

| Message | Direction | Payload |
|---------|-----------|---------|
| `theme.get` | napplet → shell | `{ id }` |
| `theme.get.result` | shell → napplet | `{ id, theme?, error? }` |
| `theme.changed` | shell → napplet | `{ theme }` (push, no id) |

Theme payload structure:
```ts
interface Theme {
  colors: { background, text, primary }  // required
  fonts?: { body?, title? }              // optional
  background?: { url, mode, mime }       // optional
  title?: string                         // optional
}
```

Kehto has no current theme handling. This NUB requires:
- A new handler in `@kehto/runtime` for `theme.*` messages
- A new adapter interface `ThemeAdapter` to provide theme data to the runtime
- A `theme` entry in `ShellAdapter`

### IFC Channel Mode — Net New within IFC NUB

The IFC NUB has two modes. The previous NIP-01 IPC-PEER bus only had the topic pub/sub mode. Channel mode is new:

| Message | Direction | Purpose |
|---------|-----------|---------|
| `ifc.channel.open` | napplet → shell | Open point-to-point channel |
| `ifc.channel.open.result` | shell → napplet | Channel ID or error |
| `ifc.channel.emit` | napplet → shell | Send on open channel |
| `ifc.channel.event` | shell → napplet | Receive on channel |
| `ifc.channel.broadcast` | napplet → shell | Broadcast to all channels |
| `ifc.channel.list` | napplet → shell | List open channels |
| `ifc.channel.list.result` | shell → napplet | Channel list |
| `ifc.channel.close` | napplet → shell | Close channel |
| `ifc.channel.closed` | shell → napplet | Channel closed notification |

Key difference from topic pub/sub: ACL is checked at `channel.open` time only. Subsequent messages on the channel bypass per-message ACL checks.

---

## Differentiators

Features that improve the migration quality beyond minimum correctness.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Legacy NIP-01 compatibility shim** | Allow old napplets still using NIP-01 bus to keep working during transition. Shell-bridge routes arrays to old handler, objects to envelope handler. | Low | The existing NIP-01 handler can coexist; just relax the guard in shell-bridge |
| **`shell.supports()` fully wired** | Currently returns `false` (stub). Wire it to report actual registered NUBs. Napplets need this for graceful degradation. | Low | Requires shell to pass capability data during iframe creation or via shim init message |
| **ServiceHandler: envelope-native interface** | Migrate `ServiceHandler.handleMessage(windowId, msg: unknown[], send)` to accept typed NUB messages instead of NIP-01 arrays. Eliminates legacy coupling from service layer. | Medium | Breaking change for existing @kehto/services implementations |
| **theme NUB in @kehto/shell** | Hook into shell adapter for theme data delivery. Enables napplets to match the host UI skin automatically. | Medium | New ShellAdapter.theme field; no existing infrastructure |

---

## Anti-Features

Features that would be harmful to include in this migration.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Force-remove NIP-01 bus** | Existing integrators (hyprgate) may still use NIP-01 arrays. Removing it breaks them immediately. | Deprecate: keep the array path working, add envelope path alongside it. Document removal timeline. |
| **Migrate @napplet/core types** | @napplet/core lives in the napplet repo, not kehto. Kehto is a consumer, not an owner. | Document the dependency version needed, update peer dep ranges. |
| **Rewrite ServiceHandler to be async** | Not required by NIP-5D. Current sync interface is fine for NUB routing. | Keep sync; handle async internally within service implementations if needed. |
| **Implement theme NUB in this milestone** | Requires new ShellAdapter integration that has no reference implementation yet. Scope creep. | Document as a gap (requires future NUB support), not a migration blocker. |

---

## Feature Dependencies

```
JSON envelope dispatch in runtime
  → relay NUB handler
  → signer NUB handler
  → storage NUB handler
  → ifc NUB handler (topic pub/sub)
      → ifc channel mode (optional extension)
  → theme NUB handler (new, optional)

shell-bridge guard relaxation
  → depends on: JSON envelope dispatch in runtime

SendToNapplet signature update
  → depends on: chosen dispatch strategy (parallel or replace)
  → gates: migration doc for @kehto/runtime
  → gates: migration doc for @kehto/services (ServiceHandler changes)

shell.supports() wired
  → depends on: shell-bridge passing capability list to shim
```

---

## Capability Mapping: Old Caps to New NUB Domains

The `Capability` type and `@kehto/acl` bitfields remain unchanged. The mapping to NUB domains is:

| Capability | NUB Domain | Notes |
|------------|-----------|-------|
| `relay:read` | `relay` | REQ/CLOSE enforcement → relay.subscribe/close |
| `relay:write` | `relay` | EVENT enforcement → relay.publish |
| `cache:read` | (internal) | Not a NUB; cache is now a shell implementation detail |
| `cache:write` | (internal) | Not a NUB; cache write goes through relay.publish path |
| `hotkey:forward` | (keyboard) | Not a NUB domain; keyboard.forward is a non-NUB envelope message |
| `sign:event` | `signer` | SIGNER_REQUEST → signer.signEvent |
| `sign:nip04` | `signer` | → signer.nip04.encrypt/decrypt |
| `sign:nip44` | `signer` | → signer.nip44.encrypt/decrypt |
| `state:read` | `storage` | STATE_REQUEST → storage.get/keys |
| `state:write` | `storage` | → storage.set/remove |

ACL enforcement logic in `@kehto/acl` is unaffected. Only the trigger points in the runtime handlers change (they now fire on NUB message types instead of NIP-01 verbs).

---

## MVP Recommendation

Minimum viable migration (all four packages functional with NIP-5D):

1. **Relax shell-bridge guard** — one-line change, enables envelope messages to reach runtime
2. **Add envelope dispatch path in runtime** — route `{ type }` objects through `@napplet/core` dispatch
3. **Implement relay, signer, storage NUB handlers** — direct port of existing NIP-01 verb handlers to envelope format
4. **Implement ifc topic pub/sub handler** — replace IPC-PEER (kind 29003) routing
5. **Write four migration docs + gap analysis** — primary deliverable of this milestone

Defer:
- **ifc channel mode**: No existing napplets use it. Implement after core NUBs are working.
- **theme NUB**: No @kehto/shell adapter support yet. Document as gap.
- **shell.supports() wiring**: Document the stub, flag as incomplete. Not blocking.
- **ServiceHandler envelope-native interface**: Keep as deprecation note, not a blocker.

---

## Sources

All findings are sourced directly from the live codebase. No external references needed.

- `/home/sandwich/Develop/kehto/nubs/SPEC.md` — NIP-5D v0.1.0 specification
- `/home/sandwich/Develop/napplet/packages/core/src/envelope.ts` — NubDomain, NappletMessage, ShellSupports
- `/home/sandwich/Develop/napplet/packages/core/src/types.ts` — NappletGlobal, Capability, legacy types
- `/home/sandwich/Develop/napplet/packages/core/src/legacy.ts` — Deprecated BusKind, VERB_REGISTER, etc.
- `/home/sandwich/Develop/napplet/packages/shim/src/index.ts` — Current window.napplet installation
- `/home/sandwich/Develop/napplet/packages/nubs/relay/src/types.ts` — relay NUB message types
- `/home/sandwich/Develop/napplet/packages/nubs/signer/src/types.ts` — signer NUB message types
- `/home/sandwich/Develop/napplet/packages/nubs/storage/src/types.ts` — storage NUB message types
- `/home/sandwich/Develop/napplet/packages/nubs/ifc/src/types.ts` — ifc NUB message types (incl. channel mode)
- `/home/sandwich/Develop/napplet/packages/nubs/theme/src/types.ts` — theme NUB message types
- `/home/sandwich/Develop/kehto/packages/shell/src/shell-bridge.ts` — Current NIP-01 array guard
- `/home/sandwich/Develop/kehto/packages/runtime/src/runtime.ts` — Current NIP-01 verb dispatch
- `/home/sandwich/Develop/kehto/packages/runtime/src/service-dispatch.ts` — ServiceHandler NIP-01 coupling
- `/home/sandwich/Develop/kehto/packages/acl/src/types.ts` — Capability bitfield constants
