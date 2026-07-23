# Upstream Numbered-NAP Removal Delta

> **Milestone-wide reference.** Phase 101 consumes the NAP-SHELL portions of
> this document. NAP-INC, NAP-INTENT, archetype, host-flow, and release sections
> are routed to Phases 102-106 by the active v1.29 roadmap and requirements.

> **Non-normative implementation audit.** The authoritative sources are
> `napplet/naps` master at
> `6461e4b37c29dc09a20dff35d9515889c4433874` and NIP-5D PR #2303 head
> `78efc118278e3ed42201eba9b60530b65835d7ed`. This file records the checked
> delta and Kehto impact; it does not replace those living specifications.

## Audit boundary

- Previous NAP registry: `napplet/naps@5fd99465892fbead3888d7146e1737f77b0ed0b4`
- Current NAP registry: `napplet/naps@6461e4b37c29dc09a20dff35d9515889c4433874`
- Upstream change: “NAP: Remove numbered protocol track” (#87), 18 files
- NIP-5D cross-check: PR #2303 head
  `78efc118278e3ed42201eba9b60530b65835d7ed`

The ecosystem changes from three governed axes (runtime NAP APIs, numbered
cross-napplet NAP protocols, and NAAT roles) to two governed axes. Runtime APIs
remain NAPs and roles remain NAATs. Cross-napplet message semantics are now
unregistered conventions normally named
`napplet:<archetype>/<intent>[...?params]`.

## Complete upstream contract delta

| Surface | Removed contract | Current contract |
|---|---|---|
| NAP-SHELL API | `supports(domain, protocol?)` | `supports(domain)` |
| NAP-SHELL capability query | Truthful domain plus numbered-protocol lookup | Truthful domain lookup only |
| NAP-SHELL example shape | `capabilities.protocols[domain] = ["NAP-N"]` | No protocol map in the example; byte shape remains nonnormative |
| NAP-INTENT request/options | `protocol?: text` | `convention?: text` |
| NAP-INTENT candidates | `protocols: text[]` | `conventions: text[]` |
| NAP-INTENT result | `protocol?: text` | `convention?: text` |
| NAP-INTENT failure | `"unsupported protocol"` | `"unsupported convention"` |
| Archetype manifest metadata | `["archetype", slug, "NAP-N"]` | `["archetype", slug, "napplet:<archetype>/<intent>"]` |
| Convention discovery | `shell.supports(domain, "NAP-N")` | Archetype metadata and `intent.available().candidates[].conventions` |
| INC advisory namespace | `napplet:*` shell-to-napplet and `{domain}:*` bidirectional | `napplet:<archetype>/<intent>[...?params]` bidirectional |
| Proposal governance | Numbered registry, sequential assignment, competing NAP-N protocols | Ad-hoc conventions, no assigned number or registry prerequisite |
| Authoring template | `NAP-N-TEMPLATE.md` | `CONVENTION-TEMPLATE.md` |

Unchanged wire types include the NAP-SHELL handshake, every NAP-INTENT envelope
type, and all NAP-INC operations. The nested fields and discovery semantics
change; the carrier messages do not.

## Removed numbered contracts

The previous registry linked five draft protocol branches. Current master removes
their registry status and all negotiation semantics:

| Removed ID | Old topics | Payload/behavior contract no longer governed |
|---|---|---|
| NAP-1 | `profile:*` / `profile:open` | Profile pubkey and navigation rules |
| NAP-2 | `stream:*` | Channel switch/current-context schemas and lifecycle |
| NAP-3 | `chat:*` / `chat:open-dm` | DM peer/display metadata and navigation rules |
| NAP-4 | `note:open` | Event/address target, relay/source/behavior hints |
| NAP-5 | `feed:*` / `feed:open` | Filter/origin/title/source/behavior schemas |

No replacement convention specifications preserve those schemas. Names such as
`napplet:profile/open`, `napplet:note/open`, `napplet:dm/open`,
`napplet:feed/open`, and `napplet:stream/switch` are examples, not implicit
adoption of the removed payload contracts.

The deferred `NAP-CLASS-1` and `NAP-CLASS-2` registry rows also disappear.
Their runtime surfaces were already retired from Kehto and require no new work.

## Archetype recommendations

- `note`: `NAP-4 (note:open)` → `napplet:note/open`
- `profile`: `NAP-1 (profile:open)` → `napplet:profile/open`
- `dm`: `NAP-3 (chat:open-dm)` → `napplet:dm/open`

Other registered archetypes still have no recommended convention.

## Specification gaps that constrain implementation

1. NAP-INC subscribes to `napplet:profile/open` in its example but emits
   `napplet:profile/open?pubkey=...`, while its shell behavior requires matching
   topics and says the shell does not parse prefixes. No wildcard or query
   normalization rule exists. Tracked downstream in `kehto/web#203`.
2. The documents do not define whether query parameters are convention identity,
   payload, discovery metadata, or a topic instance.
3. The old NAP-1..5 payload schemas were not migrated into convention specs.
4. Archetype documentation says “accepted convention(s)” but does not define
   whether multiple values share one tag or use repeated tags.

Implementation consequence: keep convention strings opaque; use exact topic
`napplet:profile/open` plus optional INC payload for Kehto's demo; do not invent
URI parsing, wildcard routing, or restored numbered schemas.

## Supported Kehto surface delta

### NAP-SHELL

Production:

- `packages/shell/src/types.ts`
- `packages/shell/src/shell-init.ts`
- `packages/shell/src/napplet-namespace.ts`
- `apps/playground/src/demo-hooks.ts`

Tests and guards:

- `packages/shell/src/shell-init.test.ts`
- `packages/shell/src/shell-supports-conformance.test.ts`
- `packages/shell/src/napplet-namespace.test.ts`
- `packages/shell/tests/no-window-nostr.test.ts`
- `packages/shell/tests/perm-namespace.test.ts`
- `packages/paja/src/parity.test.ts`
- `tests/e2e/gateway-artifact-parity.spec.ts`
- `tests/e2e/naps-path-conformance.spec.ts`

Required result: remove `ShellCapabilities.protocols`, `NAP_INC_PROTOCOLS`,
`inc:NAP-01..06`, and all two-argument supports behavior and assertions.

### NAP-INTENT and archetype metadata

Production:

- `packages/services/src/intent-types.ts`
- `packages/services/src/catalog-intent-resolver.ts`
- `packages/services/src/manifest-intent-catalog.ts`
- `packages/nip/src/5d/index.ts`
- `packages/paja/src/browser-adapter.ts`
- `apps/playground/src/napplet-resolver.ts`
- `apps/playground/src/playground-intent-catalog.ts`
- `apps/playground/napplets/shared-vite-config.ts`
- `apps/playground/napplets/profile-viewer/vite.config.ts`

Tests and guards:

- `packages/services/src/intent-service.test.ts`
- `packages/services/src/catalog-intent-resolver.test.ts`
- `packages/services/src/manifest-intent-catalog.test.ts`
- `packages/services/src/manifest-intent-dispatch.test.ts`
- `packages/nip/src/5d/index.test.ts`
- `packages/paja/src/parity.test.ts`
- `tests/unit/playground-intent-catalog.test.ts`
- `tests/unit/nip5d-conformance-guard.test.ts`
- `tests/unit/playground-gateway-guard.test.ts`
- `tests/unit/no-legacy-vocabulary.test.ts`

Required result: migrate `protocol` → `convention`, `protocols` →
`conventions`, `defaultProtocol` → `defaultConvention`, `"unsupported protocol"`
→ `"unsupported convention"`, and `{slug, nap?}` → `{slug, convention?}`.

### NAP-INC convention example

Production:

- `apps/playground/napplets/feed/src/main.ts`
- `apps/playground/napplets/profile-viewer/src/main.ts`

Tests:

- `tests/e2e/profile-open.spec.ts`
- `tests/e2e/identity-flow.spec.ts`
- `tests/unit/playground-gateway-guard.test.ts`

`packages/runtime/src/inc-handler.ts` already performs exact topic routing and
must not gain invented wildcard behavior. Audit also found an unchanged-contract
defect there: delivered `inc.event.sender` is a window id, while NAP-INC requires
the sender napplet dTag. Full Kehto conformance requires correcting and testing
that identity mapping.

### Active documentation

- `RUNTIME-SPEC.md`
- `packages/shell/README.md`
- `docs/policies/NIP-5D-CONFORMANCE.md`
- `docs/superpowers/specs/2026-06-15-nap-intent-design.md`

### Cleanup-only labels

Active comments that use `NAP-01..09` as old milestone labels should be renamed
to the corresponding named NAP or removed where misleading. These are not wire
contracts and must not be mechanically mapped as protocols.

## Explicit non-changes

- Arbitrary INC topics such as `chat:message`, `bot:response`,
  `notifications:*`, and the `nap-inc-test` fixture remain legal because NAP-INC
  declares topic naming advisory.
- WebRTC/URL fields named `protocol` are unrelated and remain.
- Package changelogs, migration documents, and archived `.planning/**` retain
  semantic history.
- Runtime envelope dispatch is convention-agnostic except for the sender-dTag
  defect; no new message type is required.

## Release impact

Expected changed Kehto packages:

- `@kehto/nip` — public manifest archetype type
- `@kehto/services` — public intent types and resolver
- `@kehto/shell` — public capabilities and injected supports behavior
- `@kehto/paja` — development adapter behavior
- `@kehto/runtime` — only if the sender-dTag conformance fix changes shipped INC behavior

Each shipped change requires a Changeset. Completion requires repository-wide
active-surface scans plus build, type-check, unit, docs, relevant E2E, diff, and
AI-slop gates.
