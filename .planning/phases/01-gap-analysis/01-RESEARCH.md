# Phase 1: Gap Analysis - Research

**Researched:** 2026-04-07
**Domain:** Protocol specification comparison — RUNTIME-SPEC.md (NIP-01 wire format) vs NIP-5D v0.1.0 (JSON envelope / NUB protocol)
**Confidence:** HIGH — all findings sourced directly from live source files in both repos

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single markdown file (GAP-ANALYSIS.md) with sections organized by change type
- Sections: wire format, identity model, interfaces/NUB domains, silent failures, per-package boundary contracts
- Lives in project root `/docs/` directory — visible to contributors
- Includes migration priority rankings per gap, with suggested migration order
- Wire format: before/after examples for every message type (relay.subscribe, signer.signEvent, storage.get, ifc.emit, etc.)
- Silent failure inventory: code-level — specific file, function, and line where each failure occurs in kehto
- NUB types kehto doesn't use yet (theme): listed but flagged as deferred/out-of-scope
- AUTH removal: enumerate every affected file and function, quantify the ~40% removal scope
- Contracts presented as TypeScript interface snippets showing old vs new message types at each package boundary
- Prescriptive: contracts state what each package MUST accept/emit after migration
- Each contract includes verification criteria ("migration is correct when X")

### Claude's Discretion
- Internal document sectioning and heading hierarchy
- Level of cross-referencing between sections
- Whether to include a changelog-style summary at the top

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GAP-01 | Document wire format change (NIP-01 arrays → JSON envelopes) with before/after examples | Complete message inventory documented below with before/after for every message type; sourced from RUNTIME-SPEC.md and nubs/SPEC.md |
| GAP-02 | Document AUTH handshake elimination and identity model change | Full AUTH code inventory completed with exact file:line references; AUTH removal scope quantified |
| GAP-03 | Map each window.napplet interface to its NUB domain with optionality status | Interface → NUB domain mapping documented from @napplet/core/src/envelope.ts and shim/src/index.ts |
| GAP-04 | Inventory silent failure points where old runtime drops new-format messages | Six specific file:function:line failure points identified with reproduction steps |
| GAP-05 | Document per-package boundary contracts (what each package sends/receives) | Current and target TypeScript interfaces documented for all four package boundaries |
</phase_requirements>

---

## Summary

Phase 1 produces a single reference document (`docs/GAP-ANALYSIS.md`) that maps every change between the previous napplet protocol (RUNTIME-SPEC.md, v2.0.0) and the current NIP-5D v0.1.0 specification. This document is consumed as the source of truth by Phases 2–5 for their individual package migration plans.

The research phase has already been completed at the milestone level — `.planning/research/STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, and `PITFALLS.md` contain comprehensive findings. This phase-level research adds the specific information the planner needs that the milestone research left as gaps: exact message type inventories per NUB, specific file:function:line locations for every silent failure point, the current TypeScript interface shapes at each package boundary, and the complete AUTH handshake code location inventory.

The primary task for the planner is to structure the work of writing `docs/GAP-ANALYSIS.md` into tasks that systematically cover all five requirement areas (GAP-01 through GAP-05), using the research artifacts below as their authoritative source.

**Primary recommendation:** Write GAP-ANALYSIS.md in a single wave with five clearly defined tasks matching the five requirements. Each task has a well-scoped research foundation — the main work is assembly and cross-referencing, not investigation.

---

## Project Constraints (from CLAUDE.md)

- TypeScript strict mode with verbatimModuleSyntax
- ESM-only (no CJS)
- File naming: lowercase with hyphens
- 2-space indentation
- Zero framework dependencies
- GAP-ANALYSIS.md is a documentation artifact — it lives in `/docs/` per locked decisions
- GSD workflow enforcement: all file changes through `/gsd:execute-phase`

---

## Standard Stack

This phase produces a markdown document. No new packages are installed.

### Core Tools in Use
| Tool | Purpose |
|------|---------|
| Markdown | Document format for GAP-ANALYSIS.md |
| TypeScript (existing) | Interface snippets in boundary contracts section |

### Source Inputs (already available, no installation needed)
| File | Contents | Used For |
|------|---------|---------|
| `RUNTIME-SPEC.md` | Complete NIP-01 wire format spec (before) | GAP-01 wire format section |
| `nubs/SPEC.md` | NIP-5D v0.1.0 transport/identity spec (after) | GAP-01, GAP-02 sections |
| `napplet/packages/nubs/*/src/types.ts` | NUB message type definitions | GAP-01 after-side examples |
| `packages/runtime/src/runtime.ts` | Current verb dispatch, AUTH machinery | GAP-02, GAP-04 |
| `packages/runtime/src/enforce.ts` | Capability resolution (BusKind-based) | GAP-01, GAP-04 |
| `packages/runtime/src/state-handler.ts` | Storage request handler (kind 29003) | GAP-04 |
| `packages/runtime/src/service-dispatch.ts` | Service routing (topic-prefix) | GAP-04 |
| `packages/runtime/src/types.ts` | RuntimeAdapter, ServiceHandler, SessionEntry | GAP-05 |
| `packages/shell/src/shell-bridge.ts` | ShellBridge, Array.isArray guard | GAP-04 |
| `packages/acl/src/types.ts` | Identity interface, AclState composite key | GAP-05 |
| `.planning/research/STACK.md` | Wire format comparison (milestone research) | Foundation |
| `.planning/research/FEATURES.md` | NUB domain mapping, interface changes | Foundation |
| `.planning/research/ARCHITECTURE.md` | Integration flow, migration order | Foundation |
| `.planning/research/PITFALLS.md` | Silent failures, AUTH removal risks | Foundation |

---

## Complete Message Type Inventory

### GAP-01 Wire Format: Full Before/After Table

Every message type that exists in the old protocol maps to the new envelope format. The table below is the canonical inventory for the GAP-ANALYSIS.md wire format section.

#### Napplet → Shell (Inbound)

| Old Verb / Kind | Old Wire Format | New Type String | New Wire Format |
|----------------|----------------|----------------|----------------|
| `REGISTER` | `["REGISTER", {"dTag":"chat","claimedHash":"e3b0c..."}]` | (eliminated — identity at creation) | N/A |
| `AUTH` | `["AUTH", {kind:22242,tags:[["challenge","uuid"],...]}]` | (eliminated) | N/A |
| `REQ` | `["REQ", "sub-1", {"kinds":[1],"limit":10}]` | `relay.subscribe` | `{"type":"relay.subscribe","id":"uuid","subId":"uuid","filters":[...]}` |
| `CLOSE` | `["CLOSE", "sub-1"]` | `relay.close` | `{"type":"relay.close","id":"uuid","subId":"uuid"}` |
| `EVENT` (publish) | `["EVENT", {"kind":1,"content":"hello",...}]` | `relay.publish` | `{"type":"relay.publish","id":"uuid","event":{...}}` |
| `COUNT` | `["COUNT", "count-1", {"kinds":[1]}]` | `relay.query` | `{"type":"relay.query","id":"uuid","filters":[...]}` |
| `EVENT` kind 29001 | `["EVENT", {"kind":29001,"tags":[["method","signEvent"],["id","uuid"],["param","event","{...}"]],...}]` | `signer.signEvent` | `{"type":"signer.signEvent","id":"uuid","event":{...}}` |
| `EVENT` kind 29001 getPublicKey | `["EVENT", {"kind":29001,"tags":[["method","getPublicKey"],["id","uuid"]],...}]` | `signer.getPublicKey` | `{"type":"signer.getPublicKey","id":"uuid"}` |
| `EVENT` kind 29001 getRelays | `["EVENT", {"kind":29001,"tags":[["method","getRelays"],["id","uuid"]],...}]` | `signer.getRelays` | `{"type":"signer.getRelays","id":"uuid"}` |
| `EVENT` kind 29001 nip04.encrypt | `["EVENT", {"kind":29001,"tags":[["method","nip04.encrypt"],["params","pubkey","plain"]],...}]` | `signer.nip04.encrypt` | `{"type":"signer.nip04.encrypt","id":"uuid","pubkey":"...","plaintext":"..."}` |
| `EVENT` kind 29001 nip04.decrypt | Same pattern | `signer.nip04.decrypt` | `{"type":"signer.nip04.decrypt","id":"uuid","pubkey":"...","ciphertext":"..."}` |
| `EVENT` kind 29001 nip44.encrypt | Same pattern | `signer.nip44.encrypt` | `{"type":"signer.nip44.encrypt","id":"uuid","pubkey":"...","plaintext":"..."}` |
| `EVENT` kind 29001 nip44.decrypt | Same pattern | `signer.nip44.decrypt` | `{"type":"signer.nip44.decrypt","id":"uuid","pubkey":"...","ciphertext":"..."}` |
| `EVENT` kind 29003 `shell:state-get` | `["EVENT", {"kind":29003,"tags":[["t","shell:state-get"],["id","uuid"],["key","theme"]],...}]` | `storage.get` | `{"type":"storage.get","id":"uuid","key":"theme"}` |
| `EVENT` kind 29003 `shell:state-set` | `["EVENT", {"kind":29003,"tags":[["t","shell:state-set"],["id","uuid"],["key","theme"],["value","dark"]],...}]` | `storage.set` | `{"type":"storage.set","id":"uuid","key":"theme","value":"dark"}` |
| `EVENT` kind 29003 `shell:state-remove` | same pattern | `storage.remove` | `{"type":"storage.remove","id":"uuid","key":"theme"}` |
| `EVENT` kind 29003 `shell:state-clear` | same pattern | `storage.clear` | `{"type":"storage.clear","id":"uuid"}` |
| `EVENT` kind 29003 `shell:state-keys` | same pattern | `storage.keys` | `{"type":"storage.keys","id":"uuid"}` |
| `EVENT` kind 29003 (ifc emit) | `["EVENT", {"kind":29003,"tags":[["t","profile:open"]],"content":"{...}",...}]` | `ifc.emit` | `{"type":"ifc.emit","topic":"profile:open","payload":{...}}` |
| (no equivalent) | N/A | `ifc.subscribe` | `{"type":"ifc.subscribe","id":"uuid","topic":"profile:open"}` |
| (no equivalent) | N/A | `ifc.unsubscribe` | `{"type":"ifc.unsubscribe","id":"uuid","topic":"profile:open"}` |
| `EVENT` kind 29010 | `["REQ", "disc-1", {"kinds":[29010]}]` | (eliminated — `window.napplet.services.has()`) | N/A |
| `EVENT` kind 29008 hotkey | `["EVENT", {"kind":29008,"tags":[["key","k"],["ctrl","1"]],...}]` | (not yet in NIP-5D NUB scope) | keyboard.forward (non-NUB envelope, implementation detail) |

#### Shell → Napplet (Outbound)

| Old Verb | Old Wire Format | New Type String | New Wire Format |
|---------|----------------|----------------|----------------|
| `IDENTITY` | `["IDENTITY", {"pubkey":"...","privkey":"...","dTag":"chat","aggregateHash":"..."}]` | (eliminated) | N/A |
| `AUTH` challenge | `["AUTH", "challenge-uuid"]` | (eliminated) | N/A |
| `EVENT` deliver | `["EVENT", "sub-1", {"kind":1,...}]` | `relay.event` | `{"type":"relay.event","subId":"uuid","event":{...}}` |
| `OK` accepted | `["OK", "event-id", true, ""]` | `relay.publish.result` | `{"type":"relay.publish.result","id":"uuid","accepted":true}` |
| `OK` rejected | `["OK", "event-id", false, "blocked: relay:write capability denied"]` | `relay.publish.result` | `{"type":"relay.publish.result","id":"uuid","accepted":false,"message":"blocked: relay:write capability denied"}` |
| `EOSE` | `["EOSE", "sub-1"]` | `relay.eose` | `{"type":"relay.eose","subId":"uuid"}` |
| `CLOSED` | `["CLOSED", "sub-1", ""]` | `relay.closed` | `{"type":"relay.closed","subId":"uuid","message":""}` |
| `COUNT` result | `["COUNT", "count-1", {"count":42}]` | `relay.query.result` | `{"type":"relay.query.result","id":"uuid","count":42}` |
| `NOTICE` | `["NOTICE", "dropped messages..."]` | (no envelope equivalent — operational diagnostic) | shell may use `{"type":"shell.notice","message":"..."}` |
| kind 29002 signer response | `["EVENT", "sub-id", {"kind":29002,"tags":[["id","uuid"],["method","signEvent"],["result","{...}"]],...}]` | `signer.signEvent.result` | `{"type":"signer.signEvent.result","id":"uuid","event":{...}}` |
| kind 29003 state response | `["EVENT", "__shell__", {"kind":29003,"tags":[["t","napplet:state-response"],["id","uuid"],["value","dark"],["found","true"]],...}]` | `storage.get.result` | `{"type":"storage.get.result","id":"uuid","value":"dark","found":true}` |
| kind 29003 ifc delivery | `["EVENT", "sub-id", {"kind":29003,"tags":[["t","profile:open"]],"content":"{...}",...}]` | `ifc.event` | `{"type":"ifc.event","topic":"profile:open","payload":{...},"sender":"windowId"}` |

**UNCHANGED (handshake verbs — still NIP-01 array format per RUNTIME-SPEC.md):**
The REGISTER/IDENTITY/AUTH handshake is NOT part of NIP-5D v0.1.0. It remains as defined in RUNTIME-SPEC.md. `@napplet/core/src/legacy.ts` exports `VERB_REGISTER`, `VERB_IDENTITY`, `AUTH_KIND` as `@deprecated` but still functional.

---

## GAP-02: AUTH Handshake Elimination — Code Location Inventory

The complete AUTH handshake machinery lives in `packages/runtime/src/runtime.ts`. Below is the exact inventory of what gets removed.

### Removal Scope in runtime.ts

| Symbol / Structure | Location | What It Does | Status After Migration |
|-------------------|----------|-------------|----------------------|
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

### Supporting Modules Affected

| File | Symbol/Logic | Impact |
|------|-------------|--------|
| `packages/runtime/src/key-derivation.ts` | `deriveKeypair()`, `getOrCreateShellSecret()` | REMOVE or mark dead code — no delegated keypair in NIP-5D |
| `packages/runtime/src/types.ts` | `RuntimeAdapter.shellSecretPersistence` | Make optional, then deprecated — no longer required |
| `packages/runtime/src/types.ts` | `RuntimeAdapter.guidPersistence` | Review — instanceId still needed for session tracking |
| `packages/runtime/src/types.ts` | `RuntimeAdapter.hashVerifier` | Still useful for NIP-5A manifest verification — KEEP |
| `packages/runtime/src/types.ts` | `SessionEntry.pubkey` | No longer the AUTH keypair pubkey — becomes windowId or empty |
| `packages/shell/src/shell-bridge.ts` | `sendChallenge()` method on `ShellBridge` | REMOVE — calls `runtime.sendChallenge()` |
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

---

## GAP-03: window.napplet Interface → NUB Domain Mapping

All findings sourced from `@napplet/core/src/types.ts`, `@napplet/core/src/envelope.ts`, `@napplet/shim/src/index.ts`.

### Current NappletGlobal Interface (All Required Today)

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
| (no equivalent) | `theme` | Optional | NOT IMPLEMENTED — net-new NUB |

### Optionality Change Summary

NIP-5D makes all NUB capabilities optional from the shell's perspective. The `NappletGlobal` TypeScript interface in `@napplet/core` still marks all five namespaces as required — this is an interface mismatch that the migration docs must document. After migration, `ShellAdapter` gains optional fields, and `window.napplet.shell.supports('relay')` is the contract mechanism napplets use to detect what's available.

**Critical gap — `window.napplet.shell.supports()` stub:**
`@napplet/shim/src/index.ts` line ~47 contains:
```typescript
supports(capability: string): boolean {
  // TODO: Shell populates supported capabilities at iframe creation
  return false;
}
```
This stub blocks any napplet from detecting shell capabilities. Wiring it requires a new `{ type: "shell.capabilities", supports: [...] }` message or equivalent initialization from shell to shim at iframe creation.

---

## GAP-04: Silent Failure Inventory — Exact File:Function:Line

These are the specific locations where new-format messages are dropped without error when received by the current kehto runtime.

### Failure Point 1: ShellBridge Array Guard
**File:** `packages/shell/src/shell-bridge.ts`
**Function:** `createShellBridge` → `handleMessage`
**Line:** 155
**Code:** `if (!Array.isArray(msg) || msg.length < 2) return;`
**What fails:** ANY `{ type: "..." }` envelope object from an updated `@napplet/shim`. All NUB messages are silently dropped here before ever reaching the runtime.
**Reproduction:** Send `{ type: "relay.subscribe", id: "x", subId: "x", filters: [] }` via postMessage to a kehto shell. ShellBridge returns on line 155. No error, no response.

### Failure Point 2: Runtime handleMessage Array Check
**File:** `packages/runtime/src/runtime.ts`
**Function:** `handleMessage`
**Line:** 1005
**Code:** `if (!Array.isArray(msg) || msg.length < 2) return;`
**What fails:** Even if an envelope object bypasses the shell-bridge guard, the runtime's own guard drops it again. This is the runtime's entry point defense.
**Reproduction:** Call `runtime.handleMessage(windowId, { type: "relay.subscribe", ... } as any)`. Returns immediately on line 1005.

### Failure Point 3: runtime.ts Auth Queue — Napplet Without AUTH Never Processes Messages
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
**What fails:** Updated `@napplet/shim` (v0.2.0) no longer sends `REGISTER`/`AUTH` messages. The runtime never sets `sessionRegistry.pubkey(windowId)` for these sessions. All messages from NIP-5D napplets are queued in `pendingAuthQueue` forever and never dispatched. This queue grows without bound.
**Reproduction:** Load a napplet using `@napplet/shim` v0.2.0. Send any NUB message. Check `pendingAuthQueue.size` — grows indefinitely.

### Failure Point 4: enforce.ts resolveCapabilities — Unknown Verb Falls to `relay:write`
**File:** `packages/runtime/src/enforce.ts`
**Function:** `resolveCapabilities`
**Lines:** 99–102
**Code:**
```typescript
default:
  // Unknown verb — require relay:write as a safe default
  return { senderCap: 'relay:write', recipientCap: null };
```
**What fails:** If an envelope object somehow passes both guards (e.g., in direct unit tests), `resolveCapabilities` receives `msg[0]` = `undefined` (not a string verb). Falls to default case and requires `relay:write`. ACL check fires for `relay:write` even though the message was `relay.subscribe` (which should require `relay:read`). Wrong capability enforced — napplets with only `relay:read` are denied subscription requests.
**Reproduction:** Pass `[{ type: "relay.subscribe", ... }]` (wrapped in array) to `resolveCapabilities`. Returns `{ senderCap: 'relay:write', recipientCap: null }` instead of `{ senderCap: 'relay:read', recipientCap: null }`.

### Failure Point 5: state-handler.ts BusKind.IPC_PEER Topic Routing
**File:** `packages/runtime/src/state-handler.ts`
**Function:** `handleStateRequest`
**Lines:** 82–84
**Code:**
```typescript
const topic = event.tags?.find((t) => t[0] === 't')?.[1];
const key = event.tags?.find((t) => t[0] === 'key')?.[1];
const correlationId = event.tags?.find((t) => t[0] === 'id')?.[1] ?? '';
```
**What fails:** This handler only runs when called from `runtime.ts:622` after detecting `BusKind.IPC_PEER` kind and `shell:state-*` topic. Since `storage.get` envelope objects are never recognized as `BusKind.IPC_PEER` events, this handler is never invoked for NIP-5D storage requests. `window.napplet.storage.getItem()` calls time out silently in the napplet.
**Reproduction:** With `@napplet/shim` v0.2.0: `await window.napplet.storage.getItem('key')` — hangs until shim's internal timeout (typically 5–30 seconds).

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
**What fails:** `ifc.emit` envelope objects never produce an IPC_PEER event with a `t` tag. The service dispatch function is never called for NUB ifc messages. Additionally, even if it were called, it extracts the prefix before `:` — `ifc.emit` has `.` not `:`, so `colonIndex === -1` and it returns false immediately. All NUB-format service messages (audio, notifications via ifc.emit) are silently unrouted.
**Reproduction:** Register an audio service handler. Send `{ type: "ifc.emit", topic: "audio:play", ... }` from an updated shim. `routeServiceMessage` is never invoked. Audio handler never fires.

---

## GAP-05: Per-Package Boundary Contracts

### @kehto/acl Boundary Contract

**What crosses the boundary:** `check(state, identity, cap)` — called by runtime enforce.ts

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

**Verification criterion:** `aclStore.check(state, { pubkey: '', dTag: 'chat', hash: 'abc' }, CAP_RELAY_READ)` returns the expected value. Existing persisted ACL entries under `pubkey:dTag:hash` keys require a one-time migration utility.

---

### @kehto/runtime Boundary Contract

**Inbound surface (what the runtime accepts):**

Current:
```typescript
// packages/runtime/src/runtime.ts:66
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

**Outbound surface (what the runtime sends via RuntimeAdapter.sendToNapplet):**

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

**Verification criterion:** A napplet sending `{ type: "relay.subscribe", id: "x", subId: "x", filters: [{kinds:[1]}] }` receives back `{ type: "relay.eose", subId: "x" }` within 1 second when no matching events exist.

---

### @kehto/shell Boundary Contract

**Inbound surface (ShellBridge.handleMessage):**

Current:
```typescript
// packages/shell/src/shell-bridge.ts:149-158
handleMessage(event: MessageEvent): void {
  const msg = event.data;
  if (!Array.isArray(msg) || msg.length < 2) return;  // <-- DROP POINT
  runtime.handleMessage(windowId, msg);
}
```

Target:
```typescript
handleMessage(event: MessageEvent): void {
  const msg = event.data;
  // Accept envelope objects:
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

**Outbound surface (`sendToNapplet` via ShellAdapter):**

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

---

### @kehto/services Boundary Contract

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
    message: NappletMessage,          // { type: "signer.signEvent", id, event }
    send: (msg: NappletMessage) => void  // { type: "signer.signEvent.result", ... }
  ): void;
  onWindowDestroyed?(windowId: string): void;
}
```

**Per-service migration contracts:**

| Service | Old trigger | New trigger | Response format change |
|---------|------------|------------|----------------------|
| signer | `event.kind === 29001` (BusKind.SIGNER_REQUEST) + `method` tag | `message.type === "signer.signEvent"` (or other signer.* types) | From kind 29002 event → `{ type: "signer.signEvent.result", id, event }` |
| audio | `event.kind === 29003` (IPC_PEER) + `t` tag prefix `audio:` | `message.type === "ifc.emit"` with `topic.startsWith("audio:")` | From IPC_PEER response → `{ type: "ifc.event", topic: "audio:...", payload }` |
| notifications | `event.kind === 29003` (IPC_PEER) + `t` tag prefix `notifications:` | `message.type === "ifc.emit"` with `topic.startsWith("notifications:")` | From IPC_PEER response → `{ type: "ifc.event", ... }` |

**Verification criterion:** `serviceHandler.handleMessage(windowId, { type: "signer.getPublicKey", id: "uuid" }, send)` results in `send` being called with `{ type: "signer.getPublicKey.result", id: "uuid", publicKey: "..." }`.

---

## Architecture Patterns

### Recommended Document Structure for GAP-ANALYSIS.md

```
docs/
└── GAP-ANALYSIS.md
    ├── ## Summary / Changelog (optional — Claude's discretion)
    ├── ## 1. Wire Format Change (GAP-01)
    │   ├── Before/after examples for every message type
    │   ├── Migration priority: HIGH — blocks all NIP-5D napplets
    │   └── Verification criteria
    ├── ## 2. Identity Model Change / AUTH Elimination (GAP-02)
    │   ├── AUTH handshake removal scope (file:function:line)
    │   ├── Identity key schema change
    │   └── Migration priority: HIGH — depends on Runtime migration
    ├── ## 3. window.napplet Interface → NUB Domain Mapping (GAP-03)
    │   ├── Optionality table
    │   ├── shell.supports() wiring gap
    │   ├── window.nostr injection requirement
    │   └── theme NUB (deferred/out of scope)
    ├── ## 4. Silent Failure Inventory (GAP-04)
    │   └── 6 specific file:function:line failure points with reproduction steps
    └── ## 5. Per-Package Boundary Contracts (GAP-05)
        ├── @kehto/acl contract (Identity key change)
        ├── @kehto/runtime contract (handleMessage + sendToNapplet)
        ├── @kehto/shell contract (ShellBridge guard + ShellAdapter)
        └── @kehto/services contract (ServiceHandler interface)
```

### Migration Priority Order

Per dependency analysis in ARCHITECTURE.md:

1. **@kehto/acl** — Identity key schema (no deps, no blockers)
2. **@kehto/runtime** — NUB dispatch + AUTH removal (depends on acl)
3. **@kehto/shell** — Envelope guard (depends on runtime interface)
4. **@kehto/services** — ServiceHandler interface (depends on runtime dispatch)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| NUB message type definitions | Custom inline type shapes | `@napplet/nub-relay`, `@napplet/nub-signer`, `@napplet/nub-storage`, `@napplet/nub-ifc` as devDependencies — types already defined |
| NUB dispatch infrastructure | Custom domain-prefix router | `createDispatch`, `registerNub`, `dispatch` from `@napplet/core` v0.2.0 — already exported |
| ACL data migration utility | Custom localStorage scanner | Pattern is `get(key)` / `delete(key)` / `set(newKey, value)` — trivial in-runtime migration; no external library |

---

## Common Pitfalls

### Pitfall 1: Documenting AUTH as "changed" rather than "removed"
NIP-5D v0.1.0 is explicitly silent on the AUTH handshake. The spec was written to leave room for implementations that do want authentication. RUNTIME-SPEC.md AUTH is still valid implementation behavior, not a deprecated feature. The GAP-ANALYSIS.md must be precise: the AUTH handshake is NOT removed from kehto's internal implementation; only the requirement that napplets complete AUTH before their messages are processed changes. The new `@napplet/shim` does not initiate AUTH — but the kehto runtime could still support AUTH-initiating napplets if it chooses. The document should frame this as "AUTH becomes optional / triggered differently" rather than "AUTH is gone."

**Correction from research:** Based on ARCHITECTURE.md and PITFALLS.md review, the cleaner framing is: NIP-5D identity model replaces AUTH as the *required* authentication pathway. Kehto may retain AUTH support for legacy napplets, but new napplets rely solely on source-based identity. The gap analysis should document both models and recommend the dual-mode approach for transition.

### Pitfall 2: Missing the window.nostr injection requirement
NIP-5D adds a mandatory requirement not in RUNTIME-SPEC.md: "Shells MUST provide a NIP-07 window.nostr implementation to each napplet iframe." This is distinct from the signer proxy. It requires direct iframe context injection at creation time. The GAP-ANALYSIS.md must surface this as a new requirement in the @kehto/shell section.

### Pitfall 3: ACL composite key migration vs. format change
`packages/acl/src/check.ts` uses `pubkey:dTag:hash` as the composite key. Existing users may have persisted ACL entries under this format. The gap document must distinguish between:
- **Format change**: Code change to `dTag:hash` for new entries
- **Data migration**: Utility to convert existing `localStorage` entries

These are different tasks and must appear in separate phases (ACL migration doc vs. ACL migration utility).

### Pitfall 4: Treating the 6 silent failure points as 1 change
Each failure point in GAP-04 requires a separate code change. They are in different files, different functions, and have different fix strategies. The gap analysis document should list each individually with its own verification step — not group them as "update the message format check."

---

## Code Examples

### Example: Correct dispatchVerb/handleMessage target pattern
```typescript
// Source: packages/runtime/src/runtime.ts:1004 (current) → target pattern
function handleMessage(windowId: string, msg: unknown): void {
  // NIP-5D envelope path (new)
  if (typeof msg === 'object' && msg !== null && typeof (msg as { type?: unknown }).type === 'string') {
    const envelope = msg as NappletMessage;
    const domain = envelope.type.split('.')[0];
    const handler = nubRegistry.get(domain);
    if (handler) { handler(windowId, envelope); return; }
    // Unrecognized type: MUST silently ignore per NIP-5D spec
    return;
  }
  // Legacy NIP-01 array path (backward compat)
  if (!Array.isArray(msg) || msg.length < 2) return;
  const [verb] = msg as unknown[];
  if (verb === 'AUTH') { void handleAuth(msg as unknown[], windowId); return; }
  if (verb === VERB_REGISTER) { void handleRegister(msg as unknown[], windowId); return; }
  // ... existing verb dispatch
}
```

### Example: ACL toKey() target pattern
```typescript
// Source: packages/acl/src/check.ts:22 (current) → target
function toKey(identity: Identity): string {
  // Post-migration: pubkey removed from composite key
  return `${identity.dTag}:${identity.hash}`;
}
// Migration utility (one-time, run at shell startup):
function migrateAclKey(storage: Storage): void {
  for (const key of Object.keys(storage)) {
    if (!key.startsWith('napplet:acl:')) continue;
    // Old format: napplet:acl:pubkey:dTag:hash
    // New format: napplet:acl:dTag:hash
    // ...parse and rewrite
  }
}
```

### Example: ServiceHandler target interface
```typescript
// Source: packages/runtime/src/types.ts:486 (current) → target
import type { NappletMessage } from '@napplet/core';

export interface ServiceHandler {
  descriptor: ServiceDescriptor;
  handleMessage(
    windowId: string,
    message: NappletMessage,
    send: (msg: NappletMessage) => void,
  ): void;
  onWindowDestroyed?(windowId: string): void;
}
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.x |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `pnpm test:unit` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map

Phase 1 produces a documentation artifact (`docs/GAP-ANALYSIS.md`), not code. Tests for this phase are content-verification checks, not unit tests.

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GAP-01 | GAP-ANALYSIS.md contains before/after wire format for all message types | manual | Review document | N/A (doc review) |
| GAP-02 | AUTH section enumerates all file:line locations and removal scope | manual | Review document | N/A (doc review) |
| GAP-03 | Every window.napplet namespace maps to a NUB domain with optionality status | manual | Review document | N/A (doc review) |
| GAP-04 | Silent failure inventory has file:function:line for each point | manual | Review document | N/A (doc review) |
| GAP-05 | Boundary contracts include TypeScript interface snippets + verification criteria | manual | Review document | N/A (doc review) |

**Note:** All phase 1 requirements are documentation completeness checks. There are no automated tests for this phase. Verification criteria are embedded within GAP-ANALYSIS.md itself (per locked decision: "each contract includes verification criteria"). The planner may optionally add a CI lint step to verify the file exists at `docs/GAP-ANALYSIS.md`.

### Wave 0 Gaps
None — no test infrastructure needed for Phase 1 (documentation-only output).

---

## Environment Availability

Step 2.6: SKIPPED — Phase 1 has no external tool dependencies. All inputs are source files in the local repository. Output is a markdown document. No CLI tools, services, or runtimes beyond the existing project setup are required.

---

## Open Questions

1. **AUTH as "optional" vs "removed" framing**
   - What we know: NIP-5D v0.1.0 is silent on AUTH; the `@napplet/shim` v0.2.0 does not initiate AUTH; `@napplet/core` marks AUTH constants as `@deprecated`
   - What's unclear: Whether kehto should continue supporting AUTH for legacy napplets in a dual-mode period, or drop it entirely for the migration milestone
   - Recommendation: The GAP-ANALYSIS.md should document both models and present the dual-mode option; the specific migration decision belongs in the @kehto/runtime Phase 3 plan

2. **`shell.supports()` wiring mechanism**
   - What we know: The stub returns `false`; shells must inject capability data; no existing mechanism
   - What's unclear: Whether the injection uses a new `{ type: "shell.capabilities", ... }` message type or is set via `iframe.contentWindow` object injection at creation time
   - Recommendation: The gap analysis documents the stub as a known gap; the specific solution belongs in the @kehto/shell Phase 4 plan

3. **`window.nostr` injection mechanism**
   - What we know: NIP-5D MUST requirement; not in RUNTIME-SPEC.md; current shim uses signer proxy as fallback
   - What's unclear: Whether this blocks Phase 4 or can be addressed separately
   - Recommendation: Document as a new gap in the @kehto/shell boundary contract; flag as separate task in Phase 4

---

## Sources

### Primary (HIGH confidence)
- `RUNTIME-SPEC.md` — Complete NIP-01 wire format specification (before-state)
- `nubs/SPEC.md` — NIP-5D v0.1.0 transport/identity spec (after-state)
- `packages/runtime/src/runtime.ts` — Auth machinery exact locations (lines 141, 143, 144, 208, 215, 236, 325, 1005, 1010, 1024)
- `packages/runtime/src/enforce.ts` — BusKind capability resolution (lines 43-103)
- `packages/runtime/src/state-handler.ts` — Kind 29003 storage handler (lines 82-155)
- `packages/runtime/src/service-dispatch.ts` — Topic-prefix routing (lines 32-48)
- `packages/shell/src/shell-bridge.ts` — Array.isArray guard (line 155)
- `packages/runtime/src/types.ts` — ServiceHandler, RuntimeAdapter, SessionEntry interfaces
- `packages/acl/src/types.ts` — Identity, AclState interfaces
- `packages/acl/src/check.ts` — toKey() composite key function (line 23)

### Secondary (HIGH confidence — milestone research artifacts)
- `.planning/research/STACK.md` — Wire format comparison, dependency changes (researched 2026-04-07)
- `.planning/research/FEATURES.md` — NUB domain mapping, interface changes (researched 2026-04-07)
- `.planning/research/ARCHITECTURE.md` — Integration flow, migration order (researched 2026-04-07)
- `.planning/research/PITFALLS.md` — Silent failure points, AUTH removal risks (researched 2026-04-07)

---

## Metadata

**Confidence breakdown:**
- Message type inventory (GAP-01): HIGH — sourced directly from RUNTIME-SPEC.md and NUB package types.ts files
- AUTH code locations (GAP-02): HIGH — sourced from runtime.ts line-by-line review
- Interface mapping (GAP-03): HIGH — sourced from @napplet/core types, shim source
- Silent failure locations (GAP-04): HIGH — sourced from exact code path trace through shell-bridge → runtime → handlers
- Boundary contracts (GAP-05): HIGH — sourced from current TypeScript interfaces in all four packages

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable codebase — both repos are in active development, re-verify if major commits land before planning)
