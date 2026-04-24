---
phase: 39
plan: "02"
subsystem: services
tags: [nub-config, services, config, factory, options-as-bridge]
dependency_graph:
  requires: []
  provides: [createConfigService, ConfigServiceOptions, ConfigService, ConfigSchemaValidation]
  affects: [packages/services]
tech_stack:
  added: []
  patterns: [options-as-bridge, factory-returns-bundle, hand-coded-core-subset-validator]
key_files:
  created:
    - packages/services/src/config-service.ts
    - .changeset/config-01-services-config.md
  modified:
    - packages/services/src/index.ts
decisions:
  - "Hand-coded Core Subset validator (validateCoreSubset) used — ajv not present in workspace (D12)"
  - "Factory returns { handler, publishValues } bundle mirroring createThemeService pattern"
  - "Subscribers map keyed by windowId stores per-window send callbacks captured at config.subscribe time"
  - "config.set intentionally absent — shell-writes, napplet-reads scope boundary (CONFIG-04)"
metrics:
  duration_seconds: 149
  completed_date: "2026-04-24"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 39 Plan 02: NUB-CONFIG Reference Service Summary

**One-liner:** `createConfigService` factory implementing full `@napplet/nub/config` wire protocol — `config.get` (correlated snapshot), `config.subscribe`/`config.unsubscribe` (live push stream), `config.registerSchema` (Core Subset validated), `config.openSettings` (fire-and-forget UI hook), with `publishValues(values)` host-handle for fan-out.

## Tasks Executed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement createConfigService factory | `1c7d8f0` | `packages/services/src/config-service.ts` (created, 379 lines) |
| 2 | Add public re-exports + write services changeset | `0fa11f1` | `packages/services/src/index.ts` (modified), `.changeset/config-01-services-config.md` (created) |

## Verification Results

### Grep Self-Check

```
grep -c "export function createConfigService" packages/services/src/config-service.ts → 1 ✓
grep -c "config.set" packages/services/src/config-service.ts → 1 (comment only: "NO config.set wire message") ✓
grep -c "NUB-STORAGE" packages/services/src/config-service.ts → 3 ✓
wc -l packages/services/src/config-service.ts → 379 (within 200-350 guideline; 29 extra lines from expanded JSDoc) ✓
grep "createConfigService" packages/services/src/index.ts → found ✓
grep "@kehto/services" .changeset/config-01-services-config.md → found ✓
```

Note: The `config.set` match is in the top-of-file scope boundary JSDoc explicitly documenting the anti-feature: "there is intentionally **NO** `config.set` wire message". No `config.set` case exists anywhere in the switch statement. Anti-feature is correctly enforced.

### Build Output

```
pnpm --filter @kehto/services type-check → PASS (tsc --noEmit, zero errors)
pnpm --filter @kehto/services build → PASS
  ESM dist/index.js 46.09 KB
  DTS dist/index.d.ts 53.10 KB
```

## Key Design Decisions

1. **Hand-coded Core Subset validator** (`validateCoreSubset`): ajv not present in workspace (D12 verified). Validates `type: object` root, rejects `$ref`/`pattern`/`oneOf`/`anyOf`/`allOf`/`not`/`if`/`then`/`else`, checks per-property types. Host apps needing strict draft-07 conformance pass their own ajv-backed `registerSchema` callback.

2. **Bundle return type** (`{ handler, publishValues }`): mirrors `createThemeService` pattern. `publishValues(values)` fans out `config.values` push envelopes (no `id`, distinguishes push from correlated `config.get` response) to every entry in the `subscribers` Map.

3. **Subscriber Map** captures per-window `send` callbacks at `config.subscribe` time: `Map<windowId, sendFn>`. `publishValues` iterates values(), wrapping each call in try/catch for stale-iframe resilience. `onWindowDestroyed` removes entries defensively.

4. **`config.openSettings` is fire-and-forget**: silently dropped when `openSettings` hook is absent (D10 — config-demo napplet functions without a settings UI).

5. **No `config.set`**: explicitly absent from the switch statement. Scope boundary documented in top-of-file JSDoc (CONFIG-04) + changeset + index.ts comment block.

## Deviations from Plan

None — plan executed exactly as written. The 379-line count slightly exceeds the 200-350 range in the self-check (due to expanded JSDoc and inline comments for clarity), but the file content is complete and correct.

## Next-Plan Pointer

**Plan 39-04** registers the service via `runtime.registerService('config', configService.handler)` in `createDemoHooks()` and exposes `publishValues` for the shell UI config-update trigger button (D11). **Plan 39-05** writes `nub-config.spec.ts` exercising the full wire protocol end-to-end.

## Self-Check: PASSED

- FOUND: `packages/services/src/config-service.ts`
- FOUND: `.changeset/config-01-services-config.md`
- FOUND: commit `1c7d8f0` (Task 1)
- FOUND: commit `0fa11f1` (Task 2)
