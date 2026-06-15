# @kehto/firewall

Pure, WASM-ready behavioral firewall engine for the napplet protocol — zero dependencies, zero side effects.

> **Alpha status:** Kehto is an early runtime implementation for a draft NIP-5D
> protocol. The firewall engine API is not yet final; treat this package
> as current implementation guidance, not as a stable protocol guarantee.

## Install

```bash
pnpm add @kehto/firewall
```

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
