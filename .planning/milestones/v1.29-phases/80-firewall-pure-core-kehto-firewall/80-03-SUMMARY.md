---
phase: 80-firewall-pure-core-kehto-firewall
plan: "03"
subsystem: firewall
tags: [evaluate, token-bucket, rate-limit, burst-guard, content-matcher, focus-multiplier, precedence, barrel, build, tdd, pure-core]
dependency_graph:
  requires:
    - "@kehto/firewall package scaffold (80-01)"
    - "packages/firewall/src/types.ts (80-01)"
    - "packages/firewall/src/defaults.ts + config.ts (80-02)"
  provides:
    - "packages/firewall/src/evaluate.ts — pure evaluate() engine with token-bucket rate, init-burst guard, content matchers, focus multiplier, A1 precedence"
    - "packages/firewall/src/index.ts — barrel re-export of complete public API"
    - "packages/firewall/src/evaluate.test.ts — 43 green tests covering CORE-01/02, RATE-01/02/03, BURST-01/02, CONTENT-01/02/03, POLICY-03, FOCUS-02, VERIFY-01"
    - "@kehto/firewall dist/index.js + dist/index.d.ts (tsup build)"
  affects:
    - packages/firewall/src/evaluate.ts (created)
    - packages/firewall/src/index.ts (created)
    - packages/firewall/src/evaluate.test.ts (created)
tech_stack:
  added: []
  patterns:
    - "Token-bucket rate limiter: lazy lastRefill init (starts full), Math.max(0, elapsed) clock-skew clamp, fractional tokens, O(1) fixed state"
    - "First-match-wins early-return cascade (mirrors acl check.ts) for precedence tiers"
    - "A2 unfocused multiplier scales effective capacity + derived refill rate proportionally"
    - "TDD RED/GREEN — test commit before feat commit"
    - "Immutable spread-return newState (never mutates input state or config)"
key_files:
  created:
    - packages/firewall/src/evaluate.ts
    - packages/firewall/src/index.ts
    - packages/firewall/src/evaluate.test.ts
  modified: []
decisions:
  - "Within-budget ops return ruleId encoding the resolution tier (rate:opclass | rate:global | rate:default) not a generic 'rate:ok' — ruleId is the audit trail"
  - "Date.now absent from source entirely (not just executable code) to satisfy strict grep-based purity assertion"
  - "Policy short-circuits return state unchanged (no counter advancement for allow/deny/ask)"
  - "Matcher verdicts skip the token bucket (matchers are content-policy, not rate-policy)"
metrics:
  duration: "~12 minutes"
  completed_date: "2026-06-15"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 0
---

# Phase 80 Plan 03: Pure Evaluate Engine and Barrel Summary

**One-liner:** Pure `evaluate()` decision engine with lazy-init token-bucket rate limiting, init-burst flood guard, AND-semantics content matchers (incl. kind-5 delete spam), capacity-scaling unfocus multiplier, and first-match-wins A1 precedence — plus a barrel `index.ts` completing the buildable `@kehto/firewall` package.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 (RED) | evaluate.test.ts failing tests | 7269527 | packages/firewall/src/evaluate.test.ts |
| 1 (GREEN) | evaluate.ts pure decision engine | 30ec3cd | packages/firewall/src/evaluate.ts |
| 2 | index.ts barrel + build verification | 5e50f66 | packages/firewall/src/index.ts |

## What Was Built

### evaluate.ts — Pure Decision Engine

Exports `toKey(napplet, opClass): string` and `evaluate(config, state, observation): EvaluateResult`.

**`toKey`:** `${napplet}:${opClass}` — deliberately dTag-only (no hash segment). Diverges from `@kehto/acl` intentionally: rate budgets are shared across all napplet versions (version-agnostic).

**`evaluate` precedence cascade (A1 — POLICY-03, first-match-wins):**

1. **Per-napplet policy** — `allow` → pass (no counters advanced); `deny` → reject; `ask` → prompt. Policy returns with `newState = state` (original unchanged).
2. **Init-burst guard** — when `initElapsedMs < burstGuard.windowMs`, the `BurstCounter` keyed by napplet is advanced. If `count > maxOps`, the burst action fires (default `block`). The advanced burst counter is returned in `newState`.
3. **Content matchers** — evaluated in order; first matching matcher fires (AND semantics: all declared conditions must hold). Does not spend the token bucket.
4. **Per-napplet × op-class rate limit** — `rateLimits[opClass]`, ruleId `rate:opclass`.
5. **Per-napplet global rate fallback** — `globalRate`, ruleId `rate:global`.
6. **Global default rate** — `defaultRate`, ruleId `rate:default`.

**Token-bucket math (RESEARCH Pattern 2):**
- `lastRefill = existing?.lastRefill ?? now` — lazy init, fresh bucket starts full at now.
- `elapsed = Math.max(0, now - lastRefill)` — clock-skew clamp (T-80-03 mitigation).
- `tokens = Math.min(effectiveCapacity, existingTokens + elapsed * refillRatePerMs)` — cap and fractional.
- Spend gate: `tokens >= 1` → spend, pass. Below → fire exceed-action.

**A2 unfocused multiplier (FOCUS-02):**
- `effectiveCapacity = focused ? capacity : capacity * unfocusedMultiplier`
- Refill rate derived from effective capacity: `refillRatePerMs = effectiveCapacity / windowMs`
- Bucket KEY stays stable (`napplet:opClass`, no focus suffix).
- Because `unfocusedMultiplier > 0`, focus alone **never hard-blocks**.

**Action → Decision mapping:** `flag → pass`, `ignore → pass`, `block → reject`, `ask → prompt` (policy only).

### evaluate.test.ts — 43 Green Tests

Coverage (all with injected `now`, fixtures via `defaultConfig()` / `createState()`):

- `toKey`: key shape, dTag-only divergence from acl
- Return shape contract (CORE-01): decision/action/ruleId/reason/newState fields present
- **No-mutation invariant**: deep-compare original state and config before/after evaluate
- **Fresh napplet first op passes** (RATE-02 + Pitfall 2): lazy bucket init starts full
- **Exceed-action mapping**: flag→pass, block→reject, ignore→pass (RATE-01)
- **Refill after full window**: emptied bucket refills and passes again (RATE-02)
- **Fractional refill**: partial window keeps `<1` tokens, rejects until `>=1` accrues
- **Clock-skew clamp** (T-80-03): backward `now` does not subtract tokens
- **globalRate fallback**: unlisted opClass falls back to per-napplet globalRate, ruleId contains 'global' (RATE-03)
- **defaultRate fallback**: no napplet rules falls back to global default, ruleId contains 'default' (CORE-04)
- **Op-class rate wins over globalRate** (precedence within tier 4-6)
- **Init-burst guard**: no trip when `initElapsedMs` absent or `>=windowMs`; trips at `>maxOps`, default block (BURST-01/02)
- **Content matchers**: opClass, kind:5 delete-spam, minSize, focused:false, maxMsSinceFocusGain, AND semantics, first-match-wins, action→decision mapping (CONTENT-01/02/03)
- **Precedence (A1)**: policy > burst > matcher > rate; proven by step-wise removal of each tier (POLICY-03)
- **Focus multiplier (A2)**: single unfocused op passes; 2nd at same now exceeds when `capacity * 0.25 < 2`; stable bucket key (FOCUS-02)
- **Policy short-circuits**: allow and deny return empty buckets/bursts (no counter modification)

### index.ts — Barrel

`@packageDocumentation` JSDoc with a runnable `@example` showing `evaluate` + `defaultConfig` + `createState`. Grouped exports:
- `export type { Observation, FirewallConfig, NappletRules, RateLimit, BurstGuard, ContentMatcher, NappletPolicy, FirewallState, Bucket, BurstCounter, Decision, Action, EvaluateResult }` from `./types.js`
- `export { evaluate, toKey }` from `./evaluate.js`
- `export { setPolicy, setRateLimit, setGlobalRate, addMatcher, serialize, deserialize }` from `./config.js`
- `export { defaultConfig, createState, DEFAULT_EXCEED_ACTION, DEFAULT_BURST_ACTION, DEFAULT_UNFOCUSED_MULTIPLIER, DEFAULT_RATE_CAPACITY, DEFAULT_RATE_WINDOW_MS, DEFAULT_BURST_WINDOW_MS, DEFAULT_BURST_MAX_OPS }` from `./defaults.js`

## Verification Results

- `pnpm --filter @kehto/firewall type-check` exits 0: PASS
- `pnpm --filter @kehto/firewall build` (tsup) emits `dist/index.js` (10.08 KB) + `dist/index.d.ts` (24.36 KB): PASS
- `npx vitest run ...evaluate.test.ts ...config.test.ts ...defaults.test.ts`: 87/87 tests (3 files): PASS
- `grep -q "observation.now" evaluate.ts`: PASS
- `grep "Date.now" evaluate.ts` finds nothing: PASS (no wall-clock reads in source)
- `pnpm test:unit` (root): **819/819 tests green** — 0 regressions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] toKey test had wrong split-length assertion**
- **Found during:** Task 1 GREEN phase (first vitest run)
- **Issue:** Test `'is dTag-only — does NOT include a hash segment'` asserted `key.split(':').length === 2` but `relay:write` itself has a colon, so `chat:relay:write` correctly splits into 3 parts. The intent of the test was to verify no extra hash segment is appended (acl's `dTag:hash`), not to assert total segment count.
- **Fix:** Changed the test to assert `key === 'my-napplet:outbox:publish'` and `key.startsWith('my-napplet:')` — exact equality is more precise than segment counting.
- **Files modified:** `packages/firewall/src/evaluate.test.ts`
- **Commit:** Amended in 30ec3cd (fixed before final GREEN commit)

**2. [Rule 1 - Bug] ruleId 'rate:ok' did not expose the resolution tier**
- **Found during:** Task 1 GREEN phase (first vitest run)
- **Issue:** Within-budget ops returned `ruleId: 'rate:ok'` regardless of which tier resolved the rate. Tests asserting `.toContain('global')` and `.toContain('default')` failed.
- **Fix:** Changed within-budget success to use `ruleId = rateLimitRuleId` (the resolved tier: `rate:opclass | rate:global | rate:default`). This is correct behavior — ruleId is the audit trail.
- **Files modified:** `packages/firewall/src/evaluate.ts`
- **Commit:** Part of 30ec3cd

**3. [Rule 1 - Bug] JSDoc comments contained 'Date.now' strings that tripped the purity grep**
- **Found during:** Post-implementation purity assertion (`! grep -q "Date.now" src/evaluate.ts`)
- **Issue:** The plan's purity assertion uses a source-level grep. JSDoc `@example` contained `now: Date.now()` and the module-header comment contained `no Date.now()` — both tripped `grep`.
- **Fix:** Rewrote the JSDoc to say "no wall-clock reads" and changed the `@example` `now:` line to `// caller supplies time; evaluate() never reads a clock`.
- **Files modified:** `packages/firewall/src/evaluate.ts`
- **Commit:** Part of 30ec3cd

## Known Stubs

None. `evaluate.ts` is a complete, working pure function — no hardcoded returns, no TODO placeholders, no mock data.

## Threat Flags

None found. The new files are pure functions with no network endpoints, auth paths, file access, or trust boundaries.

T-80-03 (Tampering / DoS — token-bucket refill) is actively mitigated: `elapsed = Math.max(0, now - lastRefill)` prevents out-of-order `now` from over-refilling or draining tokens; `tokens = Math.min(effectiveCapacity, ...)` prevents long-idle over-fill. Proven by the `clock skew clamp` test group.

T-80-05 (DoS — init-burst flood) is mitigated by the burst guard tier defaulting to `block`. Proven by the `init-burst guard` test group.

T-80-06 (DoS — kind-5 delete spam) is mitigated: a `ContentMatcher` with `kinds: [5]` is expressible and actionable. Proven by the `fires a matcher on kind:5` test.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| Task 1 RED (test) | 7269527 | PASS |
| Task 1 GREEN (feat) | 30ec3cd | PASS |

Task 2 was not TDD-tagged (index.ts + build — not a behavior-adding task).

## Self-Check: PASSED

- `packages/firewall/src/evaluate.ts` exists: FOUND
- `packages/firewall/src/evaluate.test.ts` exists: FOUND
- `packages/firewall/src/index.ts` exists: FOUND
- `dist/index.js` emitted by build: FOUND
- `dist/index.d.ts` emitted by build: FOUND
- Commit 7269527 (RED) exists: FOUND
- Commit 30ec3cd (GREEN) exists: FOUND
- Commit 5e50f66 (barrel) exists: FOUND
- 43/43 evaluate tests green: PASS
- 87/87 firewall package tests green: PASS
- 819/819 root unit tests green: PASS
