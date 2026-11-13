# @kehto/firewall

Pure scoped approval and access policy. No temporal counters or rate enforcement.

## Install

```sh
pnpm add @kehto/firewall
```

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.32.0 <0.42.0` |

## Approval policy

The pure approval API evaluates NAP interface access, resource scopes, network
origins, and explicitly registered extension categories. `evaluatePermissions`
automatically requires interface access for every requested domain. A resource or
network grant cannot supply interface access, and interface access cannot supply
resource or network authority. Matching explicit denials take precedence.

A verified principal uses the catalog ID from a signature-verified manifest plus
its verified artifact hash. Named/root IDs include the publisher; snapshot IDs use
the signed event ID. Shape validation does not verify signatures: the host must
supply these facts from its resolver. Development targets use a separate principal
kind and can receive only session or once grants.

```ts
import {
  createPermissionState,
  evaluatePermissions,
  putPermissionGrant,
} from '@kehto/firewall';

const permission = {
  category: 'interface' as const,
  domain: 'link',
  operation: 'access',
  scope: { kind: 'exact' as const, value: 'link' },
};
const principal = {
  kind: 'verified' as const,
  manifestKey: verifiedManifest.catalogId,
  artifactHash: verifiedManifest.artifactHash,
};
let state = createPermissionState();
state = putPermissionGrant(state, {
  id: 'host-generated-grant-id', principal, permission,
  effect: 'allow', lifetime: 'persistent',
});
const decision = evaluatePermissions(state, {
  principal, sessionId: 'endpoint-generation-1', requestId: 'host-request-1',
  requirements: [permission],
});
// decision.decision is 'allow'; link destination authority is a separate requirement.
```

Scopes are exact by default. Network origins normalize scheme/host/default ports
and reject credentials, wildcards and path/query/fragment constraints. Virtual
directory grants match path segment boundaries; paths with traversal, backslashes,
percent encoding or empty segments are rejected. This does not replace NAP-FS
mount/symlink checks or per-entry authorization for recursive operations. Exact
resource strings preserve their bytes and do not alter NAP-RESOURCE cache keys.
Hosts must use opaque keys for secret-bearing resources rather than persist or
show secrets in permission descriptions.

A session grant matches one endpoint generation. A once grant additionally matches
a host-generated request token. `consumePermissionGrants` rechecks all requirements
and consumes the one-use grants only on allow; the runtime must store its returned
state atomically before executing the operation. Reusing a wire request ID must
never reuse a host authorization token. `revokePermissionGrant` removes policy;
the runtime remains responsible for cancelling affected pending and live work.

`serializePermissions` writes only persistent grants. `deserializePermissions`
validates the version and every grant and reports an explicit failure for malformed,
duplicate, ephemeral or unknown-category records. It never converts the old
Firewall's broad allow policy into new authority. Storage I/O, failure reporting,
approval UI, request cancellation, protocol responses belong to
host/runtime integration. Extension categories must be explicitly registered via
`PermissionPolicyOptions.extensions` and use exact scope keys.

## Default rules

`PermissionRules` describe what a host does with a request no stored decision
covers: one default action (`allow`, `ask` or `deny`) plus exceptions per
interface or per operation, each overridable per napplet.
`createPermissionRules()` with no argument asks for everything.
`resolvePermissionRule(rules, principal, requirement)` returns the most specific
match, `setPermissionRule` returns changed rules, and
`serializePermissionRules` / `deserializePermissionRules` store them; a damaged
document is refused whole rather than partly applied. Rules never create
authority themselves: the runtime turns an `allow` into a session grant through
`PermissionAdapter.defaultDecision`. See [Scoped Firewall approvals](https://github.com/kehto/web/blob/main/docs/firewall-approvals.md#default-rules).

## Scope Boundaries

Approval grants cannot bypass a host-installed limiter. Runtime does not install
one automatically. Temporal controls and the previous behavioral API live in
`@kehto/rate-limit` and its explicit `/legacy` migration entry point.

## API Reference

See [package documentation](../../docs/packages/firewall.md).
