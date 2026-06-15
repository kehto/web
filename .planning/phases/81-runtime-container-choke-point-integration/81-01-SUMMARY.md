---
phase: 81-runtime-container-choke-point-integration
plan: "01"
subsystem: runtime
tags: [firewall, state-container, types, persistence, workspace-dep]
dependency_graph:
  requires: [80-03-SUMMARY.md]
  provides: [firewall-state.ts, FirewallStateContainer, FirewallPersistence, FirewallEvent]
  affects: [packages/runtime/src/types.ts, packages/runtime/src/index.ts]
tech_stack:
  added: ["@kehto/firewall (workspace:*)"]
  patterns: [stateful-container-mirror, optional-persistence-hook, let-bound-pure-wrap]
key_files:
  created:
    - packages/runtime/src/firewall-state.ts
    - packages/runtime/src/firewall-state.test.ts
  modified:
    - packages/runtime/package.json
    - packages/runtime/src/types.ts
    - packages/runtime/src/index.ts
    - pnpm-lock.yaml
decisions:
  - firewallPersistence is OPTIONAL (diverges from aclPersistence which is required) — keeps 4 construction sites green with zero edits
  - counters = result.newState assigned on every evaluate() call — CRITICAL for flood escalation
  - persist() serializes config only (never counters) — RUNTIME-03 requirement
  - load() restores config, explicitly skips counters (documented in code comment)
  - ConsentRequest.event relaxed from required to optional — firewall-policy variant has no Nostr event; PUBLIC API CHANGE (flag for Phase 82 changeset)
metrics:
  duration_seconds: 290
  completed_date: "2026-06-15"
  tasks_completed: 4
  tasks_total: 4
  files_created: 2
  files_modified: 4
  tests_added: 9
  tests_baseline: 123
  tests_final: 132
---

# Phase 81 Plan 01: Firewall Dependency + Types + Container Summary

**One-liner:** `@kehto/firewall` workspace dep installed, `FirewallPersistence`/`FirewallEvent`/3 optional `RuntimeAdapter` hooks defined, `createFirewallState` container mirrors `acl-state.ts` with config-only persistence and ephemeral counters.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add @kehto/firewall workspace dependency | 60da7ea | packages/runtime/package.json, pnpm-lock.yaml |
| 2 | Define firewall types + ConsentRequest variant | 38a8f61 | packages/runtime/src/types.ts |
| 3 | Build firewall-state.ts container + unit tests | c758c3b | packages/runtime/src/firewall-state.ts, packages/runtime/src/firewall-state.test.ts |
| 4 | Barrel-export new public surface from index.ts | c77c955 | packages/runtime/src/index.ts |

## Verification Results

- `npx vitest run packages/runtime/src/firewall-state.test.ts`: 9/9 PASS
- `npx vitest run packages/runtime`: 132/132 PASS (no regressions; baseline was 123 + 9 new)
- `npx tsc -p packages/runtime/tsconfig.json --noEmit`: zero NEW errors (1 pre-existing error in acl-state.ts re: missing intent:read/intent:write bits — predates this plan, deferred to scope boundary)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written with one deviation in test design:

**1. [Rule 1 - Test Correction] Counter-advance test checks `action` not `decision`**
- **Found during:** Task 3 (first test run)
- **Issue:** Original test checked `decision !== 'pass'` but the default exceed action is `'flag'` which still produces `decision: 'pass'`. Decision is only non-pass when action is 'block' or 'prompt'.
- **Fix:** Changed assertion to check `action === 'flag' || action === 'block'` — this correctly proves counters are advancing (flag action appears only when bucket drains).
- **Files modified:** packages/runtime/src/firewall-state.test.ts

## Public API Changes (Phase 82 Changeset Note — A3)

**ConsentRequest interface — BREAKING if callers depend on `event` being required:**
- `event: NostrEvent` was changed to `event?: NostrEvent`
- Added `type?: '... | firewall-policy'` variant to the union
- Added `napplet?: string` optional field for firewall-policy dTag

This is the only edit to an existing public interface in this plan. Phase 82 changeset must capture this as a semver-minor change for `@kehto/runtime`. Callers that currently access `request.event!.kind` without an undefined check should be audited.

## Deferred Items

- Pre-existing `acl-state.ts` type error (missing `intent:read`/`intent:write` in CAP_MAP) — out of scope, logged to deferred-items.

## Known Stubs

None — container is fully wired. `firewallPersistence` being optional is by design (safe default, not a stub).

## Threat Surface Scan

No new network endpoints or auth paths introduced. `deserialize()` from `@kehto/firewall` is defensive (never throws, falls back to `defaultConfig()` — T-81-01 mitigated per firewall package design). Load path wraps in try/catch per T-81-01 additional defense. No new trust boundary surface beyond what the plan's threat model documented.

## Self-Check

- [x] packages/runtime/src/firewall-state.ts exists
- [x] packages/runtime/src/firewall-state.test.ts exists
- [x] packages/runtime/src/types.ts modified with FirewallPersistence, FirewallEvent, 3 hooks, ConsentRequest extension
- [x] packages/runtime/src/index.ts modified with firewall barrel exports
- [x] packages/runtime/package.json has @kehto/firewall workspace:*
- [x] commits 60da7ea, 38a8f61, c758c3b, c77c955 exist
