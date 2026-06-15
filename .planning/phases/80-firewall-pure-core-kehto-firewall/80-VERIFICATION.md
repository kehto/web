---
phase: 80-firewall-pure-core-kehto-firewall
verified: 2026-06-15T15:35:00Z
status: passed
score: 15/15 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: initial verification
---

# Phase 80: Firewall Pure Core (`@kehto/firewall`) Verification Report

**Phase Goal:** Deliver the new pure, zero-dep, WASM-ready package `packages/firewall/` (`@kehto/firewall`) mirroring `@kehto/acl`: normalized `Observation`, pure `evaluate()` (token-bucket rate limiting, init-burst guard, content matchers, focus multiplier, A1 rule precedence), pure config mutations + serialize/deserialize, built-in defaults, full pure-core tests. No runtime wiring (Phase 81).

**Verified:** 2026-06-15T15:35:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths / Requirements Coverage

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| CORE-01 | Pure `evaluate(config, state, observation)` returns `decision` (pass/reject/prompt) + `action` + `ruleId` + `reason` + `newState`, no I/O/mutation/wall-clock | ✓ VERIFIED | `evaluate.ts:134-321`; `EvaluateResult` type `types.ts:220-226`; all 5 fields returned on every branch; original `state`/`config` only spread (never mutated). |
| CORE-02 | Pure core operates only on normalized `Observation`, never parses envelopes | ✓ VERIFIED | `Observation` `types.ts:31-40` matches spec exactly; grep found ZERO envelope-parsing code in src (only JSDoc deferring to Phase 81). |
| CORE-03 | Config mutated via pure functions (setPolicy/setRateLimit/addMatcher) returning new config; serialize/deserialize round-trip lossless | ✓ VERIFIED | `config.ts` `setPolicy:59`, `setRateLimit:93`, `setGlobalRate:133`, `addMatcher:165` all immutable spread-return; `serialize:188`/`deserialize:292`; round-trip tests `config.test.ts:139,145`. |
| CORE-04 | Built-in conservative defaults for every napplet; default exceed-action `flag` | ✓ VERIFIED | `defaults.ts` `defaultConfig:142`; `DEFAULT_EXCEED_ACTION='flag':26`; cap 60 / 60s window; test `defaults.test.ts:15,56`. |
| RATE-01 | Exceeding per-op rate budget triggers configured exceed-action (flag/block/ignore) | ✓ VERIFIED | `evaluate.ts:306-320` applies `rateLimit.action`; tests `evaluate.test.ts:117,137,154` cover flag→pass, block→reject, ignore→pass. |
| RATE-02 | Token bucket keyed `(napplet dTag, opClass)`, O(1) state, time-based refill from injected `now` | ✓ VERIFIED | `toKey:47` = `${napplet}:${opClass}`; refill `evaluate.ts:283-290` uses `now - lastRefill`, no clock read; refill tests `evaluate.test.ts:177,203`. |
| RATE-03 | Per-napplet global rate budget as fallback for op-classes lacking a specific rule | ✓ VERIFIED | `evaluate.ts:263-266` falls back to `nappletRules.globalRate` (ruleId `rate:global`); test `evaluate.test.ts:274,298`. |
| BURST-01 | Napplet emitting > configured ops in init window caught by burst guard | ✓ VERIFIED | `evaluate.ts:182-208`; count advances when `initElapsedMs < windowMs`, trips at `> maxOps`; test `evaluate.test.ts:335`. |
| BURST-02 | Init-burst guard defaults to `block` | ✓ VERIFIED | `DEFAULT_BURST_ACTION='block'` `defaults.ts:41`; `defaultConfig` `burstGuard.action` block; test `defaults.test.ts:19,61`. |
| CONTENT-01 | Matchers on opClass, kind(s), and/or size, each with own action | ✓ VERIFIED | `ContentMatcher` `types.ts:116-124`; matcher engine `evaluate.ts:214-248` checks opClass/kinds/minSize; AND-combination test `evaluate.test.ts:490-499`. |
| CONTENT-02 | Matchers additionally condition on focus (`focused`, `maxMsSinceFocusGain`) | ✓ VERIFIED | `evaluate.ts:231-237` checks `focused` + `maxMsSinceFocusGain`; fields in matcher type. |
| CONTENT-03 | Delete-spam (kind 5) detectable + actionable via matcher | ✓ VERIFIED | `kinds:[5]` matcher fires; test `evaluate.test.ts:397` (matcher:delete-spam) + round-trip `config.test.ts:145`. |
| POLICY-03 | First-match-wins precedence: policy → op-class → global → defaults (A1) | ✓ VERIFIED | Implemented tiers `evaluate.ts:142-320`; precedence LOCKED by tests `evaluate.test.ts:546-614` (deny>burst>matcher>rate, allow bypass, ask prompt, burst>matcher, matcher>rate). |
| FOCUS-02 | Unfocused budget tightened by `unfocusedMultiplier`; focus alone never hard-blocks | ✓ VERIFIED | `evaluate.ts:270-272` scales capacity by `unfocusedMultiplier` (>0, never 0); single unfocused op still passes — test `evaluate.test.ts:621,626`; multiplier `0.25` `defaults.ts:60`. |
| VERIFY-01 | Pure-core tests cover refill, burst, matcher (incl focus), precedence, serialize, injected `now` | ✓ VERIFIED | 87 firewall tests (43 evaluate + 27 config + 17 defaults), all green; injected `now` used throughout (no `Date.now`). |

**Score:** 15/15 requirements verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/firewall/src/types.ts` | Observation + all firewall types | ✓ VERIFIED | 227 lines, all readonly/immutable, full JSDoc. |
| `packages/firewall/src/evaluate.ts` | Pure decision engine | ✓ VERIFIED | 323 lines, pure, no wall-clock, all 6 tiers. |
| `packages/firewall/src/config.ts` | Mutations + serialize/deserialize | ✓ VERIFIED | 366 lines, immutable mutations + defensive deserialize fallback. |
| `packages/firewall/src/defaults.ts` | Built-in defaults + factories | ✓ VERIFIED | 179 lines, `defaultConfig`/`createState` + named constants. |
| `packages/firewall/src/index.ts` | Barrel export | ✓ VERIFIED | All types + functions + constants re-exported. |
| `*.test.ts` (3 files) | Co-located pure-core tests | ✓ VERIFIED | evaluate/config/defaults test files, 87 tests. |
| `package.json` / `tsconfig.json` / `tsup.config.ts` | Mirror acl build config | ✓ VERIFIED | `@kehto/firewall` zero deps, scripts mirror acl (`test:unit`, not `test`). |

### Purity & Scope-Leak Verification (Level 3/4 wiring)

| Check | Result | Status |
|-------|--------|--------|
| `Date.now`/`performance.now`/`new Date`/`Math.random`/`setTimeout` in src | NONE found | ✓ PURE |
| `evaluate()` uses `observation.now` only | Confirmed `evaluate.ts:139,189,283,287,295,308` | ✓ VERIFIED |
| No `firewall-state.ts` (Phase 81) | Absent | ✓ NO LEAK |
| No RuntimeAdapter/firewallPersistence/onFirewallEvent/getFocusContext/choke-point | Only JSDoc deferrals to Phase 81 | ✓ NO LEAK |
| No envelope parsing in src | Only JSDoc mentions deferring to Phase 81 | ✓ NO LEAK |
| Bucket key version-agnostic (dTag-only, no hash) | `toKey` = `${napplet}:${opClass}` | ✓ VERIFIED |
| A2 multiplier never zeroes budget | `>0` enforced + test | ✓ VERIFIED |

### Behavioral Spot-Checks / Command Outputs

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Package type-checks | `pnpm --filter @kehto/firewall type-check` | `tsc --noEmit` clean, exit 0 | ✓ PASS |
| Firewall unit tests | `npx vitest run packages/firewall` (repo root) | 3 files / 87 tests passed | ✓ PASS |
| Whole-repo suite | `pnpm test:unit` | 55 files / 819 tests passed (2.37s) | ✓ PASS |

**Note on `pnpm --filter @kehto/firewall test`:** This script does not exist. The package mirrors `@kehto/acl` exactly, which exposes only `test:unit` (vitest is run from the repo root with the shared `vitest.config.ts`). Running `test:unit` scoped to the package alone yields "No test files found" because vitest's `include` glob (`packages/*/src/**`) resolves relative to the package cwd — identical behavior to acl. Firewall tests DO run and pass as part of the whole-repo `pnpm test:unit` and via `npx vitest run packages/firewall` from root. This is a convention match, not a gap.

### Anti-Patterns Found

| File | Pattern | Severity | Result |
|------|---------|----------|--------|
| src/*.ts | TBD/FIXME/XXX/HACK/PLACEHOLDER/TODO | — | NONE found (clean) |

### Human Verification Required

None. Phase 80 is a pure, headless TypeScript library with no UI, no runtime wiring, and no external service integration. All behavior is deterministically verifiable via type-check and the 87 unit tests, all of which were executed and passed.

### Gaps Summary

No gaps. All 15 phase-80 requirements are delivered in substantive, wired, and tested code:
- `evaluate.ts` is provably pure (no wall-clock, no mutation; `observation.now` is the only time source).
- Token bucket keyed by `(dTag, opClass)`; A1 precedence (policy → burst → matcher → op-class → global → default) is implemented and locked by dedicated precedence tests; A2 `unfocusedMultiplier` scales capacity and a single unfocused op still passes (never hard-blocks).
- Content matchers handle kind (incl. kind 5 delete-spam), size, and focus conditions.
- Defaults: exceed-action `flag`, init-burst `block`, multiplier `0.25` — asserted by tests.
- Config: immutable mutations + serialize round-trip + defensive deserialize fallback to `defaultConfig()` on poisoned input.
- No Phase 81 scope leaked (no `firewall-state.ts`, no runtime adapter hooks, no envelope parsing).

---

_Verified: 2026-06-15T15:35:00Z_
_Verifier: Claude (gsd-verifier)_
