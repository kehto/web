# Architecture Research

**Domain:** NIP-5D migration and gap analysis — kehto runtime packages
**Researched:** 2026-04-07
**Confidence:** HIGH (all findings sourced directly from the codebase and specs)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          NAPPLET IFRAME                                  │
│  window.napplet (relay, ipc, services, storage, shell) + window.nostr   │
│                       @napplet/shim (napplet-side)                       │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ postMessage (JSON envelope: { type, ...payload })
                               │ (OLD: NIP-01 array: [VERB, ...])
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       @kehto/shell  (browser adapter)                    │
│  ShellBridge: MessageEvent → windowId → runtime.handleMessage()          │
│  originRegistry: Window → windowId                                       │
│  aclStore, manifestCache, sessionRegistry (shell-level singletons)       │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ RuntimeAdapter (dependency injection)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      @kehto/runtime (protocol engine)                    │
│  createRuntime(hooks):                                                   │
│    - handleMessage(windowId, msg) — NUB dispatch (new) / verb dispatch   │
│    - AUTH handshake — REGISTER → IDENTITY → challenge → verify           │
│    - ACL enforcement (enforce.ts, resolveCapabilities)                   │
│    - Subscription lifecycle (REQ/CLOSE/EOSE)                             │
│    - State handler (storage.* NUB / IPC-PEER shell:state-*)              │
│    - Service dispatch (routeServiceMessage → ServiceRegistry)            │
│    - Event buffer (ring buffer + replay protection)                      │
└──────────────┬────────────────────┬────────────────────────────────────┘
               │                    │
               ▼                    ▼
┌─────────────────────┐  ┌──────────────────────────────────────────────┐
│    @kehto/acl        │  │             @kehto/services                  │
│  Pure capability     │  │  createAudioService()  — NIP-01 IPC_PEER     │
│  bitfield check /    │  │  createNotificationService() — NIP-01        │
│  grant / revoke /    │  │  createSignerService() — NIP-01 29001/29002  │
│  block (zero deps)   │  │  createRelayPoolService()                    │
└─────────────────────┘  │  createCacheService()                         │
                          └──────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Current Wire Format | Target Wire Format |
|-----------|---------------|--------------------|--------------------|
| `@kehto/acl` | Pure capability bitfield enforcement — zero deps, WASM-ready | No wire format (pure logic) | No change |
| `@kehto/runtime` | Protocol engine — verb dispatch, AUTH handshake, ACL gates, subscription lifecycle | NIP-01 arrays `[VERB, ...]` | JSON envelope `{ type, ...payload }` |
| `@kehto/shell` | Browser adapter — MessageEvent → windowId, singletons | Expects NIP-01 arrays | Expects JSON envelope |
| `@kehto/services` | Reference service handlers — audio, notifications, signer, relay, cache | NIP-01 `[EVENT, event]` with BusKind kind numbers | JSON envelope NUB messages |

---

## The Core Architectural Change: Wire Format Revolution

### Old Architecture (RUNTIME-SPEC.md era, protocol v2.0.0)

The previous protocol used NIP-01 relay wire format over postMessage. Every message was an array:

```
["VERB", ...params]
```

Key structural elements:
- **Handshake**: Napplet sends `["REGISTER", {dTag, claimedHash}]` → shell sends `["IDENTITY", {pubkey, privkey}]` → shell sends `["AUTH", challenge]` → napplet responds `["AUTH", kind22242Event]`
- **Relay proxy**: `["REQ", subId, filter]`, `["EVENT", event]`, `["CLOSE", subId]`
- **Signer proxy**: kind 29001 `SIGNER_REQUEST` events, kind 29002 `SIGNER_RESPONSE` events
- **Storage**: IPC-PEER (kind 29003) events with `shell:state-*` topic tags
- **IPC**: IPC-PEER (kind 29003) events with `t` tag topics
- **Service discovery**: kind 29010 `SERVICE_DISCOVERY` events

The runtime's `handleMessage()` was a verb switch: `AUTH | REGISTER | EVENT | REQ | CLOSE | COUNT`.

### New Architecture (NIP-5D v0.1.0, protocol v4.0.0)

The new protocol uses a generic JSON envelope over postMessage:

```
{ "type": "domain.action", ...payload }
```

Key structural changes:
- **No handshake at all**: Identity is assigned at iframe creation time from the NIP-5A manifest. The shell maps `MessageEvent.source → (dTag, aggregateHash)` when creating the iframe. No REGISTER/IDENTITY/AUTH dance.
- **NUBs replace verbs**: Each capability domain defines its own `domain.*` types — relay, signer, storage, ifc, theme.
- **`window.nostr` injection**: NIP-5D REQUIRES shells to provide `window.nostr` to napplets (not just proxy it). The shell must inject a real NIP-07 interface into the iframe context.
- **`window.napplet.shell.supports()` is mandatory**: Shells MUST implement this. Currently a stub returning `false` in `@napplet/shim`.

### Wire Format Comparison

| Concern | Old (RUNTIME-SPEC) | New (NIP-5D) |
|---------|-------------------|--------------|
| Auth/identity | REGISTER → IDENTITY → AUTH kind 22242 | None — shell assigns at creation |
| Relay subscribe | `["REQ", subId, filter]` | `{ type: "relay.subscribe", id, subId, filters }` |
| Relay publish | `["EVENT", event]` | `{ type: "relay.publish", id, event }` |
| Relay event | `["EVENT", subId, event]` | `{ type: "relay.event", subId, event }` |
| Signer request | kind 29001 EVENT with `method` tag | `{ type: "signer.signEvent", id, event }` |
| Signer response | kind 29002 EVENT with `result` tag | `{ type: "signer.signEvent.result", id, event }` |
| Storage get | kind 29003 IPC-PEER with `shell:state-get` topic | `{ type: "storage.get", id, key }` |
| Storage response | kind 29003 IPC-PEER with `napplet:state-response` topic | `{ type: "storage.get.result", id, value }` |
| IPC emit | kind 29003 IPC-PEER with topic `t` tag | `{ type: "ifc.emit", topic, payload }` |
| IPC subscribe | kind 29003 IPC-PEER pattern | `{ type: "ifc.subscribe", id, topic }` |
| Service discovery | kind 29010 SERVICE_DISCOVERY | `window.napplet.shell.supports()` + `window.napplet.services.has()` |
| Protocol version | `"version": "2.0.0"` tag in AUTH event | None — NUBs are independently versioned |

---

## Integration Points Between Packages

### How a Message Flows (Old Architecture)

```
Napplet iframe
    → window.parent.postMessage(["REQ", "sub1", {kinds:[1]}], '*')
    → MessageEvent arrives at shell
    → ShellBridge.handleMessage(event)
    → originRegistry.getWindowId(event.source)  // Window → windowId
    → Array.isArray(msg) check
    → runtime.handleMessage(windowId, msg)
    → verb switch: "REQ" case
    → enforce.ts: resolveCapabilities(msg) → 'relay:read'
    → aclState.check(identity, CAP_RELAY_READ)
    → relayPool.subscribe(filters, callback)
    → callback fires: sendToNapplet(windowId, ["EVENT", subId, event])
    → ShellAdapter.sendToNapplet → iframeWindow.postMessage(...)
```

### How a Message Flows (New Architecture, post-migration)

```
Napplet iframe
    → window.parent.postMessage({ type: "relay.subscribe", id, subId, filters }, '*')
    → MessageEvent arrives at shell
    → ShellBridge.handleMessage(event)
    → originRegistry.getWindowId(event.source)  // still: Window → windowId
    → typeof msg === 'object' && typeof msg.type === 'string' check (NEW)
    → runtime.handleMessage(windowId, msg)
    → NUB dispatch: msg.type.split('.')[0] → 'relay' domain handler (NEW)
    → relay NUB handler: ACL check (relay:read)
    → relayPool.subscribe(filters, callback)
    → callback fires: sendToNapplet(windowId, { type: "relay.event", subId, event })
    → ShellAdapter.sendToNapplet → iframeWindow.postMessage(...)
```

### Package-to-Package Integration Points

| Boundary | What crosses it | Change required |
|----------|-----------------|-----------------|
| `@kehto/shell` → `@kehto/runtime` | `RuntimeAdapter` interface (dependency injection) | `sendToNapplet` signature: `(windowId, msg: unknown[])` → `(windowId, msg: NappletMessage \| unknown[])` |
| `@kehto/runtime` → `@kehto/acl` | `check(state, identity, cap)` — pure function | No change — ACL logic is format-agnostic |
| `@kehto/runtime` → `@kehto/services` | `ServiceHandler.handleMessage(windowId, message, send)` | `message` changes from NIP-01 arrays to JSON envelope objects |
| `@kehto/shell` inbound | `MessageEvent.data` — currently expects `Array.isArray(msg)` | Must accept `{ type: string }` objects |
| `@kehto/shell` outbound | `sendToNapplet(windowId, msg)` | msg changes from arrays to envelope objects |
| `@kehto/runtime` ↔ `@napplet/core` | Imports: `BusKind`, `VERB_REGISTER`, `VERB_IDENTITY`, `AUTH_KIND`, `DESTRUCTIVE_KINDS` | All marked `@deprecated` in new core — must migrate away |

---

## New vs Modified Components (Explicit)

### Components That Change Fundamentally (Replace/Rewrite)

**`@kehto/runtime` — `runtime.ts` (handleMessage dispatch)**
- OLD: verb switch on `msg[0]` (REGISTER, AUTH, EVENT, REQ, CLOSE, COUNT)
- NEW: NUB dispatch on `msg.type` prefix (relay, signer, storage, ifc, theme)
- The entire AUTH handshake machinery (pendingChallenges, authInFlight, pre-AUTH queue, REGISTER handling, IDENTITY sending, key derivation) is REMOVED — identity is now assigned at iframe creation.
- `sendChallenge()`, `injectEvent()` may need re-evaluation: `sendChallenge` has no analog in NIP-5D; `injectEvent` changes to envelope format.

**`@kehto/runtime` — `enforce.ts` (resolveCapabilities)**
- OLD: maps NIP-01 verbs + BusKind event kinds to capabilities
- NEW: maps JSON envelope `type` strings to capabilities
- Examples: `relay.subscribe` → `relay:read`, `signer.signEvent` → `sign:event`, `storage.get` → `state:read`
- The BusKind.IPC_PEER + topic inspection logic is replaced by ifc.* and storage.* type string matching.

**`@kehto/runtime` — `state-handler.ts`**
- OLD: handles IPC-PEER kind 29003 events with `shell:state-*` topic tags, responds with `napplet:state-response` IPC-PEER events
- NEW: handles `{ type: "storage.get/set/remove/keys" }` envelope messages, responds with `{ type: "storage.*.result" }` — the `@napplet/nub-storage` types define the exact shapes.
- Storage scoping logic (`napplet-state:dTag:hash:key`) and quota enforcement are UNCHANGED.

**`@kehto/runtime` — `service-dispatch.ts` and `service-discovery.ts`**
- OLD: routes NIP-01 messages by BusKind to registered services; sends kind 29010 discovery events
- NEW: must route JSON envelope messages; service discovery becomes `window.napplet.shell.supports()` / `window.napplet.services.has()` — not a postMessage round-trip.

**`@kehto/shell` — `shell-bridge.ts` (inbound message gate)**
- OLD: `Array.isArray(msg) && msg.length >= 2` guard
- NEW: `typeof msg === 'object' && msg !== null && typeof msg.type === 'string'` guard
- The bridge passes messages to runtime; the runtime NUB dispatch handles routing. Conceptually the bridge remains thin, but the type check changes.

**`@kehto/services` — `signer-service.ts`**
- OLD: expects `['EVENT', event]` where `event.kind === BusKind.SIGNER_REQUEST`; reads method from `event.tags`; responds with kind 29002 events
- NEW: expects `{ type: 'signer.signEvent', id, event }` etc.; responds with `{ type: 'signer.signEvent.result', id, event }` — the `@napplet/nub-signer` types define the exact shapes.

**`@kehto/services` — `audio-service.ts` and `notification-service.ts`**
- OLD: expects IPC-PEER (kind 29003) events with `audio:*` topic tags; responds with IPC-PEER events
- NEW: these services route through the `ifc` NUB. Audio state management would use `{ type: "ifc.emit", topic: "audio:register", payload }` pattern or a dedicated `audio.*` NUB. The TOPICS constants (`AUDIO_REGISTER`, etc.) are still valid conceptually but the transport changes.

### Components That Stay (Mostly Unchanged)

**`@kehto/acl` — entire package**
- Capability bitfield logic (`check`, `grant`, `revoke`, `block`, `createState`) is completely format-agnostic.
- The `Identity` interface (`pubkey`, `dTag`, `hash`) is unchanged.
- The `AclState` immutable data structure is unchanged.
- Capability constants (`CAP_RELAY_READ`, `CAP_SIGN_EVENT`, `CAP_STATE_READ`, etc.) map directly to NUB domains and remain valid.
- Only the composite key format (`pubkey:dTag:hash`) needs review: under NIP-5D the `pubkey` field is less meaningful since there's no AUTH keypair — it may become `windowId:dTag:hash` or just `dTag:hash`.

**`@kehto/runtime` — `acl-state.ts`, `session-registry.ts`, `manifest-cache.ts`, `replay.ts`, `event-buffer.ts`, `key-derivation.ts`**
- ACL state container and persistence: no change (format-agnostic).
- Session registry: the AUTH-derived `pubkey` field may be replaced by `windowId` as the primary key, but the registry pattern remains. `SessionEntry` needs new fields (no more `AUTH_KIND` pubkey).
- Manifest cache: unchanged — still caches (dTag, aggregateHash, verifiedAt, requires).
- Replay detection: under NIP-5D there is no per-event id — replay protection logic for envelope messages needs redesign or removal.
- Event buffer and ring buffer: still useful for relay event delivery, but the buffer stores `NostrEvent` which remains valid for relay NUB.
- Key derivation: the HMAC-SHA256(shellSecret, dTag + hash) → keypair machinery is REMOVED — NIP-5D has no AUTH handshake. This module becomes dead code unless retained for legacy compatibility.

**`@kehto/shell` — `origin-registry.ts`, `acl-store.ts`, `manifest-cache.ts`**
- Origin registry (`Window → windowId` map) is the unchanged foundation of sender identity.
- ACL store (localStorage-backed ACL persistence) is unchanged.
- Manifest cache is unchanged.

**`@kehto/shell` — `hooks-adapter.ts`**
- The adapter translates `ShellAdapter` → `RuntimeAdapter`. The shape of these interfaces changes (e.g., `sendToNapplet` output type), but the adapter pattern remains.

**`@kehto/services` — `relay-pool-service.ts`, `cache-service.ts`, `coordinated-relay.ts`**
- These implement `RelayPoolAdapter` and `CacheAdapter` from `@kehto/runtime`. The adapter interfaces are format-agnostic (they deal in `NostrEvent` and `NostrFilter` for real relay communication). No change needed for NIP-5D migration at the transport layer — only the service handler's `handleMessage` contract changes.

---

## ACL Architecture Under NIP-5D

The ACL key model changes meaningfully. Under the old protocol, the `Identity` composite key was:

```
pubkey:dTag:aggregateHash
```

where `pubkey` was the AUTH-handshake-derived ephemeral/delegated keypair. Under NIP-5D, there is no AUTH keypair. The shell assigns identity from the NIP-5A manifest at iframe creation. The new composite key should be:

```
dTag:aggregateHash
```

(or `windowId:dTag:aggregateHash` if per-instance ACL is needed).

This is a breaking change to `@kehto/acl`'s `Identity` interface and the `toKey()` function. The `pubkey` field should be made optional or replaced. However, since capability enforcement semantics (grant/revoke/block by napplet type) remain unchanged, this is a key schema change, not a logic change.

**Capability mapping under NUBs:**

| NUB | Operations | Required Capability (unchanged) |
|-----|-----------|--------------------------------|
| relay | subscribe, publish, query | relay:read, relay:write |
| signer | signEvent, getPublicKey, etc. | sign:event, sign:nip04, sign:nip44 |
| storage | get, set, remove, keys | state:read, state:write |
| ifc | emit, subscribe, channel.* | relay:write (send), relay:read (receive) |
| theme | get | no capability check (read-only, no user data) |

---

## Identity Architecture Under NIP-5D

The biggest architectural shift is in identity management.

**Old identity lifecycle:**
1. Iframe loads → napplet sends REGISTER
2. Shell validates claimedHash, derives HMAC keypair
3. Shell sends IDENTITY (pubkey + privkey)
4. Shell sends AUTH challenge
5. Napplet signs challenge with delegated key
6. Shell verifies Schnorr signature → session established
7. All subsequent messages authenticated by Window reference

**New identity lifecycle:**
1. Shell creates iframe from NIP-5A manifest → reads `(dTag, aggregateHash)` from manifest
2. Shell maps `iframe.contentWindow` → `(dTag, aggregateHash)` in originRegistry
3. All inbound messages: `MessageEvent.source` lookup → instant identity resolution
4. No handshake, no keypair, no signature verification

**Implications for kehto architecture:**
- `createRuntime()` no longer needs `shellSecretPersistence`, `hashVerifier`, `guidPersistence` in the same role — the shell does identity assignment before the runtime sees any messages.
- `RuntimeAdapter.shellSecretPersistence` and `RuntimeAdapter.dm` become optional or deprecated.
- `SessionEntry.pubkey` is no longer the AUTH keypair pubkey — it becomes either empty, the user's pubkey, or windowId.
- The `sendChallenge()` method on the `Runtime` interface becomes obsolete.

---

## New window.nostr Injection Requirement

NIP-5D section "Transport" states:

> Shells MUST provide a NIP-07 window.nostr implementation to each napplet iframe.

This is a new mandatory requirement not present in the old RUNTIME-SPEC. The old model was: napplets access window.nostr via the signer proxy (kind 29001/29002 round-trip). The new model: shells must inject window.nostr **directly into the iframe context** before napplet code runs.

This is a `@kehto/shell` concern — the shell must use `iframe.contentWindow` to inject the `nostr` global. The injection must happen synchronously at iframe creation, before the iframe document loads (or via a script injected into the iframe's srcdoc/postMessage before the first frame). The `@napplet/shim` package still installs `window.nostr` via postMessage round-trips (signer.* NUB), but the shell-side must also provide a native NIP-07 implementation.

This affects `shell-bridge.ts` or the host application that creates iframes — there must be a new `injectNostr(iframeElement)` step in the iframe creation lifecycle.

---

## Data Flow

### New Message Flow (NIP-5D)

```
Iframe creation:
  Shell host creates <iframe sandbox="allow-scripts"> from NIP-5A manifest
  Shell reads (dTag, aggregateHash) from manifest event
  Shell calls originRegistry.register(iframe.contentWindow, windowId, dTag, hash)
  Shell injects window.nostr into iframe context (NEW REQUIREMENT)

Inbound message:
  Napplet → window.parent.postMessage({ type: "relay.subscribe", id, subId, filters }, '*')
  ShellBridge.handleMessage(MessageEvent)
  source = event.source as Window
  windowId = originRegistry.getWindowId(source)   // unchanged
  msg = event.data
  if typeof msg.type !== 'string' → drop            // changed guard
  runtime.handleMessage(windowId, msg)

Runtime NUB dispatch (new):
  domain = msg.type.split('.')[0]   // e.g. 'relay'
  nubHandler = nubRegistry.get(domain)
  nubHandler(windowId, msg)         // relay NUB handler

Relay NUB handler:
  identity = sessionRegistry.getIdentity(windowId)
  enforce(identity, 'relay:read', msg)  // ACL check via @kehto/acl
  relayPool.subscribe(msg.filters, (item) => {
    if item === 'EOSE': sendToNapplet(windowId, { type: "relay.eose", subId })
    else: sendToNapplet(windowId, { type: "relay.event", subId, event: item })
  })

Outbound to napplet:
  ShellAdapter.sendToNapplet(windowId, { type: "relay.event", ... })
  → iframeWindow.postMessage({ type: "relay.event", ... }, '*')
  → @napplet/shim relay handler resolves pending subscription callback
```

### State Management

```
ACL State (immutable, persisted)
    ↓ aclPersistence.load() at startup
@kehto/acl AclState ←→ @kehto/runtime AclStateContainer
    ↓ check(identity, capability)
enforce.ts gate ← every NUB handler passes through
    ↓ aclPersistence.persist() on change
```

---

## Migration Order (Dependency-Aware)

The recommended migration order respects package dependencies:

### Phase 1: @napplet/core dependency update

All kehto packages import from `@napplet/core`. The new `@napplet/core` (v0.2.0) exports:
- `NappletMessage`, `NubDomain`, `NUB_DOMAINS`, `createDispatch` — new envelope infrastructure
- `BusKind`, `VERB_REGISTER`, `VERB_IDENTITY`, `AUTH_KIND`, `DESTRUCTIVE_KINDS` — still exported but marked `@deprecated`

Because deprecated exports are still present, updating `@napplet/core` is non-breaking for kehto. Do this first across all packages before migrating the runtime logic.

### Phase 2: @kehto/acl — Identity key schema

Dependency: none (zero deps package).
Change: `Identity.pubkey` field handling — make optional or replace with `windowId`.
Risk: LOW — the bitfield logic is untouched, only the key string format changes.

### Phase 3: @kehto/runtime — NUB dispatch + storage handler

Dependency: @kehto/acl (modified), @napplet/core (updated).
Changes:
1. Replace verb switch with NUB domain dispatch
2. Remove AUTH handshake (REGISTER, IDENTITY, AUTH, key derivation, challenge machinery)
3. Replace `state-handler.ts` (IPC-PEER topics → storage.* NUB)
4. Replace `enforce.ts` capability resolution (BusKind → type strings)
5. Replace `service-discovery.ts` (kind 29010 → supports()/services.has() pattern)
6. Update `session-registry.ts` `SessionEntry` (remove AUTH-specific fields)

Risk: HIGH — this is the core protocol engine. Entire test suite must be migrated.

### Phase 4: @kehto/services — NUB message contracts

Dependency: @kehto/runtime (NUB dispatch in place).
Changes:
1. `signer-service.ts`: NIP-01 kind 29001/29002 → signer.* NUB types
2. `audio-service.ts`: IPC-PEER kind 29003 → ifc.emit / ifc.event pattern
3. `notification-service.ts`: IPC-PEER kind 29003 → ifc.emit / ifc.event pattern

Risk: MEDIUM — the service logic (registry, consent gating) is unchanged; only the message parsing contract changes.

### Phase 5: @kehto/shell — Envelope message guard + nostr injection

Dependency: @kehto/runtime (updated interface).
Changes:
1. `shell-bridge.ts`: `Array.isArray(msg)` → `typeof msg.type === 'string'` guard
2. Add `window.nostr` injection at iframe creation (new NIP-5D MUST requirement)
3. Update `hooks-adapter.ts` to match new `RuntimeAdapter` interface
4. Update `origin-registry.ts` to store `(dTag, aggregateHash)` alongside Window reference (identity is now assigned at registration, not after AUTH)

Risk: LOW-MEDIUM — ShellBridge is thin; main risk is the window.nostr injection mechanism.

---

## Anti-Patterns

### Anti-Pattern 1: Dual-mode dispatch in runtime

**What people do:** Keep both the NIP-01 verb switch and the NUB dispatch in `handleMessage` as a compatibility shim, checking `Array.isArray(msg)` to route old vs new.

**Why it's wrong:** Creates permanent technical debt, doubles the test surface, and means neither format is fully implemented. NIP-5D is a clean break — the old wire format is not "legacy input" from napplets; the shim (`@napplet/shim`) has already been updated to send envelope messages.

**Do this instead:** Implement NUB dispatch only. The `@napplet/core` legacy exports exist for the runtime's internal code to migrate from, not for maintaining backward compatibility with old napplets. Napplets using the new shim only emit envelope messages.

### Anti-Pattern 2: Keeping AUTH handshake machinery as "optional"

**What people do:** Leave `sendChallenge()`, `pendingChallenges`, `authInFlight`, `pre-AUTH queue`, `REGISTER` handler in place "just in case."

**Why it's wrong:** NIP-5D removes the AUTH requirement entirely — identity is at iframe creation. The AUTH handshake is not "optional" in the new model; it simply doesn't exist. Keeping it bloats the runtime and creates confusion about when authentication occurs.

**Do this instead:** Delete the handshake machinery. Identity assignment moves to `originRegistry.register()` at iframe creation time, before the first message arrives. If legacy shell compatibility is needed, that is a separate concern outside the NIP-5D runtime.

### Anti-Pattern 3: Service handlers still receiving NIP-01 arrays

**What people do:** Keep `ServiceHandler.handleMessage` accepting `unknown[]` (NIP-01 arrays) and add new envelope message handling alongside.

**Why it's wrong:** Services become dual-mode, which means double test coverage and ambiguous contract. The `ServiceHandler` interface should accept a typed envelope message.

**Do this instead:** Change `ServiceHandler.handleMessage(windowId, message, send)` so `message` is `NappletMessage` (the envelope base type). Each service can then narrow by `message.type` string.

### Anti-Pattern 4: Injecting window.nostr via postMessage round-trip only

**What people do:** Rely on `@napplet/shim` to provide `window.nostr` via signer.* NUB round-trips, ignoring the NIP-5D MUST requirement for shell-side injection.

**Why it's wrong:** NIP-5D says "Shells MUST provide a NIP-07 window.nostr implementation to each napplet iframe." This is a shell responsibility, not a napplet shim responsibility. Napplets that don't load `@napplet/shim` will have no `window.nostr`. Apps depending on `window.nostr` being synchronously available at load will break.

**Do this instead:** Shell injects `window.nostr` into each iframe at creation time (via `iframe.contentWindow.nostr = ...` before the iframe document runs, or via a `<script>` injected into the sandbox context).

---

## Integration Points Summary

### External Dependencies (incoming)

| Dependency | Used by | For | Migration note |
|------------|---------|-----|---------------|
| `@napplet/core` | all packages | Protocol types, constants | Already updated to v0.2.0 with NUB types; BusKind etc. still exported as deprecated |
| `@napplet/nub-relay` | @kehto/runtime (new) | Relay NUB message types | New import needed |
| `@napplet/nub-signer` | @kehto/services (new) | Signer NUB message types | New import needed |
| `@napplet/nub-storage` | @kehto/runtime (new) | Storage NUB message types | New import needed |
| `@napplet/nub-ifc` | @kehto/runtime/@kehto/services (new) | IFC NUB message types | New import needed |

### Internal Package Boundaries

| Boundary | Communication type | Current | Target |
|----------|--------------------|---------|--------|
| `@kehto/shell` → `@kehto/runtime` | `RuntimeAdapter` interface | `sendToNapplet: (id, unknown[])` | `sendToNapplet: (id, NappletMessage)` |
| `@kehto/runtime` → `@kehto/acl` | Direct function call | `check(state, identity, cap)` | Unchanged, but `Identity.pubkey` semantics change |
| `@kehto/runtime` → `@kehto/services` | `ServiceHandler.handleMessage` | `(windowId, unknown[], send)` | `(windowId, NappletMessage, send)` |
| `@kehto/shell` inbound | MessageEvent guard | `Array.isArray(msg)` | `typeof msg?.type === 'string'` |
| `@kehto/shell` outbound | sendToNapplet calls | `[VERB, ...]` arrays | `{ type, ...payload }` objects |

---

## Sources

- `/home/sandwich/Develop/kehto/napplet/specs/NIP-5D.md` — authoritative NIP-5D v0.1.0 spec
- `/home/sandwich/Develop/kehto/RUNTIME-SPEC.md` — previous protocol spec (NIP-XXXX era, protocol v2.0.0)
- `/home/sandwich/Develop/kehto/napplet/packages/core/src/` — new @napplet/core (envelope, dispatch, types, constants, legacy)
- `/home/sandwich/Develop/kehto/napplet/packages/nubs/*/src/types.ts` — NUB message type definitions (relay, signer, storage, ifc, theme)
- `/home/sandwich/Develop/kehto/napplet/packages/shim/src/index.ts` — new @napplet/shim envelope message sender
- `/home/sandwich/Develop/kehto/packages/acl/src/` — current @kehto/acl implementation
- `/home/sandwich/Develop/kehto/packages/runtime/src/` — current @kehto/runtime implementation
- `/home/sandwich/Develop/kehto/packages/shell/src/` — current @kehto/shell implementation
- `/home/sandwich/Develop/kehto/packages/services/src/` — current @kehto/services implementation

---
*Architecture research for: kehto NIP-5D migration and gap analysis*
*Researched: 2026-04-07*
