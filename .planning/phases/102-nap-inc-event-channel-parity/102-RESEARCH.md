# Phase 102: NAP-INC Event and Channel Parity - Research

**Researched:** 2026-07-23
**Domain:** Shell-mediated inter-napplet event and channel routing
**Confidence:** MEDIUM

## User Constraints

- Phase 102 owns INC-01 through INC-08: NAP-INC event/channel parity after Phase 101, not a broader intent or package-release migration. [VERIFIED: `.planning/ROADMAP.md:84-96`; `.planning/REQUIREMENTS.md:105-135`]
- Use `napplet/naps` PR #89 head `34ec29fc4039384a83dbd6b476f83c4fa0d038e6` as this phase's accepted NAP-INC target, even though the repository-wide v1.29 authority statements still name `6461e4b`. [VERIFIED: task scope; `napplet/naps@34ec29f:naps/NAP-INC.md`]
- Preserve all existing work; do not change the unrelated `.planning/config.json` worktree edit. [VERIFIED: `git diff -- .planning/config.json`; task scope]
- NAP-facing behavior must cite the owning NAP, must not invent wire surface, and must update the complete Kehto runtime/host/test path rather than only the first compiling package. [VERIFIED: `AGENTS.md`]
- NAP-INTENT `convention` and `payload` remain opaque in this phase. Do not add intent-layer URI query parsing or payload mutation. [VERIFIED: `napplet/naps@34ec29f:naps/NAP-INTENT.md`; task scope]
- Do not install or upgrade external packages in Phase 102; package adoption remains gated on a published upstream contract. [VERIFIED: `.planning/REQUIREMENTS.md:13`; installed `@napplet/nap@0.28.0` declarations]

## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| INC-01 | Opaque convention topics | Client-side URI transposition produces a stable topic; runtime routing remains exact equality only. |
| INC-02 | Emit and subscription API | Replace the legacy injected shape with canonical `emit(topic, payload?)` and `on(topic, IncEvent)` behavior. |
| INC-03 | Sender and target identity | Add dTag-to-live-window resolution and never serialize a window ID/pubkey as sender, peer, or target. |
| INC-04 | Exact routing and exclusion | Preserve the existing topic `Map`, sender exclusion, payload, and shell-assigned opaque IDs. |
| INC-05 | Channel surface | Add injected `channel.open/list/broadcast` and `ChannelHandle.emit/on/close`; complete their runtime messages. |
| INC-06 | Channel authorization | Put ACL policy at `channel.open`; do not inspect/re-authorize application payloads afterwards. |
| INC-07 | Channel lifecycle | Notify both peers on close; surviving endpoint receives `reason: "peer destroyed"`; remove all routes. |
| INC-08 | Transport semantics | Retain correlated subscribe/open/list and fire-and-forget emit/unsubscribe/channel emit/broadcast/close. |

## Project Constraints (from AGENTS.md)

- Read the owning NAP source and record the exact master/ref before planning NAP behavior; an explicit draft ref is usable only where the work targets it. [VERIFIED: `AGENTS.md`]
- A missing/ambiguous NAP behavior is a specification gap to flag, never a Kehto-local protocol invention. [VERIFIED: `AGENTS.md`]
- Keep strict ESM TypeScript conventions, public JSDoc, named exports, and `import type` separation. [VERIFIED: `AGENTS.md`]
- When a NAP field changes, trace runtime, shell/Paja/playground adapters, ACL/capability mapping, docs, and tests together. [VERIFIED: `AGENTS.md`]
- Package/API behavior changes require focused tests and active docs in the same branch; changed published outputs require Changesets before release. [VERIFIED: `AGENTS.md`]
- Required final gates are `pnpm build`, `pnpm type-check`, `pnpm test:unit`, relevant Playwright coverage, `pnpm docs:check`, the AI-slop gate, and `git diff --check`. [VERIFIED: `AGENTS.md`]

## Summary

Phase 102 should make Kehto's existing shell-mediated INC router conform to PR #89's complete INC contract. The authoritative NAP now defines two deliberately separate stages: a client-facing `emit` may transpose a convention URI query into a shallow text payload, while the shell routes the resulting stable topic by exact string equality. That makes the existing `Map<string, Set<string>>` routing model worth preserving, but it must never parse, normalize, wildcard-match, or base-match a topic. [VERIFIED: `napplet/naps@34ec29f:naps/NAP-INC.md` “Convention URI transposition”, “Topic routing”, and “Shell Behavior”; `packages/runtime/src/inc-handler.ts:16-118`]

The main Kehto defects are architectural, not a need for another transport: `inc-handler.ts` leaks window IDs as `sender`/`peer`, accepts a window ID or legacy pubkey as a channel target, performs no channel-open ACL check, and omits `peer destroyed` on endpoint removal. The host-injected prelude still exposes the old three-argument event API and no channel surface. Fix identity/lifecycle and runtime wire behavior first; then make the single prelude implementation canonical, which automatically reaches both Paja and playground `srcdoc` hosts. [VERIFIED: `packages/runtime/src/inc-handler.ts:69-204`; `packages/shell/src/napplet-namespace.ts:338-372`; `packages/paja/src/browser-target-frame.ts:84-105`; `apps/playground/src/shell-host.ts:480-510`]

The installed `@napplet/nap@0.28.0` is not the target public API: its declarations still expose `incEmit(topic, extraTags?, content?)`, `incOn(payload, NostrEvent)`, and a legacy three-argument shim. Phase 102 must not upgrade or represent those declarations as PR #89 conformance. The Kehto fallback prelude can provide the authoritative direct runtime surface while keeping an explicitly bounded compatibility adapter only if current local fixtures/consumers still require it; the upstream published-package chase belongs to Phase 104. [VERIFIED: installed `@napplet/nap@0.28.0` `dist/inc/{sdk,shim,types}.d.ts`; `.planning/ROADMAP.md:112-121`; `.planning/REQUIREMENTS.md:13`]

**Primary recommendation:** Implement identity-safe runtime routing and lifecycle first, then replace the injected INC namespace with the canonical direct API and prove both Paja and playground paths; do not alter `intent.*` behavior or package versions.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Convention-URI transposition before wire emission | Browser/client injected namespace | Upstream shim/SDK after publication | `emit` owns query-to-payload conversion; a received wire topic is already stable. [VERIFIED: `NAP-INC.md@34ec29f`] |
| Exact event fan-out and sender exclusion | API/backend runtime | Browser transport | The runtime owns subscription state and recipient dispatch. [VERIFIED: `NAP-INC.md@34ec29f`; `inc-handler.ts`] |
| dTag identity and live endpoint lookup | API/backend runtime | Shell creation-time origin registry | Only host-created session entries can translate a dTag to a live frame. [VERIFIED: `NAP-INC.md@34ec29f`; `session-registry.ts`; `shell-bridge.ts`] |
| Channel authorization, opaque IDs, and teardown | API/backend runtime | ACL / shell transport | ACL is decided at open; channel IDs and cleanup stay shell-owned. [VERIFIED: `NAP-INC.md@34ec29f`] |
| Public `window.napplet.inc` API | Browser/client injected namespace | Paja/playground `srcdoc` injection | One prelude is injected by both hosts. [VERIFIED: `napplet-namespace.ts`; `browser-target-frame.ts`; `shell-host.ts`] |
| Intent convention/payload semantics | API/backend intent domain | Browser/client | NAP-INTENT defines opaque fields, not a query-transposition algorithm. [VERIFIED: `NAP-INTENT.md@34ec29f`] |

## Standard Stack

### Core

| Library / module | Version | Purpose | Why Standard |
|---|---:|---|---|
| Existing `@kehto/runtime` INC runtime | workspace `0.18.5` | Subscription state, channel state, dispatch | Existing project owner for `inc.*` envelopes; no new runtime dependency is needed. [VERIFIED: `packages/runtime/package.json`; `packages/runtime/src/inc-handler.ts`] |
| Existing `@kehto/shell` namespace prelude | workspace `0.17.2` | Injected public `window.napplet.inc` API | Shared prelude reaches Paja and playground without duplicating wire semantics. [VERIFIED: `packages/shell/package.json`; `packages/shell/src/napplet-namespace.ts`] |
| `@napplet/nap` types | installed `0.28.0` | Current wire type baseline only | Use for the currently available envelope union, but do not treat its legacy SDK/shim API as the PR #89 target. [VERIFIED: installed `@napplet/nap@0.28.0` declarations; npm registry queried 2026-07-23] |

### Supporting

| Library / module | Version | Purpose | When to Use |
|---|---:|---|---|
| Existing `SessionRegistry` | workspace | Creation-time `windowId` → `SessionEntry` identity source | Add a dTag lookup or a narrowly scoped live-entry resolver here, not an INC-local public identity map. [VERIFIED: `packages/runtime/src/session-registry.ts`; `packages/runtime/src/types.ts:362-383`] |
| Existing ACL state / NAP enforcement gate | workspace | Resolve and check capability grant from creation-time identity | Use to authorize `channel.open` once. Do not use it to parse payloads. [VERIFIED: `packages/runtime/src/runtime.ts:452-472`; `packages/runtime/src/enforce.ts`] |
| Vitest | `4.1.2` | Runtime/prelude/host unit coverage | Use focused unit tests for every wire and negative case. [VERIFIED: `pnpm exec vitest --version`] |
| Playwright | existing workspace | Real sandbox and `srcdoc` host proof | Use for the end-to-end canonical event/channel path. [VERIFIED: `package.json` scripts; `tests/e2e/*.spec.ts`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| Exact `Map` lookup | URI/base-topic/prefix/wildcard matcher | Forbidden for routing by the target NAP; it would make independent topics collide. [VERIFIED: `NAP-INC.md@34ec29f`] |
| Client-side URI conversion | Runtime URI parser | Forbidden placement: received wire messages must be routed opaquely, not reparsed. [VERIFIED: `NAP-INC.md@34ec29f`] |
| SessionRegistry dTag resolution | Window ID or pubkey target acceptance | Violates the required exposed identity model and permits non-dTag addressing. [VERIFIED: `NAP-INC.md@34ec29f`] |
| Open-time channel authorization | Per-message channel ACL/payload analysis | Violates the target's auth-on-open model and changes payload semantics. [VERIFIED: `NAP-INC.md@34ec29f`] |

**Installation:** No package installation or upgrade is in scope. [VERIFIED: task scope]

## Package Legitimacy Audit

No external package is to be installed by this phase, so the Package Legitimacy Gate does not apply. The installed `@napplet/nap@0.28.0` was registry-checked only to establish the current compatibility boundary; it is not a recommended new dependency or an authority for the PR #89 API. [VERIFIED: `npm view @napplet/nap version time`; installed declarations]

## Architecture Patterns

### System Architecture Diagram

```text
Developer call
  window.napplet.inc.emit(topicOrConventionUri, payload?)
       |
       | convention URI with query: validate + transpose before postMessage
       v
  { type: 'inc.emit', topic: stableTopic, payload? }
       |
       v
ShellBridge trusted MessageEvent.source -> runtime session/windowId
       |
       v
INC runtime: exact subscriptions.get(stableTopic)
       |-- exclude sender
       |-- resolve sender SessionEntry.dTag
       v
recipient frame <- { type: 'inc.event', topic: stableTopic, sender: dTag, payload? }

channel.open(target dTag) -> dTag live-session lookup -> ACL once -> opaque channelId
       |                                                              |
       +-- failure: correlated open.result(error)                    +-- success: peer dTag
                                                                      |
channel emit/broadcast (fire-and-forget) -> channel state -> peer channel.event
close / endpoint destroyed / ACL revocation -> remove state -> channel.closed to both/survivor
```

The diagram uses a client-side conversion boundary so the runtime accepts only opaque stable topics. The transport retains the trusted source-to-window mapping created by the shell; it never accepts caller-claimed sender identity. [VERIFIED: `NAP-INC.md@34ec29f`; `packages/shell/src/shell-bridge.ts`; `packages/runtime/src/inc-handler.ts`]

### Exact File Ownership and Order

| Order | Owned files | Implementation responsibility | Dependency |
|---:|---|---|---|
| 1 | `packages/runtime/src/session-registry.ts`, `packages/runtime/src/types.ts`, matching registry tests | Add internal dTag → live `windowId` lookup with an unambiguous live-entry policy; retain creation-time identity as source of truth. | None |
| 2 | `packages/runtime/src/inc-handler.ts`, `packages/runtime/src/runtime.ts`, `packages/runtime/src/dispatch.test.ts` | Make events/channels serialize dTags, accept only target dTags, authorize at open, allocate opaque IDs, and implement closed/cleanup semantics. | 1 |
| 3 | `packages/acl/src/capabilities.ts`, `packages/acl/src/resolve.ts`, relevant ACL tests, only if current capability resolver rechecks INC channel messages | Ensure the capability mapping supports an open-only decision and does not re-authorize payload traffic. | 2 |
| 4 | `packages/shell/src/napplet-namespace.ts`, `packages/shell/src/napplet-namespace.test.ts`, shell README/JSDoc | Implement canonical event and complete channel client API, URI validation/transposition, correlation bookkeeping, and one local listener registry. | 2 |
| 5 | `packages/paja/src/browser-host.test.ts`, `packages/paja/src/browser-runtime-tabs.ts` tests; `apps/playground` host/unit tests | Prove the shared prelude is injected and teardown calls runtime cleanup in both real hosts; alter host code only if a teardown or environment gap is demonstrated. | 4 |
| 6 | `tests/e2e/nap-inc.spec.ts`, `tests/e2e/inc-roundtrip.spec.ts`, fixture(s), focused guard tests | Exercise canonical event and channel behavior through sandboxed `srcdoc`; retire legacy test-only calls only after compatibility is deliberately removed. | 4-5 |

### Pattern 1: Client-only convention URI transposition

**What:** In `makeInc().emit`, treat a query-bearing `napplet:` URI as a developer convenience, reject invalid input before sending, and post only the queryless stable topic plus a text-to-text payload map.

**When to use:** Only for `inc.emit` with a `napplet:` convention URI containing a query. A queryless topic is passed unchanged; structured payload is accepted only with a queryless topic. [VERIFIED: `NAP-INC.md@34ec29f`]

```typescript
// Source: napplet/naps PR #89 head 34ec29f, NAP-INC “Convention URI transposition”
const { topic, payload } = transposeConventionUri(topicOrConventionUri, explicitPayload);
fire({ type: 'inc.emit', topic, ...(payload === undefined ? {} : { payload }) });
```

Required parser properties: no fragment; malformed percent encoding rejects; decoded names are unique; values remain strings; `+` remains a literal plus; explicit payload plus query rejects. A DOM `URLSearchParams` form decoder must not be used unless its `+` behavior is neutralized and tests prove the NAP semantics. [VERIFIED: `NAP-INC.md@34ec29f`] [ASSUMED: a small explicit parser is the clearest safe implementation]

### Pattern 2: dTag-at-boundary, windowId-internal channel state

**What:** Keep internal maps keyed by opaque host window IDs, but translate sender/peer/target at the API boundary through `SessionEntry.dTag`. Channel state must never leak an internal ID except the shell-generated opaque `channelId`.

**When to use:** Every `inc.event`, `inc.channel.open.result`, `inc.channel.event`, and `inc.channel.list.result`; every `channel.open.target` input. [VERIFIED: `NAP-INC.md@34ec29f`; `SessionEntry` in `packages/runtime/src/types.ts`]

```typescript
// Source: NAP-INC @34ec29f identity schemas; current SessionRegistry architecture
const targetWindowId = sessionRegistry.getWindowIdByDTag(targetDTag);
if (!targetWindowId) return sendOpenError(id, 'target not found');
const sender = sessionRegistry.getEntryByWindowId(senderWindowId)?.dTag;
```

Reject a target that is not a live dTag; do not fall back to `getEntryByWindowId(target)` or `entry.pubkey === target`. [VERIFIED: `NAP-INC.md@34ec29f`; current `inc-handler.ts:69-74`]

### Pattern 3: Channel lifecycle is a single teardown primitive

**What:** Use one internal `closeChannel(channelId, reason?)` primitive to determine participants, notify the correct endpoints, then remove both `channels` and `channelsByWindow` entries.

**When to use:** Explicit close, endpoint destruction, ACL revocation, and runtime clear. Endpoint destruction notifies only the survivor with `reason: 'peer destroyed'`; an ordinary close notifies both without a reason unless one is specified by policy. [VERIFIED: `NAP-INC.md@34ec29f`]

```typescript
// Source: NAP-INC @34ec29f “Channel management”
closeChannel(channelId, { destroyedWindowId, reason: 'peer destroyed' });
```

### Anti-Patterns to Avoid

- **Runtime URI parsing:** It would turn a malicious/raw query-bearing wire topic into an unintended base-topic delivery. Route the received string exactly. [VERIFIED: `NAP-INC.md@34ec29f`]
- **Window ID/pubkey compatibility target:** It leaks or accepts an identity type prohibited by INC-03. [VERIFIED: `NAP-INC.md@34ec29f`; `inc-handler.ts:69-74`]
- **Per-message channel ACL checks:** They conflict with authorization once at open and invite payload-semantic enforcement. [VERIFIED: `NAP-INC.md@34ec29f`]
- **Separate channel teardown branches:** They leave stale reverse-map routes or inconsistent notifications. [VERIFIED: current `inc-handler.ts:47-67,189-204`; `NAP-INC.md@34ec29f`]
- **Inventing `inc.emit.error` or `inc.unsubscribe.result`:** These operations are fire-and-forget. [VERIFIED: `NAP-INC.md@34ec29f`]

## API Migration and Wire Contract

| Current Kehto behavior | Phase 102 target | Migration rule |
|---|---|---|
| `emit(topic, extraTags?, content?)` parses legacy JSON content. | `emit(topicOrConventionUri, payload?)` sends canonical `inc.emit`. | Keep any legacy adapter private and temporary; canonical path must be direct and tested. [VERIFIED: `napplet-namespace.ts:338-350`; `NAP-INC.md@34ec29f`] |
| `on(topic, callback(payload, synthetic NostrEvent))` listens immediately. | `on(topic, handler(IncEvent))` subscribes with ID correlation and returns a closeable handle. | Match the NAP event shape; do not fabricate a Nostr event as the public contract. [VERIFIED: `napplet-namespace.ts:351-370`; `NAP-INC.md@34ec29f`] |
| Runtime event `sender` is `windowId`. | Runtime event `sender` is source `dTag`. | Resolve from the trusted registered session immediately before delivery. [VERIFIED: `inc-handler.ts:99-111`; `NAP-INC.md@34ec29f`] |
| `channel.open` accepts a window ID or pubkey and returns window ID as peer. | It accepts only a target dTag and returns that peer dTag. | Add dTag live-resolution; unknown/dead target returns correlated `target not found`. [VERIFIED: `inc-handler.ts:69-74,145-158`; `NAP-INC.md@34ec29f`] |
| No injected channel API. | `channel.open/list/broadcast`, handle `emit/on/close`. | Build on existing request/fire/listener helpers in the prelude; keep result correlation local. [VERIFIED: `napplet-namespace.ts`; `NAP-INC.md@34ec29f`] |
| Destroyed endpoint notifies peer without a reason. | Surviving endpoint gets `inc.channel.closed` with `reason: 'peer destroyed'`. | Reuse unified cleanup and remove all subscriptions/channels. [VERIFIED: `inc-handler.ts:189-204`; `NAP-INC.md@34ec29f`] |

### Exact Routing Rules

1. `subscriptions.get(topic)` is the only delivery match: no prefix, wildcard, normalization, URI parsing, or base/query matching. [VERIFIED: `NAP-INC.md@34ec29f`; `inc-handler.ts:99-111`]
2. A canonical client call `emit('napplet:profile/open?pubkey=a%20b&plus=a+b')` posts `topic: 'napplet:profile/open'` and `payload: { pubkey: 'a b', plus: 'a+b' }`; subscribers subscribe to the stable topic. [VERIFIED: `NAP-INC.md@34ec29f`]
3. A direct/raw wire message with `topic: 'napplet:profile/open?pubkey=x'` is opaque and does **not** match subscription `'napplet:profile/open'`. This is a negative security regression test, not a supported developer API. [VERIFIED: `NAP-INC.md@34ec29f`]
4. Sender exclusion applies to topic fan-out. A channel message goes only to the peer selected by shell state; a broadcast goes only to open peers. [VERIFIED: `NAP-INC.md@34ec29f`]

### Channels, Authorization, and Lifecycle

- `inc.channel.open` is correlated and returns its request `id`; success has shell-generated `channelId` and peer dTag, failure has `error` and no channel. [VERIFIED: `NAP-INC.md@34ec29f`]
- Validate target liveness and policy exactly once at open. Later emit/broadcast traffic is routed from established channel state without application-payload interpretation or a second ACL decision. [VERIFIED: `NAP-INC.md@34ec29f`]
- `inc.channel.emit`, `.broadcast`, and `.close` are fire-and-forget; `channel.list` is correlated; `inc.channel.event`/`.closed` are shell-initiated. [VERIFIED: `NAP-INC.md@34ec29f`]
- Explicit close notifies both sides and removes the channel. Peer destruction removes every affected route and notifies each surviving peer with `reason: 'peer destroyed'`. ACL revocation must use the same cleanup primitive and an explicitly chosen NAP-permitted reason. [VERIFIED: `NAP-INC.md@34ec29f`] [ASSUMED: the local ACL-revocation hook must be identified during planning because the current audit identifies the policy mismatch but not its invocation site]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Browser-to-frame identity | Caller-supplied sender/peer fields | Existing origin/session registry and `MessageEvent.source` chain | Source-based identity is the stated INC trust boundary. [VERIFIED: `NAP-INC.md@34ec29f`; `shell-bridge.ts`] |
| Channel IDs | dTag-derived or predictable IDs | Existing host crypto UUID hook with opaque storage | IDs must be shell-assigned and unguessable to napplets. [VERIFIED: `NAP-INC.md@34ec29f`; `inc-handler.ts:154`] |
| Transport acknowledgement | New error/result envelopes for fire-and-forget actions | Defined INC wire messages only | Extra acknowledgements are protocol invention. [VERIFIED: `NAP-INC.md@34ec29f`] |
| Separate host APIs | Paja/playground-specific INC implementations | `renderNappletNamespacePrelude` shared by both | A shared injection owner prevents host drift. [VERIFIED: `browser-target-frame.ts`; `shell-host.ts`] |

**Key insight:** INC is not a general client-to-client bus. The shell owns identity, channel state, IDs, and lifecycle; receiving napplets own validation of opaque payload data. [VERIFIED: `NAP-INC.md@34ec29f`]

## Common Pitfalls

### Pitfall 1: Treating the new transposition rule as router behavior

**What goes wrong:** Query-bearing raw wire topics base-match stable subscriptions or have their payload silently changed.
**Why it happens:** URI parsing is added beside `subscriptions.get(topic)` instead of only at injected `emit`.
**How to avoid:** Unit-test the negative raw-wire vector and keep the router's key lookup literal.
**Warning signs:** Any `URL`, `URLSearchParams`, `?`, `split`, prefix, or wildcard code in `inc-handler.ts`. [VERIFIED: `NAP-INC.md@34ec29f`]

### Pitfall 2: Confusing dTag identity with internal transport identity

**What goes wrong:** A caller can target `window-42` or a pubkey, or a recipient sees one of those values as `sender`/`peer`.
**Why it happens:** Current state maps are keyed by window ID and current resolution falls back to pubkey.
**How to avoid:** Preserve window IDs internally, add an explicit dTag lookup at the session boundary, and test all exposed fields.
**Warning signs:** `sender: windowId`, `peer: peerWindow`, `getEntryByWindowId(target)`, or `entry.pubkey === target` in INC code. [VERIFIED: `inc-handler.ts:69-74,106,157,169,184`; `NAP-INC.md@34ec29f`]

### Pitfall 3: ACL at the wrong time

**What goes wrong:** Every channel message is denied/rechecked or application payload affects routing policy.
**Why it happens:** Reusing generic per-message ACL machinery without a channel-open boundary.
**How to avoid:** Resolve capability/policy at `channel.open`, retain only established membership for later delivery, and test that the post-open path does not call the checker.
**Warning signs:** `acl.check`/`enforce` in `channel.emit` or `channel.broadcast`. [VERIFIED: `NAP-INC.md@34ec29f`; `.planning/NAP-CONVENTIONS-6461E4B-DELTA-AUDIT.md:129-141`]

### Pitfall 4: Incomplete teardown

**What goes wrong:** A destroyed frame leaves subscriptions/reverse channel entries, or survivor gets an unqualified close.
**Why it happens:** Explicit close and destruction have separate deletion sequences.
**How to avoid:** Test both state maps after every teardown source and use one close primitive.
**Warning signs:** `removeWindowChannels` sends `.closed` without `peer destroyed` or a route remains listable after cleanup. [VERIFIED: `inc-handler.ts:189-204`; `NAP-INC.md@34ec29f`]

## Code Examples

### Canonical prelude event API

```typescript
// Source: napplet/naps PR #89 head 34ec29f, NAP-INC API/Wire Protocol
const subscription = window.napplet.inc.on('napplet:profile/open', (event) => {
  // event.topic is exact, event.sender is a dTag, event.payload is opaque.
});

window.napplet.inc.emit('napplet:profile/open?pubkey=abc');
subscription.close();
```

### Channel result and cleanup behavior

```typescript
// Source: napplet/naps PR #89 head 34ec29f, NAP-INC “Channel management”
const channel = await window.napplet.inc.channel.open('media-player');
channel.on((event) => consumeUntrustedPayload(event.payload));
channel.emit({ command: 'play' });
channel.close();
```

## State of the Art

| Old approach | Current target approach | When Changed | Impact |
|---|---|---|---|
| Legacy three-argument Nostr-event-flavored INC helper | Direct NAP-INC event/channel API with opaque payload | Targeted by PR #89 draft | Kehto fallback must migrate independently of the not-yet-updated published package. [VERIFIED: installed `@napplet/nap@0.28.0`; `NAP-INC.md@34ec29f`] |
| Query-bearing topic treated as a distinct string because parameter matching was unspecified | `emit` transposes convention URI query before routing; router remains exact after conversion | PR #89 head `34ec29f` | Update Phase 102 requirements/plans, but do not add query-aware matching. [VERIFIED: `git -C ../naps diff 34ec29f^ 34ec29f`; `NAP-INC.md@34ec29f`] |
| Window IDs/pubkeys exposed by current Kehto runtime | dTag-only public identities and shell-owned opaque channel IDs | Existing NAP-INC target | Requires session registry seam and wire regression coverage. [VERIFIED: `inc-handler.ts`; `NAP-INC.md@34ec29f`] |

## Explicitly Deferred: NAP-INTENT Query Behavior

Do not change `intent.invoke`, `IntentOpenOptions`, manifest catalog values, or intent handler `convention`/`payload` handling to parse or transpose a URI query. At `34ec29f`, NAP-INTENT says convention names a payload shape and payload is opaque; PR #89 only changes `NAP-INC.md`. [VERIFIED: `napplet/naps@34ec29f:naps/NAP-INTENT.md`; `git -C /Users/sandwich/Develop/naps diff --name-only 34ec29f^ 34ec29f`]

If an intent flow eventually delivers through INC, ordinary `inc.emit` may apply the NAP-INC conversion at that API boundary, but the intent request's payload remains unmodified. Any distinct intent-layer query semantics require an upstream NAP-INTENT decision before Kehto implementation. [VERIFIED: `NAP-INC.md@34ec29f`; `NAP-INTENT.md@34ec29f`; `AGENTS.md`]

## Stale Authority Statements Requiring Planner Correction

Do not silently edit these history-bearing documents in Phase 102 research. The planner should add an explicit planning-artifact correction before using their old text as Phase 102 protocol authority:

| Artifact | Stale statement | Required correction |
|---|---|---|
| `.planning/ROADMAP.md:46-56` | Global constraints say topics stay opaque with “no query stripping,” and Phase 102 inherits that 6461e4b baseline. | State that PR #89 `34ec29f` controls Phase 102's **client-side `emit` transposition only**; runtime matching remains exact and no query-aware matching is added. [VERIFIED: `ROADMAP.md`; `NAP-INC.md@34ec29f`] |
| `.planning/REQUIREMENTS.md:5-13` | Goal/Authority pin all v1.29 work to `6461e4b`. | Add a scoped Phase 102 authority override naming PR #89 head `34ec29f`, retaining older pins for phases not adopting the draft. [VERIFIED: `REQUIREMENTS.md`; task scope] |
| `.planning/REQUIREMENTS.md:105-108,218` | INC-01 says no query stripping and non-goals say not to invent query-aware matching. | Rewrite only enough to distinguish required pre-emission transposition from forbidden routing matching. [VERIFIED: `REQUIREMENTS.md`; `NAP-INC.md@34ec29f`] |
| `.planning/NAP-CONVENTIONS-6461E4B-DELTA-AUDIT.md:123-127,202-204` | Calls parameter behavior ambiguous and requests exact raw topic matching. | Preserve its audit history but mark its Phase 102 INC parameter conclusion superseded by PR #89; retain exact routing conclusion. [VERIFIED: delta audit; `NAP-INC.md@34ec29f`] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | A small explicit query parser is clearer than adapting platform form decoding. | Architecture Patterns | Could produce an unnecessary local helper; tests must still enforce the normative behavior. |
| A2 | ACL revocation needs a local hook investigation before its channel cleanup can be planned exactly. | Channels, Authorization, and Lifecycle | A planner could omit revocation cleanup or duplicate lifecycle code. |
| A3 | A temporary private adapter may be needed for current legacy fixture consumers until package adoption in Phase 104. | Summary / API Migration | Could retain legacy public behavior too long; gate it behind explicit tests and remove when upstream API is released. |

## Open Questions

1. **Which concrete capability names authorize `inc.channel.open`?**
   - What we know: the target permits shell ACL at open and the audit identifies existing resolver behavior that rechecks channel messages. [VERIFIED: `NAP-INC.md@34ec29f`; delta audit]
   - What's unclear: the exact current `@kehto/acl` capability mapping and revoke callback path appropriate for INC channels.
   - Recommendation: Planner's first implementation task must inspect `packages/acl/src/capabilities.ts` and `resolve.ts`, select an existing capability mapping or surface a spec/policy decision; do not invent a new wire capability.

2. **How should duplicate live dTags be handled?**
   - What we know: channels target a dTag and require a live endpoint; the current registry indexes pubkeys and windows, not dTags. [VERIFIED: `NAP-INC.md@34ec29f`; `session-registry.ts`]
   - What's unclear: host policy for multiple frames with the same dTag.
   - Recommendation: make a deterministic host-owned uniqueness/liveness decision at registration or return `target not found`/a documented open error; do not silently choose an arbitrary frame. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---:|---|
| Node.js | TypeScript build/test | ✓ | `v25.2.1` | — |
| pnpm | Workspace commands | ✓ | `10.8.0` | — |
| Vitest | Focused unit suite | ✓ | `4.1.2` | — |
| Playwright workspace runner | `srcdoc` host regressions | ✓ | configured in scripts | Focused unit tests only do not prove sandbox host behavior. |
| Upstream NAP-INC PR #89 checkout | Protocol authority | ✓ | `34ec29f` | — |

**Missing dependencies with no fallback:** None identified. [VERIFIED: local probes]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest `4.1.2`; Playwright for browser integration |
| Config file | `vitest.config.ts`; Playwright configuration in workspace |
| Quick run command | `pnpm exec vitest run packages/runtime/src/dispatch.test.ts packages/shell/src/napplet-namespace.test.ts` |
| Full suite command | `pnpm test:unit` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| INC-01 | Canonical URI conversion and raw wire exact isolation | unit | focused Vitest runtime/prelude tests | ❌ Wave 0 additions |
| INC-02 | Canonical emit/on, correlation, closeable subscription | unit + host integration | focused Vitest + Paja/playground tests | partial |
| INC-03 | dTag-only sender/peer/target | unit | `pnpm exec vitest run packages/runtime/src/dispatch.test.ts` | partial |
| INC-04 | Exact delivery, payload, sender exclusion | unit + E2E | focused Vitest + `pnpm test:e2e -- nap-inc` | partial |
| INC-05 | Complete channel public/wire surface | unit | focused Vitest prelude/runtime | ❌ Wave 0 additions |
| INC-06 | Authorize once on open, never per payload | unit | focused ACL/runtime tests | ❌ Wave 0 additions |
| INC-07 | explicit/destroy/revoke cleanup and reason | unit + host integration | focused runtime/Paja tests | partial |
| INC-08 | correlation vs fire-and-forget wire shape | unit | focused prelude/runtime tests | partial |

### Sampling Rate

- **Per task commit:** focused Vitest files owned by that task.
- **Per wave merge:** `pnpm test:unit` and the targeted browser spec for any changed `srcdoc` path.
- **Phase gate:** `pnpm build`, `pnpm type-check`, `pnpm test:unit`, relevant/full `pnpm test:e2e`, `pnpm docs:check`, AI-slop gate, and `git diff --check`. [VERIFIED: `AGENTS.md`]

### Wave 0 Gaps

- [ ] `packages/runtime/src/inc-handler.test.ts` or expanded `dispatch.test.ts` — dTag routing, channel authorization, opaque IDs, and teardown matrix.
- [ ] `packages/shell/src/napplet-namespace.test.ts` additions — canonical URI conversion, all rejection cases, correlation, channel handles, and no invented wire replies.
- [ ] Paja and playground host regression — execute the shared injected prelude through each `srcdoc` path.
- [ ] Playwright fixture/spec — two live dTag endpoints proving canonical URI event and channel lifecycle.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes | Trusted `MessageEvent.source` and creation-time session identity; no caller-claimed sender. [VERIFIED: `NAP-INC.md@34ec29f`; `shell-bridge.ts`] |
| V3 Session Management | yes | Phase 101 session gate and removal through `runtime.destroyWindow`. [VERIFIED: `runtime.ts`; Phase 101 context] |
| V4 Access Control | yes | dTag live-target lookup and one ACL decision at `channel.open`. [VERIFIED: `NAP-INC.md@34ec29f`] |
| V5 Input Validation | yes | Reject invalid convention URI inputs before emission; treat inbound payload as opaque/untrusted. [VERIFIED: `NAP-INC.md@34ec29f`] |
| V6 Cryptography | no new crypto | Use existing host UUID source for opaque IDs; do not implement custom crypto. [VERIFIED: `inc-handler.ts:154`] |

### Known Threat Patterns for INC

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Sender/peer spoofing via envelope fields | Spoofing | Derive every exposed dTag from the trusted session entry for the source/endpoint. [VERIFIED: `NAP-INC.md@34ec29f`] |
| Topic confusion through query/base matching | Tampering | Client-only conversion; exact runtime `Map` key; negative raw-wire test. [VERIFIED: `NAP-INC.md@34ec29f`] |
| Channel hijack via guessed/caller-supplied IDs | Elevation of privilege | Shell-generated opaque IDs, membership check through internal state, no channel enumeration beyond caller's list. [VERIFIED: `NAP-INC.md@34ec29f`] |
| Unauthorized direct channel | Elevation of privilege | Validate live target and ACL once at open; do not substitute window ID/pubkey. [VERIFIED: `NAP-INC.md@34ec29f`] |
| Stale channel after peer destruction | Denial of service / information disclosure | Unified teardown removes both indexes and notifies survivor with `peer destroyed`. [VERIFIED: `NAP-INC.md@34ec29f`] |
| Untrusted application payload | Tampering | Shell routes it opaquely; receiving napplet validates against its chosen convention. [VERIFIED: `NAP-INC.md@34ec29f`] |

## Sources

### Primary

- [`NAP-INC.md` at PR #89 head `34ec29f`](https://github.com/napplet/naps/blob/34ec29fc4039384a83dbd6b476f83c4fa0d038e6/naps/NAP-INC.md) — API, wire, transposition, exact routing, identity, channels, lifecycle, security. [VERIFIED: local `napplet/naps` checkout]
- [`NAP-INTENT.md` at the same ref](https://github.com/napplet/naps/blob/34ec29fc4039384a83dbd6b476f83c4fa0d038e6/naps/NAP-INTENT.md) — opaque convention/payload boundary and explicit absence of an intent query algorithm. [VERIFIED: local `napplet/naps` checkout]
- Kehto current runtime/prelude/host/tests — exact ownership and current drift. [VERIFIED: `packages/runtime/src/inc-handler.ts`; `packages/shell/src/napplet-namespace.ts`; Paja/playground sources]

### Secondary

- `.planning/NAP-CONVENTIONS-6461E4B-DELTA-AUDIT.md` — baseline delta and its now-superseded INC query ambiguity finding. [VERIFIED: local planning artifact]
- `.planning/phases/101-nap-shell-session-integrity/101-PR89-INC-TRANSPOSITION-RESEARCH.md` — prior transposition seam and package-boundary investigation. [VERIFIED: local planning artifact]

## Metadata

**Confidence breakdown:**

- Standard stack: MEDIUM — verified from local workspace and installed package declarations; published canonical INC API remains gated. [VERIFIED: local package metadata]
- Architecture: MEDIUM — authoritative target NAP and current source were checked; ACL capability/revocation hook remains open. [VERIFIED: NAP/local source]
- Pitfalls: MEDIUM — direct comparison of target requirements and current implementation. [VERIFIED: NAP/local source]

**Research date:** 2026-07-23
**Valid until:** Until PR #89 changes or is merged; recheck its exact head before execution.
