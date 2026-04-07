# Services Migration: @kehto/services — RUNTIME-SPEC v2.0.0 to NIP-5D v0.1.0

**Date:** 2026-04-07
**Package:** @kehto/services
**Scope:** ServiceHandler interface change, per-handler migration (signer, audio, notifications, relay-pool, cache, coordinated-relay)
**References:** [GAP-ANALYSIS.md section 5.4](./GAP-ANALYSIS.md#54-kehtoservices-boundary-contract), [RUNTIME-MIGRATION.md section 3](./RUNTIME-MIGRATION.md#3-handler-rewrites-rt-03), [PITFALLS.md Pitfall 5](../.planning/research/PITFALLS.md)

---

## 1. ServiceHandler Interface Change (SVC-01)

### 1.1 Background

`ServiceHandler` in `packages/runtime/src/types.ts` (line 486) is the contract between the runtime dispatch layer and every service implementation. All six service handlers in `packages/services/src/` implement this interface. Currently:

- `handleMessage(windowId: string, message: unknown[], send: (msg: unknown[]) => void): void`
- Services receive NIP-01 arrays. IPC_PEER-routed services (audio, notifications) receive `['EVENT', event]`; relay-tier services (relay-pool, cache, coordinated-relay) receive raw NIP-01 verbs `['REQ', subId, ...filters]`, `['CLOSE', subId]`, `['EVENT', event]`.
- The runtime's `routeServiceMessage()` in `service-dispatch.ts` wraps IPC_PEER events as `['EVENT', event]` before calling `handleMessage`, and routes by the topic prefix before `:` extracted from `event.tags`.
- Responses are also NIP-01 arrays: `['OK', id, true, '']`, `['EVENT', subId, event]`, `['EOSE', subId]`.

This is **Pitfall 5** from PITFALLS.md: after the runtime migrates to NUB envelope dispatch (RUNTIME-MIGRATION.md section 1), services will receive `NappletMessage` objects (`{ type: string, ... }`) but still expect `unknown[]` arrays. There is no TypeScript error at the call site because `unknown[]` accepts any type — the mismatch is silent. A service that checks `message[0] !== 'EVENT'` will always return early and never process any NIP-5D messages.

---

### 1.2 Old vs New Interface

**Old (current — `packages/runtime/src/types.ts` line 486):**

```typescript
export interface ServiceHandler {
  descriptor: ServiceDescriptor;
  /**
   * Handle a raw NIP-01 message from a napplet.
   * @param message - Raw NIP-01 message array (e.g., ['EVENT', event], ['REQ', subId, ...filters])
   * @param send - Callback to send NIP-01 response messages back to the napplet
   */
  handleMessage(windowId: string, message: unknown[], send: (msg: unknown[]) => void): void;
  onWindowDestroyed?(windowId: string): void;
}
```

**New (target — after NIP-5D migration):**

```typescript
export interface ServiceHandler {
  descriptor: ServiceDescriptor;
  /**
   * Handle a NIP-5D envelope from a napplet.
   * @param message - NappletMessage JSON envelope (e.g., { type: 'signer.signEvent', id, event })
   * @param send - Callback to send NappletMessage responses back to the napplet
   */
  handleMessage(
    windowId: string,
    message: NappletMessage,
    send: (msg: NappletMessage) => void,
  ): void;
  onWindowDestroyed?(windowId: string): void;
}
```

**Key changes:**

| Aspect | Old | New |
|--------|-----|-----|
| `message` type | `unknown[]` — NIP-01 array | `NappletMessage` — typed JSON envelope `{ type: string } & Record<string, unknown>` |
| `send` callback | `(msg: unknown[]) => void` — sends NIP-01 arrays | `(msg: NappletMessage) => void` — sends envelope objects |
| Type safety | None — `unknown[]` accepts anything | Compile-time catches format mismatches |
| Import source | No additional import | `NappletMessage` from `@napplet/core` |

`NappletMessage` is defined in `@napplet/core` as `{ type: string } & Record<string, unknown>`. It is the same type that the runtime's NUB dispatch layer dispatches for all inbound napplet messages.

---

### 1.3 service-dispatch.ts Rewrite

`routeServiceMessage()` in `packages/runtime/src/service-dispatch.ts` (lines 32–48) is the gateway that services pass through before `handleMessage` is called:

**Old routing logic:**

```typescript
// Extracts topic from event.tags, routes by prefix before ':'
export function routeServiceMessage(
  windowId: string,
  event: NostrEvent,           // the IPC_PEER event
  topic: string,               // from event.tags.find(t => t[0] === 't')[1]
  services: ServiceRegistry,
  sendToNapplet: SendToNapplet,
): boolean {
  const colonIndex = topic.indexOf(':');
  if (colonIndex === -1) return false;
  const prefix = topic.slice(0, colonIndex);  // 'audio:register' -> 'audio'
  const handler = services[prefix];
  if (!handler) return false;
  const send = (msg: unknown[]): void => sendToNapplet(windowId, msg);
  handler.handleMessage(windowId, ['EVENT', event], send);  // wraps as NIP-01 array
  return true;
}
```

**New routing logic (NIP-5D):**

The function signature changes fundamentally — it receives a `NappletMessage` instead of a raw event and topic. Routing is by `message.type` domain prefix for NUB-domain services, and by `message.topic` prefix for IFC-routed services:

```typescript
export function routeServiceMessage(
  windowId: string,
  message: NappletMessage,     // typed envelope from NUB dispatch
  services: ServiceRegistry,
  sendToNapplet: SendToNapplet,
): boolean {
  const send = (msg: NappletMessage): void => sendToNapplet(windowId, msg);

  // NUB-domain services: signer.*, relay.*, storage.* route by type prefix
  const domain = message.type.split('.')[0];
  const handler = services[domain];
  if (handler) {
    handler.handleMessage(windowId, message, send);
    return true;
  }

  // IFC-routed services: audio and notifications receive ifc.emit with topic prefix
  if (message.type === 'ifc.emit' && typeof message.topic === 'string') {
    const prefix = message.topic.split(':')[0];
    const ifcHandler = services[prefix];
    if (ifcHandler) {
      ifcHandler.handleMessage(windowId, message, send);
      return true;
    }
  }

  return false;
}
```

**What changes:**
- `event: NostrEvent` and `topic: string` parameters are removed — these were NIP-01 artifacts
- The `['EVENT', event]` wrap in the function body is removed — `handleMessage` receives the envelope directly
- NUB-domain services are routed by `message.type.split('.')[0]` (`'signer.signEvent'` → `'signer'`)
- IFC-routed services (audio, notifications) are still routed by topic prefix, but from `message.topic` (a flat field) rather than from `event.tags`
- The function signature change is a **breaking change at the call site** in `runtime.ts`

---

### 1.4 SendToNapplet Signature

The outbound callback also evolves as the runtime's sending capability broadens:

**Current** (`packages/runtime/src/types.ts` line 47):

```typescript
export type SendToNapplet = (windowId: string, msg: unknown[]) => void;
```

**Target** (widened for dual-mode transition per RUNTIME-MIGRATION.md section 3.7):

```typescript
export type SendToNapplet = (windowId: string, msg: NappletMessage | unknown[]) => void;
```

The `send` callback passed to `handleMessage` narrows this to `(msg: NappletMessage) => void` since services under NIP-5D only produce envelope responses. The widened union type on `SendToNapplet` accommodates the dual-mode period where legacy napplets and NIP-5D napplets coexist.

---

### 1.5 ServiceDescriptor

`ServiceDescriptor` is **unchanged** by this migration:

```typescript
interface ServiceDescriptor {
  name: string;
  version: string;
  description?: string;
}
```

The descriptor is metadata only — it does not participate in message routing under NIP-5D. Service discovery uses `services.has()` (synchronous, injected at shell creation) rather than kind 29010 query events. See RUNTIME-MIGRATION.md section 3.6 for the service discovery replacement.

---

### 1.6 Dual-Mode Transition Strategy

During the transition period, shells may host both legacy napplets (using NIP-01 arrays) and NIP-5D napplets (using envelope objects). A dual-mode approach avoids a flag-day cutover:

**Phase 1 — dual-mode** (both formats accepted):

```typescript
handleMessage(
  windowId: string,
  message: NappletMessage | unknown[],
  send: (msg: NappletMessage | unknown[]) => void,
): void {
  if (Array.isArray(message)) {
    // Legacy path — convert to envelope or handle directly
    const envelope = legacyArrayToEnvelope(message);
    if (!envelope) return;
    this.handleEnvelope(windowId, envelope, send as (msg: NappletMessage) => void);
    return;
  }
  // NIP-5D path
  this.handleEnvelope(windowId, message, send as (msg: NappletMessage) => void);
}
```

The compat wrapper (`legacyArrayToEnvelope`) converts legacy NIP-01 arrays to their nearest NappletMessage equivalent, so the core service logic is written once against the envelope format only.

**Phase 2 — NIP-5D only** (legacy path removed):

```typescript
handleMessage(
  windowId: string,
  message: NappletMessage,
  send: (msg: NappletMessage) => void,
): void {
  // Envelope-only — no legacy path
}
```

This matches the runtime's own dual-mode strategy (RUNTIME-MIGRATION.md section 1.3).

---

### 1.7 Affected Files Summary

| File | Change | Impact |
|------|--------|--------|
| `packages/runtime/src/types.ts` | Update `ServiceHandler.handleMessage` and `SendToNapplet` signatures | All service implementations break at compile time (good — catches missed migrations) |
| `packages/runtime/src/service-dispatch.ts` | Rewrite `routeServiceMessage()` — remove event/topic params, route by `message.type` | All call sites in `runtime.ts` must be updated |
| `packages/services/src/signer-service.ts` | Full `handleMessage` rewrite | NUB-domain service: receives `signer.*` messages directly |
| `packages/services/src/audio-service.ts` | Full `handleMessage` rewrite | IFC-routed service: receives `ifc.emit` with `audio:*` topic |
| `packages/services/src/notification-service.ts` | Full `handleMessage` rewrite | IFC-routed service: receives `ifc.emit` with `notifications:*` topic |
| `packages/services/src/relay-pool-service.ts` | Full `handleMessage` rewrite | Relay NUB service: receives `relay.*` envelopes |
| `packages/services/src/cache-service.ts` | Full `handleMessage` rewrite | Relay NUB service: receives `relay.*` envelopes |
| `packages/services/src/coordinated-relay.ts` | Full `handleMessage` rewrite | Composite relay NUB service: receives `relay.*` envelopes |

---

## 2. Per-Handler Migration

### 2.1 Signer Service Migration

#### 2.1.1 Old Code Path

`createSignerService()` in `signer-service.ts` returns a ServiceHandler whose `handleMessage` at line 88:

1. Checks `message[0] !== 'EVENT'` (line 89) — guards against non-EVENT arrays
2. Extracts event as `message[1] as NostrEvent` (line 90)
3. Checks `event.kind !== BusKind.SIGNER_REQUEST` (29001) (line 92) — guards against non-signer events
4. Extracts correlation ID from `event.tags?.find((t) => t[0] === 'id')?.[1]` (line 94)
5. Extracts method from `event.tags?.find((t) => t[0] === 'method')?.[1]` (line 95)
6. Routes to signer method by `method` string: `'signEvent'`, `'getPublicKey'`, `'getRelays'`, `'nip04.encrypt'`, `'nip04.decrypt'`, `'nip44.encrypt'`, `'nip44.decrypt'`
7. For `signEvent`, parses the event-to-sign from `event.tags?.find((t) => t[0] === 'event')?.[1]` via `JSON.parse` (line 165–168)
8. For nip04/nip44 operations, extracts params from `event.tags?.find((t) => t[0] === 'params')` (lines 120–133)
9. Responds success: `send(['EVENT', '__signer__', responseEvent])` + `send(['OK', event.id, true, ''])` (lines 155–156)
10. Responds error: `send(['OK', event.id, false, 'error: ...'])` (line 98)

The response event is a kind 29002 (`BusKind.SIGNER_RESPONSE`) event with `['result', JSON.stringify(result)]` tag (lines 142–154).

#### 2.1.2 New Message Shapes

**Inbound (napplet → shell):**

| Operation | Old Inbound | New Inbound |
|-----------|------------|------------|
| `signer.signEvent` | `['EVENT', {kind:29001, tags:[['method','signEvent'],['id','uuid'],['event','{...}']]}]` | `{type:'signer.signEvent', id:'uuid', event:{...}}` |
| `signer.getPublicKey` | `['EVENT', {kind:29001, tags:[['method','getPublicKey'],['id','uuid']]}]` | `{type:'signer.getPublicKey', id:'uuid'}` |
| `signer.getRelays` | `['EVENT', {kind:29001, tags:[['method','getRelays'],['id','uuid']]}]` | `{type:'signer.getRelays', id:'uuid'}` |
| `signer.nip04.encrypt` | `['EVENT', {kind:29001, tags:[['method','nip04.encrypt'],['params','pubkey','plain']]}]` | `{type:'signer.nip04.encrypt', id:'uuid', pubkey:'...', plaintext:'...'}` |
| `signer.nip04.decrypt` | `['EVENT', {kind:29001, tags:[['method','nip04.decrypt'],['params','pubkey','cipher']]}]` | `{type:'signer.nip04.decrypt', id:'uuid', pubkey:'...', ciphertext:'...'}` |
| `signer.nip44.encrypt` | `['EVENT', {kind:29001, tags:[['method','nip44.encrypt'],['params','pubkey','plain']]}]` | `{type:'signer.nip44.encrypt', id:'uuid', pubkey:'...', plaintext:'...'}` |
| `signer.nip44.decrypt` | `['EVENT', {kind:29001, tags:[['method','nip44.decrypt'],['params','pubkey','cipher']]}]` | `{type:'signer.nip44.decrypt', id:'uuid', pubkey:'...', ciphertext:'...'}` |

**Outbound (shell → napplet):**

| Operation | Old Outbound | New Outbound |
|-----------|-------------|-------------|
| `signer.signEvent` | `['EVENT','__signer__',{kind:29002,tags:[['id','uuid'],['method','signEvent'],['result','{...}']]}]` + `['OK',id,true,'']` | `{type:'signer.signEvent.result', id:'uuid', event:{...}}` |
| `signer.getPublicKey` | `['EVENT','__signer__',{kind:29002,...,tags:[['result','\"npub...\"']]}]` + `['OK',id,true,'']` | `{type:'signer.getPublicKey.result', id:'uuid', pubkey:'...'}` |
| `signer.getRelays` | `['EVENT','__signer__',{kind:29002,...,tags:[['result','{...}']]}}]` + `['OK',id,true,'']` | `{type:'signer.getRelays.result', id:'uuid', relays:{...}}` |
| `signer.nip04.encrypt` | `['EVENT','__signer__',{kind:29002,...}]` + `['OK',id,true,'']` | `{type:'signer.nip04.encrypt.result', id:'uuid', ciphertext:'...'}` |
| `signer.nip04.decrypt` | `['EVENT','__signer__',{kind:29002,...}]` + `['OK',id,true,'']` | `{type:'signer.nip04.decrypt.result', id:'uuid', plaintext:'...'}` |
| `signer.nip44.encrypt` | `['EVENT','__signer__',{kind:29002,...}]` + `['OK',id,true,'']` | `{type:'signer.nip44.encrypt.result', id:'uuid', ciphertext:'...'}` |
| `signer.nip44.decrypt` | `['EVENT','__signer__',{kind:29002,...}]` + `['OK',id,true,'']` | `{type:'signer.nip44.decrypt.result', id:'uuid', plaintext:'...'}` |

#### 2.1.3 New Code Structure

Target `handleMessage` switches directly on `message.type` and reads flat fields:

```typescript
handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
  const corrId = message.id as string | undefined;

  const maybeSigner = options.getSigner();
  if (!maybeSigner) {
    send({ type: `${message.type}.error`, id: corrId, error: 'no signer configured' });
    return;
  }
  const signer = maybeSigner;

  switch (message.type) {
    case 'signer.signEvent': {
      const eventToSign = message.event as NostrEvent;
      if (consentKinds.has(eventToSign.kind) && options.onConsentNeeded) {
        new Promise<boolean>((resolve) => {
          options.onConsentNeeded!({ windowId, event: eventToSign, resolve });
        }).then((allowed) => {
          if (!allowed) {
            send({ type: 'signer.signEvent.error', id: corrId, error: 'user rejected' });
            return;
          }
          signer.signEvent?.(eventToSign)
            .then((signed) => send({ type: 'signer.signEvent.result', id: corrId, event: signed }))
            .catch((err: unknown) => send({ type: 'signer.signEvent.error', id: corrId, error: String(err) }));
        });
        return;
      }
      signer.signEvent?.(eventToSign)
        .then((signed) => send({ type: 'signer.signEvent.result', id: corrId, event: signed }))
        .catch((err: unknown) => send({ type: 'signer.signEvent.error', id: corrId, error: String(err) }));
      return;
    }
    case 'signer.getPublicKey':
      Promise.resolve(signer.getPublicKey?.())
        .then((pubkey) => send({ type: 'signer.getPublicKey.result', id: corrId, pubkey }))
        .catch((err: unknown) => send({ type: 'signer.getPublicKey.error', id: corrId, error: String(err) }));
      return;
    case 'signer.getRelays':
      Promise.resolve(signer.getRelays?.() ?? {})
        .then((relays) => send({ type: 'signer.getRelays.result', id: corrId, relays }))
        .catch((err: unknown) => send({ type: 'signer.getRelays.error', id: corrId, error: String(err) }));
      return;
    case 'signer.nip04.encrypt':
      signer.nip04?.encrypt(message.pubkey as string, message.plaintext as string)
        .then((ciphertext) => send({ type: 'signer.nip04.encrypt.result', id: corrId, ciphertext }))
        .catch((err: unknown) => send({ type: 'signer.nip04.encrypt.error', id: corrId, error: String(err) }));
      return;
    // nip04.decrypt, nip44.encrypt, nip44.decrypt follow same pattern
  }
}
```

**What the new code eliminates:**
- Array destructuring (`message[0]`, `message[1]`)
- Kind check (`event.kind !== BusKind.SIGNER_REQUEST`)
- Tag extraction (`event.tags?.find((t) => t[0] === 'method')`)
- `JSON.parse(eventTag)` to get the event to sign — it arrives as a real object in `message.event`
- The two-part response (`send(['EVENT', ...]`) + `send(['OK', ...])`) — replaced by a single typed result envelope

#### 2.1.4 Consent Gating

The consent gating path (lines 163–197 in the current file) is **preserved**. The logic:

- Check `consentKinds.has(eventToSign.kind)` — unchanged
- If `onConsentNeeded` is set, show consent UI — unchanged
- Resolve with allowed/rejected — unchanged

The simplification: `eventToSign` is obtained from `message.event` (already a `NostrEvent` object) instead of `JSON.parse(event.tags.find(t => t[0] === 'event')[1])`. No `JSON.parse`, no try/catch around event deserialization.

#### 2.1.5 Error Responses

**Format change:**

| Scenario | Old Error | New Error |
|----------|-----------|-----------|
| No signer configured | `send(['OK', event.id, false, 'error: no signer configured'])` | `send({ type: 'signer.signEvent.error', id: corrId, error: 'no signer configured' })` |
| User rejected consent | `send(['OK', event.id, false, 'error: user rejected'])` | `send({ type: 'signer.signEvent.error', id: corrId, error: 'user rejected' })` |
| Signer method throws | `send(['OK', event.id, false, 'error: message'])` | `send({ type: 'signer.signEvent.error', id: corrId, error: 'message' })` |
| Invalid event JSON | `send(['OK', event.id, false, 'error: invalid event JSON'])` | Not needed — `message.event` is already an object |

Each signer operation has its own typed `.error` response (`signer.getPublicKey.error`, `signer.nip04.encrypt.error`, etc.). The napplet SDK can discriminate on `message.type.endsWith('.error')` for generic error handling, or match specific types for per-operation handling.

#### 2.1.6 BusKind Import Removal

After migration, `import { BusKind } from '@napplet/core'` is no longer needed by `signer-service.ts`. The signer service should instead import the appropriate NUB types (or `NappletMessage`) from `@napplet/core`:

```typescript
// Before (to remove)
import { BusKind } from '@napplet/core';
// BusKind.SIGNER_REQUEST (29001) and BusKind.SIGNER_RESPONSE (29002) are no longer referenced

// After
import type { NappletMessage } from '@napplet/core';
```

`BusKind.SIGNER_REQUEST` and `BusKind.SIGNER_RESPONSE` remain exported from `@napplet/core/src/legacy.ts` as `@deprecated` — do not use them in the migrated service (see RUNTIME-MIGRATION.md section 3.3 Pitfall 7 note).

---

### 2.2 Audio Service Migration

*(placeholder — see Task 2)*

### 2.3 Notification Service Migration

*(placeholder — see Task 2)*

### 2.4 Relay Pool Service Migration

*(placeholder — see Task 2)*

### 2.5 Cache Service Migration

*(placeholder — see Task 2)*

### 2.6 Coordinated Relay Service Migration

*(placeholder — see Task 2)*
