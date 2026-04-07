# Runtime Migration: @kehto/runtime — RUNTIME-SPEC v2.0.0 to NIP-5D v0.1.0

**Date:** 2026-04-07
**Package:** @kehto/runtime
**Scope:** NUB dispatch design, AUTH removal scope, handler rewrites, session identity anchor
**References:** [GAP-ANALYSIS.md section 5.2](./GAP-ANALYSIS.md#52-kehtooruntime-boundary-contract), [ACL-MIGRATION.md section 2](./ACL-MIGRATION.md#2-capability-constant-to-nub-domain-mapping)

---

## 1. NUB Dispatch Design (RT-01)

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
| Verbs handled | `REGISTER`, `AUTH`, `EVENT`, `REQ`, `CLOSE`, `COUNT` | `relay`, `signer`, `storage`, `ifc` |
| Identity gate | Pre-AUTH queue (`pendingAuthQueue`) blocks all messages until AUTH completes | No gate — identity is registered at iframe creation via `originRegistry` |
| Capability resolution | `resolveCapabilities(msg: unknown[])` — switches on `msg[0]` verb + `BusKind` event kind | `resolveCapabilitiesNub(msg: NappletMessage)` — splits `msg.type` on `.` |

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
    case 'ifc':     return handleIfcMessage(windowId, msg as NappletMessage);
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
  // NIP-5D envelope path — NUB dispatch
  if (typeof msg === 'object' && msg !== null && !Array.isArray(msg) && 'type' in msg) {
    const domain = (msg as NappletMessage).type.split('.')[0];
    switch (domain) {
      case 'relay':   return handleRelayMessage(windowId, msg as NappletMessage);
      case 'signer':  return handleSignerMessage(windowId, msg as NappletMessage);
      case 'storage': return handleStorageMessage(windowId, msg as NappletMessage);
      case 'ifc':     return handleIfcMessage(windowId, msg as NappletMessage);
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

- Dual-mode is **only for the transition period**. The end state is NUB-only dispatch. ARCHITECTURE.md Anti-Pattern 1 identifies keeping dual-mode indefinitely as a correctness risk because it requires every handler to handle two formats.
- Per STACK.md "What NOT to Do": removing NIP-01 array handling entirely in a single step breaks napplets still on `@napplet/shim` v0.1.x. Dual-mode is the correct bridge approach, with a planned deprecation timeline.
- The NIP-5D path MUST be checked first. This ensures the old array guard (`Array.isArray(msg)`) does not drop NUB envelope objects before they reach the new handler.
- NUB path messages bypass the `pendingAuthQueue` — there is no AUTH gate for NIP-5D napplets. Identity is already registered via `originRegistry.register()` before the first message arrives.

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

After migration this function is replaced by `resolveCapabilitiesNub()`, which maps the NUB `type` string to capabilities. The pseudocode is defined in [ACL-MIGRATION.md section 2](./ACL-MIGRATION.md#2-capability-constant-to-nub-domain-mapping):

```typescript
function resolveCapabilitiesNub(msg: NappletMessage): CapabilityResolution {
  const [domain, action] = msg.type.split('.');
  switch (domain) {
    case 'relay':
      return action === 'publish'
        ? { senderCap: 'relay:write', recipientCap: 'relay:read' }
        : { senderCap: 'relay:read', recipientCap: null };
    case 'signer':
      if (action?.startsWith('nip04')) return { senderCap: 'sign:nip04', recipientCap: null };
      if (action?.startsWith('nip44')) return { senderCap: 'sign:nip44', recipientCap: null };
      return { senderCap: 'sign:event', recipientCap: null };
    case 'storage':
      return (action === 'get' || action === 'keys')
        ? { senderCap: 'state:read', recipientCap: null }
        : { senderCap: 'state:write', recipientCap: null };
    case 'ifc':
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

| NUB `msg.type` string | Required Capability | Sender/Recipient | Notes |
|----------------------|---------------------|------------------|-------|
| `relay.subscribe` | `relay:read` | sender | REQ equivalent |
| `relay.close` | `relay:read` | sender | CLOSE equivalent (no ACL check currently) |
| `relay.query` | `relay:read` | sender | COUNT equivalent |
| `relay.publish` | `relay:write` + `relay:read` | sender + recipient | EVENT publish; recipient must have read to receive |
| `signer.signEvent` | `sign:event` | sender | kind 29001 method=signEvent equivalent |
| `signer.getPublicKey` | `sign:event` | sender | kind 29001 method=getPublicKey equivalent |
| `signer.getRelays` | `sign:event` | sender | kind 29001 method=getRelays equivalent |
| `signer.nip04.encrypt` | `sign:nip04` | sender | kind 29001 method=nip04.encrypt equivalent |
| `signer.nip04.decrypt` | `sign:nip04` | sender | kind 29001 method=nip04.decrypt equivalent |
| `signer.nip44.encrypt` | `sign:nip44` | sender | kind 29001 method=nip44.encrypt equivalent |
| `signer.nip44.decrypt` | `sign:nip44` | sender | kind 29001 method=nip44.decrypt equivalent |
| `storage.get` | `state:read` | sender | kind 29003 topic=shell:state-get equivalent |
| `storage.keys` | `state:read` | sender | kind 29003 topic=shell:state-keys equivalent |
| `storage.set` | `state:write` | sender | kind 29003 topic=shell:state-set equivalent |
| `storage.remove` | `state:write` | sender | kind 29003 topic=shell:state-remove equivalent |
| `storage.clear` | `state:write` | sender | kind 29003 topic=shell:state-clear equivalent |
| `ifc.emit` | `relay:write` + `relay:read` | sender + recipient | IPC_PEER emit; recipient needs relay:read |
| `ifc.subscribe` | `relay:read` | sender | ifc subscription registration |
| `ifc.unsubscribe` | `relay:read` | sender | no capability check needed; included for completeness |
| `theme.*` | none | — | Read-only shell state, no user data |

---

### 1.5 Affected Files

The dispatch migration touches these files:

| File | Change | Lines Affected |
|------|--------|----------------|
| `packages/runtime/src/runtime.ts` | Replace `handleMessage()` array guard + verb switch with dual-mode or NUB dispatch | 1004–1017, 224–232 |
| `packages/runtime/src/enforce.ts` | Replace `resolveCapabilities(msg: unknown[])` with `resolveCapabilitiesNub(msg: NappletMessage)` | 42–103 |
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

**Phase 1 — Add NUB Dispatch Path (does not touch AUTH)**

Add the NUB dispatch branch at the top of `handleMessage()` without removing any existing AUTH code. NIP-5D napplets are routed through the new path; legacy napplets continue through the AUTH handshake. This phase fixes the immediate communication blackout for NIP-5D napplets.

Implementation: dual-mode dispatch as described in Section 1.3.

**Phase 2 — Make AUTH Optional (identity-at-creation for NIP-5D)**

For napplets that have registered via `originRegistry` (NIP-5D path), bypass the `pendingAuthQueue` check. The session is already established at iframe creation time — no AUTH challenge is needed. Legacy napplets (`@napplet/shim` v0.1.x) still complete the AUTH handshake normally.

Implementation: add an `originRegistry.isRegistered(windowId)` check before the pre-AUTH queue logic. Registered (NIP-5D) sessions proceed directly to `dispatchVerb`; unregistered (legacy) sessions use the existing queue.

**Phase 3 — Remove AUTH Entirely (when legacy support ends)**

Once `@napplet/shim` v0.1.x is no longer in use, delete all symbols listed in the removal inventory table in Section 2.2. Delete `key-derivation.ts` entirely. Remove `RuntimeAdapter.shellSecretPersistence` from the interface (breaking change — minor version bump required).

Implementation: straightforward deletion. No migration utilities needed for runtime state (AUTH state is in-memory and does not persist).

**Avoiding PITFALLS.md Pitfall 2:**

PITFALLS.md Pitfall 2 describes the risk of keeping AUTH as a permanent "optional" feature: code paths that check `!isAuthenticated(windowId)` remain active forever, and any napplet that does not complete AUTH has its messages silently queued and never delivered. The phased approach avoids this pitfall by:

- Phase 1: NIP-5D napplets bypass the AUTH queue entirely via the new NUB dispatch branch — they never enter the queue.
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

## 3. Handler Rewrites for Envelope Format

*(Documented in Plan 02)*

---

## 4. SessionEntry Identity Anchor

*(Documented in Plan 02)*
