# Scoped Firewall approvals

This migration is in progress. Hosts supplying `RuntimeAdapter.permissions`
(or `ShellAdapter.permissions`) can use pre-execution interface admission.
Built-in interface dispatch requires its admission grant; LINK and declared
service extensions also support held operation approvals. Resource/network scope
enforcement in other services and Paja/playground admission/UI have not yet
migrated. Existing Firewall configuration is not converted into scoped grants.

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
override enforcement.

`promptRateLimit` separately bounds actual UI prompts. The default blocks beyond
12 prompts per minute, with four permitted during the first three seconds of a
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
Unused available domains are not automatically granted; `shell` is optional under
the checked NAP-SHELL authority. Admission accepts session/persistent positive
choices, never once; development sources can choose only session. The prompt's
immutable `allowLifetimes` tells the UI which positive choices apply. Deny-once
remains available. Startup grants do not grant resources or network destinations.

An admission result is an immutable host token bound to the exact source generation.
Copies and forged results fail revalidation. Revocation, retirement, teardown, or
ACL blocking invalidate its use. This API is implemented and tested; migrating the
Paja/playground frame loaders to call it remains outstanding.

## Decisions, cancellation, and revocation

Once permits one captured operation. Session permits the same scopes in one live
source generation; persistent permits the same verified principal and artifact.
Equivalent queued requests share a session decision but cannot share a once grant.
Denials can also be remembered for a session or persistently. Domain availability
and ACL restrictions remain hard ceilings.

`runtime.permissions.grants` exposes immutable decisions for host settings.
`revoke(id)` and `clear()` remove local authority immediately and cancel affected
work. A false return means durable removal failed: show the failure, keep access
disabled, and use `retryPersistence()`. Reloading the store cannot restore those
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
principal model; this checkpoint does not claim migration of resource enforcement
or direct-network policy. See the planning research matrix for the remaining refs
and documented CONNECT specification gap.


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
