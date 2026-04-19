---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Productionization & Upstream Unblock
status: defining_requirements
stopped_at: v1.4 milestone opened 2026-04-19 — scoping requirements
last_updated: "2026-04-19T00:00:00.000Z"
last_activity: 2026-04-19
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-18, after v1.3)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** Planning next milestone (`/gsd:new-milestone`).

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-19 — Milestone v1.4 started

**v1.3 shipped 2026-04-18.** Audit passed 37/37 requirements, 7/7 phases, 11/11 flows. See `.planning/milestones/v1.3-MILESTONE-AUDIT.md`.

## Accumulated Context

### Decisions (carried forward)

- [v1.2] Shell MUST NOT provide `window.nostr` — napplets consume signing via `relay.publish`/`publishEncrypted`; identity reads via `identity.*`.
- [v1.2] `createDispatch()` + `registerNub()` is canonical dispatch; per-runtime instance required.
- [v1.2] `DRIFT-CORE-06` (`packages/runtime/src/core-compat.ts`) stays intact; no new consumers.
- [v1.3] E2E-11 iteration-loop discipline: every phase from Phase 17 onward closes with a recorded build→run→Playwright→fix loop (formally closed Phase 22).
- [v1.3] `@napplet/core` dedup via `pnpm.overrides` at workspace root — single `link:` instance across all `@kehto/*` packages (Pitfall 3).
- [v1.3] Legacy NIP-01 fixtures + specs deleted (not migrated) — cleanliness > backward compat.

Full decision log archived in `.planning/milestones/v1.3-ROADMAP.md`.

### Blockers/Concerns (carried forward)

- `@napplet/core` not on npm — workspace `link:` overrides active; blocks `changeset publish` until upstream publication.
- `DRIFT-CORE-06` cleanup waits for `@napplet/core` to restore legacy exports upstream.
- CI/CD deferred from v1.3; candidate for v1.4.
- Cosmetic: 2 JSDoc `@example` blocks in tests/e2e/harness/harness.ts + helpers still cite deleted `auth-napplet` fixture.

## Session Continuity

Last session: 2026-04-18 — v1.3 milestone shipped.
Resume: `/gsd:new-milestone` to plan v1.4.
