---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: — NIP-5D Conformance & Full NUB Coverage
status: roadmapped
stopped_at: Rescope complete — ready to plan Phase 10 against canonical spec + 8-nub napplet
last_updated: "2026-04-17T11:00:00.000Z"
last_activity: 2026-04-17
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** Phase 10 — spec-conformance-audit (rescoped against canonical NIP-5D + 8-nub napplet)

## Current Position

Phase: 10
Plan: Not started
Status: Rescoped and roadmapped, ready to re-run Phase 10
Last activity: 2026-04-17 — milestone rescoped after canonical spec sync (`dskvr/nips` nip/5d) and 8-nub reconciliation

Progress: [----------] 0% (v1.2)

## Milestone v1.2 Phases (rescoped)

| # | Phase | Requirements |
|---|-------|--------------|
| 10 | Spec Conformance Audit | SPEC-01, SPEC-02 |
| 11 | Nub Peer Deps & Type Imports | DEPS-01, NUB-01, NUB-02 |
| 12 | Shell Conformance & Seven-Nub Coverage | SPEC-03, SH-C01, SH-C02, SH-C03, NUB-03, NUB-04, NUB-05, NUB-06, NUB-07, NUB-08, NUB-09, NUB-10 |
| 13 | Theme Nub Implementation | TH-01, TH-02, TH-03, TH-04 |
| 14 | Dispatch Refactor | DISPATCH-01, DISPATCH-02, DISPATCH-03 |
| 15 | Milestone Validation & Release Prep | DEPS-02, DEPS-03 |

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v1.2)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*
| Phase 10 P01 | 4min | 2 tasks | 2 files |
| Phase 10 P02 | 6min | 2 tasks | 1 files |

## Accumulated Context

### Decisions

Recent decisions affecting current work (full log in PROJECT.md):

- [v1.1] Clean break — no dual-mode dispatch, no backward compatibility with NIP-01 arrays
- [v1.1] Dedicated `.error` type suffix for error responses
- [v1.1] resolveCapabilitiesNub is the canonical capability mapping — lives in @kehto/acl
- [v1.2 roadmap] Dispatch refactor (Phase 14) executes AFTER all five domain handlers are complete and green, so the switch-removal can be validated against a passing test suite.
- [v1.2 roadmap] DEPS-01 (peer-dep bump) and NUB-01/02 (type imports) are grouped in Phase 11 because handler work in Phase 12 depends on the new types being resolvable.
- [v1.2 roadmap] Theme (Phase 13) is sequenced after Phase 11 but independent of Phase 12 — can parallelize once nub-theme types are available.
- [Phase 10]: Provenance header for synced specs is exactly 6 lines so 'tail -n +7 specs/NIP-5D.md' yields upstream byte-identical content — drift detection reduces to a single diff command.
- [Phase 10]: Top-level README's ## Specification section is the canonical pointer to the pinned spec + upstream URL; keeps the repo root README minimal (30 lines) while satisfying SPEC-01.
- [Phase 10]: 24 stable DRIFT-* IDs documented in docs/v1.2-NIP-5D-AUDIT.md — 15 Phase 12, 5 Phase 13, 4 Phase 14; every ID cites packages/<pkg>/src/<file>.ts:<line> or an absence site
- [Phase 10]: Audit established six-column drift table shape as kehto v1.3+ spec-conformance precedent; IDs never renumber, new NUBs append new DRIFT-* rows
- [Phase 10]: storage.clear is a kehto unilateral extension (not in @napplet/nub-storage) — DRIFT-SVC-06 removes it from NUB dispatch; internal cleanupNappState helper remains for lifecycle cleanup

### Blockers/Concerns

- @napplet/core not yet published to npm — uses workspace override; v1.2 must continue to work via workspace resolution.
- No CI/CD yet — Phase 15 test validation is run locally.

## Session Continuity

Last session: 2026-04-17T10:00:45.251Z
Stopped at: Completed 10-02-PLAN.md (cross-package NIP-5D audit)
Resume: Run `/gsd:plan-phase 10` to begin Spec Conformance Audit.
