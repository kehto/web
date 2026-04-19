---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: — Demo Stability & UAT Coverage
status: executing
stopped_at: "Completed 30-03-PLAN.md (UI-03: dynamic sequence-diagram lanes)"
last_updated: "2026-04-19T23:30:45.452Z"
last_activity: 2026-04-19
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 5
  completed_plans: 4
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-19, v1.5 milestone opened)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** Phase 30 — Shell UI State Wiring

## Current Position

Phase: 30 (Shell UI State Wiring) — EXECUTING
Plan: 3 of 3
Status: Ready to execute
Last activity: 2026-04-19

Progress: 1/3 phases complete [---       ] 33%

## Performance Metrics

| Metric | v1.4 baseline | v1.5 target |
|--------|--------------|-------------|
| Playwright specs | 49 passed / 0 failed / 0 skipped | 51 passed / 0 failed / 0 skipped |
| Demo napplets reaching AUTHENTICATED | 2/10 (post-v1.4 UAT) | 10/10 |
| Shell UI state surfaces wired | 0/3 (counters, ACL matrix, seq diagram) | 3/3 |
| Phase 29-concurrent-boot-auth-fix-demo-stability P01 | 15 | 1 tasks | 1 files |
| Phase 29-concurrent-boot-auth-fix-demo-stability P02 | 10 | 2 tasks | 0 files (cascade-fixed) |
| Phase 30-shell-ui-state-wiring P03 | 12 | 1 tasks | 2 files |
| Phase 30-shell-ui-state-wiring P01 | 8min | 1 tasks | 1 files |

## Accumulated Context

### Decisions (carried forward from v1.4)

Full log in `.planning/PROJECT.md` Key Decisions table (15 entries through v1.4). Key v1.4 patterns that inform v1.5 scope:

- Per-napplet `window.__grant*__` host hooks for E2E capability gates (decision 15).
- cascade-fixed bucket (v1.5-29-02): when upstream fix eliminates a downstream symptom, no Task 2 code change is required — document as cascade-fixed and confirm baseline unchanged.
- Harness `__registerService__('name', 'real')` factory-key for Layer-A real-backend specs (decision 13).
- Status-sentinel wait substitutes `__nappletReady__` on `:4174` demo port (v1.4-26-04).
- Anti-feature documentation must be descriptive, not literal-token quotation (v1.4-26-03 Rule-1 lesson).
- `frame.evaluate(() => btn.click())` canonical for sandboxed napplet iframe button interactions (v1.3 pattern).
- `page.bringToFront()` before iframe interactions in parallel Playwright workers (v1.4-27-04 pattern).

### Blockers/Concerns (carried forward)

- v1.4 deferred items (both non-blocking):
  - Phase 27 push + CI workflow URL evidence (local iteration 49/0/0 verified).
  - `release.yml` first-fire on next `v*` tag (workflow file exists post-v0.2.0).

### UAT findings feeding this milestone

See `.planning/v1.5-UAT-FINDINGS.md` for the 6 post-v1.4 UAT issues classified by severity and likely area.

Key mapping:

- Issue 1 (7/10 napplets LOADING) → DEMO-01 → Phase 29
- Issue 2 (media play/pause noop) → DEMO-02 → Phase 29 (downstream of issue 1)
- Issue 3 (activity counters stuck) → UI-01 → Phase 30
- Issue 4 (ACL Matrix empty) → UI-02 → Phase 30
- Issue 5 (sequence diagram missing lanes) → UI-03 → Phase 30
- Issue 6 (chat serial storage.get) → PERF-01 → deferred to v1.6 (not a correctness bug)

### Todos

- [ ] Plan Phase 29 (`/gsd:plan-phase 29`)
- [ ] Plan Phase 30 (`/gsd:plan-phase 30`)
- [ ] Plan Phase 31 (`/gsd:plan-phase 31`)

## Session Continuity

Last session: 2026-04-19T23:30:28.482Z
Stopped at: Completed 30-03-PLAN.md (UI-03: dynamic sequence-diagram lanes)
Resume: Phase 29 complete (DEMO-01 + DEMO-02 both satisfied). Next: `/gsd:plan-phase 30` (Shell UI State Wiring).
