# Phase 81: Runtime Container & Choke-Point Integration - Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 9 (3 create, 6 modify)
**Analogs found:** 8 / 9 (1 partial — consent-handler hoist + ConsentRequest union have no clean analog)

All paths below are absolute under `/home/sandwich/Develop/kehto`. Line numbers are verified against the current source on branch `milestone/v1.18-firewall`.

## File Classification

| New/Modified File | Op | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|----|------|-----------|----------------|---------------|
| `packages/runtime/src/firewall-state.ts` | CREATE | store (stateful container) | event-driven / transform | `packages/runtime/src/acl-state.ts` | exact |
| `packages/runtime/src/firewall-state.test.ts` | CREATE | test (unit) | request-response | `packages/runtime/src/acl-state.test.ts` | exact |
| `packages/runtime/src/firewall-dispatch.test.ts` | CREATE | test (integration) | event-driven | `packages/runtime/src/dispatch.test.ts` | exact |
| `packages/runtime/src/runtime.ts` | MODIFY | service (choke point + factory) | event-driven | self (mirror ACL path within same file) | exact (in-file precedent) |
| `packages/runtime/src/types.ts` | MODIFY | model (interfaces) | n/a | self (`AclPersistence`/`AclCheckEvent`/`ConsentRequest`) | exact + 1 novel (union extension) |
| `packages/runtime/src/enforce.ts` | READ-ONLY reuse | utility | transform | self (`resolveCapabilitiesNub`) | exact (reuse, no edit expected) |
| `packages/runtime/src/session-registry.ts` | READ-ONLY reuse | store | request-response | self (`getEntryByWindowId` + `registeredAt`) | exact (reuse, no edit expected) |
| `packages/runtime/src/index.ts` | MODIFY | config (barrel) | n/a | self (acl-state export block, lines 48-49) | exact |
| `packages/runtime/package.json` | MODIFY | config | n/a | self (`@kehto/acl` dep line 23) | exact |

> NOTE for planner: `enforce.ts` and `session-registry.ts` are listed as MODIFY in the scope prompt but research + source inspection show both already expose everything needed (`resolveCapabilitiesNub` returns `senderCap`; `getEntryByWindowId` + `registeredAt` exist). Treat them as **consume-by-reference**, not edit, unless a new accessor is genuinely required.

---

## Pattern Assignments

### `packages/runtime/src/firewall-state.ts` (store, mirror of acl-state.ts)

**Analog:** `/home/sandwich/Develop/kehto/packages/runtime/src/acl-state.ts` (full file, 219 lines)

This is a near-line-for-line mirror. Copy the structural skeleton: module-doc header, type-only imports from the pure package, value imports of pure functions, an exported container interface, an exported `createXState` factory holding `let`-bound state, and the imperative methods that reassign state on each mutation.

**Module header + import pattern** (acl-state.ts:1-18) — mirror exactly, swapping `@kehto/acl` → `@kehto/firewall`:
```typescript
/**
 * acl-state.ts — ACL state container with persistence hooks.
 *
 * Wraps @kehto/acl's pure functions with persistence via
 * AclPersistence. No localStorage or DOM references.
 */

import type { AclState, Identity } from '@kehto/acl';
import {
  createState, check, grant, revoke, block, unblock,
  serialize, deserialize, getQuota,
  ...
} from '@kehto/acl';
import type { AclPersistence, AclEntryExternal } from './types.js';
```
Firewall import surface to pull from `@kehto/firewall` (verified exports in `packages/firewall/src/index.ts:48-97`):
- **types:** `Observation, FirewallConfig, FirewallState, NappletPolicy, RateLimit, ContentMatcher, EvaluateResult` (import type)
- **values:** `evaluate, defaultConfig, createState, serialize, deserialize, setPolicy, setRateLimit, setGlobalRate, addMatcher`

**Container interface pattern** (acl-state.ts:90-103) — mirror as `FirewallStateContainer`:
```typescript
export interface AclStateContainer {
  check(...): boolean;
  grant(...): void;
  ...
  persist(): void;
  load(): void;
  clear(): void;
}
```

**Factory + `let`-bound mutable state** (acl-state.ts:119-123) — the core ownership pattern. Note `state` is reassigned on every mutation (pure functions return new state):
```typescript
export function createAclState(
  persistence: AclPersistence,
  defaultPolicy: 'permissive' | 'restrictive' = 'permissive',
): AclStateContainer {
  let state: AclState = createState(defaultPolicy);
  ...
```
For firewall, hold TWO `let` cells (CONTEXT RUNTIME-03: persisted config + ephemeral counters):
```typescript
let config: FirewallConfig = defaultConfig();
let counters: FirewallState = createState();
```

**Mutation-reassigns-state pattern** (acl-state.ts:137-141) — CRITICAL: each mutation does `state = mutate(state, ...)`. The firewall `evaluate` must reassign `counters = result.newState` (Pitfall 3 in research — without this, counters never advance and flood never escalates flag→block):
```typescript
grant(pubkey, dTag, aggregateHash, capability): void {
  const id = toIdentity(pubkey, dTag, aggregateHash);
  ensureRuntimeDefaultEntry(id);
  state = grant(state, id, capToBit(capability));   // ← reassign
},
```
Firewall `evaluate` shape (pure `EvaluateResult` carries `newState`, verified `packages/firewall/src/types.ts:220-226`):
```typescript
evaluate(observation: Observation): EvaluateResult {
  const result = evaluate(config, counters, observation);
  counters = result.newState;   // advance ephemeral state
  return result;
}
```

**Best-effort persist/load pattern** (acl-state.ts:197-216) — copy the try/catch verbatim. `persist` serializes CONFIG ONLY (never counters); `load` falls back to default on throw; `clear` resets and persists empty:
```typescript
persist(): void {
  try {
    persistence.persist(serialize(state));
  } catch { /* persistence is best-effort */ }
},

load(): void {
  try {
    const raw = persistence.load();
    if (!raw) return;
    state = deserialize(raw);
  } catch {
    state = createState(defaultPolicy);
  }
},

clear(): void {
  state = createState(defaultPolicy);
  try { persistence.persist(''); } catch { /* best-effort */ }
},
```
**Divergence from analog:** `persistence` is REQUIRED in `createAclState`. Research recommends `firewallPersistence` be OPTIONAL (`persistence?: FirewallPersistence`) so the 4 construction sites don't break — guard every call with `persistence?.persist(...)`. The `clear()` should also reset `counters = createState()` alongside `config = defaultConfig()`.

---

### `packages/runtime/src/firewall-state.test.ts` (test, unit)

**Analog:** `/home/sandwich/Develop/kehto/packages/runtime/src/acl-state.test.ts` (55 lines)

**Imports + persistence mock + describe pattern** (acl-state.test.ts:1-17) — mirror exactly:
```typescript
import { describe, expect, it } from 'vitest';
import { createAclState } from './acl-state.js';
import type { AclPersistence } from './types.js';

function makePersistence(initial: string | null = null): AclPersistence & { data: string | null } {
  return {
    data: initial,
    persist(data: string): void { this.data = data; },
    load(): string | null { return this.data; },
  };
}

describe('runtime ACL state', () => { ... });
```
For firewall: swap to `createFirewallState` / `FirewallPersistence`. The persist→reload assertion shape (acl-state.test.ts:30-37) is the template for RUNTIME-03 "config persists, counters reset":
```typescript
acl.persist();
const restored = createAclState(persistence, 'permissive');
restored.load();
expect(restored.check('', 'chat', 'hash', 'cvm:call')).toBe(true);
```
Firewall analog: set a policy, `persist()`, build a fresh container, `load()`, assert the policy survived but counters are fresh (a flood-triggering observation count starts at zero again).

---

### `packages/runtime/src/firewall-dispatch.test.ts` (test, integration — VERIFY-02)

**Analog:** `/home/sandwich/Develop/kehto/packages/runtime/src/dispatch.test.ts` (drives `handleMessage` end-to-end)

**Harness imports + setup pattern** (dispatch.test.ts:9-14, 35-38, 82-87):
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createRuntime } from './runtime.js';
import type { Runtime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry, findEnvelopeResponse } from './test-utils.js';
import type { MockRuntimeContext, SentMessage } from './test-utils.js';
import type { NappletMessage } from '@napplet/core';

beforeEach(() => {
  ctx = createMockRuntimeAdapter();
  runtime = createRuntime(ctx.hooks);
  runtime.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));
});
```

**Drive-and-assert pattern** (dispatch.test.ts:113-118) — fire envelopes through `handleMessage`, then locate the response by type via `findEnvelopeResponse`:
```typescript
runtime.handleMessage(WINDOW_ID, { type: 'relay.subscribe', subId: 'sub-1', filters: [] } as NappletMessage);
const eose = findEnvelopeResponse(ctx.sent, 'relay.eose');
expect(eose).toBeDefined();
```
For the firewall flood test, loop `handleMessage` ~200× with `relay.publish` envelopes and assert `findEnvelopeResponse(ctx.sent, 'relay.publish.error')` becomes defined once the budget exhausts (research Code Examples block). Use VOLUME-based assertions (assert the flag→reject transition appears), NOT exact token math — `now` is real `Date.now()` here (Pitfall 4).

**Harness facts (verified `test-utils.ts`):**
- `createMockRuntimeAdapter(overrides?)` (line 155) accepts `Partial<RuntimeAdapter>` — pass `{ onFirewallEvent, getFocusContext }` via overrides for the audit/focus tests. It currently sets `aclPersistence`, `onAclCheck` etc. (lines 174-180); since new hooks are OPTIONAL, the mock needs ZERO changes to keep existing tests green.
- `createNip5dSessionEntry(windowId, dTag, aggregateHash)` (line 216) sets `registeredAt: Date.now()` (line 224) — this is the init-time source for `initElapsedMs`.
- For `ask`/policy pre-set tests, the plan must expose a `runtime.firewallState` getter (mirror `runtime.aclState`, runtime.ts:246) so tests can `runtime.firewallState.setPolicy(dTag, 'ask')` before firing.

---

### `packages/runtime/src/runtime.ts` (service — choke point + factory) [MODIFY]

Three insertion sites, all with in-file precedent.

**(a) The choke-point gate** — `createMessageHandler` (runtime.ts:155-181). Insert the firewall gate AFTER the ACL success path, BEFORE `dispatchNubEnvelope`. The exact existing block to mirror for the firewall REJECT envelope is the ACL denial path (runtime.ts:166-179):
```typescript
const caps = resolveCapabilitiesNub(envelope);
if (caps.senderCap) {
  const result = enforceNub(windowId, caps.senderCap as Capability, envelope);
  if (!result.allowed) {
    const id = (envelope as NappletMessage & { id?: string }).id ?? '';
    const isStorageEnvelope = envelope.type.startsWith('storage.');
    const error = formatDenialReason(result.capability);
    const type = isStorageEnvelope ? `${envelope.type}.result` : `${envelope.type}.error`;
    hooks.sendToNapplet(windowId, { type, id, error } as NappletMessage);
    return;
  }
}

dispatchNubEnvelope(windowId, envelope);   // ← firewall gate goes immediately ABOVE this line
```
Reuse this EXACT envelope-shaping for firewall reject: storage → `${type}.result`, else → `${type}.error`, `error: 'firewall: <reason>'`. `caps.senderCap` is ALREADY computed at line 166 — pass it as the opClass source into the observation (no new mapping table). Per research, inject a single pre-built `firewallGate(windowId, envelope, caps.senderCap): 'dispatch' | 'drop'` closure (mirrors how `enforceNub` is injected) and keep `buildObservation` + `applyFirewallDecision` as module-level helpers (aislop structural-complexity gate — Phase 76 precedent).

**Signature to extend** (runtime.ts:155-159) — add the firewall gate dep:
```typescript
function createMessageHandler(
  hooks: RuntimeAdapter,
  enforceNub: ReturnType<typeof createNubEnforceGate>,
  dispatchNubEnvelope: (windowId: string, envelope: NappletMessage) => void,
  // + firewallGate / fireConsent injected here
): Runtime['handleMessage'] {
```

**(b) Container build site** — `createRuntime` (runtime.ts:264-320). Build the firewall container right beside `createAclState` (line 269), load it beside `aclState.load()` (line 309), and build the gate beside `enforceNub` (lines 287-297), then inject into `createMessageHandler` (line 320):
```typescript
const aclState = createAclState(hooks.aclPersistence);          // line 269 — mirror this
const manifestCache = createManifestCache(hooks.manifestPersistence);
...
const enforceNub = createNubEnforceGate({ ... });               // lines 287-297 — gate-build precedent
...
aclState.load();                                                 // line 309 — load precedent
...
const handleMessage = createMessageHandler(hooks, enforceNub, dispatchNubEnvelope);  // line 320 — inject
```
Add: `const firewallState = createFirewallState(hooks.firewallPersistence);` then `firewallState.load();`, build the gate, pass it to `createMessageHandler`. Also expose `get firewallState() { return firewallState; }` on the returned instance (mirror `get aclState()` at runtime.ts:246) and add `aclState`/`firewallState` to `RuntimeInstanceContext` (runtime.ts:98-110) + the `Runtime` interface (runtime.ts:85-86) + persist on destroy beside `aclState.persist()` (runtime.ts:211).

**(c) The consent-handler dead-end** ⚠ NOVEL — `createRuntimeInstance` (runtime.ts:196-222). The handler is stored but never reachable by the message handler:
```typescript
let consentHandler: ConsentHandler | null = null;
...
registerConsentHandler(handler: ConsentHandler): void {
  consentHandler = handler;
  void consentHandler;          // ← DEAD END: voided, never invoked anywhere
},
```
POLICY-02 must hoist this into a ref reachable by the firewall gate. The gate is built in `createRuntime` (outer scope) but `consentHandler` lives in `createRuntimeInstance` (a DIFFERENT closure that runs AFTER the gate is built at line 320). Fix: lift a shared mutable cell to `createRuntime` scope — e.g. `const consentHandlerRef: { current: ConsentHandler | null } = { current: null }` — have `registerConsentHandler` set `consentHandlerRef.current = handler`, and have the firewall gate read `consentHandlerRef.current`. This is the first real consumer of the consent mechanism in the repo — there is NO existing analog of a fired consent flow.

---

### `packages/runtime/src/types.ts` (model — interfaces) [MODIFY]

**`FirewallPersistence`** — exact mirror of `AclPersistence` (types.ts:165-172):
```typescript
/**
 * ACL persistence — runtime calls these to save/load ACL state.
 * Implementor decides storage backend (localStorage, file, DB, etc.).
 */
export interface AclPersistence {
  persist(data: string): void;
  load(): string | null;
}
```
→ Define `FirewallPersistence` with the identical two-method shape and matching JSDoc density.

**`FirewallEvent`** — analog `AclCheckEvent` (types.ts:33-50). Mirror the structure (identity/op + decision + optional `message?` + `reason`):
```typescript
export interface AclCheckEvent {
  identity: { pubkey: string; dTag: string; hash: string };
  capability: string;
  decision: 'allow' | 'deny';
  message?: unknown[] | NappletMessage;
  reason?: 'allowed' | 'capability-missing' | 'class-forbidden';
}
```
→ `FirewallEvent` carries `{ windowId, napplet, opClass, decision: Decision, action: Action, ruleId, reason: string, message?: NappletMessage }`. Reuse the firewall `Decision`/`Action` string-union types (re-export from `@kehto/firewall` or inline-mirror).

**Three new `RuntimeAdapter` hooks** — mirror `aclPersistence` (types.ts:626, REQUIRED) and `onAclCheck` (types.ts:663, OPTIONAL). Add inside `interface RuntimeAdapter` (opens at line 589):
```typescript
/** ACL persistence (save/load ACL state). */
aclPersistence: AclPersistence;          // line 626 — required precedent
...
/** Called on every ACL enforcement check (audit). */
onAclCheck?: (event: AclCheckEvent) => void;   // line 663 — optional precedent
```
→ Per research recommendation, make ALL THREE new hooks OPTIONAL (so `createMockRuntimeAdapter` + 2 shell sites + playground test need zero edits — Pitfall 5):
```typescript
firewallPersistence?: FirewallPersistence;
onFirewallEvent?: (event: FirewallEvent) => void;
getFocusContext?: (windowId: string) => { focused: boolean; msSinceFocusGain?: number };
```

**`ConsentRequest` union extension** ⚠ NOVEL — `ConsentRequest`/`ConsentHandler` (types.ts:306-318). No clean analog; the existing union discriminates on `type` but requires `event: NostrEvent`:
```typescript
export interface ConsentRequest {
  /** Consent type discriminator. Defaults to 'destructive-signing' if omitted. */
  type?: 'destructive-signing' | 'undeclared-service';
  windowId: string;
  pubkey: string;
  event: NostrEvent;                         // ← required; a firewall prompt has no real event
  resolve: (allowed: boolean) => void;
  serviceName?: string;                      // ← precedent: per-variant optional field
}
export type ConsentHandler = (request: ConsentRequest) => void;
```
→ Extend the `type` union with `'firewall-policy'` and relax `event` to optional (following the `serviceName?` per-variant pattern). Add an optional firewall-specific field (e.g. `napplet?: string`) for the dTag the choice is remembered against. This is the only edit to an EXISTING public interface this phase — flag as a public-API change (`ConsentRequest` is barrel-exported; update JSDoc).

---

### `packages/runtime/src/enforce.ts` (utility — opClass source) [REUSE, no edit expected]

**`resolveCapabilitiesNub` re-export** (enforce.ts:7): `export { resolveCapabilitiesNub } from '@kehto/acl';`

The return shape provides `senderCap` (the opClass source) — verified in `packages/acl/src/resolve.ts`:
```typescript
readonly senderCap: string | null;       // resolve.ts:47
// e.g. relay.publish → { senderCap: 'relay:write', recipientCap: 'relay:read' }   resolve.ts:62
//      identity.*    → { senderCap: 'identity:read', ... } / null for getPublicKey  resolve.ts:80-82
```
In the gate, `caps.senderCap` is ALREADY computed at runtime.ts:166 — derive `opClass = caps.senderCap ?? envelope.type`. No mapping table, no edit to this file.

---

### `packages/runtime/src/session-registry.ts` (store — windowId→dTag + init-time) [REUSE, no edit expected]

**`getEntryByWindowId`** (session-registry.ts:43, impl 113-115) returns the full `SessionEntry`:
```typescript
getEntryByWindowId(windowId: string): SessionEntry | undefined {
  return byWindowIdEntry.get(windowId);
}
```
- `napplet` (dTag) = `getEntryByWindowId(windowId)?.dTag` (`SessionEntry.dTag`, types.ts:407).
- **init-time** = `SessionEntry.registeredAt` (types.ts:409, `number`, set to `Date.now()` at registration — verified `createNip5dSessionEntry` test-utils.ts:224). Research A2 recommends reusing `registeredAt` directly for `initElapsedMs = now - entry.registeredAt` rather than a new map. Fall back to `now` (→ `initElapsedMs = 0`) when no entry. No edit needed.

---

### `packages/runtime/src/index.ts` (config — barrel) [MODIFY]

**Export-block analog** (index.ts:48-49, and type re-exports at :13, :28):
```typescript
export { createAclState } from './acl-state.js';
export type { AclStateContainer } from './acl-state.js';
```
→ Add a sibling block:
```typescript
export { createFirewallState } from './firewall-state.js';
export type { FirewallStateContainer } from './firewall-state.js';
```
And add the new public types to the existing `types.js` re-export group (alongside `AclPersistence` at line 13, `AclCheckEvent` at line 28): `FirewallPersistence`, `FirewallEvent` (and `Decision`/`Action` if not re-exported from `@kehto/firewall`).

---

### `packages/runtime/package.json` (config — workspace dep) [MODIFY]

**Dependency-line analog** (package.json:22-25):
```json
"dependencies": {
  "@kehto/acl": "workspace:*",
  "@noble/hashes": "^2.0.0",
  "@noble/curves": "^2.0.0"
},
```
→ Add `"@kehto/firewall": "workspace:*"` to `dependencies` (mirror the `@kehto/acl` line), then `pnpm install`. This is TASK ZERO — every firewall import fails to resolve until it lands (research Pitfall 1, finding #1).

---

## Shared Patterns

### Pure-package-wrapping container
**Source:** `packages/runtime/src/acl-state.ts:119-218`
**Apply to:** `firewall-state.ts`
Factory holds `let`-bound state, every mutation reassigns via the pure function's return, persist/load wrap a host-supplied `*Persistence` hook with best-effort try/catch. The single most important carry-over is `state = mutate(state, ...)` on EVERY call — for firewall, `counters = result.newState` after `evaluate` (Pitfall 3).

### Host-supplied persistence hook
**Source:** `types.ts:169-172` (`AclPersistence`) + wiring `runtime.ts:269` (`createAclState(hooks.aclPersistence)`) + `runtime.ts:211` (`aclState.persist()` on destroy)
**Apply to:** `FirewallPersistence` + `firewall-state.ts` + the `createRuntime`/`destroy` wiring. Make the hook OPTIONAL (divergence from acl, which is required) to keep all 4 construction sites green.

### ACL denial → error-envelope shaping
**Source:** `runtime.ts:166-179`
**Apply to:** firewall reject + prompt branches (storage → `.result`, else → `.error`; `error: 'firewall: <reason>'`; then `return` to drop).

### Injected-gate-closure built in `createRuntime`
**Source:** `runtime.ts:287-297` (`enforceNub` built) → `runtime.ts:320` (injected into `createMessageHandler`)
**Apply to:** a `firewallGate` closure built next to `enforceNub` and injected the same way — keeps `createMessageHandler` lean (aislop gate).

### `runtime.aclState` getter exposure
**Source:** `runtime.ts:86` (interface) + `runtime.ts:246` (`get aclState()`) + `runtime.ts:107`/`:331` (context wiring)
**Apply to:** a `runtime.firewallState` getter so integration tests can pre-set policy/rules.

### Integration test harness
**Source:** `dispatch.test.ts:9-14, 35-38, 113-118` + `test-utils.ts` (`createMockRuntimeAdapter` 155, `createNip5dSessionEntry` 216, `findEnvelopeResponse` 246)
**Apply to:** `firewall-dispatch.test.ts`. New optional hooks pass via `createMockRuntimeAdapter({ onFirewallEvent, getFocusContext })`; no harness edits needed beyond the `runtime.firewallState` getter.

---

## No Clean Analog Found (novel work — planner should treat as net-new)

| Concern | File | Role | Why no analog |
|---------|------|------|---------------|
| Consent-handler hoist (dead `void consentHandler` → reachable shared ref) | `runtime.ts:202, 219-222` | service | The handler is registered but NEVER invoked anywhere in the repo. POLICY-02 is the FIRST real firing of the consent mechanism. The gate (outer `createRuntime` scope) and the handler (inner `createRuntimeInstance` scope) live in different closures — requires lifting a `{ current }` ref to shared scope. No precedent for a fired consent flow. |
| `ConsentRequest` union extension (`'firewall-policy'` variant + optional `event`) | `types.ts:306-318` | model | Existing union requires `event: NostrEvent`; a firewall prompt has no real Nostr event. The `serviceName?` per-variant optional (line 314) is the closest STRUCTURAL hint, but no variant currently relaxes the required `event`. Only edit to an existing public interface this phase. Research A3 flags MEDIUM risk: decide between (a) optional `event` via discriminant or (b) a synthesized placeholder event. |
| `getFocusContext` hook contract (focus default `{ focused: true }`) | `types.ts` RuntimeAdapter | model | `onAclCheck` is the shape analog (optional audit callback), but a focus-context QUERY hook with a safe relax-only default is new. The shell-side `@kehto/wm` implementation is deferred (host concern). |

## Metadata

**Analog search scope:** `/home/sandwich/Develop/kehto/packages/runtime/src` (acl-state, runtime, types, enforce, session-registry, index, test-utils, dispatch.test, acl-state.test), `/home/sandwich/Develop/kehto/packages/firewall/src` (index, types), `/home/sandwich/Develop/kehto/packages/acl/src/resolve.ts`, `packages/runtime/package.json`.
**Files scanned:** 13
**Pattern extraction date:** 2026-06-15
