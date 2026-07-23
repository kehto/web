# Napplet Convention and Supported-NAP Delta Audit

**Audit date:** 2026-07-23  
**Upstream authority:** `napplet/naps@6461e4b37c29dc09a20dff35d9515889c4433874`  
**Proposed overrides:** draft PR #89 head `4593ce9e301ce098fd3dad64206fcd6f144fa7af`,
PR #90 head `896c32c92deee68dc4d10fc1132b62df20cccb6f`, and PR #91 head
`a718915ddefa2f03a0126579601f59d8bd86f7c4`, plus stacked PR #92 head
`c5cd06f7be6d4690b303949abb26e87ff62f4729`
**Upstream parent:** `5fd99465892fbead3888d7146e1737f77b0ed0b4`  
**Kehto baseline:** `kehto/web@bb3929b3523b75356fd65f658f9bd14c7ff697e4`

The complete exact-head downstream violation matrix is
`.planning/NAP-CONVENTIONS-DRAFT-PRS-89-90-91-92-AUDIT.md`. The four PRs remain
draft and unmerged; their heads are proposed authority for this chase and must
be re-audited if they change.

## Verdict

Kehto does not conform to the current supported contracts. Removing numbered negotiation is a breaking ontology and field migration across NAP-SHELL, NAP-INTENT, archetype metadata, and the profile convention flow. Full conformance also requires closing active pre-existing gaps in each NAP claimed here: SHELL, INTENT, INC, IDENTITY, and THEME.

Final package integration cannot pass until `napplet/web` publishes convention-capable releases. Kehto can complete independent runtime corrections first, but must not guess unpublished public field or plugin option names.

## Upstream Change Set

The authoritative squash combines:

- `3578ef7` — remove numbered NAP model
- `f9a2270` — use convention topics and schema tables
- `7197cea` — align template schema format

The target diff spans 18 files, 160 insertions, and 176 deletions.

## Ontology and Governance Delta

### Required model

- A NAP is only a runtime-provided API/capability surface.
- Cross-napplet payload shapes are unnumbered conventions, explicitly not NAPs.
- Convention stable identities use `napplet:<archetype>/<intent>`. A
  developer-facing invocation may append `?params` as payload sugar.
- Capability discovery is domain-only: `shell.supports("<domain>")`.
- Convention support is advertised by NIP-5A tags `["archetype","<slug>","<convention>"]` and NAP-INTENT candidate `conventions`.
- A convention needs no registry edit or assigned number.

### Removed model

- Numbered `NAP-1` through `NAP-5` cross-napplet protocol track.
- `supports(domain, protocol?)`.
- Sequential NAP-number allocation.
- Deferred numbered class subtracks `NAP-CLASS-1` and `NAP-CLASS-2`.
- `NAP-N-TEMPLATE.md`, replaced by `CONVENTION-TEMPLATE.md`.

### Retained model

- Named NAP-WORD runtime interfaces and domain discovery.
- Deferred `NAP-CLASS` itself.
- Bare-domain `["requires","relay"]`-style manifest requirements.
- NAATs as role/boundary names, not payload owners.

## NAP-SHELL

### Contract delta

- `supports(domain, protocol?)` becomes `supports(domain)`.
- `ShellCapabilities` layout remains non-normative, but no protocol map is needed.
- Before init and for unknown/unoffered domains, `supports()` returns `false`.
- Unchanged obligations: one bare `shell.ready`; one uncorrelated `shell.init` exactly once after first ready; duplicate-ready idempotency; synchronous/local lookup; creation-time identity; source binding; no capability traffic before session; per-napplet capability/service isolation.

### Active Kehto drift

- `packages/shell/src/napplet-namespace.ts` exposes/checks a second protocol argument.
- `packages/shell/src/shell-init.ts` defines `NAP_INC_PROTOCOLS`, emits `capabilities.protocols`, and publishes `inc:NAP-01` through `inc:NAP-06`.
- `packages/shell/src/types.ts` publishes/documents the protocol map.
- `packages/shell/src/shell-bridge.ts` can forward non-ready traffic before session establishment.
- Capability construction advertises some service-backed domains without proving host wiring.
- `packages/paja/src/parity.ts`, `RUNTIME-SPEC.md`, `docs/policies/NIP-5D-CONFORMANCE.md`, `packages/shell/README.md`, and tests preserve the old model.

### Proof required

- One-argument API/type guard.
- Pre-init false; post-init truthful granted-domain answers.
- No protocol map or numbered flat entries.
- Exactly-once init, source trust, reassignment resistance, no pre-session handler execution, per-frame isolation, honest host advertisement.

## NAP-INTENT

Draft PR #91 replaces the older optional-convention/window-opening model.
`invoke(uri, options?)` takes the convention URI as authoritative input. The
runtime-provided binding derives required `archetype`, `action`, and queryless
`convention`, plus optional query-derived text `payload`; conflicting normalized
fields are rejected.

### Acceptance and delivery

- `ok: true` means the runtime accepted delivery responsibility, not that a
  target received or handled the intent.
- `IntentResult` exposes normalized archetype, action, convention, and handler
  on success. It exposes no `handled`, `windowId`, intent ID, or delivery ID.
- The ordinary wire request `id` correlates only the immediate
  `intent.invoke.result`.
- The runtime retains `IntentDelivery` independently of source lifetime,
  derives its sender from the authenticated source endpoint, and delivers only
  after target readiness through `intent.deliver` / `onDelivery`.
- The binding retains delivery until an `onDelivery` handler is registered.
- NAP-INTENT does not depend on NAP-INC. Reuse, target/source ordering and
  overlap, retry, restart persistence, replacement, and terminal failure are
  runtime policy.

### Discovery

- Each NIP-5A archetype tag advertises one stable queryless convention and
  optional `kind:<unsigned integer>` values scoped to that convention.
- Each tag becomes one `IntentContract`. Candidates expose required
  `conventions` and `contracts`; actions may be derived from the contracts.
- The runtime must not inspect payload content to infer an event kind.

### Active Kehto drift

- `packages/services/src/intent-types.ts`, `catalog-intent-resolver.ts`,
  `manifest-intent-catalog.ts`, and `intent-service.ts` preserve protocol
  fields, `newWindow`, `handled`, `windowId`, completion-style success, and no
  carrier-neutral retained-delivery path.
- `packages/shell/src/napplet-namespace.ts` exposes `invoke(request)` and
  `open(archetype, ...)`, has no URI-authoritative normalization, and has no
  buffered `onDelivery`.
- Runtime/service send plumbing is bound to the source window, while generic
  ACL denial can emit the invented `intent.invoke.error` shape.
- Paja hardcodes a running numbered candidate. Playground has no live intent
  service or installed manifest catalog.
- Manifest parsing/generation drops repeated contracts and event-kind metadata.
- Explicit dTag targeting has no authorization hook and ambiguous selection
  silently chooses the first candidate.
- The live profile flow is visibly coupled to legacy INC `profile:open`.

### Proof required

- Full URI normalization/rejection parity with the web projection, including
  field-consistency validation and sender spoof resistance.
- Installed verified contract discovery with scoped event kinds, exact stable
  identity matching, defaults/chooser, and authorized explicit targeting.
- Acceptance-only results and source-independent retained ready delivery across
  allowed lifecycle orderings, with no forbidden fields or second source result.
- Carrier-neutral `intent.deliver`, pre-handler buffering, `intent.changed`,
  matching structured result failures, and no NAP-INC-visible dependency.

## NAP-INC

### Contract delta

- Advisory topics use `napplet:<archetype>/<intent>[...?params]`.
- `sender` and `peer` are napplet dTags.
- `id` and `channelId` are shell-assigned opaque identifiers.
- `channel.open` failure wording becomes transport-neutral.
- Optional payloads, fire-and-forget emit/unsubscribe, correlated subscribe/channel calls, channel auth/lifecycle, sender exclusion, and teardown behavior remain.

### Parameter transposition and exact routing

The original `6461e4b` audit found the profile example ambiguous. Draft PR #89
head `4593ce9e301ce098fd3dad64206fcd6f144fa7af` and the shared web projection in
draft PR #90 head `896c32c92deee68dc4d10fc1132b62df20cccb6f`
supersede that conclusion: a query-bearing developer convention URI is
validated and transposed before the wire into its queryless stable identity plus
a shallow text payload. Literal `+` is preserved, names and values are
percent-decoded once, text values are not coerced, and fragments, malformed
encoding, duplicate decoded names, or query plus explicit payload are rejected.
The projection helper is shared by every `window.napplet.*` operation that
accepts a convention URI, including INC and intent.

Runtime routing remains exact equality over the complete queryless wire topic.
The emitter cannot set or override `sender`; the runtime derives it from the
authenticated source endpoint and serializes its dTag. Kehto must add no runtime
query parsing, query stripping, wildcard, prefix, normalization, or base/query
matching. [`kehto/web#203`](https://github.com/kehto/web/issues/203) remains
open until the drafts merge, final heads are pinned, packages publish, and the
downstream chase is complete.

### Active Kehto drift

- `packages/runtime/src/inc-handler.ts` exposes window IDs as sender/peer, accepts window IDs/pubkeys as targets, and omits `peer destroyed`.
- `packages/acl/src/resolve.ts` rechecks channel messages after open instead of applying authorization at open time.
- `packages/shell/src/napplet-namespace.ts` exposes a legacy three-argument
  surface, no complete channel API, and permits later namespace/domain
  assignment to bypass a prelude-only normalizer.
- Legacy audio/notification service paths prefix-route and fabricate
  incomplete `inc.event` objects without runtime-attested sender.
- The live profile demo uses `profile:open`.

### Proof required

- `emit(topic,payload?)`, including producer-side convention query transposition, plus `on(topic,IncEvent)` and closeable subscriptions.
- Full channel open/list/broadcast plus handle emit/on/close.
- dTag-only sender/peer/target identity; exact topics; sender exclusion; optional payload preservation.
- Correlated results, opaque IDs, dead-target failures, open-time authorization, `peer destroyed`, and cleanup lifecycle.

## NAP-IDENTITY

`NAP-IDENTITY.md` is byte-identical between the upstream parent and target, so the numbered-track removal creates no new identity contract. Kehto nevertheless violates the current contract:

- `packages/services/src/identity-service.ts` and `packages/runtime/src/identity-handler.ts` emit `identity.getPublicKey.error`; failure must be `identity.getPublicKey.result` with `pubkey: ""`.
- Other failures and unknown actions can create non-contract `.error` messages.
- Feed/profile consumers assign remote picture URLs directly to `img.src`, bypassing NAP-RESOURCE mediation.

Proof required:

- Result-only getPublicKey with empty failure value.
- Matching result shapes/safe defaults for other failures; unknown actions ignored.
- Readonly API, correct change/sign-out broadcast, per-napplet privacy.
- Profile bytes through resource service to revocable safe object URLs.

## NAP-THEME

`NAP-THEME.md` is byte-identical between the upstream parent and target, so the numbered-track removal creates no new theme contract. Kehto nevertheless violates the current contract:

- `packages/services/src/theme-service.ts` sends `theme.*.error` for unknown actions.
- Generic runtime ACL denial can send `theme.get.error`.
- Playground broadcasts twice and does not update stored theme state.
- Paja updates stored state but does not bridge `theme.changed` to frames.

Proof required:

- Only `theme.get.result`, always with all required colors and sanctioned optional error data.
- Unknown actions ignored.
- One atomic stored-state update and exactly one `theme.changed`.
- Paja/playground bridge current and changed themes.
- No invented subscribe/unsubscribe protocol.

## Archetypes and NAATs

- A NAAT may recommend a convention, never a numbered cross-napplet NAP.
- Recommendations are interoperability defaults, not mandates.
- Napplets without archetype tags remain valid but cannot be opened by role.
- Slugs, boundaries, actions, and distinct-from relationships are unchanged.

| Archetype | Recommended convention |
|---|---|
| `note` | `napplet:note/open` |
| `profile` | `napplet:profile/open` |
| `dm` | `napplet:dm/open` |
| `feed`, `feed-images`, `feed-videos`, `feed-manager`, `composer`, `pet` | none |

Active Kehto drift:

- `packages/nip/src/5d/index.ts` models `{slug, nap?}`.
- `apps/playground/napplets/shared-vite-config.ts` models `{slug, nap?}`, validates `^NAP-\d+$`, and emits numbered tags.
- `apps/playground/napplets/profile-viewer/vite.config.ts` declares `NAP-1`.
- `apps/playground/src/napplet-resolver.ts`, `playground-intent-catalog.ts`, and NIP/gateway/catalog tests consume the old shape.

Proof required:

- Exact queryless convention tags, including repeated contracts and optional
  contract-local `kind:<number>` values.
- No numbered validator, query-bearing metadata, or payload-kind inference.
- Exact defaults only and byte/tag-exact signed-manifest projection.

## Live Profile Convention Flow

Active surfaces are the feed and profile-viewer napplets, profile-viewer Vite
config, playground README, profile/identity E2E specs, and gateway guard tests.
The feed invokes `napplet:profile/open?pubkey=...`; the profile target advertises
stable `napplet:profile/open` and receives a buffered carrier-neutral
`IntentDelivery` with the transposed text payload and runtime-attested sender.
No visible INC envelope or query-bearing discovery identity remains. Published
package adoption remains gated until the upstream core/nap/shim/sdk line exposes
the proposed behavior.

## Documentation and History Classification

Update active guidance:

- `RUNTIME-SPEC.md`
- `docs/policies/NIP-5D-CONFORMANCE.md`
- `packages/shell/README.md`
- `apps/playground/README.md`
- active source/test descriptions and fixtures

Preserve semantic history:

- all `CHANGELOG.md` files
- archived `.planning` milestone/quick history
- `docs/migrations/v1.2-NIP-5D-AUDIT.md`
- historical requirement IDs such as `NAP-01`

`docs/superpowers/specs/2026-06-15-nap-intent-design.md` is historical; preserve its body and add a superseded banner if it remains linked as guidance. Static checks must distinguish obsolete numbered negotiation from URL/WebRTC/Nostr protocol prose and historical IDs.

## Napplet Package Publication Gate

Published versions checked on 2026-07-23 remain pre-chase:

| Package | npm | Blocking surface |
|---|---:|---|
| `@napplet/core` | `0.28.0` | old intent fields; incomplete shell global/environment contract |
| `@napplet/nap` | `0.28.0` | old intent types/messages |
| `@napplet/shim` | `0.26.8` | incomplete NAP-SHELL ready/init/local-support implementation |
| `@napplet/sdk` | `0.24.4` | inherits old intent contracts |
| `@napplet/vite-plugin` | `0.11.3` | archetype protocol contract and old tag emission |

Kehto commonly pins vite-plugin `0.11.2` and the other versions above.

Final dependency gate:

1. Public intent types expose URI-authoritative invocation, convention
   contracts, acceptance-only results, and carrier-neutral delivery with no
   canonical protocol or forbidden lifecycle/result fields.
2. Core exports shell environment/global API and includes the shell domain.
3. Shim emits one ready, consumes init, and answers `supports(domain)` locally.
4. Vite plugin accepts the published convention-contract option shape and
   emits one queryless archetype tag per contract with any scoped event kinds.
5. SDK is rebuilt against the same contracts.
6. npm/JSR lineage is consistent.
7. Kehto lockfile, build, type-check, unit, and browser suites pass on those releases.

## Chase Direction

Executable requirements live in `.planning/REQUIREMENTS.md`. The roadmap must separate:

- authority/active-surface guard/package gate
- NAP-SHELL correctness
- NAP-INC identity/channel parity
- NAP-IDENTITY and NAP-THEME parity
- independent INTENT/archetype contract migration
- published package adoption plus live host-flow migration
- Paja/playground convention/resource flows
- full conformance audit, changesets, and PR

No phase may claim full conformance until the package gate and every supported-NAP requirement are green.
