---
gsd_state_version: 1.0
milestone: v1.21
milestone_name: "NIP-5D #2303 + NAP-SHELL/INTENT Conformance"
status: Phase 88 plan 88-01 executed — playground + fixtures migrated to @napplet/nap (inc/naps); build 24/24 + type-check 13/13 green
stopped_at: Completed 88-01-PLAN.md (TERM-02/03/05); 88-02 (inc-roundtrip + naps-path e2e) pending
last_updated: "2026-06-17T00:00:00.000Z"
last_activity: 2026-06-17 — executed 88-01 (@napplet/nub→@napplet/nap migration + ifc→inc + shim 0.13 owns supports)
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 8
  completed_plans: 3
  percent: 38
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-15)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** v1.21 roadmapped — Phases 86–89 defined; next: plan Phase 86 (NAP-SHELL handshake correctness)

## Current Position

Phase: 88 — Terminology / Playground Modern Path (in progress)
Plan: 88-01 — complete (TERM-02 + TERM-03 + TERM-05); 88-02 pending
Status: Phase 88 plan 88-01 executed — playground + fixtures on @napplet/nap (inc/naps); build 24/24 + type-check 13/13 green
Last activity: 2026-06-17 — executed 88-01 (@napplet/nub→@napplet/nap migration + ifc→inc + shim 0.13 owns supports)

## Performance Metrics

**Velocity:**

- Total plans completed: 1
- Average duration: ~6m
- Total execution time: ~6 minutes

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 86 | 1 | ~6m | ~6m |
| 87 | TBD | - | - |
| 88 | 1 | ~18m | ~18m |
| 89 | TBD | - | - |

## Accumulated Context

Full decision log lives in `.planning/PROJECT.md` Key Decisions table.

### Key Context for v1.21 (Phases 86–89)

Authoritative: `nostr-protocol/nips` PR #2303 (`5D.md`) + `napplet/naps` registry (NAP-SHELL + NAP-INTENT merged). Full audit: `.planning/NIP-5D-2303-DELTA-AUDIT.md` (G1–G8).

- **Phase 86 (G1/G2)** — SHELL-01/02: `handleShellReady` calls `postShellInit` unconditionally (`packages/shell/src/shell-ready.ts:15-24`); add a per-windowId "init already sent" guard. `class` wire type is `string|null` (`packages/runtime/src/types.ts:20`, emitted `shell-ready.ts:104-113`) — map to opaque `number|null`, keep internal string label.
- **Phase 87 (G3/G4)** — ARCH-01..04: parse `["archetype","<slug>","<NAP-N>"]` + optional `source` in `packages/nip/src/5d/index.ts` (parse at ~128-151); add `archetypes` to `NappletManifest`. Add manifest→`IntentCatalogEntry` adapter (consumed by `packages/services/src/catalog-intent-resolver.ts:49-56`). Wire playground catalog from resolved manifests; add 1 archetype-tagged napplet + intent dispatch e2e.
- **Phase 88 (G5/G6)** — TERM-01..05: `nap:` primary, `nub:` alias (`specs/NIP-5D.md:124`, `packages/shell/tests/perm-namespace.test.ts:120`). Migrate bot/chat/feed/profile-viewer `ifc`→`inc`. Bootstrap (`shared-vite-config.ts:48`) + `getMissingRequiredNaps` (`demo-hooks.ts:303-307`) read `naps`, fallback `nubs`. Conformance e2e for `naps`-only path.
- **Phase 89 (G7/G8)** — DOCS-01..04 + VERIFY-01: repin `specs/NIP-5D.md` to #2303 + NAP terms + archetype/source; local NAP-SHELL/NAP-INTENT mirrors; `RUNTIME-SPEC.md` refresh; comment sweep (keep `@napplet/nub` import specifier); verify unknown-`type` silent-ignore uniformity (NAP-INTENT `.result`/`.error` is sanctioned). Full suite green + changesets.

**Hard constraints (every phase):**

- Installed `@napplet/shim` is **0.5.0** (reads `capabilities.nubs`) → KEEP `naps`+`nubs` dual-emit; do NOT run CLEANUP-01.
- CI e2e runs `workers:1`; reload-heavy specs need `test.setTimeout(120000)`.
- Playground napplet / `DEMO_CAPABILITIES` counts asserted by multiple e2e specs — update in lockstep.
- v1.20 content-addressed internals already aligned — regression-guard only, do not change.
- `turbo.json globalDependencies` must include `shared-vite-config`; resolution sim must stay crash-proof; NIP-5A vector pinned.
- Branch `milestone/v1.21-nip5d-2303-nap-conformance` (off `feat/nip5d-runtime-srcdoc`); never push `main`.

### Blockers/Concerns

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260616-8iv | Move playground theme-switcher functionality from napplet into host theme-service node | 2026-06-16 | f4358b4 | [260616-8iv-move-playground-theme-switcher-functiona](./quick/260616-8iv-move-playground-theme-switcher-functiona/) |

## Session Continuity

Last session: 2026-06-17T02:10:54.358Z
Stopped at: v1.21 roadmap created — Phases 86–89 defined, 16 requirements mapped
Resume file: None

## Operator Next Steps

- Run `/gsd:plan-phase 86` to decompose Phase 86 (NAP-SHELL handshake correctness) into executable plans.
