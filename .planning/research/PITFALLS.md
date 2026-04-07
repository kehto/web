# Pitfalls Research

**Domain:** Protocol runtime migration — NIP-01 wire format to NIP-5D JSON envelope
**Researched:** 2026-04-07
**Confidence:** HIGH (based on direct code analysis of both specs and all four kehto packages)

---

## Critical Pitfalls

### Pitfall 1: Treating the Wire Format Change as a Minor Rename

**What goes wrong:**
The migration is framed as "relatively superficial," which is accurate for the napplet SDK side (@napplet already migrated). However, @kehto/runtime and @kehto/shell still speak full NIP-01 array wire format (`["REQ", subId, filter]`, `["EVENT", subId, event]`, `["AUTH", challenge]`, etc.) throughout their internals. The new NIP-5D spec replaces ALL of this with JSON envelope objects `{ type: "domain.action", ...payload }`. These are not the same shape, not the same type system, and not the same dispatch model.

Treating it as a rename ("just change the constant names") misses that the entire framing changes: from verb-based array dispatch to domain-prefix object dispatch.

**Why it happens:**
`@kehto/runtime.handleMessage()` receives `unknown[]` (arrays). The new shell-side consumers (@napplet/shim, @napplet/sdk) now send JSON objects. The mismatch is invisible at the TypeScript boundary because both sides are typed loosely at the postMessage layer. Tests that mock the old array format will pass even when the runtime is not handling the new format.

**How to avoid:**
Before writing migration code, document the wire format at the boundary for each package. Identify which packages are *sending* old format and which need to *receive* new format. The key boundary is `ShellBridge.handleMessage(event: MessageEvent)` — the `event.data` arriving there from @napplet/shim is now `{ type: string, ...payload }`, not `["VERB", ...]`.

**Warning signs:**
- The `dispatchVerb()` function in runtime.ts switches on `msg[0]` (the first array element). If msg is a JSON envelope object, `msg[0]` is `undefined` and all messages silently fall through.
- Tests pass because they still send the old array format directly to `handleMessage()`.

**Phase to address:**
Gap analysis phase — before any migration code is written, establish the exact boundary contract for each package.

---

### Pitfall 2: Keeping the NIP-42 AUTH Handshake When NIP-5D Eliminates It

**What goes wrong:**
The old RUNTIME-SPEC has an elaborate three-phase handshake: REGISTER → IDENTITY → AUTH challenge → AUTH response → OK. This includes Schnorr signature verification (kind 22242), delegated keypair derivation via HMAC-SHA256, shell secret persistence, challenge/response matching, and a pre-AUTH message queue.

NIP-5D v0.1.0 eliminates the handshake entirely. Identity is assigned by the shell at iframe creation time from the NIP-5A manifest. `MessageEvent.source` is the unforgeable identity — no negotiation required. The REGISTER, IDENTITY, AUTH verbs are all legacy and deprecated in `@napplet/core/legacy.ts`.

If the runtime still requires AUTH before accepting messages, napplets using the new @napplet/shim (which no longer sends REGISTER or AUTH) will have every message silently dropped by the pre-AUTH queue.

**Why it happens:**
The runtime's `dispatchVerb()` checks for `authInFlight` status and queues messages in `pendingAuthQueue`. Without AUTH completing, legitimate napplet messages are queued forever. @napplet/shim no longer triggers the AUTH flow — it sends JSON envelope objects immediately. The two systems are incompatible without explicit migration.

**How to avoid:**
The migration path for @kehto/runtime is to remove the AUTH gating model and replace it with identity-at-creation binding. On the new model, identity is injected by `ShellBridge` at iframe creation via `originRegistry.register(window, windowId, { dTag, aggregateHash })` — before any messages arrive. There is no handshake to wait for.

The `pendingChallenges`, `authInFlight`, `pendingAuthQueue`, and `pendingRegistrations` maps in runtime.ts become dead code after migration. Remove them rather than leaving them in place as they create confusion about whether AUTH is still expected.

**Warning signs:**
- Any code path that checks `!isAuthenticated(windowId)` before handling a message is a sign AUTH gating is still active.
- `sendChallenge()` still exists on the `Runtime` and `ShellBridge` interfaces post-migration.
- `VERB_REGISTER`, `VERB_IDENTITY`, and `AUTH_KIND` are still imported from `@napplet/core` in non-legacy code.

**Phase to address:**
@kehto/runtime migration phase — this is the largest single change in the migration.

---

### Pitfall 3: Window.napplet Interface Optionality Mismatch Between Shell and Napplet

**What goes wrong:**
NIP-5D declares that almost all `window.napplet` sub-interfaces are optional from the shell's perspective. The shell implements only the NUBs it supports; napplets MUST `window.napplet.shell.supports('relay')` before using relay operations.

@napplet/shim installs `window.napplet` globally with all sub-objects always present (relay, ipc, services, storage, shell). These sub-objects call the shell over postMessage. If the shell does not handle a NUB domain, the request is silently dropped (per spec: "Messages with an unrecognized type MUST be silently ignored").

The pitfall is @kehto/runtime and @kehto/shell implementing their NUB handlers without advertising support. @napplet/shim's `window.napplet.shell.supports()` currently returns `false` for everything (see `// TODO: Shell populates supported capabilities at iframe creation` in shim/src/index.ts). If @kehto/shell does not inject capability declarations into each iframe at creation time, napplets cannot know what the shell supports.

**Why it happens:**
The `supports()` stub returns `false` unconditionally. The spec says "Shells MUST implement `window.napplet.shell.supports()`" but the mechanism for populating this at iframe creation is not yet defined in @kehto/shell. There is no message type for the shell to push its capability set to the napplet on load.

**How to avoid:**
@kehto/shell must inject a list of supported NUBs/capabilities when it creates each iframe. One approach: before injecting @napplet/shim (or alongside it), post a capability handoff message `{ type: "shell.capabilities", supports: ["relay", "signer", "storage", "ifc"] }` to the iframe. @napplet/shim must handle this message and store it so `supports()` returns correct values.

Verify this by checking `window.napplet.shell.supports('relay')` in a napplet after initialization and asserting it returns `true` when the shell has relay support registered.

**Warning signs:**
- `window.napplet.shell.supports()` returns `false` in tests for any capability that the shell implements.
- Integration tests that skip the supports() check and call relay/signer/storage directly, masking the real runtime behavior.

**Phase to address:**
@kehto/shell migration phase — must be addressed before integration testing.

---

### Pitfall 4: ACL Composite Key Includes Pubkey That No Longer Exists in NIP-5D

**What goes wrong:**
The old RUNTIME-SPEC ACL persistence format (Section 13.8, explicitly "LOCKED") keys entries on `"<pubkey>:<dTag>:<aggregateHash>"`. The `pubkey` is the napplet's delegated AUTH key from the IDENTITY message.

NIP-5D has no IDENTITY, no delegated keypair, and no AUTH. Identity is `(dTag, aggregateHash)` only. There is no napplet pubkey.

The `@kehto/acl` package uses `Identity { pubkey, dTag, hash }`. The composite key in `acl-store.ts` is `pubkey:dTag:aggregateHash`. If migration removes the AUTH handshake but does not update the ACL key scheme, the ACL module either breaks or requires a placeholder pubkey (empty string, zeros) that changes the persistence format.

**Why it happens:**
The ACL module was designed around the pubkey-keyed identity model. The types.ts `Identity` interface requires all three fields. The old spec marked the persistence format as LOCKED, implying implementations depend on it. But the new spec's identity model makes pubkey irrelevant.

**How to avoid:**
In the gap analysis, explicitly resolve: does @kehto/acl need to support the old `pubkey:dTag:hash` composite key for data migration, or does NIP-5D define a new `dTag:hash` composite key as canonical? If existing persisted ACL data must migrate, write a one-time migration that strips the pubkey prefix. If this is a fresh-start migration, update the composite key format to `dTag:aggregateHash` and update the @kehto/acl types to remove `pubkey` from `Identity`.

**Warning signs:**
- `aclStore.ts` composite key still includes pubkey after migration.
- `Identity` interface in @kehto/acl still has `pubkey` field after AUTH handshake removal.
- ACL entries silently reset on first load of migrated shell (pubkey is always different, so ACL never finds existing entries).

**Phase to address:**
@kehto/acl migration phase — must be addressed first since @kehto/runtime and @kehto/shell depend on the ACL module.

---

### Pitfall 5: ServiceHandler Interface Uses Old NIP-01 Array Format

**What goes wrong:**
`ServiceHandler.handleMessage(windowId, message, send)` receives `unknown[]` (NIP-01 array format) and sends via `send(msg: unknown[])`. This was designed for the old protocol where service messages arrived as `["EVENT", event]` arrays and responses were `["OK", id, true, ""]` arrays.

In NIP-5D, service messages arrive as JSON envelope objects `{ type: "audio.register", ... }` and responses should be JSON envelope objects. @kehto/services (audio, notifications) implement ServiceHandler with the old array interface. After migration, they will receive objects but be coded to destructure arrays, silently failing.

**Why it happens:**
@kehto/services was built against the old RUNTIME-SPEC. The ServiceHandler interface in runtime/types.ts has `message: unknown[]` and `send: (msg: unknown[]) => void`. No TypeScript error occurs at the call site because the incoming message is `unknown[]` — but after wire format migration, the actual data is a JSON envelope object, not an array.

**How to avoid:**
When migrating @kehto/runtime's message dispatch, update the ServiceHandler interface to receive `NappletMessage` (JSON envelope object) rather than `unknown[]`. Update @kehto/services implementations accordingly. Update `routeServiceMessage()` in service-dispatch.ts to route by `msg.type` domain prefix instead of array topic string.

**Warning signs:**
- `service-dispatch.ts` extracts a topic from `event.tags` (NIP-01 tag array) post-migration.
- Audio manager in services package still uses `shell:audio-register` topic strings with IPC_PEER events.
- Any service handler that does `const [verb, ...rest] = message` post-migration.

**Phase to address:**
@kehto/services migration phase — address after @kehto/runtime migration establishes the new ServiceHandler interface.

---

### Pitfall 6: StorageProxy Still Uses Kind-29003 IPC_PEER Events

**What goes wrong:**
The old storage proxy (RUNTIME-SPEC Section 5) uses kind 29003 IPC_PEER events with topic strings like `shell:state-get`, `shell:state-set`, `napplet:state-response`. These are NIP-01 array messages `["EVENT", event]` where the event has `kind: 29003`.

@napplet/shim's `state-shim.ts` now sends `{ type: "storage.get", id, key }` JSON envelope messages and expects `{ type: "storage.get.result", id, value }` responses. The old @kehto/runtime `handleStateRequest()` in state-handler.ts still listens for the old kind-29003 format. After migration, storage requests are silently dropped.

**Why it happens:**
The storage handler in runtime.ts checks `if (event.kind === BusKind.IPC_PEER)` and then routes by topic tag. The shim no longer sends this format. The handler never fires.

**How to avoid:**
Replace `handleStateRequest()` in @kehto/runtime with a NUB handler that processes `storage.*` JSON envelope messages. Map the existing storage operations (get, set, remove, keys) to the new `{ type: "storage.get", id, key }` → `{ type: "storage.get.result", id, value }` envelope shape defined by @napplet/nub-storage.

**Warning signs:**
- `state-handler.ts` imports `BusKind.IPC_PEER` after migration.
- Storage integration test passes when sending old array format but fails with the new @napplet/shim.
- `shell:state-get` topic string still appears in runtime code after migration.

**Phase to address:**
@kehto/runtime migration phase (storage sub-task) — part of the broader NIP-01 → envelope dispatch migration.

---

### Pitfall 7: SignerProxy Still Uses Kind-29001/29002 Events

**What goes wrong:**
The old signer proxy (RUNTIME-SPEC Section 4) uses kind 29001 SIGNER_REQUEST and kind 29002 SIGNER_RESPONSE events in NIP-01 array format. @napplet/shim now sends `{ type: "signer.signEvent", id, event }` JSON envelope messages and expects `{ type: "signer.signEvent.result", id, event }` responses from the shell.

@kehto/runtime's signer handling routes on `event.kind === BusKind.SIGNER_REQUEST`. After migration, signer requests arrive as envelope objects, are not recognized as array messages, and signing is silently unavailable.

**Why it happens:**
`@napplet/core` marks `BusKind.SIGNER_REQUEST`, `BusKind.SIGNER_RESPONSE` as deprecated in `legacy.ts`. But @kehto/runtime still imports from these constants in `runtime.ts`. The old format check `event.kind === BusKind.SIGNER_REQUEST` never matches the new envelope format.

**How to avoid:**
Replace signer dispatch in @kehto/runtime with a NUB handler for `signer.*` messages. Use @napplet/nub-signer types for the message shapes. Map each `signer.getPublicKey`, `signer.signEvent`, `signer.nip04.encrypt` etc. to the existing signer adapter calls.

**Warning signs:**
- `BusKind.SIGNER_REQUEST` imported in non-legacy runtime code after migration.
- `window.nostr.getPublicKey()` hangs (no response from shell) in integration tests.
- Signer result timeout fires in 30 seconds during tests.

**Phase to address:**
@kehto/runtime migration phase (signer sub-task).

---

### Pitfall 8: IFC/IPC Handler Mismatch — Old IPC_PEER vs New ifc.* Envelope

**What goes wrong:**
Inter-napplet communication (old Section 8.5: IPC-PEER Events) uses kind 29003 with `["t", "topic"]` tags. `@napplet/shim` now sends `{ type: "ifc.emit", topic, payload }` and subscribes via `{ type: "ifc.subscribe", id, topic }`.

@kehto/runtime's IPC routing in `event-buffer.ts` checks `event.kind === BusKind.IPC_PEER` and routes by topic tag. After migration, IFC messages are not recognized as IPC_PEER events and napplet-to-napplet messaging silently breaks.

**Why it happens:**
The IFC NUB (`@napplet/nub-ifc`) is a new addition alongside the wire format change. There is no direct equivalent in the old RUNTIME-SPEC — the old system used free-form topics on kind 29003. The new system is typed and has explicit subscribe/unsubscribe lifecycle.

**How to avoid:**
Add an IFC NUB handler to @kehto/runtime that:
1. Handles `ifc.subscribe` — registers a per-window per-topic subscription.
2. Handles `ifc.emit` — routes to all windows subscribed to that topic (excluding sender).
3. Handles `ifc.unsubscribe` — deregisters the subscription.
4. Delivers received events as `{ type: "ifc.event", topic, payload, sender }` back to subscribers.

**Warning signs:**
- `@napplet/nub-ifc` is not imported or referenced anywhere in @kehto/runtime or @kehto/shell after migration.
- IPC tests that relied on kind 29003 still pass while ifc.emit/on tests fail.

**Phase to address:**
@kehto/runtime migration phase (IFC sub-task).

---

### Pitfall 9: Missing Sandbox Token Change (allow-scripts Only)

**What goes wrong:**
The old RUNTIME-SPEC (Section 1.2) requires:

    sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"

NIP-5D v0.1.0 requires:

    sandbox="allow-scripts"

Only `allow-scripts` is required. Additional tokens (`allow-forms`, `allow-popups`, etc.) are at shell discretion based on shell policy.

This is a behavioral change: a napplet expecting `allow-forms` or `allow-popups` will silently fail if the shell switches to the minimal `allow-scripts` sandbox. The migration doc for @kehto/shell should explicitly call this out so the shell host knows to audit which tokens existing napplets depend on before tightening the sandbox.

**Why it happens:**
The old spec included extra tokens by default. The new spec takes a minimal approach. Shell hosts copying the old sandbox attribute will be more permissive than the spec requires, but napplets built against the more permissive sandbox may not degrade gracefully.

**How to avoid:**
The @kehto/shell migration document should flag the sandbox change explicitly. Do not silently tighten the sandbox without testing each napplet type against the minimal token set. `window.napplet.shell.supports('popups')` and similar queries allow napplets to probe the sandbox at runtime — this only works if the shell also implements the popups check.

**Warning signs:**
- Form-submitting napplets stop working after shell migration.
- Popup-dependent napplets (share links, OAuth flows) break silently.
- Integration tests do not test with the minimal `allow-scripts` sandbox.

**Phase to address:**
@kehto/shell migration phase — audit sandbox policy change.

---

### Pitfall 10: Legacy Constants Still Exported and Consumed by Migrated Code

**What goes wrong:**
`@napplet/core` puts deprecated constants in `legacy.ts`: `BusKind`, `AUTH_KIND`, `VERB_REGISTER`, `VERB_IDENTITY`, `DESTRUCTIVE_KINDS`. These are currently re-exported from `@kehto/shell/src/types.ts` via:

    export { ALL_CAPABILITIES, BusKind, AUTH_KIND, SHELL_BRIDGE_URI, PROTOCOL_VERSION, REPLAY_WINDOW_SECONDS, DESTRUCTIVE_KINDS } from '@napplet/core';

After migration, code that imports these from `@kehto/shell` instead of `@napplet/core/legacy` will compile fine (the exports still exist) but be using deprecated constants to drive logic that should no longer exist.

**Why it happens:**
TypeScript has no deprecation enforcement at import resolution. The `@deprecated` JSDoc tags are informational. Developers importing `BusKind` from `@kehto/shell` won't receive compile errors even after the constants are moved to legacy status.

**How to avoid:**
In each package's migration document, list which legacy constants are being removed from its public API. Add a build-time lint rule or comment to flag imports of legacy constants in non-legacy files. In @kehto/shell, stop re-exporting `BusKind`, `AUTH_KIND`, `VERB_REGISTER`, `VERB_IDENTITY` from the public API after the runtime migration is complete.

**Warning signs:**
- `BusKind` imported outside of legacy migration code.
- `AUTH_KIND` appears in runtime.ts after AUTH removal.
- `DESTRUCTIVE_KINDS` imported from `@kehto/shell` rather than `@napplet/nub-signer` where it now lives.

**Phase to address:**
Post-migration cleanup phase for each package.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep `handleMessage(unknown[])` and detect both formats | No breaking change to ShellBridge callers | Dual-format dispatch adds complexity; tests must cover both paths; format detection is fragile | Only during a bridge period if incremental migration is necessary |
| Use empty string as placeholder pubkey in ACL key | No ACL module changes needed | ACL entries are invisible — `"": dTag:hash` composite keys don't match `pubkey:dTag:hash` entries; persisted ACL data is abandoned | Never — choose either full migration or explicit format bump |
| Delay NUBS sandbox annotation (`window.napplet.shell.supports` always returns false) | No shell-side capability injection work | Napplets that guard on supports() never activate capabilities; those that don't guard break on absent capabilities | Only in early integration; must be addressed before napplets ship |
| Leave service handlers using NIP-01 array interface internally | Services continue to work on old format | New NUB-typed service messages are not routable; @kehto/services must eventually be rewritten | Never — accept the ServiceHandler interface change upfront |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| @kehto/runtime ↔ @napplet/shim | Runtime expects `["REQ", subId, filter]` arrays; shim now sends `{ type: "relay.subscribe", id, filters }` objects | Update `handleMessage()` to route by `msg.type` domain prefix instead of `msg[0]` verb string |
| @kehto/shell ↔ @napplet/shim | ShellBridge.handleMessage receives MessageEvent; dispatches `event.data` to runtime; runtime still expects arrays | ShellBridge must unwrap and dispatch JSON envelope objects, not arrays |
| @kehto/acl ↔ @kehto/runtime post-migration | ACL lookup uses `pubkey:dTag:hash` composite key; post-migration identity has no pubkey | Update composite key to `dTag:aggregateHash`; provide migration utility for existing localStorage ACL data |
| @kehto/services ↔ @kehto/runtime | ServiceHandler.handleMessage receives old NIP-01 arrays; after migration receives envelope objects | Update ServiceHandler interface signature; rewrite audio and notification handlers to process envelope messages |
| @kehto/shell ↔ NIP-5D identity injection | Shell must map iframe Window → (dTag, aggregateHash) at creation; not after any message | Register identity in originRegistry before the iframe loads, using NIP-5A manifest data |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Pre-AUTH message queue never drains | Memory grows indefinitely; napplet messages piled up with no auth ever completing | Remove the auth queue entirely when migrating to the no-handshake model; messages are valid immediately after identity registration | Immediately post-migration if queue is not removed |
| Dual-format dispatch in ShellBridge | Every message checked twice (old array path and new envelope path) | Do not run both paths in parallel; commit to one format at the ShellBridge boundary | Not a performance cliff, but adds latency and test surface area |
| ServiceRegistry iterated for every message to find topic match | Scales with number of services × message volume | Use a map from domain prefix to handler instead of linear search by topic string | At 10+ services with high message volume |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Removing AUTH without replacing with identity-at-creation binding | Any iframe (not created by the shell) can send messages and have them routed | originRegistry.register() must be called before messages are accepted; messages from unregistered sources MUST be silently dropped — this is the only security boundary in NIP-5D |
| Sending delegated privkeys after migration | Old IDENTITY message sends the napplet's private key over postMessage; NIP-5D eliminates this | Remove IDENTITY message sending from ShellBridge; do not introduce any new message type that sends key material |
| Accepting messages from `event.origin === '*'` | NIP-5D explicitly says origin is meaningless for opaque-origin iframes; authenticate by MessageEvent.source only | Origin registry must use the Window reference (event.source), never the origin string |
| Forgetting to drop messages from unknown sources after AUTH removal | Without handshake gating, a race exists where a crafted iframe can send messages before identity registration completes | Register identity synchronously at iframe creation (before the iframe URL loads) so there is no window where messages arrive from an unregistered source |

---

## "Looks Done But Isn't" Checklist

- [ ] **Wire format migration:** Verify that @kehto/runtime.handleMessage receives `{ type: string }` objects and routes by domain prefix — not `["VERB", ...]` arrays routed by `msg[0]`
- [ ] **Auth removal:** Verify that `pendingAuthQueue`, `pendingChallenges`, `authInFlight`, and `pendingRegistrations` are removed from runtime.ts — not just unused
- [ ] **ACL composite key:** Verify that the ACL store uses `dTag:aggregateHash` as composite key — not `pubkey:dTag:aggregateHash`
- [ ] **window.napplet.shell.supports():** Verify that `supports('relay')` returns `true` in a napplet iframe when the shell has relay support — not the `false` stub
- [ ] **Storage proxy:** Verify that `window.napplet.storage.getItem()` completes successfully with the migrated shell — not a silent timeout
- [ ] **Service discovery:** Verify that `window.napplet.services.list()` returns registered services from @kehto/services — with JSON envelope-based service discovery (not old kind-29010 REQ/EVENT flow if that changes)
- [ ] **Sandbox tokens:** Verify that the demo and integration tests run with `allow-scripts` only sandbox before declaring the shell migration complete
- [ ] **Legacy constant removal:** Verify no imports of `BusKind`, `AUTH_KIND`, `VERB_REGISTER`, `VERB_IDENTITY` outside of explicitly marked legacy/migration code

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wire format mismatch discovered in integration | MEDIUM | Add format detection at ShellBridge boundary; dispatch both formats; migrate incrementally by NUB domain |
| ACL data abandoned after composite key change | LOW | Write a migration utility that reads old `pubkey:dTag:hash` keys from localStorage and re-writes as `dTag:hash`; run once on first shell load after migration |
| AUTH queue deadlock (napplet messages never processed) | HIGH | Remove `authInFlight` gating; make identity registration synchronous at iframe creation via originRegistry |
| supports() always false causes napplets to silently degrade | MEDIUM | Add capability injection message from shell to napplet during iframe initialization; shim stores the set and returns from it in supports() |
| Services unreachable after ServiceHandler interface change | MEDIUM | Provide a compatibility shim in @kehto/services that wraps the old array-based handlers and translates to/from the new envelope interface |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Wire format treated as minor rename | Gap analysis (before migration) | Document exact message shape at ShellBridge boundary for each NUB domain |
| AUTH gating not removed | @kehto/runtime migration | Runtime unit tests pass with no REGISTER/AUTH messages sent; `sendChallenge()` removed from Runtime interface |
| window.napplet.shell.supports() always false | @kehto/shell migration | Integration test asserts `supports('relay')` returns true in napplet iframe |
| ACL composite key includes orphaned pubkey | @kehto/acl migration (first) | ACL unit tests use `dTag:hash` composite keys; no pubkey in Identity type |
| ServiceHandler on old array interface | @kehto/services migration | Audio/notification handlers process `{ type: "audio.register" }` envelope objects |
| Storage proxy on kind-29003 | @kehto/runtime migration | `window.napplet.storage.getItem()` round-trips in integration test without kind-29003 events |
| Signer proxy on kind-29001/29002 | @kehto/runtime migration | `window.nostr.signEvent()` completes successfully in integration test |
| IFC handler on kind-29003 IPC_PEER | @kehto/runtime migration | `window.napplet.ipc.emit()` and `on()` round-trip between two napplet iframes |
| Sandbox token regression | @kehto/shell migration | Demo integration test runs with `allow-scripts` only; no form/popup-dependent napplets break |
| Legacy constants still active post-migration | Post-migration cleanup | No imports of `BusKind`, `AUTH_KIND`, `VERB_REGISTER` outside of `legacy.ts` or explicit migration utilities |

---

## Sources

- Direct analysis: `/home/sandwich/Develop/kehto/napplet/specs/NIP-5D.md` (current spec, confirmed 2026-04-07)
- Direct analysis: `/home/sandwich/Develop/kehto/RUNTIME-SPEC.md` (previous spec, Sections 1-15)
- Direct analysis: `packages/runtime/src/runtime.ts` — current dispatch model (verb-based array)
- Direct analysis: `packages/runtime/src/types.ts` — ServiceHandler, RuntimeAdapter interfaces
- Direct analysis: `packages/shell/src/shell-bridge.ts`, `types.ts` — current ShellAdapter and ShellBridge
- Direct analysis: `packages/acl/src/types.ts` — Identity composite key model
- Direct analysis: `napplet/packages/core/src/legacy.ts` — deprecated BusKind, AUTH_KIND, VERB_REGISTER
- Direct analysis: `napplet/packages/core/src/constants.ts` — PROTOCOL_VERSION now '4.0.0'
- Direct analysis: `napplet/packages/shim/src/index.ts` — shim now sends JSON envelope objects, not NIP-01 arrays
- Direct analysis: `napplet/packages/core/src/types.ts` — NappletGlobal shape; window.napplet interfaces

---
*Pitfalls research for: NIP-5D migration, @kehto packages*
*Researched: 2026-04-07*
