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

### 2.1 Background

Under RUNTIME-SPEC v2.0.0, napplets accessed signing through the **signer proxy** protocol (RUNTIME-SPEC sections 4.1–4.7). Napplets sent signing requests as ephemeral kind 29001 events over postMessage; the shell responded with kind 29002 response events. The `@napplet/shim` installed a `window.nostr` object that internally used this round-trip mechanism — napplets could call `window.nostr.signEvent(event)` and the shim translated the call to a kind 29001 postMessage and awaited the kind 29002 response.

The napplet never had a "real" NIP-07 interface — it had a proxy that looked like NIP-07 from the call site, but used postMessage under the hood. The shell's `auth.getSigner()` provided the actual NIP-07 signer; it never surfaced to the iframe directly.

**NIP-5D changes this:** The specification states "Shells MUST provide a NIP-07 window.nostr implementation to each napplet iframe." This is a **shell responsibility**, not just a shim responsibility.

The implication for napplets without `@napplet/shim`: a vanilla JavaScript napplet that uses only `window.nostr` (standard NIP-07) must still have signing capability. If `window.nostr` is only provided by the shim's internal postMessage proxy, a shim-less napplet gets nothing. The NIP-5D MUST requirement closes this gap by requiring the shell to ensure `window.nostr` is available regardless of whether the napplet includes the shim.

---

### 2.2 The Sandbox Constraint

This is the core challenge. Napplet iframes use `sandbox="allow-scripts"` **without** `allow-same-origin`. This has critical security implications:

| Constraint | Implication | Why it matters |
|------------|-------------|---------------|
| No `allow-same-origin` | The iframe has an **opaque origin** (`null`) | Cross-origin rules apply even when hosted on the same domain |
| Opaque origin | Cannot access parent's `window.nostr` | `window.parent.nostr` is inaccessible from inside the sandbox |
| Cross-origin iframe | `iframe.contentWindow.nostr = ...` blocked | Setting properties on a cross-origin window throws a security error |
| Cross-origin document | `iframe.contentDocument` inaccessible | Cannot inject `<script>` tags via DOM manipulation |

The following approaches that work for same-origin iframes **do NOT work** for napplet iframes:

**1. Direct property injection — FAILS:**
```javascript
// In the shell page:
const iframe = document.createElement('iframe');
iframe.src = nappletUrl;
document.body.appendChild(iframe);
iframe.contentWindow.nostr = myNostr; // SecurityError: cross-origin window
```
The iframe is cross-origin due to the opaque origin created by `sandbox` without `allow-same-origin`. Any attempt to set properties on `iframe.contentWindow` after creation throws a `DOMException`.

**2. Script tag injection via DOM — FAILS:**
```javascript
// In the shell page:
const script = iframe.contentDocument.createElement('script'); // SecurityError
```
`iframe.contentDocument` is null or inaccessible for cross-origin frames — the browser refuses to give the parent access to the child's document.

**3. Parent window interception — FAILS:**
```javascript
// In the napplet iframe:
window.nostr = window.parent.nostr; // SecurityError: cannot access cross-origin parent property
```
The napplet cannot reach into the parent page's scope either. The `window.parent` reference is accessible, but accessing properties on it (other than `postMessage` and a few safe methods) throws.

The constraint is fundamental: **any injection mechanism must deliver the nostr implementation INTO the iframe's JavaScript context without relying on cross-origin property access.**

---

### 2.3 Design Options

Three viable mechanisms exist for delivering a `window.nostr` implementation into a sandboxed napplet iframe:

---

**Option A: srcdoc with injected bootstrap script**

The shell constructs the iframe's HTML content using the `srcdoc` attribute instead of a `src` URL. Before the napplet's actual content, the shell injects a `<script>` block that defines `window.nostr`:

```html
<!-- Shell constructs this HTML and sets iframe.srcdoc = ... -->
<!DOCTYPE html>
<html>
<head>
<script>
// Injected by shell — runs before napplet code
window.nostr = {
  async getPublicKey() {
    return shellRequest('signer.getPublicKey', {});
  },
  async signEvent(event) {
    return shellRequest('signer.signEvent', { event });
  },
  // ... nip04, nip44, getRelays
};

function shellRequest(type, params) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    window.addEventListener('message', function handler(e) {
      if (e.data?.type === type + '.result' && e.data?.id === id) {
        window.removeEventListener('message', handler);
        if (e.data.error) reject(new Error(e.data.error));
        else resolve(e.data.result ?? e.data);
      }
    });
    window.parent.postMessage({ type, id, ...params }, '*');
  });
}
</script>
</head>
<body>
<!-- Napplet HTML content here -->
</body>
</html>
```

- **Pro:** Shell fully controls `window.nostr` injection — it runs synchronously before any napplet code
- **Pro:** Works with `sandbox="allow-scripts"` — no `allow-same-origin` needed
- **Pro:** `window.nostr` is available synchronously when napplet module code runs
- **Con:** Requires the shell to fetch the napplet HTML and wrap it in a shell-provided srcdoc. Changes the iframe loading model from `src` URL to `srcdoc` blob, which has implications for relative URL resolution inside the napplet
- **Con:** Large napplet HTML payloads may hit srcdoc size limits in some browsers (typically several MB, but the limit is implementation-specific)
- **Con:** Napplet's `document.URL` and `location.href` return `about:srcdoc` instead of the original URL, which may affect napplets that rely on URL-based routing

---

**Option B: postMessage-based initialization handshake**

The napplet loads normally via `src` URL. When it loads, the shim (or a minimal bootstrap included in the napplet build) sends a `{ type: "shell.ready" }` postMessage to the parent. The shell responds with `{ type: "shell.init", capabilities: {...}, services: [...] }`. The shim then knows that `window.nostr` requests should use `signer.*` NUB envelope messages, which it already handles via the postMessage proxy.

```
Napplet loads → shim sends { type: "shell.ready" }
             → shell responds { type: "shell.init", capabilities: { nubs: [...], sandbox: [...] }, services: [...] }
             → shim installs capabilities, window.nostr already proxied via signer.* NUBs
```

- **Pro:** No change to iframe loading model — napplet still loads from its URL
- **Pro:** Works with any sandbox configuration
- **Pro:** The shim already handles all NIP-07 methods via signer.* NUB postMessage proxy — `window.nostr` was already available via the shim before NIP-5D
- **Con:** `window.nostr` is **not** available synchronously — napplet module-level code that calls `window.nostr.getPublicKey()` immediately on import will fail. The handshake requires a round-trip message before the shim's capabilities are confirmed
- **Con:** Requires the napplet to include `@napplet/shim` — vanilla JS napplets without the shim have no `window.nostr` until the shell provides one via another mechanism

---

**Option C: Shim-as-shell-provided-bootstrap**

The shell injects the `@napplet/shim` bundle URL into the napplet HTML as the first `<script>` tag, using either the srcdoc mechanism or a Service Worker that intercepts the napplet URL and prepends the shim. The shim itself provides `window.nostr` via its internal signer.* NUB proxy.

```javascript
// Shell intercepts napplet HTML fetch (via Service Worker), prepends:
<script src="https://cdn.jsdelivr.net/npm/@napplet/shim@latest/dist/shim.min.js"></script>
```

- **Pro:** Single implementation of `window.nostr` (the shim) — no duplication between shell-injected proxy and shim proxy
- **Pro:** The shim already handles all NIP-07 methods and capability queries
- **Con:** Still requires srcdoc or Service Worker for injection — the mechanism complexity is preserved
- **Con:** Couples the shell to the specific shim CDN URL or bundled path — an update to the shim requires an update to the shell's injection mechanism
- **Con:** Service Worker intercept adds a non-trivial service worker lifecycle dependency to every napplet host

---

### 2.4 Recommended Approach

**Recommendation: Option B (postMessage handshake) as the primary mechanism, with Option A (srcdoc) as the fallback for shim-less napplets.**

**Rationale:**

The NIP-5D MUST requirement — "Shells MUST provide a NIP-07 window.nostr implementation" — does not specify the *mechanism*. The requirement is satisfied if `window.nostr` exists and works in the napplet's JavaScript context by the time the napplet's application code runs.

For `@napplet/shim` v0.2.0+ napplets (the primary audience):

- The shim's internal `window.nostr` implementation already uses signer.* NUB postMessage messages. This proxy works today for the kind 29001/29002 round-trip and will work for NIP-5D envelope messages after the guard fix (Section 1). The shell "provides" `window.nostr` by ensuring the signer.* NUB messages are handled — whether the shim loads the nostr object or the shell injects it, the end result for the napplet is the same.
- The Option B handshake (shell.ready / shell.init) solves the one remaining gap: injecting the capability set and service list synchronously. The shim can request these at load time and fall back to safe defaults while awaiting the response.

For vanilla JS napplets (no shim):

- The shell SHOULD use Option A (srcdoc bootstrap) to inject a minimal `window.nostr` proxy before the napplet's script runs. The injected proxy uses the same `signer.*` NUB envelope messages.
- This is a fallback path; most napplets will use the shim and the Option B path.

**Critical implementation note:** The shell MUST NOT inject the user's private key or raw signer credentials into the iframe. All signing is proxied through the shell — the iframe's `window.nostr` makes postMessage calls to the shell, which forwards them to `auth.getSigner()` and returns the result. The raw cryptographic material never leaves the shell page.

---

### 2.5 NIP-07 Method Coverage

All six NIP-07 method groups must be supported. Each maps to a corresponding `signer.*` NUB message type:

| NIP-07 Method | NUB Message Type | Response Type | ACL Capability |
|---------------|-----------------|---------------|---------------|
| `window.nostr.getPublicKey()` | `signer.getPublicKey` | `signer.getPublicKey.result` (field: `publicKey`) | None (always allowed) |
| `window.nostr.signEvent(event)` | `signer.signEvent` | `signer.signEvent.result` (field: `event`) | `sign:event` |
| `window.nostr.getRelays()` | `signer.getRelays` | `signer.getRelays.result` (field: `relays`) | None (always allowed) |
| `window.nostr.nip04.encrypt(pubkey, plaintext)` | `signer.nip04.encrypt` | `signer.nip04.encrypt.result` (field: `ciphertext`) | `sign:nip04` |
| `window.nostr.nip04.decrypt(pubkey, ciphertext)` | `signer.nip04.decrypt` | `signer.nip04.decrypt.result` (field: `plaintext`) | `sign:nip04` |
| `window.nostr.nip44.encrypt(pubkey, plaintext)` | `signer.nip44.encrypt` | `signer.nip44.encrypt.result` (field: `ciphertext`) | `sign:nip44` |
| `window.nostr.nip44.decrypt(pubkey, ciphertext)` | `signer.nip44.decrypt` | `signer.nip44.decrypt.result` (field: `plaintext`) | `sign:nip44` |

**Wire format for NUB signer messages (NIP-5D):**

```typescript
// Request (napplet → shell via postMessage)
{ type: "signer.signEvent", id: "uuid", event: { kind: 1, ... } }

// Response (shell → napplet via postMessage)
{ type: "signer.signEvent.result", id: "uuid", event: { kind: 1, sig: "...", ... } }

// Error response
{ type: "signer.signEvent.result", id: "uuid", error: "capability sign:event not granted" }
```

The `id` field is a client-generated UUID. The shell echoes it on the response so the napplet's `window.nostr` proxy can match responses to pending requests.

---

### 2.6 Security Boundaries

**Shell controls which napplet gets which signer:**

The `AuthHooks.getSigner()` (defined in `types.ts` line 127) returns the NIP-07 compatible signer for the **current user**. Each `signer.*` NUB request is routed through the runtime's dispatch path, which resolves the requesting `windowId` to a session entry before forwarding to the signer. The shell MUST NOT give one napplet access to a signer intended for a different user.

**ACL enforcement — signer operations are gated:**

All `signer.*` NUB requests go through the runtime's ACL enforcement path before reaching the signer. Specifically:

- `signer.signEvent` → requires `sign:event` capability (ACL bit `CAP_SIGN_EVENT`)
- `signer.nip04.*` → requires `sign:nip04` capability (ACL bit `CAP_SIGN_NIP04`)
- `signer.nip44.*` → requires `sign:nip44` capability (ACL bit `CAP_SIGN_NIP44`)
- `signer.getPublicKey`, `signer.getRelays` → no ACL requirement (informational only)

The `window.nostr` proxy in the iframe MUST route through these ACL gates — it MUST NOT bypass them by calling the signer directly. The correct path is: `napplet calls window.nostr.signEvent()` → postMessage `signer.signEvent` → runtime ACL gate → `auth.getSigner().signEvent()` → response.

**Consent gating for destructive signing kinds:**

Signing requests for kinds 0 (metadata), 3 (contacts), 5 (deletion), and 10002 (relay list) MUST always prompt the user for approval via the `registerConsentHandler` callback. This is a safety floor that cannot be waived by ACL grants. The consent gate is enforced at the `signer.signEvent` handler in the runtime, not in the `window.nostr` proxy — the proxy simply relays the request.

**No raw key exposure:**

The shell MUST NOT inject the user's private key (`nsec`, raw bytes, or any representation) into the iframe's JavaScript context. The injected `window.nostr` proxy calls `window.parent.postMessage(...)` for every operation — the shell receives the request, signs using `auth.getSigner()`, and returns only the signed result. The private key never crosses the postMessage boundary.

**Origin validation:**

The `window.nostr` proxy in the iframe sends postMessages to `window.parent` using the `'*'` target origin (since the iframe's own origin is opaque and cannot filter on the parent's origin). The shell-side handler in `handleMessage()` validates that the request arrived from a known registered window (`originRegistry.getWindowId(event.source)`) before processing any `signer.*` request. Requests from unregistered windows are silently dropped.

---

### 2.7 Affected Files

| File | Change | Impact |
|------|--------|--------|
| `packages/shell/src/shell-bridge.ts` or new `packages/shell/src/shell-init.ts` | `window.nostr` bootstrap script generation (Option A) and/or shell.ready/shell.init handshake handler (Option B) | **HIGH** — new injection logic, may be extracted to a dedicated module for clarity |
| `packages/shell/src/hooks-adapter.ts` | `auth.getSigner()` and `auth.getUserPubkey()` usage in signer NUB handler | **LOW** — existing `AuthAdapter` already wires to `shellHooks.auth.getSigner()`; no change to adapter needed if the runtime's signer handler uses these existing hooks |
| `packages/shell/src/types.ts` | Optional `ShellNostrBootstrap` hook type if Option A is used (the shell needs to construct the bootstrap script for srcdoc injection) | **LOW** — additive only |
| `napplet/packages/shim/src/index.ts` | Replace kind 29001/29002 postMessage proxy with `signer.*` NUB envelope messages; add `shell.ready` init message; read capability set from `shell.init` response | **HIGH** — lives in @napplet repo, not @kehto; coordinated change required with @napplet release |

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
