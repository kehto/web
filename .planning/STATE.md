---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: — Productionization & Upstream Unblock
status: executing
last_updated: "2026-04-19T10:34:57.921Z"
last_activity: 2026-04-19
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-19, v1.4 milestone opened)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** v1.4 Phase 23 — CI/CD Baseline & Doc Trivia (all 4 plans complete; ready for phase-completion review).

## Current Position

Phase: 23 of 28 (CI/CD Baseline & Doc Trivia) — first v1.4 phase
Plan: 4 of 4 complete (23-01 build CI ✓, 23-02 unit-test CI ✓, 23-03 e2e CI ✓, 23-04 DOCS-04 JSDoc refresh ✓)
Status: Phase 23 complete — ready for verify/next phase
Last activity: 2026-04-19

Progress: [░░░░░░░░░░] 0% (0/6 v1.4 phases complete) — phase 23: [██████████] 100% (4/4 plans)

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
- [v1.4-23-02] Unit-test CI invokes `pnpm test` (turbo run test), not `pnpm test:unit` — root `test` script delegates to per-package Vitest configs via turbo; `test:unit` is a developer-local shortcut (`vitest run` from root) that bypasses turbo and per-package test configurations. CI must match the canonical entry point.
- [v1.4-23-04] DOCS-04 JSDoc refresh: replace `'auth-napplet'` with `'nub-identity'` in harness.ts + wait-for-napplet-ready.ts — rationale: auth-napplet fixture deleted in v1.3; nub-identity is the closest semantic match (both AUTH-flow fixtures) and is currently shipped per CONTEXT.md decision D.

Full decision log archived in `.planning/PROJECT.md` (Key Decisions table) and per-milestone roadmap archives.

### Blockers/Concerns (carried forward)

- None blocking — `@napplet/core@0.2.0` on npm clears the v1.3 publication-blocker. v1.4 is fully unblocked from upstream.

## Session Continuity

Last session: 2026-04-19T10:34:57.919Z
Resume: `/gsd:verify-work 23` to validate Phase 23, then `/gsd:plan-phase 24` for DRIFT-CORE-06 cleanup.
