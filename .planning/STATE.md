---
gsd_state_version: 1.0
milestone: v1.19
milestone_name: NAP Ontology Alignment
status: executing
stopped_at: "Completed 83-01: inc domain aliased to ifcMap in ACL resolver"
last_updated: "2026-06-15T16:10:50.030Z"
last_activity: 2026-06-15
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-15)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** Phase 83 — nap-ontology-alignment

## Current Position

Phase: 83 (nap-ontology-alignment) — EXECUTING
Plan: 3 of 3
Status: Ready to execute
Last activity: 2026-06-15

Progress: [███████░░░] 67%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 83 | TBD | - | - |
| Phase 83 P83-01 | 10m | 1 tasks | 2 files |
| Phase 83 P02 | 4m | 2 tasks | 3 files |

## Accumulated Context

Full decision log lives in `.planning/PROJECT.md` Key Decisions table.

### Key Context for Phase 83

- `@napplet/shim@0.9.0` `createShellSupports` reads only `capabilities.naps`; protocol regex is `^([^:]+):(NAP-\d+)$`; `NapDomain` includes `inc`, not `ifc`.
- Core 0.5.0 `createDispatch` routes any string domain key — register existing IFC handler under both `ifc` and `inc` keys; NO `@napplet/core` upgrade needed.
- Files to touch: `packages/shell/src/shell-init.ts`, `shell-ready.ts`, `types.ts`; `packages/runtime/src/runtime.ts`; `packages/acl/src/resolve.ts`.
- Dual-emit: `naps` (new, 0.9.0 shim reads this) + `nubs` (back-compat, legacy shim reads this). Both must be in the `shell.init` payload for one release.
- `@napplet/shim@0.9.0` is a dev-only dependency for the conformance test (ALIGN-07) — do not add as a runtime dep.
- Must keep 840 unit + 86 E2E green. Out of scope: mass-renaming internal `ifc.*` handlers, `nub-*` test fixtures, `@napplet/core` upgrade.
- Parallel milestone: v1.18 Firewall occupies phases 80-82 on `milestone/v1.18-firewall`. This milestone starts at Phase 83 to avoid directory collisions on merge.
- Downstream consumer impact: hyprgate (note in changeset per ALIGN-08).

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-06-15T16:10:50.022Z
Stopped at: Completed 83-01: inc domain aliased to ifcMap in ACL resolver
Resume file: None

## Operator Next Steps

- Run `/gsd:plan-phase 83` to decompose Phase 83 into executable plans.
