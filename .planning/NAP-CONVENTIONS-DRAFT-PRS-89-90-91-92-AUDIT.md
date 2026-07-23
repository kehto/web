# Draft Convention Contract Downstream Audit

**Audit date:** 2026-07-23
**Kehto audit baseline:** `kehto/web@b5d7c84`
**Merged upstream baseline:** `napplet/naps@6461e4b37c29dc09a20dff35d9515889c4433874`
**Proposed NAP-INC authority:** draft PR
[#89](https://github.com/napplet/naps/pull/89) head
`4593ce9e301ce098fd3dad64206fcd6f144fa7af`
**Proposed governance/web authority:** draft PR
[#90](https://github.com/napplet/naps/pull/90) head
`896c32c92deee68dc4d10fc1132b62df20cccb6f`
**Proposed NAP-INTENT authority:** draft PR
[#91](https://github.com/napplet/naps/pull/91) head
`a718915ddefa2f03a0126579601f59d8bd86f7c4`
**Proposed symmetric NAP-INC channel authority:** stacked draft PR
[#92](https://github.com/napplet/naps/pull/92) head
`c5cd06f7be6d4690b303949abb26e87ff62f4729`
**Downstream tracking:** [`kehto/web#203`](https://github.com/kehto/web/issues/203),
including the
[target-side channel-handle gap](https://github.com/kehto/web/issues/203#issuecomment-5060523475)

## Status and Authority Boundary

All four upstream PRs are open drafts and are not merged. PR #92 is stacked on
#89. This audit treats
their exact heads as the proposed contract requested for the v1.29 chase. It
does not silently fill gaps or treat the draft text as a published package API.
Every head must be re-fetched and this audit re-run before final dependency
adoption or merge.

The current published `@napplet/*` packages still expose the earlier contract.
Kehto can correct its independent runtime, web binding, manifest, service,
host, test, and documentation surfaces now. Final package/lockfile conformance
remains blocked until `napplet/web` publishes a mutually compatible release
line.

## Proposed Contract

1. Stable identity is exactly `napplet:<archetype>/<intent>`.
   `?name=value` is developer-facing invocation payload sugar and never part of
   subscriptions, normalized wire identity, handler metadata, or discovery.
2. The runtime-provided binding performs URI-to-payload transposition before
   sending a normalized request. It percent-decodes each unique name and value
   once as text, preserves literal `+`, performs no scalar coercion, and rejects
   fragments, malformed percent encoding, repeated decoded names, and a query
   combined with an explicit payload.
3. Runtime routing and handler resolution use exact equality over complete
   queryless identities. Prefix, wildcard, base/query, and query-aware matching
   are forbidden.
4. Callers never provide `sender`. The runtime derives it from the authenticated
   source endpoint. The web projection binds that endpoint with the verified
   `MessageEvent.source` session.
5. Intent invocation takes the convention URI as its authoritative input and
   derives `archetype`, `action`, queryless `convention`, and optional
   `payload`. Conflicting normalized fields are rejected.
6. `ok: true` means only that the runtime accepted delivery responsibility.
   Delivery is retained independently of source lifetime, happens after target
   readiness, and uses `intent.deliver` / `onDelivery` with `IntentDelivery`.
   Target/source overlap, ordering, retry, restart persistence, replacement,
   and terminal failure remain runtime policy.
7. NAP-INTENT exposes no `intentId`, delivery ID, `handled`, `windowId`, or
   `newWindow`. The ordinary request `id` correlates only the immediate result.
   NAP-INTENT does not depend on NAP-INC.
8. Each manifest archetype tag advertises one stable queryless convention and
   optional `kind:<unsigned integer>` metadata. Each tag produces one
   `IntentContract`; the runtime never inspects payload content to infer a kind.
9. Channels are symmetric. The runtime enqueues target
   `inc.channel.opened` before opener success; both bindings materialize
   equivalent handles; `channel.onOpened`, handle `on`, and handle `onClosed`
   retain early opened/event/terminal records. `channel.list()` is
   informational only. Buffer overflow closes rather than silently drops.

## Requested Violation Report

### Query parameters treated as identity or discovery metadata

| Severity | Surface | Current conflict | Required correction |
|---|---|---|---|
| Blocker | `packages/shell/src/napplet-namespace.ts:338-370` (`makeInc`) | Query-bearing topics cross `postMessage` unchanged and `on()` accepts them as subscription identities. | Normalize only producer invocation; require queryless subscription identity and post only stable topic plus payload. |
| Blocker | `packages/shell/src/napplet-namespace.ts:958-987` (`makeIntent`) | `invoke(request)` and `open(archetype, ...)` forward caller fields unchanged. | Replace with URI-authoritative `invoke(uri, options?)` / `open(uri, options?)` and use the shared normalizer. |
| High | `packages/nip/src/5d/index.ts:78-104,144-158,183-195` | Archetype metadata is `{slug, nap?}` and accepts arbitrary query-bearing third fields. | Parse one stable queryless convention contract per tag, require slug match, and parse contract-local event kinds. |
| High | `apps/playground/napplets/shared-vite-config.ts:45-85,336-397` | Generator accepts and validates numbered `NAP-N` metadata rather than stable conventions. | Generate repeated queryless convention tags and optional `kind:<number>` fields. |
| High | `packages/services/src/manifest-intent-catalog.ts:20-75` | Adapter propagates the unvalidated third field, overwrites repeated slugs, and invents `open`. | Preserve every validated `IntentContract`; derive action/convention lists without inventing defaults. |
| High | `packages/services/src/catalog-intent-resolver.ts:123-145,214-232` | Discovery and resolution use numbered protocols and would accept arbitrary strings after a mechanical rename. | Match one exact stable manifest contract; never infer a kind from payload. |
| Medium | `apps/playground/src/napplet-resolver.ts:57-70,156-160` and `apps/playground/src/playground-intent-catalog.ts:20-52` | Old unvalidated `{slug, nap?}` metadata reaches the catalog helper. | Carry validated queryless contracts from installed verified manifests. |
| Medium | `packages/paja/src/browser-adapter.ts:186-199,413-435` | Paja advertises hard-coded numbered protocol metadata. | Source stable contracts from installed manifests and never advertise query data. |

No literal query-bearing convention is currently advertised in active metadata;
the live system advertises obsolete `NAP-N` values instead. The parser and
catalog nevertheless have a latent query-bearing-metadata acceptance bug.

### Query-bearing normalized topics or conventions

| Severity | Surface | Current conflict | Required correction |
|---|---|---|---|
| Blocker | `packages/shell/src/napplet-namespace.ts:338-370` | `inc.emit` posts the caller topic unchanged, JSON-parses explicit content, and returns a synthetic Nostr event rather than `IncEvent`. | Canonical `emit(topic, payload?)`, local validation/transposition, no post on rejection, and `{topic,sender,payload?}` delivery. |
| Blocker | `packages/shell/src/napplet-namespace.ts:958-987` | Intent convention query and payload can cross the wire together. | Shared binding normalization and local rejection before posting. |
| High | `packages/shell/src/napplet-namespace.ts:1136-1138,1166-1210` | Whole-namespace or domain reassignment by a later shim/SDK can replace Kehto's normalized INC/intent operations. | Protect or wrap projection-owned convention operations after namespace/domain reassignment; prove both replacement paths cannot bypass normalization. |
| High | `packages/runtime/src/inc-handler.ts:125-132` | Exact lookup is correct, but there is no negative proof that a raw query-bearing wire topic cannot reach a stable subscription. | Preserve `subscriptions.get(topic)` unchanged and add stable-vs-raw-query isolation tests. |
| High | `apps/playground/napplets/feed/src/main.ts:62-72` and `profile-viewer/src/main.ts:1-11,211-232` | Live flow uses legacy `profile:open` through INC. | Invoke `napplet:profile/open?pubkey=...`; deliver stable `napplet:profile/open` plus text payload through intent. |
| Medium | `packages/runtime/src/service-dispatch.ts:42-49` | Unused public helper routes generically by `topic.split(':')[0]`. | Remove it or restrict it to a closed set of exact shell-owned topics; `napplet:*` must never be prefix-intercepted. |
| High | `packages/services/src/audio-service.ts:62-67,110` | Prefix-matches `audio:*` and fabricates incomplete `inc.event` messages. | Retire the legacy INC route or use a runtime-attested exact delivery primitive. |
| High | `packages/services/src/notification-service.ts:149-179,230-243` | Prefix-matches `notifications:*` and fabricates incomplete `inc.event` messages. | Retire the legacy INC route or use a runtime-attested exact delivery primitive. |
| High | `apps/playground/napplets/bot/src/main.ts:24-34` and `chat/src/main.ts:27-37` | Active demos emit `notifications:create` through the legacy three-argument INC helper. | Remove the optional notification side effect; do not replace it with an unpublished or invented route. |
| Medium | `apps/playground/src/flow-animator.ts:64-80` | Active host visualization classifies notification service traffic with `startsWith('notifications:')`. | Remove legacy topic-prefix recognition and retain canonical `notify.*` visualization only. |
| Medium | `apps/playground/src/main-notifications.ts:39-238`, `tests/e2e/demo-notification-service.spec.ts:5`, and `tests/e2e/notify-lifecycle.spec.ts:66` | Active UI labels/comments call dotted `notify.*` service traffic by retired colon-topic names. | Align active labels and test guidance with the actual direct `notify.*` envelopes. |
| Medium | `packages/services/README.md`, `docs/packages/services.md`, `apps/playground/README.md`, `skills/add-service/SKILL.md`, `skills/integrate-shell/SKILL.md` | Active guidance teaches `audio:*` / `notifications:*` service routing and `createAudioService`. | Remove the obsolete surface from active guidance; preserve changelogs and migration records as history. |

### Caller-provided or non-attested sender

| Severity | Surface | Current conflict | Required correction |
|---|---|---|---|
| High | `packages/runtime/src/inc-handler.ts:125-132` | Delivered sender is internal `windowId`. Caller `sender` is incidentally ignored, but the runtime does not serialize the authenticated source dTag. | Resolve the authenticated session and emit its dTag; fail closed without a session; prove forged caller sender cannot override it. |
| High | `packages/runtime/src/inc-handler.ts:88-93,174-181,190-192,205-207,221-226` | Channel targets, peers, and senders accept/expose window IDs and pubkeys. | Resolve only one live dTag to internal transport state and serialize only dTags. |
| Blocker | `packages/services/src/intent-service.ts:42-71,143-155` | Resolver context contains only caller `windowId`; normalized requests are not protected from a caller-supplied sender. | Derive source dTag from the authenticated session and ignore or reject caller sender fields. |
| High | `packages/services/src/audio-service.ts:62-67,110` | Directly fabricated `inc.event` has no runtime-attested sender. | Remove the fabrication path or route through the attesting runtime. |
| High | `packages/services/src/notification-service.ts:149-179,230-243` | Directly fabricated `inc.event` has no runtime-attested sender. | Remove the fabrication path or route through the attesting runtime. |

The existing trust seams are usable: `packages/shell/src/shell-bridge.ts:220-251`
authenticates `MessageEvent.source`; `packages/runtime/src/session-registry.ts:
113-115` maps the authenticated endpoint to its session/dTag.

### Successful invocation treated as completed handling

| Severity | Surface | Current conflict | Required correction |
|---|---|---|---|
| Blocker | `packages/services/src/intent-types.ts:27-96` | Public result includes `handled` and `windowId`; behavior includes `newWindow`. | Remove all forbidden fields. Define acceptance-only `IntentResult` and `focus`/`reuse` hints. |
| Blocker | `packages/services/src/catalog-intent-resolver.ts:214-258` | Resolver waits for `windows.open`, then returns `ok:true`, `handled:true`, and `windowId`. | Accept after compatible resolution and retained-delivery handoff; target startup/delivery happens later and produces no second source result. |
| Blocker | `packages/paja/src/browser-adapter.ts:413-435` | Paja can return `ok:true` with `handled:false`, `windowId`, and protocol—even for an unknown target. | Reject before acceptance or accept delivery responsibility; never report handling completion. |
| Blocker | `packages/services/src/intent-service.ts:118-155` | Invoke errors/throws use a top-level error instead of a structured correlated failed result. | Return `intent.invoke.result` with `{ok:false,error}` for every recognized pre-acceptance failure. |
| Blocker | `packages/runtime/src/runtime.ts:316-325` | ACL denial fabricates `intent.invoke.error`. | Return a correlated rejected `intent.invoke.result`. |

### Delivery coupled to source lifetime or NAP-INC

| Severity | Surface | Current conflict | Required correction |
|---|---|---|---|
| Blocker | `packages/services/src/intent-service.ts:14-22,107-116,183-205` | There is no retained `intent.deliver` path; target send state exists only for windows that called the service and is deleted on destruction. | Retain normalized delivery independently of source, look up an authenticated ready target, and push `IntentDelivery`. |
| High | `packages/runtime/src/types.ts:429-450` and `packages/runtime/src/domain-handlers.ts:179-187` | The service send seam is bound to the requesting window and cannot push to a different target. | Add an intent-specific authenticated target delivery seam; keep internal window handles off wire. |
| Blocker | `packages/services/src/catalog-intent-resolver.ts:36-82,214-258` | One `windows.open` operation conflates lifecycle, payload delivery, and result completion. | Separate acceptance/retention, target lifecycle, readiness, and eventual delivery. |
| Blocker | `apps/playground/napplets/feed/src/main.ts:62-72` and `profile-viewer/src/main.ts:1-11,211-232` | Profile delivery is an INC event and can be lost before subscription registration. | Use `intent.invoke` and binding-buffered `onDelivery`; no visible INC dependency. |
| Blocker | `apps/playground/src/shell-host.ts:124-150,472-551` and `demo-hooks.ts:32-50,115-205` | Playground has no live intent service, installed catalog, default/chooser, retained delivery, or target readiness wiring. | Maintain installed manifests separately from live frames and wire the full intent host lifecycle. |
| Blocker | `packages/paja/src/browser-adapter.ts:186-199,413-435` | Paja has a hard-coded running candidate and no installed catalog or carrier-neutral delivery. | Use installed contracts and the same acceptance/ready-delivery model. |

### Source and target overlap constrained

No code was found that explicitly requires source and target never to overlap.
The conflict is the absence of a policy-neutral retained delivery model and
coverage. The replacement tests must allow and prove:

- reuse of an already-open target;
- target startup before source close;
- source close before target startup;
- brief source/target overlap;
- retry/replacement/terminal-failure policy without a second source result.

`IntentBehavior.newWindow` is nevertheless forbidden caller-controlled
lifecycle policy and must be removed from
`packages/services/src/intent-types.ts:27-31`.

### Intent or delivery identifier introduced

No current intent-specific `intentId` or delivery ID was found. The existing
ordinary wire `id` remains valid only for immediate request/result correlation.
The public `windowId` returned by the current intent result is not a delivery ID,
but is still forbidden and must be removed. New implementation and tests must
not introduce `intentId`, delivery IDs, or IDs on `intent.deliver`.

## Resolved NAP-INC Channel Binding Ambiguity

The gap reported in
[`kehto/web#203`](https://github.com/kehto/web/issues/203#issuecomment-5060523475)
is addressed by stacked draft PR #92 at
`c5cd06f7be6d4690b303949abb26e87ff62f4729`, as recorded in the
[upstream reply](https://github.com/kehto/web/issues/203#issuecomment-5060904495).
Phase 102 must now implement `channel.onOpened`, target
`inc.channel.opened`, symmetric handles, `ChannelHandle.onClosed`, and the
specified opened/event/closed ordering and retention. It must keep
`ChannelInfo` informational and must not equate open success with
application-level target consent.

## Additional NAP-INTENT Contract Conflicts

| Severity | Surface | Conflict | Required correction |
|---|---|---|---|
| Blocker | `packages/services/src/intent-types.ts:27-96` | Old request-object/archetype API, optional action, protocol fields, no `IntentInvokeOptions`, `IntentContract`, or `IntentDelivery`. | Align the exported data model exactly with draft #91. |
| High | `packages/services/src/index.ts:160-186` | Re-exports obsolete intent types. | Export the new options, contract, delivery, request, result, and resolver seams; regenerate API docs. |
| Blocker | `packages/services/src/intent-service.ts:42-71` | Does not validate required queryless convention or archetype/action consistency. | Reject malformed or conflicting normalized wire requests before resolution. |
| Blocker | `packages/services/src/intent-service.ts:14-22,107-116,183-205` | No `intent.deliver`, retained queue, or `intent.changed` delivery to clients that only registered local handlers. | Add runtime pushes and local binding buffers independent of request activity. |
| High | `packages/acl/src/resolve.ts:298-323` | Treats `intent.deliver` like a napplet-originated read request and canonizes invented `.error` messages in tests. | Model delivery as runtime-to-target push and remove invented error shapes. |
| High | `packages/services/src/catalog-intent-resolver.ts:194-211` | Explicit dTag has no authorization hook; ambiguous candidate selection silently takes the first entry. | Require policy authorization and chooser/user policy; never silently first-pick. |
| Blocker | `packages/nip/src/5d/index.ts:78-104,144-158,183-195` | Drops tag positions 3+, repeated same-slug contracts, and event-kind metadata. | Preserve every contract and scoped unsigned event kind. |
| Blocker | `packages/services/src/manifest-intent-catalog.ts:20-75` | Invents `open`, overwrites repeated slugs, and lacks contracts. | Derive actions/conventions from retained contracts. |
| Blocker | `apps/playground/src/playground-intent-catalog.ts:20-52` | Verified-manifest adapter is test-only and protocol-shaped. | Wire a persistent installed-manifest catalog into the live service. |
| Medium | `apps/playground/src/demo-definitions.ts:36-46` | Intent is absent from the active service topology. | Advertise intent only after a real implementation is wired. |

No payload-kind inference implementation was found. The gap is that
`IntentContract.eventKinds` is absent entirely; tests must ensure future
resolution never inspects payload to synthesize a kind.

## Tests Preserving the Old Contract

| Test surface | Stale behavior to replace |
|---|---|
| `packages/shell/src/napplet-namespace.test.ts:198-203,516-521,727-755` | Old `profile:open` three-argument emit, intent request object, protocol forwarding, no query rejection/buffering/reassignment proof. |
| `packages/runtime/src/dispatch.test.ts:695-722,793-819` | Event sender equals `WINDOW_ID`; no forged-sender or raw-query isolation vector. |
| `packages/runtime/src/runtime.test.ts:68-145,183-216` | Channels target and expose window IDs. |
| `packages/nip/src/5d/index.test.ts:139-165` | Third archetype field is `NAP-1`/`NAP-2`; no contracts/kinds/query rejection. |
| `packages/services/src/manifest-intent-catalog.test.ts:1-79` | Default-open invention, protocol arrays, repeated-slug loss. |
| `packages/services/src/catalog-intent-resolver.test.ts:18-123` | Protocol selection, silent default behavior, handling-completion result. |
| `packages/services/src/intent-service.test.ts:17-32,70-116` | Archetype-only request and top-level error. |
| `packages/services/src/manifest-intent-dispatch.test.ts:19-80` | Protocol-shaped dispatch and no independent delivery. |
| `packages/runtime/src/intent-dispatch.test.ts:17-70` | Old invoke result/error framing. |
| `packages/acl/src/resolve.test.ts:509-545` | Invented `intent.invoke.error` and no runtime-push delivery direction. |
| `packages/services/src/notification-service.test.ts:14-16,48-100` | Prefix-routed incomplete synthetic `inc.event`. |
| New `packages/runtime/src/service-dispatch.test.ts` | Must prove every `inc.emit` bypasses the generic service registry regardless of topic prefix. |
| `tests/unit/playground-intent-catalog.test.ts:1-41` | Protocol arrays and invented open default. |
| `tests/unit/nip5d-conformance-guard.test.ts:235-252` | Requires numbered `NAP-1` metadata. |
| `tests/unit/playground-gateway-guard.test.ts:54-80,210-255` | Requires `NAP-1`, legacy `profile:open`, and direct INC target subscription. |
| `tests/e2e/nap-inc.spec.ts:25-75` | Only checks message type existence, not normalized topic/payload/sender/rejections. |
| `tests/e2e/profile-open.spec.ts:9-46` | Direct legacy INC emit; no authoritative intent URI or delivery buffering. |
| `tests/e2e/identity-flow.spec.ts:4,15` | Calls the old profile-open INC flow. |
| `tests/e2e/paja-single-window.spec.ts:539-552` | Raw availability only; no URI invoke, acceptance, ready delivery, buffering, or source teardown. |

## Documentation and Generated API Drift

| Surface | Required correction |
|---|---|
| `RUNTIME-SPEC.md:73-77,171-178` | Replace numbered manifest metadata and top-level intent errors with the proposed #90/#91 contract. |
| `apps/playground/README.md:38-54` | Replace INC `profile:open` guidance with authoritative URI intent and carrier-neutral delivery. |
| `docs/superpowers/specs/2026-06-15-nap-intent-design.md:1-6` | Preserve historical body, but add a prominent superseded-by-#90/#91 banner. |
| Generated `docs/api` intent interfaces, resolver/controller interfaces, manifest adapter function, and services module | Regenerate from corrected exports and statically reject obsolete `protocol(s)`, `handled`, `windowId`, and `newWindow` contract fields. |
| `packages/services/README.md`, `docs/packages/services.md`, `apps/playground/README.md`, `skills/add-service/SKILL.md`, `skills/integrate-shell/SKILL.md` | Remove active `audio:*`, `notifications:*`, and `createAudioService` guidance; preserve historical migration/changelog text. |

The affected generated pages currently include `IntentBehavior`,
`IntentRequest`, `IntentCandidate`, `IntentResult`,
`IntentArchetypeSupport`, `IntentAvailability`, `IntentCatalogEntry`,
`IntentOpenParams`, `IntentResolver`, `IntentWindowController`,
`CatalogIntentResolver`, `CatalogIntentResolverOptions`,
`manifestToIntentCatalogEntry`, and the services module index.

## Existing Correct Seams to Preserve

- The serialized prelude in
  `packages/shell/src/napplet-namespace.ts:96-160` is the correct web-binding
  owner for one shared convention URI normalizer.
- `packages/runtime/src/inc-handler.ts:125-132` already uses exact map lookup.
  Do not replace it with prefix, wildcard, or query-aware routing.
- Paja (`packages/paja/src/browser-target-frame.ts:81-101`) and playground
  (`apps/playground/src/shell-host.ts:522-549`) already consume the shared
  prelude; tests must ensure later shim assignment cannot replace its
  normalization guarantees.
- Manifest parsing and generation have clear validation seams at
  `packages/nip/src/5d/index.ts:144-157` and
  `apps/playground/napplets/shared-vite-config.ts:69-85`.

## Planning Consequences

1. Phase 102 must use both #89 and #90 exact heads, implement one projection
   normalizer used by INC and reusable by the later intent binding, protect INC
   from namespace/domain reassignment, prove runtime-attested sender identity,
   retire generic/service-owned prefix interception, and implement stacked #92
   symmetric channel handles with ordering/retention.
2. Phase 104 must become an independent NAP-INTENT and manifest-contract phase,
   not remain entirely blocked on package publication. It must implement
   URI-authoritative invocation, exact normalized validation, installed
   contracts, acceptance-only results, source-independent retained delivery,
   ready-only `intent.deliver`, sender attestation, and binding buffering.
3. Phase 105 must own published package adoption and migrate the live
   feed/profile flow from visible INC to `intent.invoke` / `onDelivery`.
4. Phase 106 must own the final active-surface vocabulary guard, generated API
   refresh, historical-design banner, full regression matrix, changesets, and
   exact-head re-audit.

Until these corrections are planned and checked, the existing Phase 102 plans
must not execute unchanged.
