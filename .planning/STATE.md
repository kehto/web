---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: "Downstream Unblock & Shell Service Surface"
status: roadmap_defined
last_updated: "2026-04-23T00:00:00.000Z"
last_activity: 2026-04-23
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
  first_phase: 32
  last_phase: 37
  baseline_e2e_passing: 53
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-23, v1.6 started)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** v1.6 Downstream Unblock — close hyprgate v2.0 gap-analysis issues + consolidate onto `@napplet/nub` subpath imports.

## Current Position

**Milestone:** v1.6 Downstream Unblock & Shell Service Surface
**Phase numbering:** 32 → 37 (continues from v1.5 close at Phase 31)
**Phase:** Not started (roadmap defined; next step is `/gsd:plan-phase 32`)
**Plan:** —
**Status:** Roadmap defined, plans pending
**Last activity:** 2026-04-23 — ROADMAP.md written; 26/26 requirements mapped across Phases 32–37

Progress: [··········] 0% (0/6 phases complete)

## Roadmap Summary

| Phase | Name | REQ-IDs | Criteria |
|-------|------|---------|----------|
| 32 | NUB Dep Consolidation | DEP-01..05 | 5 |
| 33 | Cache Service + HostCacheBridge | CACHE-01..05 | 5 |
| 34 | Reserved Chord Surface + E2E-17 | KEYS-04..06, E2E-17 | 5 |
| 35 | `@kehto/nip66` Extract & Publish | NIP66-01..05 | 5 |
| 36 | WM Skeleton + README Cleanup | WM-01..03, DOCS-04..05 | 5 |
| 37 | PERF-01 + Milestone Close E2E-18 | PERF-01, E2E-18 | 5 |

**Coverage:** 26/26 v1 requirements mapped, zero orphans.
**Execution order:** 32 → 33 → 34 → 35 → 36 → 37 (strict numeric; 33-36 are mutually independent once 32 lands).
**E2E target at close:** ≥ 54 passed / 0 failed / 0 skipped (53 baseline + E2E-17 new spec in Phase 34).

## Accumulated Context

Full decision log (v1.0 → v1.5) archived in `.planning/PROJECT.md` Key Decisions table (17 entries) and per-milestone archives at `.planning/milestones/v{1.0,1.1,1.2,1.3,1.4,1.5}-ROADMAP.md`.

### v1.6 scope origin

- **Downstream:** 8 open GitHub issues filed by dskvr during hyprgate v2.0 Kehto Migration gap analysis (kehto#1, #2, #3, #4, #5, #6, #8, #9). 6 of 8 pulled into v1.6 scope; #6 tracking-only; #9 upstream-first (cross-linked to napplet/napplet#3).
- **Carryover:** PERF-01 from v1.5 (chat boot storage.get storm).
- **Explicitly deferred to v1.7:** NIP-5D spec resync, NUB-CLASS, NUB-CONNECT, NUB-CONFIG, NUB-RESOURCE. v1.7 is the spec-alignment milestone for @napplet v0.29.0.

### Phase dependency structure

- **Phase 32 is the keystone** — DEP migration is lockfile-wide and every subsequent phase lands on the consolidated `@napplet/nub` subpath surface. Phases 33-36 can be planned concurrently post-32 (all four carry the `Depends on: Phase 32` constraint and nothing else beyond it).
- **Phase 37 is the milestone close** — depends on 32, 33, 34, 35, 36. PERF-01 lands here alongside E2E-18 (milestone iteration loop) so the anti-term sweep runs against the full v1.6 delta in one pass.
- **Only new Playwright spec in v1.6 is E2E-17** (Phase 34, reserved-chord contract). Expected baseline delta: 53 → 54.

### Blockers/Concerns

- **DEP-01 migration risk (Phase 32):** consolidating 4 `@kehto/*` packages' peer deps from split `@napplet/nub-*` → `@napplet/nub` subpath is lockfile-wide; needs changesets, verification that dual-instance pitfall is actually gone (not just renamed). Must hold exactly 53/0/0 — no regression cover.
- **PERF-01 measurement (Phase 37):** no baseline number yet; v1.5 audit described "18+ serial round-trips" but did not record wall-clock. Phase plan will need to define pass/fail threshold via pre-fix instrumentation recorded in `37-ITERATION-LOG.md`.
- **KEYS-04 design decision (Phase 34):** `reservedChords` service option vs `HostKeysBridge.reserveAbsolute()` extension is deferred to the plan phase — both shapes are acceptable contracts per the requirement; pick one and document the reasoning in the plan.
- **@kehto/nip66 relay-pool shape (Phase 35):** the injected relay-pool handle contract is not fully specified; reference patterns exist in hyprgate's `nip66-monitor.ts` and nadar — plan phase will pin the interface.

## Session Continuity

Last session: 2026-04-23T00:00:00.000Z
Resume: v1.6 roadmap complete. REQUIREMENTS.md traceability populated (26/26 mapped). ROADMAP.md written with Phases 32–37. Next: `/gsd:plan-phase 32` to decompose the DEP migration into concrete plans.
