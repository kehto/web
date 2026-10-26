# Scoped Firewall approvals

Hosts supplying `RuntimeAdapter.permissions` (or `ShellAdapter.permissions`)
use pre-execution interface admission.
Built-in interface dispatch requires its admission grant; LINK and declared
service extensions also support held operation approvals. Resource/network scope
enforcement now covers migrated service operations including filesystem, device,
relay, upload, social, media, and local-state work. Existing Firewall
configuration is not converted into scoped grants. Paja and playground use
shared approval presentation and frame admission before executable bytes enter
an iframe.

## Responsibilities

`@kehto/firewall` evaluates immutable permission scopes and grant lifetimes.
Runtime coordinates pending decisions, revalidates live sources and ACL policy,
consumes one-use grants, and enforces independent rate budgets. The host supplies
UI, cancellation, time, and durable storage. Services validate protocol requests
and produce their specified responses.

The LINK service validates a URL before requesting its exact `resource` scope
for `link.open`. Policy also requires the `link` interface. Neither grant gives
the iframe direct network access. The host opener remains responsible for
opening outside the sandbox with opener isolation. Forbidden local/code schemes
remain forbidden even if listed in `allowedProtocols`.

## Host adapters

```ts
import type { PermissionAdapter } from '@kehto/runtime';

const permissions: PermissionAdapter = {
  now: Date.now,
  createCancellation: () => new AbortController(),
  schedule(callback, delay) {
    const timer = setTimeout(callback, delay);
    return () => clearTimeout(timer);
  },
  prompt: async ({ request, missing, signal, allowLifetimes }) => {
    // Render trusted identity + exact scopes; never treat app labels as authority.
    // The UI must close on signal.abort and return an explicit lifetime.
    return showApproval({ request, missing, signal, allowLifetimes });
  },
  persistence: {
    load: () => localStorage.getItem('kehto:permissions:v1'),
    persist: (document) => localStorage.setItem('kehto:permissions:v1', document),
  },
  onStorageError: (failure) => showPermissionStorageError(failure),
};
```

`showApproval` and `showPermissionStorageError` are host UI functions. Storage
adapters must throw when a write fails. A persistent approval is published only
after a successful write. Without storage, once/session choices work; persistent
choices fail explicitly. Defaults bound pending operations to 64 with a 60-second
deadline, including queue time. `maxPending` and `timeoutMs` configure these bounds.
`rateLimit` configures independent operation budgets; `onRateLimit` reports excess
budgets without including payloads or destinations. Diagnostic failures cannot
override enforcement. Startup interface admission does not spend an app operation
budget; actual operations are charged after launch.

Storage and INC operations also spend this budget at dispatch when they have no
service coordinator; CONFIG settings-opening requests are bounded there too.
Excess storage requests and INC subscribe/channel-open requests receive their
specified correlated denial, while fire-and-forget sends can be dropped. Cleanup
(unsubscribe/channel-close) remains available after budget exhaustion.

NAP-CONFIG PR #14 `bed9cb5b` mandates value snapshots and schema acknowledgments
but defines no temporal-budget error contract for them. NAP-INC master
`19de5ce1` likewise requires channel listings without a denial shape. Those
mandatory response paths are charged and diagnosed but still dispatched; this is
an explicit spec gap, not a claim that every domain message can be blocked.
Defining rejection/backpressure for them requires an upstream contract decision;
Kehto does not invent error codes or replace current values with an empty success.
In particular, repeated CONFIG schema registration can still validate and persist
values after the budget is exceeded. The current schema depth checks are not a
total work/size bound; this residual flood risk is intentionally deferred to that
missing denial/backpressure contract.

`promptRateLimit` separately bounds actual UI prompts. The default blocks beyond
12 prompts per minute, with eight permitted during the first three seconds of a
source lifecycle. Existing grants and deduplicated requests do not consume this
budget unless they need another prompt. Replacement does not replenish the
principal's prompt or operation token buckets. `defaultPromptRateLimitConfig()`
exports this default independently of the permission model.

Hosts register `permissionPrincipal` through `OriginIdentity` or `SessionEntry`:

- Verified: `{ kind: 'verified', manifestKey: catalogId, artifactHash }`, using
  the resolver-verified manifest/catalog identity and artifact bytes.
- Development: `{ kind: 'development', target, artifactHash }`, using the exact
  development target and the host-computed artifact hash. Persistent grants are
  forbidden for these principals.

The principal hash must equal the session artifact hash. A dTag/hash tuple alone
does not establish publisher identity and cannot authorize this path. Registries
detach and freeze principal data; no identity is taken from wire messages. Session
grant generations are runtime-generated and do not reuse persistent instance GUIDs.

## Admission before executing app bytes

Register a trusted provisional session before rendering the app. Pass the verified
manifest's required/optional domains and the host's actual available domains to:

```ts
const permissions = runtime.permissions;
if (!permissions) throw new Error('Configure host permission adapters first');
const admission = await permissions.admit(windowId, {
  required: manifest.requires,
  optional: manifest.optional,
  available: availableEnvironment.capabilities.domains,
});
if (admission.status !== 'admitted') {
  runtime.destroyWindow(windowId);
  runtime.sessionRegistry.unregister(windowId);
  throw new Error('Application interfaces were not approved');
}
// After any further awaited preparation, revalidate immediately before rendering.
if (!permissions.isAdmissionCurrent(windowId, admission)) {
  throw new Error('Application admission expired');
}
// Inject only admission.domains and the corresponding available services.
```

The host must obtain a new provisional session for navigation/replacement. Required
denial or unavailability prevents admission. Optional denial omits that interface.
Unused available domains are not automatically granted. Kehto offers the
read-only `shell` readiness/environment control plane when it is available,
independently of app permission grants; NAP-SHELL is optional under the checked
upstream authority. Admission accepts session/persistent positive
choices, never once; development sources can choose only session. The prompt's
immutable `allowLifetimes` tells the UI which positive choices apply. Deny-once
remains available. Startup grants do not grant resources or network destinations.
The shared browser UI serializes up to 64 distinct pending prompts; an aborted
source leaves that queue immediately. Its grant-management list reads the runtime
store after each decision, so concurrent frames share one visible authority.

An admission result is an immutable host token bound to the exact source generation.
Copies and forged results fail revalidation. Revocation, retirement, teardown, or
ACL blocking invalidate its use. Paja's verified, local-file, and live-development
frame loaders and the playground's verified demo/installed target loader use this
transaction.

Paja's live development target is an unsigned principal bound to its exact URL
and fetched-byte SHA-256; local files use a separate development principal.
The playground currently loads resolver-verified catalog artifacts only. It has
no unsigned file or dev-server launch control. Its demo configuration, relay
and Blossom hints, and preferences cannot create grants or direct browser
authority. A future development loader must call `admitBrowserDocument` with a
fresh development principal and the same currentness checks.

The shared CSP starts with `default-src 'none'`. A verified playground artifact
has no direct remote browser sources and can use the mediated `resource`
interface after its own approval. Paja's live target proposes exact origins per
supported `connect`, `script`, `style`, `image`, `font`, `worker`, and `media`
directive. Browser source lists use CSP scheme matching: an HTTP source also
permits HTTPS at the CSP-matched port, and WebSocket sources follow CSP upgrade
rules. Chromium 152 permits the default-port HTTP-to-HTTPS upgrade but blocks
it on the same nondefault port; the source contract follows CSP rather than
relying on that narrower engine behavior. These are directive-specific browser
source grants, not literal URL-origin equality checks. Mediated network
authorization still matches canonical origins exactly. Each source needs a network grant; direct mode excludes `resource`.
Required `resource` plus direct mode fails before launch, while optional
`resource` is omitted explicitly. Frame, child, object, manifest, and form
destinations stay closed. Paja permits its host-injected `<base>`
only at the already approved development origin so relative assets resolve;
this adds no remote source beyond the directive-specific grants. Direct iframe
traffic is outside parent mediation and operation rate budgets, so revocation
retires the live frame. Chromium regressions count requests to allowed and
blocked origins in both hosts.

## Decisions, cancellation, and revocation

Once permits one captured operation. Session permits the same scopes in one live
source generation; persistent permits the same verified principal and artifact.
Equivalent queued requests share a session decision but cannot share a once grant.
Denials can also be remembered for a session or persistently. Domain availability
and ACL restrictions remain hard ceilings.

`runtime.permissions.grants` exposes immutable decisions for host settings.
`revoke(id)` and `clear()` remove local authority immediately and cancel affected
work. Revoking a persistent grant retires only live sources with its exact
verified principal and artifact; other applications remain admitted. `clear()`
invalidates all sources. A false return means durable removal failed: show the
failure, keep access disabled, and use `retryPersistence()`. Reloading the store cannot restore those
grants during the current runtime. After a restart, failed durable removal cannot
be guaranteed; the host must communicate that failure rather than claim success.
Malformed or unsupported stored data disables authorization until explicitly
cleared; legacy broad allows are not migrated. Diagnostics contain no payloads.

Services receive `authorizeOperation` through `onRegistered`. Capture payloads
before calling it. The action callback receives a structural abort signal and must
check it before side effects following any asynchronous host work. This callback
starts only after current source, ACL, policy, and rate checks. A completed side
effect cannot be undone by later cancellation.

`onPermissionRevoked` distinguishes revocation of a live source from destruction.
Implementations should retire ongoing operations while retaining replay history
and sending protocol-required terminal denials. During migration, services without
this hook receive `onWindowDestroyed` cleanup instead. LINK implements the live
source path; replacement/destruction drops results bound to the old source.

LINK retains up to 4,096 unique request IDs per source lifecycle and rejects
further IDs until retirement. Repeated IDs never reopen a link. Unknown LINK
actions are silent and never trigger approval. Non-successful authorization for a
live request returns `link.open.result` with the original ID and `status: denied`.

## Registered extensions

Only exact `messageCapabilities` entries are eligible. Explicit source domain
exposure, ACL restrictions, shared interface approval, and independent temporal
budgets all apply. Requests are detached, deeply frozen JSON, bounded to 8,192
values, 32 nesting levels, and one MiB of string/key characters. Accessors,
serialization hooks, cycles, nonfinite numbers, sparse arrays, and non-JSON values
cannot reach prompting or handlers. A source retains at most 4,096 `(type, id)`
pairs; a repeated pair cannot execute again in that lifecycle. Messages without
IDs retain their declared fire-and-forget behavior.

An extension can supply `onPermissionDenied(windowId, message, reason, send)` to
project an unsuccessful authorization onto its own response contract. Runtime
never invents extension error envelopes; omission is silent. Only exact declared
requests can reach that projection, and replies remain bound to the source and
service registration. Services owning resource or network actions must request
those additional scopes using `authorizeOperation` before the actual action.

Arbitrary host extensions have no owning NAP specification. Their error schemas
and operation validation are explicitly host-owned; the shared admission boundary
adds no canonical NAP messages. A published NAP implementation must independently
honor its owning document.

## Compatibility and authority

The host-only opener path is temporarily retained with bounded diagnostic
`FW-LINK-LEGACY-001`; see [the compatibility register](/compatibility).
Applications must migrate their source identity and approval adapters together.
Retiring this path and migrating all hosts remain required before this milestone
can be declared complete.

Checked authority: NAP-LINK draft PR 53 at
`50a2cd45e76f06e87b87e93842badf4c61f17bde`, NAP-RESOURCE draft PR 80 at
`ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`, and NAP-SHELL/web at
`19de5ce1cea40cd4c76089cdd8126e9f87648049`. LINK validation, response correlation,
and source isolation follow those contracts. Resource identity informs the shared
principal model. NAP-CONNECT draft PR 19 at
`ec81a3a4a1fc4da1ad2601215353b7f822e44b8f` supplies network permission
intent; Kehto's directive-specific development CSP is a bounded host policy
because that draft defines no `connect.*` wire operation. See the planning
research matrix for the remaining refs and spec gaps.


### Cancelling one approved operation

Services may pass a request-owned signal as the fifth argument to
`ServiceRuntimeContext.authorizeOperation(windowId, operation, requirements,
execute, signal)`. Aborting it settles that request as `cancelled`, dismisses its
prompt through the prompt signal, and aborts the signal passed to `execute`.
Sibling requests keep their own lifetimes. Late approval answers cannot create
grants; late action results are discarded. The service must still observe the
execution signal before each later side effect and apply its protocol's
cancellation response rules.

A cancelled queued request settles immediately, but later equivalent requests
still wait behind the active prompt. Retained queue entries count toward the
queue bound until their predecessor settles. Request listeners are removed when
the operation settles. An already-aborted signal never opens a prompt or invokes
the action.

Registered extensions revalidate their exact capability declaration after approval
and before sending deferred replies. Replacing, removing, or changing that
declaration invalidates the captured operation; a late answer grants nothing.


### Scoped resource authorization

When attached to a runtime configured with `permissions`, the resource service
checks each original URL against a resource grant and, for HTTP(S), a separate
origin grant. Interface permission remains required. Bulk requests authorize each
item independently. The authorization covers fetching and reading the response
body, so revocation can abort active work and discard late bytes. Request
cancellation also dismisses a pending approval without granting a late answer.

Resolvers must call `init.authorizeNetwork(destination, execute)` before every
actual HTTP(S) contact. That callback runs under a distinct origin requirement,
including each proxy-reported redirect hop, and its signal covers connection and
body reading. Paja's local proxy adds DNS-time address screening and pinned
connections; see [Paja resource proxy policy](https://github.com/kehto/web/blob/main/docs/policies/RESOURCE-PROXY.md).

The shared launch admission and closed CSP prevent an approved mediated-resource
frame from making unrestricted iframe subresource or direct network requests.
Hosts that bypass `admitBrowserDocument` do not receive that guarantee.

The supported Paja resolver keeps its transport capability in the trusted
main-frame adapter. It verifies the destination before DNS or a connection,
applies exact origin/host/method/content-type policy without permissive CORS,
pins connection policy, and asks the runtime again for each redirect destination.
Sandboxed apps receive neither that resolver nor a proxy controller through
configuration, iframe messages, initialization data, or `window.napplet`.

The playground uses the same resource-service callback contract. It requires
`authorizeNetwork` before its initial HTTP(S) fetch and deliberately rejects
redirect responses because it has no trusted per-hop resolver. This bounded host
policy does not replace Paja's resolver. Playground's verified loader separately
passes through the shared launch admission transaction.

Standalone or unmigrated hosts retain resolver-owned policy with diagnostic
`FW-RESOURCE-LEGACY-001`, once per service instance on actual fetch use. Configure
`RuntimeAdapter.permissions` and trusted session `permissionPrincipal` to use
shared grants. No old origin list is imported into Firewall permission grants.
