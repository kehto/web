---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: "Downstream Unblock & Shell Service Surface"
status: defining_requirements
last_updated: "2026-04-23T00:00:00.000Z"
last_activity: 2026-04-23
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-23, v1.6 started)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** v1.6 Downstream Unblock — close hyprgate v2.0 gap-analysis issues + consolidate onto `@napplet/nub` subpath imports.

## Current Position

**Milestone:** v1.6 Downstream Unblock & Shell Service Surface
**Phase:** Not started (defining requirements)
**Plan:** —
**Status:** Defining requirements
**Last activity:** 2026-04-23 — Milestone v1.6 started

Progress: [··········] 0% (requirements definition)

## Accumulated Context

Full decision log (v1.0 → v1.5) archived in `.planning/PROJECT.md` Key Decisions table (17 entries) and per-milestone archives at `.planning/milestones/v{1.0,1.1,1.2,1.3,1.4,1.5}-ROADMAP.md`.

### v1.6 scope origin

- **Downstream:** 8 open GitHub issues filed by dskvr during hyprgate v2.0 Kehto Migration gap analysis (kehto#1, #2, #3, #4, #5, #6, #8, #9). 6 of 8 pulled into v1.6 scope; #6 tracking-only; #9 upstream-first (cross-linked to napplet/napplet#3).
- **Carryover:** PERF-01 from v1.5 (chat boot storage.get storm).
- **Explicitly deferred to v1.7:** NIP-5D spec resync, NUB-CLASS, NUB-CONNECT, NUB-CONFIG, NUB-RESOURCE. v1.7 is the spec-alignment milestone for @napplet v0.29.0.

### Blockers/Concerns

- **DEP-01 migration risk:** consolidating 4 `@kehto/*` packages' peer deps from split `@napplet/nub-*` → `@napplet/nub` subpath is lockfile-wide; needs changesets, verification that dual-instance pitfall is actually gone (not just renamed).
- **PERF-01 measurement:** no baseline number yet; v1.5 audit described "18+ serial round-trips" but did not record wall-clock. Phase plan will need to define pass/fail threshold.

## Session Continuity

Last session: 2026-04-23T00:00:00.000Z
Resume: v1.6 started. PROJECT.md + STATE.md written. Next: define REQUIREMENTS.md, then spawn gsd-roadmapper.
