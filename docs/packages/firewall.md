# @kehto/firewall

Pure permission policy and retained behavioral controls for the napplet protocol — zero
dependencies, zero side effects. Every function is pure: config + state +
observation in, decision + next state out.

> **Alpha status:** Kehto is an early runtime toolkit for a draft NIP-5D
> protocol. The firewall engine API is not yet final; treat this package as
> current implementation guidance, not as a stable protocol guarantee.

## Install

```bash
pnpm add @kehto/firewall
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/firewall/package.json`, `packages/firewall/src/index.ts` |
| Version | `0.6.1` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.32.0 <0.33.0` |

## Primary APIs

| Area | Exports |
|------|---------|
| Decision engine | `evaluate`, `toKey` |
| Defaults + factories | `defaultConfig`, `createState`, `DEFAULT_EXCEED_ACTION`, `DEFAULT_BURST_ACTION`, `DEFAULT_UNFOCUSED_MULTIPLIER`, `DEFAULT_RATE_CAPACITY`, `DEFAULT_RATE_WINDOW_MS`, `DEFAULT_BURST_WINDOW_MS`, `DEFAULT_BURST_MAX_OPS` |
| Config mutations | `setPolicy`, `setRateLimit`, `setGlobalRate`, `addMatcher`, `serialize`, `deserialize` |
| Types | `Observation`, `FirewallConfig`, `NappletRules`, `RateLimit`, `BurstGuard`, `ContentMatcher`, `NappletPolicy`, `FirewallState`, `Bucket`, `BurstCounter`, `Decision`, `Action`, `EvaluateResult` |

## Scope Boundaries

- The retained behavioral API asks *"is this napplet abusing an operation over time?"*, the temporal complement to `@kehto/acl`'s static *"is this napplet allowed?"*.
- `evaluate(config, state, observation)` is pure — no I/O, no timers, no globals; the current time is injected via `observation.now` and never read from a wall clock.
- Implements token-bucket rate limiting per `(napplet dTag, opClass)` pair, an init-burst guard, declarative content matchers, a focus multiplier, and rule precedence (per-napplet policy → op-class rule → global fallback → built-in defaults).
- Consumes a normalized `Observation`, never a raw protocol envelope; building observations from envelopes is the host runtime's concern.
- Does not perform persistence itself — `serialize`/`deserialize` provide a JSON round-trip the host owns.

## API Reference

- Generated module: <a href="../api/modules/_kehto_firewall.html" target="_self"><code>docs/api/modules/_kehto_firewall.html</code></a>

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
approval UI, request cancellation, protocol responses and rate controls belong to
host/runtime integration. Extension categories must be explicitly registered via
`PermissionPolicyOptions.extensions` and use exact scope keys.

This policy API is an intermediate migration surface. Existing behavioral APIs
remain until runtime and app consumers migrate; their documented old behavior
must not be interpreted as the new approval policy. The independent temporal
module is exported by `@kehto/runtime` as `evaluateRateLimit`.
