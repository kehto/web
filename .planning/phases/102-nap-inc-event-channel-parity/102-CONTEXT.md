# Phase 102: NAP-INC Event and Channel Parity — Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Bring Kehto's NAP-INC event and channel implementation into conformance with
`napplet/naps` draft PR #89 at exact head
`4593ce9e301ce098fd3dad64206fcd6f144fa7af` and the shared convention binding
in draft PR #90 at exact head
`896c32c92deee68dc4d10fc1132b62df20cccb6f`, plus symmetric channel binding
draft PR #92 at exact head
`c5cd06f7be6d4690b303949abb26e87ff62f4729` stacked on #89. This phase owns Kehto's
independent runtime, shared injected binding/API, ACL, Paja, playground, and
focused test work. It creates the projection helper that Phase 104 will reuse
for NAP-INTENT without changing the current intent API; the full intent
lifecycle remains Phase 104 and published package adoption remains Phase 105.

</domain>

<decisions>
## Implementation Decisions

### Convention URI emission
- Accept PR #89 as the target contract for this work even while the PR remains
  draft; pin every normative claim and test to the exact head above.
- One projection-owned helper transposes a queried
  `napplet:<archetype>/<intent>[...?params]` URI before `inc.emit` crosses the
  wire: the routed topic is the queryless path and the payload is a shallow
  text-to-text map.
- Preserve literal `+`, percent-decode names and values once, perform no type
  coercion, and reject fragments, malformed encoding, decoded duplicate names,
  and query plus explicit payload before posting.
- Invalid fire-and-forget calls fail locally; do not invent an
  `inc.emit.error` wire message.
- Keep the helper outside `makeInc` so Phase 104 can reuse it, but do not modify
  `makeIntent`, `intent.invoke`, `intent.open`, or intent replacement behavior
  in this phase.
- Protect projection-owned INC operations when later shim/SDK assignment
  replaces the INC domain or the whole namespace. Phase 104 extends the same
  ownership rule to its replacement intent API.
- Subscriptions and handler metadata accept only stable queryless identities.

### Routing and identity
- Runtime routing remains exact complete-string equality over the wire topic.
  It must not parse, normalize, prefix-match, wildcard-match, or repeat the
  client-side transposition.
- Delivered event topics remain unchanged. The emitter cannot provide or
  override `sender`; the runtime derives it from the authenticated endpoint.
  Sender, peer, and direct-target identities exposed to napplets are dTags,
  never window IDs or pubkeys.
- Keep sender exclusion and optional opaque payload preservation.

### Channels
- Implement `channel.open/onOpened/list/broadcast` and symmetric endpoint
  handles with `emit/on/onClosed/close`, including normative correlated,
  push, and fire-and-forget behavior.
- Authorize channel membership once at open. Do not reinterpret or revalidate
  application payload semantics per channel message.
- Use shell-assigned opaque identifiers, deterministic teardown, and
  `peer destroyed` notification when a peer disappears.
- Per draft #92, enqueue target `inc.channel.opened` before opener success and
  materialize equivalent handles for both endpoints. Retain an early inbound
  handle until `channel.onOpened`, early channel events until handle `on`, and
  terminal closure until `onClosed`; if Kehto bounds these buffers, overflow
  closes and notifies both endpoints rather than dropping.
- Keep `channel.list()` informational. It neither materializes nor attaches a
  handle. Open success establishes runtime state and enqueued target delivery,
  not application handler registration or consent.

### Scope boundaries
- The shared injected shell prelude is the canonical Kehto-owned API boundary;
  Paja and playground consume it rather than implementing divergent parsers.
- Draft #90 applies the same URI-to-payload binding to convention-accepting
  operations, including intent. Build the reusable parser seam here and wire it
  only to INC; Phase 104 owns the URI-authoritative intent API,
  normalized-field validation, replacement protection, resolution, acceptance,
  and carrier-neutral delivery.
- Remove generic `inc.emit` topic-prefix service dispatch and retire the
  `audio:*` / `notifications:*` service compatibility paths that fabricate
  senderless events. Canonical service-domain envelopes remain independent.
- Do not claim published package conformance or invent compatibility overloads
  for unreleased upstream package behavior. Phase 105 owns verified package
  adoption.
- Preserve historical changelogs and archived planning.

### the agent's Discretion
- Internal helper names, error class/message, opaque-ID generator, and exact
  task/wave decomposition, provided observable behavior and security boundaries
  match the pinned contract.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/runtime/src/inc-handler.ts` already centralizes event fan-out and
  channel state.
- `packages/shell/src/napplet-namespace.ts` is shared by Paja and playground
  injection and is the pre-wire preprocessing seam.
- Existing runtime/session identity maps can translate trusted window sources
  to dTags.
- Phase 101 established trusted source binding and truthful per-frame shell
  environments.
- Whole-namespace and per-domain proxy assignment are bypass risks that must
  retain projection-owned normalization after a shim/SDK loads.

### Integration Points
- Runtime INC handler and lifecycle teardown.
- Generic runtime service dispatch plus the legacy audio/notification INC
  compatibility surfaces and active host visualizer/docs that recognize them.
- ACL channel-open policy.
- Shared injected namespace and its unit tests.
- Paja and playground real-host coverage.
- Phase 105 published `@napplet/nap`/shim package gate.

</code_context>

<deferred>
## Deferred Ideas

- NAP-INTENT public URI normalization, replacement protection, resolution,
  acceptance, delivery retention, `onDelivery`, and manifest contract
  implementation (Phase 104).
- Published Napplet dependency upgrades and removal of any temporary
  package-version constraints (Phase 105).
- Full active-surface release sweep (Phase 106).

</deferred>
