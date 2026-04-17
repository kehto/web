---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Demo Functional & Playwright Parity
status: roadmap_complete
stopped_at: "Roadmap written — ready to plan Phase 16"
last_updated: "2026-04-18T00:00:00.000Z"
last_activity: 2026-04-18
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-18)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** Milestone v1.3 — Phase 16: Harness Triage & Playwright Infrastructure

## Current Position

Phase: 16 of 22 (Harness Triage & Playwright Infrastructure)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-04-18 — v1.3 roadmap written (Phases 16–22, 35 requirements mapped)

Progress: [░░░░░░░░░░] 0%

## v1.3 Phase List

| Phase | Name | Requirements |
|-------|------|--------------|
| 16 | Harness Triage & Playwright Infrastructure | E2E-01..05 |
| 17 | Demo App Rewire | DEMO-01..08, E2E-06, E2E-11 (gate) |
| 18 | Napplet SDK Migration | NAP-01..02, E2E-07 (ifc-roundtrip, napplet-auth) |
| 19 | Core-Domain Napplets | NAP-03..05, E2E-07 (relay/storage/notify specs), E2E-08 |
| 20 | Expanded-Domain Napplets | NAP-06..09, E2E-07 (identity/theme/relay-subscribe) |
| 21 | Fixture Napplets & Layer-A Specs | E2E-09 |
| 22 | Docs Refresh & Release Rehearsal | DOCS-01..03, REL-01..04, E2E-10, E2E-11 (closed) |

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (v1.3)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*

## Accumulated Context

### Decisions

- [v1.2] Shell MUST NOT provide `window.nostr` — demo + napplets consume signing via `relay.publish`/`publishEncrypted`; identity reads via `identity.*`.
- [v1.2] `createDispatch()` + `registerNub()` is canonical dispatch; per-runtime instance required.
- [v1.2] `DRIFT-CORE-06` (`packages/runtime/src/core-compat.ts`) stays intact; no new consumers.
- [v1.3] `feed` napplet relay.subscribe delivery mechanism is an open decision — resolve at Phase 20 planning via `/gsd:discuss-phase 20`.

### Blockers/Concerns

- `@napplet/core` not on npm — workspace `link:` overrides active; run `pnpm ls @napplet/core --depth 5` before each Playwright run.
- `feed` napplet delivery path (Phase 20) is undecided — must be resolved before Phase 20 executes.

## Session Continuity

Last session: 2026-04-18
Stopped at: v1.3 roadmap written — 35 requirements mapped across Phases 16–22
Resume: `/gsd:plan-phase 16`
