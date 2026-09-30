# Phase 104: NAP-INTENT and Manifest Contract Parity - Research

**Researched:** 2026-07-26
**Domain:** URI-authoritative intent resolution, manifest contracts, and retained target delivery
**Confidence:** HIGH

## Scope and Authority

Phase 104 owns the Kehto implementation of NAP-INTENT draft PR #91 and the
manifest-contract portions of the web projection. It does not yet replace the
workspace's installed Napplet packages or wire the final Paja/playground user
flow; those are Phase 105 responsibilities.

The exact sources checked before planning were:

- `napplet/naps` NAP-INTENT draft PR #91 at head
  `a718915ddefa2f03a0126579601f59d8bd86f7c4`
  (`naps/NAP-INTENT.md`). The PR is open and draft, so execution and final
  verification must re-check this exact head for drift.
- The merged web projection at
  `napplet/naps@5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`
  (`projections/web.md`).
- The convention-capable Napplet implementation merged as
  `napplet/web@dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b`,
  especially:
  - `packages/core/src/types/intent.ts`
  - `packages/nap/src/intent/{types,shim}.ts`
  - `packages/nap/src/convention-uri.ts`
  - `packages/sdk/src/cvm.ts`
  - `packages/vite-plugin/src/{types,manifest}.ts`
- Published package existence was verified for the new Napplet line, including
  `@napplet/core@0.29.0` and `@napplet/nap@0.29.0`. Importing those releases and
  aligning all workspace peer ranges remains Phase 105.

The local `specs/NAP-INTENT.md` and historical planning artifacts are useful
context, but the exact draft head above is the protocol authority for this
phase.

## User and Project Constraints

- Follow the full NAP/NIP-5D wiring guardrail: binding, runtime, ACL, service,
  manifest, host-independent adapters, tests, and active package documentation
  must move together.
- Keep one projection-owned convention URI normalizer. Phase 102 created it for
  INC; Phase 104 reuses and tightens that same helper for intent.
- Preserve the authenticated `MessageEvent.source` to runtime `SessionEntry`
  trust chain. `IntentDelivery.sender` comes only from the registered source
  session's dTag.
- Installed, verified manifests are catalog authority. Running frames and
  unsigned host claims are not discovery authority.
- Do not import the released Napplet package line in this phase. The current
  workspace still resolves the older line, so Kehto must temporarily expose
  wire-compatible local intent types without guessing beyond the already
  published source.
- Do not update repository-wide generated docs, final changesets, or the live
  feed/profile flow here. Phase 106 owns the final active-surface/docs/release
  sweep, while Phase 105 owns the live host flow. Package-local docs and compile
  consumers changed by this phase still need to remain coherent.

## Requirements Coverage

| Requirement | Implementation consequence |
|---|---|
| BASE-01 | Remove active intent `protocol`/`protocols` vocabulary; conventions are unnumbered payload contracts, not runtime NAP capabilities. |
| BASE-02 | Queryless `napplet:<archetype>/<intent>` is the only discovery and routing identity. |
| INTENT-01 | Protected binding exposes `invoke(uri, options?)` and `open(uri, options?)`, deriving all normalized fields from the URI. |
| INTENT-02 | Runtime validates required fields, querylessness, and exact archetype/action agreement before catalog access. |
| INTENT-03 | Use exact options/request/contract/candidate/result/delivery shapes and a discriminated acceptance result. |
| INTENT-04 | Parse every valid archetype tag as one contract and build availability only from installed verified manifests. |
| INTENT-05 | Resolve exact complete convention equality; never infer an omitted convention, action, or event kind. |
| INTENT-06 | Honor user defaults, require chooser policy for ambiguity, and authorize explicit dTag selection. |
| INTENT-07 | `ok: true` records retained responsibility only; no handled/window state appears on the wire. |
| INTENT-08 | Retain a normalized delivery independently of the source before success and start delivery only after the result is sent. |
| INTENT-09 | Runtime derives sender dTag, targets only the selected handler, and emits a no-ID `intent.deliver`. |
| INTENT-10 | Binding validates and buffers carrier-neutral deliveries; controller seams hide reuse/retry/replacement/terminal policy. |
| INTENT-11 | Resolver changes broadcast through runtime-owned loaded-client discovery, not a map populated by prior intent calls. |
| ARCH-01 | Parser and build helper require one stable convention per tag and preserve repeated tags plus scoped event kinds. |
| ARCH-02 | Derive only action/convention indexes; do not turn NAAT names into payload schemas or default actions. |
| ARCH-04 | Local playground build validation matches the released Vite plugin's convention, slug, and unsigned-kind rules. |

## Current-State Findings

### Partial scaffold already on the branch

Commit `bad3c5a` started the URI and manifest migration before a complete plan
existed. It is directionally useful but not conformant:

- `intent-types.ts` added convention and delivery names while retaining optional
  normalized fields and deprecated `protocol`, `handled`, and `windowId`
  fields.
- the shell prelude added URI calls and an unbounded pending-delivery array, but
  it spreads arbitrary caller options over URI-derived routing fields, accepts
  an unvalidated delivery object, and does not protect the intent domain from
  namespace replacement;
- the manifest parser records optional conventions and kind-looking fields but
  does not reject missing, numbered, query-bearing, mismatched, malformed, or
  unsafe metadata;
- the manifest adapter overwrites repeated contracts and invents `open`;
- the resolver still permits protocol fallback and silently chooses the first
  ambiguous candidate;
- the service still treats success as completed window opening and knows only
  windows that previously made an intent request.

The scaffold should be corrected in place; none of these compatibility fields
are part of the target public contract.

### Binding normalizer

`packages/shell/src/napplet-namespace.ts` already has one serialized
`normalizeConventionUri` helper used by INC. This is the correct owner because
both Paja and playground inject the same prelude before authored napplet code.
It already preserves literal `+`, decodes with `decodeURIComponent`, rejects
fragments and query-plus-explicit-payload, and emits a queryless identity.

Two details need tightening while intent adopts it:

1. convention query components must use `name=value`; the current helper
   accepts a missing `=`;
2. caller option spreading must be replaced by a whitelist of `payload`,
   `handler`, and `behavior`, with URI-derived fields written last or constructed
   separately. Caller `sender`, `archetype`, `action`, and `convention` claims
   must never reach the wire.

The merged Napplet shim is the closest contract analog. It validates a delivery
record, copies only canonical fields, rejects caller sender/derived-field
overrides, and drains early deliveries FIFO when a handler registers.

### Generic service runtime boundary

`ServiceHandler.handleMessage` currently receives:

1. `windowId`,
2. the envelope, and
3. a reply callback fixed to that same source window.

That is insufficient for NAP-INTENT:

- a service cannot derive the authenticated source dTag;
- a service cannot send a target-only push;
- a service cannot enumerate loaded eligible clients for `intent.changed`;
- the resolver currently leaks a target `windowId` to work around that absence.

The runtime already owns everything needed:

- `SessionRegistry.getEntryByWindowId()` and `getAllEntries()`;
- `RuntimeAdapter.sendToNapplet(windowId, message)`;
- `RuntimeAdapter.isDomainAllowed(windowId, domain)`;
- `resolveCapabilitiesNap(message).recipientCap` and the source-bound NAP ACL
  enforcement gate;
- registration/unregistration of service handlers.

The narrow reusable seam is a runtime-owned service context attached when a
handler is registered. It should expose read-only session lookup/enumeration,
plus a policy-aware target-send operation that verifies current session
liveness, immutable domain eligibility, and the resolved recipient capability
before using the adapter transport. It must not expose the raw target transport:
domain-only filtering would leak `intent.changed` catalog details to a napplet
whose current `intent:read` grant was never issued or has been revoked.
Existing handlers can ignore the context, so this does not require changing
every service implementation.

### Acceptance and retained delivery

The current resolver waits for `windows.open()` and returns `windowId`,
`handled`, and protocol state. That conflates four distinct moments:

1. exact contract and handler selection;
2. runtime retention of a normalized delivery job;
3. immediate acceptance result to the source;
4. target readiness and eventual target-only delivery.

The target architecture must separate them:

```text
validated request + authenticated source dTag
        |
        v
exact manifest contract + authorized handler selection
        |
        v
target controller retains a delivery task (source-independent)
        |
        v
source <- intent.invoke.result { result: { ok: true, ... } }
        |
        v
retained task starts host lifecycle policy
        |
        v
target ready -> target <- intent.deliver { delivery }
```

The controller must not expose a window ID in public or host-independent intent
types. A retained task/handle can encapsulate reuse, startup, readiness,
replacement, retry, persistence, and terminal failure policy. The service sends
the immediate result before starting that task. Once success was sent, task
failure is not reported as a second source result.

### Manifest parser and adapter

`packages/nip/src/5d/index.ts` is the verified-manifest parser and must fail
closed on malformed archetype contract tags. Each accepted tag has:

```text
["archetype", slug, convention, "kind:<unsigned safe integer>", ...]
```

Required parser rules:

- slug is a non-empty lowercase/hyphen role name;
- convention is present and exactly
  `napplet:<slug>/<non-empty-action>`;
- convention contains no query, fragment, whitespace, or numbered `NAP-N`
  identifier;
- every trailing field is a valid `kind:<number>`;
- every kind is a non-negative safe integer;
- repeated same-slug tags remain separate and ordered.

The services adapter groups those distinct contracts by slug and derives:

- `actions` from each convention's intent component;
- `conventions` from the complete queryless identity;
- `contracts` as one copied record per tag, retaining same-tag kinds.

It must not invent `open`, synthesize a convention for a missing tag field,
deduce a kind from payload data, or retain `protocols`.

### Selection policy

Candidate compatibility is exact contract equality, not an `actions`-only or
prefix check. The resolver should:

1. filter the installed catalog to candidates whose manifest contract exactly
   equals `request.convention`;
2. use an authorized explicit dTag only if it remains in that compatible set;
3. honor a valid user default;
4. accept the sole compatible candidate;
5. otherwise require a chooser/user-policy hook and treat cancellation or a
   missing chooser as pre-acceptance failure.

An explicit dTag needs a dedicated authorization hook. Merely being installed
and compatible is necessary but not sufficient.

### Denial and directionality

`intent.invoke` policy denial must still use:

```json
{
  "type": "intent.invoke.result",
  "id": "<request id>",
  "result": { "ok": false, "error": "<pre-acceptance reason>" }
}
```

The runtime's current generic denial path creates `intent.invoke.error`, which
is not a NAP-INTENT message. ACL mapping also classifies `intent.deliver` as a
napplet-originated read instead of a runtime-to-target push. Both paths need
focused correction while preserving ordinary top-level `error` support for
availability/handler infrastructure failures.

### Change notification

The current intent service stores reply callbacks only after a client calls an
intent operation. That violates INTENT-11. Once the handler is attached to the
runtime context, a resolver change can enumerate current registered sessions,
attempt one policy-aware `intent.changed` send to each, and reach only windows
that are still live, whose immutable environment contains `intent`, and whose
current ACL grants `intent:read`. Destroyed sessions naturally disappear from
the registry without a request-history map.

### Compile consumers

Exact types will intentionally break stale local consumers:

- Paja's development intent simulator returns `handled`, `windowId`, and
  `protocol`; it needs a minimal exact-contract simulation until Phase 105
  installs the real host flow.
- playground intent catalog docs/tests and the profile fixture still use
  `nap: "NAP-1"`;
- package exports omit `IntentInvokeOptions`, `IntentContract`,
  `IntentDelivery`, and retained-delivery/controller types;
- ACL and runtime tests expect invented `intent.*.error` shapes.

These consumers must be updated in this phase so build and type-check remain
green, without prematurely implementing the Phase 105 live flow.

## Recommended Architecture

### 1. Exact local value model

Mirror the already-published source shapes exactly:

- `IntentHandlerPreference`
- `IntentBehavior`
- `IntentInvokeOptions`
- required `IntentRequest`
- `IntentContract`
- required-array `IntentCandidate`
- `IntentAvailability`
- `IntentAcceptedResult`
- `IntentRejectedResult`
- discriminated `IntentResult`
- `IntentDelivery`

Kehto-specific resolver/controller types may add orchestration seams, but they
must not alter the canonical wire objects.

### 2. Runtime-attached service context

Add an optional service lifecycle callback receiving a context with:

- `resolveDTag(windowId)`;
- `listWindowIds()`;
- `sendToEligibleNapplet(windowId, message)`.

`sendToEligibleNapplet` returns whether delivery occurred and is intentionally
stricter than the adapter transport: it requires a live registered recipient,
an allowed message domain, a runtime-to-recipient capability mapping, and a
current ACL grant for that capability. The service never receives raw hooks,
ACL state, or a mutable session registry.

Attach it to adapter-provided services during runtime creation and to services
registered later. Provide a matching unregistration/destruction cleanup seam
so change subscriptions do not outlive a runtime.

### 3. Retained delivery task

Have the catalog resolver return an invocation outcome containing the exact
`IntentResult` and, only for accepted outcomes, an opaque retained delivery
task. The target controller must have taken responsibility for the immutable
`IntentDelivery` before that accepted outcome is returned.

The intent service then:

1. validates normalized request shape;
2. resolves authenticated sender from runtime context;
3. awaits selection and retention;
4. sends one correlated result;
5. starts the retained task only after the send;
6. ignores post-acceptance task failure for source-result purposes.

Names may follow existing Kehto style, but JSDoc must state these ordering and
ownership guarantees.

### 4. Protected binding state

Cache one intent binding instance alongside the existing cached `shell`, `inc`,
`identity`, and `theme` domains. Namespace assignment, domain assignment,
`defineProperty`, and deletion must preserve the canonical operations and
retained deliveries. Only trusted-parent messages may enter its pending queue.

### 5. Focused host-independent integration

Use the real runtime, session registry, manifest adapter, catalog resolver,
intent service, and a deferred target controller in one focused suite. Prove:

- forged caller sender is absent from the normalized request;
- source dTag comes from the session registry;
- exact contract selection;
- immediate result precedes task start and target delivery;
- source destruction after acceptance does not cancel delivery;
- target readiness gates delivery;
- target-only no-ID carrier;
- no INC message and no second source result;
- already-ready/reused target and deferred target both work;
- task policy can own retry/replacement/terminal behavior without public fields.

## File Ownership and Execution Order

| Order | Files | Responsibility |
|---:|---|---|
| 1 | `packages/services/src/intent-types.ts`, `packages/services/src/index.ts`, `packages/shell/src/napplet-namespace.ts` and tests | Exact public model plus protected URI/delivery binding. |
| 2 | `packages/nip/src/5d/index.ts`, manifest/catalog adapters, playground build helper and tests | Strict repeated convention-contract pipeline and build validation. |
| 3 | `packages/services/src/catalog-intent-resolver.ts` and tests | Exact compatibility, defaults/chooser/authorization, retained target task. |
| 4 | runtime service types/lifecycle, ACL/runtime intent denial, `intent-service.ts` and tests | Runtime attestation, source-result ordering, target task start, and loaded-client changes. |
| 5 | manifest-dispatch/runtime integration, stale compile consumers, focused docs/guards | End-to-end lifecycle proof and phase-local coherence. |

## Testing Strategy

Use test-first changes for each behavioral slice.

### Binding matrix

- valid queryless and query-bearing invoke/open;
- literal plus, percent decoding, empty query, and structured payload;
- missing `=`, malformed percent, repeated decoded name, fragment, query plus
  explicit payload, wrong open action;
- caller `sender`/derived fields never appear on the wire;
- malformed/extra-field deliveries are ignored or sanitized;
- early deliveries drain FIFO exactly once;
- forged child/non-parent messages and namespace replacement cannot bypass the
  protected binding.

### Manifest matrix

- repeated same-slug contracts and same-tag kinds;
- missing convention, `NAP-N`, query, fragment, wrong slug, malformed kind,
  negative/unsafe kind, unexpected trailing field;
- adapter derives ordered unique indexes without inventing defaults;
- build helper emits one tag per contract and rejects the same invalid matrix.

### Resolver matrix

- exact convention compatibility;
- no handler/unsupported convention;
- default, sole candidate, chooser, cancellation, missing chooser;
- explicit installed compatible authorized, unauthorized, incompatible, and
  uninstalled targets;
- controller retention failure remains pre-acceptance;
- accepted outcome contains no public lifecycle/window fields.

### Runtime/service matrix

- required normalized request and exact consistency checks before resolver call;
- registered session dTag attestation and pre-session/missing-session rejection;
- result-before-task ordering and no second result;
- loaded eligible change broadcast without prior request;
- structured ACL/firewall invoke denial;
- runtime-to-target `intent.deliver` ACL direction.

### Integration matrix

- target already ready and target becomes ready later;
- source destroyed immediately after acceptance;
- target replacement/retry policy represented only by the retained task;
- target receives one delivery; source receives one result; third windows receive
  nothing;
- no visible INC carrier or ID fields.

## Verification Commands

Each plan should run its focused Vitest files and affected package type-check.
Before phase closure run at minimum:

```bash
pnpm exec vitest run \
  packages/shell/src/napplet-namespace.test.ts \
  packages/nip/src/5d/index.test.ts \
  packages/services/src/intent-service.test.ts \
  packages/services/src/catalog-intent-resolver.test.ts \
  packages/services/src/manifest-intent-catalog.test.ts \
  packages/services/src/manifest-intent-dispatch.test.ts \
  packages/runtime/src/intent-dispatch.test.ts \
  packages/acl/src/resolve.test.ts \
  tests/unit/playground-intent-catalog.test.ts \
  tests/unit/nip5d-conformance-guard.test.ts \
  tests/unit/playground-gateway-guard.test.ts
pnpm --filter @kehto/nip type-check
pnpm --filter @kehto/services type-check
pnpm --filter @kehto/runtime type-check
pnpm --filter @kehto/shell type-check
pnpm --filter @kehto/paja type-check
pnpm --filter @kehto/playground type-check
git diff --check
```

Full repository gates remain mandatory before PR handoff.

## Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Caller overrides URI-derived routing or sender | High | Whitelist options, build canonical request explicitly, and derive sender from runtime session only. |
| Success is sent before responsibility is actually retained | High | Require retained task creation before accepted result; test retention failure as `ok:false`. |
| Target receives delivery before source result | High | Service starts the retained task only after sending the result. |
| Source teardown destroys delivery state | High | Put delivery state in the retained task/controller, never a source-window callback map. |
| Ambiguous selection silently picks an attacker-controlled catalog order | High | Default/sole/chooser only; missing chooser is rejection. |
| Explicit dTag bypasses user policy | High | Require a dedicated authorization hook after exact compatibility filtering. |
| Malformed signed manifest metadata becomes discovery authority | High | Fail closed in verified-manifest parsing and repeat validation in build tooling. |
| `intent.changed` leaks installed catalog details | High | Use the runtime's policy-aware target send so current session, immutable intent-domain, and `intent:read` ACL eligibility are all checked at send time; host redaction remains policy. |
| Generic runtime changes regress other services | High | Make lifecycle/context callbacks optional and keep existing three-argument handler implementations valid. |
| Draft authority changes during work | High | Re-query PR #91 head before execution and final verification; stop and re-audit on drift. |
| Dependency supply-chain drift | High | Install nothing in Phase 104; Phase 105 separately verifies exact npm/JSR lineage and lockfile changes. |

## Deferred to Phase 105

- Workspace dependency and peer-range upgrades to the published convention line.
- Replacing local duplicated canonical types with imports/re-exports where
  appropriate.
- Persistent installed-manifest catalogs and real intent controller wiring in
  Paja and playground.
- Live feed to profile invocation and resource-safe profile media.
- Real host theme synchronization coupled to the new package line.

## Deferred to Phase 106

- Repository-wide active-vocabulary guard and historical-document banner.
- Complete generated API/docs refresh.
- Final changesets, full regression matrix, security/review/milestone audit, and
  release-ready PR closeout.
