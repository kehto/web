# @kehto/rate-limit

Optional host-installed temporal protection. The package has no runtime dependencies.
Neither runtime nor Firewall constructs a limiter implicitly.

## Install

```sh
pnpm add @kehto/rate-limit
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/rate-limit/package.json`, `packages/rate-limit/src/index.ts` |
| Version | `0.2.0` |
| Runtime entry | `./dist/index.js` |
| Legacy entry | `./dist/legacy/index.js` |
| Side effects | `false` |

## Opt in

```ts
import { createRateLimiter, defaultRateLimitConfig, defaultPromptRateLimitConfig } from '@kehto/rate-limit';

const operations = createRateLimiter(defaultRateLimitConfig());
const prompts = createRateLimiter(defaultPromptRateLimitConfig());
const permissions = {
  ...approvalAdapter,
  rateLimiter: operations,
  promptRateLimiter: prompts,
};
// Pass permissions to createRuntime({ ...hostAdapter, permissions }) or ShellAdapter.
operations.setConfig({ ...operations.config, unfocusedMultiplier: 0.5 });
```

Operation and prompt limiters are independent opt-ins. Omit either field to leave
that traffic unthrottled. Approval, ACL, identity, source lifetime, cancellation,
and domain-specific safety bounds still apply. Paja explicitly installs both.
`permissions.onRateLimit` receives payload-free excess diagnostics.

`createRateLimiter(config)` validates and snapshots the configuration; `setConfig`
keeps existing counters. The suggested operation configuration allows 60/minute,
flags sustained excess, and blocks beyond 20 startup operations in three seconds.
The suggested prompt configuration blocks beyond 12/minute or eight startup prompts.
These suggestions apply only when the host passes them to a constructed limiter.

## Pure evaluator

`evaluateRateLimit(config, state, observation)` returns a decision and next state.
`createRateLimitState` creates empty counters. Observations carry a trusted subject,
operation, lifecycle, focus and injected clock. `retireRateLimitLifecycle` clears
only that lifecycle's startup counters; per-subject operation tokens survive frame
replacement. Runtime invokes `retire` on supplied limiters when retiring a source.
Standalone users own retirement. Clock rollback cannot mint refills.

## Legacy migration

The previous behavioral Firewall exports moved to `@kehto/rate-limit/legacy`:
`evaluate`, `defaultConfig`, `createState`, the config setters and their types.
`createFirewallState(persistence?)` also moved here from runtime. Its name is
retained only on this explicit compatibility subpath. It delegates temporal math
to the same evaluator as the main entry point; it is not a scoped approval engine.

```ts
import { createFirewallState } from '@kehto/rate-limit/legacy';
const legacyFirewall = createFirewallState(optionalConfigStorage);
const runtime = createRuntime({ ...hostAdapter, legacyFirewall });
legacyFirewall.setRateLimit('chat', 'relay:write', { capacity: 10, windowMs: 1000, action: 'block' });
legacyFirewall.persist();
```

Legacy hosts without `permissions` can explicitly supply this adapter. Its policy
and content matchers remain available, but `allow` no longer bypasses the installed
rate/burst budgets. Using it emits `FW-RUNTIME-LEGACY-GATE-001` once per runtime.
With scoped `permissions`, the legacy adapter is ignored and warns once; install
`permissions.rateLimiter` instead. See the central compatibility register.

## Scope Boundaries

Counters and configuration belong to the installed instance. This package cannot
grant NAP access or infer identity. It does not own pending-request bounds,
resource quotas, network authorization or concurrency controls.

## API Reference

<a href="../api/modules/_kehto_rate-limit.html" target="_self">Generated API reference</a>.
