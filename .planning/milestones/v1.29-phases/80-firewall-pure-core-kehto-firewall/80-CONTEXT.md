# Phase 80: Firewall Pure Core (`@kehto/firewall`) - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning
**Source:** Approved design brief (brainstorming session, 2026-06-15)

<domain>
## Phase Boundary

This phase delivers ONLY the new pure package `packages/firewall/` → `@kehto/firewall`. It is a pure, zero-dependency, WASM-ready TypeScript module that mirrors `@kehto/acl` in structure and conventions. It contains NO runtime wiring, NO stateful container, NO persistence, and NO protocol-envelope parsing — those belong to Phase 81 (`firewall-state.ts` + `runtime.ts` integration).

The package is the behavioral-firewall decision engine: given a normalized `Observation`, the current immutable config, and the current counter state, a pure `evaluate()` function returns a decision plus the next counter state. The engine answers *"is this napplet abusing an operation over time?"* — the temporal complement to the ACL's static *"is this napplet allowed to do this at all?"*.

In scope: `Observation` type + all firewall types, `evaluate()` (token-bucket rate limiting, init-burst guard, content matchers, focus multiplier, rule precedence), pure config mutations + serialize/deserialize, built-in defaults, and full pure-core unit tests.

Out of scope (Phase 81): the `firewall-state` container, the `RuntimeAdapter` hooks (`firewallPersistence`, `onFirewallEvent`, `getFocusContext`), the post-ACL choke-point wiring, the allow/deny/ask → consent mapping, and runtime integration tests.
</domain>

<decisions>
## Implementation Decisions (LOCKED — user-approved)

### Package shape (mirror `@kehto/acl`)
- New workspace package `packages/firewall/` published as `@kehto/firewall`.
- Pure TypeScript, **zero runtime deps**, ESM-only, tsup build, mirrors `packages/acl/` exactly (build config, package.json shape, tsconfig, exports, JSDoc-on-every-public-export convention).
- NOT real WASM — pure TS structured so a future WASM swap is trivial (the `evaluate()` core sees only normalized scalars/small structs, never strings-from-envelopes).
- Files (mirror acl's file split):
  - `src/types.ts` — `Observation`, `FirewallConfig`, rule types (`RateLimit`, `BurstGuard`, `ContentMatcher`, per-napplet policy), `FirewallState` (counter state), `Decision`/`Action` unions, constants.
  - `src/evaluate.ts` — the pure `evaluate(config, state, observation)` function.
  - `src/config.ts` — pure config mutations (`setPolicy`, `setRateLimit`, `addMatcher`) returning new config + `serialize`/`deserialize`.
  - `src/defaults.ts` — built-in default limits.
  - `src/index.ts` — barrel export.
  - `*.test.ts` co-located per source file (mirror acl's `check.test.ts`, `mutations.test.ts`, etc.).

### Normalized Observation (the clean boundary — CORE-02)
The pure core NEVER parses protocol envelopes. It operates only on:
```ts
interface Observation {
  napplet: string;            // dTag — version-agnostic identity key ("any version")
  opClass: string;            // 'relay:write' | 'outbox:publish' | 'intent:invoke' | ...
  kind?: number;              // nostr event kind for publish-style ops (5 = delete)
  size?: number;              // payload byte size
  initElapsedMs?: number;     // ms since this napplet window inited (burst guard)
  focused: boolean;           // is this napplet the focused window right now
  msSinceFocusGain?: number;  // ms since it last gained focus
  now: number;                // injected timestamp — keeps evaluate() pure & deterministic
}
```
Time is an INPUT (`observation.now`); `evaluate()` must never read a wall clock, mutate, or do I/O.

### evaluate() contract (CORE-01)
`evaluate(config, state, observation)` returns `{ decision: 'pass' | 'reject' | 'prompt', action, ruleId, reason, newState }`:
- `pass` → caller dispatches (action may be `flag` → caller emits an audit event but still dispatches).
- `reject` → caller drops + errors back (`block` or `deny`).
- `prompt` → caller rejects current message + fires consent (`ask`).
- `action` ∈ `flag | block | ignore` (the matched rule's exceed-action); plus the policy posture can be `ask`.
- `newState` is the next immutable counter state (token buckets advanced/spent). Original state never mutated.

### Rule model & precedence (POLICY-03 — first match wins, most→least specific)
1. Per-napplet policy — `allow | deny | ask` — hard override for that dTag.
2. Per-napplet × op-class rule — rate limit / burst / content matcher.
3. Per-napplet global fallback — one rate budget across all ops (RATE-03).
4. Global defaults — `defaults.ts` (CORE-04).

### Rate limiting (RATE-01..03)
- Token bucket per `(napplet dTag, opClass)`: state `{ tokens, lastRefill }`, O(1), refill computed from `observation.now - lastRefill`.
- Exceeding the budget triggers the rule's exceed-action: `flag` (pass + audit) / `block` (reject) / `ignore` (pass silently).
- Per-napplet global budget is the fallback for op-classes lacking a specific rule.

### Init-burst guard (BURST-01..02)
- Counts ops within the init window (`initElapsedMs` below a threshold); more than N ops in that window trips the guard.
- Defaults to `block`.

### Content matchers (CONTENT-01..03)
Declarative, extensible:
```ts
interface ContentMatcher {
  id: string;
  opClass?: string;            // restrict to an op class
  kinds?: number[];            // match if event kind ∈ set ([5] = delete-spam)
  minSize?: number;            // match if payload size ≥ N
  focused?: boolean;           // match on focus state
  maxMsSinceFocusGain?: number;// match if focus was gained within window
  action: Action;              // flag | block | ignore (or ask posture)
}
```
Delete-spam (kind 5) must be expressible and actionable (CONTENT-03). New attack classes become new matcher entries or one new `Observation` field — never an engine rewrite.

### Focus multiplier (FOCUS-02)
- A configurable `unfocusedMultiplier` (e.g. `0.25`) tightens an unfocused napplet's rate budget. Focus alone NEVER hard-blocks — it only scales the budget. `focused`/`msSinceFocusGain` are also usable as matcher conditions (above).

### Defaults (CORE-04)
- Built-in conservative rate/burst limits apply to every napplet out of the box.
- Default exceed-action is `flag` (allow + audit; nothing breaks).
- EXCEPTION: the init-burst guard default is `block`.

### Config mutation + serialization (CORE-03)
- Pure functions return new config (immutable, like acl's `grant`/`revoke`/`block`).
- `serialize(config) → string` and `deserialize(string) → config` round-trip without loss (mirror acl's `serialize`/`deserialize`).

### Tests (VERIFY-01)
Pure-core unit tests with injected `now`, covering: token-bucket refill, burst windows, matcher matching (including focus conditions), rule precedence, and serialize round-trip. Mirror acl's test style (vitest, co-located `*.test.ts`).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference package to mirror (structure, conventions, build)
- `packages/acl/src/types.ts` — immutable type + bitfield-constant conventions, `Readonly<>` usage, JSDoc style.
- `packages/acl/src/check.ts` — pure decision-function style (`toKey`, pure `check`, decision-logic JSDoc).
- `packages/acl/src/mutations.ts` — pure immutable mutation pattern (`grant`/`revoke`/`block` return new state).
- `packages/acl/src/resolve.ts` and `packages/acl/src/migrate.ts` — serialize/deserialize + state-shape patterns.
- `packages/acl/src/index.ts` — barrel/export shape.
- `packages/acl/package.json`, `packages/acl/tsconfig.json`, `packages/acl/tsup.config.ts` (or equivalent build config) — replicate for the new package.
- `packages/acl/src/check.test.ts`, `packages/acl/src/mutations.test.ts` — test style/structure.

### Monorepo wiring
- Root `package.json`, `pnpm-workspace.yaml`, `turbo.json` — how packages are registered for build/type-check/test.
- `.changeset/` — changeset convention (a changeset for `@kehto/firewall` is added in Phase 82, but the package must be changeset-eligible).

### Requirements
- `.planning/REQUIREMENTS.md` — the 15 phase-80 requirement IDs and their exact wording.
</canonical_refs>

<specifics>
## Specific Ideas

- The opClass strings should align with existing ACL capability strings where they overlap (`relay:write`, `outbox:publish`/`outbox:write`, `intent:invoke`/`intent:write`) so Phase 81's envelope→opClass extraction maps cleanly. Phase 80 treats opClass as an opaque string key; it does not need the canonical capability list, but choosing consistent example values keeps Phase 81 simple.
- Keep `evaluate()` allocation-light on the hot path (advance one bucket, return). Determinism via injected `now` is mandatory for testability and for the WASM-ready boundary.
- Counter state (`FirewallState`) is a plain serializable structure, but Phase 80 does NOT persist it — it just defines the shape and the pure transition. Persistence/ephemerality is Phase 81's concern.
</specifics>

<deferred>
## Deferred Ideas

- Runtime container (`firewall-state.ts`), `RuntimeAdapter` hooks, choke-point wiring, allow/deny/ask consent mapping, shell-sourced focus → **Phase 81**.
- Changeset + full unit/E2E green with firewall integrated → **Phase 82**.
- Real WASM port, ACL-denied-traffic observation, cross-napplet anomaly detection, management UI → future milestones (FWX-/FWUI- in REQUIREMENTS.md).
</deferred>

---

*Phase: 80-firewall-pure-core-kehto-firewall*
*Context gathered: 2026-06-15 from approved design brief*
