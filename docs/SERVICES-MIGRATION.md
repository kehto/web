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

#### 2.2.1 Old Code Path

`createAudioService()` in `audio-service.ts` returns a ServiceHandler whose `handleMessage` at line 165:

1. Checks `message[0] !== 'EVENT' || !message[1]` (line 167) — guards against non-EVENT arrays
2. Casts `message[1] as NostrEvent` (line 168)
3. Checks `event.kind !== BusKind.IPC_PEER` (29003) (line 171) — discards non-IPC events
4. Calls `extractTopic(event)` to get `event.tags?.find((t) => t[0] === 't')?.[1]` (lines 69–71)
5. Checks `topic?.startsWith('audio:')` (line 173) — discards non-audio topics
6. Strips prefix with `topic.slice(6)` to get action: `'register'`, `'unregister'`, `'state-changed'`, `'mute'` (line 97)
7. Calls `parseContent(event)` — `JSON.parse(event.content)` — to get action payload (lines 54–64)
8. For `'mute'` action, responds via `send(['EVENT', '__shell__', createResponseEvent('napplet:audio-muted', { muted })])` (line 146)

Three helper functions exist solely to bridge the array format:
- `parseContent(event)` (lines 54–64): parses JSON content from `event.content`
- `extractTopic(event)` (lines 69–71): gets the `t` tag value from `event.tags`
- `createResponseEvent(topic, content)` (lines 76–86): builds a synthetic kind 29003 IPC_PEER event for responses

#### 2.2.2 New Message Shapes

Audio is an **IFC-routed service** under NIP-5D. It does not receive a NUB-domain message like signer (which receives `signer.*` types directly). Instead, audio messages arrive as `ifc.emit` envelopes with `topic` matching `audio:*`. The `routeServiceMessage()` function routes by `message.topic` prefix when `message.type === 'ifc.emit'`.

**Inbound (napplet → shell):**

| Action | Old Format | New Format |
|--------|-----------|-----------|
| `register` | `['EVENT', {kind:29003, tags:[['t','audio:register']], content:'{"nappletClass":"...","title":"..."}'}]` | `{type:'ifc.emit', topic:'audio:register', payload:{nappletClass:'...', title:'...'}}` |
| `unregister` | `['EVENT', {kind:29003, tags:[['t','audio:unregister']], content:'{}'}]` | `{type:'ifc.emit', topic:'audio:unregister', payload:{}}` |
| `state-changed` | `['EVENT', {kind:29003, tags:[['t','audio:state-changed']], content:'{"title":"..."}'}]` | `{type:'ifc.emit', topic:'audio:state-changed', payload:{title:'...'}}` |
| `mute` | `['EVENT', {kind:29003, tags:[['t','audio:mute']], content:'{"windowId":"...","muted":true}'}]` | `{type:'ifc.emit', topic:'audio:mute', payload:{windowId:'...', muted:true}}` |

**Outbound (shell → napplet) — mute response only:**

| Response | Old Format | New Format |
|----------|-----------|-----------|
| Mute notification | `['EVENT', '__shell__', {kind:29003, tags:[['t','napplet:audio-muted']], content:'{"muted":true}'}]` | `{type:'ifc.event', topic:'napplet:audio-muted', payload:{muted:true}}` |

#### 2.2.3 New Code Structure

Target `handleMessage` receives an `ifc.emit` envelope and reads flat fields:

```typescript
handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
  // Only handle ifc.emit messages with audio:* topic
  if (message.type !== 'ifc.emit') return;
  const topic = message.topic as string | undefined;
  if (!topic?.startsWith('audio:')) return;

  const action = topic.slice(6); // 'audio:'.length === 6
  const payload = (message.payload ?? {}) as Record<string, unknown>;

  switch (action) {
    case 'register': {
      const nappletClass = typeof payload.nappletClass === 'string' ? payload.nappletClass : '';
      const title = typeof payload.title === 'string' ? payload.title : '';
      sources.set(windowId, { windowId, nappletClass, title, muted: false });
      notify();
      break;
    }
    case 'unregister': {
      if (sources.delete(windowId)) notify();
      break;
    }
    case 'state-changed': {
      const source = sources.get(windowId);
      if (!source) return;
      if (typeof payload.title === 'string') source.title = payload.title;
      notify();
      break;
    }
    case 'mute': {
      const targetWindowId = typeof payload.windowId === 'string' ? payload.windowId : windowId;
      const muted = payload.muted === true;
      const source = sources.get(targetWindowId);
      if (source) {
        source.muted = muted;
        notify();
      }
      send({ type: 'ifc.event', topic: 'napplet:audio-muted', payload: { muted } });
      break;
    }
  }
}
```

#### 2.2.4 Simplification

The NIP-5D migration eliminates three helper functions entirely:

| Helper | Lines | Reason for Removal |
|--------|-------|-------------------|
| `parseContent(event)` | 54–64 | `payload` in the envelope is already a parsed object |
| `extractTopic(event)` | 69–71 | `message.topic` is a flat string field |
| `createResponseEvent(topic, content)` | 76–86 | Responses are plain envelope objects, not synthetic NostrEvents |

The core audio state logic is **unchanged**:
- `sources` Map tracking active audio sources per window
- `notify()` calling `onChange` with a copy of the sources Map
- `onWindowDestroyed` removing sources on window close
- The four action handlers (register, unregister, state-changed, mute) and their state mutations

`BusKind` import can be removed. `NostrEvent` import can be removed.

---

### 2.3 Notification Service Migration

#### 2.3.1 Old Code Path

`createNotificationService()` in `notification-service.ts` follows the same entry pattern as audio:

1. Checks `message[0] !== 'EVENT' || !message[1]` (line 254)
2. Checks `event.kind !== BusKind.IPC_PEER` (line 258)
3. Calls `extractTopic(event)` (line 259), checks `topic?.startsWith('notifications:')` (line 260)
4. Strips prefix with `topic.slice(14)` to get action (line 159): `'create'`, `'dismiss'`, `'read'`, `'list'`
5. Calls `parseContent(event)` for `create`, `dismiss`, `read` actions
6. Responds with `send(['EVENT', '__shell__', createResponseEvent(...)])` for `create` (ack with id) and `list`

Same three helper functions exist: `parseContent`, `extractTopic`, `createResponseEvent` (lines 81–113).

#### 2.3.2 New Message Shapes

Notifications is also an **IFC-routed service** — receives `ifc.emit` envelopes with `notifications:*` topics.

**Inbound (napplet → shell):**

| Action | Old Format | New Format |
|--------|-----------|-----------|
| `create` | `['EVENT', {kind:29003, tags:[['t','notifications:create']], content:'{"title":"...","body":"..."}'}]` | `{type:'ifc.emit', topic:'notifications:create', payload:{title:'...', body:'...'}}` |
| `dismiss` | `['EVENT', {kind:29003, tags:[['t','notifications:dismiss']], content:'{"id":"notif-..."}'}]` | `{type:'ifc.emit', topic:'notifications:dismiss', payload:{id:'notif-...'}}` |
| `read` | `['EVENT', {kind:29003, tags:[['t','notifications:read']], content:'{"id":"notif-..."}'}]` | `{type:'ifc.emit', topic:'notifications:read', payload:{id:'notif-...'}}` |
| `list` | `['EVENT', {kind:29003, tags:[['t','notifications:list']], content:'{}'}]` | `{type:'ifc.emit', topic:'notifications:list', payload:{}}` |

**Outbound (shell → napplet):**

| Response | Old Format | New Format |
|----------|-----------|-----------|
| Create ack | `['EVENT', '__shell__', {kind:29003, tags:[['t','notifications:created']], content:'{"id":"notif-..."}'}]` | `{type:'ifc.event', topic:'notifications:created', payload:{id:'notif-...'}}` |
| List response | `['EVENT', '__shell__', {kind:29003, tags:[['t','notifications:listed']], content:'{"notifications":[...]}'}]` | `{type:'ifc.event', topic:'notifications:listed', payload:{notifications:[...]}}` |

#### 2.3.3 New Code Structure

Target `handleMessage` — same structural pattern as audio:

```typescript
handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
  if (message.type !== 'ifc.emit') return;
  const topic = message.topic as string | undefined;
  if (!topic?.startsWith('notifications:')) return;

  const action = topic.slice(14); // 'notifications:'.length === 14
  const payload = (message.payload ?? {}) as Record<string, unknown>;

  switch (action) {
    case 'create': {
      const title = typeof payload.title === 'string' ? payload.title : '';
      const body = typeof payload.body === 'string' ? payload.body : '';
      const id = generateId();
      const notification: Notification = { id, windowId, title, body, read: false, createdAt: Math.floor(Date.now() / 1000) };
      const list = getWindowNotifications(windowId);
      list.push(notification);
      enforceLimit(list);
      notify();
      send({ type: 'ifc.event', topic: 'notifications:created', payload: { id } });
      break;
    }
    case 'dismiss': {
      const id = typeof payload.id === 'string' ? payload.id : '';
      if (!id) return;
      const found = findById(id);
      if (found) {
        const [foundWindowId, , index] = found;
        const list = notifications.get(foundWindowId);
        if (list) {
          list.splice(index, 1);
          if (list.length === 0) notifications.delete(foundWindowId);
          notify();
        }
      }
      break;
    }
    case 'read': {
      const id = typeof payload.id === 'string' ? payload.id : '';
      if (!id) return;
      const found = findById(id);
      if (found) {
        const [, notification] = found;
        if (!notification.read) { notification.read = true; notify(); }
      }
      break;
    }
    case 'list': {
      const windowNotifs = notifications.get(windowId) ?? [];
      send({ type: 'ifc.event', topic: 'notifications:listed', payload: { notifications: windowNotifs } });
      break;
    }
  }
}
```

The same three helpers (`parseContent`, `extractTopic`, `createResponseEvent`) are eliminated. Core notification logic is **unchanged**: `notifications` Map, `generateId()`, `enforceLimit()`, `findById()`, CRUD action handlers.

#### 2.3.4 ID Counter

The module-level `idCounter` variable (line 22) is unaffected by the migration. It is internal state for generating unique notification IDs — not wire-format dependent. `generateId()` continues to produce `notif-${Date.now()}-${idCounter}` strings.

---

### 2.4 Relay Pool Service Migration

#### 2.4.1 Old Code Path

`createRelayPoolService()` in `relay-pool-service.ts` is structurally different from audio and notifications. It does **not** receive IPC_PEER events via topic routing. It receives **raw NIP-01 verbs directly** — REQ, CLOSE, EVENT — as message[0]:

```typescript
handleMessage(windowId: string, message: unknown[], send: (msg: unknown[]) => void): void {
  const verb = message[0];

  if (verb === 'REQ') {
    const subId = message[1] as string;
    const filters = message.slice(2) as NostrFilter[];
    // subscribe to relay pool...
    send(['EOSE', subId]);  // or send(['EVENT', subId, event])
  }

  if (verb === 'CLOSE') {
    const subId = message[1] as string;
    // unsubscribe...
  }

  if (verb === 'EVENT') {
    const event = message[1] as NostrEvent;
    options.publish(event);
  }
}
```

This is because relay-pool is a service that **replaces** the runtime's built-in relay handling. The runtime passes relay-verb messages directly to the service rather than routing to the network. Subscription state is tracked in a `tracked` Map keyed by `${windowId}:${subId}`, with a 15-second EOSE fallback timer per subscription.

#### 2.4.2 New Message Shapes

Under NIP-5D, the relay pool service receives **relay NUB envelopes** instead of NIP-01 verb arrays:

| Operation | Old Format | New Format |
|-----------|-----------|-----------|
| Subscribe | `['REQ', subId, ...filters]` | `{type:'relay.subscribe', id:'uuid', subId:'uuid', filters:[...]}` |
| Close | `['CLOSE', subId]` | `{type:'relay.close', id:'uuid', subId:'uuid'}` |
| Publish | `['EVENT', event]` | `{type:'relay.publish', id:'uuid', event:{...}}` |
| Event (out) | `send(['EVENT', subId, event])` | `send({type:'relay.event', subId:'uuid', event:{...}})` |
| EOSE (out) | `send(['EOSE', subId])` | `send({type:'relay.eose', subId:'uuid'})` |

#### 2.4.3 New Code Structure

Target `handleMessage` switches on `message.type` and reads flat fields instead of positional array elements:

```typescript
handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
  if (message.type === 'relay.subscribe') {
    const subId = message.subId as string;
    const filters = message.filters as NostrFilter[];
    const subKey = `${windowId}:${subId}`;

    // Cancel existing subscription for this key
    const existing = tracked.get(subKey);
    if (existing) {
      existing.handle.unsubscribe();
      clearTimeout(existing.eoseTimer);
      tracked.delete(subKey);
    }

    if (!options.isAvailable()) {
      send({ type: 'relay.eose', subId });
      return;
    }

    const relayUrls = options.selectRelayTier(filters);
    let eoseSent = false;

    const eoseTimer = setTimeout(() => {
      if (!eoseSent) { eoseSent = true; send({ type: 'relay.eose', subId }); }
    }, EOSE_FALLBACK_MS);

    const handle = options.subscribe(filters, (item) => {
      if (item === 'EOSE') {
        clearTimeout(eoseTimer);
        if (!eoseSent) { eoseSent = true; send({ type: 'relay.eose', subId }); }
        return;
      }
      send({ type: 'relay.event', subId, event: item });
    }, relayUrls);

    tracked.set(subKey, { handle, eoseTimer });
    return;
  }

  if (message.type === 'relay.close') {
    const subId = message.subId as string;
    const entry = tracked.get(`${windowId}:${subId}`);
    if (entry) {
      entry.handle.unsubscribe();
      clearTimeout(entry.eoseTimer);
      tracked.delete(`${windowId}:${subId}`);
    }
    return;
  }

  if (message.type === 'relay.publish') {
    const event = message.event as NostrEvent | undefined;
    if (event && typeof event === 'object' && options.isAvailable()) {
      options.publish(event);
    }
    return;
  }
}
```

**What stays the same:**
- `tracked` Map keyed by `${windowId}:${subId}` — unchanged
- EOSE fallback timer logic — unchanged
- `options.subscribe()`, `options.publish()`, `options.isAvailable()`, `options.selectRelayTier()` calls — unchanged
- `onWindowDestroyed` cleanup loop — unchanged

**What changes:**
- `verb = message[0]` → `message.type` for routing
- `message[1] as string` (subId) → `message.subId as string`
- `message.slice(2) as NostrFilter[]` → `message.filters as NostrFilter[]`
- `send(['EVENT', subId, item])` → `send({ type: 'relay.event', subId, event: item })`
- `send(['EOSE', subId])` → `send({ type: 'relay.eose', subId })`

#### 2.4.4 Routing Change

Under NIP-5D, the runtime's NUB dispatch sends `relay.*` messages to the relay-pool service by domain prefix match. The service is registered as `'relay'` or `'relay-pool'` — the key must match what `routeServiceMessage()` uses for domain lookup (`message.type.split('.')[0]` === `'relay'`). If using the key `'relay-pool'`, the service registration name does not match the `relay` domain prefix. Shells should register the relay pool service as `'relay'`:

```typescript
runtime.registerService('relay', createRelayPoolService(options));
// Not: runtime.registerService('relay-pool', ...)
```

---

### 2.5 Cache Service Migration

#### 2.5.1 Old Code Path

`createCacheService()` in `cache-service.ts` follows the same verb-dispatch pattern as relay-pool, but handles only `'REQ'` and `'EVENT'`:

- **REQ** (line 83): one-shot query — extracts `subId = message[1]`, `filters = message.slice(2)`, calls `options.query(filters)`, sends events + EOSE, no long-lived subscription
- **EVENT** (line 108): store — extracts `event = message[1]`, calls `options.store(event)` best-effort

Cache subscriptions are **one-shot** (query, deliver, EOSE, done) — no subscription tracking, no EOSE timer.

#### 2.5.2 New Message Shapes

Cache receives the same relay NUB envelopes as relay-pool (it is also a relay-tier implementation):

| Operation | Old Format | New Format |
|-----------|-----------|-----------|
| Query (subscribe) | `['REQ', subId, ...filters]` | `{type:'relay.subscribe', id:'uuid', subId:'uuid', filters:[...]}` |
| Store (publish) | `['EVENT', event]` | `{type:'relay.publish', id:'uuid', event:{...}}` |
| Event (out) | `send(['EVENT', subId, event])` | `send({type:'relay.event', subId:'uuid', event:{...}})` |
| EOSE (out) | `send(['EOSE', subId])` | `send({type:'relay.eose', subId:'uuid'})` |

#### 2.5.3 New Code Structure

```typescript
handleMessage(_windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
  if (message.type === 'relay.subscribe') {
    const subId = message.subId as string;
    const filters = message.filters as NostrFilter[];

    if (!options.isAvailable()) {
      send({ type: 'relay.eose', subId });
      return;
    }

    options.query(filters)
      .then((events) => {
        for (const event of events) send({ type: 'relay.event', subId, event });
        send({ type: 'relay.eose', subId });
      })
      .catch(() => {
        send({ type: 'relay.eose', subId }); // best-effort
      });
    return;
  }

  if (message.type === 'relay.publish') {
    const event = message.event as NostrEvent | undefined;
    if (event && typeof event === 'object' && options.isAvailable()) {
      try { options.store(event); } catch { /* best-effort */ }
    }
    return;
  }
}
```

#### 2.5.4 Routing Consideration

Cache service is typically registered as `'cache'` not `'relay'`. Under NIP-5D, the NUB domain prefix for relay operations is `'relay'` — so `routeServiceMessage()` looks for `services['relay']`. There are two valid patterns for combining relay pool and cache:

**Pattern A — Coordinated relay as single `'relay'` service** (recommended):
```typescript
runtime.registerService('relay', createCoordinatedRelay({ relayPool: myPool, cache: myCache }));
// coordinated-relay handles both sources internally, registered under 'relay' domain
```

**Pattern B — Separate services, runtime dispatches to both**:
```typescript
runtime.registerService('relay', createRelayPoolService(myPool));
runtime.registerService('cache', createCacheService(myCache));
// Requires runtime to dispatch relay.* messages to BOTH 'relay' and 'cache' handlers
// This needs additional routing logic in routeServiceMessage() — 'cache' does not match 'relay' domain
```

Pattern A is simpler and recommended. Pattern B requires the shell to add custom dispatch logic since the standard domain-prefix routing only delivers to one service per domain. If Pattern B is used, the cache service key must be changed to `'relay-cache'` and the routing logic extended, or the shell must manually fan out relay messages.

---

### 2.6 Coordinated Relay Service Migration

#### 2.6.1 Old Code Path

`createCoordinatedRelay()` in `coordinated-relay.ts` is a composite service. Its `handleMessage` (line 117) uses the same NIP-01 verb dispatch as relay-pool (`verb === 'REQ'`, `'CLOSE'`, `'EVENT'`), but coordinates two sources:

- **REQ**: queries cache first (async), then subscribes to relay pool; events deduplicated by `seenIds` Set; unified EOSE after both `cacheEose` and `relayEose` flags are set
- **CLOSE**: cancels relay pool subscription handle
- **EVENT**: publishes to relay pool and stores in cache

Internal state per subscription (keyed by `${windowId}:${subId}`) is tracked via `TrackedSub` interface: `seenIds`, `cacheEose`, `relayEose`, `eoseSent`, `eoseTimer`, `relayHandle`.

The `maybeSendEose()` helper (line 100) checks both flags and sends `['EOSE', subId]` once when both sources complete.

#### 2.6.2 New Code Structure

Target `handleMessage` switches on `message.type` while preserving the full dual-source coordination logic:

```typescript
handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
  if (message.type === 'relay.subscribe') {
    const subId = message.subId as string;
    const filters = message.filters as NostrFilter[];
    const subKey = `${windowId}:${subId}`;

    // Cancel existing subscription
    const existing = subs.get(subKey);
    if (existing) {
      existing.relayHandle?.unsubscribe();
      clearTimeout(existing.eoseTimer);
      subs.delete(subKey);
    }

    const cacheAvailable = options.cache.isAvailable();
    const relayAvailable = options.relayPool.isAvailable();

    if (!cacheAvailable && !relayAvailable) {
      send({ type: 'relay.eose', subId });
      return;
    }

    const tracked: TrackedSub = { seenIds: new Set(), cacheEose: !cacheAvailable,
      relayEose: !relayAvailable, eoseSent: false, eoseTimer: null, relayHandle: null };
    subs.set(subKey, tracked);

    function deliver(event: NostrEvent): void {
      if (tracked.seenIds.has(event.id)) return;
      tracked.seenIds.add(event.id);
      if (subs.has(subKey)) send({ type: 'relay.event', subId, event });
    }

    if (cacheAvailable) {
      options.cache.query(filters).then((events) => {
        for (const event of events) deliver(event);
        tracked.cacheEose = true;
        maybeSendEose(subKey, subId, send);
      }).catch(() => { tracked.cacheEose = true; maybeSendEose(subKey, subId, send); });
    }

    if (relayAvailable) {
      tracked.eoseTimer = setTimeout(() => {
        if (!tracked.eoseSent) { tracked.relayEose = true; maybeSendEose(subKey, subId, send); }
      }, timeoutMs);

      const relayUrls = options.relayPool.selectRelayTier(filters);
      tracked.relayHandle = options.relayPool.subscribe(filters, (item) => {
        if (item === 'EOSE') {
          clearTimeout(tracked.eoseTimer);
          tracked.relayEose = true;
          maybeSendEose(subKey, subId, send);
          return;
        }
        deliver(item);
        if (cacheAvailable) { try { options.cache.store(item); } catch { /* best-effort */ } }
      }, relayUrls);
    }
    return;
  }

  if (message.type === 'relay.close') {
    const subId = message.subId as string;
    const entry = subs.get(`${windowId}:${subId}`);
    if (entry) {
      entry.relayHandle?.unsubscribe();
      clearTimeout(entry.eoseTimer);
      subs.delete(`${windowId}:${subId}`);
    }
    return;
  }

  if (message.type === 'relay.publish') {
    const event = message.event as NostrEvent | undefined;
    if (!event || typeof event !== 'object') return;
    if (options.relayPool.isAvailable()) options.relayPool.publish(event);
    if (options.cache.isAvailable()) { try { options.cache.store(event); } catch { /* best-effort */ } }
    return;
  }
}
```

The `maybeSendEose()` helper also updates from array to envelope:

```typescript
function maybeSendEose(subKey: string, subId: string, send: (msg: NappletMessage) => void): void {
  const sub = subs.get(subKey);
  if (!sub || sub.eoseSent) return;
  if (sub.cacheEose && sub.relayEose) {
    sub.eoseSent = true;
    clearTimeout(sub.eoseTimer);
    send({ type: 'relay.eose', subId });  // was: send(['EOSE', subId])
  }
}
```

**What stays the same:**
- `TrackedSub` interface — unchanged (internal state only)
- `subs` Map keyed by `${windowId}:${subId}` — unchanged
- Dual-source coordination logic (cacheEose + relayEose flags, maybeSendEose) — unchanged
- Event deduplication by `seenIds` Set — unchanged
- EOSE fallback timer — unchanged
- Cache-on-relay-receive (line 194–196) — unchanged
- `onWindowDestroyed` cleanup — unchanged

#### 2.6.3 Note on Composition

`CoordinatedRelayOptions` wraps `RelayPoolServiceOptions` and `CacheServiceOptions` internally. These option interfaces are **unchanged** — they describe the underlying relay pool and cache implementations, not the wire format. The migration only affects the `ServiceHandler` entry point (`handleMessage` signature and verb routing) and the response format (the `send` callback).

Coordinated relay should be registered as `'relay'` so the NUB domain prefix lookup matches:

```typescript
runtime.registerService('relay', createCoordinatedRelay({ relayPool: myPool, cache: myCache }));
```

---

## 3. Migration Summary

### 3.1 File Impact Matrix

| File | Change Type | Notes |
|------|------------|-------|
| `packages/runtime/src/types.ts` | Interface update | `ServiceHandler.handleMessage` and `SendToNapplet` signatures change; breaks all six service implementations at compile time |
| `packages/runtime/src/service-dispatch.ts` | Rewrite | `routeServiceMessage()` routing changes from topic-prefix + event wrap to `message.type` domain prefix |
| `packages/services/src/signer-service.ts` | Full `handleMessage` rewrite | NUB-domain service; remove kind 29001 check, tag extraction, JSON.parse; switch on `message.type`; remove `BusKind` import |
| `packages/services/src/audio-service.ts` | Full `handleMessage` rewrite + helper removal | IFC-routed; remove `parseContent`, `extractTopic`, `createResponseEvent`; read from `message.topic` and `message.payload`; remove `BusKind` import |
| `packages/services/src/notification-service.ts` | Full `handleMessage` rewrite + helper removal | IFC-routed; same pattern as audio; `BusKind` import removed |
| `packages/services/src/relay-pool-service.ts` | Full `handleMessage` rewrite | Relay NUB service; replace verb string checks with `message.type`; replace array positional reads with flat field reads; update `send()` calls |
| `packages/services/src/cache-service.ts` | Full `handleMessage` rewrite | Relay NUB service; same pattern as relay-pool; one-shot query logic preserved |
| `packages/services/src/coordinated-relay.ts` | Full `handleMessage` rewrite | Composite relay NUB service; verb routing → type routing; update `send()` calls in `deliver()` and `maybeSendEose()`; internal coordination logic unchanged |

### 3.2 Migration Order

The recommended migration sequence minimizes broken states:

1. **Update `ServiceHandler` interface in `types.ts`** — changes `message: unknown[]` to `message: NappletMessage` and `send` callback type. This will break all six service implementations at compile time, making all remaining migrations visible.
2. **Update `service-dispatch.ts` routing** — change `routeServiceMessage()` signature and routing logic to accept NUB envelopes.
3. **Migrate `signer-service.ts`** — NUB-domain service, most complex (seven operations, consent gating). Migrate first because it is a standalone NUB domain with no IFC dependency.
4. **Migrate `audio-service.ts` and `notification-service.ts`** (parallel) — both are IFC-routed services with the same structural pattern. Can be migrated simultaneously.
5. **Migrate `relay-pool-service.ts` and `cache-service.ts`** (parallel) — both are relay NUB services with verb-to-type substitution. Can be migrated simultaneously.
6. **Migrate `coordinated-relay.ts`** — depends on `RelayPoolServiceOptions` and `CacheServiceOptions` (unchanged), but wraps the relay NUB pattern from steps 5. Migrate last to benefit from already-understood relay NUB patterns.

### 3.3 Testing Strategy

Existing tests in `packages/services/src/`:
- `signer-service.test.ts` — must be updated to send `NappletMessage` objects instead of `['EVENT', kind-29001-event]` arrays
- `notification-service.test.ts` — must be updated to send `{type:'ifc.emit', topic:'notifications:create', payload:{...}}` envelopes instead of `['EVENT', kind-29003-event]` arrays

The test structure (mock `send` callback, verify `send` was called with expected response, verify internal state changes) stays the same — only the message format changes. A pattern like:

```typescript
// Before
handler.handleMessage('win-1', ['EVENT', buildIpcEvent('notifications:create', { title: 'Hello' })], mockSend);
expect(mockSend).toHaveBeenCalledWith(['EVENT', '__shell__', expect.objectContaining({ kind: 29003 })]);

// After
handler.handleMessage('win-1', { type: 'ifc.emit', topic: 'notifications:create', payload: { title: 'Hello' } }, mockSend);
expect(mockSend).toHaveBeenCalledWith({ type: 'ifc.event', topic: 'notifications:created', payload: expect.objectContaining({ id: expect.any(String) }) });
```

Audio service has no dedicated test file — testing through integration or a new unit test file would cover the `register`, `unregister`, `state-changed`, and `mute` action paths. Relay pool and cache services also lack dedicated test files; the coordinated relay's dual-source dedup logic would benefit from direct unit tests.

After migration, the TypeScript compiler enforces message format correctness at the `handleMessage` call sites — mismatched formats that previously silently failed at runtime will now produce compile errors.

---

### 3.4 identitySource Guard for getPubkey() Calls

Any service handler that calls `sessionRegistry.getPubkey(windowId)` to retrieve the napplet's public key must check the `identitySource` discriminant before treating an empty string as an error.

**Context:** Under NIP-5D (RUNTIME-MIGRATION.md section 4.4 and 4.5), sessions with `identitySource: 'source'` intentionally have `pubkey === ''` — there is no AUTH keypair. `sessionRegistry.getPubkey(windowId)` returns `''` for these sessions, not `undefined`. Code that guards on `if (!pubkey)` or `if (pubkey === '')` will incorrectly reject valid NIP-5D sessions.

**Pattern to apply:**

```typescript
// Before (breaks for NIP-5D sessions)
const pubkey = sessionRegistry.getPubkey(windowId);
if (!pubkey) {
  send({ type: `${message.type}.error`, id: message.id as string, error: 'auth-required: not registered' });
  return;
}
// Use pubkey for ACL or response routing...

// After (checks identity source instead)
const session = sessionRegistry.getEntry(windowId);
if (!session) {
  send({ type: `${message.type}.error`, id: message.id as string, error: 'auth-required: not registered' });
  return;
}
// For NIP-5D sessions: session.identitySource === 'source', session.pubkey === ''
// For legacy AUTH sessions: session.identitySource === 'auth', session.pubkey is the derived keypair pubkey
const pubkey = session.pubkey; // '' for NIP-5D — do not error on empty string
```

**Where this applies:** Any service handler that retrieves and acts on the napplet's pubkey. The signer service (`signer-service.ts`) does not need this guard because signing operations use the shell's own signer (via `options.getSigner()`), not the napplet's pubkey. Service handlers that use the napplet's pubkey for access control or response routing must apply this guard.

**Reference:** See RUNTIME-MIGRATION.md section 4.7 for the full downstream package impact table, including the note that `@kehto/services` guard updates are required when service handlers check `identitySource`.
