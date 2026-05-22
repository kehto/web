---
gsd_state_version: 1.0
milestone: v1.9
milestone_name: Napplet SDK Migration
status: planning
last_updated: "2026-05-22T09:10:47.154Z"
last_activity: 2026-05-22
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-22, v1.9 started)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** Phase 47 — SDK 0.3 Package Graph + IFC/Storage Migration.

## Current Position

Phase: 47 — SDK 0.3 Package Graph + IFC/Storage Migration
Plan: —
Status: Ready to plan
Last activity: 2026-05-22 — Milestone v1.9 requirements and roadmap initialized

## Accumulated Context

Full decision log (v1.0 → v1.8) archived in `.planning/PROJECT.md` Key Decisions table (32 entries) and per-milestone archives at `.planning/milestones/v{1.0,1.1,1.2,1.3,1.4,1.5,1.6,1.7,1.8}-ROADMAP.md`.

### v1.8 Phase Sequence

- **Phase 42** (ungated): BUG-01/02 + POLISH-01 + RENAME-01/02 — 5 reqs
- **Phase 43** (ungated): VALIDATE-01 — 1 req
- **Phase 44** (completed 2026-05-21): DEP-01..07 + VALIDATOR-01/02 — 9 reqs
- **Phase 45** (completed 2026-05-21): DECRYPT-01..07 — 7 reqs
- **Phase 46** (completed 2026-05-21): DECRYPT-08..10 + E2E-27/28 — 5 reqs

### Blockers/Concerns

- No active blockers. v1.8 requirements are complete, audited, and archived.
- v1.9 focus: migrate the 18 SDK-bearing demo/fixture packages from `@napplet/sdk@^0.2.1` namespace exports to the `@napplet/sdk@0.3.0` function-export surface.
- Published package check: `@napplet/sdk@0.3.0`, `@napplet/shim@0.3.0`, and `@napplet/vite-plugin@0.3.0` are all available on npm as of 2026-05-22.
- Scope boundary: `decrypt-demo` is excluded from the 18-package SDK migration because it does not depend on `@napplet/sdk`; RENAME-02 hard removal is deferred as a future requirement unless explicitly added.

## Session Continuity

Last session: 2026-05-22T09:10:47+02:00
Resume: v1.9 is initialized. Next: plan Phase 47.

## Operator Next Steps

- Start Phase 47 with `/gsd-plan-phase 47`
