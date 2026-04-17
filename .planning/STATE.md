---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Demo Functional & Playwright Parity
status: defining_requirements
stopped_at: "Milestone v1.3 opened — defining requirements"
last_updated: "2026-04-18T00:00:00.000Z"
last_activity: 2026-04-18
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-18)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** Milestone v1.3 — Demo Functional & Playwright Parity (defining requirements)

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-18 — Milestone v1.3 started

## Milestone v1.3 Target Scope

- Demo app rewire to canonical v1.2 APIs (all four demo surfaces).
- Napplet showcase: migrate bot/chat + expand with single-purpose napplets until all 8 nub domains are exercised end-to-end.
- Canonical signer UX via identity + relay.publish / publishEncrypted (no window.nostr, no signer-service).
- Playwright suite rewrite: triage tests/e2e/*, delete obsolete specs, add demo-functional golden paths; `pnpm test:e2e` green.
- Each phase ends with a build → run → Playwright (MCP) → fix loop.
- Docs refresh + release rehearsal (staged changesets; publish deferred pending @napplet/core npm release).

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

Recent decisions affecting current work (full log in PROJECT.md):

- [v1.2] Shell MUST NOT provide `window.nostr` — demo + napplets must consume signing exclusively via `relay.publish` / `relay.publishEncrypted` and identity reads via `identity.*`.
- [v1.2] `createDispatch()` + `registerNub()` is the canonical dispatch path; per-runtime instance. Demo consumers should not hand-roll a switch.
- [v1.2] Stub-level services for keys/media/notify/identity/theme ship inside `@kehto/services`; real backends are plugged via `runtime.registerService()`. The demo is the reference host-app for plugging these backends.
- [v1.2] `packages/runtime/src/core-compat.ts` (DRIFT-CORE-06) stays intact — do not extend it, but do not delete it in v1.3 either.
- [v1.2] `@napplet/core` npm publication is the upstream blocker for `changeset publish`; v1.3 release rehearsal stops at `changeset version` dry-run.

### Blockers/Concerns

- `@napplet/core` not yet published to npm — workspace overrides continue to resolve `/home/sandwich/Develop/napplet/*`; v1.3 demo must work under this layout.
- No CI/CD yet — Playwright must be driven locally (pnpm + Playwright MCP).
- Existing `tests/e2e/*` contains specs against removed APIs (`auth*`, `signer-delegation`, `acl-matrix-signer`, etc.). Expect non-trivial triage in an early phase.

## Session Continuity

Last session: 2026-04-18
Stopped at: Milestone v1.3 opened — defining requirements
Resume: continue `/gsd:new-milestone` workflow → research decision → requirements → roadmap.
