---
gsd_state_version: 1.0
milestone: v0.1.0
milestone_name: milestone
status: executing
stopped_at: Completed 03-runtime-migration-doc-02-PLAN.md
last_updated: "2026-04-07T18:22:32.139Z"
last_activity: 2026-04-07
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 5
  completed_plans: 5
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-07)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** Phase 01 — gap-analysis

## Current Position

Phase: 3
Plan: Not started
Status: Ready to execute
Last activity: 2026-04-07

Progress: [----------] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 1
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 01-gap-analysis P01 | 3 | 2 tasks | 1 files |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-gap-analysis P02 | 5 | 2 tasks | 1 files |
| Phase 02-acl-migration-doc P01 | 2 | 2 tasks | 1 files |
| Phase 03-runtime-migration-doc P01 | 15 | 1 tasks | 1 files |
| Phase 03-runtime-migration-doc P02 | 6 | 2 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Gap Analysis (Phase 1) goes first — its boundary contracts are inputs to all package migration docs
- Roadmap: Phases 4 and 5 depend on both Phase 1 and Phase 3 (shell and services depend on runtime interfaces)
- [Phase 01-gap-analysis]: Dual-mode AUTH framing: NIP-5D napplets use source-based identity; legacy napplets can still AUTH (matches PITFALLS.md Pitfall 1)
- [Phase 01-gap-analysis]: GAP-ANALYSIS.md sections 1-3 written atomically from pre-populated RESEARCH.md; document structure: summary table -> per-gap sections with before/after -> placeholders for plan 02
- [Phase 01-gap-analysis]: Tasks 1 and 2 combined into a single commit since both target docs/GAP-ANALYSIS.md and research was pre-populated in RESEARCH.md
- [Phase 01-gap-analysis]: All 6 silent failure point line numbers verified against live source files before writing into GAP-ANALYSIS.md
- [Phase 02-acl-migration-doc]: Identity.pubkey kept optional (not removed) for backward compat — toKey() ignores it under NIP-5D
- [Phase 02-acl-migration-doc]: migrateAclState() belongs in @kehto/shell acl-store.ts — @kehto/acl is a pure zero-dep module with no I/O
- [Phase 02-acl-migration-doc]: IFC NUB reuses relay:write/relay:read rather than introducing new capability bits
- [Phase 03-runtime-migration-doc]: Dual-mode dispatch is the correct transition strategy: NUB path checked first, legacy array path as fallback — NIP-5D napplets bypass AUTH queue entirely
- [Phase 03-runtime-migration-doc]: AUTH removal is phased: Phase 1 adds NUB path (no AUTH touch), Phase 2 makes AUTH optional for legacy, Phase 3 removes AUTH entirely when legacy support ends
- [Phase 03-runtime-migration-doc]: Source-based identity (MessageEvent.source) replaces AUTH as security boundary; originRegistry.register() must be called synchronously at iframe creation before any messages arrive
- [Phase 03-runtime-migration-doc]: Option B (empty string) for SessionEntry.pubkey in NIP-5D sessions — aligns with ACL-MIGRATION.md, preserves legacy compat via identitySource discriminant
- [Phase 03-runtime-migration-doc]: identitySource: 'auth' | 'source' discriminant added to SessionEntry — explicit session type replaces implicit pubkey-truthy gate
- [Phase 03-runtime-migration-doc]: IFC explicit subscription lifecycle (ifc.subscribe/unsubscribe) is net-new behavior — old runtime had no IFC subscribe primitive

### Pending Todos

None yet.

### Blockers/Concerns

- Source migration (Phase 63 in @napplet) happens from @napplet repo, not from here
- @napplet/core not yet published to npm — Phase 63 uses workspace override
- No CI/CD yet — will be set up in a future kehto milestone

## Session Continuity

Last session: 2026-04-07T18:22:32.137Z
Stopped at: Completed 03-runtime-migration-doc-02-PLAN.md
Resume file: None
