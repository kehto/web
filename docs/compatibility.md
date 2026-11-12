# Compatibility register

Retained compatibility has a removal boundary, a diagnostic, and regression
coverage. This register records both implemented safeguards and existing debt;
**debt is not an exemption for new or changed compatibility paths**. Ownership
below identifies the package responsible for the implementation and its tests.
No removal date is implied by an old source comment.

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

## FW-PAJA-SIMULATION-MODE-REMOVED-001 — retired firewall mode

`@kehto/paja` removed `--firewall-mode` and `simulation.firewall`. Those
settings only changed development metadata and never authorized an interface,
resource, or origin. CLI, JSON config loading, config merging, and direct
simulation normalization now reject the old input with guidance to use exact
Firewall grants. Source sites: `packages/paja/src/cli.ts`, `config-file.ts`,
and `simulation.ts`; negative tests: `cli.test.ts` and `config-file.test.ts`.
No compatibility path or runtime warning remains. The removal ships in the
Firewall host-approvals 0.x minor release; restoring the option would require
a new scoped contract and regression coverage.

## FW-PAJA-SIGNER-CONSENT-LEGACY-001 — remembered signer confirmation

`@kehto/paja` retains exact remembered signer confirmations from
`kehto:paja:signer-consent:v1` as a presentation preference after the runtime
Firewall coordinator approves the current sign operation. They cannot grant an
interface or authorize an operation by themselves. A matching legacy choice
warns once per page with the identifier, directs users to Firewall grants, and
states removal after a future 0.x minor release; canonical runtime approval is
quiet. The source and warning site is
`packages/paja/src/browser-host-signer.ts`; the old record parser and clear
controls are in `packages/paja/src/browser-signer-consent.ts`. Regression tests
in `browser-host-signer.test.ts` and `browser-signer-consent.test.ts` cover exact
signer, kind, artifact, and target matching, warning behavior, and failed
storage deletion. The old preference remains for existing Paja users during
the transition. Before removal, migrate supported consumers to Firewall grants,
announce the breaking 0.x minor release, delete the old store and warning, and
add negative tests that reject the legacy record. No old record is imported as
a Firewall grant. NIP-5D authority: draft PR 2303 at
`5560820fa4f37f45b8ab742a11aeb3001b17dc67`.

## FW-RUNTIME-LEGACY-GATE-001 — explicitly installed legacy behavioral policy

The old behavioral APIs now live in `@kehto/rate-limit/legacy`, including
`createFirewallState`. Hosts without scoped permissions must explicitly construct
and pass `RuntimeAdapter.legacyFirewall` (or `ShellAdapter.legacyFirewall`). Omission
installs no temporal gate. `@kehto/firewall` exports approval policy only.
Legacy policy/content controls remain for migration, but `allow` cannot bypass
installed temporal limits. The compatibility evaluator delegates to the canonical
rate evaluator rather than keeping a second counter algorithm.

`packages/runtime/src/legacy-firewall-gate.ts` warns on first actual legacy use,
once per runtime, without request data. Tests in `legacy-firewall-gate.test.ts`,
`firewall-dispatch.test.ts` and `firewall-registration.test.ts` cover use, frequency,
source lifetimes and limits; `@kehto/rate-limit/legacy` tests preserve config and
matcher behavior. Canonical hosts install `permissions.rateLimiter` and optionally
`promptRateLimiter`, retaining the instance for `setConfig` updates.

Retirement requires migrating external hosts to scoped permissions, announcing a
breaking minor release and removing this subpath and host hook together. Pure
legacy exports cannot emit use warnings; runtime integration supplies diagnostics.

## FW-RUNTIME-LEGACY-IGNORED-001 — legacy inputs on a configured runtime

With `RuntimeAdapter.permissions`, `legacyFirewall` and `onFirewallEvent` are ignored.
The runtime does not load or persist the ignored adapter. `createLegacyIgnoredWarning`
in `packages/runtime/src/legacy-firewall-gate.ts` warns once at creation; replacements
are `permissions.onRateLimit`, `permissions.persistence` and an explicitly supplied
`permissions.rateLimiter`. Shell forwards the same contract. Regression coverage is
in `legacy-firewall-gate.test.ts` and `nip5d-message-filter-approvals.test.ts`.
Remove this warning with the legacy gate above.

The previous `firewallPersistence` hook, `runtime.firewallState`,
`runtime.permissions.rateLimit`/`setRateLimit`, and runtime/shell rate evaluator
exports are removed in this breaking minor release. Construct an optional limiter
from `@kehto/rate-limit` and hold it to change configuration; legacy config persistence
is passed directly to `createFirewallState`. Types and exports provide compile-time
migration diagnostics; removed JavaScript properties have no retained fallback.

## FW-COUNT-LEGACY-001 — unbound COUNT service

`@kehto/services` retains direct `createCountService` execution when a host has
not attached `RuntimeAdapter.permissions`. It still resolves and freezes any
`planCount` relay destinations before calling the backend, but does not grant
network authority. Attach a permission-enabled runtime to approve the `count`
interface and each planned relay origin before the same relay list reaches
`count(request)`. Source and warning site: `packages/services/src/count-service.ts`.
The warning fires once per service instance on actual legacy COUNT use, never
on configured calls, and includes no filters or relay URLs.
`packages/services/src/count-service.test.ts` covers both paths, warning
frequency, planned target retention, canonical quietness, revocation, and the
NAP-COUNT failure shape. Paja's relay backend cancellation regression is in
`packages/paja/src/browser-relay-runtime.test.ts`. Retain the path while
external hosts migrate; then announce a 0.x minor removal, delete the direct
branch, and add a negative unbound-service test. Authority: NAP-COUNT draft PR
#69 at `9353a0c6c02c595f7e65ebd6df3802a7a45fc6bf`.

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
protocol extension. Announce a breaking release, remove the
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
protocol validation. The path is retained while Paja and external
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
| **INTENT_INC** — shell, Paja | An exact-topic INC listener consumes a canonical intent locally when no `intent.onDelivery` listener exists. Migrate the consumer to `window.napplet.intent.onDelivery(handler)`. Hosts send only `intent.deliver`. | `KEHTO_COMPAT_INTENT_INC`, once per iframe on actual fallback use in `packages/shell/src/napplet-namespace.ts`. `napplet-namespace.test.ts`, suite `intent delivery and KEHTO_COMPAT_INTENT_INC`, covers matching, warning text/frequency, quiet canonical/ordinary INC paths, trust, close, buffering and no replay. `tests/e2e/paja-runtime-pointer.spec.ts` proves legacy reuse warns once; its cold-target test proves canonical delivery (the playground profile-intent spec retired with the playground). | Migrate supported installed handlers, announce a removal release, then remove only the local legacy registration/dispatch adapter. Keep canonical buffering and ordinary INC behavior. Convert fallback fixtures to explicit rejection/non-delivery tests. |
| **LEGACY_MANIFEST** — nip | Explicit `x` aggregate marker selects the isolated pre-plugin-0.15 parser. Republish as a signed single-artifact event using `@napplet/vite-plugin >=0.15`. Malformed current events never retry as legacy. | `KEHTO_COMPAT_LEGACY_MANIFEST`, once per resolver module lifetime after successful signature, aggregate and blob verification. Implementation: `packages/nip/src/5d/legacy-manifest.ts`, called by `resolveNapplet`. `current-manifest.test.ts` tests quiet current/invalid input, warning and rate limit; `artifact-cache.test.ts` covers both formats and shared verified cache bytes. | Republish supported artifacts and fixtures, document the rejected legacy marker and release impact, then remove the parser/aggregate resolver branch. Preserve current signature/blob/cache checks. Test explicit legacy rejection. |
| **KEHTO_COMPAT_INTENT_OBJECT_INVOKE** — shell, services | Legacy object-form invoke adapters are retained only for existing napplets; canonical invocation is a complete convention URI plus options. | Warn once per napplet at actual adapter use with `KEHTO_COMPAT_INTENT_OBJECT_INVOKE`; URI normalization tests cover percent encoding, literal `+`, payload separation, and result shape. | Remove after runtime tests prove no installed napplet uses the object adapter and the next breaking service/shell release is announced. |
| **INTENT_BINDING** — shell | Host-owned `onDelivery` binding bridges the missing API in the packaged 0.32 binding that fixture napplets and the pinned shim 0.30.0 use (core 0.38.0 now declares `intent.onDelivery`; adopting it is a tracked follow-up) (the playground profile demo consumer retired with the playground). | No deprecation warning on canonical API use: this fills a packaged implementation gap, not an old consumer path. `napplet-namespace.test.ts` and `tests/unit/nip5d-conformance-guard.test.ts` cover the protected binding. | Upgrade to a package exposing the checked contract; remove local type/binding duplication only after proving early buffering, parent trust, protected namespace and the Paja host. |
| **ARTIFACT_HASH_NAME** — nip, shell, Paja, services | Existing `aggregateHash` fields carry the current artifact hash or the original legacy aggregate. `artifactHash` is available from the resolver. Cache/ACL identity still uses the existing field. | No access warning: plain fields cannot distinguish old consumers from internal identity plumbing. This is an explicit diagnostic limitation, not a claim of runtime detection. `current-manifest.test.ts`, `artifact-cache.test.ts`, `packages/paja/src/browser-target-frame.test.ts` exercise verified identity across formats. | Coordinate a public API and persisted identity migration with cache/ACL owners. Do not rename keys or discard existing grants as part of parser removal. |

Authority: NAP-INTENT PR #106 at [`napplet/naps@fc121fc264615482143eda86125863d2e1f741a2`](https://github.com/napplet/naps/blob/fc121fc264615482143eda86125863d2e1f741a2/naps/NAP-INTENT.md) and NIP-5D PR #2303 at `020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7`. The legacy adapters are Kehto transition policies. Current intent delivery, URI invocation, accepted-result lifecycle, and opaque catalog identifiers align with that working authority; native external-origin sender semantics remain the documented upstream spec gap. See
[the conformance boundary](https://github.com/kehto/web/blob/main/docs/policies/NIP-5D-CONFORMANCE.md#intent-delivery-and-invocation-boundary).

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
| **ACL_KEYS** — acl, shell | `packages/acl/src/migrate.ts`: pure migration of three-part ACL keys to two-part identity keys. | `packages/acl/src/migrate.test.ts` covers conversion/collisions/idempotency. No runtime warning in the pure function. | Host caller should report actual migration; keep the pure API free of logging side effects. Retire only after persisted-state migration and retention policy are agreed. |
| **RESOURCE_FIELDS** — services, shell; retired on this implementation branch | Canonical NAP-RESOURCE PR #80 `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc` uses `id`, single `url` or ordered `urls`, and padded base64 wire bytes. The web binding returns decoded `Blob` values. Old `requestId`, object-form `requests`, wire `servers`, and Blob wire payloads are no longer supported inputs. | No warning remains for a removed path. Sources: `packages/services/src/resource-service.ts`, `packages/shell/src/types/internal-resource.ts`, and `packages/shell/src/napplet-namespace.ts`. Retirement evidence belongs in `resource-service.test.ts`, `napplet-namespace.test.ts`, and `tests/unit/nip5d-conformance-guard.test.ts`: reject old correlation/bulk/Blob inputs, ignore noncanonical server hints without network expansion, and preserve canonical correlation/base64/cancellation. | Migrate supported consumers and publish the breaking 0.x minor changesets for services/shell/Paja. PR and release numbers are pending; record them at shipping. Preserve this row as retirement history. |
| **DOMAIN_ALIAS** — Paja | `packages/paja/src/parity.ts`: upstream `ifc` capability alias maps to `inc` in parity metadata. | `parity.test.ts` covers the declaration; no runtime warning. This metadata is not evidence that old wire messages are accepted. | Drop the metadata alias once upstream parity no longer needs it; check public export consumers first. |
| **NOTIFY_NAME** — playground (retired) | Was `apps/playground/src/playground-access-controls.ts`, `node-details.ts`: `notifications` UI/persisted target name mapped to the `notify` domain. | Removed with the playground app (`KEHTO_PLAYGROUND_RETIRED`); no remaining source or consumer. Playground-local browser storage is no longer read by any Kehto host. | Retired — kept as history. |
| **OUTBOX_AGGREGATE** — services | `packages/services/src/relay-pool-outbox-router.ts`, `outbox-service.ts`: aggregate `query()` remains beside streaming `queryStream()`. | `relay-pool-outbox-router.test.ts` exercises both. No deprecation warning; aggregate API is still supported. | Decide whether to deprecate at all; if so add warning at the old callable boundary, publish replacement and test limit/abort/result parity. |
| **FIREWALL_SCOPE** — rate-limit legacy | `packages/rate-limit/src/legacy/types.ts`, `evaluate.ts`: pure callers without an init key use dTag burst scope. | `packages/rate-limit/src/legacy/evaluate.test.ts` covers policy evaluation; no diagnostic assertion for this fallback. | Add a host-visible diagnostic when opting into old scope; migrate callers before requiring instance identity. Preserve the pure evaluator. |
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


## FW-RESOURCE-LEGACY-001 — resolver-only resource authorization

- Owner: `@kehto/services`.
- Old behavior: resource requests without runtime authorization delegate policy
  entirely to the supplied resolver and optional origin-policy hooks.
- Replacement: configure `RuntimeAdapter.permissions` and trusted session
  `permissionPrincipal`; the reference service composes resource and network
  requirements through the runtime coordinator.
- Source: `packages/services/src/resource-authorization.ts`; warning site:
  `createResourceService` in `packages/services/src/resource-service.ts`.
- Diagnostic: once per service instance, only on actual legacy execution,
  including host-only `ResourceService.openStream`; no request payload or secrets
  are logged. Canonical configured calls stay quiet.
- Tests: `packages/services/src/browser-media-stream-fetch.test.ts` covers the
  stream path; `tests/unit/resource-approval-runtime.test.ts` verifies legacy execution,
  identifier/actionable text/frequency, quiet canonical execution, denial,
  cancellation, bulk independence, and revocation during body consumption.
- Retained for staged host migration. Removal requires migrating Paja
  and supported standalone consumers, release notice, negative retirement tests,
  and a minor changeset on the current 0.x line. No removal release selected yet.
- This tracks authorization fallback only. RESOURCE_FIELDS records the separate
  wire retirement on this implementation branch.

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
- Regression coverage: `packages/runtime/src/relay-query-approvals.test.ts`,
  `packages/services/src/relay-pool-service.test.ts`,
  `packages/services/src/coordinated-relay.test.ts`, and
  `tests/unit/relay-acl-revocation.test.ts` cover immutable targets, ordering,
  cancellation, same-ID retirement, and canonical results.
- Retention: migrate supported registered services; then add negative retirement
  tests, announce a 0.x minor removal, and record its release before deleting
  the fallback diagnostic.

## FW-RELAY-NETWORK-LEGACY-001 — unapproved host-selected relay routing

- Owner: `@kehto/runtime`.
- Old behavior: unhinted host-tier relay traffic executes without
  `RuntimeAdapter.permissions`. Napplet-supplied network hints are no longer
  accepted on that path; local-only services are unaffected.
- Replacement: configure permissions and source-bound `permissionPrincipal`,
  approve canonical `relay.network` origins, and execute immutable destination
  plans through the normal runtime handler.
- Source/warning: `packages/runtime/src/relay-authorization.ts`; warns once per
  runtime instance only when unhinted legacy network execution occurs, naming
  the replacement without logging URLs, events, credentials, or principals.
- Tests: `tests/unit/relay-network-compatibility.test.ts` verifies legacy execution,
  warning text/frequency, quiet canonical/local calls, and rejection of hints.
  `tests/unit/relay-hint-authority.test.ts` covers fallback and both reference
  services, denial, immutable inputs, origin approval, revocation and replacement.
- Retention: unhinted adapters can migrate without losing their host-selected
  routing. Remove after supported hosts install operation authority, announce a
  breaking 0.x minor release, and retain negative tests for the retired path.
  No removal release is selected; issue #435's runtime minor changeset disables
  unapproved network hints now.

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
- Regression coverage: `packages/runtime/src/relay-query-approvals.test.ts`,
  `tests/unit/relay-acl-revocation.test.ts`, and
  `tests/unit/nip5d-conformance-guard.test.ts` protect selector immutability,
  abort/cleanup, protocol wiring, and fail-closed legacy behavior.
- Retention: migrate Paja and supported custom shell adapters;
  publish release guidance, then remove deprecated implicit members with negative
  tests and a 0.x minor release. Structural mocks only warn when invoked.

## Service authorization migration diagnostics

These six paths belong to `@kehto/services`. Each warning fires on actual legacy
execution **once per service instance**, names the replacement below, and includes
no device identifiers, event content, URLs, or other request data. Configured
approval-aware execution is quiet. Each source file owns its warning site.

| Identifier | Source and retained behavior | Replacement |
| --- | --- | --- |
| `FW-BLE-LEGACY-001` | `packages/services/src/ble-service.ts`: unbound host chooser/device hooks | Attach `RuntimeAdapter.permissions` and host-private selected-device approval. |
| `FW-SERIAL-LEGACY-001` | `packages/services/src/serial-service.ts`: unbound serial open/write hooks | Attach `RuntimeAdapter.permissions` and host-private selected-device approval. |
| `FW-FS-LEGACY-001` | `packages/services/src/fs-service.ts`: host-only filesystem authorization | Attach `RuntimeAdapter.permissions` and verified session `permissionPrincipal`. |
| `FW-DM-LEGACY-001` | `packages/services/src/dm-service.ts`: legacy adapter execution | Supply an approval-aware DM adapter with immutable relay planning. |
| `FW-COMMON-LEGACY-001` | `packages/services/src/common-service.ts`: unbound social-operation hooks | Supply immutable COMMON relay planning and a permission-enabled runtime. |
| `FW-LISTS-LEGACY-001` | `packages/services/src/lists-service.ts`: unbound list mutation hooks | Supply immutable LISTS mutation planning and a permission-enabled runtime. |

These paths retain standalone/custom-host compatibility during migration; they
must not bypass configured runtime authorization. Their domain service tests
cover authorized/denied execution and source cleanup. Dedicated diagnostic tests
in `packages/services/src/approval-compatibility.test.ts` assert legacy behavior,
actionable identifier/text, once-per-instance frequency, and quiet canonical use.
Removal requires migrating supported custom hosts, announcing the breaking 0.x
minor release, and adding negative tests for the removed path. No removal release
or upstream package prerequisite is selected; these are host API migrations,
not new NAP wire operations.

## FW-OUTBOX-LEGACY-001 — standalone OUTBOX router execution

- Owner: `@kehto/services`.
- Old behavior: an unattached service executes `getEvent`, `query`, `subscribe`,
  and `publish` through legacy router methods without shared approval.
- Replacement: attach `RuntimeAdapter.permissions` and an immutable-plan router;
  the service authorizes planned relay origins and executes only that snapshot.
  A configured authorizer with missing plan/execution hooks fails closed instead
  of falling back to unapproved relay I/O.
- Source and warning site: `packages/services/src/outbox-service.ts`.
- Diagnostic: `[FW-OUTBOX-LEGACY-001] Configure RuntimeAdapter.permissions and
  immutable OUTBOX relay planning; unapproved router execution is deprecated.
  Warning once per service instance.` Emitted only on actual standalone execution,
  without event/relay data; canonical use remains quiet.
- Tests: `packages/services/src/approval-review.test.ts` covers the diagnostic,
  denied reads, immutable destination execution, missing planner rejection,
  and cancellation/cleanup of planned queries.
- Retention: standalone/custom routers can migrate without silently acquiring
  new authority. Remove after supported consumers adopt planning, announce a
  breaking 0.x minor release, and add negative tests for legacy calls. No removal
  release is selected. Authority: NAP-OUTBOX PR #32 `8865f73d52a4864afee145f28d26520476273927`;
  this diagnostic is a host API migration, not a NAP wire extension.

  Issue #435 retires explicit `options.relays` on this standalone path in the
  services minor changeset. Unhinted calls alone retain this compatibility
  behavior. `packages/services/src/relay-hint-security.test.ts` covers correlated
  rejection before reads, subscriptions, publishing, discovery, or signing.

## Packaged intent type drift — core 0.40 (retired)

**KEHTO_INTENT_TYPES_UPSTREAM_DRIFT** was owned by `@kehto/services` and the shell binding. Core 0.40.0 exported a required delivery ID and nullable sender from a withdrawn NAP-INTENT revision ([napplet/web#328](https://github.com/napplet/web/issues/328)). Kehto kept a local no-ID, string-sender copy in `packages/services/src/intent-types.ts` while that drift lasted.

**Status: retired by [kehto/web#418](https://github.com/kehto/web/issues/418).** `@napplet/core@0.41.0` and `@napplet/nap@0.40.0` (napplet/web#329) export the current draft's delivery. `intent-types.ts` now only re-exports the core types under the existing `@kehto/services` names. `@kehto/services`, `@kehto/paja` and `@kehto/cli` therefore floor `@napplet/core` at 0.41.0, which is a breaking 0.x minor release for those packages. The shell's injected `window.napplet.intent` receiver stays Kehto-owned because the host installs it before `shell.ready`. Like the nap 0.40 binding, it drops deliveries without a non-empty string sender and never forwards a delivery ID.

These were erased types, so there was never a runtime warning site and none is added. Regressions: `packages/services/src/intent-types.test.ts` asserts the re-exports equal the core types and reject `id` and `sender: null`. Shell `napplet-namespace.test.ts` covers the empty- and null-sender drops, ID stripping, and trusted-parent buffering. `tests/unit/published-napplet-contract.test.ts` and `tests/unit/nip5d-conformance-guard.test.ts` guard against reintroducing a local contract. Authority: NAP-INTENT PR #128 `74f9bf85ebb83b50b7b2ad8308a835d5f3113cd9` and PR #106 `fc121fc264615482143eda86125863d2e1f741a2`.
