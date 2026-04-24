---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: NIP-5D Spec Adoption & New NUB Domains
status: executing
last_updated: "2026-04-24T14:46:36.953Z"
last_activity: 2026-04-24
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 10
  completed_plans: 9
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-24, v1.7 kicked off)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** Phase 39 — NUB-CONNECT + NUB-CONFIG

## Current Position

Phase: 39 (NUB-CONNECT + NUB-CONFIG) — EXECUTING
Plan: 1 of 5
**Milestone:** v1.7 NIP-5D Spec Adoption & New NUB Domains
**Phase:** 39
**Plan:** Not started
**Status:** Executing Phase 39
**Last activity:** 2026-04-24

Progress: [██████████] 100%

**Phase sequence (37–42):**

| Phase | Name | Key deliverable |
|-------|------|-----------------|
| 37 | SPEC Resync + Foundation Gates | NIP-5D updated; provisional types; 54/0/0 baseline |
| 38 | NUB-CLASS Adoption | Synchronous class posture; enforce.ts pre-filter; cross-NUB invariant spec |
| 39 | NUB-CONNECT + NUB-CONFIG | CSP header authority; consent flow; grants store; config service (9th domain) |
| 40 | NUB-RESOURCE + Demo Napplets + Policy Docs | Resource service (10th domain); 12 napplets; policy dir complete |
| 41 | Polish Wave | nip66 live; wm primitives; CACHE alias |
| 42 | NIP-44 Decrypt (soft-gated) | Single-target decrypt; class-forbidden gate; NIP-44 test vector |

**v1.7 spine (spec-driven):**

- SPEC resync from `dskvr/nips` branch `nip/5d` (class-posture delegation ¶)
- NUB-CLASS adoption — class posture resolved synchronously in `onNip5dIframeCreate`; `enforce.ts` pre-filter; no async `class.assigned` envelope
- NUB-CONNECT adoption — per-napplet CSP `connect-src`; consent flow (dismiss=deny, timeout=deny); `(dTag, aggregateHash)` grant keys; iframe destroy+recreate on revocation; `pnpm audit:csp` CI gate
- NUB-CONFIG reference service (9th domain) — parallel with CONNECT in Phase 39
- NUB-RESOURCE reference service (10th domain) — depends on Phase 39 grants store

**v1.7 carryover / opportunistic:**

- `@kehto/nip66` demo wiring (NIP66-05 follow-up) — Phase 41
- `@kehto/wm` structural primitives (consumers implement concrete layouts) — Phase 41
- CACHE polish (kehto#1 — `HostCacheBridge` naming parity) — Phase 41
- Shell NIP-44 decrypt (kehto#9) — **soft-gated** on napplet/napplet#3 unblock — Phase 42

**Phase numbering:** Phase 37 continues from v1.6's Phase 36.

## Accumulated Context

Full decision log (v1.0 → v1.6) archived in `.planning/PROJECT.md` Key Decisions table (22 entries) and per-milestone archives at `.planning/milestones/v{1.0,1.1,1.2,1.3,1.4,1.5,1.6}-ROADMAP.md`.

**v1.6 shipped (2026-04-23):** 5 phases (32–36), 12 plans, 21/21 requirements, 54/0/0 E2E. NUB dep consolidation onto `@napplet/nub@^0.2.1` subpaths; reserved-chord surface; `@kehto/nip66@0.1.0` publishable package; `@kehto/wm@0.0.0` skeleton; AUTH-probe cleanup.

**v1.7 key decisions carried in:**

- **Breaking API**: `onNip5dIframeCreate` return type expands with `class: string | null` — hyprgate (primary consumer) coordinates in parallel during Phase 38; no dedicated coordination phase.
- **Grants-to-middleware mechanism**: deferred to Phase 39 plan — roadmap does not pre-commit file-based sidecar vs in-memory vs other. Phase 39 plan researches and decides.
- **Provisional type strategy**: one file per unpublished domain (`provisional-class.ts`, `provisional-connect.ts`, `provisional-resource.ts`) in `packages/shell/src/types/`; single atomic bump when all domains publish.
- **NUB-CONNECT production gap**: Vite middleware covers dev + preview; production reverse-proxy is host-app responsibility; documented in SHELL-CONNECT-POLICY.md.
- **Ship-breaking, coord in parallel** (user choice): Phase 38 ships the breaking `onNip5dIframeCreate` change; hyprgate coordinates simultaneously, not sequentially.

### Blockers/Concerns

- **kehto#9 (receive-side NIP-44 decrypt)** — blocks `DECRYPT-01..03` only; soft-gated. Phase 42 executes if napplet/napplet#3 resolves during milestone; slips to v1.8 if not.
- **Upstream NUB publish state** — class and connect subpaths do not exist in `@napplet/nub@0.2.1`; resource exists in napplet/napplet main but unpublished. Provisional local types are the mitigation (Phase 37 establishes them). Single atomic peer-dep bump post-milestone when all three domains publish.
- Info-level v1.6 carryover tech debt (non-blocking): pnpm.overrides workaround (SEED-001), type-rename tasks, Electron/Tauri reference impls, multi-OS CI matrix — all deferred to v1.8+.

## Session Continuity

Last session: 2026-04-24T14:46:36.950Z
Resume: Completed 38-02-PLAN.md. Phase 38 Plan 38-03 (class-invariant.spec.ts) is next.
