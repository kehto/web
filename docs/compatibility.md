# Compatibility register

Retained compatibility has a removal boundary, a diagnostic, and regression
coverage. This register records both implemented safeguards and existing debt;
**debt is not an exemption for new or changed compatibility paths**. Ownership
below identifies the package responsible for the implementation and its tests.
No removal date is implied by an old source comment.

## FW-RUNTIME-LEGACY-GATE-001 — runtime without a permission adapter

`@kehto/runtime` retains the old temporal Firewall ingress for hosts that omit
`RuntimeAdapter.permissions`. It evaluates the older broad per-napplet policy,
content matchers, and burst counters. Configure `RuntimeAdapter.permissions`
and service-owned `authorizeOperation` calls for scoped approvals and the
independent rate limiter. The source and warning site is
`packages/runtime/src/legacy-firewall-gate.ts`; the public retained state
container is `packages/runtime/src/firewall-state.ts`. The warning fires once
per runtime instance on actual legacy ingress, without request data, and is
absent on configured ingress. `legacy-firewall-gate.test.ts` covers warning
content, frequency, legacy invocation, and canonical quietness; the existing
`firewall-dispatch.test.ts` covers retained burst, matcher, and policy behavior.
No broad legacy policy becomes a scoped interface, resource, or network grant.
This path remains for external hosts during migration. Once supported hosts
use the permission adapter, announce its removal in a 0.x minor release,
delete the legacy gate/state surface, and add negative tests for old config.

## Notification and gamepad approval transitions — services and Paja

`FW-NOTIFY-LEGACY-001` belongs to `@kehto/services`. When a host calls
`createNotifyService` without runtime `authorizeOperation`, host-only
notification effects still run and warn once per service instance. Attach
`RuntimeAdapter.permissions` so sending, permission requests, badges, and
channel registration use shared Firewall approval. The source and warning site
is `packages/services/src/notify-service.ts`; Paja's related browser state is
`packages/paja/src/browser-notify.ts`. The diagnostic contains no notification
content or app identity. `notify-service.test.ts` covers warning frequency,
canonical quietness, scope, denial, immutable payloads, revocation, window
reuse, and remote-icon rejection; `browser-notify.test.ts` covers late answers,
verified identity changes, and UI cleanup. Retain the fallback while external
hosts adopt a permission-enabled runtime. Remove it after supported consumers
migrate, a breaking release is announced, and negative tests reject host-only
effects. Authority: NAP-NOTIFY draft PR #11 at
`67877ef6c31ec8acee3125c1d8b4c781010e37dc`. The reference service's
remote-icon rejection is a bounded host policy until NAP-RESOURCE mediation is
wired; the NAP permits the shell to validate or reject icon URLs.

`FW-NOTIFICATION-LEGACY-001` belongs to `@kehto/services`. The older
`createNotificationService` registry retains `notify.create/list/read` and
warns once per service instance on actual legacy wire use. Replace the service
with canonical `createNotifyService` and NAP-NOTIFY `notify.send`.
Source/warning site: `packages/services/src/notification-service.ts`.
`notification-service.test.ts` covers legacy behavior, warning identifier and
frequency, no warning on unrelated INC traffic, approval before mutation,
revocation, and cross-window ownership. There is no upstream NAP for this
registry wire, so the retained path is a Kehto compatibility policy, not a
protocol extension. The playground is a known consumer and must migrate
before the old service can be removed. Announce a breaking release, remove the
legacy handler, and add rejection tests for the old messages at retirement.

`FW-GAMEPAD-LEGACY-001` belongs to `@kehto/services`. A `gamepad.subscribe`
without runtime `authorizeOperation` still attaches the host reader, warning
once per service instance. Attach a permission-enabled runtime to require
`gamepad:input` resource approval before native reads or subscriptions. Source
and warning site: `packages/services/src/gamepad-service.ts`; regression tests
in `gamepad-service.test.ts` cover warning frequency, quiet canonical access,
denial, late approval, and revoke/teardown cleanup. Retain the host-only path
while supported hosts migrate, then announce a breaking release, remove it,
and assert that an unbound reader cannot start. Authority: NAP-GAMEPAD merged
master at `19de5ce1cea40cd4c76089cdd8126e9f87648049`. The NAP has no
device handle, so this host-private resource covers the one shared input
surface; per-device grants would require an upstream protocol decision.

## Host-only upload path — services and Paja

Identifier: `FW-UPLOAD-LEGACY-001`. Owner: `@kehto/services` (with Paja as a
host consumer). `createUploadService` temporarily retains direct `Uploader.upload`
when no runtime approval context is attached. Replace it with
`RuntimeAdapter.permissions` and an `Uploader.planUpload()` that selects an exact
endpoint and host-attested signing pubkey before signing or byte egress. A
permission-enabled runtime rejects a backend without a prepared plan. Source and
warning site: `packages/services/src/upload-service.ts`; the HTTP reference plan
is in `packages/services/src/http-uploader.ts`, and Paja's plan is in
`packages/paja/src/browser-upload.ts`. The warning fires only on actual legacy
use, once per service instance, without payloads, names, URLs, or identity data.
Canonical shared-policy uploads remain quiet.

`packages/services/src/upload-service.test.ts` covers legacy warning content and
frequency, quiet canonical approval, immutable bytes and scope, denial, missing
signer identity, revocation, status ownership and replay. The HTTP and Paja
upload tests cover selection before signing, signer changes, transport abort,
redirect rejection, and server-confirmed Blossom bytes. Retain this path while
supported hosts and external service consumers migrate. Retirement requires a
breaking release announcement, migration of supported consumers, removal of
the host-only branch, and negative tests for unbound upload backends. The
optional `planUpload` type cannot detect legacy use until the host attaches a
runtime; the service boundary emits the runtime warning there. NAP-UPLOAD
authority: draft PR #33 at `f5cc981e527e2cc1572793a7a6e5082e5271ac49`.

## Host-only LINK approval — services

Identifier: `FW-LINK-LEGACY-001`. Owner: `@kehto/services`.
`createLinkService` retains its host-only `open` path when no shared runtime
`authorizeOperation` is attached. Replace it with `RuntimeAdapter.permissions`
or `ShellAdapter.permissions` and a trusted source `permissionPrincipal`.
The implementation and warning site are `packages/services/src/link-service.ts`.
It warns on actual legacy opener use once per service instance, with no URL or
payload. Construction and canonical shared-policy calls remain quiet.

Regression coverage: `tests/unit/firewall-link-approval.test.ts` verifies legacy
opening, warning identifier/action/frequency, quiet canonical calls, cancellation,
ACL restrictions, rate budgets, persistence failure, and replay behavior;
`packages/services/src/link-service.test.ts` covers canonical wire responses and
protocol validation. The path is retained while Paja, playground, and external
service consumers migrate. Removal requires migrating supported hosts, documenting
the breaking release, deleting the fallback, and negative coverage for unbound
openers. No old broad Firewall record is translated into new scoped authority.

The additive `permissionPrincipal`, `permissions`, and `authorizeOperation`
types cannot diagnose older callers at type-erased boundaries. LINK's host
boundary emits the diagnostic when legacy behavior is actually exercised.
Services without `onPermissionRevoked` temporarily receive their existing
`onWindowDestroyed` cleanup on revocation; this preserves conservative cleanup,
not a second grant source. Migrate each service's live-source response handling
before removing that fallback. No external release dependency is required.

## ACL principal fields — runtime

Identifier: `ACL_ENTRY_PRINCIPAL`. ACL lookup/listing now return required `dTag`
and `aggregateHash` fields. Use those fields with keyed policy methods instead
of identifying a policy by the retained `pubkey` display field. Listing pubkey
remains empty; keyed lookup preserves its existing pubkey argument behavior.
Source: `packages/runtime/src/acl-state.ts` and `types.ts`. Runtime regressions in
`acl-state.test.ts` cover distinct principals, reload, colon-bearing identifiers,
keyed mutation and detached results. The updated exported type requires custom
producers to provide the principal fields; the minor release records that change.

Diagnostic limitation: plain additive output fields do not expose whether a
consumer reads the old fields or ignores the new ones. There is no old-use warning
site; canonical enumeration stays quiet. Host policy UIs should use the returned
principal fields and surface errors at their own mutation boundary. No alternate
serialized format or parser fallback was added. Retiring the pubkey field requires
a separately announced breaking API migration and updated supported consumers.

## ACL persistence return values — runtime

Identifier: `ACL_PERSISTENCE_RESULT`. `AclStateContainer.persist()` and `clear()`
previously returned void and suppressed backend failures. They now return a
boolean outcome while preserving synchronous live mutation and nonthrowing save
behavior. Callers must check `false` and report/retry the failed save; reload can
still expose the previous durable policy. Source: `packages/runtime/src/acl-state.ts`;
guidance: `packages/runtime/README.md`; regression coverage:
`packages/runtime/src/acl-state.test.ts` (failure, retry, reload and observer order).

Diagnostic limitation: JavaScript cannot observe whether a caller consumes an
additive return value. There is no runtime old-use boundary or warning site;
canonical calls stay quiet. The typed boolean and API documentation provide
build-time guidance. Host save actions are the appropriate place to show errors.
Runtime destruction intentionally remains best-effort. No compatibility branch
is retained for removal; any future change to throwing semantics requires a
separate breaking release and migration of host save actions.

## Blossom sha256 prefix — Paja

Identifier: `KEHTO_COMPAT_BLOSSOM_SHA256`. `blossom:sha256:<hash>` input remains
accepted; use `blossom:<hash>` with the same extension and hints. Internal
reference keys and synthesized references now use the plain prefix. Resource
cache keys still preserve the caller's URL, per NAP-RESOURCE draft #80 at
`ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`.

`packages/paja/src/browser-blossom-compat.ts` warns once per host module lifetime
on valid alias requests from `browser-resource.ts` and `browser-blossom-events.ts`.
The pure URI parser stays quiet. Warnings contain no URLs, hashes or payloads.
`browser-blossom-uri.test.ts` covers both forms, canonical/malformed/aborted quiet
paths, migration text, warning frequency and sharing between host boundaries;
resource/event/integration suites retain hash, size, hint and source-isolation checks.

Retain the alias for published napplets until supported consumers migrate and a
breaking removal release is announced. Retirement requires negative alias tests
while preserving canonical reads and their security limits. Extensionless and
mixed-case reads remain pre-existing compatibility debt without use diagnostics;
their input grammar is unchanged by this normalization fix.

## Active paths changed in PR #277

| ID / owner | Old behavior and replacement | Warning / regression coverage | Retirement prerequisite |
| --- | --- | --- | --- |
| **INTENT_INC** — shell, Paja, playground | An exact-topic INC listener consumes a canonical intent locally when no `intent.onDelivery` listener exists. Migrate the consumer to `window.napplet.intent.onDelivery(handler)`. Hosts send only `intent.deliver`. | `KEHTO_COMPAT_INTENT_INC`, once per iframe on actual fallback use in `packages/shell/src/napplet-namespace.ts`. `napplet-namespace.test.ts`, suite `intent delivery and KEHTO_COMPAT_INTENT_INC`, covers matching, warning text/frequency, quiet canonical/ordinary INC paths, trust, close, buffering and no replay. `tests/e2e/paja-runtime-pointer.spec.ts` proves legacy reuse warns once; its cold-target test and `tests/e2e/playground-profile-intent.spec.ts` prove canonical delivery. | Migrate supported installed handlers, announce a removal release, then remove only the local legacy registration/dispatch adapter. Keep canonical buffering and ordinary INC behavior. Convert fallback fixtures to explicit rejection/non-delivery tests. |
| **LEGACY_MANIFEST** — nip | Explicit `x` aggregate marker selects the isolated pre-plugin-0.15 parser. Republish as a signed single-artifact event using `@napplet/vite-plugin >=0.15`. Malformed current events never retry as legacy. | `KEHTO_COMPAT_LEGACY_MANIFEST`, once per resolver module lifetime after successful signature, aggregate and blob verification. Implementation: `packages/nip/src/5d/legacy-manifest.ts`, called by `resolveNapplet`. `current-manifest.test.ts` tests quiet current/invalid input, warning and rate limit; `artifact-cache.test.ts` covers both formats and shared verified cache bytes. | Republish supported artifacts and fixtures, document the rejected legacy marker and release impact, then remove the parser/aggregate resolver branch. Preserve current signature/blob/cache checks. Test explicit legacy rejection. |
| **KEHTO_COMPAT_INTENT_OBJECT_INVOKE** — shell, services | Legacy object-form invoke adapters are retained only for existing napplets; canonical invocation is a complete convention URI plus options. | Warn once per napplet at actual adapter use with `KEHTO_COMPAT_INTENT_OBJECT_INVOKE`; URI normalization tests cover percent encoding, literal `+`, payload separation, and result shape. | Remove after runtime tests prove no installed napplet uses the object adapter and the next breaking service/shell release is announced. |
| **INTENT_BINDING** — shell, playground | Host-owned `onDelivery` binding and profile demo delivery type bridge the missing API in `@napplet/nap@0.32.0`. | No deprecation warning on canonical API use: this fills a packaged implementation gap, not an old consumer path. `napplet-namespace.test.ts` and `tests/unit/nip5d-conformance-guard.test.ts` cover the protected binding and bounded demo exception. | Upgrade to a package exposing the checked contract; remove local type/binding duplication only after proving early buffering, parent trust, protected namespace and both browser hosts. |
| **ARTIFACT_HASH_NAME** — nip, shell, Paja, services | Existing `aggregateHash` fields carry the current artifact hash or the original legacy aggregate. `artifactHash` is available from the resolver. Cache/ACL identity still uses the existing field. | No access warning: plain fields cannot distinguish old consumers from internal identity plumbing. This is an explicit diagnostic limitation, not a claim of runtime detection. `current-manifest.test.ts`, `artifact-cache.test.ts`, `packages/paja/src/browser-target-frame.test.ts` exercise verified identity across formats. | Coordinate a public API and persisted identity migration with cache/ACL owners. Do not rename keys or discard existing grants as part of parser removal. |

Authority: NAP-INTENT PR #106 at [`napplet/naps@fc121fc264615482143eda86125863d2e1f741a2`](https://github.com/napplet/naps/blob/fc121fc264615482143eda86125863d2e1f741a2/naps/NAP-INTENT.md) and NIP-5D PR #2303 at `020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7`. The legacy adapters are Kehto transition policies. Current intent delivery, URI invocation, accepted-result lifecycle, and opaque catalog identifiers align with that working authority; native external-origin sender semantics remain the documented upstream spec gap. See
[the conformance boundary](https://github.com/kehto/web/blob/main/docs/policies/NIP-5D-CONFORMANCE.md#intent-delivery-and-invocation-boundary).

## Existing compatibility inventory

Baseline: PR #277 at `016e9cf3`, reviewed 2026-10-09. These paths are recorded so
follow-up work can be scheduled without silently removing support in this PR.
**Missing** means a warning or dedicated regression still needs implementation;
a related test file is not proof of diagnostic coverage. Runtime changes here
require their own scoped specification check and migration PR.

| ID / owner | Source and retained behavior | Diagnostics and tests today | Next step / removal condition |
| --- | --- | --- | --- |
| **SESSION_ALIASES** — runtime, shell | `packages/runtime/src/session-registry.ts`, `types.ts`, `packages/shell/src/session-registry.ts`: `NappKeyRegistry`, `NappKeyEntry`, `createNappKeyRegistry`, `nappKeyRegistry` alias current session APIs. | JSDoc deprecation only; runtime warning and dedicated alias coverage missing. Type-only aliases have no runtime hook. | Migrate imports; warn on callable alias use without changing identity of singleton exports; add export/type regressions. Replace stale “v0.9.0” deadlines with an agreed release. |
| **AUTH_SHAPES** — runtime, shell, acl | `packages/runtime/src/types.ts`: deprecated `SessionEntry.pubkey`, `legacy-auth` provenance, optional shell-secret persistence; `packages/acl/src/types.ts`: ignored optional `pubkey`. Transport type also permits arrays while the shell bridge rejects them. | JSDoc only; no usage warning. This is retained API/type shape, not permission to re-enable AUTH or array dispatch. | Audit actual consumers and remove obsolete shapes in a breaking release. Keep source-identity and array-rejection regressions. |
| **STORAGE_KEYS** — runtime | `packages/runtime/src/state-handler.ts`: shared storage reads old pubkey-scoped/prefix keys and lists/cleans old keys. Instance scope does not fall back. | Warning missing. Related behavior tests: `packages/runtime/src/state-handler.test.ts`; diagnostic assertion missing. | Add warning on actual legacy read and migration evidence; retire only after persisted data is migrated. Preserve isolation and cleanup coverage. |
| **STORAGE_OK** — runtime | `state-handler.ts`: storage result includes compatibility `ok` alongside the current value/error shape. | Old consumer use cannot be observed from an additive result field; dedicated retirement regression missing. | Find consumers, document diagnostic limitation, test both response consumers before removing the field. |
| **ACL_KEYS** — acl, shell | `packages/acl/src/migrate.ts`: pure migration of three-part ACL keys to two-part identity keys. | `packages/acl/src/migrate.test.ts` covers conversion/collisions/idempotency. No runtime warning in the pure function. | Host caller should report actual migration; keep the pure API free of logging side effects. Retire only after persisted-state migration and retention policy are agreed. |
| **RESOURCE_FIELDS** — services, shell; retired on this implementation branch | Canonical NAP-RESOURCE PR #80 `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc` uses `id`, single `url` or ordered `urls`, and padded base64 wire bytes. The web binding returns decoded `Blob` values. Old `requestId`, object-form `requests`, wire `servers`, and Blob wire payloads are no longer supported inputs. | No warning remains for a removed path. Sources: `packages/services/src/resource-service.ts`, `packages/shell/src/types/internal-resource.ts`, and `packages/shell/src/napplet-namespace.ts`. Retirement evidence belongs in `resource-service.test.ts`, `napplet-namespace.test.ts`, and `tests/unit/nip5d-conformance-guard.test.ts`: reject old correlation/bulk/Blob inputs, ignore noncanonical server hints without network expansion, and preserve canonical correlation/base64/cancellation. Full combined regression verification is still pending. | Migrate supported consumers and publish the breaking 0.x minor changesets for services/shell/Paja. PR and release numbers are pending; record them at shipping. Preserve this row as retirement history. |
| **DOMAIN_ALIAS** — Paja | `packages/paja/src/parity.ts`: upstream `ifc` capability alias maps to `inc` in parity metadata. | `parity.test.ts` covers the declaration; no runtime warning. This metadata is not evidence that old wire messages are accepted. | Drop the metadata alias once upstream parity no longer needs it; check public export consumers first. |
| **NOTIFY_NAME** — playground | `apps/playground/src/playground-access-controls.ts`, `node-details.ts`: `notifications` UI/persisted target name maps to the `notify` domain. | Warning and dedicated migration assertion missing. | Separate display labels from persisted aliases, warn on migrated persisted input, prove existing settings survive before removal. |
| **OUTBOX_AGGREGATE** — services | `packages/services/src/relay-pool-outbox-router.ts`, `outbox-service.ts`: aggregate `query()` remains beside streaming `queryStream()`. | `relay-pool-outbox-router.test.ts` exercises both. No deprecation warning; aggregate API is still supported. | Decide whether to deprecate at all; if so add warning at the old callable boundary, publish replacement and test limit/abort/result parity. |
| **FIREWALL_SCOPE** — firewall | `packages/firewall/src/types.ts`, `evaluate.ts`: pure callers without an init key use dTag burst scope. | `packages/firewall/src/evaluate.test.ts` covers policy evaluation; no diagnostic assertion for this fallback. | Add a host-visible diagnostic when opting into old scope; migrate callers before requiring instance identity. Preserve the pure evaluator. |
| **PROXY_EMIT** — shell | `identity-proxy.ts`, `theme-proxy.ts`: deprecated `emit` methods throw and direct callers to controlled publication APIs. | Actionable errors already fail closed; related identity/theme proxy tests protect rejection. Stable compatibility IDs missing. | Remove deprecated members after callers migrate; never restore bypass publication while adding diagnostics. |
| **ENFORCE_EXPORT** — shell | `packages/shell/src/index.ts` re-exports runtime enforcement helpers. | No warning: module re-export cannot observe which import path was used. Dedicated public-export retirement test missing. | Decide whether to retain as supported convenience; if deprecated, use JSDoc/build-time guidance and a documented diagnostic limitation. |
| **ADDITIVE_TYPES** — runtime | `packages/runtime/src/types.ts`: optional audit reason and confirmation discriminator. | No runtime warning for erased aliases or optional type fields. Dedicated removal/type-compatibility assertions missing. | Inventory consumers before making fields mandatory or deleting aliases. Record compile-time diagnostics and type tests if deprecating. |

## Retirement sequence

1. **Observe:** assign an owner, add actionable diagnostics at actual old-path
   use, and close the missing regression coverage above. Rate-limit by a stated
   lifetime; avoid payloads or user secrets in warnings. Record exceptions for
   erased types, additive output fields, and pure functions at their host boundary.
2. **Migrate:** publish the replacement and move supported consumers/fixtures.
   Recheck the owning NAP before changing a protocol path. Lack of warning reports
   alone is not evidence that external consumers have migrated.
3. **Announce:** choose a release and document the removal and rollback strategy.
   On 0.x, a breaking removal needs a minor changeset.
4. **Remove:** delete the bounded adapter, add negative tests for retired inputs,
   retain canonical behavior/security tests, and record the removal PR and release
   here. Keep retired rows as history.

The AGENTS policy requiring warnings, tracking, and tests is proposed separately
in [PR #284](https://github.com/kehto/web/pull/284). This implementation PR leaves
`AGENTS.md` unchanged.


## FW-RESOURCE-LEGACY-001 — resolver-only resource authorization

- Owner: `@kehto/services`.
- Old behavior: resource requests without runtime authorization delegate policy
  entirely to the supplied resolver and optional origin-policy hooks.
- Replacement: configure `RuntimeAdapter.permissions` and trusted session
  `permissionPrincipal`; the reference service composes resource and network
  requirements through the runtime coordinator.
- Source: `packages/services/src/resource-authorization.ts`; warning site:
  `createResourceService` in `packages/services/src/resource-service.ts`.
- Diagnostic: once per service instance, only on actual legacy execution; no
  request payload or secrets are logged. Canonical configured calls stay quiet.
- Tests: `tests/unit/resource-approval-runtime.test.ts` verifies legacy execution,
  identifier/actionable text/frequency, quiet canonical execution, denial,
  cancellation, bulk independence, and revocation during body consumption.
- Retained for staged host migration. Removal requires migrating Paja/playground
  and supported standalone consumers, release notice, negative retirement tests,
  and a minor changeset on the current 0.x line. No removal release selected yet.
- This tracks authorization fallback only. RESOURCE_FIELDS records the separate
  wire retirement on this implementation branch; its combined regression and
  release evidence must be completed before shipping.

## FW-RELAY-SERVICE-LEGACY-001 — unplanned registered relay service

- Owner: `@kehto/runtime` and `@kehto/services`.
- Old behavior: a registered `relay` or `relay-pool` service implements only
  `handleMessage()`, allowing destination selection and transport dispatch after
  runtime routing.
- Replacement: implement `RelayPlanningServiceHandler` with pure
  `planRelayOperation()` and approved-plan-only `executeRelayOperation()`.
- Source and warning site: `packages/runtime/src/relay-handler.ts`. The warning
  fires once per legacy service instance on attempted use, names the replacement,
  omits relay URLs/events/plaintext, and planned handlers stay quiet.
- Regression coverage: `packages/runtime/src/runtime.test.ts`,
  `packages/services/src/relay-pool-service.test.ts`,
  `packages/services/src/coordinated-relay.test.ts`, and
  `tests/unit/relay-acl-revocation.test.ts` cover immutable targets, ordering,
  cancellation, same-ID retirement, and canonical results.
- Retention: migrate supported registered services; then add negative retirement
  tests, announce a 0.x minor removal, and record its release before deleting
  the fallback diagnostic.

## FW-RELAY-ADAPTER-LEGACY-001 — implicit relay-pool adapter execution

- Owner: `@kehto/runtime` and `@kehto/shell`.
- Old behavior: `RelayPoolAdapter.subscribe()` and `publish()` can select or fan
  out destinations after runtime approval.
- Replacement: implement `subscribeToRelays(relayUrls, filters, callback)` and
  `publishToRelays(relayUrls, event)` and execute only the immutable plan.
- Source and warning site: `packages/runtime/src/relay-handler.ts`; the shell
  adapter implements the replacement in `packages/shell/src/hooks-adapter.ts`.
  The warning fires once per legacy adapter on actual use, is actionable, omits
  request data, and explicit-target adapters remain quiet.
- Regression coverage: `packages/runtime/src/runtime.test.ts`,
  `tests/unit/relay-acl-revocation.test.ts`, and
  `tests/unit/nip5d-conformance-guard.test.ts` protect selector immutability,
  abort/cleanup, protocol wiring, and fail-closed legacy behavior.
- Retention: migrate Paja, playground, and supported custom shell adapters;
  publish release guidance, then remove deprecated implicit members with negative
  tests and a 0.x minor release. Structural mocks only warn when invoked.
