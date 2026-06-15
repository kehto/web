---
gsd_state_version: 1.0
milestone: v1.19
milestone_name: NAP Ontology Alignment
status: planning
last_updated: "2026-06-15"
last_activity: 2026-06-15
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-15)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** Phase 83 — NAP Ontology Alignment

## Current Position

Phase: 83 of 83 (NAP Ontology Alignment)
Plan: — of — (not yet planned)
Status: Ready to plan
Last activity: 2026-06-15 — v1.19 roadmap created; Phase 83 ready to plan

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 83 | TBD | - | - |

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

Last session: 2026-06-15
Stopped at: Roadmap created; Phase 83 defined and ready to plan.
Resume file: None

## Operator Next Steps

- Run `/gsd:plan-phase 83` to decompose Phase 83 into executable plans.
