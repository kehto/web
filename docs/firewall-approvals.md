# Scoped Firewall approvals

This migration is in progress. Shared approval coordination currently governs
the reference LINK service when a host supplies `RuntimeAdapter.permissions`
(or `ShellAdapter.permissions`). Other domains and Paja/playground admission
have not yet migrated. Existing Firewall configuration is not converted into
resource, network, or interface grants.

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
  prompt: async ({ request, missing, signal }) => {
    // Render trusted identity + exact scopes; never treat app labels as authority.
    // The UI must close on signal.abort and return an explicit lifetime.
    return showApproval({ request, missing, signal });
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
