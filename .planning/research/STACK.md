# Stack Research: NIP-5D Migration & Gap Analysis

**Domain:** Protocol migration — NIP-5D v0.1.0 wire format upgrade for kehto runtime packages
**Researched:** 2026-04-07
**Confidence:** HIGH — all findings sourced directly from live source files in both repos

---

## Executive Gap Analysis

NIP-5D v0.1.0 (the current spec in `napplet/specs/NIP-5D.md`) is a **breaking rewrite** of the wire format relative to the previous spec documented in kehto's `RUNTIME-SPEC.md`. The two specs describe fundamentally different wire protocols.

| Dimension | RUNTIME-SPEC.md (previous) | NIP-5D v0.1.0 (current) |
|-----------|---------------------------|--------------------------|
| Wire format | NIP-01 array tuples: `["VERB", ...]` | JSON objects with `type` field: `{ "type": "domain.action", ... }` |
| Protocol version constant | `2.0.0` | `4.0.0` |
| Signer messages | kind 29001/29002 NIP-01 events | `signer.*` envelope messages (`@napplet/nub-signer`) |
| Storage messages | kind 29003 IPC_PEER events with `t` topics | `storage.*` envelope messages (`@napplet/nub-storage`) |
| IFC/IPC messages | kind 29003 IPC_PEER events with `t` topics | `ifc.*` envelope messages (`@napplet/nub-ifc`) |
| Relay messages | `REQ`, `EVENT`, `CLOSE`, `EOSE`, `OK` verbs | `relay.*` envelope messages (`@napplet/nub-relay`) |
| Handshake | `REGISTER` → `IDENTITY` → `AUTH` array verbs | Same verbs (still array format — handshake is NOT migrated to envelope) |
| Service discovery | kind 29010 `BusKind.SERVICE_DISCOVERY` | `window.napplet.shell.supports('nub-name')` + `window.napplet.services.has()` |
| Sandbox requirement | `allow-scripts allow-forms allow-popups allow-modals allow-downloads` | `allow-scripts` only (minimum); shells may add others |
| Identity model | Shell assigns via REGISTER/IDENTITY/AUTH handshake | Shell maps `MessageEvent.source` to identity at iframe creation — no AUTH negotiation in spec |
| window.napplet | Not defined in spec (impl detail) | Spec mandates `window.napplet.shell.supports()` |

**Critical clarification:** The NIP-5D spec defines the *extension* architecture (NUBs, `window.napplet.shell.supports()`). The full handshake (REGISTER/IDENTITY/AUTH/kind 22242) is in RUNTIME-SPEC.md which is the internal implementation reference. NIP-5D deliberately omits implementation details. The @napplet libraries implement NIP-5D *plus* the handshake extension.

---

## Wire Format: Before vs After

### Previous Wire Format (RUNTIME-SPEC.md era)

All messages were NIP-01 array tuples. The verb was the first element.

```
// Relay subscribe
["REQ", "sub-1", { "kinds": [1], "limit": 10 }]

// Signer request (kind 29001)
["EVENT", { "kind": 29001, "tags": [["method", "signEvent"], ["id", "corr-uuid"], ["param", "event", "{...}"]], "content": "" }]

// Storage get (kind 29003 IPC_PEER)
["EVENT", { "kind": 29003, "tags": [["t", "shell:state-get"], ["id", "corr-uuid"], ["key", "theme"]], "content": "" }]

// IFC emit (kind 29003 IPC_PEER)
["EVENT", { "kind": 29003, "tags": [["t", "profile:open"]], "content": "{\"pubkey\":\"abc...\"}" }]
```

### Current Wire Format (NIP-5D / @napplet v0.2.0)

Messages are JSON objects with a `type` discriminant in `domain.action` format. Defined by NUB packages.

```json
// Relay subscribe (@napplet/nub-relay)
{ "type": "relay.subscribe", "id": "uuid", "subId": "uuid", "filters": [{ "kinds": [1], "limit": 10 }] }

// Signer request (@napplet/nub-signer)
{ "type": "signer.signEvent", "id": "uuid", "event": { ... } }

// Storage get (@napplet/nub-storage)
{ "type": "storage.get", "id": "uuid", "key": "theme" }

// IFC emit (@napplet/nub-ifc)
{ "type": "ifc.emit", "topic": "profile:open", "payload": { "pubkey": "abc..." } }

// Capability query (window.napplet.shell.supports)
window.napplet.shell.supports('relay')    // boolean, sync
window.napplet.services.has('audio')      // Promise<boolean>
```

### Handshake (UNCHANGED — still NIP-01 array format)

The REGISTER/IDENTITY/AUTH handshake remains as array verbs per RUNTIME-SPEC.md. This is implementation-level behavior not governed by NIP-5D v0.1.0. The `@napplet/core` `legacy.ts` exports `VERB_REGISTER`, `VERB_IDENTITY`, `AUTH_KIND` as `@deprecated` but they are still in use.

---

## @napplet Dependency Changes

### @napplet/core: v0.1.x → v0.2.0

**What changed:**

| Item | Previous | Current |
|------|----------|---------|
| `PROTOCOL_VERSION` | `'2.0.0'` | `'4.0.0'` |
| `BusKind` | Primary export (active) | `@deprecated` — moved to `legacy.ts`, still exported |
| `DESTRUCTIVE_KINDS` | Primary export | `@deprecated` — still exported |
| `VERB_REGISTER`, `VERB_IDENTITY`, `AUTH_KIND` | Primary exports | `@deprecated` in `legacy.ts`, still exported |
| `NappletMessage` | Not present | New — base interface `{ type: string }` for envelope messages |
| `NubDomain` | Not present | New — `'relay' \| 'signer' \| 'storage' \| 'ifc' \| 'theme'` |
| `NUB_DOMAINS` | Not present | New — runtime array of all NUB domain names |
| `ShellSupports` | Not present | New — `supports(capability: string): boolean` |
| `NappletGlobalShell` | Not present | New — extends `ShellSupports` |
| `createDispatch` / `registerNub` / `dispatch` | Not present | New — NUB registration and message routing infrastructure |
| `TOPICS` | Not present | New — IPC topic string constants (still useful for legacy compat) |

**Breaking:** None for kehto packages that only use `NostrEvent`, `NostrFilter`, `Capability`, `ALL_CAPABILITIES`, `BusKind`, `AUTH_KIND`. All of these are still exported (deprecated but present).

**Impact on kehto:** The `@napplet/core` peer dep constraint in kehto's package.json is `>=0.1.0`. The v0.2.0 release is backward-compatible at the type/value level for all symbols kehto currently uses. However, kehto's shell must handle **both** wire formats if it serves napplets using either the old or new `@napplet/shim`.

### New packages: @napplet/nub-* (v0.2.0)

Five new packages define the JSON envelope protocol per NUB domain. Kehto is a shell-side consumer — it does not depend on these packages directly, but must implement the message handlers they define.

| Package | Domain | Messages |
|---------|--------|---------|
| `@napplet/nub-relay` | `relay` | `relay.subscribe`, `relay.close`, `relay.publish`, `relay.query` (in); `relay.event`, `relay.eose`, `relay.closed`, `relay.publish.result`, `relay.query.result` (out) |
| `@napplet/nub-signer` | `signer` | `signer.getPublicKey`, `signer.signEvent`, `signer.getRelays`, `signer.nip04.encrypt/decrypt`, `signer.nip44.encrypt/decrypt` (in); `*.result` variants (out) |
| `@napplet/nub-storage` | `storage` | `storage.get`, `storage.set`, `storage.remove`, `storage.keys`, `storage.clear` (in); `*.result` variants (out) |
| `@napplet/nub-ifc` | `ifc` | `ifc.emit`, `ifc.subscribe`, `ifc.unsubscribe`, `ifc.event`, `ifc.channel.*` (bidirectional) |
| `@napplet/nub-theme` | `theme` | TBD (in nubs directory, not yet in shim) |

Kehto does not need to install `@napplet/nub-*` packages unless it wants to use their TypeScript types for handler implementation. The NUB packages are primarily napplet-side dependencies.

---

## Impact Per Kehto Package

### @kehto/acl

**Impact: MINIMAL.** The ACL system uses capability strings and bitfield checks. The capability string set (`relay:read`, `relay:write`, etc.) is unchanged in NIP-5D. The ACL composite key `(dTag, aggregateHash)` is unchanged. The persistence format (`localStorage` key `"napplet:acl"`) is LOCKED and unchanged.

**Action required:** None — ACL strings and the composite key model are stable across both spec versions.

### @kehto/runtime

**Impact: SIGNIFICANT.** The runtime currently handles NIP-01 array verbs (`REQ`, `EVENT`, `CLOSE`, `COUNT`, `AUTH`) plus ephemeral kind dispatch (29001, 29002, 29003, 29004, 29006, 29007, 29010). Under NIP-5D, incoming messages from updated napplets will be JSON envelope objects (`relay.*`, `signer.*`, `storage.*`, `ifc.*`) rather than NIP-01 arrays.

Specific changes needed:

1. **Message routing:** The runtime's `handleMessage` currently dispatches on `msg[0]` (the verb). It must additionally detect JSON envelope messages (object with `type` field) and route to NUB handlers.
2. **Relay handler:** Must handle `relay.subscribe`, `relay.close`, `relay.publish`, `relay.query` in addition to (or replacing) `REQ`, `EVENT`, `CLOSE`, `COUNT`.
3. **Signer handler:** Must handle `signer.*` envelope messages in addition to (or replacing) kind 29001/29002 dispatch.
4. **Storage handler:** Must handle `storage.*` envelope messages in addition to (or replacing) kind 29003 `shell:state-*` topics.
5. **IFC handler:** Must handle `ifc.*` envelope messages in addition to (or replacing) kind 29003 IPC_PEER topic routing.
6. **PROTOCOL_VERSION:** The version constant used in AUTH event tags must remain `'2.0.0'` for AUTH handshake compatibility (the handshake is not changing). However `PROTOCOL_VERSION` in `@napplet/core` is now `'4.0.0'`. These are decoupled — AUTH still uses its own version tag.

**Key design decision for migration:** The runtime should implement a dual-mode dispatcher: detect `Array.isArray(msg)` for NIP-01 format, `typeof msg === 'object' && msg.type` for envelope format. This allows serving both old (`@napplet/shim` v0.1.x) and new (`@napplet/shim` v0.2.0) napplets simultaneously during transition.

### @kehto/shell

**Impact: MODERATE.** The `ShellBridge` handles raw `MessageEvent` dispatch and maps to the runtime. Changes:

1. **Message unwrapping:** `shell-bridge.ts` currently passes `event.data` as an array to the runtime. It must also handle plain objects with a `type` field.
2. **`window.napplet.shell.supports()`:** NIP-5D mandates that shells provide `window.napplet.shell.supports()`. This is injected into the napplet iframe by `@napplet/shim`, NOT by the shell. The shell's responsibility is to populate what it supports so that `supports()` returns accurate values. Currently the shim returns `false` for all capabilities (hardcoded TODO). The shell needs a mechanism to communicate supported capabilities to the shim.
3. **BusKind deprecations:** The `types.ts` re-exports `BusKind`, `AUTH_KIND`, `DESTRUCTIVE_KINDS` from `@napplet/core`. These are now `@deprecated` upstream. The re-exports should be kept for now (they still work) but flagged for eventual removal.
4. **Service discovery:** The `window.napplet.shell.supports('relay')` query path is a new capability check mechanism. The shell must decide how it communicates its NUB support set to napplets. This is not yet implemented in either the shim (returns `false`) or the shell.

### @kehto/services

**Impact: MINIMAL.** The `@kehto/services` package provides `ServiceHandler` implementations (audio, notifications, signer, relay pool, etc.). Service handlers currently receive raw NIP-01 arrays and respond via the `send` callback. Under the envelope format, the messages they receive will change:

- Audio service: topic-based routing via kind 29003 IPC_PEER → likely `ifc.*` envelope routing
- Signer service: was kind 29001 events → now `signer.*` envelope messages
- Cache service: was kind 29006/29007 events → likely `storage.*` or similar

The `ServiceHandler` interface itself (`handleMessage(windowId, message[], send)`) is stable — only what's *inside* `message[]` changes. The runtime's NUB dispatch will route to service handlers after format translation.

---

## Recommended Stack for Migration

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@napplet/core` | `^0.2.0` | Protocol types, NUB dispatch infrastructure, deprecated NIP-01 constants | Upstream source of truth; v0.2.0 is backward compatible, provides both old and new exports |
| `@napplet/nub-relay` | `^0.2.0` | TypeScript types for `relay.*` envelope messages | Optional — only if kehto wants compile-time types for the new wire format handler |
| `@napplet/nub-signer` | `^0.2.0` | TypeScript types for `signer.*` envelope messages | Optional — same rationale |
| `@napplet/nub-storage` | `^0.2.0` | TypeScript types for `storage.*` envelope messages | Optional — same rationale |
| `@napplet/nub-ifc` | `^0.2.0` | TypeScript types for `ifc.*` envelope messages | Optional — same rationale |

**Decision point:** Kehto can implement the new envelope handlers either by installing the `@napplet/nub-*` packages as dev/peer dependencies (for TypeScript types), or by implementing the handlers using inline type definitions that mirror the NUB specs. The NUB packages are thin (types + domain registration) — installing them as devDependencies is the clean approach.

### Supporting Libraries (unchanged)

| Library | Version | Purpose |
|---------|---------|---------|
| `@noble/hashes` | `^2.0.0` | HMAC-SHA256 for key derivation (runtime) |
| `@noble/curves` | `^2.0.0` | secp256k1 Schnorr signature verification (runtime) |
| `nostr-tools` | `>=2.23.3 <3.0.0` | Peer dep in shell — event signing utilities |

---

## Handshake Spec Divergence (Critical)

The NIP-5D v0.1.0 spec describes a **simplified identity model**: the shell assigns napplet identity at iframe creation time via `(dTag, aggregateHash)` from the NIP-5A manifest, with no explicit `REGISTER`/`IDENTITY`/`AUTH` wire negotiation.

The `RUNTIME-SPEC.md` describes a **full AUTH handshake**: `REGISTER` → `IDENTITY` → `AUTH challenge` → `AUTH response` (kind 22242).

**The @napplet libraries implement the full handshake from RUNTIME-SPEC.md.** NIP-5D v0.1.0 is intentionally silent on the handshake — it is a higher-level spec that leaves implementation details to the reference implementation. The handshake remains as defined in RUNTIME-SPEC.md.

This is not a conflict — it is a layering decision. NIP-5D defines: transport, wire format envelope, identity model (Source-based), NUB extension system. RUNTIME-SPEC.md adds: AUTH handshake, key derivation, replay protection, ACL, and all Layer 3 capabilities.

**For migration:** The AUTH handshake in kehto does not need to change. The post-AUTH message format is what changes.

---

## Sandbox Policy Change

| Aspect | RUNTIME-SPEC.md | NIP-5D v0.1.0 |
|--------|----------------|----------------|
| Required sandbox | `allow-scripts allow-forms allow-popups allow-modals allow-downloads` | `allow-scripts` only |
| Optional tokens | None listed | Shells MAY add `allow-forms`, `allow-modals`, `allow-downloads`, `allow-popups` based on policy |
| `allow-same-origin` | MUST NOT be present | MUST NOT be present |

**Impact on kehto:** The shell's iframe creation code currently sets the full sandbox string. NIP-5D makes `allow-scripts` the only required token. Shells should continue to include the others based on their own policy — this is not a breaking change for kehto, it just means the additional tokens are now shell policy rather than spec requirement.

---

## Version Compatibility

| Package | Current in kehto | Required for NIP-5D | Notes |
|---------|-----------------|---------------------|-------|
| `@napplet/core` | `>=0.1.0` (peer) | `>=0.2.0` | v0.2.0 adds NUB dispatch, envelope types; deprecates BusKind but keeps it |
| `@napplet/nub-relay` | not installed | devDependency optional | For TypeScript types only |
| `@napplet/nub-signer` | not installed | devDependency optional | For TypeScript types only |
| `@napplet/nub-storage` | not installed | devDependency optional | For TypeScript types only |
| `@napplet/nub-ifc` | not installed | devDependency optional | For TypeScript types only |
| `nostr-tools` | `>=2.23.3 <3.0.0` | unchanged | No changes needed |
| `@noble/hashes` | `^2.0.0` | unchanged | No changes needed |
| `@noble/curves` | `^2.0.0` | unchanged | No changes needed |

---

## What NOT to Do

| Avoid | Why | Do Instead |
|-------|-----|------------|
| Remove NIP-01 array format handling entirely | Breaks napplets still on `@napplet/shim` v0.1.x | Keep dual-mode dispatch; detect format from message shape |
| Rename `BusKind` or remove kind number constants | Existing service handlers reference `BusKind.IPC_PEER` etc. | Mark as deprecated internally but keep; migrate incrementally |
| Treat AUTH handshake as changed | NIP-5D v0.1.0 is silent on AUTH; RUNTIME-SPEC.md AUTH is still the implementation spec | Keep REGISTER/IDENTITY/AUTH flow unchanged |
| Install `@napplet/nub-*` as runtime dependencies | These are napplet-side packages; only TypeScript types are needed by kehto | Install as `devDependencies` if at all, or inline the type definitions |
| Change `window.napplet.shell.supports()` to return `true` for everything | Returns `false` in current shim (TODO); shell has no communication channel for this yet | Design a capability advertisement mechanism before implementing |

---

## Sources

- `/home/sandwich/Develop/napplet/specs/NIP-5D.md` — NIP-5D v0.1.0 specification (current spec, HIGH confidence)
- `/home/sandwich/Develop/kehto/RUNTIME-SPEC.md` — Previous runtime spec (kehto baseline, HIGH confidence)
- `/home/sandwich/Develop/napplet/packages/core/src/constants.ts` — PROTOCOL_VERSION = '4.0.0', BusKind deprecated (HIGH confidence)
- `/home/sandwich/Develop/napplet/packages/core/src/envelope.ts` — NappletMessage, NubDomain, ShellSupports types (HIGH confidence)
- `/home/sandwich/Develop/napplet/packages/core/src/legacy.ts` — BusKind, VERB_REGISTER, VERB_IDENTITY, AUTH_KIND marked @deprecated (HIGH confidence)
- `/home/sandwich/Develop/napplet/packages/shim/src/index.ts` — shim uses envelope messages for signer/ifc, TOPICS still used (HIGH confidence)
- `/home/sandwich/Develop/napplet/packages/shim/src/relay-shim.ts` — relay.subscribe envelope messages confirmed (HIGH confidence)
- `/home/sandwich/Develop/napplet/packages/shim/src/state-shim.ts` — storage.* envelope messages confirmed (HIGH confidence)
- `/home/sandwich/Develop/napplet/packages/nubs/relay/src/types.ts` — relay.* message type definitions (HIGH confidence)
- `/home/sandwich/Develop/napplet/packages/nubs/signer/src/types.ts` — signer.* message type definitions (HIGH confidence)
- `/home/sandwich/Develop/kehto/packages/runtime/src/types.ts` — RuntimeAdapter still uses NIP-01 message arrays (HIGH confidence)
- `/home/sandwich/Develop/kehto/packages/shell/src/types.ts` — ShellAdapter, re-exports BusKind (HIGH confidence)
- `/home/sandwich/Develop/kehto/packages/shell/src/shell-bridge.ts` — Current bridge interface confirmed (HIGH confidence)

---
*Stack research for: kehto NIP-5D migration*
*Researched: 2026-04-07*
