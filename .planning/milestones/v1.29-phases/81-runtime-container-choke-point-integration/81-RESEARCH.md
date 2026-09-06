# Phase 81: Runtime Container & Choke-Point Integration - Research

**Researched:** 2026-06-15
**Domain:** TypeScript runtime integration — wiring a pure decision engine (`@kehto/firewall`) into the `@kehto/runtime` message choke point, mirroring the existing `@kehto/acl` + `acl-state.ts` precedent.
**Confidence:** HIGH (all findings verified directly against the actual repo source this phase touches)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Integration point (RUNTIME-01)**
- Firewall gate runs in `createMessageHandler` (`packages/runtime/src/runtime.ts`) **immediately AFTER a successful ACL `enforceNub` check and BEFORE `dispatchNubEnvelope`**. Messages the ACL already rejected never reach the firewall (v1).
- On `reject`: send error envelope back (mirror ACL denial path — `hooks.sendToNapplet(windowId, { type, id, error })`) and DROP (return, no dispatch).
- On `pass` + action `flag`: emit `onFirewallEvent` (audit) then dispatch normally.
- On `pass` (action `ignore` or allow policy): dispatch normally.
- On `prompt` (`ask` policy): reject the current message AND fire the consent flow.

**Stateful container (RUNTIME-03)** — `packages/runtime/src/firewall-state.ts` wraps the pure `@kehto/firewall` engine, exactly mirroring how `acl-state.ts` wraps `@kehto/acl`. Holds immutable persisted `FirewallConfig` + mutable ephemeral counter state (`FirewallState`, reset on reload). Tracks per-window init timestamp (runtime-owned). Imperative API: `evaluate(observation)`, `setPolicy`, `setRateLimit`, `setGlobalRate`, `addMatcher`, `getConfig`, `persist`, `load`, `clear`. `persist`/`load` use the new `firewallPersistence` hook (config only — counters never persisted).

**New RuntimeAdapter hooks (RUNTIME-02)**
- `firewallPersistence` — `FirewallPersistence` interface mirroring `AclPersistence` (`persist(serialized: string): void; load(): string | null`). Required vs optional: planner decides; default behavior must not break existing hosts.
- `onFirewallEvent?: (event: FirewallEvent) => void` — optional audit callback, analogous to `onAclCheck`. Carries `{ napplet/windowId, opClass, decision, action, ruleId, reason, message? }`.
- `getFocusContext?: (windowId: string) => { focused: boolean; msSinceFocusGain?: number }` — optional; absent → default `{ focused: true }`.

**Observation extraction (RUNTIME-01)** — runtime helper builds normalized `Observation` from envelope + `windowId`: `napplet` = dTag from `sessionRegistry.getEntryByWindowId(windowId)`; `opClass` derived from `envelope.type` (reuse `resolveCapabilitiesNub` where possible); `kind`/`size` from publish-style payloads; `initElapsedMs = now - windowInitTime[windowId]`; `focused`/`msSinceFocusGain` from `hooks.getFocusContext(windowId)`; `now = Date.now()` (runtime owns the clock; pure engine never reads it). The pure engine never sees the envelope.

**Per-napplet policy (POLICY-01, POLICY-02)** — per-napplet policy keyed by dTag overrides rules, via `setPolicy`. On `prompt`: reject current message AND invoke the existing `ConsentHandler` (reuse `runtime.registerConsentHandler`; do NOT build a second consent mechanism). On resolve, persist as per-napplet policy (`setPolicy(dTag, 'allow'|'deny')`) via container + `firewallPersistence` so subsequent messages are NOT re-prompted. No message buffering — triggering message is dropped.

**Focus shell-side (FOCUS-01)** — never trust napplet self-report. Focus comes only from `hooks.getFocusContext(windowId)`, shell-implemented on `@kehto/wm`. Phase 81 defines + consumes the hook; the `@kehto/wm` implementation is the host's concern.

**Flagged-event still dispatches (RUNTIME-04)** — `flag` emits `onFirewallEvent` then dispatches; the message is NOT dropped.

**Tests (VERIFY-02)** — runtime integration tests (mirror `dispatch.test.ts`, `acl-state.test.ts`) covering each named attack through `handleMessage`: publish flood (flag → block), init-burst → block, backgrounded + init-burst → block (sharper), kind-5 delete spam → matcher action, ask → reject + consent fired + remembered (no re-prompt), unfocused-multiplier → tighter budget.

### Claude's Discretion

- Exact opClass mapping table from `envelope.type` (lean on `resolveCapabilitiesNub`).
- Whether `firewallPersistence` is required vs optional (pick the option that keeps existing hosts/tests green with least friction).
- Where window init-time is recorded (session registry entry creation vs a dedicated map in the container).

### Deferred Ideas (OUT OF SCOPE)

- Changeset + whole-repo unit + E2E green confirmation → **Phase 82**.
- Real WASM, ACL-denied-traffic observation, cross-napplet anomaly detection, management UI / playground demo → future milestones.
- The concrete `@kehto/wm`-based `getFocusContext` implementation in a real shell → host concern.
- Modifying `packages/firewall/` (the pure engine is done — consume by import only).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POLICY-01 | Per-napplet policy (`allow`/`deny`/`ask`) keyed by dTag overrides rate/burst/content rules | Engine already implements precedence (`evaluate.ts` Tier 1 policy override, verified). Container exposes `setPolicy(dTag, policy)`. |
| POLICY-02 | `ask` rejects current message + fires consent prompt + remembers choice (no buffering) | Reuse `ConsentRequest`/`ConsentHandler` already in `types.ts` + `runtime.registerConsentHandler`. **Landmine: consent handler is currently registered but NEVER invoked — Phase 81 wires the first real firing.** On resolve → `setPolicy(dTag, allowed ? 'allow' : 'deny')` + `firewallPersistence.persist`. |
| FOCUS-01 | Focus sourced shell-side via `getFocusContext(windowId)`, never napplet-reported | New optional hook on `RuntimeAdapter`; absent → `{ focused: true }`. Engine consumes `focused`/`msSinceFocusGain` on `Observation`. |
| RUNTIME-01 | Every ACL-passed message firewall-evaluated before dispatch; `reject` → error envelope + drop | Insertion point: inside `createMessageHandler`, after the `if (caps.senderCap) { ... }` block returns success, before `dispatchNubEnvelope(windowId, envelope)`. |
| RUNTIME-02 | New `RuntimeAdapter` hooks: `firewallPersistence`, `onFirewallEvent`, `getFocusContext` | Exact mirror shapes documented below (Architecture Patterns). |
| RUNTIME-03 | Firewall config persists across reloads; counters ephemeral | `firewall-state.ts` mirrors `acl-state.ts` load/persist; `createState()` rebuilds empty counters every load. |
| RUNTIME-04 | `flag` (allowed) op emits `onFirewallEvent` audit + still dispatches | Decision `pass` + action `flag` branch. |
| VERIFY-02 | Runtime integration tests for each named attack via `handleMessage` | Harness: `createMockRuntimeAdapter` + `createNip5dSessionEntry` + `createRuntime` + `findEnvelopeResponse`, mirroring `dispatch.test.ts`. Validation Architecture section maps each. |
</phase_requirements>

## Summary

This phase is a **pure integration job with a strong in-repo precedent**. The pure decision engine (`@kehto/firewall`, Phase 80) is complete and consumed by import only. Everything Phase 81 builds has an exact structural mirror already in the codebase: `firewall-state.ts` mirrors `acl-state.ts`; the choke-point gate mirrors the existing ACL denial path in `createMessageHandler`; the new adapter hooks mirror `aclPersistence` / `onAclCheck`; the Observation-extraction helper mirrors how `resolveCapabilitiesNub` already maps `envelope.type` → capability. The test harness (`test-utils.ts` + `createMockRuntimeAdapter`) already exists and drives `handleMessage` exactly the way VERIFY-02 needs.

Three findings change the plan materially and must be surfaced loudly:

1. **`@kehto/runtime` does NOT yet depend on `@kehto/firewall`.** `packages/runtime/package.json` lists only `@kehto/acl` (workspace), `@noble/hashes`, `@noble/curves`. The plan MUST add `"@kehto/firewall": "workspace:*"` to runtime dependencies and run `pnpm install` before any import resolves. This is task zero.

2. **The consent handler is currently a dead end.** `runtime.ts` registers it (`consentHandler = handler; void consentHandler;`) but no code path ever invokes it — POLICY-02's `ask` flow is the **first real consumer** of the consent mechanism in this repo. The plan must store the handler reference in a way the message handler can reach (it currently lives in a closure inside `createRuntimeInstance`, NOT in `createMessageHandler`). This requires either threading the consent-handler getter into `createMessageHandler`, or moving the firewall+consent firing into a small helper that both share. `ConsentRequest` requires a `NostrEvent` (`event` field) — for a firewall prompt there may be no real event; plan must decide what to pass (e.g., synthesize a minimal placeholder or extend `ConsentRequest` with a firewall discriminant — prefer the latter pattern, matching the existing `type: 'destructive-signing' | 'undeclared-service'` discriminated union).

3. **`firewallPersistence` should be OPTIONAL with a no-op default** (recommended — see Architecture decision below). Making it required breaks three construction sites and would force churn this phase wants to avoid.

**Primary recommendation:** Add `@kehto/firewall` as a workspace dep; build `firewall-state.ts` as a near-line-for-line mirror of `acl-state.ts`; make all three new hooks **optional** (so `createMockRuntimeAdapter` and the two shell sites need zero changes); extract two small helpers (`buildObservation` and `applyFirewallDecision`) out of `createMessageHandler` to keep it under the aislop structural-complexity gate; wire the consent firing through a shared helper that owns the `consentHandler` reference; mirror `dispatch.test.ts` for the six attack tests.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Firewall decision (rate/burst/content/policy) | `@kehto/firewall` (pure engine) | — | Already built Phase 80; consume by import. Pure, deterministic, no I/O. |
| Counter state ownership + persistence | `@kehto/runtime` (`firewall-state.ts`) | host (`firewallPersistence`) | Stateful container owns ephemeral counters + persisted config; host supplies storage backend, exactly like `acl-state.ts` + `aclPersistence`. |
| Observation extraction (envelope → Observation) | `@kehto/runtime` (helper in `runtime.ts`) | `@kehto/acl` (`resolveCapabilitiesNub` for opClass) | Runtime owns envelope parsing + the clock (`Date.now()`); pure engine never sees the envelope (CORE-02 boundary). |
| Choke-point gating | `@kehto/runtime` (`createMessageHandler`) | — | Single message choke point already enforces ACL here; firewall slots in right after. |
| Focus context | host shell (`@kehto/wm`) | `@kehto/runtime` (hook contract) | Forge-proof focus must be shell-owned; runtime only defines + consumes `getFocusContext`. |
| Consent prompt UX | host shell (`ConsentHandler`) | `@kehto/runtime` (fires the request) | Runtime fires the existing consent mechanism; shell renders UI and resolves. |
| Window init-time tracking | `@kehto/runtime` (`firewall-state.ts` map) | `sessionRegistry` (registration event) | Runtime-owned timestamp for `initElapsedMs`; recommend a dedicated map in the container keyed by windowId (see Open Questions). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@kehto/firewall` | `workspace:*` (local 0.1.0) | Pure decision engine — `evaluate`, config mutations, `defaultConfig`, `createState`, types | The Phase 80 deliverable; the entire subject of this integration. Zero deps, ESM-only. |
| `@kehto/acl` | `workspace:*` (already a dep) | Provides `resolveCapabilitiesNub` (re-exported via `enforce.ts`) for opClass derivation | Already the precedent and already imported. |
| `@napplet/core` | `^0.5.0` (peer) | `NappletMessage`, `NostrEvent` envelope types | Already a peer dep. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Required `firewallPersistence` | Optional `firewallPersistence` with no-op default | Required mirrors `aclPersistence` exactly, but breaks 3 construction sites (mock + 2 shell). Optional keeps all green this phase. **Recommend optional.** |
| Init-time map in container | Init-time field on `SessionEntry` | `SessionEntry.registeredAt` already exists (`Date.now()` at registration) — could reuse it directly instead of a new map. **Recommend reusing `registeredAt`** (see Open Questions). |

**Installation:**
```bash
# Add to packages/runtime/package.json "dependencies":
#   "@kehto/firewall": "workspace:*"
pnpm install
```

**Version verification:** `@kehto/firewall@0.1.0` exists in-workspace at `packages/firewall/package.json` `[VERIFIED: repo grep]`. It is NOT yet listed in `packages/runtime/package.json` dependencies `[VERIFIED: grep of runtime package.json]` — adding it is a required task.

## Package Legitimacy Audit

> No external (registry) packages are installed this phase. The only new dependency is the in-repo workspace package `@kehto/firewall`, already audited and shipped in Phase 80. slopcheck/registry verification is N/A for workspace-local packages.

| Package | Registry | Disposition |
|---------|----------|-------------|
| `@kehto/firewall` | workspace-local (not published yet) | Approved — in-repo Phase 80 deliverable, already test-covered (87 green tests). |

## Architecture Patterns

### System Architecture Diagram

```
napplet (sandboxed iframe)
        │  postMessage envelope { type, id, ... }
        ▼
runtime.handleMessage(windowId, msg)
        │
        ▼
createMessageHandler ───────────────────────────────────────────────┐
   1. envelope guard (typeof/'.' check)         [UNCHANGED]           │
   2. resolveCapabilitiesNub(envelope) → caps   [UNCHANGED]           │
   3. if caps.senderCap → enforceNub(...)        [UNCHANGED — ACL]    │
        │ allowed?                                                    │
        ├── NO ──► sendToNapplet(error envelope); return  [drop]      │
        │                                                             │
        ▼ YES                                                         │
   ┌─────────────── NEW: FIREWALL GATE ───────────────┐              │
   │ 4. obs = buildObservation(envelope, windowId, now)│              │
   │      napplet = sessionRegistry.getEntryByWindowId │              │
   │      opClass = opClassFor(envelope.type)          │              │
   │      kind/size = from envelope.event (publish)    │              │
   │      initElapsedMs = now - initTime[windowId]     │              │
   │      focused/msSinceFocusGain = getFocusContext   │              │
   │ 5. result = firewallState.evaluate(obs)           │──► @kehto/firewall.evaluate (PURE)
   │ 6. applyFirewallDecision(result):                 │              │
   │      'reject'  → sendToNapplet(error); return     │  [drop]      │
   │      'prompt'  → sendToNapplet(error);             │              │
   │                  fireConsent(dTag) async; return  │  [drop+ask]  │
   │      'pass'+flag → onFirewallEvent(audit) ↓       │              │
   │      'pass'+ignore → ↓                             │              │
   └───────────────────────────────────────────────────┘              │
        ▼                                                             │
   7. dispatchNubEnvelope(windowId, envelope)    [UNCHANGED]  ────────┘
        │
        ▼
   relay/identity/storage/... domain handlers
```

### Recommended File Structure
```
packages/runtime/src/
├── firewall-state.ts        # NEW — container mirroring acl-state.ts
├── firewall-state.test.ts   # NEW — container unit tests
├── firewall-dispatch.test.ts# NEW — VERIFY-02 integration tests (mirror dispatch.test.ts)
├── runtime.ts               # MODIFIED — build container in createRuntime; gate in createMessageHandler; 2 extracted helpers
├── types.ts                 # MODIFIED — FirewallPersistence, FirewallEvent, 3 new RuntimeAdapter hooks
└── index.ts                 # MODIFIED — barrel exports (createFirewallState, FirewallPersistence, FirewallEvent, FirewallStateContainer)
packages/runtime/package.json# MODIFIED — add "@kehto/firewall": "workspace:*"
```

### Pattern 1: Container mirror (`firewall-state.ts` from `acl-state.ts`)
**What:** A factory `createFirewallState(persistence)` holding `let config: FirewallConfig` (persisted) and `let state: FirewallState` (ephemeral), exposing an imperative API that wraps the pure functions.
**Example (mirror of `acl-state.ts:119-218`):**
```typescript
// packages/runtime/src/firewall-state.ts
import type { FirewallConfig, FirewallState, Observation, EvaluateResult, NappletPolicy, RateLimit, ContentMatcher } from '@kehto/firewall';
import { evaluate, defaultConfig, createState, serialize, deserialize, setPolicy, setRateLimit, setGlobalRate, addMatcher } from '@kehto/firewall';
import type { FirewallPersistence } from './types.js';

export interface FirewallStateContainer {
  evaluate(observation: Observation): EvaluateResult;   // advances counter state internally
  setPolicy(napplet: string, policy: NappletPolicy): void;
  setRateLimit(napplet: string, opClass: string, limit: RateLimit): void;
  setGlobalRate(napplet: string, limit: RateLimit): void;
  addMatcher(matcher: ContentMatcher): void;
  getConfig(): FirewallConfig;
  persist(): void;   // config only — NEVER counters
  load(): void;
  clear(): void;
}

export function createFirewallState(persistence?: FirewallPersistence): FirewallStateContainer {
  let config: FirewallConfig = defaultConfig();
  let counters: FirewallState = createState();
  return {
    evaluate(observation) {
      const result = evaluate(config, counters, observation);
      counters = result.newState;          // advance ephemeral state (like aclState mutating `state`)
      return result;
    },
    setPolicy(napplet, policy) { config = setPolicy(config, napplet, policy); },
    setRateLimit(napplet, opClass, limit) { config = setRateLimit(config, napplet, opClass, limit); },
    setGlobalRate(napplet, limit) { config = setGlobalRate(config, napplet, limit); },
    addMatcher(matcher) { config = addMatcher(config, matcher); },
    getConfig() { return config; },
    persist() { try { persistence?.persist(serialize(config)); } catch { /* best-effort, mirrors acl */ } },
    load() {
      try { const raw = persistence?.load(); if (!raw) return; config = deserialize(raw); }
      catch { config = defaultConfig(); }
    },
    clear() { config = defaultConfig(); counters = createState(); try { persistence?.persist(''); } catch { /* best-effort */ } },
  };
}
```
Note the `try/catch { /* best-effort */ }` on persist/load is copied verbatim from `acl-state.ts:197-211`. `deserialize` already never throws and falls back to `defaultConfig()` — but keep the catch to mirror the precedent exactly.

### Pattern 2: New adapter hook shapes (`types.ts`)
**What:** Mirror `AclPersistence` (`types.ts:169-172`) and `AclCheckEvent` (`types.ts:33-50`).
```typescript
// FirewallPersistence — exact mirror of AclPersistence
export interface FirewallPersistence {
  persist(data: string): void;
  load(): string | null;
}

// FirewallEvent — analogous to AclCheckEvent; carries firewall decision detail
export interface FirewallEvent {
  windowId: string;
  napplet: string;          // dTag
  opClass: string;
  decision: 'pass' | 'reject' | 'prompt';
  action: 'flag' | 'block' | 'ignore';
  ruleId: string;
  reason: string;
  message?: NappletMessage; // the triggering envelope, optional (mirror AclCheckEvent.message)
}

// Added to RuntimeAdapter (mirror aclPersistence / onAclCheck — but OPTIONAL, see decision):
firewallPersistence?: FirewallPersistence;
onFirewallEvent?: (event: FirewallEvent) => void;
getFocusContext?: (windowId: string) => { focused: boolean; msSinceFocusGain?: number };
```

### Pattern 3: opClass derivation (reuse `resolveCapabilitiesNub`)
**What:** Map `envelope.type` → `opClass`. The cleanest version-stable opClass is `senderCap` from `resolveCapabilitiesNub` (already imported into `runtime.ts` line 15, and `caps` is already computed at line 166). Reuse it directly — no new mapping table needed.
```typescript
// In buildObservation — caps is ALREADY computed at runtime.ts:166
function opClassFor(envelope: NappletMessage, senderCap: string | null): string {
  // Prefer the resolved sender capability (e.g. 'relay:write', 'outbox:write', 'state:write')
  // Fall back to the raw envelope.type when senderCap is null (e.g. identity.getPublicKey)
  return senderCap ?? envelope.type;
}
```
**Mapping examples (verified against `resolve.ts`):** `relay.publish` → `relay:write`; `relay.subscribe`/`query` → `relay:read`; `outbox.publish` → `outbox:write`; `outbox.query` → `outbox:read`; `storage.set` → `state:write`; `storage.get` → `state:read`; `cvm.request` → `cvm:call`; `notify.send` → `notify:send`. The CONTEXT example `intent.invoke → intent:invoke` is **not currently in `resolveCapabilitiesNub`** (intent is unmerged per MEMORY) → it falls through to `senderCap: null` and would use `envelope.type` as opClass. That is acceptable (opClass is opaque to the engine) but note it: the firewall keys on whatever string you pass, so consistency matters only for matching against configured rules.

### Pattern 4: kind / size extraction (publish-style payloads)
**What:** Publish envelopes carry `event?: NostrEvent` (verified in `relay-handler.ts:14` and `:194`). Extract `kind` directly and `size` as serialized byte length.
```typescript
function extractKindSize(envelope: NappletMessage): { kind?: number; size?: number } {
  const ev = (envelope as NappletMessage & { event?: { kind?: number } }).event;
  if (!ev || typeof ev !== 'object') return {};
  const kind = typeof ev.kind === 'number' ? ev.kind : undefined;
  let size: number | undefined;
  try { size = new TextEncoder().encode(JSON.stringify(ev)).length; } catch { size = undefined; }
  return { kind, size };
}
```
This covers `relay.publish`, `relay.publishEncrypted`, `outbox.publish`, `ifc.emit` (all carry `event`). kind-5 delete spam (CONTENT-03 / VERIFY-02) is detected because `event.kind === 5` surfaces in `obs.kind`.

### Pattern 5: Choke-point gate insertion (`createMessageHandler`)
**What:** Insert after the ACL success path (`runtime.ts:177`), before `dispatchNubEnvelope` (`runtime.ts:179`). Extract two helpers to satisfy the aislop structural-complexity gate.

The error-envelope shape to mirror is the existing ACL denial (`runtime.ts:170-174`): for storage envelopes the reply type is `${envelope.type}.result`; otherwise `${envelope.type}.error`. Reuse that exact branching for firewall reject. Signature change needed: `createMessageHandler` must additionally receive `firewallState`, `buildObservation` deps (`sessionRegistry`, `getFocusContext`, init-time source), and a consent-firing callback. Recommend passing a single `firewallGate` closure built in `createRuntime` (mirrors how `enforceNub` is pre-built and injected at `runtime.ts:320`).
```typescript
// Built in createRuntime, injected into createMessageHandler (like enforceNub):
const firewallGate = createFirewallGate({ firewallState, sessionRegistry, hooks, fireConsent });
// Inside createMessageHandler, after ACL passes, before dispatch:
const verdict = firewallGate(windowId, envelope, caps.senderCap);   // returns 'dispatch' | 'drop'
if (verdict === 'drop') return;
dispatchNubEnvelope(windowId, envelope);
```
Keeping `buildObservation` + `applyFirewallDecision` as named module-level functions (not inline in the handler) is what keeps the handler readable — Phase 76 decomposed `runtime.ts` for exactly this reason (per CONTEXT specifics).

### Pattern 6: Consent firing (POLICY-02) — the new wiring
**What:** On `prompt`, send the reject envelope, then invoke the registered `ConsentHandler`. **The consent handler currently lives in a closure in `createRuntimeInstance` (`runtime.ts:202`) and is never called.** Plan must expose it to the firewall gate. Cleanest: store it in a mutable cell (e.g. `let consentHandler` at `createRuntime` scope, or a `{ current: ConsentHandler | null }` ref) shared between `registerConsentHandler` and the firewall gate.

`ConsentRequest` requires `windowId`, `pubkey`, `event: NostrEvent`, `resolve`. For a firewall prompt, recommend extending the existing discriminated union (`type?: 'destructive-signing' | 'undeclared-service'`) with `'firewall-policy'` and making `event` tolerant (the existing union already keys behavior on `type`). On resolve:
```typescript
fireConsent(windowId, dTag): void {
  const handler = consentHandlerRef.current;
  if (!handler) return;   // no handler → message already dropped, nothing more to do
  handler({
    type: 'firewall-policy', windowId, pubkey: '',
    event: /* minimal placeholder NostrEvent or make optional via union */,
    resolve: (allowed) => {
      firewallState.setPolicy(dTag, allowed ? 'allow' : 'deny');
      firewallState.persist();   // remember the choice (POLICY-02)
    },
  });
}
```

### Anti-Patterns to Avoid
- **Re-deriving rate/burst logic in the runtime.** The engine owns all decisions; the runtime only builds the Observation and acts on the verdict. Don't inspect `result.action` to reimplement budgets.
- **Persisting counters.** `firewallState.persist()` serializes config ONLY. Counters reset on reload by design (RUNTIME-03).
- **Inflating `createMessageHandler`.** Extract `buildObservation` + `applyFirewallDecision`/`createFirewallGate` as named functions. The aislop gate (`npx aislop scan`, must stay 100 — see STATE.md quick tasks) penalizes a bloated handler.
- **Building a second consent mechanism.** Reuse `ConsentHandler`/`registerConsentHandler` (POLICY-02 explicit).
- **Trusting napplet-reported focus.** Only `hooks.getFocusContext`; absent → `{ focused: true }`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate/burst/content/policy decisions | Custom token bucket in runtime | `@kehto/firewall.evaluate` | Already built, tested (87 tests), pure, WASM-ready. |
| opClass mapping table | New `type→opClass` switch | `resolveCapabilitiesNub` (`caps.senderCap`, already computed) | Already maps all 13 domains, version-stable, single source of truth. |
| Config serialization/validation | Custom JSON guard | `serialize`/`deserialize` from `@kehto/firewall` | `deserialize` is defensive (never throws, falls back to `defaultConfig`) — T-80-01 mitigation. |
| Consent prompt plumbing | New prompt channel | `ConsentRequest`/`ConsentHandler` + `registerConsentHandler` | Exists; POLICY-02 mandates reuse. |
| Persistence backend | localStorage in runtime | `firewallPersistence` hook | Runtime is environment-agnostic (no DOM); host owns storage, mirroring `aclPersistence`. |
| Error-envelope shaping | New error format | Mirror `runtime.ts:170-174` (storage→`.result`, else→`.error`) | Consistency with the ACL denial path napplets already handle. |

## Runtime State Inventory

> This is a code-integration phase (no rename/migration), but it introduces new runtime state. Documented for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Persisted `FirewallConfig` JSON via `firewallPersistence` (host-supplied backend; e.g. localStorage key like `kehto:firewall`). **New** — no existing data to migrate. | Code only — host wires the backend. |
| Live service config | None — firewall config is created from `defaultConfig()` on first run; no external service holds it. | None. |
| OS-registered state | None. | None — verified (browser/Node runtime only). |
| Secrets/env vars | None — firewall config is non-secret. | None. |
| Build artifacts | `packages/runtime` must rebuild after adding the `@kehto/firewall` dep; `pnpm install` updates the workspace symlink + lockfile. | Run `pnpm install` then `pnpm build`. |

**Ephemeral (never persisted):** `FirewallState` counters + per-window init-time map — reset on every reload by design (RUNTIME-03).

## Common Pitfalls

### Pitfall 1: Missing workspace dependency
**What goes wrong:** `import ... from '@kehto/firewall'` fails to resolve; type-check/build errors.
**Why:** `@kehto/runtime` does not currently list `@kehto/firewall` as a dependency (verified).
**How to avoid:** Add `"@kehto/firewall": "workspace:*"` to `packages/runtime/package.json` dependencies and run `pnpm install` as the FIRST task.
**Warning signs:** TS2307 "Cannot find module '@kehto/firewall'".

### Pitfall 2: Consent handler never reaches the message handler
**What goes wrong:** `ask` policy rejects the message but no prompt fires; POLICY-02 silently half-works.
**Why:** `consentHandler` lives in a closure in `createRuntimeInstance`, isolated from `createMessageHandler`. It is currently `void`-ed (never invoked anywhere).
**How to avoid:** Hoist the handler into a shared mutable ref accessible to both `registerConsentHandler` and the firewall gate (built in `createRuntime`).
**Warning signs:** `ask` test rejects the message but `consentHandler` is never called.

### Pitfall 3: Counter state not advancing between messages
**What goes wrong:** Rate/burst never escalates; flood test stays at `flag` forever, never reaching `block`.
**Why:** `evaluate` is pure and returns `newState`; if the container doesn't reassign `counters = result.newState`, every call starts fresh.
**How to avoid:** In `firewall-state.ts` `evaluate()`, assign `counters = result.newState` before returning (mirrors how `acl-state.ts` reassigns `state` on every mutation).
**Warning signs:** Publish-flood test never transitions flag→block.

### Pitfall 4: `now` injected inconsistently in tests
**What goes wrong:** Time-based rate/burst tests are flaky because `Date.now()` advances unpredictably.
**Why:** The runtime injects `now = Date.now()` into the Observation. Pure-core tests (Phase 80) inject a controlled `now`; integration tests through `handleMessage` cannot.
**How to avoid:** For VERIFY-02, drive volume (many messages in a tight loop) rather than asserting exact timing; assert the *transition* (flag→block) and that `reject` envelopes appear, not precise token counts. Burst tests fire >`maxOps` (20) within the init window naturally in a loop. If finer control is needed, the plan may inject a clock — but prefer volume-based assertions to avoid coupling to wall-clock.
**Warning signs:** Intermittent CI failures on rate tests.

### Pitfall 5: Breaking the three RuntimeAdapter construction sites
**What goes wrong:** Adding a *required* hook breaks `createMockRuntimeAdapter`, `hooks-adapter.ts`, and the playground test → red suite.
**Why:** Three sites construct `RuntimeAdapter` object literals (verified below).
**How to avoid:** Make all three new hooks **optional**. Then zero existing sites need changes; `createFirewallState(undefined)` falls back to in-memory config with no persistence (safe).
**Warning signs:** TS2741 "Property 'firewallPersistence' is missing".

## Backward-Compat Landmines (every `RuntimeAdapter` construction site)

| Site | File | Breaks if hook is required? | Note |
|------|------|-----------------------------|------|
| Test mock | `packages/runtime/src/test-utils.ts:164` (`createMockRuntimeAdapter`) | YES | Drives ALL runtime `*.test.ts`. If `firewallPersistence` required → every runtime test red. |
| Shell adapter | `packages/shell/src/hooks-adapter.ts:362` (`adaptHooks`) | YES | The production browser shell. Currently sets `aclPersistence` at line 371; would need a `firewallPersistence` sibling. |
| Shell bridge | `packages/shell/src/shell-bridge.ts:191` (`createRuntime(runtimeHooks)`) | Indirectly | Consumes `adaptHooks` output; inherits the above. Also where `registerConsentHandler` is forwarded (`:259`). |
| Playground test | `tests/unit/playground-relay-service.test.ts:122` | Depends | Wraps `createMockRuntimeAdapter` via a local `createRuntime` helper; inherits mock behavior. |

**Recommendation:** Make `firewallPersistence`, `onFirewallEvent`, `getFocusContext` all OPTIONAL → **zero** changes required at any of these four sites, and the 819-test root suite + E2E stay green (Phase 82 gate). The shell may later add a real `firewallPersistence` + `getFocusContext` (`@kehto/wm`) wiring, but that is the host's concern (deferred per CONTEXT).

## Code Examples

### Building the Observation (the runtime-side boundary)
```typescript
// Source: synthesized from acl-state.ts + resolve.ts + relay-handler.ts (verified shapes)
function buildObservation(
  envelope: NappletMessage,
  windowId: string,
  senderCap: string | null,
  sessionRegistry: SessionRegistry,
  initTimeFor: (windowId: string) => number,
  getFocusContext?: (windowId: string) => { focused: boolean; msSinceFocusGain?: number },
): Observation {
  const entry = sessionRegistry.getEntryByWindowId(windowId);
  const napplet = entry?.dTag ?? '';
  const now = Date.now();                          // runtime owns the clock
  const focus = getFocusContext?.(windowId) ?? { focused: true };  // safe default
  const { kind, size } = extractKindSize(envelope);
  return {
    napplet,
    opClass: senderCap ?? envelope.type,
    kind, size,
    initElapsedMs: now - initTimeFor(windowId),
    focused: focus.focused,
    msSinceFocusGain: focus.msSinceFocusGain,
    now,
  };
}
```

### Integration test skeleton (mirror `dispatch.test.ts`)
```typescript
// Source: dispatch.test.ts:31-118 + acl-state.test.ts pattern (verified harness)
import { describe, it, expect, beforeEach } from 'vitest';
import { createRuntime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry, findEnvelopeResponse } from './test-utils.js';
import type { NappletMessage } from '@napplet/core';

describe('firewall integration — publish flood', () => {
  it('escalates flag → block as the budget exhausts', () => {
    const mock = createMockRuntimeAdapter();           // onFirewallEvent can be supplied via overrides
    const runtime = createRuntime(mock.hooks);
    runtime.sessionRegistry.register('w1', createNip5dSessionEntry('w1', 'flooder', 'a'.repeat(64)));
    const ev = { kind: 1, content: 'x', tags: [], created_at: 0, id: '0'.repeat(64), pubkey: '0'.repeat(64), sig: '0'.repeat(128) };
    for (let i = 0; i < 200; i++) {
      runtime.handleMessage('w1', { type: 'relay.publish', id: `p${i}`, event: ev } as NappletMessage);
    }
    // assert at least one relay.publish.error (firewall reject) appears once budget exhausts
    expect(findEnvelopeResponse(mock.sent, 'relay.publish.error')).toBeDefined();
  });
});
```
For the `ask` test: supply `getFocusContext`/`onFirewallEvent` via `createMockRuntimeAdapter({ onFirewallEvent: ... })`, pre-set policy via the runtime's firewall container (expose `runtime.firewallState` getter mirroring `runtime.aclState`), register a consent handler that records the request + calls `resolve(true)`, then assert the first message was rejected, the handler fired, and a subsequent message dispatches (no re-prompt).

## State of the Art

Not applicable — this is an internal integration following an established in-repo pattern (`@kehto/acl`). No external library state-of-the-art is relevant; the engine is purpose-built and already shipped.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 (`[VERIFIED: runtime package.json devDependencies]`) |
| Config file | Workspace-level (runtime tests run via `vitest`; root suite = 819 tests) |
| Quick run command | `pnpm --filter @kehto/runtime test` (or `vitest run packages/runtime/src/firewall-dispatch.test.ts`) |
| Full suite command | `pnpm test` (root — 819 tests must stay green; enforced Phase 82) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RUNTIME-01 | ACL-passed msg evaluated; reject → error envelope + drop | integration | `vitest run packages/runtime/src/firewall-dispatch.test.ts -t "reject drops"` | ❌ Wave 0 |
| RUNTIME-04 | flag → onFirewallEvent fired + still dispatches | integration | `... -t "flag dispatches and audits"` | ❌ Wave 0 |
| VERIFY-02 (flood) | publish flood: flag → block | integration | `... -t "publish flood"` | ❌ Wave 0 |
| VERIFY-02 (burst) | init-burst → block | integration | `... -t "init-burst block"` | ❌ Wave 0 |
| VERIFY-02 (bg burst) | unfocused + init-burst → block (sharper) | integration | `... -t "backgrounded init-burst"` | ❌ Wave 0 |
| VERIFY-02 (delete) | kind-5 delete spam → matcher action | integration | `... -t "kind-5 delete spam"` | ❌ Wave 0 |
| POLICY-02 (ask) | ask → reject + consent fired + remembered (no re-prompt) | integration | `... -t "ask reject prompt remember"` | ❌ Wave 0 |
| FOCUS-01 / FOCUS-02 | unfocused-multiplier tightens budget vs focused | integration | `... -t "unfocused multiplier"` | ❌ Wave 0 |
| RUNTIME-02/03 | container persist/load config; counters reset | unit | `vitest run packages/runtime/src/firewall-state.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @kehto/runtime test`
- **Per wave merge:** `pnpm test` (root suite — confirm no regression in the existing 819)
- **Phase gate:** Full root suite green before `/gsd:verify-work` (whole-repo + E2E green is formally Phase 82, but keep green here).

### Wave 0 Gaps
- [ ] `packages/runtime/package.json` — add `@kehto/firewall` workspace dep + `pnpm install` (blocks all imports).
- [ ] `packages/runtime/src/firewall-state.test.ts` — container persist/load/counter-reset (RUNTIME-03).
- [ ] `packages/runtime/src/firewall-dispatch.test.ts` — six attack scenarios + flag/reject envelope assertions (VERIFY-02).
- [ ] Test harness extension: expose `runtime.firewallState` getter (mirror `runtime.aclState`) so tests can pre-set policy/rules. No new framework install needed — Vitest + `test-utils.ts` already cover the harness.

## Security Domain

> `security_enforcement` config not located in `.planning/config.json` lookup scope; treating as enabled and including the relevant subset. This phase is internal protocol enforcement, not network-facing.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | The firewall IS an access/abuse-control gate. Runs AFTER ACL (defense in depth). Decisions come from the verified pure engine; runtime must not bypass `reject`. |
| V5 Input Validation | yes | `deserialize` (config) is already defensive (never throws, defaults on malformed — T-80-01). Observation extraction must tolerate malformed envelopes (guard `envelope.event` shape before reading `kind`/`size`). |
| V6 Cryptography | no | No crypto introduced this phase. |
| V2/V3 Auth/Session | partial | Identity is resolved via `sessionRegistry.getEntryByWindowId` (existing, trusted). Firewall never trusts napplet self-report (focus, identity). |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Napplet floods relay/publish ops | Denial of Service | Token-bucket rate limit (engine) → reject + drop at choke point. |
| Init-burst flood on load | Denial of Service | Burst guard defaults to `block` (engine, BURST-02). |
| Backgrounded napplet abuse | Denial of Service | `unfocusedMultiplier` tightens budget; focus is shell-owned/forge-proof (FOCUS-01). |
| kind-5 delete spam | Tampering | Content matcher on `kind===5` → block (CONTENT-03). |
| Napplet forging "I'm focused" to relax limits | Spoofing | Focus NEVER self-reported — only `getFocusContext` (shell/`@kehto/wm`). Absent → `{ focused: true }` (relax-only; cannot tighten via forgery). |
| Poisoned persisted firewall config | Tampering | `deserialize` validates + falls back to `defaultConfig()` (engine, never throws). |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Making the three new hooks OPTIONAL is the right call (vs required to mirror `aclPersistence`) | Architecture / Backward-compat | LOW — optional is strictly safer; if the team prefers required-mirror, only the 3 construction sites need a one-line addition each. Planner should confirm. |
| A2 | Reusing `SessionEntry.registeredAt` for `initElapsedMs` is acceptable vs a dedicated init-time map | Open Questions | LOW — `registeredAt = Date.now()` at registration (verified in `createNip5dSessionEntry`). Equivalent to a separate map; avoids new state. But if "window init" semantically differs from "session registration," a dedicated map is cleaner. Planner picks. |
| A3 | Extending `ConsentRequest` with `type: 'firewall-policy'` + tolerant `event` is the cleanest consent wiring | Pattern 6 | MEDIUM — the existing union requires `event: NostrEvent`; a firewall prompt has no real event. Options: (a) add discriminant + make `event` optional via union, (b) synthesize a placeholder event. Planner must decide and may need to touch `ConsentRequest` type. |
| A4 | Volume-based (not clock-injected) assertions are sufficient for VERIFY-02 timing | Pitfall 4 / Validation | MEDIUM — if a test needs exact token math, the plan may need to inject a clock into `buildObservation`. Recommend volume-based first; escalate only if flaky. |
| A5 | `opClass = senderCap ?? envelope.type` is the intended derivation | Pattern 3 | LOW — CONTEXT says "reuse `resolveCapabilitiesNub` where possible"; `senderCap` is exactly that. Confirmed `caps` is already computed at the gate. |

## Open Questions

1. **`firewallPersistence` required vs optional?**
   - What we know: 3 construction sites build `RuntimeAdapter` (mock + 2 shell); `aclPersistence` is required and all sites provide it.
   - What's unclear: whether the team values exact mirror-of-acl over zero-churn.
   - Recommendation: **OPTIONAL** (zero changes to existing sites, suite stays green; container handles `undefined` gracefully). CONTEXT explicitly permits "optional if cleaner for host migration."

2. **Where is window init-time recorded?**
   - What we know: `SessionEntry.registeredAt` already stores `Date.now()` at registration (verified). A dedicated map in `firewall-state.ts` is the CONTEXT alternative.
   - Recommendation: **Reuse `registeredAt`** via `sessionRegistry.getEntryByWindowId(windowId).registeredAt` — no new state, and registration ≈ window init for NIP-5D (identity is registered at iframe creation). Fall back to `now` (→ `initElapsedMs = 0`) if no entry. If the team wants init distinct from registration, add a `Map<windowId, number>` in the container set on first observation.

3. **`ConsentRequest.event` for a firewall prompt?**
   - What we know: `event: NostrEvent` is currently required; the union already discriminates on `type`.
   - Recommendation: add `'firewall-policy'` to the `type` union and relax `event` (optional when `type === 'firewall-policy'`). This touches `types.ts` `ConsentRequest` and is the only type-surface change to an existing public interface — flag it in the plan as a public-API edit (JSDoc + barrel already export `ConsentRequest`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm | workspace install of `@kehto/firewall` dep | ✓ (repo uses pnpm workspaces) | — | none needed |
| Vitest | running new tests | ✓ | 4.1.2 | none needed |
| `@kehto/firewall` (workspace) | all firewall imports | ✓ (in repo, Phase 80) | 0.1.0 | none — must add as runtime dep |

**Missing dependencies with no fallback:** None — `@kehto/firewall` exists in-workspace; only the `package.json` dependency line + `pnpm install` are needed.

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **ESM-only** (no CJS output) — new files use `import ... from './x.js'` extensions (verbatimModuleSyntax).
- **Zero framework deps** — `@kehto/firewall` is zero-dep; do not pull anything new.
- **TypeScript strict + `verbatimModuleSyntax`** — `import type { ... }` for type-only imports (see `acl-state.ts` precedent).
- **2-space indent, lowercase-hyphen filenames** (`firewall-state.ts`), PascalCase types, UPPER_SNAKE_CASE constants.
- **JSDoc on all public API exports** (`@param`, `@returns`, `@example`) — `createFirewallState`, `FirewallPersistence`, `FirewallEvent`, `FirewallStateContainer`, and the new `RuntimeAdapter` hooks all need JSDoc matching the `acl-state.ts` / `types.ts` density.
- **aislop structural-complexity gate** — `npx aislop scan` must stay 100 (STATE.md quick task `260611-2ut`). Keep `createMessageHandler` lean; extract `buildObservation` + `applyFirewallDecision`/`createFirewallGate`. Phase 76 decomposed `runtime.ts` for this reason.
- **GSD workflow** — edits go through a GSD command (execute-phase), not ad-hoc.
- **No direct main push** — work on the milestone branch (`milestone/v1.18-firewall`, current), PR to merge.

## Sources

### Primary (HIGH confidence — read directly this session)
- `packages/firewall/src/{index,types,config,defaults,evaluate}.ts` — pure engine surface (exports, `Observation`, `FirewallConfig`, `FirewallState`, `evaluate`, mutations, defaults).
- `packages/runtime/src/runtime.ts` — `createMessageHandler` (gate insertion point, ACL denial path lines 166-180), `createRuntime` (container build site lines 264-335), consent handler dead-end (lines 202, 219-222).
- `packages/runtime/src/acl-state.ts` — the container pattern to mirror (factory, persist/load best-effort try/catch, imperative API).
- `packages/runtime/src/types.ts` — `RuntimeAdapter` (589), `AclPersistence` (169), `ConsentRequest`/`ConsentHandler` (306-318), `AclCheckEvent` (33).
- `packages/runtime/src/enforce.ts` + `packages/acl/src/resolve.ts` — `resolveCapabilitiesNub` opClass derivation (all 13 domains).
- `packages/runtime/src/session-registry.ts` — `getEntryByWindowId` (windowId → dTag); `SessionEntry.registeredAt` for init-time.
- `packages/runtime/src/test-utils.ts` + `dispatch.test.ts` + `acl-state.test.ts` — VERIFY-02 harness (`createMockRuntimeAdapter`, `createNip5dSessionEntry`, `findEnvelopeResponse`).
- `packages/runtime/src/relay-handler.ts` — publish payload `event?: NostrEvent` (kind/size source).
- `packages/runtime/package.json` — confirmed `@kehto/firewall` is NOT yet a dependency.
- `packages/shell/src/hooks-adapter.ts` + `shell-bridge.ts` — backward-compat construction sites.
- `.planning/phases/81-.../81-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — locked decisions + requirement IDs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every type/export verified by reading the actual files.
- Architecture (gate, container, hooks): HIGH — direct mirror of existing, read precedents.
- Backward-compat: HIGH — all 4 construction sites located via grep and inspected.
- Consent wiring (POLICY-02): MEDIUM — the path is new (handler currently un-invoked); the exact `ConsentRequest.event` handling is a planner decision (A3).
- Test timing strategy: MEDIUM — volume-based assertions recommended; clock injection is a fallback (A4).

**Research date:** 2026-06-15
**Valid until:** 2026-07-15 (stable — internal integration; only changes if `runtime.ts`/`types.ts` are refactored before planning).
