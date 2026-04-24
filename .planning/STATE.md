---
gsd_state_version: 1.0
milestone: "v1.7"
milestone_name: "NIP-5D Spec Adoption & New NUB Domains"
status: defining_requirements
last_updated: "2026-04-24T00:00:00.000Z"
last_activity: 2026-04-24
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-24, v1.7 kicked off)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** v1.7 — NIP-5D spec resync + NUB-CLASS/CONNECT adoption + NUB-CONFIG/RESOURCE reference services + carryover polish.

## Current Position

**Milestone:** v1.7 NIP-5D Spec Adoption & New NUB Domains
**Phase:** Not started (defining requirements)
**Plan:** —
**Status:** Defining requirements
**Last activity:** 2026-04-24 — Milestone v1.7 started

Progress: [          ] 0%

**v1.7 spine (spec-driven):**

- SPEC resync from `dskvr/nips` branch `nip/5d` (class-posture delegation ¶)
- NUB-CLASS adoption — shell emits `class.assigned` envelope; ACL + dispatch honor class posture
- NUB-CONNECT adoption — per-napplet CSP `connect-src`; consent flow; HTTP-header authority; `(dTag, aggregateHash)` grant keys; SHELL-CONNECT-POLICY.md audit
- NUB-CONFIG reference service (9th domain)
- NUB-RESOURCE reference service (10th domain)

**v1.7 carryover / opportunistic:**

- `@kehto/nip66` demo wiring (NIP66-05 follow-up)
- `@kehto/wm` abstractions (structural primitives only; consumers build concrete layouts)
- CACHE polish (kehto#1 — `HostCacheBridge` naming parity)
- Shell NIP-44 decrypt (kehto#9) — **soft-gated** on napplet/napplet#3 unblock

**Phase numbering:** continues from 36 → Phase 37 onwards.

## Accumulated Context

Full decision log (v1.0 → v1.6) archived in `.planning/PROJECT.md` Key Decisions table (22 entries) and per-milestone archives at `.planning/milestones/v{1.0,1.1,1.2,1.3,1.4,1.5,1.6}-ROADMAP.md`.

**v1.6 shipped (2026-04-23):** 5 phases (32–36), 12 plans, 21/21 requirements, 54/0/0 E2E. NUB dep consolidation onto `@napplet/nub@^0.2.1` subpaths; reserved-chord surface; `@kehto/nip66@0.1.0` publishable package; `@kehto/wm@0.0.0` skeleton; AUTH-probe cleanup.

### Blockers/Concerns

- **kehto#9 (receive-side NIP-44 decrypt)** — blocks `DECRYPT-01` only; soft-gated. Upstream resolution expected during v1.7.
- **Upstream NUB publish state** — 4 new NUB domains (CLASS, CONNECT, CONFIG, RESOURCE) depend on canonical NUB specs being available in `@napplet/nub`. Verify publish state before locking phase plans; may require coordination with upstream.
- Info-level v1.6 carryover tech debt (non-blocking): pnpm.overrides workaround (SEED-001), type-rename tasks, Electron/Tauri reference impls, multi-OS CI matrix — all deferred to v1.8+.

## Session Continuity

Last session: 2026-04-24T00:00:00.000Z
Resume: v1.7 kicked off. Defining requirements. Next step: research decision, then REQUIREMENTS.md.
