---
phase: 80-firewall-pure-core-kehto-firewall
plan: "02"
subsystem: firewall
tags: [defaults, config, immutable-mutations, serialize, deserialize, tdd, rate-limit, burst-guard]
dependency_graph:
  requires:
    - "@kehto/firewall package scaffold (80-01)"
    - "packages/firewall/src/types.ts (80-01)"
  provides:
    - "packages/firewall/src/defaults.ts — built-in conservative limits, DEFAULT_EXCEED_ACTION='flag', DEFAULT_BURST_ACTION='block', defaultConfig(), createState()"
    - "packages/firewall/src/config.ts — immutable setPolicy/setRateLimit/setGlobalRate/addMatcher, serialize, defensive deserialize"
    - "packages/firewall/src/defaults.test.ts — 17 green tests (CORE-04, BURST-02 default, FOCUS-02 invariant)"
    - "packages/firewall/src/config.test.ts — 27 green tests (CORE-03, RATE-03 config, T-80-01 tamper mitigation)"
  affects:
    - packages/firewall/src/defaults.ts (created)
    - packages/firewall/src/config.ts (created)
    - packages/firewall/src/defaults.test.ts (created)
    - packages/firewall/src/config.test.ts (created)
tech_stack:
  added: []
  patterns:
    - "UPPER_SNAKE_CASE constants with JSDoc rationale (mirrors @kehto/acl/capabilities.ts)"
    - "Immutable spread-return mutations — every mutation returns a new config (mirrors @kehto/acl/mutations.ts grant)"
    - "Private getNapplet() helper for default-on-absent napplet lookup (mirrors acl getEntry)"
    - "Defensive deserialize — try/parse, shape-validate every field, rebuild, fall back to defaultConfig() on any failure (T-80-01)"
    - "TDD RED/GREEN/REFACTOR — separate test commit before implementation commit"
key_files:
  created:
    - packages/firewall/src/defaults.ts
    - packages/firewall/src/defaults.test.ts
    - packages/firewall/src/config.ts
    - packages/firewall/src/config.test.ts
  modified: []
decisions:
  - "setGlobalRate is a separate exported function (not an overload of setRateLimit) — clearer API, mirrors acl's distinct setQuota"
  - "deserialize rebuilds NappletRules via spread rather than direct cast — required for TypeScript strict mode (NappletRules has no index signature)"
  - "isValidNappletRules validates rateLimits entries individually — any malformed entry causes full fallback to defaultConfig()"
metrics:
  duration: "~10 minutes"
  completed_date: "2026-06-15"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 0
---

# Phase 80 Plan 02: Defaults and Config Layer Summary

**One-liner:** Conservative built-in defaults (`flag` exceed-action, `block` burst-default, `0.25` unfocused multiplier) and immutable pure config mutations with lossless serialize and defensive defaultConfig()-fallback deserialize — completing the firewall's config/state foundation.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 (RED) | defaults.test.ts failing tests | 8e4a3ad | packages/firewall/src/defaults.test.ts |
| 1 (GREEN) | defaults.ts implementation | 7da8d74 | packages/firewall/src/defaults.ts |
| 2 (RED) | config.test.ts failing tests | a327477 | packages/firewall/src/config.test.ts |
| 2 (GREEN) | config.ts implementation | 0f27c69 | packages/firewall/src/config.ts |

## What Was Built

### defaults.ts — Built-in Conservative Limits

Exports 7 named UPPER_SNAKE constants (each with JSDoc rationale) and 2 factory functions:

- `DEFAULT_EXCEED_ACTION = 'flag'` — conservative allow+audit default for rate limits (CORE-04)
- `DEFAULT_BURST_ACTION = 'block'` — documented exception for the init-burst guard (BURST-02)
- `DEFAULT_UNFOCUSED_MULTIPLIER = 0.25` — tightens unfocused napplet budget without zeroing it (FOCUS-02; strictly > 0)
- `DEFAULT_RATE_CAPACITY = 60` — ops per window (60 ops/minute = 1 op/sec sustained)
- `DEFAULT_RATE_WINDOW_MS = 60_000` — 1-minute rolling window
- `DEFAULT_BURST_WINDOW_MS = 3_000` — 3-second init window
- `DEFAULT_BURST_MAX_OPS = 20` — max ops during init window before blocking
- `defaultConfig()` — assembles a fresh FirewallConfig from the scalar constants above
- `createState()` — returns `{ buckets: {}, bursts: {} }` (empty ephemeral counter state)

### config.ts — Immutable Mutations + Serialization

Exports 6 public functions, all with JSDoc + `@param`/`@returns`/`@example`:

- `setPolicy(config, napplet, policy)` — immutable policy override for a dTag
- `setRateLimit(config, napplet, opClass, limit)` — per-op token-bucket limit
- `setGlobalRate(config, napplet, limit)` — per-napplet fallback budget (RATE-03)
- `addMatcher(config, matcher)` — appends content matcher (first-match wins ordering)
- `serialize(config)` — plain `JSON.stringify` (mirrors acl)
- `deserialize(json)` — defensive: try/parse → shape-validate all fields → rebuild → fallback to `defaultConfig()` (T-80-01)

Private `getNapplet()` helper returns existing `NappletRules` or a fresh `{ rateLimits: {} }` default-on-absent (mirrors acl's `getEntry`).

### Test Coverage

- **defaults.test.ts**: 17 tests — all 7 constants (types + values), `defaultConfig()` shape (action assertions, empty maps, fresh reference), `createState()` (empty maps, fresh reference)
- **config.test.ts**: 27 tests — immutability for all 4 mutations, round-trip losslessness for a config carrying policy + op-class rate limit + global rate + kind-5 matcher, `deserialize('not-json')` fallback, empty string fallback, structurally-invalid JSON fallback, wrong field types fallback, invalid action value fallback, never-throws assertions

## Verification Results

- `pnpm --filter @kehto/firewall type-check` exits 0: PASS
- `npx vitest run packages/firewall/src/defaults.test.ts packages/firewall/src/config.test.ts` exits 0 (44/44 tests): PASS
- `config.ts deserialize` contains `defaultConfig()` fallback: PASS (confirmed via grep)
- `grep -nE "import type" config.ts` shows type-only imports with `.js` extensions: PASS
- TDD gate compliance — RED commit (test) before GREEN commit (feat) for both tasks: PASS

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript strict mode rejected `as Record<string, unknown>` cast on NappletRules**
- **Found during:** Task 2 type-check after implementing deserialize
- **Issue:** `NappletRules` interface has no index signature, so TypeScript strict mode rejected the cast used to set optional fields (`policy`, `globalRate`) on the rebuilt entry object.
- **Fix:** Changed the cast from `(entry as Record<string, unknown>)['policy'] = ...` to using conditional spreads (`{ ...entry, policy: raw.policy }`) and a typed intermediate `raw` variable cast via `as unknown as { ... }`.
- **Files modified:** `packages/firewall/src/config.ts` (deserialize function only)
- **Commit:** Included in `0f27c69` (fixed before commit)

## Known Stubs

None. This plan defines pure logic only; no UI rendering, no data source wiring, no placeholder text.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or trust boundaries introduced.

The T-80-01 threat (Tampering — persisted config string) is actively mitigated by `deserialize()`: try/catch JSON.parse, shape-validate every top-level and nested field, rebuild a validated config from scratch, and fall through to `defaultConfig()` on any failure. Never throws. Verified by 7 dedicated test cases.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| Task 1 RED (test) | 8e4a3ad | PASS |
| Task 1 GREEN (feat) | 7da8d74 | PASS |
| Task 2 RED (test) | a327477 | PASS |
| Task 2 GREEN (feat) | 0f27c69 | PASS |

## Self-Check: PASSED

- `packages/firewall/src/defaults.ts` exists: FOUND
- `packages/firewall/src/defaults.test.ts` exists: FOUND
- `packages/firewall/src/config.ts` exists: FOUND
- `packages/firewall/src/config.test.ts` exists: FOUND
- Commit 8e4a3ad exists: FOUND
- Commit 7da8d74 exists: FOUND
- Commit a327477 exists: FOUND
- Commit 0f27c69 exists: FOUND
