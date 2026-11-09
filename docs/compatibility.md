# Compatibility register

Retained compatibility has a removal boundary, a diagnostic, and regression
coverage. This register records both implemented safeguards and existing debt;
**debt is not an exemption for new or changed compatibility paths**. Ownership
below identifies the package responsible for the implementation and its tests.
No removal date is implied by an old source comment.

## Frame environment widening — shell

Identifier: `KEHTO_COMPAT_SHELL_ENV_OVERRIDE`. Before `ShellAdapter.extensions`,
the only way to expose a custom domain to a browser frame was to call
`originRegistry.setEnvironment(win, environment)` with domains outside the live
shell environment. That path still works unchanged, but it is superseded for
experimental domains: declare an `x-` domain with `ShellAdapter.extensions`
instead (see [Build an experimental NAP](./how-tos/experimental-nap.md)).

Warning site: `packages/shell/src/shell-ready.ts` (`warnOnEnvironmentWidening`)
emits one `console.warn` per page lifetime, prefixed
`[KEHTO_COMPAT_SHELL_ENV_OVERRIDE]`. It fires only when a stored frame
environment grants domains the live environment does not. The warning names the
replacement and reports a count, not the domain names or any payload. Narrowing
overrides, such as Paja storing its resolved snapshot, stay
quiet, and so does `ShellAdapter.extensions`.

Regression tests: `packages/shell/src/shell-extensions.test.ts` covers the
retained widening behavior, the warning's identifier and text, and its
once-per-page frequency, plus the quiet narrowing and extension paths.
`shell-environment-lifetime.test.ts` keeps the source-lifetime guarantees.

Retained because external hosts may rely on the exported registry method, and
because exact per-frame snapshots are still a legitimate narrowing tool. Removal
prerequisites: supported consumers move custom domains to
`ShellAdapter.extensions`; a release announces that `setEnvironment` will
intersect with the live environment; then widening is removed in a minor (0.x)
release with a negative test, keeping this entry with the removal PR/release.

## Outbox routing-author metadata — services / Paja

Identifier: `OUTBOX_ROUTING_AUTHORS`. `OutboxRelayPool.subscribe` now receives an
optional fifth `authors` argument: actual per-relay NIP-65 owners, or requested
routing authors for caller-hint/fallback reads. Implement diagnostic adapters with
this argument rather than inferring relay ownership from event filters. The router
always supplies an array, including an authoritative empty array. Existing
four-argument adapters remain valid and continue receiving unchanged filters.

Sources: `packages/services/src/relay-pool-outbox-types.ts`,
`relay-pool-outbox-router.ts`, and `packages/paja/src/browser-relay-runtime.ts`.
Runtime/API regressions in `relay-pool-outbox-router.test.ts` cover four-argument
adapters and metadata-aware adapters, option-derived and shared owners, asynchronous
discovery, and close boundaries. Paja's `browser-relay-runtime.test.ts` verifies
router/backend/panel attribution and preserves explicit empty metadata.

Diagnostic limitation: an additive callback argument has no observable old-use
boundary; function arity does not reliably prove whether an adapter consumes it.
There is no runtime warning site or warning lifetime. Canonical calls stay quiet;
the exported parameter and JSDoc provide build-time migration guidance. The host's
relay observation boundary can surface attribution when available, as Paja does.
Retain four-argument assignability because metadata is optional for transport-only
adapters; no deprecated alternate parser or wire format was added. Requiring
metadata consumption would need a separately announced breaking host-API change
and migration of supported adapters, not inference from absent warnings.

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
| **INTENT_INC** — shell, Paja | An exact-topic INC listener consumes a canonical intent locally when no `intent.onDelivery` listener exists. Migrate the consumer to `window.napplet.intent.onDelivery(handler)`. Hosts send only `intent.deliver`. | `KEHTO_COMPAT_INTENT_INC`, once per iframe on actual fallback use in `packages/shell/src/napplet-namespace.ts`. `napplet-namespace.test.ts`, suite `intent delivery and KEHTO_COMPAT_INTENT_INC`, covers matching, warning text/frequency, quiet canonical/ordinary INC paths, trust, close, buffering and no replay. `tests/e2e/paja-runtime-pointer.spec.ts` proves legacy reuse warns once; its cold-target test proves canonical delivery (the playground profile-intent spec retired with the playground). | Migrate supported installed handlers, announce a removal release, then remove only the local legacy registration/dispatch adapter. Keep canonical buffering and ordinary INC behavior. Convert fallback fixtures to explicit rejection/non-delivery tests. |
| **LEGACY_MANIFEST** — nip | Explicit `x` aggregate marker selects the isolated pre-plugin-0.15 parser. Republish as a signed single-artifact event using `@napplet/vite-plugin >=0.15`. Malformed current events never retry as legacy. | `KEHTO_COMPAT_LEGACY_MANIFEST`, once per resolver module lifetime after successful signature, aggregate and blob verification. Implementation: `packages/nip/src/5d/legacy-manifest.ts`, called by `resolveNapplet`. `current-manifest.test.ts` tests quiet current/invalid input, warning and rate limit; `artifact-cache.test.ts` covers both formats and shared verified cache bytes. | Republish supported artifacts and fixtures, document the rejected legacy marker and release impact, then remove the parser/aggregate resolver branch. Preserve current signature/blob/cache checks. Test explicit legacy rejection. |
| **KEHTO_COMPAT_INTENT_OBJECT_INVOKE** — shell, services | Legacy object-form invoke adapters are retained only for existing napplets; canonical invocation is a complete convention URI plus options. | Warn once per napplet at actual adapter use with `KEHTO_COMPAT_INTENT_OBJECT_INVOKE`; URI normalization tests cover percent encoding, literal `+`, payload separation, and result shape. | Remove after runtime tests prove no installed napplet uses the object adapter and the next breaking service/shell release is announced. |
| **INTENT_BINDING** — shell | Host-owned `onDelivery` binding bridges the missing API in the packaged 0.32 binding that fixture napplets and the pinned shim 0.30.0 use (core 0.38.0 now declares `intent.onDelivery`; adopting it is a tracked follow-up) (the playground profile demo consumer retired with the playground). | No deprecation warning on canonical API use: this fills a packaged implementation gap, not an old consumer path. `napplet-namespace.test.ts` and `tests/unit/nip5d-conformance-guard.test.ts` cover the protected binding. | Upgrade to a package exposing the checked contract; remove local type/binding duplication only after proving early buffering, parent trust, protected namespace and the Paja host. |
| **ARTIFACT_HASH_NAME** — nip, shell, Paja, services | Existing `aggregateHash` fields carry the current artifact hash or the original legacy aggregate. `artifactHash` is available from the resolver. Cache/ACL identity still uses the existing field. | No access warning: plain fields cannot distinguish old consumers from internal identity plumbing. This is an explicit diagnostic limitation, not a claim of runtime detection. `current-manifest.test.ts`, `artifact-cache.test.ts`, `packages/paja/src/browser-target-frame.test.ts` exercise verified identity across formats. | Coordinate a public API and persisted identity migration with cache/ACL owners. Do not rename keys or discard existing grants as part of parser removal. |

Authority: NAP-INTENT PR #106 at [`napplet/naps@fc121fc264615482143eda86125863d2e1f741a2`](https://github.com/napplet/naps/blob/fc121fc264615482143eda86125863d2e1f741a2/naps/NAP-INTENT.md) and NIP-5D PR #2303 at `020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7`. The legacy adapters are Kehto transition policies. Current intent delivery, URI invocation, accepted-result lifecycle, and opaque catalog identifiers align with that working authority; native external-origin sender semantics remain the documented upstream spec gap. See
[the conformance boundary](./policies/NIP-5D-CONFORMANCE.md#intent-delivery-and-invocation-boundary).

## Retired playground route — Pages

Identifier: `KEHTO_PLAYGROUND_RETIRED`. The `@kehto/playground` demo app
(`apps/playground` and its demo napplets) is deprecated and removed from the
workspace, build, CI, Playwright suite, and docs; it is no longer maintained.
The private app was never published to npm or JSR, so the only external surface
is the public URL `https://kehto.github.io/web/playground/`. That route now
serves a static redirect page instead of the playground shell. Replacement: the
[Paja Runtime](https://kehto.github.io/web/paja/) (`@kehto/paja`) for hosting
napplets, and for e2e coverage the harness fixtures under `tests/fixtures/napplets` plus the
Paja service-flow specs (`tests/e2e/paja-{relay,storage,identity,cvm}.spec.ts`), which
took over the playground's relay, storage, ACL-revoke, signer/identity, and CVM scenarios.

Source: `web/playground/index.html`, copied by `scripts/build-pages.mjs` and
checked by `scripts/audit-pages-artifact.mjs` (which also fails if the portal
links the retired route or the route ships napplet-gateway artifacts).
Warning: a single `console.warn` naming `[KEHTO_PLAYGROUND_RETIRED]` and
`/web/paja/`, emitted once per visit to the retired route, then a 5-second
meta refresh to `/web/paja/` (with `noindex` and a canonical link). Canonical
routes (`/web/`, `/web/paja/`, `/web/docs/`) never emit it. Regression coverage:
`tests/unit/retired-playground-redirect.test.ts` executes the page script to
assert the identifier, replacement, and single emission; checks the redirect
target and that no napplet frames or bundles load; and runs the Pages audit
against artifacts with and without the redirect.

Reason for retention: external links and bookmarks to the public demo. Removal
prerequisites: announce the route removal in a release note, then delete
`web/playground/`, the copy in `build-pages.mjs`, the audit check, and the test
together. The last commit containing the playground source is the parent of the
retirement PR; recover it from git history if ever needed.

## Retired window-level NIP-5D transport — shell / Paja

Identifier: `NIP5D_WINDOW_TRANSPORT_RETIRED`. Retired without a compatibility
path. Kehto used to key napplet sessions on the iframe `Window`
(`MessageEvent.source`), accept NAP envelopes as window-level `message` events,
and reply with `iframeWindow.postMessage`. A `Window` survives same-frame
navigation, so a napplet could replace itself with unverified content that kept
its identity, sessions and grants. [NIP-5D](https://github.com/nostr-protocol/nips/pull/2303)
at `51ef0cd33a5694784306f3260d90b1872545fdee` (packaged by napplet/web#302 in
`@napplet/core@0.37.0`) binds identity to the `MessagePort` the bootstrap
hands over in a single window-level `napplet.hello`, and forbids processing NAP
from any other source. A shim would reopen the vulnerability, so none is kept.

Replacement: the injected prelude opens the channel and sends the hello before
napplet scripts run; `ShellBridge.handleMessage` binds the port; every sender
uses `originRegistry.postToNapplet` / `getNappletTarget`. Hosts remove frames
in `ShellAdapter.onNappletRevoked`, watch for a second load with
`ShellBridge.observeFrame`, observe port traffic with
`ShellAdapter.onNappletMessage`, and create a fresh iframe for every
navigation. API changes made for this: `ProxyOriginRegistry` requires
`postToNapplet` instead of `getIframeWindow`; `RelayPoolHooks.openScopedRelay`
receives a `NappletMessageTarget` instead of a `Window`; and
`originRegistry.register` throws for a `Window` that already handed over (or
lost) its port. Napplets built with a shim that posts at window level, including
`@napplet/shim` before 0.35.0, are revoked. Napplets on a Kehto host should rely
on the host-injected `window.napplet`. Importing `@napplet/shim` as well sends a
second hello, which the shell treats as document replacement.

Sources: `packages/shell/src/shell-bridge.ts`, `origin-registry.ts`,
`napplet-namespace.ts`, `packages/paja/src/browser-nip5d-host.ts`,
`browser-target-frame.ts`, and `tests/e2e/harness/harness.ts`. Diagnostic: the
revocation itself. `onNappletRevoked` receives `{ windowId, reason, detail }`
(`window-message`, `second-hello`, `invalid-hello`, `second-load`,
`port-closed`, `host`), at most once per frame because the frame is then removed.
Paja logs it as `paja.napplet.revoked`. Payloads are never included. Canonical
traffic produces no diagnostic. Regression coverage:
`packages/shell/src/nip5d-port-binding.test.ts` (real `MessageChannel`s: binding,
legacy window-level envelope before and after the hello, second hello, invalid
hello, second load, port close, host retirement, foreign sources, observe hook),
`shell-bridge.test.ts` and `shell-environment-lifetime.test.ts` (a stable
`WindowProxy` cannot be re-bound), `packages/paja/src/browser-nip5d-host.test.ts`,
`tests/unit/nip5d-conformance-guard.test.ts` (static guards), and
`tests/e2e/nip5d-port-binding.spec.ts` (real sandbox: self-navigation and
window-level envelopes revoke and remove the frame).

Reason for retention: none; this entry records the retirement and the one
remaining window-level exception, Paja's signed intent launcher host messages
(see [NIP-5D conformance policy](https://github.com/kehto/web/blob/main/docs/policies/NIP-5D-CONFORMANCE.md#window-level-host-message-allowlist)).

## Required Trusted Types in the napplet CSP — shell / Paja

Identifier: `NIP5D_TRUSTED_TYPES_REQUIRED`. **Opt-in**, off by default: applies
only when a host sets the experimental flag `experimental.nestedContextLock`
(see [Experimental namespace](https://github.com/kehto/web/blob/main/docs/policies/EXPERIMENTAL.md)).
When enabled, to lock nested-browsing-context creation the napplet CSP carries
`require-trusted-types-for 'script'; trusted-types default`, and the injected
prelude registers the single admitted `default` Trusted Types policy before any
napplet script (see [NIP-5D conformance policy](https://github.com/kehto/web/blob/main/docs/policies/NIP-5D-CONFORMANCE.md#nested-browsing-contexts)).
When enabled, this changes the napplet execution contract: all DOM HTML-string
sinks pass through that policy. Hosts that do not opt in are unaffected.

Retained behavior: canonical use is unaffected. A napplet that assigns plain
HTML strings to a sink gets the policy's pass-through result, so existing
napplets keep working; only a string carrying a frame tag is rejected (an
operation a napplet has no legitimate reason to perform). The one broken case is
a napplet that registered its own Trusted Types policy named `default`: the
`trusted-types default` directive admits exactly one `default`, so the napplet's
own registration throws `TypeError`. The prelude registers first, so Kehto's
policy wins and the lock holds; the napplet's call is what fails.

Warning: the prelude's `default` policy creation is wrapped so a collision does
not block load, and the factory pins plus the host byte scan still hold, so the
lock degrades rather than fails. A napplet whose own `default` registration
throws sees the browser's `TypeError` with the Trusted Types identifier in the
message; Kehto adds no console spam on the canonical path.

Sources: `packages/shell/src/napplet-csp.ts` (directive), `napplet-namespace.ts`
(prelude policy + factory pins), `napplet-frame-scan.ts` (host byte scan),
`packages/paja/src/browser-target-frame.ts` (scan on the verified load path).
Regression coverage: `napplet-csp.test.ts` (directive present, not overridable),
`napplet-frame-scan.test.ts`, `napplet-namespace.test.ts`,
`packages/paja/src/browser-target-frame.test.ts` (frame-declaring napplet
rejected), `tests/unit/nip5d-conformance-guard.test.ts` (static guard), and
`tests/e2e/shell-csp.spec.ts` (scripted bypass battery + byte scan in real
Chromium).

Reason for retention: the pass-through default policy is the compatibility path
itself — it keeps canonical string-sink use working while the frame-tag
rejection and factory pins close creation. Removal condition: none planned; the
lock is permanent. Revisit only if a shipped `webrtc` CSP directive makes the
nested-realm egress moot (see NIP-5D conformance policy, "Direct WebRTC egress").

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
| **ACL_KEYS** — acl, shell | `packages/acl/src/migrate.ts`: pure migration of three-part ACL keys to two-part identity keys; on a collision caps and blocks merge as a union, quota takes the maximum, and an explicit x- revocation wins. | `packages/acl/src/migrate.test.ts` covers conversion/collisions/idempotency; `packages/acl/src/extensions.test.ts` covers the deny-wins x- merge (IN-08). No runtime warning in the pure function. | Host caller should report actual migration; keep the pure API free of logging side effects. Retire only after persisted-state migration and retention policy are agreed. |
| **RESOURCE_FIELDS** — services, shell | `packages/shell/src/types/internal-resource.ts`, `packages/services/src/resource-service.ts`: old `requestId` input and legacy resource response type fields. | Warning missing. Related tests: `packages/services/src/resource-service.test.ts`; inventory must distinguish live correlation fallback from historical response-type/comment fields. | Recheck owning NAP, inspect emitted response helpers, map old consumers, then warn/test actual old input use and remove stale types separately. |
| **DOMAIN_ALIAS** — Paja | `packages/paja/src/parity.ts`: upstream `ifc` capability alias maps to `inc` in parity metadata. | `parity.test.ts` covers the declaration; no runtime warning. This metadata is not evidence that old wire messages are accepted. | Drop the metadata alias once upstream parity no longer needs it; check public export consumers first. |
| **NOTIFY_NAME** — playground (retired) | Was `apps/playground/src/playground-access-controls.ts`, `node-details.ts`: `notifications` UI/persisted target name mapped to the `notify` domain. | Removed with the playground app (`KEHTO_PLAYGROUND_RETIRED`); no remaining source or consumer. Playground-local browser storage is no longer read by any Kehto host. | Retired — kept as history. |
| **OUTBOX_AGGREGATE** — services | `packages/services/src/relay-pool-outbox-router.ts`, `outbox-service.ts`: aggregate `query()` remains beside streaming `queryStream()`. | `relay-pool-outbox-router.test.ts` exercises both. No deprecation warning; aggregate API is still supported. | Decide whether to deprecate at all; if so add warning at the old callable boundary, publish replacement and test limit/abort/result parity. |
| **FIREWALL_SCOPE** — firewall | `packages/firewall/src/types.ts`, `evaluate.ts`: pure callers without an init key use dTag burst scope. | `packages/firewall/src/evaluate.test.ts` covers policy evaluation; no diagnostic assertion for this fallback. | Add a host-visible diagnostic when opting into old scope; migrate callers before requiring instance identity. Preserve the pure evaluator. |
| **PROXY_EMIT** — shell | `identity-proxy.ts`, `theme-proxy.ts`: deprecated `emit` methods throw and direct callers to controlled publication APIs. | Actionable errors already fail closed; related identity/theme proxy tests protect rejection. Stable compatibility IDs missing. | Remove deprecated members after callers migrate; never restore bypass publication while adding diagnostics. |
| **ENFORCE_EXPORT** — shell | `packages/shell/src/index.ts` re-exports runtime enforcement helpers. | No warning: module re-export cannot observe which import path was used. Dedicated public-export retirement test missing. | Decide whether to retain as supported convenience; if deprecated, use JSDoc/build-time guidance and a documented diagnostic limitation. |
| **ADDITIVE_TYPES** — runtime | `packages/runtime/src/types.ts`: optional audit reason and confirmation discriminator. | No runtime warning for erased aliases or optional type fields. Dedicated removal/type-compatibility assertions missing. | Inventory consumers before making fields mandatory or deleting aliases. Record compile-time diagnostics and type tests if deprecating. |
| **PAJA_LLM_TOOL_FIELDS** — Paja | `packages/paja/src/browser-llm-connections.ts`: the persisted `kehto:paja:llm-connections:v1` rows gain optional `tools` and `toolChoiceModes`; a row saved before tool support omits them. | No warning: an older row behaves exactly as a tools-off connection (`tools: false`, `toolChoiceModes: []`), so there is no old-use path to flag and the user has nothing to migrate. `packages/paja/src/browser-llm-connections.test.ts` (`loads a row saved before tool support as a tools-off connection under the same storage key`, plus canonical-mode ordering) covers it. | Nothing retires: the fields stay optional with a tools-off default and the storage key does not change. Revisit only if a future change needs a required field, which would need a versioned key and migration. |

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

## NAP-MEDIA command API (2026-10-27)

- **Identifiers:** `KEHTO-MEDIA-SEND-COMMAND`, `KEHTO-MEDIA-COMMAND-CALLBACK`.
- **Owner:** `@kehto/shell`; source and warning site:
  `packages/shell/src/napplet-namespace.ts`, `makeMedia`.
- **Old/replacement:** `sendCommand(id, action, value)` becomes
  `command(id, { action, value, reason })`; `onCommand(id, (action, value) => ...)`
  becomes `onCommand(id, command => ...)`.
- **Warnings:** on alias invocation or registration of a callback declaring at
  least two parameters; once per identifier per injected endpoint lifetime.
  Canonical usage is quiet. Payloads and source URLs are not logged.
- **Diagnostic limitation:** function arity cannot distinguish unary legacy
  action callbacks from canonical command-object callbacks. Unary callbacks now
  receive objects and must migrate; this is a breaking 0.x minor. Rest/default
  arguments that erase arity are likewise not detected. The old published SDK
  types cannot describe the new object contract; use the documented injected API
  and Kehto `MediaPlaybackCommand` until Napplet publishes updated types.
- **Tests:** `packages/shell/src/napplet-namespace.test.ts`, NAP-MEDIA injected
  lifecycle suite covers canonical silence, legacy behavior, warning text and
  frequency, close handles, parent trust, reassignment, and retired-session guards.
- **Retention reason:** published `@napplet/nap` 0.32 delegates `mediaSendCommand`
  and two-argument `mediaOnCommand` callbacks to the injected namespace.
- **Removal prerequisites:** upstream packages implement NAP-MEDIA PR #10
  `7806f438530251fce5129f8e6239d6b642278759`, supported consumers migrate, and a
  removal release is announced. Track removal in this register; warning silence
  is not proof of migration.

## Paja signing-only approval records (2026-10-28)

- **Identifier / owner:** `KEHTO-PAJA-SIGNER-CONSENT-V1`, `@kehto/paja`.
- **Old / replacement:** older `kehto:paja:signer-consent:v1` records contain only
  `trusted` and `kinds` for signing. Current records also contain separate
  publication fields, and the modal offers explicit combined version approval.
  Loading an old record preserves its signing behavior; omitted publication
  fields always deny publication until separately approved.
- **Source / warning:** `packages/paja/src/browser-signer-consent.ts`,
  `readConsentDocument`. One actionable warning per host module lifetime, only
  when an old valid record is loaded; no identities or event payloads are logged.
  Current records and canonical creation remain quiet.
- **Tests:** `browser-signer-consent.test.ts` proves preserved signing, absent
  publication authority, warning identifier/text/frequency, canonical silence,
  version/account/publisher separation and revocation. Browser approval tests
  cover the runtime boundary and modal behavior.
- **Retention reason / retirement:** preserve existing signing choices without
  silently expanding authority. Remove old-record reading only after announcing
  a Paja release, migrating or explicitly resetting supported stored consumers,
  and retaining negative authority tests plus this removal record.
- **Retired policy:** direct-target URL trust no longer survives a document or
  frame reload. Unversioned development targets now use a fresh host document
  nonce and frame-load identity; signed versions use the complete manifest key
  plus artifact hash. The Paja minor changeset announces this stricter boundary.
