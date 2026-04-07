# Shell Migration: @kehto/shell — RUNTIME-SPEC v2.0.0 to NIP-5D v0.1.0

**Date:** 2026-04-07
**Package:** @kehto/shell
**Scope:** Envelope guard update, window.nostr injection, capability advertisement
**References:** [GAP-ANALYSIS.md sections 4 and 5.3](./GAP-ANALYSIS.md), [RUNTIME-MIGRATION.md sections 1.3 and 4](./RUNTIME-MIGRATION.md)

---

## 1. Envelope Guard Update (SH-01)

### 1.1 Background

`ShellBridge` is the browser adapter that receives raw `MessageEvent`s from `window.addEventListener('message', ...)`, maps `event.source` to a `windowId` via `originRegistry`, and passes the message to `runtime.handleMessage()`. The shell is the **first** code to see any inbound napplet message; the runtime never receives messages that the shell drops.

The critical gate is at `shell-bridge.ts` line 155:

```typescript
if (!Array.isArray(msg) || msg.length < 2) return;
```

This is GAP-ANALYSIS.md Failure Point 1 (the most critical of the six). It silently drops **100% of NIP-5D envelope traffic** — any message that is not a NIP-01 array of two or more elements is discarded before reaching the runtime. The runtime's own guard at `runtime.ts:1005` (Failure Point 2) is a secondary drop point that becomes reachable only after the shell guard is fixed. Fixing the runtime dispatch alone does nothing — if the shell discards all envelopes, the runtime never sees them.

`ShellBridge.handleMessage` is therefore **the first code that must change** in the shell migration.

---

### 1.2 Old Guard vs New Guard

**Side-by-side comparison:**

| Aspect | Old (RUNTIME-SPEC v2.0.0) | New (NIP-5D v0.1.0) |
|--------|--------------------------|---------------------|
| Guard condition | `!Array.isArray(msg) \|\| msg.length < 2` | Envelope-first: object with `.type` string passes first |
| Accepted message shape | NIP-01 arrays only: `["VERB", ...]` | NIP-5D envelopes: `{ type: "relay.subscribe", ... }` AND legacy NIP-01 arrays |
| Drop behavior | Drops all non-arrays (including all NIP-5D envelopes) | Drops anything that is neither a typed object nor a 2+ element array |
| Code location | `shell-bridge.ts` line 155 | `shell-bridge.ts` lines 154–166 (updated) |

**Old guard (line 155):**

```typescript
// RUNTIME-SPEC v2.0.0 — drops ALL NIP-5D envelope objects
const msg = event.data;
if (!Array.isArray(msg) || msg.length < 2) return;
runtime.handleMessage(windowId, msg);
```

**New guard (NIP-5D v0.1.0):**

```typescript
// NIP-5D v0.1.0 — envelope-first, legacy array fallback
const msg = event.data;

// NIP-5D envelope objects (primary path)
if (typeof msg === 'object' && msg !== null && typeof msg.type === 'string') {
  runtime.handleMessage(windowId, msg);
  return;
}

// Legacy NIP-01 arrays (backward compat)
if (Array.isArray(msg) && msg.length >= 2) {
  runtime.handleMessage(windowId, msg);
  return;
}

// All else: silently drop (per NIP-5D spec)
```

**Why envelope check comes first:** NIP-5D napplets using `@napplet/shim` v0.2.0+ are the primary target; legacy napplets using `@napplet/shim` v0.1.x are the backward-compat fallback. Placing the envelope check first also prevents an array-of-objects (e.g., `[{ type: "relay.subscribe" }]`) from being accidentally treated as a NIP-01 message with verb `undefined`.

---

### 1.3 sendToNapplet Signature Change

The outbound path from the shell to the napplet also needs a type signature update:

**Current (`hooks-adapter.ts` line 94):**

```typescript
const sendToNapplet: SendToNapplet = (windowId: string, msg: unknown[]): void => {
  const win = originRegistry.getIframeWindow(windowId);
  if (win) win.postMessage(msg, '*');
};
```

**Target:**

```typescript
const sendToNapplet: SendToNapplet = (windowId: string, msg: NappletMessage | unknown[]): void => {
  const win = originRegistry.getIframeWindow(windowId);
  if (win) win.postMessage(msg, '*');
};
```

The implementation (`win.postMessage(msg, '*')`) does **not change** — `postMessage` accepts any structured-cloneable value, whether an array or a plain object. The signature change is for TypeScript type safety only: it ensures callers cannot accidentally pass a non-NIP-5D envelope to a shell that now needs to forward NIP-5D envelope objects.

This mirrors the `RuntimeAdapter.sendToNapplet` type update in RUNTIME-MIGRATION.md section 4.7:

```typescript
// packages/runtime/src/types.ts (post-migration)
type SendToNapplet = (windowId: string, msg: NappletMessage | unknown[]) => void;
```

Both the shell's local `sendToNapplet` binding and the `RuntimeAdapter.sendToNapplet` type must be widened together to keep the call chain type-safe end-to-end.

---

### 1.4 ShellBridge Interface Changes

The `ShellBridge` public interface (defined at `shell-bridge.ts` lines 40–110) changes as follows:

| Method | Change | Reason |
|--------|--------|--------|
| `handleMessage(event)` | Guard updated (see 1.2) | Drops NIP-5D envelopes under old guard |
| `sendChallenge(windowId)` | **REMOVE** | AUTH handshake eliminated — see RUNTIME-MIGRATION.md section 2 |
| `injectEvent(topic, payload)` | **REVIEW** | Legacy behavior: emits `IPC_PEER` kind event via `runtime.injectEvent()`. Under NIP-5D, shell-originated events should use `ifc.event` envelope format. Document both and flag for update |
| `registerConsentHandler(handler)` | **UNCHANGED** | Consent gating for destructive signing kinds (0, 3, 5, 10002) remains in NIP-5D |
| `destroy()` | **UNCHANGED** | Teardown semantics are protocol-agnostic |
| `readonly runtime` | **UNCHANGED** | Runtime instance access unchanged |

**`sendChallenge` removal:**

Under RUNTIME-SPEC v2.0.0, `sendChallenge(windowId)` sent the NIP-42 AUTH challenge that initiated the keypair handshake. NIP-5D eliminates AUTH entirely — identity is established at iframe creation time from the NIP-5A manifest. Remove the method from the interface and from the `createShellBridge` return value. Callers that invoke `bridge.sendChallenge()` in host application code must be updated to use the NIP-5D session creation flow (see Section 1.6).

**`injectEvent` review:**

Current behavior: `runtime.injectEvent(topic, payload)` emits an `IPC_PEER` kind event (`BusKind.IPC_PEER` = kind 29003) with a `t` tag set to `topic`. Under the old wire format, napplets received this as `["EVENT", "__shell__", { kind: 29003, tags: [["t", topic]], ... }]`.

Target behavior: Under NIP-5D, shell-originated broadcast events should be emitted as `ifc.event` envelopes: `{ type: "ifc.event", topic: topic, payload: payload, sender: "__shell__" }`. The `injectEvent` method signature is unchanged but the runtime's internal implementation of `injectEvent` should emit the new envelope format for NIP-5D sessions. A dual-mode implementation (legacy for authenticated sessions, NIP-5D envelope for source-identity sessions) is needed during the transition period.

---

### 1.5 originRegistry Enhancement

The `originRegistry` (`origin-registry.ts`) currently maps `Window → windowId` with no identity metadata:

```typescript
// Current register() signature (origin-registry.ts line 29)
register(win: Window, windowId: string): void;
```

Under NIP-5D, the shell assigns identity at iframe creation — before any message is sent. To enable source-based identity resolution without querying `sessionRegistry`, `originRegistry` should store identity metadata alongside the `Window` mapping:

**Target `register()` signature:**

```typescript
register(win: Window, windowId: string, identity?: { dTag: string; aggregateHash: string }): void;
```

This enables: when a message arrives and the shell resolves `windowId` from `event.source`, the shell can also retrieve the napplet's `dTag` and `aggregateHash` directly from the origin registry — without an additional lookup against `sessionRegistry`.

**Why the originRegistry rather than only sessionRegistry:**

`originRegistry` is the earliest lookup point — it runs before the runtime sees the message, at the point where `event.source` is mapped to `windowId`. If identity metadata lives here, it is available at the same time and from the same map lookup. `sessionRegistry` is the runtime's concern; the shell's adapter layer should be able to resolve identity without reaching into the runtime's internal registry.

**Current registry internal state (no identity):**

```typescript
// origin-registry.ts — current
const registry = new Map<Window, string>();   // Window -> windowId only
```

**Target registry internal state:**

```typescript
// origin-registry.ts — post-migration
interface OriginEntry {
  windowId: string;
  dTag?: string;
  aggregateHash?: string;
}
const registry = new Map<Window, OriginEntry>();
```

**Session creation alignment:** RUNTIME-MIGRATION.md section 4.6 step 2 documents the NIP-5D session creation flow: "Shell calls `originRegistry.register(iframe.contentWindow, windowId, { dTag, aggregateHash })` synchronously before the `<iframe src="...">` attribute is set." The enhanced `register()` signature is the shell-side implementation of that requirement.

---

### 1.6 hooks-adapter.ts Changes

| Change | File | Details |
|--------|------|---------|
| `sendToNapplet` signature widening | `hooks-adapter.ts` line 94 | `unknown[]` → `NappletMessage \| unknown[]` (see 1.3) |
| `ShellSecretPersistence` deprecation | `hooks-adapter.ts` lines 326–339 | Stores shell HMAC secret used by `deriveKeypair()` for AUTH. Retained during transition per RUNTIME-MIGRATION.md section 2.4 (Phase 3 AUTH removal). Mark `@deprecated` but do not remove yet. |
| `GuidPersistence` deprecation | `hooks-adapter.ts` lines 343–359 | Stores per-window GUIDs for legacy session persistence. Also retained during transition. Mark `@deprecated`. |
| NIP-5D identity hook | `hooks-adapter.ts` — new hook | The host application must provide `dTag` and `aggregateHash` when creating an iframe for a NIP-5D napplet. The `ShellAdapter` gains an optional hook for this: `onNip5dIframeCreate?: (windowId: string) => { dTag: string; aggregateHash: string } \| null`. This allows the adapter to call `originRegistry.register(win, windowId, identity)` with the correct identity metadata. |

---

### 1.7 types.ts Changes

| Type | Change | Details |
|------|--------|---------|
| `SessionEntry` | Add `identitySource` field | `identitySource: 'auth' \| 'source'` discriminant distinguishes NIP-5D sessions (`'source'`) from legacy AUTH sessions (`'auth'`). See RUNTIME-MIGRATION.md section 4.4 for rationale. The shell-side `SessionEntry` in `types.ts` should mirror the runtime's `SessionEntry` type update. |
| `AclCheckEvent.message` | Widen `message` type | Currently `message?: unknown[]`. Widen to `message?: NappletMessage \| unknown[]` to support NIP-5D envelope objects in ACL audit events. |
| `ShellAdapter` | New optional NIP-5D hook | `onNip5dIframeCreate?: (windowId: string) => { dTag: string; aggregateHash: string } \| null` — called at iframe creation to provide identity metadata for `originRegistry.register()`. |

---

### 1.8 Affected Files

| File | Change | Impact |
|------|--------|--------|
| `packages/shell/src/shell-bridge.ts` | Envelope-first guard (1.2), `sendChallenge` removal (1.4), `injectEvent` dual-mode (1.4) | **CRITICAL** — blocks all NIP-5D traffic until fixed |
| `packages/shell/src/hooks-adapter.ts` | `sendToNapplet` signature widening (1.3), `ShellSecretPersistence`/`GuidPersistence` deprecation (1.6), NIP-5D identity hook (1.6) | **HIGH** — type safety and session creation |
| `packages/shell/src/types.ts` | `SessionEntry.identitySource` (1.7), `AclCheckEvent.message` widening (1.7), `ShellAdapter` NIP-5D hook (1.7) | **HIGH** — type definitions for consumers |
| `packages/shell/src/origin-registry.ts` | Enhanced `register()` with identity metadata (1.5) | **MEDIUM** — enables source-based identity at entry point |
| `packages/shell/src/index.ts` | Re-exports: `NappletMessage` type from `@napplet/core` if not already exported; `ShellCapabilities` type (see Section 3) | **LOW** — export surface update |

---

## 2. window.nostr Injection (SH-02)

*See Task 2 — placeholder for Section 2.*

---

## 3. Capability Advertisement Design (SH-03)

### 3.1 Background

NIP-5D specifies two synchronous capability query APIs in the "Runtime Capability Query" section:

```javascript
window.napplet.shell.supports('relay')     // NUB capability — boolean
window.napplet.shell.supports('popups')    // sandbox permission — boolean
window.napplet.services.has('audio')       // service handler registered — boolean
```

Both are synchronous (no postMessage round-trip) and both must be available before any napplet code runs.

The current `@napplet/shim` stubs `shell.supports()` to always return `false`:

```typescript
// napplet/packages/shim/src/index.ts lines 350-355
shell: {
  supports(_capability: string): boolean {
    // TODO: Shell populates supported capabilities at iframe creation
    return false;
  },
},
```

The comment acknowledges that shell population is the missing piece — the shim has no postMessage round-trip for capability queries (unlike relay, signer, and storage which use NUB envelope messages). This section documents the shell-side design that makes `shell.supports()` functional.

---

### 3.2 Current State

The current situation for capability advertisement:

| Component | Current State | Problem |
|-----------|--------------|---------|
| `window.napplet.shell.supports()` | Always returns `false` | Napplets cannot detect what NUBs the shell implements |
| `window.napplet.services.has()` | Triggers kind 29010 service discovery round-trip | Asynchronous; incompatible with synchronous NIP-5D query model |
| Shell capability set | Not defined anywhere | No authoritative source for what the shell supports |
| Sandbox permissions | Not queried | Shell does not inspect the iframe's `sandbox` attribute |

The shim comment ("TODO: Shell populates supported capabilities at iframe creation") identifies the correct direction: the capability set is injected at iframe creation time, not queried dynamically. The mechanism for that injection is what this section defines.

---

### 3.3 Design: Shell-Populated Capability Set

**At iframe creation, the shell knows statically:**

1. Which NUB handlers are registered with the runtime (e.g., relay, signer, storage, ifc). This is the set of service handlers and built-in domain handlers wired into `createRuntime()` / the `ShellAdapter`.
2. Which sandbox permissions the iframe has — derived from the iframe element's `sandbox` attribute tokens (e.g., `"allow-scripts allow-popups"` → `['popups']`).

This information is available synchronously before the iframe loads any code, making it suitable for injection at creation time.

**Capability set data shape:**

```typescript
interface ShellCapabilities {
  nubs: string[];      // e.g., ['relay', 'signer', 'storage', 'ifc']
  sandbox: string[];   // e.g., ['popups', 'modals'] — derived from sandbox attribute tokens
}
```

`nubs` lists the NUB domain prefixes that the shell's runtime handles. `sandbox` lists the sandbox permissions granted to the iframe (each `allow-*` token with the `allow-` prefix stripped: `allow-popups` → `'popups'`).

**`shell.supports()` implementation (post-migration):**

```typescript
// Injected into the iframe's window context at creation time
const capabilities: ShellCapabilities = /* injected by shell */;

window.napplet.shell.supports = (name: string): boolean => {
  return capabilities.nubs.includes(name) || capabilities.sandbox.includes(name);
};
```

This check is synchronous and O(n) on the capability list size (typically 4–8 entries).

**NUB name mapping:**

| NUB Domain Prefix | Registered when... |
|-------------------|-------------------|
| `'relay'` | `relayPool` hooks provided and relay subscription handler active |
| `'signer'` | `auth.getSigner()` returns non-null |
| `'storage'` | `statePersistence` hooks provided |
| `'ifc'` | IFC handler registered (default: always present) |
| `'theme'` | Theme NUB handler registered (optional extension) |

---

### 3.4 Interaction with NIP-5A Manifest requires Tags

NIP-5A manifests declare what a napplet needs via `requires` tags:

```json
["requires", "relay"],
["requires", "signer"],
["requires", "storage"]
```

**At napplet load time (manifest check):**

The shell reads the manifest `requires` tags before creating the iframe. For each required NUB, the shell checks its own capability set. If a required NUB is absent (`shell.supports(nub) === false`), the shell SHOULD reject the load or display a warning: "Napplet requires `signer` but this shell does not provide it."

This is a pre-flight check — it prevents loading a napplet that will silently fail because a required NUB is missing.

**At napplet runtime (dynamic query):**

After loading, `shell.supports()` lets the napplet query optional capabilities:

```javascript
if (window.napplet.shell.supports('theme')) {
  // Use theme NUB to request themed UI tokens
}
```

Optional NUBs (those not in the manifest `requires` tags) can be checked at runtime to enable progressive enhancement. The napplet degrades gracefully if the NUB is absent.

**Interaction flow:**

```
Manifest load → shell reads requires[] → pre-flight check against ShellCapabilities.nubs
                                         → REJECT if required NUB missing
                                         → PROCEED if all required NUBs present
                    ↓
Iframe creation → ShellCapabilities injected → shell.supports() functional
                    ↓
Napplet code → shell.supports('relay') → true/false (synchronous, no network)
```

---

### 3.5 services.has() vs shell.supports()

These are two distinct queries that answer different questions:

| Query | API | Checks | Protocol layer |
|-------|-----|--------|---------------|
| `shell.supports('relay')` | `window.napplet.shell.supports()` | Shell implements relay NUB | NUB protocol capability |
| `shell.supports('popups')` | `window.napplet.shell.supports()` | iframe has `allow-popups` in sandbox | Browser sandbox permission |
| `services.has('audio')` | `window.napplet.services.has()` | Audio service handler registered | Service extension layer |

**NUBs are protocol-level capabilities** (relay, signer, storage, ifc, theme). A NUB being available means the shell's runtime will recognize messages of that domain type and respond to them. NUBs are defined in the NIP-5D specification.

**Services are optional extensions** registered via `ServiceRegistry` (audio, notifications, custom handlers). A service being available means the shell has a handler that processes `ifc.emit` messages with the service's topic prefix.

**Implementation distinction:**

```typescript
// shell.supports() checks the static capability set injected at creation
shell.supports('relay');  // → capabilities.nubs.includes('relay')

// services.has() checks the runtime's live ServiceRegistry
services.has('audio');    // → !!runtime.services['audio']
```

Under NIP-5D, `services.has()` should also be synchronous — the service list is known at creation time (it is the set of handlers in `ShellAdapter.services`). The old kind 29010 service discovery round-trip is eliminated. The service list is injected alongside the capability set at iframe creation using the same mechanism.

---

### 3.6 Injection Mechanism

The `ShellCapabilities` object (Section 3.3) and the service list are injected into the iframe at creation time using the same mechanism as `window.nostr` (Section 2). This is a unified injection approach: a single shell-controlled initialization step installs all three pieces of the `window.napplet` interface:

1. `window.napplet.shell.supports` — from `ShellCapabilities.nubs` and `.sandbox`
2. `window.napplet.services.has` — from `ShellAdapter.services` keys
3. `window.nostr` — from the shell's signer proxy (see Section 2)

All three are injected synchronously, before any napplet code runs. The specific injection mechanism (srcdoc, Service Worker, or bootstrap script) is documented in Section 2.3. Regardless of mechanism, the shell constructs a bootstrap payload containing `ShellCapabilities`, the service list, and the nostr proxy setup, and delivers it to the iframe's JavaScript context before the napplet's main bundle executes.

---

### 3.7 Affected Files

| File | Change | Impact |
|------|--------|--------|
| `packages/shell/src/types.ts` | Add `ShellCapabilities` interface (`nubs: string[]`, `sandbox: string[]`) | **MEDIUM** — new type, no breaking changes |
| `packages/shell/src/shell-bridge.ts` or new `shell-init.ts` | Capability set construction logic: collect NUB handler list from runtime config, parse `sandbox` attribute tokens | **MEDIUM** — new logic, isolated module |
| `packages/shell/src/index.ts` | Export `ShellCapabilities` type for host application use | **LOW** — export surface addition |
| `napplet/packages/shim/src/index.ts` | Replace `supports() { return false; }` stub with reads from injected capability set | **MEDIUM** — lives in @napplet repo, not @kehto; coordination required |
