# Requirements: v1.29 Napplet Convention and Runtime Conformance

## Goal

Conform Kehto to the v1.29 `napplet/naps` baseline at
`6461e4b37c29dc09a20dff35d9515889c4433874` plus the proposed exact heads of
draft PRs #89, #90, #91, and stacked #92: replace numbered cross-napplet protocol negotiation
with stable queryless convention identities, implement binding-owned
URI-to-payload transposition and runtime-attested sender identity, close every
active supported-NAP gap, and prove the result against convention-capable
published Napplet packages.

## Authority and Boundary

- Merged baseline: `napplet/naps` `master` at
  `6461e4b37c29dc09a20dff35d9515889c4433874`.

- Proposed NAP-INC authority: draft PR #89 head
  `4593ce9e301ce098fd3dad64206fcd6f144fa7af`.

- Proposed governance/web projection authority: draft PR #90 head
  `896c32c92deee68dc4d10fc1132b62df20cccb6f`.

- Proposed NAP-INTENT authority: draft PR #91 head
  `a718915ddefa2f03a0126579601f59d8bd86f7c4`.

- Proposed symmetric NAP-INC channel authority: draft PR #92 head
  `c5cd06f7be6d4690b303949abb26e87ff62f4729`, stacked on PR #89 head
  `4593ce9e301ce098fd3dad64206fcd6f144fa7af`.

- The drafts are open and unmerged. Their exact heads are proposed contract for
  this chase; any head change requires re-audit before implementation or final
  dependency adoption.

- Direct comparison baseline: parent `5fd99465892fbead3888d7146e1737f77b0ed0b4`.
- Kehto baseline: canonical `origin/main` at `bb3929b3523b75356fd65f658f9bd14c7ff697e4`.
- Baseline audit: `.planning/NAP-CONVENTIONS-6461E4B-DELTA-AUDIT.md`.
- Exact-head downstream violation matrix:
  `.planning/NAP-CONVENTIONS-DRAFT-PRS-89-90-91-92-AUDIT.md`.

- Package gate: final conformance requires convention-capable `@napplet/core`, `@napplet/nap`, `@napplet/shim`, `@napplet/sdk`, and `@napplet/vite-plugin` releases. Kehto may complete independent runtime work first but must not guess unpublished public APIs.
- Shared-binding boundary: Phase 102 creates one projection-owned convention URI
  normalizer and wires it only to INC. Phase 104 reuses that helper when it
  replaces the intent public API and owns normalized-field validation,
  resolution, acceptance, and delivery lifecycle.

## Functional Requirements

### BASE-01: Runtime NAP Ontology

Active code and documentation describe NAPs only as runtime-provided API/capability surfaces. Cross-napplet payload shapes are unnumbered conventions and are never advertised as numbered `NAP-N` protocols.

### BASE-02: Stable Convention Identity

The stable identity is exactly `napplet:<archetype>/<intent>`. Query parameters
are per-invocation payload sugar and never appear in subscriptions, normalized
wire identities, handler metadata, or discovery. Kehto creates neither a
numbered registry nor payload schemas derived from NAAT names.

### BASE-04: Shared URI-to-Payload Binding

Every runtime-provided web operation that accepts a convention URI uses one
projection-owned normalizer before `postMessage`. Each unique percent-decoded
`name=value` pair becomes a text payload field; `+` remains literal and values
are never coerced. Fragments, malformed percent encoding, repeated decoded
names, and query plus explicit payload reject locally without sending. Phase
102 wires this helper to INC; Phase 104 reuses it for intent without creating a
second parser.

### BASE-05: Exact Normalized Resolution

Runtime routing and handler resolution use exact equality on complete queryless
identities. No prefix, wildcard, base/query, query-aware matching, or runtime
query parser exists. Generic service dispatch and host visualizers do not
intercept INC traffic by topic prefix.

### BASE-03: Historical Material Boundary

Active code, tests, configs, READMEs, and policies are migrated. Changelogs, archived `.planning` artifacts, migration records, and historical requirement IDs remain intact; the dated intent design receives a superseded banner if it remains discoverable as guidance.

### PKG-01: Published Intent Contracts

Selected published `@napplet/core` and `@napplet/nap` versions expose
URI-authoritative intent invocation, stable convention contracts,
acceptance-only results, and carrier-neutral delivery, with no canonical
`protocol`/`protocols`, `handled`, `windowId`, `newWindow`, intent ID, or
delivery ID fields.

### PKG-02: Published Shell Contracts

Selected published `@napplet/core` and `@napplet/shim` versions expose the NAP-SHELL environment/global contract, include the `shell` domain, perform one ready/init bootstrap, and answer `supports(domain)` synchronously from local initialized state.

### PKG-03: Published Manifest and SDK Contracts

Selected published `@napplet/vite-plugin` accepts convention-contract
configuration and emits one
`["archetype","<slug>","<convention>","kind:<number>", ...]` tag per contract;
`@napplet/sdk` is rebuilt against the same binding and intent contracts.

### PKG-04: Registry and Lockfile Alignment

Kehto package ranges, napplet/fixture pins, and `pnpm-lock.yaml` use verified convention-capable npm releases, with matching JSR lineage where packages publish to both registries.

### SHELL-01: Domain-Only Capability Discovery

The public/injected API is exactly `supports(domain)`. No optional second protocol argument, `capabilities.protocols`, numbered flat `naps`, or `inc:NAP-01` through `inc:NAP-06` entries remain in active surfaces.

### SHELL-02: Truthful Local Support

Before `shell.init`, every `supports()` query returns `false`. After init it returns `true` only for granted, implemented domains and `false` for unknown or unoffered domains.

### SHELL-03: Mandatory Handshake

The napplet sends one bare `shell.ready`; the runtime sends one uncorrelated `shell.init` after the first ready. Duplicate ready is idempotent and never creates a second session or init delivery.

### SHELL-04: Pre-Session Isolation

No capability handler services traffic from a frame before its session is established. Creation-time identity and source-window trust cannot be reassigned through messages.

### SHELL-05: Environment Isolation

Capabilities and services are scoped per napplet, readonly to napplet code, and never leak between frames. `shell.init` carries only the normative `capabilities` and `services` environment fields.

### SHELL-06: Host Advertisement Integrity

Shell, Paja, and playground advertise a domain only when a live implementation is wired; simulation/disabled-domain controls remove it consistently.

### INTENT-01: URI-Authoritative API

The injected API is `invoke(uri, options?)` plus `open(uri, options?)` sugar
whose URI intent must be `open`. The binding derives required `archetype`,
`action`, queryless `convention`, and optional query-derived `payload`;
structured or non-text data uses `options.payload` with a queryless URI.

### INTENT-02: Normalized Request Validation

The runtime rejects any normalized request whose convention contains a query or
fragment, whose convention archetype differs from `request.archetype`, or whose
convention intent differs from `request.action`. After normalization, payload
content remains opaque.

### INTENT-03: Exact Public Data Model

Public types expose `IntentInvokeOptions`, `IntentBehavior` with only
`focus`/`reuse`, required normalized `IntentRequest` fields,
`IntentContract`, `IntentCandidate` with required `conventions` and `contracts`,
acceptance-only `IntentResult`, and `IntentDelivery`. Canonical types and wire
objects contain no protocol fields, `newWindow`, `handled`, `windowId`,
intent/delivery ID, or caller-supplied sender.

### INTENT-04: Installed Manifest Contracts

Availability and handlers come from installed, verified NIP-5A manifests rather
than only running frames or unsigned host claims. Every archetype tag produces
one contract with a stable queryless convention and optional scoped unsigned
event kinds. Repeated same-archetype contracts are preserved.

### INTENT-05: Exact Contract Resolution

The runtime resolves an exact convention contract and never synthesizes an
omitted convention, invents an action, or inspects payload content to infer an
event kind. A compatible candidate may be installed without already running.

### INTENT-06: User-Controlled and Authorized Selection

User-overridable defaults are honored. Multiple eligible candidates use a
chooser or documented user-policy equivalent rather than silently choosing the
first. Explicit handler dTags require installation, compatible manifest
contract, and user/policy authorization.

### INTENT-07: Acceptance-Only Result

`ok: true` means the runtime accepted delivery responsibility, not that the
target received or handled the intent. A successful result includes normalized
archetype, action, convention, and handler; a failed result includes a
pre-acceptance error. The ordinary request `id` correlates only this immediate
result, and policy denial uses the same structured result rather than
`intent.*.error`.

### INTENT-08: Source-Independent Delivery

After acceptance the runtime retains the normalized delivery independently of
the source until delivery succeeds or runtime policy reaches terminal failure.
It sends the immediate result before any policy-driven source close and delivers
only after target readiness.

### INTENT-09: Runtime-Attested IntentDelivery

`intent.deliver` carries one carrier-neutral `IntentDelivery` with a sender dTag
derived from the authenticated source endpoint. Caller sender data is ignored or
rejected; delivery reaches only the resolved target and has no request or
delivery ID.

### INTENT-10: Binding Buffer and Lifecycle Neutrality

The binding retains an incoming delivery until `onDelivery` registers. Delivery
does not depend on NAP-INC or source liveness. Reuse, source/target ordering and
overlap, retries, target replacement, restart persistence, and terminal-failure
handling remain runtime policy; no public field constrains them.

### INTENT-11: Discovery Change Notification

Loaded eligible clients receive `intent.changed` when installed contracts,
defaults, or relevant availability changes, even if they have not previously
sent an intent service request.

### INC-01: Opaque Convention Topics

The developer-facing `emit` API accepts
`napplet:<archetype>/<intent>[...?params]`. The shared web binding transposes a
query before emission; the wire, subscriptions, delivery, and handler metadata
carry only the stable queryless topic. Runtime routing uses exact
complete-string equality and no prefix, wildcard, normalization, query parsing,
or base/query matching.

### INC-02: Emit and Subscription API

The injected API provides `emit(topic, payload?)`, queryless `on(topic,
handler)`, correlated subscribe results, closeable subscriptions,
fire-and-forget unsubscribe, and `IncEvent` objects with runtime-attested sender
dTags. Invalid fire-and-forget emits fail locally and send no wire message.
Later shim/SDK namespace or INC-domain assignment cannot replace or bypass
these projection-owned operations.

### INC-03: Sender and Target Identity

The emitter never supplies or overrides `sender`; the runtime derives it from
the authenticated source endpoint. All exposed event/channel `sender`, `peer`,
and direct targets are napplet dTags. Window IDs and pubkeys are never exposed
as napplet identities or accepted as substitutes.

### INC-04: Exact Routing and Exclusion

Events route by exact queryless topic, exclude the sender, preserve optional
payloads, and use runtime-assigned opaque subscription/channel IDs. Raw
query-bearing wire topics do not match stable subscriptions.

### INC-05: Channel Surface

The injected API implements `channel.open`, `channel.onOpened`, `channel.list`,
and `channel.broadcast`, plus symmetric endpoint channel handles with `emit`,
`on`, `onClosed`, and `close`, matching the exact #92 wire shapes.
`channel.list()` returns informational `ChannelInfo` only and never constructs
or attaches a handle.

### INC-06: Channel Authorization

Channel membership/auth is enforced at open time. Per-message channel traffic is not reinterpreted or revalidated as application payload semantics.

### INC-07: Channel Lifecycle

Dead targets return the specified failure, peer destruction closes affected channels with reason `peer destroyed`, and list/broadcast/close cleanup behavior is covered.
The runtime enqueues the target `inc.channel.opened` before reporting success to
the opener. The binding materializes each endpoint handle before any event or
closure, retains an inbound handle until `channel.onOpened`, retains early
messages until `ChannelHandle.on`, and retains terminal closure for a later
`ChannelHandle.onClosed`. Any bounded-buffer overflow closes and notifies both
endpoints rather than dropping data.

### INC-08: Transport Semantics

Emit/unsubscribe remain fire-and-forget; subscription/channel requests remain correlated; sender exclusion and teardown notification behavior remain intact.
Channel-open success means only that runtime channel state exists and the target
notification was enqueued, not that the target registered an application
handler or accepted application semantics.

### IDENTITY-01: Public-Key Result Contract

`identity.getPublicKey` always replies with `identity.getPublicKey.result`; failure yields `pubkey: ""` and never an `.error` wire message.

### IDENTITY-02: Identity Result Shapes

Other supported identity actions return matching `.result` shapes with safe defaults and optional sanctioned error data. Unknown actions are ignored rather than producing non-contract messages.

### IDENTITY-03: Readonly and Change Semantics

The injected identity API is readonly. Identity changes broadcast the normative change event, including `""` on sign-out, exactly once to affected frames.

### IDENTITY-04: Identity Privacy and Isolation

Identity grants are scoped per napplet/session and cannot be forged, reassigned, or leaked through intent/INC routing.

### IDENTITY-05: Resource-Mediated Profile Media

Playground/profile consumers retrieve remote profile bytes through NAP-RESOURCE and render safe object URLs with cleanup; they do not directly assign remote profile URLs to image elements.

### THEME-01: Theme Get Contract

`theme.get` replies only with `theme.get.result`, always carrying all required colors and using only contract-sanctioned optional error data.

### THEME-02: Unknown Theme Actions

Unknown theme actions are ignored; ACL denial and unavailable-service paths do not create `theme.*.error` wire types.

### THEME-03: Atomic Theme Updates

A host theme update atomically updates stored `theme.get` state and emits exactly one `theme.changed` event with the same complete theme.

### THEME-04: Host Integration

Paja and playground bridge theme updates to frames and keep the service’s stored state synchronized; required-theme napplets receive the current theme.

### THEME-05: No Invented Subscription Protocol

Kehto exposes only normative get/change behavior and does not invent theme subscribe/unsubscribe wire messages.

### ARCH-01: Convention-Bearing Archetype Tags

Manifest parsing and generation preserve one
`["archetype","<slug>","<stable-convention>","kind:<number>", ...]` tag per
accepted contract. The convention is required, queryless, and has the same
archetype as the slug; repeated tags and optional contract-local unsigned event
kinds remain distinct.

### ARCH-02: NAAT Boundaries

NAAT slugs, actions, boundaries, and “none yet” defaults remain upstream-defined; Kehto does not treat NAAT definitions as payload schemas or invent defaults for feed/feed-images/feed-videos/feed-manager/composer/pet.

### ARCH-03: Playground Profile Convention

The live feed calls `intent.invoke("napplet:profile/open?pubkey=...")`. The
profile handler advertises stable `napplet:profile/open`, registers
`onDelivery`, and receives one buffered `IntentDelivery` containing queryless
convention, text payload, and runtime-attested feed dTag. The flow exposes no
INC delivery envelope or query-bearing discovery identity.

### ARCH-04: Convention Validation

Build tooling validates stable convention declarations, matching archetype
slugs, and unsigned event-kind metadata; it rejects query/fragment-bearing
metadata, malformed conventions/kinds, and obsolete `NAP-N` declarations.
Runtime resolution never infers a kind from payload data.

## Quality and Release Requirements

### VERIFY-01: Focused Contract Tests

Unit and integration tests cover every requirement above, including negative wire-shape assertions and pre-session/security invariants.

### VERIFY-02: Static Active-Surface Guard

A repository guard proves no obsolete numbered negotiation or old intent field names remain in active code/docs/config while excluding classified historical material and unrelated uses of “protocol.”

### VERIFY-03: End-to-End Proof

Playwright proves NAP-SHELL gating, convention intent selection/delivery, exact INC routing and channels, identity sign-out/resource mediation, and atomic theme changes through the real shell path.

### VERIFY-04: Full Regression Gates

`pnpm build`, `pnpm type-check`, `pnpm test:unit`, relevant and full `pnpm test:e2e`, `pnpm docs:check`, the repository AI-slop gate, and `git diff --check` pass.

### VERIFY-05: Release Artifacts

Changesets cover every changed published `@kehto/*` surface; the branch is based on current canonical `origin/main`, pushed without touching the default branch, and a concise PR is opened only after all gates pass.

### VERIFY-06: Draft-Head and Package Revalidation

Before final merge readiness, Kehto re-fetches draft PRs #89-#92, reports any
head/semantic drift rather than guessing, and verifies the published npm/JSR
line implements the same contract used by source, tests, generated docs, and
lockfile.

## Non-Goals

- Defining a universal convention registry or allocating convention numbers.
- Inventing query-aware routing, subscription, or handler matching; URI
  normalization occurs only at the runtime-provided binding before the wire.

- Interpreting normalized convention payload content in the runtime.
- Choosing retry, restart-persistence, target-replacement, overlap, or terminal
  failure policy beyond the minimum seams/tests needed to prove the contract
  remains policy-neutral.

- Rewriting historical changelogs, archived milestone artifacts, or migration records.
- Publishing Napplet packages from the Kehto repository.
- Preserving numbered negotiation as a canonical compatibility API.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHELL-01 | Phase 101 | Complete |
| SHELL-02 | Phase 101 | Complete |
| SHELL-03 | Phase 101 | Complete |
| SHELL-04 | Phase 101 | Complete |
| SHELL-05 | Phase 101 | Complete |
| SHELL-06 | Phase 101 | Complete |
| BASE-04 | Phase 102 | Complete |
| BASE-05 | Phase 102 | Complete |
| INC-01 | Phase 102 | Complete |
| INC-02 | Phase 102 | Complete |
| INC-03 | Phase 102 | Complete |
| INC-04 | Phase 102 | Complete |
| INC-05 | Phase 102 | Complete |
| INC-06 | Phase 102 | Pending |
| INC-07 | Phase 102 | Complete |
| INC-08 | Phase 102 | Complete |
| IDENTITY-01 | Phase 103 | Pending |
| IDENTITY-02 | Phase 103 | Pending |
| IDENTITY-03 | Phase 103 | Pending |
| IDENTITY-04 | Phase 103 | Pending |
| THEME-01 | Phase 103 | Pending |
| THEME-02 | Phase 103 | Pending |
| THEME-03 | Phase 103 | Pending |
| THEME-05 | Phase 103 | Pending |
| BASE-01 | Phase 104 | Pending |
| BASE-02 | Phase 104 | Pending |
| INTENT-01 | Phase 104 | Pending |
| INTENT-02 | Phase 104 | Pending |
| INTENT-03 | Phase 104 | Pending |
| INTENT-04 | Phase 104 | Pending |
| INTENT-05 | Phase 104 | Pending |
| INTENT-06 | Phase 104 | Pending |
| INTENT-07 | Phase 104 | Pending |
| INTENT-08 | Phase 104 | Pending |
| INTENT-09 | Phase 104 | Pending |
| INTENT-10 | Phase 104 | Pending |
| INTENT-11 | Phase 104 | Pending |
| ARCH-01 | Phase 104 | Pending |
| ARCH-02 | Phase 104 | Pending |
| ARCH-04 | Phase 104 | Pending |
| PKG-01 | Phase 105 | Pending |
| PKG-02 | Phase 105 | Pending |
| PKG-03 | Phase 105 | Pending |
| PKG-04 | Phase 105 | Pending |
| IDENTITY-05 | Phase 105 | Pending |
| THEME-04 | Phase 105 | Pending |
| ARCH-03 | Phase 105 | Pending |
| BASE-03 | Phase 106 | Pending |
| VERIFY-01 | Phase 106 | Pending |
| VERIFY-02 | Phase 106 | Pending |
| VERIFY-03 | Phase 106 | Pending |
| VERIFY-04 | Phase 106 | Pending |
| VERIFY-05 | Phase 106 | Pending |
| VERIFY-06 | Phase 106 | Pending |
