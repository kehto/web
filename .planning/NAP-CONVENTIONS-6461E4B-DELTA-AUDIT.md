# Napplet Convention and Supported-NAP Delta Audit

**Audit date:** 2026-07-23  
**Upstream authority:** `napplet/naps@6461e4b37c29dc09a20dff35d9515889c4433874`  
**Upstream parent:** `5fd99465892fbead3888d7146e1737f77b0ed0b4`  
**Kehto baseline:** `kehto/web@bb3929b3523b75356fd65f658f9bd14c7ff697e4`

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
- Convention names normally use `napplet:<archetype>/<intent>[...?params]`.
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

### Complete field migration

| Record | Removed | Required |
|---|---|---|
| `IntentOpenOptions` | `protocol` | `convention?` |
| `IntentRequest` | `protocol` | `convention?` |
| `IntentCandidate` | `protocols` | `conventions: string[]` |
| `IntentResult` | `protocol` | `convention?` |

Exact error vocabulary changes from `unsupported protocol` to `unsupported convention`.

### Retained/clarified semantics

- NAP-INTENT owns the dispatch envelope, not payload meaning.
- Archetype selects routing; convention names parsing; the relationship is N:M.
- Omission may use an archetype’s recommended default.
- Delivery may be a convention INC event or cold-start initial state.
- Receivers validate untrusted payloads; shell routing does not inspect/mutate them beyond need.
- Existing request/result names, IDs, discovery, defaults/chooser, ready-before-delivery, and privacy remain.

### Active Kehto drift

- `packages/services/src/intent-types.ts`, `catalog-intent-resolver.ts`, `manifest-intent-catalog.ts`, and `intent-service.ts` use `protocol`, `protocols`, `defaultProtocol`, manifest `nap`, and `unsupported protocol`.
- `packages/paja/src/browser-adapter.ts` and `apps/playground/src/playground-intent-catalog.ts` propagate those fields; Paja hardcodes `NAP-01`.
- The playground helper is not the live verified installed-manifest catalog.
- Explicit dTag targeting has no authorization hook.
- Multiple candidates silently choose the first.
- Ready-before-delivery is delegated rather than proven.
- Generic runtime ACL denial can emit non-contract `intent.*.error`.

### Proof required

- Convention-only serialization, exact error, explicit/default routing, N:M independence.
- Installed verified manifest provenance, user defaults/chooser, target authorization.
- Ready-before-delivery, opaque payload handling, matching `*.result` failures, and `intent.changed`.

## NAP-INC

### Contract delta

- Advisory topics use `napplet:<archetype>/<intent>[...?params]`.
- `sender` and `peer` are napplet dTags.
- `id` and `channelId` are shell-assigned opaque identifiers.
- `channel.open` failure wording becomes transport-neutral.
- Optional payloads, fire-and-forget emit/unsubscribe, correlated subscribe/channel calls, channel auth/lifecycle, sender exclusion, and teardown behavior remain.

### Parameter-matching ambiguity

The spec subscribes to `napplet:profile/open` in one example and emits `napplet:profile/open?pubkey=...` in another, while saying routing is by topic match and not prefix parsing. Base/query matching is undefined. Kehto must treat topics as exact opaque strings and add no query stripping, wildcard, or prefix matching.

Downstream tracking: [`kehto/web#203`](https://github.com/kehto/web/issues/203). Close it only after upstream defines both topic matching and query-parameter semantics and Kehto carries that decision into implementation, documentation, and positive/negative tests.

### Active Kehto drift

- `packages/runtime/src/inc-handler.ts` exposes window IDs as sender/peer, accepts window IDs/pubkeys as targets, and omits `peer destroyed`.
- `packages/acl/src/resolve.ts` rechecks channel messages after open instead of applying authorization at open time.
- `packages/shell/src/napplet-namespace.ts` exposes a legacy three-argument surface and no complete channel API.
- The live profile demo uses `profile:open`.

### Proof required

- `emit(topic,payload?)`, `on(topic,IncEvent)`, closeable subscriptions.
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

- Exact convention tags, including absent/multiple values.
- No numbered validator or invented kind-constraint semantics.
- Exact defaults only and byte/tag-exact signed-manifest projection.

## Live Profile Convention Flow

Active surfaces are the feed and profile-viewer napplets, profile-viewer Vite config, playground README, profile/identity E2E specs, and gateway guard tests. The final flow advertises `napplet:profile/open`. Tests must assert exact-topic isolation. If data remains in payload, document that local convention shape; if published packages define a query form, sender and receiver must use the exact same topic.

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

1. Public intent types contain convention fields and no canonical protocol fields.
2. Core exports shell environment/global API and includes the shell domain.
3. Shim emits one ready, consumes init, and answers `supports(domain)` locally.
4. Vite plugin accepts the published convention option shape and emits the three-field tag.
5. SDK is rebuilt against the same contracts.
6. npm/JSR lineage is consistent.
7. Kehto lockfile, build, type-check, unit, and browser suites pass on those releases.

## Chase Direction

Executable requirements live in `.planning/REQUIREMENTS.md`. The roadmap must separate:

- authority/active-surface guard/package gate
- NAP-SHELL correctness
- NAP-INC identity/channel parity
- NAP-IDENTITY and NAP-THEME parity
- published package adoption plus INTENT/archetype migration
- Paja/playground convention/resource flows
- full conformance audit, changesets, and PR

No phase may claim full conformance until the package gate and every supported-NAP requirement are green.
