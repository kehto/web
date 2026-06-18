> **Archived — terminal-state snapshot.**
> This document captures a historical migration or audit and is not active guidance.
> Current canonical documentation lives in the repo root [`README.md`](../../README.md), the per-package READMEs under [`packages/`](../../packages/), and the typedoc-generated reference at [`docs/api/`](../api/).
> Retained for historical reference only.

---

# Runtime Migration: @kehto/runtime — RUNTIME-SPEC v2.0.0 to NIP-5D v0.1.0

**Date:** 2026-04-07
**Package:** @kehto/runtime
**Scope:** NAP dispatch design, AUTH removal scope, handler rewrites, session identity anchor
**References:** [GAP-ANALYSIS.md section 5.2](./GAP-ANALYSIS.md#52-kehtooruntime-boundary-contract), [ACL-MIGRATION.md section 2](./ACL-MIGRATION.md#2-capability-constant-to-nap-domain-mapping)

---

## 1. NAP Dispatch Design (RT-01)

### 1.1 Background

`packages/runtime/src/runtime.ts` handles all incoming napplet messages through `handleMessage(windowId, msg)`. Under RUNTIME-SPEC v2.0.0 the function's first act is an array check, followed by extracting `msg[0]` as the verb string and dispatching through `dispatchVerb()`.

The verb switch at `runtime.ts:224–232` covers six cases:

```typescript
function dispatchVerb(verb: unknown, msg: unknown[], windowId: string): void {
  switch (verb) {
    case 'EVENT':        handleEvent(msg, windowId); break;
    case 'REQ':          handleReq(msg, windowId); break;
    case 'CLOSE':        handleClose(msg, windowId); break;
    case 'COUNT':        handleCount(msg, windowId); break;
    case VERB_REGISTER:  void handleRegister(msg, windowId); break;
  }
}
```

`AUTH` is handled before the queue check at `runtime.ts:1007`:

```typescript
// runtime.ts:1004–1017
function handleMessage(windowId: string, msg: unknown[]): void {
  if (!Array.isArray(msg) || msg.length < 2) return;   // line 1005 — array guard
  const [verb] = msg;
  if (verb === 'AUTH') { void handleAuth(msg, windowId); return; }
  if (verb === VERB_REGISTER) { void handleRegister(msg, windowId); return; }
  if (!sessionRegistry.getPubkey(windowId)) {           // line 1010 — pre-AUTH queue
    let queue = pendingAuthQueue.get(windowId);
    if (!queue) { queue = []; pendingAuthQueue.set(windowId, queue); }
    queue.push({ msg, windowId });
    return;
  }
  dispatchVerb(verb, msg, windowId);
}
```

NIP-5D v0.1.0 eliminates the NIP-01 verb model. Every message from an updated `@napplet/shim` (v0.2.0+) is a plain JSON object of the form `{ "type": "domain.action", ...payload }`. The `msg[0]` verb check is the root of every silent failure described in GAP-ANALYSIS.md section 4 — a NIP-5D envelope is not an array, so `Array.isArray(msg)` returns `false` at line 1005 and the message is dropped immediately.

---

### 1.2 Before/After Dispatch Comparison

| Dimension | Old (RUNTIME-SPEC v2.0.0) | New (NIP-5D v0.1.0) |
|-----------|--------------------------|---------------------|
| Message shape | `["VERB", ...params]` | `{ "type": "domain.action", ...payload }` |
| Dispatch key | `msg[0]` — verb string | `msg.type.split('.')[0]` — domain prefix |
| Entry guard | `Array.isArray(msg) && msg.length >= 2` | `typeof msg === 'object' && msg !== null && 'type' in msg` |
| Verbs handled | `REGISTER`, `AUTH`, `EVENT`, `REQ`, `CLOSE`, `COUNT` | `relay`, `signer`, `storage`, `inc` |
| Identity gate | Pre-AUTH queue (`pendingAuthQueue`) blocks all messages until AUTH completes | No gate — identity is registered at iframe creation via `originRegistry` |
| Capability resolution | `resolveCapabilities(msg: unknown[])` — switches on `msg[0]` verb + `BusKind` event kind | `resolveCapabilitiesNap(msg: NappletMessage)` — splits `msg.type` on `.` |

#### Old dispatch (verb switch, `runtime.ts:224–232`)

```typescript
function dispatchVerb(verb: unknown, msg: unknown[], windowId: string): void {
  switch (verb) {
    case 'EVENT':        handleEvent(msg, windowId); break;
    case 'REQ':          handleReq(msg, windowId); break;
    case 'CLOSE':        handleClose(msg, windowId); break;
    case 'COUNT':        handleCount(msg, windowId); break;
    case VERB_REGISTER:  void handleRegister(msg, windowId); break;
  }
}
```

#### New dispatch (domain-prefix switch, `runtime.ts` post-migration)

The target pattern is taken directly from [GAP-ANALYSIS.md section 5.2](./GAP-ANALYSIS.md#52-kehtooruntime-boundary-contract):

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

---

### 1.3 Dual-Mode Dispatch (Transition)

The recommended approach for the migration period is **dual-mode dispatch**: detect the message format at the top of `handleMessage()` and route to the appropriate handler.

```typescript
function handleMessage(windowId: string, msg: unknown[] | NappletMessage): void {
  // NIP-5D envelope path — NAP dispatch
  if (typeof msg === 'object' && msg !== null && !Array.isArray(msg) && 'type' in msg) {
    const domain = (msg as NappletMessage).type.split('.')[0];
    switch (domain) {
      case 'relay':   return handleRelayMessage(windowId, msg as NappletMessage);
      case 'signer':  return handleSignerMessage(windowId, msg as NappletMessage);
      case 'storage': return handleStorageMessage(windowId, msg as NappletMessage);
      case 'inc':     return handleIncMessage(windowId, msg as NappletMessage);
      default:        return;
    }
  }
  // Legacy NIP-01 array path — backward compat for @napplet/shim v0.1.x
  if (!Array.isArray(msg) || msg.length < 2) return;
  const [verb] = msg;
  if (verb === 'AUTH') { void handleAuth(msg as unknown[], windowId); return; }
  if (verb === VERB_REGISTER) { void handleRegister(msg as unknown[], windowId); return; }
  if (!sessionRegistry.getPubkey(windowId)) {
    let queue = pendingAuthQueue.get(windowId);
    if (!queue) { queue = []; pendingAuthQueue.set(windowId, queue); }
    queue.push({ msg: msg as unknown[], windowId });
    return;
  }
  dispatchVerb(verb, msg as unknown[], windowId);
}
```

**Important constraints on dual-mode:**

- Dual-mode is **only for the transition period**. The end state is NAP-only dispatch. ARCHITECTURE.md Anti-Pattern 1 identifies keeping dual-mode indefinitely as a correctness risk because it requires every handler to handle two formats.
- Per STACK.md "What NOT to Do": removing NIP-01 array handling entirely in a single step breaks napplets still on `@napplet/shim` v0.1.x. Dual-mode is the correct bridge approach, with a planned deprecation timeline.
- The NIP-5D path MUST be checked first. This ensures the old array guard (`Array.isArray(msg)`) does not drop NAP envelope objects before they reach the new handler.
- NAP path messages bypass the `pendingAuthQueue` — there is no AUTH gate for NIP-5D napplets. Identity is already registered via `originRegistry.register()` before the first message arrives.

---

### 1.4 Capability Resolution Migration

`packages/runtime/src/enforce.ts` currently implements `resolveCapabilities(msg: unknown[])`. It dispatches on `msg[0]` (verb string) and then on `BusKind` event kind numbers to determine the required capability for each message:

```typescript
// enforce.ts:42–103 — current implementation
export function resolveCapabilities(msg: unknown[]): CapabilityResolution {
  const verb = msg[0];
  switch (verb) {
    case 'AUTH':  return { senderCap: null, recipientCap: null };
    case 'CLOSE': return { senderCap: null, recipientCap: null };
    case 'REQ':   return { senderCap: 'relay:read', recipientCap: null };
    case 'COUNT': return { senderCap: 'relay:read', recipientCap: null };
    case 'EVENT': {
      // Inspect event.kind + topic tag for IPC_PEER, SIGNER_REQUEST, HOTKEY_FORWARD...
    }
    default:
      return { senderCap: 'relay:write', recipientCap: null }; // line 100 — unknown verb
  }
}
```

After migration this function is replaced by `resolveCapabilitiesNap()`, which maps the NAP `type` string to capabilities. The pseudocode is defined in [ACL-MIGRATION.md section 2](./ACL-MIGRATION.md#2-capability-constant-to-nap-domain-mapping):

```typescript
function resolveCapabilitiesNap(msg: NappletMessage): CapabilityResolution {
  const [domain, action] = msg.type.split('.');
  switch (domain) {
    case 'relay':
      return action === 'publish'
        ? { senderCap: 'relay:write', recipientCap: 'relay:read' }
        : { senderCap: 'relay:read', recipientCap: null };
    case 'signer':
      if (action === 'getPublicKey' || action === 'getRelays') return { senderCap: null, recipientCap: null };
      if (action?.startsWith('nip04')) return { senderCap: 'sign:nip04', recipientCap: null };
      if (action?.startsWith('nip44')) return { senderCap: 'sign:nip44', recipientCap: null };
      return { senderCap: 'sign:event', recipientCap: null };
    case 'storage':
      return (action === 'get' || action === 'keys')
        ? { senderCap: 'state:read', recipientCap: null }
        : { senderCap: 'state:write', recipientCap: null };
    case 'inc':
      return action === 'emit'
        ? { senderCap: 'relay:write', recipientCap: 'relay:read' }
        : { senderCap: 'relay:read', recipientCap: null };
    case 'theme':
      return { senderCap: null, recipientCap: null };
    default:
      return { senderCap: null, recipientCap: null }; // unknown domain — silently ignore
  }
}
```

#### Complete msg.type to Capability Mapping

| NAP `msg.type` string | Required Capability | Sender/Recipient | Notes |
|----------------------|---------------------|------------------|-------|
| `relay.subscribe` | `relay:read` | sender | REQ equivalent |
| `relay.close` | `relay:read` | sender | CLOSE equivalent (no ACL check currently) |
| `relay.query` | `relay:read` | sender | COUNT equivalent |
| `relay.publish` | `relay:write` + `relay:read` | sender + recipient | EVENT publish; recipient must have read to receive |
| `signer.signEvent` | `sign:event` | sender | kind 29001 method=signEvent equivalent |
| `signer.getPublicKey` | none | sender | read-only; no ACL check required |
| `signer.getRelays` | none | sender | read-only; no ACL check required |
| `signer.nip04.encrypt` | `sign:nip04` | sender | kind 29001 method=nip04.encrypt equivalent |
| `signer.nip04.decrypt` | `sign:nip04` | sender | kind 29001 method=nip04.decrypt equivalent |
| `signer.nip44.encrypt` | `sign:nip44` | sender | kind 29001 method=nip44.encrypt equivalent |
| `signer.nip44.decrypt` | `sign:nip44` | sender | kind 29001 method=nip44.decrypt equivalent |
| `storage.get` | `state:read` | sender | kind 29003 topic=shell:state-get equivalent |
| `storage.keys` | `state:read` | sender | kind 29003 topic=shell:state-keys equivalent |
| `storage.set` | `state:write` | sender | kind 29003 topic=shell:state-set equivalent |
| `storage.remove` | `state:write` | sender | kind 29003 topic=shell:state-remove equivalent |
| `storage.clear` | `state:write` | sender | kind 29003 topic=shell:state-clear equivalent |
| `inc.emit` | `relay:write` + `relay:read` | sender + recipient | IPC_PEER emit; recipient needs relay:read |
| `inc.subscribe` | `relay:read` | sender | inc subscription registration |
| `inc.unsubscribe` | `relay:read` | sender | no capability check needed; included for completeness |
| `theme.*` | none | — | Read-only shell state, no user data |

---

### 1.5 Affected Files

The dispatch migration touches these files:

| File | Change | Lines Affected |
|------|--------|----------------|
| `packages/runtime/src/runtime.ts` | Replace `handleMessage()` array guard + verb switch with dual-mode or NAP dispatch | 1004–1017, 224–232 |
| `packages/runtime/src/enforce.ts` | Replace `resolveCapabilities(msg: unknown[])` with `resolveCapabilitiesNap(msg: NappletMessage)` | 42–103 |
| `packages/runtime/src/types.ts` | Widen `SendToNapplet` and `handleMessage` signatures to accept `NappletMessage | unknown[]` | 47, (Runtime interface) |
| `packages/shell/src/shell-bridge.ts` | Replace array guard at line 155 with dual-format check (accepts both `{ type: string }` and arrays) | 149–158 |

---

## 2. AUTH Removal Scope (RT-02)

### 2.1 Background

Under RUNTIME-SPEC v2.0.0, no napplet message is processed until the napplet has completed a 3-phase handshake:

1. **REGISTER** (`runtime.ts:236`) — Napplet sends `["REGISTER", { dTag, claimedHash }]`. Shell derives a deterministic HMAC keypair via `key-derivation.ts:deriveKeypair(shellSecret, dTag, aggregateHash)`, stores the pending registration in `pendingRegistrations`, sends `["IDENTITY", { pubkey, privkey, dTag, aggregateHash }]` back, then immediately calls `runtimeInstance.sendChallenge(windowId)`.

2. **AUTH challenge** (`runtime.ts:1024`) — `sendChallenge()` generates a random UUID, stores it in `pendingChallenges`, and sends `["AUTH", challengeUuid]` to the napplet.

3. **AUTH response** (`runtime.ts:325`) — Napplet signs a NIP-42 kind 22242 event using the delegated privkey and sends `["AUTH", authEvent]`. `handleAuth()` verifies the Schnorr signature (`hooks.crypto.verifyEvent`), matches the challenge tag, validates the relay tag equals `SHELL_BRIDGE_URI`, checks `created_at` within 60 seconds, and confirms `authEvent.pubkey` matches `registration.pubkey`. On success it calls `sessionRegistry.register(windowId, entry)` and drains `pendingAuthQueue`.

Any message received before AUTH completes is silently queued in `pendingAuthQueue` (`runtime.ts:1010–1014`). If AUTH never completes — as is the case for NIP-5D napplets that never send REGISTER — the queue grows without bound (see [GAP-ANALYSIS.md section 4, Failure Point 3](./GAP-ANALYSIS.md#failure-point-3-auth-queue-messages-queued-forever)).

The full AUTH lifecycle is described in [GAP-ANALYSIS.md section 2](./GAP-ANALYSIS.md#2-identity-model-change--auth-elimination-gap-02).

---

### 2.2 Removal Inventory

#### runtime.ts (1119 lines total)

| Symbol / Structure | Line(s) | Purpose | Post-Migration Status |
|-------------------|---------|---------|----------------------|
| `AUTH_KIND` import | 14 | From `@napplet/core` — kind 22242 constant for AUTH event | REMOVE import |
| `VERB_REGISTER` import | 16 | From `@napplet/core` — `"REGISTER"` verb string | REMOVE import |
| `VERB_IDENTITY` import | 16 | From `@napplet/core` — `"IDENTITY"` verb string | REMOVE import |
| `pendingChallenges` | 141 | `Map<windowId, challengeString>` — outstanding AUTH challenges | REMOVE |
| `pendingAuthQueue` | 143 | `Map<windowId, msg[]>` — queues messages before AUTH completes | REMOVE |
| `authInFlight` | 144 | `Set<windowId>` — prevents duplicate concurrent AUTH verification | REMOVE |
| `shellSecret` | 203–205 | Loaded from `hooks.shellSecretPersistence` — HMAC key for keypair derivation | REMOVE (no delegated keypair in NIP-5D) |
| `pendingRegistrations` | 208–213 | `Map<windowId, { dTag, aggregateHash, pubkey, instanceId }>` — stores REGISTER payload until AUTH arrives | REMOVE |
| `delegatedPubkeys` | 216 | `Set<string>` — tracks derived AUTH keys to block external relay publishing | REMOVE |
| `VERB_REGISTER` dispatch | 230 | `case VERB_REGISTER: void handleRegister(msg, windowId); break;` | REMOVE |
| `handleRegister()` | 236–323 | Handles `["REGISTER", payload]` — derives keypair, sends IDENTITY, sends challenge | REMOVE (88 lines) |
| `handleAuth()` | 325–464 | Handles `["AUTH", authEvent]` — verifies kind 22242 Schnorr signature | REMOVE (140 lines) |
| AUTH pre-queue logic | 1010–1014 | Inside `handleMessage` — if not authenticated, queue message | REMOVE |
| `AUTH` dispatch | 1007 | `if (verb === 'AUTH') { void handleAuth(msg, windowId); return; }` | REMOVE |
| `sendChallenge()` | 1024–1028 | Public `Runtime` method — sends `["AUTH", challengeUuid]` | REMOVE from interface |
| `pendingChallenges.clear()` | 1047 | In `destroy()` — cleanup on shutdown | REMOVE |
| `pendingAuthQueue.clear()` | 1048 | In `destroy()` — cleanup on shutdown | REMOVE |
| `authInFlight.clear()` | 1049 | In `destroy()` — cleanup on shutdown | REMOVE |
| `pendingRegistrations.clear()` | 1056 | In `destroy()` — cleanup on shutdown | REMOVE |
| `delegatedPubkeys.clear()` | 1057 | In `destroy()` — cleanup on shutdown | REMOVE |
| `pendingChallenges.delete()` | 1106 | In `destroyWindow()` — cleanup on window close | REMOVE |
| `pendingAuthQueue.delete()` | 1107 | In `destroyWindow()` — cleanup on window close | REMOVE |
| `authInFlight.delete()` | 1108 | In `destroyWindow()` — cleanup on window close | REMOVE |

#### Supporting Modules

| File | Symbol / Logic | Post-Migration Status |
|------|---------------|----------------------|
| `packages/runtime/src/key-derivation.ts` | `deriveKeypair()` — derives secp256k1 keypair from HMAC-SHA256(shellSecret, dTag+hash) | DEAD CODE — no delegated keypair in NIP-5D; mark as deprecated or delete |
| `packages/runtime/src/key-derivation.ts` | `derivePrivateKey()` — low-level HMAC key derivation | DEAD CODE — same as above |
| `packages/runtime/src/key-derivation.ts` | `getOrCreateShellSecret()` — generates/loads 32-byte shell secret | DEAD CODE — no shell secret needed without keypair derivation |
| `packages/runtime/src/types.ts` | `RuntimeAdapter.shellSecretPersistence` | Make optional, then deprecated — no longer required for core identity |
| `packages/runtime/src/types.ts` | `RuntimeAdapter.guidPersistence` | REVIEW — `instanceId` for session tracking may still be useful; not AUTH-specific |
| `packages/runtime/src/types.ts` | `RuntimeAdapter.hashVerifier` | KEEP — still used for NIP-5A manifest verification (`hooks.onHashMismatch`) |
| `packages/runtime/src/types.ts` | `SessionEntry.pubkey` | REDEFINE — currently the AUTH keypair pubkey; becomes `windowId` or empty string; field should remain for backward compat but semantics change |
| `packages/shell/src/shell-bridge.ts` | `sendChallenge()` method | REMOVE — calls `runtime.sendChallenge()` which no longer exists |
| `packages/shell/src/shell-bridge.ts` | `VERB_REGISTER` import | REMOVE |
| `packages/shell/src/shell-bridge.ts` | `AUTH_KIND` import | REMOVE |

---

### 2.3 Code Volume Estimate

AUTH machinery in `runtime.ts` by line count:

| Section | Lines | Count |
|---------|-------|-------|
| AUTH imports (`AUTH_KIND`, `VERB_REGISTER`, `VERB_IDENTITY`) | 14, 16 | ~2 |
| `deriveKeypair` / `getOrCreateShellSecret` import | 28 | 1 |
| State variables (`pendingChallenges`, `pendingAuthQueue`, `authInFlight`) | 141–144 | ~4 |
| `shellSecret` initialization | 203–205 | 3 |
| `pendingRegistrations` + `delegatedPubkeys` declarations | 208–216 | ~9 |
| `VERB_REGISTER` case in `dispatchVerb` | 230 | 1 |
| `handleRegister()` function | 236–323 | **88** |
| `handleAuth()` function | 325–464 | **140** |
| AUTH pre-queue logic in `handleMessage` | 1007–1014 | 8 |
| `sendChallenge()` public method | 1024–1028 | 5 |
| Cleanup in `destroy()` | 1047–1057 | ~5 |
| Cleanup in `destroyWindow()` | 1106–1108 | 3 |
| **Total AUTH lines** | | **~269** |
| **Total runtime.ts** | | **1119** |
| **AUTH as percentage** | | **~24%** |

Note: GAP-ANALYSIS.md section 2 estimates ~40% by a broader count that includes the `delegatedPubkeys` guard at line 586 and ancillary logic. The functional core — `handleRegister()` + `handleAuth()` alone — is 228 lines (20%).

---

### 2.4 Removal Strategy

AUTH removal must be phased to maintain backward compatibility with legacy napplets using `@napplet/shim` v0.1.x.

**Phase 1 — Add NAP Dispatch Path (does not touch AUTH)**

Add the NAP dispatch branch at the top of `handleMessage()` without removing any existing AUTH code. NIP-5D napplets are routed through the new path; legacy napplets continue through the AUTH handshake. This phase fixes the immediate communication blackout for NIP-5D napplets.

Implementation: dual-mode dispatch as described in Section 1.3.

**Phase 2 — Make AUTH Optional (identity-at-creation for NIP-5D)**

For napplets that have registered via `originRegistry` (NIP-5D path), bypass the `pendingAuthQueue` check. The session is already established at iframe creation time — no AUTH challenge is needed. Legacy napplets (`@napplet/shim` v0.1.x) still complete the AUTH handshake normally.

Implementation: add an `originRegistry.isRegistered(windowId)` check before the pre-AUTH queue logic. Registered (NIP-5D) sessions proceed directly to `dispatchVerb`; unregistered (legacy) sessions use the existing queue.

**Phase 3 — Remove AUTH Entirely (when legacy support ends)**

Once `@napplet/shim` v0.1.x is no longer in use, delete all symbols listed in the removal inventory table in Section 2.2. Delete `key-derivation.ts` entirely. Remove `RuntimeAdapter.shellSecretPersistence` from the interface (breaking change — minor version bump required).

Implementation: straightforward deletion. No migration utilities needed for runtime state (AUTH state is in-memory and does not persist).

**Avoiding PITFALLS.md Pitfall 2:**

PITFALLS.md Pitfall 2 describes the risk of keeping AUTH as a permanent "optional" feature: code paths that check `!isAuthenticated(windowId)` remain active forever, and any napplet that does not complete AUTH has its messages silently queued and never delivered. The phased approach avoids this pitfall by:

- Phase 1: NIP-5D napplets bypass the AUTH queue entirely via the new NAP dispatch branch — they never enter the queue.
- Phase 2: explicitly checking for NIP-5D registration before the queue gate, so the queue is only active for legacy sessions.
- Phase 3: removing the queue entirely when legacy support ends. No silent fallback remains.

The key distinction from the anti-pattern is that Phases 1–2 route NIP-5D traffic around AUTH, rather than making AUTH's outcome irrelevant while leaving the queue infrastructure in place.

---

### 2.5 Security Implications

Under RUNTIME-SPEC v2.0.0 the security boundary was the AUTH handshake: only a napplet that could produce a valid Schnorr signature over a shell-issued challenge was permitted to send messages. The delegated keypair ensured that only a napplet receiving the IDENTITY message (from the correct shell) could authenticate.

NIP-5D replaces this with **source-based identity** via `MessageEvent.source`. The security properties are:

- **`MessageEvent.source` is the unforgeable identity token.** The browser guarantees that `event.source` is the `Window` object of the frame that called `postMessage`. It cannot be spoofed by script running in a different origin.

- **`originRegistry.register()` must be called synchronously at iframe creation.** Before the `<iframe src="...">` attribute is set (before the iframe loads), the shell must call `originRegistry.register(iframeWindow, windowId, { dTag, aggregateHash })`. This establishes the binding before any message can arrive. If registration happens after the iframe loads, there is a race where messages from the iframe arrive before the binding exists.

- **Messages from unregistered sources MUST be silently dropped.** If `originRegistry.getWindowId(event.source)` returns `undefined`, the message is discarded without any error or notification. This is the NIP-5D equivalent of the AUTH rejection path — no response is sent, no route is triggered.

- **Origin strings are irrelevant.** Opaque-origin iframes (sandboxed) always report `event.origin === 'null'`. Do not use `event.origin` as an identity check. `event.source` (the `Window` reference) is the only reliable identity anchor.

See PITFALLS.md security mistakes section for the full list of post-AUTH security failure modes.

---

## 3. Handler Rewrites for Envelope Format (RT-03)

### 3.1 Overview

Four NAP domain handlers replace the current verb/kind dispatch in `runtime.ts`. The old model routed every inbound message through one of six verb cases (`EVENT`, `REQ`, `CLOSE`, `COUNT`, `REGISTER`, `AUTH`) and then sub-dispatched on `event.kind` to detect signer requests (kind 29001), IPC_PEER traffic (kind 29003), and service discovery (kind 29010).

The new model uses the NAP domain prefix (`msg.type.split('.')[0]`) to dispatch to one of four dedicated handlers: `handleRelayMessage`, `handleSignerMessage`, `handleStorageMessage`, and `handleIncMessage`. Each handler owns one NAP domain and processes only the flat JSON envelope objects defined in the NIP-5D `@napplet/nap-*` packages.

This section documents each handler's old code path, new message shapes, capability requirements, and affected source files. The [capability mapping table](#14-capability-resolution-migration) in Section 1.4 serves as the authoritative reference for `resolveCapabilitiesNap()` — the per-handler notes below cross-reference it.

**References:**
- Wire format before/after tables: [GAP-ANALYSIS.md section 1](./GAP-ANALYSIS.md#1-wire-format-change-gap-01)
- Capability resolution pseudocode: [ACL-MIGRATION.md section 2](./ACL-MIGRATION.md#2-capability-constant-to-nap-domain-mapping)
- PITFALLS.md Pitfall 5 (ServiceHandler interface), Pitfall 6 (storage proxy), Pitfall 7 (signer proxy), Pitfall 8 (INC handler mismatch)

---

### 3.2 Relay Handler

#### Old Code Path

Relay operations were split across four verb cases in `dispatchVerb()` (lines 224–232) and then through the `handleEvent`, `handleReq`, `handleClose`, and `handleCount` functions. All use NIP-01 array structures:

- **REQ** (`handleReq`, line 660): extracts `subId = msg[1]`, filters from `msg.slice(2)`, subscribes to relay pool via `hooks.relayPool.subscribe()` or delegates to a registered `relay` service, sends buffered events on subscribe, sends `['EOSE', subId]`.
- **EVENT publish** (`handleEvent`, line 561): extracts `event = msg[1]`, validates pubkey and replay, resolves `relay:write` capability, calls `hooks.relayPool.publish()` (or relay service), responds with `['OK', eventId, true/false, reason]`.
- **CLOSE** (`handleClose`, invoked from verb switch): closes subscription by subKey, calls `pool.untrackSubscription()`, sends `['CLOSED', subId, '']`.
- **COUNT** (`handleCount`): extracts `subId` and filters, delegates to relay service if available, sends `['COUNT', subId, {count}]`.

#### New Message Shapes

**Inbound (napplet → shell):**

| NAP Type | Old Format | New Format |
|----------|-----------|-----------|
| `relay.subscribe` | `["REQ", "sub-1", {"kinds":[1],"limit":10}]` | `{"type":"relay.subscribe","id":"uuid","subId":"uuid","filters":[...]}` |
| `relay.close` | `["CLOSE", "sub-1"]` | `{"type":"relay.close","id":"uuid","subId":"uuid"}` |
| `relay.publish` | `["EVENT", {"kind":1,"content":"hello",...}]` | `{"type":"relay.publish","id":"uuid","event":{...}}` |
| `relay.query` | `["COUNT", "count-1", {"kinds":[1]}]` | `{"type":"relay.query","id":"uuid","filters":[...]}` |

**Outbound (shell → napplet):**

| Response Type | Old Format | New Format |
|--------------|-----------|-----------|
| `relay.event` | `["EVENT", "sub-1", {"kind":1,...}]` | `{"type":"relay.event","subId":"uuid","event":{...}}` |
| `relay.eose` | `["EOSE", "sub-1"]` | `{"type":"relay.eose","subId":"uuid"}` |
| `relay.closed` | `["CLOSED", "sub-1", ""]` | `{"type":"relay.closed","subId":"uuid","message":""}` |
| `relay.publish.result` (accepted) | `["OK", "event-id", true, ""]` | `{"type":"relay.publish.result","id":"uuid","accepted":true}` |
| `relay.publish.result` (rejected) | `["OK", "event-id", false, "blocked: ..."]` | `{"type":"relay.publish.result","id":"uuid","accepted":false,"message":"blocked: ..."}` |
| `relay.query.result` | `["COUNT", "count-1", {"count":42}]` | `{"type":"relay.query.result","id":"uuid","count":42}` |

#### Capability Mapping

| Operation | Required Capability | Notes |
|-----------|-------------------|-------|
| `relay.subscribe` | `relay:read` (sender) | REQ equivalent |
| `relay.close` | `relay:read` (sender) | Napplet closes its own subscription |
| `relay.publish` | `relay:write` (sender) + `relay:read` (recipient) | Recipient must have read to receive |
| `relay.query` | `relay:read` (sender) | COUNT equivalent |

#### Affected Files

| File | Change |
|------|--------|
| `packages/runtime/src/runtime.ts` | Remove `handleReq`, `handleClose`, `handleCount` verb cases; replace EVENT relay path with `relay.publish` in new handler |
| `packages/runtime/src/enforce.ts` | `resolveCapabilitiesNap()` relay domain branch |

---

### 3.3 Signer Handler

#### Old Code Path

Signer requests arrive as `["EVENT", event]` where `event.kind === BusKind.SIGNER_REQUEST` (29001). The detection point is inside `handleEvent()` (lines 561–658):

```typescript
// runtime.ts:601–614
case BusKind.SIGNER_REQUEST: {
  const signerService = serviceRegistry['signer'];
  if (signerService) {
    signerService.handleMessage(
      windowId,
      ['EVENT', event],
      (msg) => hooks.sendToNapplet(windowId, msg),
    );
    return;
  }
  // Fallback: use internal signer handler (requires hooks.auth.getSigner)
  handleSignerRequest(event, windowId, pubkey);
  return;
}
```

The internal `handleSignerRequest()` path reads the `method` tag from `event.tags`, routes to `hooks.auth.getSigner()` methods, and responds with a kind 29002 SIGNER_RESPONSE event delivered as `["EVENT", sub-id, responseEvent]`.

#### New Message Shapes

**Inbound (napplet → shell):**

| NAP Type | Old Format | New Format |
|----------|-----------|-----------|
| `signer.signEvent` | `["EVENT", {"kind":29001,"tags":[["method","signEvent"],["id","uuid"],["param","event","{...}"]],...}]` | `{"type":"signer.signEvent","id":"uuid","event":{...}}` |
| `signer.getPublicKey` | `["EVENT", {"kind":29001,"tags":[["method","getPublicKey"],["id","uuid"]],...}]` | `{"type":"signer.getPublicKey","id":"uuid"}` |
| `signer.getRelays` | `["EVENT", {"kind":29001,"tags":[["method","getRelays"],["id","uuid"]],...}]` | `{"type":"signer.getRelays","id":"uuid"}` |
| `signer.nip04.encrypt` | `["EVENT", {"kind":29001,"tags":[["method","nip04.encrypt"],["params","pubkey","plain"]],...}]` | `{"type":"signer.nip04.encrypt","id":"uuid","pubkey":"...","plaintext":"..."}` |
| `signer.nip04.decrypt` | *(same pattern as nip04.encrypt)* | `{"type":"signer.nip04.decrypt","id":"uuid","pubkey":"...","ciphertext":"..."}` |
| `signer.nip44.encrypt` | *(same pattern)* | `{"type":"signer.nip44.encrypt","id":"uuid","pubkey":"...","plaintext":"..."}` |
| `signer.nip44.decrypt` | *(same pattern)* | `{"type":"signer.nip44.decrypt","id":"uuid","pubkey":"...","ciphertext":"..."}` |

**Outbound (shell → napplet):**

| Response Type | Old Format | New Format |
|--------------|-----------|-----------|
| `signer.signEvent.result` | `["EVENT", "sub-id", {"kind":29002,"tags":[["id","uuid"],["method","signEvent"],["result","{...}"]],...}]` | `{"type":"signer.signEvent.result","id":"uuid","event":{...}}` |
| `signer.getPublicKey.result` | *(kind 29002, method=getPublicKey)* | `{"type":"signer.getPublicKey.result","id":"uuid","pubkey":"..."}` |
| `signer.getRelays.result` | *(kind 29002, method=getRelays)* | `{"type":"signer.getRelays.result","id":"uuid","relays":{...}}` |
| `signer.nip04.encrypt.result` | *(kind 29002, method=nip04.encrypt)* | `{"type":"signer.nip04.encrypt.result","id":"uuid","ciphertext":"..."}` |
| `signer.nip04.decrypt.result` | *(kind 29002)* | `{"type":"signer.nip04.decrypt.result","id":"uuid","plaintext":"..."}` |
| `signer.nip44.encrypt.result` | *(kind 29002)* | `{"type":"signer.nip44.encrypt.result","id":"uuid","ciphertext":"..."}` |
| `signer.nip44.decrypt.result` | *(kind 29002)* | `{"type":"signer.nip44.decrypt.result","id":"uuid","plaintext":"..."}` |

#### Capability Mapping

| Operation | Required Capability | Notes |
|-----------|-------------------|-------|
| `signer.signEvent` | `sign:event` (sender) | — |
| `signer.getPublicKey` | none | Read-only; no ACL check required |
| `signer.getRelays` | none | Read-only; no ACL check required |
| `signer.nip04.encrypt` / `.decrypt` | `sign:nip04` (sender) | — |
| `signer.nip44.encrypt` / `.decrypt` | `sign:nip44` (sender) | — |

#### Affected Files

| File | Change |
|------|--------|
| `packages/runtime/src/runtime.ts` | Remove `BusKind.SIGNER_REQUEST` case from `handleEvent()`; add `handleSignerMessage()` function |
| `packages/runtime/src/service-dispatch.ts` | Update `routeServiceMessage()` to accept NAP envelope (see Pitfall 5) |
| `packages/runtime/src/enforce.ts` | `resolveCapabilitiesNap()` signer domain branch |

**Pitfall 7 reference:** `BusKind.SIGNER_REQUEST` and `BusKind.SIGNER_RESPONSE` remain exported from `@napplet/core/src/legacy.ts` as `@deprecated`. After migration, these constants must not appear in non-legacy runtime dispatch paths. Any signer service handler in `@kehto/services` that operates on `["EVENT", event]` arrays with `kind === 29001` also needs updating (Pitfall 5).

---

### 3.4 Storage Handler

#### Old Code Path

Storage requests arrive as `["EVENT", event]` where `event.kind === BusKind.IPC_PEER` (29003) and the `t` tag begins with `shell:state-`. Detection is in `handleEvent()` at lines 619–623:

```typescript
// runtime.ts:619–623
case BusKind.IPC_PEER: {
  const topic = event.tags?.find((t) => t[0] === 't')?.[1];
  if (topic?.startsWith('shell:state-')) {
    handleStateRequest(windowId, event, hooks.sendToNapplet, sessionRegistry, aclState, hooks.statePersistence);
    return;
  }
```

`handleStateRequest()` in `state-handler.ts` (lines 74–155) reads the `topic` tag to route (`shell:state-get`, `shell:state-set`, `shell:state-remove`, `shell:state-clear`, `shell:state-keys`), reads additional tags for correlation `id`, `key`, and `value`, then calls `statePersistence` methods and responds with a kind 29003 IPC_PEER event with topic `napplet:state-response`.

Key scoping logic (`napplet-state:${dTag}:${aggregateHash}:${key}` prefix) and quota enforcement (`aclState.getStateQuota()`) live in `state-handler.ts` lines 14–33 and 111–116 respectively.

#### New Message Shapes

**Inbound (napplet → shell):**

| NAP Type | Old Format | New Format |
|----------|-----------|-----------|
| `storage.get` | `["EVENT", {"kind":29003,"tags":[["t","shell:state-get"],["id","uuid"],["key","theme"]],...}]` | `{"type":"storage.get","id":"uuid","key":"theme"}` |
| `storage.set` | `["EVENT", {"kind":29003,"tags":[["t","shell:state-set"],["id","uuid"],["key","theme"],["value","dark"]],...}]` | `{"type":"storage.set","id":"uuid","key":"theme","value":"dark"}` |
| `storage.remove` | `["EVENT", {"kind":29003,"tags":[["t","shell:state-remove"],["id","uuid"],["key","theme"]],...}]` | `{"type":"storage.remove","id":"uuid","key":"theme"}` |
| `storage.clear` | `["EVENT", {"kind":29003,"tags":[["t","shell:state-clear"],["id","uuid"]],...}]` | `{"type":"storage.clear","id":"uuid"}` |
| `storage.keys` | `["EVENT", {"kind":29003,"tags":[["t","shell:state-keys"],["id","uuid"]],...}]` | `{"type":"storage.keys","id":"uuid"}` |

**Outbound (shell → napplet):**

| Response Type | Old Format | New Format |
|--------------|-----------|-----------|
| `storage.get.result` | `["EVENT", "__shell__", {"kind":29003,"tags":[["t","napplet:state-response"],["id","uuid"],["value","dark"],["found","true"]],...}]` | `{"type":"storage.get.result","id":"uuid","value":"dark","found":true}` |
| `storage.set.result` | `["EVENT", "__shell__", {"kind":29003,"tags":[["t","napplet:state-response"],["id","uuid"],["ok","true"]],...}]` | `{"type":"storage.set.result","id":"uuid","ok":true}` |
| `storage.remove.result` | *(same as set)* | `{"type":"storage.remove.result","id":"uuid","ok":true}` |
| `storage.clear.result` | *(same)* | `{"type":"storage.clear.result","id":"uuid","ok":true}` |
| `storage.keys.result` | `["EVENT", "__shell__", {"kind":29003,"tags":[["t","napplet:state-response"],["id","uuid"],["key","theme"],["key","lang"]],...}]` | `{"type":"storage.keys.result","id":"uuid","keys":["theme","lang"]}` |

#### Capability Mapping

| Operation | Required Capability | Notes |
|-----------|-------------------|-------|
| `storage.get` | `state:read` (sender) | — |
| `storage.keys` | `state:read` (sender) | — |
| `storage.set` | `state:write` (sender) | — |
| `storage.remove` | `state:write` (sender) | — |
| `storage.clear` | `state:write` (sender) | — |

#### Storage Scoping — UNCHANGED

The key scoping and quota enforcement logic in `state-handler.ts` is transport-agnostic and changes only the message format, not the storage logic itself:

- **Key prefix format:** `napplet-state:${dTag}:${aggregateHash}:${userKey}` — unchanged
- **Legacy key migration:** triple-read (new format → legacy-with-pubkey → old prefix) — unchanged
- **Quota enforcement:** `aclState.getStateQuota()` called on write operations — unchanged

The new `handleStorageMessage()` function accepts the NAP envelope and extracts `id`, `key`, `value` directly from flat object fields rather than from tag arrays, then delegates to the same underlying storage logic.

#### Affected Files

| File | Change |
|------|--------|
| `packages/runtime/src/runtime.ts` | Remove `shell:state-*` topic check from `IPC_PEER` case; add `handleStorageMessage()` function |
| `packages/runtime/src/state-handler.ts` | Full rewrite of `handleStateRequest()` to accept NAP envelope; preserve scoping and quota logic |
| `packages/runtime/src/enforce.ts` | `resolveCapabilitiesNap()` storage domain branch |

**Pitfall 6 reference:** After migration, `state-handler.ts` must not import `BusKind.IPC_PEER`. Topic-tag extraction (`event.tags?.find((t) => t[0] === 't')`) is replaced by direct field access (`msg.key`, `msg.value`). The `shell:state-*` topic namespace becomes dead code.

---

### 3.5 INC Handler

#### Old Code Path

INC (inter-frame communication) used the same kind 29003 IPC_PEER path as storage, but with non-`shell:` topics. After the storage check in `handleEvent()` (lines 619–623), all remaining IPC_PEER events fell through to service dispatch and then to `eventBuffer.bufferAndDeliver()` (lines 647–650):

```typescript
// runtime.ts:647–650
if (topic && routeServiceMessage(windowId, event, topic, serviceRegistry, hooks.sendToNapplet)) {
  return;
}
eventBuffer.bufferAndDeliver(event, windowId);
```

`eventBuffer.bufferAndDeliver()` (in `event-buffer.ts`) added the event to a ring buffer and delivered it to any open NIP-01 subscription that matched the event (kind 29003 with matching `#t` tag filter). There was no explicit subscribe/unsubscribe for INC — any napplet with an open `REQ { kinds: [29003], "#t": ["profile:open"] }` would receive the event.

This means INC had no explicit lifecycle: subscriptions were registered via standard REQ, INC topics were delivered through the same event buffer as relay events, and there was no way to distinguish an INC subscription from a relay subscription at the protocol level.

#### New Message Shapes

**Inbound (napplet → shell):**

| NAP Type | Old Format | New Format |
|----------|-----------|-----------|
| `inc.emit` | `["EVENT", {"kind":29003,"tags":[["t","profile:open"]],"content":"{...}",...}]` | `{"type":"inc.emit","topic":"profile:open","payload":{...}}` |
| `inc.subscribe` | *(no equivalent — implicit via REQ)* | `{"type":"inc.subscribe","id":"uuid","topic":"profile:open"}` |
| `inc.unsubscribe` | *(no equivalent — via CLOSE)* | `{"type":"inc.unsubscribe","id":"uuid","topic":"profile:open"}` |

**Outbound (shell → napplet):**

| Response Type | Old Format | New Format |
|--------------|-----------|-----------|
| `inc.event` | `["EVENT", "sub-id", {"kind":29003,"tags":[["t","profile:open"]],"content":"{...}",...}]` | `{"type":"inc.event","topic":"profile:open","payload":{...},"sender":"windowId"}` |

#### New Subscription Lifecycle

The INC handler introduces explicit topic subscriptions — this is **net new behavior** with no direct equivalent in the old runtime:

1. **`inc.subscribe`** — registers a `(windowId, topic)` binding in a new INC subscription registry (separate from the relay `subscriptions` map). Returns no response (or an optional `inc.subscribe.result`).
2. **`inc.emit`** — looks up all windows subscribed to the given topic (excluding the sender's windowId), delivers `{ type: "inc.event", topic, payload, sender: windowId }` to each subscriber via `hooks.sendToNapplet`.
3. **`inc.unsubscribe`** — removes the `(windowId, topic)` binding.

The old system required napplets to send a standard REQ to receive INC events. Under NIP-5D, napplets call `window.napplet.inc.on(topic, handler)` which internally sends `inc.subscribe`. The runtime no longer needs to match INC events against NIP-01 filter objects.

#### Capability Mapping

| Operation | Required Capability | Notes |
|-----------|-------------------|-------|
| `inc.emit` | `relay:write` (sender) + `relay:read` (recipient) | Reuses relay capability bits per [ACL-MIGRATION.md section 2](./ACL-MIGRATION.md#2-capability-constant-to-nap-domain-mapping) |
| `inc.subscribe` | `relay:read` (sender) | — |
| `inc.unsubscribe` | `relay:read` (sender) | — |

#### Affected Files

| File | Change |
|------|--------|
| `packages/runtime/src/runtime.ts` | Remove `IPC_PEER` kind 29003 fallthrough path; add `handleIncMessage()` with INC subscription registry |
| `packages/runtime/src/event-buffer.ts` | INC delivery is replaced by direct `sendToNapplet` dispatch — `bufferAndDeliver` no longer used for INC topics |
| `packages/runtime/src/service-dispatch.ts` | INC topic routing via `routeServiceMessage()` no longer applies — INC is now a first-class NAP domain, not a service |
| `packages/runtime/src/enforce.ts` | `resolveCapabilitiesNap()` inc domain branch |

**Pitfall 8 reference:** After migration, the old IPC_PEER path (`event.kind === BusKind.IPC_PEER`) must not handle INC topics. The distinction from storage: storage handler still exists (rewritten), but INC routing via `eventBuffer.bufferAndDeliver` is replaced entirely by the new explicit subscription model.

---

### 3.6 Service Discovery Replacement

#### Old Code Path

Service discovery used a REQ with filter `{ kinds: [29010] }`. `handleReq()` detected this via `isDiscoveryReq(filters)` (lines 672–682) and called `handleDiscoveryReq()` from `service-discovery.ts`, which synthesized kind 29010 events with `s`, `v`, `d` tags for each registered service:

```typescript
// runtime.ts:672–682
if (isDiscoveryReq(filters)) {
  const send = (msg: unknown[]): void => hooks.sendToNapplet(windowId, msg);
  const generateId = (): string => ...;
  const sub = handleDiscoveryReq(windowId, subId, serviceRegistry, send, generateId);
  discoverySubscriptions.set(discSubKey, sub);
  subscriptions.set(discSubKey, { windowId, filters });
  return;
}
```

The napplet received synthetic `["EVENT", subId, { kind: 29010, tags: [["s","audio"],["v","1.0.0"]] }]` events, then `["EOSE", subId]`.

#### New Approach

Under NIP-5D, service discovery is **synchronous at initialization time** — not a message round-trip. The `@napplet/shim` exposes:

- `window.napplet.shell.supports(napType)` — checks if the shell supports a given NAP domain (e.g., `relay`, `signer`, `storage`)
- `window.napplet.services.has(serviceName)` — checks if a named service is registered

These APIs are populated by the shell communicating its supported NAPs and services to the shim at iframe creation time (part of the initial `window.napplet` initialization handshake documented in the Phase 4 shell migration). No postMessage round-trip is needed for discovery.

#### Impact

| Item | Change |
|------|--------|
| `packages/runtime/src/service-discovery.ts` | Becomes dead code — no handler for kind 29010 in NIP-5D path |
| `packages/runtime/src/runtime.ts` | Remove `isDiscoveryReq()` check and `discoverySubscriptions` map from `handleReq()` |

The `service-discovery.ts` module can be deleted in Phase 3 of the AUTH/legacy removal strategy (Section 2.4). During dual-mode transition (Phase 1), it must remain for legacy napplets that still send kind 29010 REQs.

---

### 3.7 File Impact Matrix

Summary of all runtime source files and what changes drives each modification:

| File | Change Type | NAP Domain(s) | Notes |
|------|------------|---------------|-------|
| `packages/runtime/src/runtime.ts` | Major rewrite | relay, signer, storage, inc | Add 4 new NAP handlers; remove verb-switch cases; remove `IPC_PEER` kind-dispatch branching |
| `packages/runtime/src/state-handler.ts` | Full rewrite | storage | New function signature accepts NAP envelope; preserves key-scoping and quota logic |
| `packages/runtime/src/enforce.ts` | New function | all | Add `resolveCapabilitiesNap()` alongside existing `resolveCapabilities()` |
| `packages/runtime/src/event-buffer.ts` | Interface change | inc | `bufferAndDeliver()` no longer used for INC delivery; INC uses direct `sendToNapplet` |
| `packages/runtime/src/service-dispatch.ts` | Update | (services) | `routeServiceMessage()` must accept NAP envelope when `ServiceHandler` interface updates (Pitfall 5) |
| `packages/runtime/src/service-discovery.ts` | Remove (Phase 3) | (none) | Dead code after NIP-5D migration; kept during dual-mode transition for legacy napplets |
| `packages/runtime/src/types.ts` | Interface update | all | `ServiceHandler.handleMessage` signature updated; `SendToNapplet` may need widening |

---

## 4. SessionEntry Identity Anchor (RT-04)

### 4.1 Background

Under RUNTIME-SPEC v2.0.0, `SessionEntry.pubkey` was set to the AUTH-derived ephemeral keypair public key after successful handshake (in `handleAuth()`, lines 325–464). This pubkey served three roles:

1. **Session authentication token** — proved the napplet completed a valid AUTH challenge-response
2. **ACL lookup key component** — first segment of the `pubkey:dTag:hash` composite ACL key
3. **Unique session identifier** — different instances of the same napplet received different pubkeys from the shell's `deriveKeypair()` function

NIP-5D v0.1.0 eliminates the AUTH keypair. `SessionEntry.pubkey` has no natural value — there is no IDENTITY message, no challenge, no signing operation. This section documents the design decision for what replaces it.

---

### 4.2 Current SessionEntry Schema

The current type definition in `packages/runtime/src/types.ts` (lines 396–406):

```typescript
// packages/runtime/src/types.ts:390–406
export interface SessionEntry {
  pubkey: string;        // AUTH keypair public key — NEEDS REPLACEMENT
  windowId: string;      // iframe window reference — UNCHANGED (gains importance)
  origin: string;        // MessageEvent.origin — UNCHANGED
  type: string;          // session type discriminant — REVIEW
  dTag: string;          // napplet app identifier — UNCHANGED
  aggregateHash: string; // build/version hash — UNCHANGED
  registeredAt: number;  // timestamp — UNCHANGED
  instanceId: string;    // persistent iframe GUID — UNCHANGED
}
```

Current usage of `SessionEntry.pubkey`:

- `sessionRegistry.register(windowId, entry)` stores `byWindowId.set(windowId, entry.pubkey)` and `byPubkey.set(entry.pubkey, entry)` (session-registry.ts lines 73–76) — the registry is currently keyed by pubkey
- `sessionRegistry.getPubkey(windowId)` returns the pubkey; this is the gate check in `handleMessage()` at line 1010: `if (!sessionRegistry.getPubkey(windowId)) { ... queue ... }`
- `handleEvent()` reads pubkey at line 570 for ACL enforcement
- `handleStateRequest()` calls `sessionRegistry.getPubkey(windowId)` at line 86 and errors with `'auth-required: not registered'` if undefined
- ACL composite key in `enforce.ts`: `checkAcl(pubkey, dTag, aggregateHash, capability)` uses pubkey as first argument

---

### 4.3 Design Options

Three candidate replacements for `SessionEntry.pubkey`:

**Option A: windowId as pubkey**

Set `pubkey` to the `windowId` string. This is the simplest change and preserves the "unique per session" property. The ACL composite key would conceptually be `windowId:dTag:hash`.

- **Pro:** One-line change in session creation; `getPubkey()` still returns a non-empty value; `if (!getPubkey())` gate still works
- **Pro:** Unique per session (different windows = different windowIds)
- **Con:** `windowId` is runtime-ephemeral — it changes every page load or iframe recreation. Persisted ACL entries keyed on `windowId:dTag:hash` would silently fail to match on next load (same problem as the pubkey-based key, just with a different ephemeral value)
- **Con:** Conceptually wrong — windowId is a frame reference, not an identity token

**Option B: Empty string**

Set `pubkey` to `''` (empty string). ACL lookup uses `dTag:hash` per [ACL-MIGRATION.md section 1](./ACL-MIGRATION.md#1-identity-key-schema-change) — pubkey is already ignored in `toKey()` after the ACL migration. The empty string signals "NIP-5D session with no keypair identity".

- **Pro:** Aligns cleanly with ACL-MIGRATION.md — `Identity.pubkey` is deprecated and optional, `toKey()` produces `dTag:hash` regardless
- **Pro:** Backward compatible at the field level — existing code that reads `session.pubkey` gets an empty string and can branch on it
- **Pro:** Allows gradual removal — the `pubkey` field can be deleted in a future cleanup once legacy support ends
- **Con:** `if (!session.pubkey)` evaluates to `false` for NIP-5D sessions, which may break guards that used pubkey as an authentication signal — these guards need to be identified and updated

**Option C: Remove pubkey field entirely**

Delete `SessionEntry.pubkey`. This is the cleanest option architecturally.

- **Pro:** Forces all consumers to update and removes the misleading field
- **Pro:** Eliminates the conceptual confusion about what pubkey means in a NIP-5D session
- **Con:** Largest code surface change — every call site that reads or writes `session.pubkey` must be updated
- **Con:** Incompatible with the dual-mode transition — legacy AUTH napplets still set pubkey to the derived keypair. Removing the field breaks legacy mode entirely.
- **Con:** Requires updating `SessionRegistry` internals (currently `byPubkey` map) and the `getEntry(pubkey)` / `getWindowId(pubkey)` methods

---

### 4.4 Chosen Design: Option B (empty string) with identitySource discriminant

**Rationale:**

Option B is selected for the following reasons:

1. **Aligns with ACL-MIGRATION.md** — `Identity.pubkey` is already declared optional and deprecated in the ACL package. The `toKey()` function ignores it; the composite key is `dTag:hash`. A `pubkey = ''` in SessionEntry propagates correctly through `checkAcl(pubkey, dTag, aggregateHash, cap)` — the ACL module produces `dTag:hash` composite key regardless.

2. **Preserves backward compatibility** — Legacy AUTH napplets can still set `pubkey` to the derived keypair pubkey. The `sessionRegistry.byPubkey` map continues to work for legacy lookups. Dual-mode dispatch (Section 1.3) requires legacy sessions to remain functional.

3. **Allows phased removal** — The `pubkey` field can be marked `@deprecated` in this migration and removed in a future cleanup pass once `@napplet/shim` v0.1.x legacy support is dropped (Phase 3 of AUTH removal, Section 2.4).

4. **Adds `identitySource` discriminant** — Rather than relying on `pubkey === ''` as a signal, a dedicated `identitySource` field explicitly distinguishes session types. This avoids the "guard breaks on empty string" concern in Option B's downside.

The added `identitySource` field replaces the `authenticated` boolean that was implicit in the old model (a session was "authenticated" if `getPubkey()` returned a non-empty value):

- `identitySource: 'auth'` — legacy session; AUTH handshake completed; `pubkey` is the derived keypair pubkey
- `identitySource: 'source'` — NIP-5D session; identity established at iframe creation via `originRegistry`; `pubkey` is `''`

---

### 4.5 New SessionEntry Schema

Target TypeScript type (post-migration):

```typescript
export interface SessionEntry {
  /**
   * @deprecated NIP-5D: AUTH keypair no longer exists. Empty string for NIP-5D sessions.
   * Kept for backward compatibility during legacy (@napplet/shim v0.1.x) support period.
   * Will be removed in a future cleanup pass once AUTH removal Phase 3 completes.
   */
  pubkey: string;
  /** iframe window reference — primary session identity under NIP-5D */
  windowId: string;
  /** MessageEvent.origin (opaque 'null' for sandboxed iframes — use windowId, not origin) */
  origin: string;
  /** Session type discriminant (preserved from existing schema) */
  type: string;
  /** Napplet application identifier from NIP-5A manifest */
  dTag: string;
  /** Build/version hash from NIP-5A manifest */
  aggregateHash: string;
  /** Unix timestamp when session was registered */
  registeredAt: number;
  /** Persistent GUID for this iframe instance, assigned by the runtime */
  instanceId: string;
  /**
   * How session identity was established.
   * 'source' = NIP-5D (identity at iframe creation via originRegistry).
   * 'auth' = legacy AUTH handshake (pubkey is the derived keypair pubkey).
   */
  identitySource: 'auth' | 'source';
}
```

**Gate check migration:**

The `handleMessage()` gate at line 1010 currently uses `!sessionRegistry.getPubkey(windowId)` to detect unauthenticated sessions. After migration, the NAP dispatch path bypasses this gate entirely (dual-mode dispatch checks NAP envelope format first, before the gate). The gate remains in the legacy array path only. Internally, `getPubkey()` still returns `''` for NIP-5D sessions, so the gate correctly routes legacy sessions to the `pendingAuthQueue` — NIP-5D sessions never reach it.

For code that previously checked `if (session.pubkey)` as an authentication signal, the equivalent post-migration check is:

```typescript
// Before: implicit auth signal via non-empty pubkey
if (!session.pubkey) return sendError('auth-required');

// After: explicit identity source check
if (session.identitySource === 'auth' && !session.pubkey) return sendError('auth-required');
// For NIP-5D sessions: identitySource === 'source' always passes
```

---

### 4.6 Session Creation Flow

#### NIP-5D Path (new)

1. Shell loads napplet via NIP-5A manifest — `dTag` and `aggregateHash` are known before iframe creation
2. Shell calls `originRegistry.register(iframe.contentWindow, windowId, { dTag, aggregateHash })` **synchronously before the `<iframe src="...">` attribute is set** (see Section 2.5 security note)
3. Shell (or runtime via a new hook) creates `SessionEntry` with:
   ```typescript
   { pubkey: '', dTag, aggregateHash, windowId, origin: '', type: 'nip5d',
     registeredAt: Date.now(), instanceId: ..., identitySource: 'source' }
   ```
4. Runtime calls `sessionRegistry.register(windowId, entry)` immediately
5. First message from napplet arrives — NAP dispatch path in `handleMessage()` routes it to the appropriate domain handler without touching `pendingAuthQueue`

#### Legacy AUTH Path (preserved)

1. Shell creates iframe — `windowId` registered but no session yet
2. Napplet sends `["REGISTER", { dTag, claimedHash }]`
3. `handleRegister()` derives keypair via `deriveKeypair(shellSecret, dTag, aggregateHash)`, sends `["IDENTITY", { pubkey, privkey, ... }]`, calls `sendChallenge()`
4. Napplet signs kind 22242 AUTH event with derived privkey, sends `["AUTH", authEvent]`
5. `handleAuth()` verifies signature, creates `SessionEntry` with:
   ```typescript
   { pubkey: derivedPubkeyHex, dTag, aggregateHash, windowId, ..., identitySource: 'auth' }
   ```
6. `sessionRegistry.register(windowId, entry)` — `getPubkey(windowId)` now returns non-empty pubkey
7. `pendingAuthQueue` drained — queued messages dispatched

---

### 4.7 Downstream Package Impact

| Package | Impact | Notes |
|---------|--------|-------|
| `@kehto/acl` | Already aligned | `Identity.pubkey` is optional and deprecated; `toKey()` produces `dTag:hash`; no code changes needed in the ACL package itself |
| `@kehto/shell` | Session creation updated | `shell-bridge.ts` session creation path must pass `identitySource: 'source'` when registering NIP-5D napplets; `sendChallenge()` removal (Section 2.2) is independent of identity anchor change |
| `@kehto/services` | Guard update | Any service handler that calls `sessionRegistry.getPubkey(windowId)` and errors on empty string must check `identitySource` instead; service handlers receiving NAP envelopes do not use pubkey for routing |
| `@kehto/runtime` (internal) | `state-handler.ts` | Line 86 `if (!pubkey)` guard must be updated — for NIP-5D sessions `pubkey === ''` but `identitySource === 'source'`; storage should proceed for both session types |
