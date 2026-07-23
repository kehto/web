# Requirements: v1.29 Napplet Convention and Runtime Conformance

## Goal

Conform Kehto to `napplet/naps` commit `6461e4b37c29dc09a20dff35d9515889c4433874`: replace numbered cross-napplet protocol negotiation with ad hoc conventions, close every active Kehto gap in the supported NAP-SHELL, NAP-INTENT, NAP-INC, NAP-IDENTITY, and NAP-THEME contracts, and prove the result against convention-capable published Napplet packages.

## Authority and Boundary

- Normative authority: `napplet/naps` `master` at `6461e4b37c29dc09a20dff35d9515889c4433874`.
- Direct comparison baseline: parent `5fd99465892fbead3888d7146e1737f77b0ed0b4`.
- Kehto baseline: canonical `origin/main` at `bb3929b3523b75356fd65f658f9bd14c7ff697e4`.
- Complete audit: `.planning/NAP-CONVENTIONS-6461E4B-DELTA-AUDIT.md`.
- Package gate: final conformance requires convention-capable `@napplet/core`, `@napplet/nap`, `@napplet/shim`, `@napplet/sdk`, and `@napplet/vite-plugin` releases. Kehto may complete independent runtime work first but must not guess unpublished public APIs.

## Functional Requirements

### BASE-01: Runtime NAP Ontology

Active code and documentation describe NAPs only as runtime-provided API/capability surfaces. Cross-napplet payload shapes are unnumbered conventions and are never advertised as numbered `NAP-N` protocols.

### BASE-02: Canonical Convention Shape

Archetype-scoped conventions are opaque strings using `napplet:<archetype>/<intent>[...?params]`; Kehto creates neither a numbered registry nor payload schemas derived from NAAT names.

### BASE-03: Historical Material Boundary

Active code, tests, configs, READMEs, and policies are migrated. Changelogs, archived `.planning` artifacts, migration records, and historical requirement IDs remain intact; the dated intent design receives a superseded banner if it remains discoverable as guidance.

### PKG-01: Published Intent Contracts

Selected published `@napplet/core` and `@napplet/nap` versions expose `convention`/`conventions` intent fields and no canonical `protocol`/`protocols` intent fields.

### PKG-02: Published Shell Contracts

Selected published `@napplet/core` and `@napplet/shim` versions expose the NAP-SHELL environment/global contract, include the `shell` domain, perform one ready/init bootstrap, and answer `supports(domain)` synchronously from local initialized state.

### PKG-03: Published Manifest and SDK Contracts

Selected published `@napplet/vite-plugin` accepts convention-bearing archetype configuration and emits `["archetype","<slug>","<convention>"]`; `@napplet/sdk` is rebuilt against the same convention intent contracts.

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

### INTENT-01: Convention Field Migration

`IntentOpenOptions`, `IntentRequest`, and `IntentResult` use optional `convention`; `IntentCandidate` uses required `conventions: string[]`. Canonical serialization emits no `protocol` or `protocols`.

### INTENT-02: Opaque Payload Routing

`archetype` selects handlers and `convention` names payload parsing. The shell treats payloads as opaque, does not mutate them beyond routing needs, and does not mechanically derive convention from archetype.

### INTENT-03: Installed Verified Catalog

Availability and handlers are sourced from installed, verified NIP-5A/NIP-5D manifests rather than unsigned host-injected catalog claims.

### INTENT-04: Explicit and Default Selection

Explicit convention selection validates handler support. Omission may select the archetype’s recommended default; note/profile/dm defaults are exactly `napplet:note/open`, `napplet:profile/open`, and `napplet:dm/open`, while archetypes with no upstream default remain unset.

### INTENT-05: User-Controlled Resolution

User-overridable defaults are honored. Multiple eligible candidates use a chooser or an explicitly documented user-policy equivalent; Kehto does not silently choose the first installed candidate.

### INTENT-06: Authorized Targeting

Explicit dTag targeting is authorized by shell policy and cannot bypass installation, manifest, or user-choice constraints.

### INTENT-07: Ready-Before-Delivery

Resolved payloads are delivered only after the selected handler is ready, using a convention INC event or cold-start initial state without exposing unrelated identity data.

### INTENT-08: Wire Results and Errors

Existing intent request/result names and correlation IDs remain unchanged. Success and failure use matching `*.result` envelopes; unsupported conventions use exact vocabulary `unsupported convention`; ACL denial does not invent `intent.*.error`.

### INTENT-09: Catalog Change Notification

Loaded clients receive `intent.changed` when installed handlers, defaults, or relevant availability changes.

### INC-01: Opaque Convention Topics

INC accepts and carries exact `napplet:<archetype>/<intent>[...?params]` topics. It adds no prefix, wildcard, query-stripping, or base/query matching not defined upstream. The pending protocol decision is tracked in `kehto/web#203`.

### INC-02: Emit and Subscription API

The injected API provides `emit(topic, payload?)`, `on(topic, handler)`, correlated subscribe results, closeable subscriptions, fire-and-forget unsubscribe, and `IncEvent` objects with shell-derived sender dTags.

### INC-03: Sender and Target Identity

All exposed `sender`, `peer`, and direct targets are napplet dTags. Window IDs and pubkeys are never exposed as napplet identities or accepted as substitutes.

### INC-04: Exact Routing and Exclusion

Events route by exact opaque topic, exclude the sender, preserve optional payloads, and use shell-assigned opaque IDs/channel IDs.

### INC-05: Channel Surface

The injected API implements `channel.open`, `channel.list`, and `channel.broadcast`, plus channel handles with `emit`, `on`, and `close`, matching normative result envelopes.

### INC-06: Channel Authorization

Channel membership/auth is enforced at open time. Per-message channel traffic is not reinterpreted or revalidated as application payload semantics.

### INC-07: Channel Lifecycle

Dead targets return the specified failure, peer destruction closes affected channels with reason `peer destroyed`, and list/broadcast/close cleanup behavior is covered.

### INC-08: Transport Semantics

Emit/unsubscribe remain fire-and-forget; subscription/channel requests remain correlated; sender exclusion and teardown notification behavior remain intact.

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

Manifest parsing and generation preserve `["archetype","<slug>","<convention>"]` tags, including multiple tags and absent conventions, without numbered-NAP validation.

### ARCH-02: NAAT Boundaries

NAAT slugs, actions, boundaries, and “none yet” defaults remain upstream-defined; Kehto does not treat NAAT definitions as payload schemas or invent defaults for feed/feed-images/feed-videos/feed-manager/composer/pet.

### ARCH-03: Playground Profile Convention

The live profile-open flow advertises and uses `napplet:profile/open`. Any query-bearing topic is treated as a distinct exact topic until upstream defines parameter matching.

### ARCH-04: Convention Validation

Build tooling validates replacement convention declarations as well-formed opaque convention strings and rejects obsolete `NAP-N` declarations, without adding kind-constraint semantics absent from the upstream tag.

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

## Non-Goals

- Defining a universal convention registry or allocating convention numbers.
- Inventing query-aware INC subscription matching while upstream leaves it unspecified.
- Rewriting historical changelogs, archived milestone artifacts, or migration records.
- Publishing Napplet packages from the Kehto repository.
- Preserving numbered negotiation as a canonical compatibility API.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHELL-01 | Phase 101 | Pending |
| SHELL-02 | Phase 101 | Pending |
| SHELL-03 | Phase 101 | Complete |
| SHELL-04 | Phase 101 | Complete |
| SHELL-05 | Phase 101 | Complete |
| SHELL-06 | Phase 101 | Pending |
| INC-01 | Phase 102 | Pending |
| INC-02 | Phase 102 | Pending |
| INC-03 | Phase 102 | Pending |
| INC-04 | Phase 102 | Pending |
| INC-05 | Phase 102 | Pending |
| INC-06 | Phase 102 | Pending |
| INC-07 | Phase 102 | Pending |
| INC-08 | Phase 102 | Pending |
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
| PKG-01 | Phase 104 | Pending |
| PKG-02 | Phase 104 | Pending |
| PKG-03 | Phase 104 | Pending |
| PKG-04 | Phase 104 | Pending |
| INTENT-01 | Phase 104 | Pending |
| INTENT-02 | Phase 104 | Pending |
| INTENT-03 | Phase 104 | Pending |
| INTENT-04 | Phase 104 | Pending |
| INTENT-05 | Phase 104 | Pending |
| INTENT-06 | Phase 104 | Pending |
| INTENT-07 | Phase 104 | Pending |
| INTENT-08 | Phase 104 | Pending |
| INTENT-09 | Phase 104 | Pending |
| ARCH-01 | Phase 104 | Pending |
| ARCH-02 | Phase 104 | Pending |
| ARCH-04 | Phase 104 | Pending |
| IDENTITY-05 | Phase 105 | Pending |
| THEME-04 | Phase 105 | Pending |
| ARCH-03 | Phase 105 | Pending |
| BASE-03 | Phase 106 | Pending |
| VERIFY-01 | Phase 106 | Pending |
| VERIFY-02 | Phase 106 | Pending |
| VERIFY-03 | Phase 106 | Pending |
| VERIFY-04 | Phase 106 | Pending |
| VERIFY-05 | Phase 106 | Pending |
