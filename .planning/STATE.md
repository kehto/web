---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Productionization & Upstream Unblock
status: roadmap_complete
stopped_at: v1.4 ROADMAP.md drafted 2026-04-19 — 6 phases (23–28), 20/20 REQ-IDs mapped, awaiting user approval before /gsd:plan-phase 23
last_updated: "2026-04-19T00:00:00.000Z"
last_activity: 2026-04-19
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-19, v1.4 milestone opened)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** v1.4 Phase 23 — CI/CD Baseline & Doc Trivia (ready to plan).

## Current Position

Phase: 23 of 28 (CI/CD Baseline & Doc Trivia) — first v1.4 phase
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-04-19 — v1.4 roadmap drafted, 20/20 REQ-IDs mapped across 6 phases

Progress: [░░░░░░░░░░] 0% (0/6 v1.4 phases complete)

**v1.4 phase list (23–28):**
- Phase 23: CI/CD Baseline & Doc Trivia (CI-01, CI-02, CI-03, DOCS-04)
- Phase 24: DRIFT-CORE-06 Cleanup (DRIFT-01, DRIFT-02)
- Phase 25: Release Publication (REL-05, REL-06, CI-04)
- Phase 26: Real Keys Backend (KEYS-01, KEYS-02, KEYS-03, E2E-12)
- Phase 27: Real Media Backend (MEDIA-01, MEDIA-02, MEDIA-03, E2E-13)
- Phase 28: Layer-A Upgrade & Docs Polish (E2E-14, DOCS-05, DOCS-06)

## Accumulated Context

### Decisions (carried forward)

- [v1.2] Shell MUST NOT provide `window.nostr` — napplets consume signing via `relay.publish`/`publishEncrypted`; identity reads via `identity.*`.
- [v1.2] `createDispatch()` + `registerNub()` is canonical dispatch; per-runtime instance required.
- [v1.3] E2E iteration-loop discipline is canon: every phase that touches a Playwright spec closes with a recorded build→run→Playwright→fix loop. Baked into v1.4 success criteria — no longer a tracked REQ-ID.
- [v1.3] Legacy NIP-01 fixtures + specs deleted (not migrated) — cleanliness > backward compat.
- [v1.4] `DRIFT-CORE-06` is no longer upstream-blocked — `@napplet/core@0.2.0` is on npm. Phase 24 deletes `core-compat.ts` via pure internal refactor.
- [v1.4] `pnpm.overrides` `link:` entries for `@napplet/*` MUST be removed before REL-05 publishes (Phase 25).

Full decision log archived in `.planning/PROJECT.md` (Key Decisions table) and per-milestone roadmap archives.

### Blockers/Concerns (carried forward)

- None blocking — `@napplet/core@0.2.0` on npm clears the v1.3 publication-blocker. v1.4 is fully unblocked from upstream.

## Session Continuity

Last session: 2026-04-19 — v1.4 roadmap drafted by gsd-roadmapper; 20/20 REQ-IDs mapped across 6 phases (23–28).
Resume: `/gsd:plan-phase 23` to plan CI/CD Baseline & Doc Trivia.
