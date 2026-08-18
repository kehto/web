---
phase: 80-firewall-pure-core-kehto-firewall
plan: "01"
subsystem: firewall
tags: [scaffold, types, package-setup, monorepo-wiring]
dependency_graph:
  requires: []
  provides:
    - "@kehto/firewall workspace package (linked, buildable, changeset-eligible)"
    - "Complete pure-core type surface (Observation, FirewallConfig, FirewallState, EvaluateResult, all rule types)"
    - "@kehto/firewall vitest alias registered"
  affects:
    - vitest.config.ts (alias added)
    - pnpm-lock.yaml (workspace link)
tech_stack:
  added:
    - "@kehto/firewall 0.1.0 (new zero-dep pure-core package)"
  patterns:
    - "Immutable interface pattern (readonly members, Readonly<Record<>> for maps) — mirrors @kehto/acl"
    - "JSDoc on every public export (per CLAUDE.md + acl convention)"
    - "Leaf module — types.ts has zero imports"
key_files:
  created:
    - packages/firewall/package.json
    - packages/firewall/tsconfig.json
    - packages/firewall/tsup.config.ts
    - packages/firewall/README.md
    - packages/firewall/src/types.ts
  modified:
    - vitest.config.ts
    - pnpm-lock.yaml
decisions:
  - "BurstGuard is a first-class field (not a ContentMatcher) — per RESEARCH Open Question 2 resolution"
  - "NappletRules uses rateLimits: Readonly<Record<string, RateLimit>> (op-class keyed) + optional globalRate fallback (RATE-03)"
  - "ContentMatcher.kinds uses readonly number[] (not number[]) for full immutability"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-06-15"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 2
---

# Phase 80 Plan 01: Package Scaffold and Type Surface Summary

**One-liner:** Zero-dep `@kehto/firewall` workspace package scaffolded with complete immutable type surface — `Observation` boundary, token-bucket/burst/matcher rule types, `FirewallConfig`/`FirewallState` containers, `EvaluateResult` contract — all mirroring `@kehto/acl` conventions.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Scaffold @kehto/firewall package skeleton and register vitest alias | 4d23bd2 | package.json, tsconfig.json, tsup.config.ts, README.md, vitest.config.ts |
| 2 | Define the complete pure-core type surface in src/types.ts | 3261b99 | packages/firewall/src/types.ts |

## What Was Built

### Task 1 — Package Skeleton
- `packages/firewall/package.json`: `@kehto/firewall` v0.1.0, ESM-only, zero runtime deps, no `./capabilities` subpath export, `peerDependencies: { "@napplet/core": "^0.5.0" }` for mirror-symmetry (never imported), `test:unit` script with vitest.
- `packages/firewall/tsconfig.json`: Verbatim copy of `@kehto/acl/tsconfig.json` (extends root, outDir dist, rootDir src, ES2022).
- `packages/firewall/tsup.config.ts`: Single entry `src/index.ts`, ESM-only, dts + sourcemap + clean.
- `packages/firewall/README.md`: Alpha banner, install, one-paragraph overview, quick start, public API listing.
- `vitest.config.ts`: Added `'@kehto/firewall': resolve(__dirname, 'packages/firewall/src/index.ts')` alias (alphabetically between `@kehto/acl` and `@kehto/runtime`).
- `pnpm install` run at repo root to link the workspace package.

### Task 2 — Type Surface
`packages/firewall/src/types.ts` exports 13 types (all with JSDoc, all readonly members, zero imports):

- `Observation` — locked CORE-02 boundary (8 fields: napplet, opClass, kind?, size?, initElapsedMs?, focused, msSinceFocusGain?, now).
- `Action` — `'flag' | 'block' | 'ignore'` literal union.
- `Decision` — `'pass' | 'reject' | 'prompt'` literal union.
- `NappletPolicy` — `'allow' | 'deny' | 'ask'` literal union.
- `RateLimit` — token-bucket budget with exceed-action.
- `BurstGuard` — init-window op cap (first-class field, not a ContentMatcher).
- `ContentMatcher` — locked CONTEXT.md shape with `readonly number[]` kinds.
- `NappletRules` — per-napplet config (policy? + rateLimits map + globalRate?).
- `FirewallConfig` — immutable container mirroring `AclState` shape.
- `Bucket` — O(1) token-bucket counter (tokens + lastRefill).
- `BurstCounter` — init-burst op counter (count + windowStart).
- `FirewallState` — ephemeral counters (buckets + bursts, both `Readonly<Record<>>`).
- `EvaluateResult` — evaluate() return contract (decision + action + ruleId + reason + newState).

## Verification Results

- `pnpm -r list` shows `@kehto/firewall@0.1.0` linked: PASS
- `pnpm --filter @kehto/firewall type-check` exits 0: PASS
- `vitest.config.ts` contains `@kehto/firewall` alias: PASS
- `pnpm-workspace.yaml` and `turbo.json` unchanged: PASS
- All 13 types exported from types.ts: PASS
- Observation has exactly the 8 locked fields: PASS
- Every export has a JSDoc block: PASS

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. This plan defines types only; no data source wiring or runtime behavior is present.

## Threat Flags

None found. This plan only adds type declarations; no new network endpoints, auth paths, file access patterns, or trust boundaries are introduced. The `FirewallConfig` shape design (all fields discrete and shape-checkable, no `any`/`unknown`) satisfies T-80-02 by making Plan 02's `deserialize` validation straightforward.

## Self-Check: PASSED

- `packages/firewall/package.json` exists: FOUND
- `packages/firewall/tsconfig.json` exists: FOUND
- `packages/firewall/tsup.config.ts` exists: FOUND
- `packages/firewall/README.md` exists: FOUND
- `packages/firewall/src/types.ts` exists: FOUND
- `vitest.config.ts` has `@kehto/firewall` alias: FOUND
- Commit 4d23bd2 exists: FOUND
- Commit 3261b99 exists: FOUND
