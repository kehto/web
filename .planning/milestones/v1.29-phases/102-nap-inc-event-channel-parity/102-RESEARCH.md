# Phase 102: NAP-INC Event and Channel Parity - Research

**Researched:** 2026-07-23
**Domain:** Shell-mediated inter-napplet event and channel routing
**Confidence:** MEDIUM

## User Constraints

- Phase 102 owns BASE-04, BASE-05, and INC-01 through INC-08:
  projection-binding plus NAP-INC parity after Phase 101, not the broader intent
  lifecycle or package-release migration. [VERIFIED: roadmap/requirements]
- Use `napplet/naps` PR #89 head `4593ce9e301ce098fd3dad64206fcd6f144fa7af`
  for NAP-INC and PR #90 head
  `896c32c92deee68dc4d10fc1132b62df20cccb6f` for the shared web
  convention binding, plus PR #92 head
  `c5cd06f7be6d4690b303949abb26e87ff62f4729` for symmetric channel handles.
  All are draft proposed authority and must be rechecked before execution.
  [VERIFIED: task scope; exact local refs]
- Preserve all existing work; do not change the unrelated `.planning/config.json` worktree edit. [VERIFIED: `git diff -- .planning/config.json`; task scope]
- NAP-facing behavior must cite the owning NAP, must not invent wire surface, and must update the complete Kehto runtime/host/test path rather than only the first compiling package. [VERIFIED: `AGENTS.md`]
- Draft #90 applies the binding to every convention-accepting
  `window.napplet.*` operation. Phase 102 must create one reusable projection
  normalizer and prevent shim/SDK reassignment from bypassing INC. Phase 104
  owns all #91 intent API wiring, replacement protection, resolution, and
  delivery lifecycle. [VERIFIED:
  `projections/web.md@896c32c`; exact-head downstream audit]
- Do not install or upgrade external packages in Phase 102; package adoption remains gated on a published upstream contract. [VERIFIED: `.planning/REQUIREMENTS.md:13`; installed `@napplet/nap@0.28.0` declarations]

## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| BASE-04 | Shared URI-to-payload binding | One serialized projection helper serves INC now and intent in Phase 104, including the complete rejection matrix. |
| BASE-05 | Exact normalized resolution | Runtime routes only stable wire topics; generic services and host visualizers do not prefix-intercept INC. |
| INC-01 | Opaque convention topics | Client-side URI transposition produces a stable topic; runtime routing remains exact equality only. |
| INC-02 | Emit and subscription API | Replace the legacy injected shape with canonical `emit(topic, payload?)` and `on(topic, IncEvent)` behavior. |
| INC-03 | Sender and target identity | Add dTag-to-live-window resolution and never serialize a window ID/pubkey as sender, peer, or target. |
| INC-04 | Exact routing and exclusion | Preserve the existing topic `Map`, sender exclusion, payload, and shell-assigned opaque IDs. |
| INC-05 | Channel surface | Add injected `channel.open/onOpened/list/broadcast` and symmetric `ChannelHandle.emit/on/onClosed/close`; complete #92 runtime messages and retention. |
| INC-06 | Channel authorization | Put ACL policy at `channel.open`; do not inspect/re-authorize application payloads afterwards. |
| INC-07 | Channel lifecycle | Enqueue target open first; retain early handle/events/terminal closure; notify both peers on close; surviving endpoint receives `reason: "peer destroyed"`; remove all routes. |
| INC-08 | Transport semantics | Retain correlated subscribe/open/list and fire-and-forget emit/unsubscribe/channel emit/broadcast/close. |

## Project Constraints (from AGENTS.md)

- Read the owning NAP source and record the exact master/ref before planning NAP behavior; an explicit draft ref is usable only where the work targets it. [VERIFIED: `AGENTS.md`]
- A missing/ambiguous NAP behavior is a specification gap to flag, never a Kehto-local protocol invention. [VERIFIED: `AGENTS.md`]
- Keep strict ESM TypeScript conventions, public JSDoc, named exports, and `import type` separation. [VERIFIED: `AGENTS.md`]
- When a NAP field changes, trace runtime, shell/Paja/playground adapters, ACL/capability mapping, docs, and tests together. [VERIFIED: `AGENTS.md`]
- Package/API behavior changes require focused tests and active docs in the same branch; changed published outputs require Changesets before release. [VERIFIED: `AGENTS.md`]
- Required final gates are `pnpm build`, `pnpm type-check`, `pnpm test:unit`, relevant Playwright coverage, `pnpm docs:check`, the AI-slop gate, and `git diff --check`. [VERIFIED: `AGENTS.md`]

## Summary

Phase 102 should make Kehto's shell-mediated INC router conform to draft #89
and make the runtime-provided web binding conform to draft #90. The two stages
remain separate: the projection transposes a developer convention URI into
stable identity plus payload, while the runtime routes that identity by exact
equality. The helper is projection-wide rather than `makeInc`-private because
intent also accepts a convention URI. The existing `Map<string, Set<string>>`
routing model is worth preserving and must never parse, normalize,
wildcard-match, or base-match a topic. [VERIFIED: exact draft heads;
`packages/runtime/src/inc-handler.ts:16-118`]

The main Kehto defects are architectural, not a need for another transport: `inc-handler.ts` leaks window IDs as `sender`/`peer`, accepts a window ID or legacy pubkey as a channel target, performs no channel-open ACL check, and omits `peer destroyed` on endpoint removal. The host-injected prelude still exposes the old three-argument event API and no channel surface. Fix identity/lifecycle and runtime wire behavior first; then make the single prelude implementation canonical, which automatically reaches both Paja and playground `srcdoc` hosts. [VERIFIED: `packages/runtime/src/inc-handler.ts:69-204`; `packages/shell/src/napplet-namespace.ts:338-372`; `packages/paja/src/browser-target-frame.ts:84-105`; `apps/playground/src/shell-host.ts:480-510`]

The installed `@napplet/nap@0.28.0` is not the target public API: its
declarations still expose `incEmit(topic, extraTags?, content?)`,
`incOn(payload, NostrEvent)`, and a legacy shim. Phase 102 must not upgrade or
represent those declarations as draft conformance. The Kehto prelude provides
the direct runtime binding, but a later shim can currently replace the domain or
whole namespace and bypass that binding. Protect or wrap those assignments and
prove normalization survives the actual bundle order. Published-package chase
belongs to Phase 105. [VERIFIED: installed declarations; proxy assignment audit]

**Primary recommendation:** Implement one INC-replacement-safe projection
normalizer and identity-safe exact runtime routing first, then complete the
injected INC/channel API and prove both Paja and playground paths. Leave the
public intent API untouched until Phase 104 and all package versions untouched
until Phase 105.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Convention-URI transposition before wire emission | Runtime-provided web binding | INC and later intent operations | One projection helper owns conversion; received wire identities are already stable. [VERIFIED: `NAP-INC.md@4593ce9`; `projections/web.md@896c32c`] |
| Exact event fan-out and sender exclusion | API/backend runtime | Browser transport | The runtime owns subscription state and recipient dispatch. [VERIFIED: `NAP-INC.md@4593ce9`; `inc-handler.ts`] |
| dTag identity and live endpoint lookup | API/backend runtime | Shell creation-time origin registry | Only host-created session entries can translate a dTag to a live frame. [VERIFIED: `NAP-INC.md@4593ce9`; `session-registry.ts`; `shell-bridge.ts`] |
| Channel authorization, symmetric handles, ordering, and teardown | API/backend runtime + binding | ACL / shell transport | ACL is decided at open; #92 enqueues the target notification before success and requires per-endpoint handle/event/closure retention. [VERIFIED: `NAP-INC.md@c5cd06f`] |
| Public `window.napplet.inc` API | Browser/client injected namespace | Paja/playground `srcdoc` injection | One prelude is injected by both hosts. [VERIFIED: `napplet-namespace.ts`; `browser-target-frame.ts`; `shell-host.ts`] |
| Intent URI binding seam | Browser/client injected namespace | Phase 104 intent domain | Phase 102 leaves the reusable helper available; Phase 104 alone wires it to intent, protects replacement, validates, and delivers. [VERIFIED: `projections/web.md@896c32c`; PR #91] |

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
| Exact `Map` lookup | URI/base-topic/prefix/wildcard matcher | Forbidden for routing by the target NAP; it would make independent topics collide. [VERIFIED: `NAP-INC.md@4593ce9`] |
| Projection-side URI conversion | Runtime URI parser | Forbidden placement: received wire messages must be routed opaquely, not reparsed. [VERIFIED: PRs #89/#90] |
| SessionRegistry dTag resolution | Window ID or pubkey target acceptance | Violates the required exposed identity model and permits non-dTag addressing. [VERIFIED: `NAP-INC.md@4593ce9`] |
| Open-time channel authorization | Per-message channel ACL/payload analysis | Violates the target's auth-on-open model and changes payload semantics. [VERIFIED: `NAP-INC.md@4593ce9`] |

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
       +-- failure: correlated open.result(error)                    +-- target opened push first
                                                                      +-- opener success second
                                                                      |
channel emit/broadcast (fire-and-forget) -> channel state -> peer channel.event
close / endpoint destroyed / ACL revocation -> remove state -> channel.closed to both/survivor
```

The diagram uses a projection-side conversion boundary so the runtime accepts
only stable queryless topics. The transport retains the trusted
source-to-window mapping created by the shell; it never accepts caller-claimed
sender identity. [VERIFIED: PRs #89/#90; shell bridge/runtime]

### Exact File Ownership and Order

| Order | Owned files | Implementation responsibility | Dependency |
|---:|---|---|---|
| 1 | `packages/runtime/src/session-registry.ts`, `packages/runtime/src/types.ts`, matching registry tests | Add internal dTag → live `windowId` lookup with an unambiguous live-entry policy; retain creation-time identity as source of truth. | None |
| 2 | `packages/runtime/src/inc-handler.ts`, `packages/runtime/src/runtime.ts`, `packages/runtime/src/dispatch.test.ts` | Make events/channels serialize dTags, accept only target dTags, enqueue `inc.channel.opened` before success, allocate opaque IDs, and implement closed/cleanup semantics. | 1 |
| 3 | `packages/acl/src/capabilities.ts`, `packages/acl/src/resolve.ts`, relevant ACL tests, only if current capability resolver rechecks INC channel messages | Ensure the capability mapping supports an open-only decision and does not re-authorize payload traffic. | 2 |
| 4 | `packages/shell/src/napplet-namespace.ts`, `packages/shell/src/napplet-namespace.test.ts`, shell README/JSDoc | Implement one projection-wide URI normalizer, symmetric channel handles, opened/event/closed retention, correlation/listener bookkeeping, and replacement-safe INC wrappers; do not alter intent. | 2 |
| 4A | `packages/runtime/src/service-dispatch.ts` and its focused test | Remove generic INC prefix dispatch while preserving exact direct message-domain routing. | 1 |
| 4B | `packages/services/src/{audio-service,notification-service,index,types}.ts`, focused tests | Retire the audio compatibility service and notification INC branch while preserving canonical notification routing. | 1 |
| 4C | Active playground consumers, service E2E tests, docs/skills, and scoped guard | Remove downstream legacy prefix behavior after 4A/4B without rewriting history. | 4A-4B |
| 5 | `packages/paja/src/browser-host.test.ts`, `packages/paja/src/browser-runtime-tabs.ts` tests; `apps/playground` host/unit tests | Prove the shared prelude is injected, survives bundled shim reassignment, and tears runtime state down in both real hosts. | 4 |
| 6 | `tests/e2e/nap-inc.spec.ts`, `tests/e2e/inc-roundtrip.spec.ts`, fixture(s), focused guard tests | Exercise canonical event and channel behavior through sandboxed `srcdoc`; retire legacy test-only calls only after compatibility is deliberately removed. | 4-5 |

### Pattern 1: Projection-wide convention URI transposition

**What:** Inside the serialized prelude, define one binding helper that later
convention-accepting operations can reuse. For Phase 102, only
`makeInc().emit` uses it. Reject invalid input before sending and post only
queryless stable identity plus text payload. Phase 104 wires intent.

**When to use:** Every runtime-provided operation that accepts a convention URI.
A queryless identity passes unchanged; structured payload is accepted only with
a queryless URI. Subscriptions and discovery metadata never use the helper
because they must already be queryless. [VERIFIED: `projections/web.md@896c32c`]

```typescript
// Source: napplet/naps PRs #89/#90 exact heads
const { topic, payload } = transposeConventionUri(topicOrConventionUri, explicitPayload);
fire({ type: 'inc.emit', topic, ...(payload === undefined ? {} : { payload }) });
```

Required parser properties: no fragment; malformed percent encoding rejects;
decoded names are unique; values remain strings; `+` remains a literal plus;
explicit payload plus query rejects. A DOM `URLSearchParams` form decoder must
not be used unless its `+` behavior is neutralized and tests prove the draft
semantics. Whole-namespace and INC-domain proxy assignment must preserve the
INC wrappers. [VERIFIED: exact-head audit] [ASSUMED: a small explicit parser is the
clearest safe implementation]

### Pattern 2: dTag-at-boundary, windowId-internal channel state

**What:** Keep internal maps keyed by opaque host window IDs, but translate sender/peer/target at the API boundary through `SessionEntry.dTag`. Channel state must never leak an internal ID except the shell-generated opaque `channelId`.

**When to use:** Every `inc.event`, `inc.channel.open.result`, `inc.channel.event`, and `inc.channel.list.result`; every `channel.open.target` input. [VERIFIED: `NAP-INC.md@4593ce9`; `SessionEntry` in `packages/runtime/src/types.ts`]

```typescript
// Source: NAP-INC @4593ce9 identity schemas; current SessionRegistry architecture
const targetWindowId = sessionRegistry.getWindowIdByDTag(targetDTag);
if (!targetWindowId) return sendOpenError(id, 'target not found');
const sender = sessionRegistry.getEntryByWindowId(senderWindowId)?.dTag;
```

Reject a target that is not a live dTag; do not fall back to `getEntryByWindowId(target)` or `entry.pubkey === target`. [VERIFIED: `NAP-INC.md@4593ce9`; current `inc-handler.ts:69-74`]

### Pattern 3: Channel lifecycle is a single teardown primitive

**What:** Use one internal `closeChannel(channelId, reason?)` primitive to determine participants, notify the correct endpoints, then remove both `channels` and `channelsByWindow` entries.

**When to use:** Explicit close, endpoint destruction, ACL revocation, and runtime clear. Endpoint destruction notifies only the survivor with `reason: 'peer destroyed'`; an ordinary close notifies both without a reason unless one is specified by policy. [VERIFIED: `NAP-INC.md@4593ce9`]

```typescript
// Source: NAP-INC @4593ce9 “Channel management”
closeChannel(channelId, { destroyedWindowId, reason: 'peer destroyed' });
```

### Anti-Patterns to Avoid

- **Runtime URI parsing:** It would turn a malicious/raw query-bearing wire topic into an unintended base-topic delivery. Route the received string exactly. [VERIFIED: `NAP-INC.md@4593ce9`]
- **`makeInc`-private normalization:** Intent accepts the same URI shape, and a
  later phase must reuse the helper. One projection helper plus
  replacement-safe INC wrappers are required now; intent wrappers belong to
  Phase 104. [VERIFIED: PR #90; namespace proxy audit]
- **Generic/service-owned topic-prefix dispatch:** `topic.split(':')[0]` and
  `startsWith('audio:'|'notifications:')` bypass exact subscription routing and
  can fabricate senderless events. Remove these legacy paths rather than
  translating them into a new convention. [VERIFIED: exact-head downstream
  audit]
- **Window ID/pubkey compatibility target:** It leaks or accepts an identity type prohibited by INC-03. [VERIFIED: `NAP-INC.md@4593ce9`; `inc-handler.ts:69-74`]
- **Per-message channel ACL checks:** They conflict with authorization once at open and invite payload-semantic enforcement. [VERIFIED: `NAP-INC.md@4593ce9`]
- **Separate channel teardown branches:** They leave stale reverse-map routes or inconsistent notifications. [VERIFIED: current `inc-handler.ts:47-67,189-204`; `NAP-INC.md@4593ce9`]
- **Inventing `inc.emit.error` or `inc.unsubscribe.result`:** These operations are fire-and-forget. [VERIFIED: `NAP-INC.md@4593ce9`]

## API Migration and Wire Contract

| Current Kehto behavior | Phase 102 target | Migration rule |
|---|---|---|
| `emit(topic, extraTags?, content?)` parses legacy JSON content. | `emit(topicOrConventionUri, payload?)` sends canonical `inc.emit`. | Keep any legacy adapter private and temporary; canonical path must be direct and tested. [VERIFIED: `napplet-namespace.ts:338-350`; `NAP-INC.md@4593ce9`] |
| `on(topic, callback(payload, synthetic NostrEvent))` listens immediately. | `on(topic, handler(IncEvent))` subscribes with ID correlation and returns a closeable handle. | Match the NAP event shape; do not fabricate a Nostr event as the public contract. [VERIFIED: `napplet-namespace.ts:351-370`; `NAP-INC.md@4593ce9`] |
| Runtime event `sender` is `windowId`. | Runtime event `sender` is source `dTag`. | Resolve from the trusted registered session immediately before delivery. [VERIFIED: `inc-handler.ts:99-111`; `NAP-INC.md@4593ce9`] |
| `channel.open` accepts a window ID or pubkey and returns window ID as peer. | It accepts only a target dTag and returns that peer dTag. | Add dTag live-resolution; unknown/dead target returns correlated `target not found`. [VERIFIED: `inc-handler.ts:69-74,145-158`; `NAP-INC.md@4593ce9`] |
| No injected channel API. | `channel.open/onOpened/list/broadcast`, symmetric handle `emit/on/onClosed/close`. | Build on existing request/fire/listener helpers; retain early target handles, messages, and terminal closure exactly as #92 requires. [VERIFIED: `napplet-namespace.ts`; `NAP-INC.md@c5cd06f`] |
| Destroyed endpoint notifies peer without a reason. | Surviving endpoint gets `inc.channel.closed` with `reason: 'peer destroyed'`. | Reuse unified cleanup and remove all subscriptions/channels. [VERIFIED: `inc-handler.ts:189-204`; `NAP-INC.md@4593ce9`] |

### Exact Routing Rules

1. `subscriptions.get(topic)` is the only delivery match: no prefix, wildcard, normalization, URI parsing, or base/query matching. [VERIFIED: `NAP-INC.md@4593ce9`; `inc-handler.ts:99-111`]
2. A canonical client call `emit('napplet:profile/open?pubkey=a%20b&plus=a+b')` posts `topic: 'napplet:profile/open'` and `payload: { pubkey: 'a b', plus: 'a+b' }`; subscribers subscribe to the stable topic. [VERIFIED: `NAP-INC.md@4593ce9`]
3. A direct/raw wire message with `topic: 'napplet:profile/open?pubkey=x'` is opaque and does **not** match subscription `'napplet:profile/open'`. This is a negative security regression test, not a supported developer API. [VERIFIED: `NAP-INC.md@4593ce9`]
4. Sender exclusion applies to topic fan-out. A channel message goes only to the peer selected by shell state; a broadcast goes only to open peers. [VERIFIED: `NAP-INC.md@4593ce9`]

### Channels, Authorization, and Lifecycle

- `inc.channel.open` is correlated; successful runtime handling enqueues target
  `inc.channel.opened` before sending opener success. Both expose the same
  shell-generated channel ID and runtime-attested opposite peer dTag.
  [VERIFIED: `NAP-INC.md@c5cd06f`]
- Validate target liveness and policy exactly once at open. Later emit/broadcast traffic is routed from established channel state without application-payload interpretation or a second ACL decision. [VERIFIED: `NAP-INC.md@4593ce9`]
- `inc.channel.emit`, `.broadcast`, and `.close` are fire-and-forget;
  `channel.list` is correlated; `inc.channel.opened`/`.event`/`.closed` are
  shell-initiated pushes. The binding retains early opened/event/closed data
  for `onOpened`, handle `on`, and handle `onClosed`. [VERIFIED:
  `NAP-INC.md@c5cd06f`]
- Explicit close notifies both sides and removes the channel. Peer destruction removes every affected route and notifies each surviving peer with `reason: 'peer destroyed'`. ACL revocation must use the same cleanup primitive and an explicitly chosen NAP-permitted reason. [VERIFIED: `NAP-INC.md@4593ce9`] [ASSUMED: the local ACL-revocation hook must be identified during planning because the current audit identifies the policy mismatch but not its invocation site]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Browser-to-frame identity | Caller-supplied sender/peer fields | Existing origin/session registry and `MessageEvent.source` chain | Source-based identity is the stated INC trust boundary. [VERIFIED: `NAP-INC.md@4593ce9`; `shell-bridge.ts`] |
| Channel IDs | dTag-derived or predictable IDs | Existing host crypto UUID hook with opaque storage | IDs must be shell-assigned and unguessable to napplets. [VERIFIED: `NAP-INC.md@4593ce9`; `inc-handler.ts:154`] |
| Transport acknowledgement | New error/result envelopes for fire-and-forget actions | Defined INC wire messages only | Extra acknowledgements are protocol invention. [VERIFIED: `NAP-INC.md@4593ce9`] |
| Separate host APIs | Paja/playground-specific INC implementations | `renderNappletNamespacePrelude` shared by both | A shared injection owner prevents host drift. [VERIFIED: `browser-target-frame.ts`; `shell-host.ts`] |

**Key insight:** INC is not a general client-to-client bus. The shell owns identity, channel state, IDs, and lifecycle; receiving napplets own validation of opaque payload data. [VERIFIED: `NAP-INC.md@4593ce9`]

## Common Pitfalls

### Pitfall 1: Treating the new transposition rule as router behavior

**What goes wrong:** Query-bearing raw wire topics base-match stable subscriptions or have their payload silently changed.
**Why it happens:** URI parsing is added beside `subscriptions.get(topic)` instead of only at injected `emit`.
**How to avoid:** Unit-test the negative raw-wire vector and keep the router's key lookup literal.
**Warning signs:** Any `URL`, `URLSearchParams`, `?`, `split`, prefix, or wildcard code in `inc-handler.ts`. [VERIFIED: `NAP-INC.md@4593ce9`]

### Pitfall 2: Confusing dTag identity with internal transport identity

**What goes wrong:** A caller can target `window-42` or a pubkey, or a recipient sees one of those values as `sender`/`peer`.
**Why it happens:** Current state maps are keyed by window ID and current resolution falls back to pubkey.
**How to avoid:** Preserve window IDs internally, add an explicit dTag lookup at the session boundary, and test all exposed fields.
**Warning signs:** `sender: windowId`, `peer: peerWindow`, `getEntryByWindowId(target)`, or `entry.pubkey === target` in INC code. [VERIFIED: `inc-handler.ts:69-74,106,157,169,184`; `NAP-INC.md@4593ce9`]

### Pitfall 3: ACL at the wrong time

**What goes wrong:** Every channel message is denied/rechecked or application payload affects routing policy.
**Why it happens:** Reusing generic per-message ACL machinery without a channel-open boundary.
**How to avoid:** Resolve capability/policy at `channel.open`, retain only established membership for later delivery, and test that the post-open path does not call the checker.
**Warning signs:** `acl.check`/`enforce` in `channel.emit` or `channel.broadcast`. [VERIFIED: `NAP-INC.md@4593ce9`; `.planning/NAP-CONVENTIONS-6461E4B-DELTA-AUDIT.md:129-141`]

### Pitfall 4: Incomplete teardown

**What goes wrong:** A destroyed frame leaves subscriptions/reverse channel entries, or survivor gets an unqualified close.
**Why it happens:** Explicit close and destruction have separate deletion sequences.
**How to avoid:** Test both state maps after every teardown source and use one close primitive.
**Warning signs:** `removeWindowChannels` sends `.closed` without `peer destroyed` or a route remains listable after cleanup. [VERIFIED: `inc-handler.ts:189-204`; `NAP-INC.md@4593ce9`]

## Code Examples

### Canonical prelude event API

```typescript
// Source: napplet/naps PR #89 head 4593ce9, NAP-INC API/Wire Protocol
const subscription = window.napplet.inc.on('napplet:profile/open', (event) => {
  // event.topic is exact, event.sender is a dTag, event.payload is opaque.
});

window.napplet.inc.emit('napplet:profile/open?pubkey=abc');
subscription.close();
```

### Channel result and cleanup behavior

```typescript
// Source: napplet/naps PR #89 head 4593ce9, NAP-INC “Channel management”
const channel = await window.napplet.inc.channel.open('media-player');
channel.on((event) => consumeUntrustedPayload(event.payload));
channel.emit({ command: 'play' });
channel.close();
```

## State of the Art

| Old approach | Current target approach | When Changed | Impact |
|---|---|---|---|
| Legacy three-argument Nostr-event-flavored INC helper | Direct NAP-INC event/channel API with opaque payload | Targeted by PR #89 draft | Kehto fallback must migrate independently of the not-yet-updated published package. [VERIFIED: installed `@napplet/nap@0.28.0`; `NAP-INC.md@4593ce9`] |
| Query-bearing topic treated as a distinct string because parameter matching was unspecified | `emit` transposes convention URI query before routing; router remains exact after conversion | PR #89 head `4593ce9` | Update Phase 102 requirements/plans, but do not add query-aware matching. [VERIFIED: `git -C ../naps diff 4593ce9^ 4593ce9`; `NAP-INC.md@4593ce9`] |
| Window IDs/pubkeys exposed by current Kehto runtime | dTag-only public identities and shell-owned opaque channel IDs | Existing NAP-INC target | Requires session registry seam and wire regression coverage. [VERIFIED: `inc-handler.ts`; `NAP-INC.md@4593ce9`] |

## Explicitly Deferred: NAP-INTENT Lifecycle

Phase 102 owns the shared web-binding helper required by draft #90 but does not
change or exercise `intent.invoke`. Phase 104 owns the #91 public types/API,
URI normalization wiring, replacement protection, normalized-field consistency
checks, installed manifest contracts,
handler resolution, acceptance-only result, source-independent retained
delivery, `intent.deliver`, and `onDelivery` buffering. Intent delivery must not
be designed as a visible INC flow. [VERIFIED: PR #91 exact head; roadmap]

## Stale Authority Statements Requiring Planner Correction

Do not silently edit these history-bearing documents in Phase 102 research. The planner should add an explicit planning-artifact correction before using their old text as Phase 102 protocol authority:

| Artifact | Stale statement | Required correction |
|---|---|---|
| `.planning/ROADMAP.md` | Earlier draft treated conversion as INC-only and Phase 104 as wholly package-blocked. | Cite #89/#90, own the shared helper in Phase 102, and move independent #91 implementation to Phase 104. [VERIFIED: updated roadmap] |
| `.planning/REQUIREMENTS.md` | Earlier draft described optional/opaque intent convention fields. | Require stable identity, shared binding, and defer only intent lifecycle—not its binding seam. [VERIFIED: updated requirements] |
| `.planning/NAP-CONVENTIONS-6461E4B-DELTA-AUDIT.md` | Earlier audit recorded unresolved query behavior. | Preserve baseline history and point to the exact-head proposed-contract audit. [VERIFIED: updated audit] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | A small explicit query parser is clearer than adapting platform form decoding. | Architecture Patterns | Could produce an unnecessary local helper; tests must still enforce the normative behavior. |
| A2 | ACL revocation uses an internal typed mutation observer and the shared channel teardown primitive selected by Plans 102-02/03. | Channels, Authorization, and Lifecycle | If implementation cannot preserve construction order or exact matching, execution must surface the conflict rather than weaken teardown. |
| A3 | A temporary private adapter may be needed for current legacy fixture consumers until package adoption in Phase 105. | Summary / API Migration | Could retain legacy public behavior too long; gate it behind explicit tests and remove when upstream API is released. |

## Open Questions (RESOLVED)

1. **Which concrete capability names authorize `inc.channel.open`?**
   - What we know: the target permits shell ACL at open and the audit identifies existing resolver behavior that rechecks channel messages. [VERIFIED: `NAP-INC.md@4593ce9`; delta audit]
   - Phase 102 disposition: retain Kehto's existing `relay:read` host-policy
     capability at `inc.channel.open`, map established channel actions to no
     global recheck, and close channels through an internal ACL mutation
     observer on block or `relay:read` revocation. No wire capability is added.

2. **How should duplicate live dTags be handled?**
   - What we know: channels target a dTag and require a live endpoint; the current registry indexes pubkeys and windows, not dTags. [VERIFIED: `NAP-INC.md@4593ce9`; `session-registry.ts`]
   - Phase 102 disposition: the lookup resolves only one live owner. Zero or
     duplicate live owners fail closed through the existing `target not found`
     open result; the runtime never selects an arbitrary frame. [ASSUMED host
     policy, locked in Context/Plan 102-02]

3. **How does a channel's non-opening peer obtain a public handle?**
   - What we know: draft #89 returns a handle-producing result only to the
     opener, forwards `inc.channel.event` to the peer, and makes
     `channel.list()` return plain `ChannelInfo` records. [VERIFIED:
     `NAP-INC.md@4593ce9`]
   - Resolution: draft PR #92 at
     `c5cd06f7be6d4690b303949abb26e87ff62f4729` adds
     `channel.onOpened`, target `inc.channel.opened`, symmetric handles,
     `onClosed`, and ordered retention. `ChannelInfo` stays informational.
   - Phase 102 disposition: implement and test the exact #92 binding/runtime
     contract, including full public bidirectional traffic and early
     handle/event/terminal retention. Keep `kehto/web#203` open until drafts
     and downstream completion. [VERIFIED: tracking reply 5060904495]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---:|---|
| Node.js | TypeScript build/test | ✓ | `v25.2.1` | — |
| pnpm | Workspace commands | ✓ | `10.8.0` | — |
| Vitest | Focused unit suite | ✓ | `4.1.2` | — |
| Playwright workspace runner | `srcdoc` host regressions | ✓ | configured in scripts | Focused unit tests only do not prove sandbox host behavior. |
| Upstream NAP-INC PR #89 checkout | INC authority | ✓ | `4593ce9` | — |
| Upstream governance/web PR #90 checkout | Binding authority | ✓ | `896c32c` | — |
| Upstream symmetric channel PR #92 checkout | Channel binding authority | ✓ | `c5cd06f` | — |

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
| BASE-04 | One shared decoding/rejection helper for convention operations | unit + host integration | focused prelude/host Vitest | ❌ Wave 0 additions |
| BASE-05 | Replacement-safe INC binding, exact normalized routing, and no service-prefix interception | unit + E2E | focused prelude/runtime/service + browser | ❌ Wave 0 additions |
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
- [ ] `packages/shell/src/napplet-namespace.test.ts` additions — shared URI conversion, all rejection cases, INC namespace/domain replacement safety, correlation, symmetric handles, opened/event/closed ordering and retention, and no invented wire replies.
- [ ] `packages/runtime/src/service-dispatch.test.ts` plus service tests — no generic INC prefix interception, no legacy audio/notification prefix handling, no senderless synthetic event, canonical notification envelopes preserved.
- [ ] Paja and playground host regression — execute the shared injected prelude through each `srcdoc` path after real shim assignment.
- [ ] Playwright fixture/spec — two live dTag endpoints proving canonical URI event and channel lifecycle.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes | Trusted `MessageEvent.source` and creation-time session identity; no caller-claimed sender. [VERIFIED: `NAP-INC.md@4593ce9`; `shell-bridge.ts`] |
| V3 Session Management | yes | Phase 101 session gate and removal through `runtime.destroyWindow`. [VERIFIED: `runtime.ts`; Phase 101 context] |
| V4 Access Control | yes | dTag live-target lookup and one ACL decision at `channel.open`. [VERIFIED: `NAP-INC.md@4593ce9`] |
| V5 Input Validation | yes | Reject invalid convention URI inputs before emission; treat inbound payload as opaque/untrusted. [VERIFIED: `NAP-INC.md@4593ce9`] |
| V6 Cryptography | no new crypto | Use existing host UUID source for opaque IDs; do not implement custom crypto. [VERIFIED: `inc-handler.ts:154`] |

### Known Threat Patterns for INC

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Sender/peer spoofing via envelope fields | Spoofing | Derive every exposed dTag from the trusted session entry for the source/endpoint. [VERIFIED: `NAP-INC.md@4593ce9`] |
| Topic confusion through query/base matching | Tampering | Projection-only conversion; exact runtime `Map` key; negative raw-wire test. [VERIFIED: PRs #89/#90] |
| Channel hijack via guessed/caller-supplied IDs | Elevation of privilege | Shell-generated opaque IDs, membership check through internal state, no channel enumeration beyond caller's list. [VERIFIED: `NAP-INC.md@4593ce9`] |
| Unauthorized direct channel | Elevation of privilege | Validate live target and ACL once at open; do not substitute window ID/pubkey. [VERIFIED: `NAP-INC.md@4593ce9`] |
| Stale channel after peer destruction | Denial of service / information disclosure | Unified teardown removes both indexes and notifies survivor with `peer destroyed`. [VERIFIED: `NAP-INC.md@4593ce9`] |
| Untrusted application payload | Tampering | Shell routes it opaquely; receiving napplet validates against its chosen convention. [VERIFIED: `NAP-INC.md@4593ce9`] |

## Sources

### Primary

- [`NAP-INC.md` at PR #89 head `4593ce9`](https://github.com/napplet/naps/blob/4593ce9e301ce098fd3dad64206fcd6f144fa7af/naps/NAP-INC.md) — API, wire, exact routing, runtime-attested sender, channels, lifecycle, security. [VERIFIED: local `napplet/naps` checkout]
- [`NAP-INC.md` at stacked PR #92 head `c5cd06f`](https://github.com/napplet/naps/blob/c5cd06f7be6d4690b303949abb26e87ff62f4729/naps/NAP-INC.md) — symmetric channel handles, target open notification, per-endpoint ordering/retention, and terminal callbacks. [VERIFIED: local `napplet/naps` checkout]
- [`projections/web.md` at PR #90 head `896c32c`](https://github.com/napplet/naps/blob/896c32c92deee68dc4d10fc1132b62df20cccb6f/projections/web.md) — projection-wide convention URI binding and exact normalized resolution. [VERIFIED: local checkout]
- [`NAP-INTENT.md` at PR #91 head `a718915`](https://github.com/napplet/naps/blob/a718915ddefa2f03a0126579601f59d8bd86f7c4/naps/NAP-INTENT.md) — downstream consumer of the shared binding; lifecycle implementation deferred to Phase 104. [VERIFIED: local checkout]
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
**Valid until:** Until PR #89, #90, or #92 changes or merges; recheck all three
exact Phase 102 heads before execution and recheck #91 before Phase 104.
