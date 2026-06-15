# @kehto/firewall

Pure, WASM-ready behavioral firewall engine for the napplet protocol — zero
dependencies, zero side effects. Every function is pure: config + state +
observation in, decision + next state out.

> **Alpha status:** Kehto is an early runtime implementation for a draft NIP-5D
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
| Version | `0.2.0` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `^0.5.0` |

## Primary APIs

| Area | Exports |
|------|---------|
| Decision engine | `evaluate`, `toKey` |
| Defaults + factories | `defaultConfig`, `createState`, `DEFAULT_EXCEED_ACTION`, `DEFAULT_BURST_ACTION`, `DEFAULT_UNFOCUSED_MULTIPLIER`, `DEFAULT_RATE_CAPACITY`, `DEFAULT_RATE_WINDOW_MS`, `DEFAULT_BURST_WINDOW_MS`, `DEFAULT_BURST_MAX_OPS` |
| Config mutations | `setPolicy`, `setRateLimit`, `setGlobalRate`, `addMatcher`, `serialize`, `deserialize` |
| Types | `Observation`, `FirewallConfig`, `NappletRules`, `RateLimit`, `BurstGuard`, `ContentMatcher`, `NappletPolicy`, `FirewallState`, `Bucket`, `BurstCounter`, `Decision`, `Action`, `EvaluateResult` |

## Scope Boundaries

- Behavioral abuse detection only: the firewall asks *"is this napplet abusing an operation over time?"*, the temporal complement to `@kehto/acl`'s static *"is this napplet allowed?"*.
- `evaluate(config, state, observation)` is pure — no I/O, no timers, no globals; the current time is injected via `observation.now` and never read from a wall clock.
- Implements token-bucket rate limiting per `(napplet dTag, opClass)` pair, an init-burst guard, declarative content matchers, a focus multiplier, and rule precedence (per-napplet policy → op-class rule → global fallback → built-in defaults).
- Consumes a normalized `Observation`, never a raw protocol envelope; building observations from envelopes is the host runtime's concern.
- Does not perform persistence itself — `serialize`/`deserialize` provide a JSON round-trip the host owns.

## API Reference

- Generated module: <a href="../api/modules/_kehto_firewall.html" target="_self"><code>docs/api/modules/_kehto_firewall.html</code></a>
