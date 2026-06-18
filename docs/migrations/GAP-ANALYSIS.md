> **Archived — terminal-state snapshot.**
> This document captures a historical migration or audit and is not active guidance.
> Current canonical documentation lives in the repo root [`README.md`](../../README.md), the per-package READMEs under [`packages/`](../../packages/), and the typedoc-generated reference at [`docs/api/`](../api/).
> Retained for historical reference only.

---

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
| `EVENT` kind 29003 (inc emit) | `["EVENT", {"kind":29003,"tags":[["t","profile:open"]],"content":"{...}",...}]` | `inc.emit` | `{"type":"inc.emit","topic":"profile:open","payload":{...}}` |
| *(no equivalent)* | N/A | `inc.subscribe` | `{"type":"inc.subscribe","id":"uuid","topic":"profile:open"}` |
| *(no equivalent)* | N/A | `inc.unsubscribe` | `{"type":"inc.unsubscribe","id":"uuid","topic":"profile:open"}` |

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
| kind 29003 inc delivery | `["EVENT", "sub-id", {"kind":29003,"tags":[["t","profile:open"]],"content":"{...}",...}]` | `inc.event` | `{"type":"inc.event","topic":"profile:open","payload":{...},"sender":"windowId"}` |

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
| `ipc` / `inc` | `inc` | Optional | EXISTS — kind 29003 IPC_PEER topic routing |
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

This stub blocks any napplet from detecting shell capabilities at runtime. A napplet calling `window.napplet.shell.supports('relay')` always gets `false`, even if the shell fully supports relay. Wiring this correctly requires a new initialisation message from shell to shim at iframe creation time — for example `{ type: "shell.capabilities", supports: ["relay", "storage", "inc"] }` — so the shim can populate an internal capabilities set before napplet code runs.

### New Requirement: window.nostr Injection

NIP-5D adds a **mandatory requirement** not present in RUNTIME-SPEC.md: shells MUST provide a NIP-07 `window.nostr` implementation to each napplet iframe. This is distinct from the signer proxy — it is a full `window.nostr` object injected into the iframe's window context, giving napplets the standard Nostr signing interface.

Per research Pitfall 3 (PITFALLS.md), this requires iframe context injection at creation time. The shell must inject a NIP-07-compatible `window.nostr` shim into each iframe before the napplet's JavaScript runs. This is net-new work for @kehto/shell, with no existing infrastructure. Flagged as a new requirement for @kehto/shell migration (Phase 4).

### Deferred: theme NUB

The `theme` NUB domain exists in NIP-5D v0.1.0 but kehto has no existing infrastructure for it. There is no equivalent in RUNTIME-SPEC.md and no current `window.napplet.theme` namespace. Theme support is flagged as out-of-scope per REQUIREMENTS.md and deferred to a future milestone.

**Migration priority: MEDIUM** — `shell.supports()` stub blocks napplet capability detection and should be wired as part of the shell migration. `window.nostr` injection is a new requirement but does not break existing functionality in RUNTIME-SPEC.md-compatible shells.

---

## 4. Silent Failure Inventory (GAP-04)

When a NIP-5D napplet sends envelope messages (`{ type: "domain.action", ... }`) to a kehto shell running the current NIP-01 runtime, those messages are silently dropped at multiple points. No errors are thrown, no responses are sent. This section inventories every such failure point with exact code locations and reproduction steps.

### Failure Point 1: ShellBridge Array Guard

**File:** `packages/shell/src/shell-bridge.ts`
**Function:** `createShellBridge` → `handleMessage`
**Line:** 155
**Code:**
```typescript
if (!Array.isArray(msg) || msg.length < 2) return;
```
**What fails:** ANY `{ type: "..." }` envelope object from an updated `@napplet/shim`. All NUB messages are silently dropped here before ever reaching the runtime. This is the first and most complete failure point — 100% of NIP-5D traffic is discarded.
**Reproduction:** Send `{ type: "relay.subscribe", id: "x", subId: "x", filters: [] }` via postMessage to a kehto shell. `ShellBridge.handleMessage` receives the event but returns on line 155. No error, no response.
**Impact:** CRITICAL — total communication blackout for NIP-5D napplets. No message of any kind reaches the runtime.

### Failure Point 2: Runtime handleMessage Array Check

**File:** `packages/runtime/src/runtime.ts`
**Function:** `handleMessage`
**Line:** 1005
**Code:**
```typescript
if (!Array.isArray(msg) || msg.length < 2) return;
```
**What fails:** Even if an envelope object bypasses the shell-bridge guard (e.g., in direct unit tests or if shell-bridge is replaced), the runtime's own guard drops it again. This is the runtime's primary entry-point defense.
**Reproduction:** Call `runtime.handleMessage(windowId, { type: "relay.subscribe", ... } as any)`. Returns immediately on line 1005 before any verb dispatch occurs.
**Impact:** CRITICAL — secondary defense ensures no envelope reaches verb dispatch, even in test environments.

### Failure Point 3: AUTH Queue — Messages Queued Forever

**File:** `packages/runtime/src/runtime.ts`
**Function:** `handleMessage`
**Lines:** 1010–1014
**Code:**
```typescript
if (!sessionRegistry.getPubkey(windowId)) {
  let queue = pendingAuthQueue.get(windowId);
  if (!queue) { queue = []; pendingAuthQueue.set(windowId, queue); }
  queue.push({ msg, windowId });
  return;
}
```
**What fails:** Updated `@napplet/shim` (v0.2.0) no longer sends `REGISTER` or `AUTH` messages. The runtime never calls `sessionRegistry.setPubkey(windowId)` for these sessions. All messages from NIP-5D napplets are pushed into `pendingAuthQueue` forever — the queue is only drained on successful AUTH completion, which never happens. The queue grows without bound.
**Reproduction:** Load a napplet using `@napplet/shim` v0.2.0. Send any NUB message. Check `pendingAuthQueue.size` — grows indefinitely. No message is ever dispatched.
**Impact:** CRITICAL — memory leak plus complete message loss for all NIP-5D sessions. Any messages that somehow reach this point (e.g., in a partially migrated shell) are silently held forever.

### Failure Point 4: enforce.ts Unknown Verb Fallback

**File:** `packages/runtime/src/enforce.ts`
**Function:** `resolveCapabilities`
**Lines:** 99–102
**Code:**
```typescript
default:
  // Unknown verb — require relay:write as a safe default
  return { senderCap: 'relay:write', recipientCap: null };
```
**What fails:** If an envelope object somehow passes both array guards (e.g., in a direct unit test), `resolveCapabilities` receives `msg[0]` = `undefined` (no positional verb). Falls to the default case and requires `relay:write`. A `relay.subscribe` request — which should require `relay:read` — is checked against `relay:write` instead. Napplets holding only `relay:read` capability are incorrectly denied.
**Reproduction:** Pass `[{ type: "relay.subscribe", ... }]` (wrapped in array) to `resolveCapabilities`. Returns `{ senderCap: 'relay:write', recipientCap: null }` instead of `{ senderCap: 'relay:read', recipientCap: null }`.
**Impact:** HIGH — wrong capability enforced. Napplets with only `relay:read` grants cannot subscribe to relay events even if allowed by ACL.

### Failure Point 5: state-handler.ts Topic Routing

**File:** `packages/runtime/src/state-handler.ts`
**Function:** `handleStateRequest`
**Lines:** 82–84
**Code:**
```typescript
const topic = event.tags?.find((t) => t[0] === 't')?.[1];
const key = event.tags?.find((t) => t[0] === 'key')?.[1];
const correlationId = event.tags?.find((t) => t[0] === 'id')?.[1] ?? '';
```
**What fails:** `handleStateRequest` is only called from `runtime.ts:622` after detecting a `BusKind.IPC_PEER` kind event with a `shell:state-*` topic tag. Since `storage.get` envelope objects (`{ type: "storage.get", ... }`) are never recognized as `BusKind.IPC_PEER` events, this handler is never invoked for NIP-5D storage requests. `window.napplet.storage.getItem()` in the napplet hangs until the shim's internal timeout fires.
**Reproduction:** With `@napplet/shim` v0.2.0: `await window.napplet.storage.getItem('key')` — hangs until shim timeout (typically 5–30 seconds). No response ever arrives.
**Impact:** HIGH — storage API completely non-functional for NIP-5D napplets. Any napplet persisting settings or state across sessions is broken.

### Failure Point 6: service-dispatch.ts Topic-Prefix Routing

**File:** `packages/runtime/src/service-dispatch.ts`
**Function:** `routeServiceMessage`
**Lines:** 39–44
**Code:**
```typescript
const colonIndex = topic.indexOf(':');
if (colonIndex === -1) return false;
const prefix = topic.slice(0, colonIndex);
const handler = services[prefix];
if (!handler) return false;
handler.handleMessage(windowId, ['EVENT', event], send);
```
**What fails:** `inc.emit` envelope objects never produce an `IPC_PEER` event with a `t` tag — so `routeServiceMessage` is never called for NUB `inc.emit` messages. Additionally, even if it were called with an `inc.emit` envelope, the function expects a colon-separated topic (e.g., `audio:play`) but `inc.emit` uses dot notation in its `type` field. `colonIndex === -1` for `type: "inc.emit"`, so it returns `false` immediately. All NUB-format service messages (audio playback, notifications via inc.emit) are silently unrouted.
**Reproduction:** Register an audio service handler. Send `{ type: "inc.emit", topic: "audio:play", payload: {} }` from an updated shim. `routeServiceMessage` is never invoked. The audio handler never fires.
**Impact:** HIGH — all service handlers (audio, notifications) are unreachable via NIP-5D messages. Any @kehto/services extension is dead for NIP-5D napplets.

### Summary Table

| # | File | Line | Severity | Affected NUB Domains |
|---|------|------|----------|----------------------|
| 1 | `packages/shell/src/shell-bridge.ts` | 155 | CRITICAL | All (relay, signer, storage, inc) |
| 2 | `packages/runtime/src/runtime.ts` | 1005 | CRITICAL | All (relay, signer, storage, inc) |
| 3 | `packages/runtime/src/runtime.ts` | 1010–1014 | CRITICAL | All (relay, signer, storage, inc) |
| 4 | `packages/runtime/src/enforce.ts` | 99–102 | HIGH | relay (wrong cap: read vs write) |
| 5 | `packages/runtime/src/state-handler.ts` | 82–84 | HIGH | storage (get, set, remove, clear, keys) |
| 6 | `packages/runtime/src/service-dispatch.ts` | 39–44 | HIGH | inc (audio, notifications via inc.emit) |

**Migration priority: CRITICAL** — these are the first things that must be fixed. Without addressing Failure Points 1–3, no NIP-5D napplet can communicate at all with a kehto shell. Failure Points 4–6 become reachable only after the first three are resolved.

---

## 5. Per-Package Boundary Contracts (GAP-05)

This section defines the prescriptive boundary contracts for each kehto package. "Prescriptive" means these contracts state what each package MUST accept and emit after migration. Downstream migration docs (Phases 2–5) reference these contracts as their source of truth. Each contract includes TypeScript interface snippets showing the old and new types, and a verification criterion defining when migration is correct.

### 5.1 @kehto/acl Boundary Contract

**What crosses the boundary:** `check(state, identity, cap)` — called by `packages/runtime/src/enforce.ts`

**Current identity type (`packages/acl/src/types.ts`):**
```typescript
interface Identity {
  readonly pubkey: string;   // AUTH keypair pubkey — CHANGES
  readonly dTag: string;     // unchanged
  readonly hash: string;     // unchanged
}
// Composite key: pubkey:dTag:hash
// (packages/acl/src/check.ts:22-24)
function toKey(identity: Identity): string {
  return `${identity.pubkey}:${identity.dTag}:${identity.hash}`;
}
```

**Target identity contract (after migration):**
```typescript
interface Identity {
  readonly pubkey: string;   // DEPRECATED — becomes windowId or empty string
  readonly dTag: string;     // unchanged
  readonly hash: string;     // unchanged
}
// Composite key MUST change to: dTag:hash
// pubkey field kept for backward compat during data migration only
```

**Verification criterion:** `aclStore.check(state, { pubkey: '', dTag: 'chat', hash: 'abc' }, CAP_RELAY_READ)` returns the expected grant/deny value. Existing persisted ACL entries under `pubkey:dTag:hash` keys require a one-time migration utility before the key schema change is deployed.

**Affected files:** `packages/acl/src/types.ts`, `packages/acl/src/check.ts`

---

### 5.2 @kehto/runtime Boundary Contract

**Inbound surface — what the runtime accepts:**

Current:
```typescript
// packages/runtime/src/runtime.ts:1004
handleMessage(windowId: string, msg: unknown[]): void;
// Only processes NIP-01 arrays: ["VERB", ...params]
```

Target:
```typescript
handleMessage(windowId: string, msg: NappletMessage | unknown[]): void;
// Must process both:
//   - NappletMessage: { type: string, ...payload } (NIP-5D envelope)
//   - unknown[]: ["VERB", ...] (legacy NIP-01, for transition period)
```

**Outbound surface — what the runtime sends via `RuntimeAdapter.sendToNapplet`:**

Current:
```typescript
// packages/runtime/src/types.ts:47
type SendToNapplet = (windowId: string, msg: unknown[]) => void;
// All responses are NIP-01 arrays: ["OK", ...], ["EVENT", ...], ["CLOSED", ...]
```

Target:
```typescript
type SendToNapplet = (windowId: string, msg: NappletMessage | unknown[]) => void;
// Responses are NIP-5D envelopes: { type: "relay.event", ... }
// Legacy arrays maintained during transition
```

**Dispatch model change — from verb switch to domain-prefix dispatch:**

Current: `dispatchVerb(verb, msg, windowId)` switches on `msg[0]` (e.g., `"REQ"`, `"EVENT"`, `"CLOSE"`).

Target pattern:
```typescript
if (typeof msg === 'object' && msg !== null && 'type' in msg) {
  const domain = (msg as NappletMessage).type.split('.')[0];
  switch (domain) {
    case 'relay':   return handleRelayMessage(windowId, msg as NappletMessage);
    case 'signer':  return handleSignerMessage(windowId, msg as NappletMessage);
    case 'storage': return handleStorageMessage(windowId, msg as NappletMessage);
    case 'inc':     return handleIncMessage(windowId, msg as NappletMessage);
    default:        return; // unknown domain — silently drop per NIP-5D spec
  }
}
// Fallback to legacy array dispatch for backward compat
```

**Verification criterion:** A napplet sending `{ type: "relay.subscribe", id: "x", subId: "x", filters: [{kinds:[1]}] }` receives back `{ type: "relay.eose", subId: "x" }` within 1 second when no matching events exist.

**Affected files:** `packages/runtime/src/runtime.ts`, `packages/runtime/src/types.ts`, `packages/runtime/src/enforce.ts`

---

### 5.3 @kehto/shell Boundary Contract

**Inbound surface — `ShellBridge.handleMessage(event: MessageEvent)`:**

Current:
```typescript
// packages/shell/src/shell-bridge.ts:149-158
handleMessage(event: MessageEvent): void {
  const msg = event.data;
  if (!Array.isArray(msg) || msg.length < 2) return;  // <-- DROP POINT (line 155)
  runtime.handleMessage(windowId, msg);
}
```

Target:
```typescript
handleMessage(event: MessageEvent): void {
  const msg = event.data;
  // Accept NIP-5D envelope objects:
  if (typeof msg === 'object' && msg !== null && typeof msg.type === 'string') {
    runtime.handleMessage(windowId, msg);
    return;
  }
  // Legacy: accept NIP-01 arrays:
  if (Array.isArray(msg) && msg.length >= 2) {
    runtime.handleMessage(windowId, msg);
    return;
  }
  // All else: silently drop (per NIP-5D spec)
}
```

**Outbound surface — `sendToNapplet` via `ShellAdapter`:**

Current:
```typescript
// packages/shell/src/types.ts — ShellAdapter
sendToNapplet: (windowId: string, msg: unknown[]) => void;
```

Target:
```typescript
sendToNapplet: (windowId: string, msg: NappletMessage | unknown[]) => void;
```

**Verification criterion:** `window.addEventListener('message', ...)` in a napplet iframe receives `{ type: "relay.event", subId: "x", event: {...} }` (not `["EVENT", "x", {...}]`) after migration.

**Affected files:** `packages/shell/src/shell-bridge.ts`, `packages/shell/src/types.ts`

---

### 5.4 @kehto/services Boundary Contract

**Handler interface — what services receive:**

Current:
```typescript
// packages/runtime/src/types.ts:486-496
export interface ServiceHandler {
  descriptor: ServiceDescriptor;
  handleMessage(windowId: string, message: unknown[], send: (msg: unknown[]) => void): void;
  // message is ['EVENT', event] where event.kind is BusKind.SIGNER_REQUEST (29001) etc.
  onWindowDestroyed?(windowId: string): void;
}
```

Target:
```typescript
export interface ServiceHandler {
  descriptor: ServiceDescriptor;
  handleMessage(
    windowId: string,
    message: NappletMessage,              // { type: "signer.signEvent", id, event }
    send: (msg: NappletMessage) => void   // { type: "signer.signEvent.result", ... }
  ): void;
  onWindowDestroyed?(windowId: string): void;
}
```

**Per-service migration contracts:**

| Service | Old Trigger | New Trigger | Response Format Change |
|---------|-------------|-------------|------------------------|
| signer | `event.kind === 29001` (BusKind.SIGNER_REQUEST) + `method` tag | `message.type === "signer.signEvent"` (or other `signer.*` types) | From kind 29002 event → `{ type: "signer.signEvent.result", id, event }` |
| audio | `event.kind === 29003` (IPC_PEER) + `t` tag prefix `audio:` | `message.type === "inc.emit"` with `topic.startsWith("audio:")` | From IPC_PEER response → `{ type: "inc.event", topic: "audio:...", payload }` |
| notifications | `event.kind === 29003` (IPC_PEER) + `t` tag prefix `notifications:` | `message.type === "inc.emit"` with `topic.startsWith("notifications:")` | From IPC_PEER response → `{ type: "inc.event", ... }` |

**Verification criterion:** `serviceHandler.handleMessage(windowId, { type: "signer.getPublicKey", id: "uuid" }, send)` results in `send` being called with `{ type: "signer.getPublicKey.result", id: "uuid", pubkey: "..." }`.

**Affected files:** `packages/runtime/src/types.ts` (ServiceHandler interface), `packages/services/src/` (all handler implementations)

---

### Migration Priority Rankings

| # | Section | Priority | Rationale | Suggested Phase |
|---|---------|----------|-----------|-----------------|
| 1 | Wire Format (GAP-01) | HIGH | Blocks all NIP-5D communication at two guard points | Phase 3 (Runtime), Phase 4 (Shell) |
| 2 | Identity/AUTH (GAP-02) | HIGH | NIP-5D napplets queued forever in pendingAuthQueue without fix | Phase 3 (Runtime) |
| 3 | NUB Domain Mapping (GAP-03) | MEDIUM | shell.supports() stub and window.nostr injection blocking detection | Phase 4 (Shell) |
| 4 | Silent Failures (GAP-04) | CRITICAL | First thing to fix — no NIP-5D messages reach handlers at all | Phase 3 (Runtime), Phase 4 (Shell) |
| 5 | Boundary Contracts (GAP-05) | N/A (prescriptive) | These ARE the migration targets | Phases 2–5 |

**Suggested migration order (per dependency analysis):**

`@kehto/acl` (no deps, no blockers) → `@kehto/runtime` (depends on acl types) → `@kehto/shell` (depends on runtime interface) → `@kehto/services` (depends on runtime dispatch model)
