# Gap Analysis: RUNTIME-SPEC.md (v2.0.0) to NIP-5D v0.1.0

**Date:** 2026-04-07
**Scope:** kehto runtime packages — @kehto/acl, @kehto/runtime, @kehto/shell, @kehto/services
**Purpose:** Establish boundary contracts and change inventory for package migration docs

---

## Summary / Change Inventory

The NIP-5D v0.1.0 specification replaces the previous RUNTIME-SPEC.md (v2.0.0) protocol on every
dimension that touches inter-package communication. The table below summarises the five change areas
and their relative migration priority. Suggested migration order (per ARCHITECTURE.md research):
**acl → runtime → shell → services**.

| # | Change Area | Priority | Affects |
|---|-------------|----------|---------|
| 1 | Wire format: NIP-01 arrays → NIP-5D JSON envelopes | **HIGH** | @kehto/runtime, @kehto/shell |
| 2 | Identity model: AUTH-keypair handshake → source-based identity | **HIGH** | @kehto/runtime, @kehto/acl |
| 3 | window.napplet interface → NUB domain mapping (optionality) | **MEDIUM** | @kehto/shell, @napplet/shim |
| 4 | Silent failure inventory (messages silently dropped) | **HIGH** | @kehto/runtime, @kehto/shell |
| 5 | Per-package boundary contracts (old vs new TypeScript interfaces) | **HIGH** | All packages |

---

## 1. Wire Format Change (GAP-01)

The previous protocol used NIP-01 array dispatch: every message from napplet to shell was a
JSON array whose first element was a string verb (`"REQ"`, `"EVENT"`, `"CLOSE"`, etc.), matching
the NIP-01 relay wire format described in RUNTIME-SPEC.md sections 4-6.

NIP-5D replaces this entirely with a **JSON envelope dispatch**: every message is a plain JSON
object with a `type` field (dot-separated domain and action, e.g. `"relay.subscribe"`) plus a
flat payload. There are no positional arguments. Every request carries an `id` field for
correlation; the shell echoes `id` back on the response envelope.

The old and new formats are mutually incompatible. An updated `@napplet/shim` (v0.2.0+) emits
only JSON envelope objects. The current kehto runtime expects only NIP-01 arrays. Both guards
(`packages/shell/src/shell-bridge.ts:155` and `packages/runtime/src/runtime.ts:1005`) silently
drop any non-array message — see Section 4 for the full silent failure inventory.

### Napplet → Shell (Inbound)

| Old Verb / Kind | Old Wire Format | New Type String | New Wire Format |
|----------------|----------------|----------------|----------------|
| `REGISTER` | `["REGISTER", {"dTag":"chat","claimedHash":"e3b0c..."}]` | *(eliminated — identity at creation)* | N/A |
| `AUTH` | `["AUTH", {kind:22242,tags:[["challenge","uuid"],...]}]` | *(eliminated)* | N/A |
| `REQ` | `["REQ", "sub-1", {"kinds":[1],"limit":10}]` | `relay.subscribe` | `{"type":"relay.subscribe","id":"uuid","subId":"uuid","filters":[...]}` |
| `CLOSE` | `["CLOSE", "sub-1"]` | `relay.close` | `{"type":"relay.close","id":"uuid","subId":"uuid"}` |
| `EVENT` (publish) | `["EVENT", {"kind":1,"content":"hello",...}]` | `relay.publish` | `{"type":"relay.publish","id":"uuid","event":{...}}` |
| `COUNT` | `["COUNT", "count-1", {"kinds":[1]}]` | `relay.query` | `{"type":"relay.query","id":"uuid","filters":[...]}` |
| `EVENT` kind 29001 signEvent | `["EVENT", {"kind":29001,"tags":[["method","signEvent"],["id","uuid"],["param","event","{...}"]],...}]` | `signer.signEvent` | `{"type":"signer.signEvent","id":"uuid","event":{...}}` |
| `EVENT` kind 29001 getPublicKey | `["EVENT", {"kind":29001,"tags":[["method","getPublicKey"],["id","uuid"]],...}]` | `signer.getPublicKey` | `{"type":"signer.getPublicKey","id":"uuid"}` |
| `EVENT` kind 29001 getRelays | `["EVENT", {"kind":29001,"tags":[["method","getRelays"],["id","uuid"]],...}]` | `signer.getRelays` | `{"type":"signer.getRelays","id":"uuid"}` |
| `EVENT` kind 29001 nip04.encrypt | `["EVENT", {"kind":29001,"tags":[["method","nip04.encrypt"],["params","pubkey","plain"]],...}]` | `signer.nip04.encrypt` | `{"type":"signer.nip04.encrypt","id":"uuid","pubkey":"...","plaintext":"..."}` |
| `EVENT` kind 29001 nip04.decrypt | *(same pattern as nip04.encrypt)* | `signer.nip04.decrypt` | `{"type":"signer.nip04.decrypt","id":"uuid","pubkey":"...","ciphertext":"..."}` |
| `EVENT` kind 29001 nip44.encrypt | *(same pattern)* | `signer.nip44.encrypt` | `{"type":"signer.nip44.encrypt","id":"uuid","pubkey":"...","plaintext":"..."}` |
| `EVENT` kind 29001 nip44.decrypt | *(same pattern)* | `signer.nip44.decrypt` | `{"type":"signer.nip44.decrypt","id":"uuid","pubkey":"...","ciphertext":"..."}` |
| `EVENT` kind 29003 `shell:state-get` | `["EVENT", {"kind":29003,"tags":[["t","shell:state-get"],["id","uuid"],["key","theme"]],...}]` | `storage.get` | `{"type":"storage.get","id":"uuid","key":"theme"}` |
| `EVENT` kind 29003 `shell:state-set` | `["EVENT", {"kind":29003,"tags":[["t","shell:state-set"],["id","uuid"],["key","theme"],["value","dark"]],...}]` | `storage.set` | `{"type":"storage.set","id":"uuid","key":"theme","value":"dark"}` |
| `EVENT` kind 29003 `shell:state-remove` | *(same pattern)* | `storage.remove` | `{"type":"storage.remove","id":"uuid","key":"theme"}` |
| `EVENT` kind 29003 `shell:state-clear` | *(same pattern)* | `storage.clear` | `{"type":"storage.clear","id":"uuid"}` |
| `EVENT` kind 29003 `shell:state-keys` | *(same pattern)* | `storage.keys` | `{"type":"storage.keys","id":"uuid"}` |
| `EVENT` kind 29003 (ifc emit) | `["EVENT", {"kind":29003,"tags":[["t","profile:open"]],"content":"{...}",...}]` | `ifc.emit` | `{"type":"ifc.emit","topic":"profile:open","payload":{...}}` |
| *(no equivalent)* | N/A | `ifc.subscribe` | `{"type":"ifc.subscribe","id":"uuid","topic":"profile:open"}` |
| *(no equivalent)* | N/A | `ifc.unsubscribe` | `{"type":"ifc.unsubscribe","id":"uuid","topic":"profile:open"}` |

### Shell → Napplet (Outbound)

| Old Verb | Old Wire Format | New Type String | New Wire Format |
|---------|----------------|----------------|----------------|
| `IDENTITY` | `["IDENTITY", {"pubkey":"...","privkey":"...","dTag":"chat","aggregateHash":"..."}]` | *(eliminated)* | N/A |
| `AUTH` challenge | `["AUTH", "challenge-uuid"]` | *(eliminated)* | N/A |
| `EVENT` deliver | `["EVENT", "sub-1", {"kind":1,...}]` | `relay.event` | `{"type":"relay.event","subId":"uuid","event":{...}}` |
| `OK` accepted | `["OK", "event-id", true, ""]` | `relay.publish.result` | `{"type":"relay.publish.result","id":"uuid","accepted":true}` |
| `OK` rejected | `["OK", "event-id", false, "blocked: relay:write capability denied"]` | `relay.publish.result` | `{"type":"relay.publish.result","id":"uuid","accepted":false,"message":"blocked: relay:write capability denied"}` |
| `EOSE` | `["EOSE", "sub-1"]` | `relay.eose` | `{"type":"relay.eose","subId":"uuid"}` |
| `CLOSED` | `["CLOSED", "sub-1", ""]` | `relay.closed` | `{"type":"relay.closed","subId":"uuid","message":""}` |
| `COUNT` result | `["COUNT", "count-1", {"count":42}]` | `relay.query.result` | `{"type":"relay.query.result","id":"uuid","count":42}` |
| `NOTICE` | `["NOTICE", "dropped messages..."]` | *(no envelope equivalent — operational diagnostic)* | Shell MAY use `{"type":"shell.notice","message":"..."}` |
| kind 29002 signer response | `["EVENT", "sub-id", {"kind":29002,"tags":[["id","uuid"],["method","signEvent"],["result","{...}"]],...}]` | `signer.signEvent.result` | `{"type":"signer.signEvent.result","id":"uuid","event":{...}}` |
| kind 29003 state response | `["EVENT", "__shell__", {"kind":29003,"tags":[["t","napplet:state-response"],["id","uuid"],["value","dark"],["found","true"]],...}]` | `storage.get.result` | `{"type":"storage.get.result","id":"uuid","value":"dark","found":true}` |
| kind 29003 ifc delivery | `["EVENT", "sub-id", {"kind":29003,"tags":[["t","profile:open"]],"content":"{...}",...}]` | `ifc.event` | `{"type":"ifc.event","topic":"profile:open","payload":{...},"sender":"windowId"}` |

### Eliminated Messages

The following message types have no NIP-5D equivalent and are removed entirely:

- **REGISTER** (napplet → shell): replaced by source-based identity at iframe creation time
- **IDENTITY** (shell → napplet): replaced by implicit origin identity; no keypair is sent
- **AUTH challenge** (shell → napplet): AUTH handshake eliminated — see Section 2
- **AUTH response** (napplet → shell): eliminated
- **kind 29010 service discovery** (`["REQ", ..., {"kinds":[29010]}]`): replaced by `window.napplet.services.has()` API
- **kind 29008 hotkey event**: not yet in NIP-5D NUB scope; forwarded as `keyboard.forward` implementation detail

These symbols are exported from `@napplet/core/src/legacy.ts` as `@deprecated` but remain functional for backward compatibility with legacy napplets.

### Unchanged (Handshake Verbs — Legacy Mode)

Per research finding (RESEARCH.md line 155-156), the REGISTER/IDENTITY/AUTH handshake is **not** part of NIP-5D v0.1.0. It remains defined in RUNTIME-SPEC.md for legacy napplets using `@napplet/shim` v0.1.x. The `@napplet/core/src/legacy.ts` module exports `VERB_REGISTER`, `VERB_IDENTITY`, and `AUTH_KIND` as `@deprecated` but still functional. Kehto SHOULD maintain a legacy code path during a transition period.

**Migration priority: HIGH** — blocks all NIP-5D napplets from communicating with kehto. Without this fix, every message from an updated `@napplet/shim` is silently discarded at the ShellBridge array guard (`packages/shell/src/shell-bridge.ts:155`).

---

## 2. Identity Model Change / AUTH Elimination (GAP-02)

NIP-5D replaces the AUTH handshake with **source-based identity**. This is a narrowing change, not a removal: AUTH becomes optional rather than mandatory. The recommended implementation is dual-mode — NIP-5D napplets use source-based identity; legacy napplets can still AUTH. This framing matches Pitfall 1 in PITFALLS.md: treating this as a full removal risks breaking existing deployments before migration is complete.

The practical consequence is large: `handleRegister()` and `handleAuth()` together represent approximately 40% of `packages/runtime/src/runtime.ts` by line count. Their removal is the single biggest code change in the migration.

### Before: AUTH-Keypair-Based Identity

The previous protocol required a 3-phase handshake before any message was processed:

1. **REGISTER** — napplet sends `["REGISTER", {"dTag":"chat","claimedHash":"..."}]`. Shell derives a deterministic keypair via `HMAC-SHA256(shellSecret, dTag + aggregateHash)` (see `key-derivation.ts`).
2. **IDENTITY** — shell sends `["IDENTITY", {"pubkey":"...","privkey":"...","dTag":"...","aggregateHash":"..."}]`. Napplet now holds its delegated signing key.
3. **AUTH challenge/response** — shell sends `["AUTH", challengeUuid]`. Napplet signs a NIP-42 kind 22242 event with the delegated keypair and returns `["AUTH", {kind:22242,...}]`. Shell verifies the Schnorr signature.

After successful AUTH, the napplet's session identity is established:
- **Session identity** = AUTH event pubkey (ephemeral secp256k1 key delegated by shell)
- **ACL key** = `pubkey:dTag:aggregateHash`
- **`SessionEntry.pubkey`** = derived AUTH keypair public key

Messages received before AUTH completes are queued in `pendingAuthQueue`. If AUTH never completes (e.g. because the napplet uses NIP-5D and never sends REGISTER), the queue grows without bound — see Section 4, Failure Point 3.

### After: Source-Based Identity

NIP-5D napplets do not perform a handshake. The shell establishes session identity from the `MessageEvent.source` reference of the first postMessage it receives from the iframe:

- **Session identity** = `MessageEvent.source` → `(dTag, aggregateHash)` lookup in `originRegistry`
- **ACL key** = `dTag:aggregateHash` (pubkey field removed or set to windowId)
- **`SessionEntry.pubkey`** = windowId (or empty — no AUTH keypair exists)

No challenge is issued. No signature is verified. The napplet can send its first real message (e.g. `relay.subscribe`) immediately after the iframe loads.

### AUTH Removal Scope

The complete AUTH handshake machinery lives in `packages/runtime/src/runtime.ts`.

**Symbols in runtime.ts:**

| Symbol / Structure | Location | Purpose | Status After Migration |
|-------------------|----------|---------|----------------------|
| `pendingChallenges` | `runtime.ts:141` | `Map<windowId, challengeString>` — tracks outstanding AUTH challenges | REMOVE |
| `pendingAuthQueue` | `runtime.ts:143` | `Map<windowId, msg[]>` — queues messages before AUTH completes | REMOVE |
| `authInFlight` | `runtime.ts:144` | `Set<windowId>` — prevents duplicate concurrent AUTH | REMOVE |
| `pendingRegistrations` | `runtime.ts:208-213` | Stores REGISTER payload until AUTH arrives | REMOVE |
| `delegatedPubkeys` | `runtime.ts:215` | Tracks keys derived from shellSecret | REMOVE |
| `handleRegister()` | `runtime.ts:236-323` | Handles `["REGISTER", payload]` — derives keypair, sends IDENTITY, sends challenge | REMOVE |
| `handleAuth()` | `runtime.ts:325-463` | Handles `["AUTH", authEvent]` — verifies kind 22242 Schnorr signature | REMOVE |
| AUTH pre-queue logic | `runtime.ts:1010-1014` | Inside `handleMessage` — if not authenticated, queue message | REMOVE |
| `sendChallenge()` | `runtime.ts:1024-1028` | Public Runtime method — sends `["AUTH", challenge]` | REMOVE from interface |
| `VERB_REGISTER` import | `runtime.ts:17` | From `@napplet/core` | REMOVE import |
| `VERB_IDENTITY` import | `runtime.ts:17` | From `@napplet/core` | REMOVE import |
| `AUTH_KIND` import | `runtime.ts:14` | From `@napplet/core` | REMOVE import |

**Supporting modules affected:**

| File | Symbol / Logic | Impact |
|------|---------------|--------|
| `packages/runtime/src/key-derivation.ts` | `deriveKeypair()`, `getOrCreateShellSecret()` | REMOVE or mark dead code — no delegated keypair in NIP-5D |
| `packages/runtime/src/types.ts` | `RuntimeAdapter.shellSecretPersistence` | Make optional, then deprecated — no longer required |
| `packages/runtime/src/types.ts` | `RuntimeAdapter.guidPersistence` | Review — instanceId still needed for session tracking |
| `packages/runtime/src/types.ts` | `RuntimeAdapter.hashVerifier` | KEEP — still useful for NIP-5A manifest verification |
| `packages/runtime/src/types.ts` | `SessionEntry.pubkey` | No longer the AUTH keypair pubkey — becomes windowId or empty |
| `packages/shell/src/shell-bridge.ts` | `sendChallenge()` method | REMOVE — calls `runtime.sendChallenge()` |
| `packages/shell/src/shell-bridge.ts` | All imports of `VERB_REGISTER`, `AUTH_KIND` | REMOVE |

### Identity Model Pivot

**Before (AUTH-keypair-based):**
```
Session identity = AUTH event pubkey (ephemeral secp256k1 key delegated by shell)
ACL key = pubkey:dTag:aggregateHash
SessionEntry.pubkey = derived AUTH keypair public key
```

**After (source-based):**
```
Session identity = MessageEvent.source → (dTag, aggregateHash) from originRegistry
ACL key = dTag:aggregateHash  (pubkey field removed or set to windowId)
SessionEntry.pubkey = windowId (or empty — no AUTH keypair)
```

**Migration priority: HIGH** — depends on runtime migration. Without this change, NIP-5D napplets (which never send REGISTER or AUTH) are queued forever in `pendingAuthQueue`. All their messages — relay subscriptions, signer requests, storage gets — are silently held and never dispatched.

---

## 3. window.napplet Interface to NUB Domain Mapping (GAP-03)

NIP-5D organises all napplet capabilities into **NUB (Napplet Utility Bundle)** domains. Each `window.napplet` namespace maps to a NUB domain with explicit optionality. Shells advertise supported NUBs via `window.napplet.shell.supports()`. This is a capability-negotiation layer that did not exist in RUNTIME-SPEC.md.

### Current NappletGlobal Interface

All five namespaces are currently required (no `?` optional markers) in `@napplet/core/src/types.ts`:

```typescript
// @napplet/core/src/types.ts — all fields required (no ?)
interface NappletGlobal {
  relay:    { subscribe, publish, query }
  ipc:      { emit, on }
  services: { list, has }
  storage:  { getItem, setItem, removeItem, keys }
  shell:    NappletGlobalShell  // { supports(capability: string): boolean }
}
```

### NUB Domain Assignment and Optionality

| window.napplet namespace | NUB Domain | Required per NIP-5D? | Kehto Implementation Status |
|-------------------------|-----------|---------------------|----------------------------|
| `relay` | `relay` | Optional (shell MAY support) | EXISTS — verb-based (REQ/EVENT/CLOSE/COUNT) |
| `ipc` / `ifc` | `ifc` | Optional | EXISTS — kind 29003 IPC_PEER topic routing |
| `storage` | `storage` | Optional | EXISTS — kind 29003 state-* topics |
| `services` (list/has) | N/A — discovery API | `services.has()` mentioned; list implied | EXISTS — kind 29010 discovery |
| `shell.supports()` | N/A — mandatory shell method | MUST implement | STUB — returns `false` unconditionally in shim |
| `window.nostr` | N/A — NIP-07 injection | MUST provide per NIP-5D | NOT IMPLEMENTED — currently accessed via signer proxy only |
| *(no equivalent)* | `theme` | Optional | NOT IMPLEMENTED (deferred) |

### Optionality Change Summary

NIP-5D makes all NUB capabilities optional from the shell's perspective. The `NappletGlobal` TypeScript interface in `@napplet/core` still marks all five namespaces as required — this is an **interface mismatch** that the migration docs must document. After migration, `ShellAdapter` gains optional fields, and `window.napplet.shell.supports('relay')` is the contract mechanism napplets use to detect what's available.

### Critical Gap: shell.supports() Stub

`@napplet/shim/src/index.ts` line ~47 contains a stub that unconditionally returns `false`:

```typescript
supports(capability: string): boolean {
  // TODO: Shell populates supported capabilities at iframe creation
  return false;
}
```

This stub blocks any napplet from detecting shell capabilities at runtime. A napplet calling `window.napplet.shell.supports('relay')` always gets `false`, even if the shell fully supports relay. Wiring this correctly requires a new initialisation message from shell to shim at iframe creation time — for example `{ type: "shell.capabilities", supports: ["relay", "storage", "ifc"] }` — so the shim can populate an internal capabilities set before napplet code runs.

### New Requirement: window.nostr Injection

NIP-5D adds a **mandatory requirement** not present in RUNTIME-SPEC.md: shells MUST provide a NIP-07 `window.nostr` implementation to each napplet iframe. This is distinct from the signer proxy — it is a full `window.nostr` object injected into the iframe's window context, giving napplets the standard Nostr signing interface.

Per research Pitfall 3 (PITFALLS.md), this requires iframe context injection at creation time. The shell must inject a NIP-07-compatible `window.nostr` shim into each iframe before the napplet's JavaScript runs. This is net-new work for @kehto/shell, with no existing infrastructure. Flagged as a new requirement for @kehto/shell migration (Phase 4).

### Deferred: theme NUB

The `theme` NUB domain exists in NIP-5D v0.1.0 but kehto has no existing infrastructure for it. There is no equivalent in RUNTIME-SPEC.md and no current `window.napplet.theme` namespace. Theme support is flagged as out-of-scope per REQUIREMENTS.md and deferred to a future milestone.

**Migration priority: MEDIUM** — `shell.supports()` stub blocks napplet capability detection and should be wired as part of the shell migration. `window.nostr` injection is a new requirement but does not break existing functionality in RUNTIME-SPEC.md-compatible shells.

---

## 4. Silent Failure Inventory
<!-- Completed in Plan 02 -->

## 5. Per-Package Boundary Contracts
<!-- Completed in Plan 02 -->
