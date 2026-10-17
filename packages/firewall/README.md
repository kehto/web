# @kehto/firewall

Pure permission policy and retained behavioral controls for the napplet protocol — zero dependencies, zero side effects.

> **Alpha status:** Kehto is an early runtime toolkit for a draft NIP-5D
> protocol. The firewall engine API is not yet final; treat this package
> as current implementation guidance, not as a stable protocol guarantee.

## Install

```bash
pnpm add @kehto/firewall
```

## Published Napplet Compatibility

The published peer compatibility floor is `@napplet/core`
`>=0.32.0 <0.33.0`, admitting the current core 0.32.0 / nap 0.32.0 convention contract line.

## Overview

`@kehto/firewall` is Kehto's behavioral abuse-detection engine. It is the temporal complement to `@kehto/acl`: where ACL asks *"is this napplet statically allowed to perform this operation?"*, the firewall asks *"is this napplet abusing an operation over time?"*.

Every function is pure: config + state + observation in, decision + next state out. No I/O, no timers, no globals — the module is trivially compilable to WASM and is the single source of truth for behavioral-firewall decisions.

The core `evaluate(config, state, observation)` function implements:

- **Token-bucket rate limiting** per `(napplet dTag, opClass)` pair with O(1) lazy refill.
- **Init-burst guard** — catches a napplet flooding ops immediately after initialization.
- **Content matchers** — declarative rules matching op class, event kind, payload size, or focus state.
- **Focus multiplier** — tightens rate budgets for unfocused napplets without hard-blocking.
- **Rule precedence** — per-napplet policy override → op-class rule → global fallback → built-in defaults.

## Quick Start

```ts
import {
  evaluate,
  defaultConfig,
  createState,
} from '@kehto/firewall';

const config = defaultConfig();
let state = createState();

const obs = {
  napplet: 'chat',
  opClass: 'relay:write',
  focused: true,
  now: Date.now(),
};

const result = evaluate(config, state, obs);
// result.decision: 'pass' | 'reject' | 'prompt'
// result.newState: updated counter state (original unchanged)

state = result.newState;
```

## Public API

### Types
- `Observation` — normalized engine input (never a raw protocol envelope)
- `FirewallConfig` — immutable configuration container (rules + defaults)
- `FirewallState` — immutable counter state (token buckets + burst counters)
- `EvaluateResult` — `{ decision, action, ruleId, reason, newState }`
- `Decision` — `'pass' | 'reject' | 'prompt'`
- `Action` — `'flag' | 'block' | 'ignore'`
- `NappletPolicy` — `'allow' | 'deny' | 'ask'`
- `RateLimit`, `BurstGuard`, `ContentMatcher`, `NappletRules`
- `Bucket`, `BurstCounter`

### Constants
- `DEFAULT_RATE_LIMIT`, `DEFAULT_BURST_GUARD`
- `DEFAULT_EXCEED_ACTION`, `DEFAULT_BURST_ACTION`
- `DEFAULT_UNFOCUSED_MULTIPLIER`

### Core function
- `evaluate` — pure decision function (config + state + observation → result)
- `toKey` — derive the `napplet:opClass` bucket key

### Config mutations
- `defaultConfig` — built-in conservative config
- `createState` — empty counter state
- `setPolicy`, `setRateLimit`, `addMatcher` — immutable config mutations
- `serialize`, `deserialize` — JSON round-trip for persistence

## License

MIT

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
