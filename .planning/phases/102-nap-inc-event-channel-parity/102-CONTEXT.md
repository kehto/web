# Phase 102: NAP-INC Event and Channel Parity — Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Bring Kehto's NAP-INC event and channel implementation into conformance with
`napplet/naps` draft PR #89 at exact head
`34ec29fc4039384a83dbd6b476f83c4fa0d038e6`. This phase owns Kehto's
independent runtime, injected shell API, ACL, Paja, playground, and focused test
work. Published Napplet package adoption remains Phase 104.

</domain>

<decisions>
## Implementation Decisions

### Convention URI emission
- Accept PR #89 as the target contract for this work even while the PR remains
  draft; pin every normative claim and test to the exact head above.
- `emit(topic, payload?)` transposes a queried
  `napplet:<archetype>/<intent>[...?params]` URI before `inc.emit` crosses the
  wire: the routed topic is the queryless path and the payload is a shallow
  text-to-text map.
- Preserve literal `+`, percent-decode names and values once, perform no type
  coercion, and reject fragments, malformed encoding, decoded duplicate names,
  and query plus explicit payload before posting.
- Invalid fire-and-forget calls fail locally; do not invent an
  `inc.emit.error` wire message.

### Routing and identity
- Runtime routing remains exact complete-string equality over the wire topic.
  It must not parse, normalize, prefix-match, wildcard-match, or repeat the
  client-side transposition.
- Delivered event topics remain unchanged. Sender, peer, and direct-target
  identities exposed to napplets are dTags, never window IDs or pubkeys.
- Keep sender exclusion and optional opaque payload preservation.

### Channels
- Implement the complete injected channel surface and normative correlated or
  fire-and-forget behavior.
- Authorize channel membership once at open. Do not reinterpret or revalidate
  application payload semantics per channel message.
- Use shell-assigned opaque identifiers, deterministic teardown, and
  `peer destroyed` notification when a peer disappears.

### Scope boundaries
- The shared injected shell prelude is the canonical Kehto-owned API boundary;
  Paja and playground consume it rather than implementing divergent parsers.
- NAP-INTENT convention values and payloads remain opaque. PR #89 changes only
  NAP-INC; do not add intent-layer query transposition.
- Do not claim published package conformance or invent compatibility overloads
  for unreleased upstream package behavior. Phase 104 owns verified package
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

### Integration Points
- Runtime INC handler and lifecycle teardown.
- ACL channel-open policy.
- Shared injected namespace and its unit tests.
- Paja and playground real-host coverage.
- Phase 104 published `@napplet/nap`/shim package gate.

</code_context>

<deferred>
## Deferred Ideas

- NAP-INTENT query transposition or convention payload parsing.
- Published Napplet dependency upgrades and removal of any temporary
  package-version constraints (Phase 104).
- Full active-surface release sweep (Phase 106).

</deferred>
