---
phase: 37
plan: "02"
subsystem: e2e-baseline
tags:
  - iteration-loop
  - E2E-baseline
  - E2E-19
  - 54/0/0
  - phase-close-gate
dependency_graph:
  requires:
    - 37-01 (NIP-5D resync + provisional types landed)
  provides:
    - 37-ITERATION-LOG.md (54/0/0 confirmed for Phase 37)
  affects:
    - Phase 38 (cleared to start — foundation gate passed)
    - Phases 39-42 (unblocked)
tech_stack:
  added: []
  patterns:
    - Canonical v1.6/v1.7 iteration loop: rm -rf chain + pnpm install + pnpm build + pnpm test:e2e
key_files:
  created:
    - .planning/phases/37-spec-resync-foundation-gates/37-ITERATION-LOG.md
  modified: []
decisions:
  - Turbo full cache hit (24/24) is correct and expected — Phase 37 modified no compiled source files (SPEC/README/provisional-types are not tsup inputs)
metrics:
  duration: "~12 minutes (including 10-minute E2E run budget)"
  completed: "2026-04-24"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
  commits: 1
---

# Phase 37 Plan 02: E2E Baseline Preservation Summary

**One-liner:** Canonical iteration loop (rm -rf chain + pnpm install + pnpm build + pnpm test:e2e) executed post-37-01-landing; 54/0/0 confirmed — v1.6 close baseline preserved, Phase 37 E2E-19 gate clears.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Run canonical E2E iteration loop and record 37-ITERATION-LOG.md | (this commit) | .planning/phases/37-spec-resync-foundation-gates/37-ITERATION-LOG.md |

## E2E Result

**54 passed / 0 failed / 0 skipped** (19.9s)

HEAD SHA at loop start: `889d5a0` (`docs(37-01): complete spec-resync + foundation-gates plan — NIP-5D v1.7 + provisional types`)

## Iteration Loop Summary

| Step | Command | Result |
|------|---------|--------|
| Clean | rm -rf chain (node_modules, dist, .turbo) | Complete |
| Install | pnpm install | 323 packages reused, 772ms |
| Build | pnpm build (turbo) | 24 tasks, 24 cached, 43ms |
| Test | pnpm test:e2e | 54 passed (19.9s) |

## Incidental Findings

**Turbo full cache hit (24/24 cached, 43ms build):** Phase 37 modified only `specs/NIP-5D.md`, `README.md`, and three new files in `packages/shell/src/types/provisional-*.ts`. None of these are inputs to any turbo build task (the SPEC is not compiled, the README is not compiled, and provisional type files are not imported by any barrel or consumer). Turbo correctly detected zero build-input drift and replayed all 24 cached tasks. This is correct and expected — it proves no compilable source changed.

**Anti-term sweeps:** Both napplet-source sweep (window.nostr, signer-service, BusKind, AUTH_KIND, kind===290012) and @napplet/nub- sweep in packages/ returned clean. No anti-term regressions introduced by Phase 37 changes.

**Workspace grew to 25 projects:** Install scope shows 25 workspace projects (vs 23 at Phase 33 close) — the two additions (@kehto/nip66 and @kehto/wm) from v1.6 Phases 34/35 are correctly counted. No new additions from Phase 37.

**pnpm install warning (esbuild build scripts):** `Ignored build scripts: esbuild` warning appeared. This is a pre-existing pnpm v10 behavior for `esbuild`'s postinstall scripts — present since Phase 33 and unrelated to Phase 37 changes. Non-blocking.

## E2E Regression Confirmation

No E2E regressions were introduced by Plan 37-01 changes:
- `specs/NIP-5D.md` — documentation only, not a test or build input
- `README.md` — documentation only
- `packages/shell/src/types/provisional-class.ts` — not imported by any consumer
- `packages/shell/src/types/provisional-connect.ts` — not imported by any consumer
- `packages/shell/src/types/provisional-resource.ts` — not imported by any consumer

All 54 specs passed with identical semantics to v1.6 close.

## Phase Close Declaration

Phase 37 is **CLOSED**. All Phase 37 success criteria are satisfied:

1. NIP-5D spec resynced from upstream `dskvr/nips` at commit `d80d7b25` (Plan 37-01)
2. Three provisional type staging files created for NUB-CLASS, NUB-CONNECT, NUB-RESOURCE (Plan 37-01)
3. Canonical iteration loop records 54/0/0 — no regression from spec file update (this plan)

**Phase 38 (NUB-CLASS Adoption) may now start.**

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. This is a gate-confirmation plan with no UI or data-flow deliverables.

## Self-Check: PASSED
