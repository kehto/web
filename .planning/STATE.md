---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: — Downstream Unblock & Shell Service Surface
status: executing
last_updated: "2026-04-23T09:01:46.807Z"
last_activity: 2026-04-23
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 5
  completed_plans: 3
  percent: 60
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-23, v1.6 started)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** Phase 33 — Reserved Chord Surface + E2E-17

## Current Position

Phase: 33 (Reserved Chord Surface + E2E-17) — EXECUTING
Plan: 2 of 3 (33-01 complete; next: 33-02 README docs KEYS-06)
**Milestone:** v1.6 Downstream Unblock & Shell Service Surface
**Phase numbering:** 32 → 36 (continues from v1.5 close at Phase 31; original Phase 33 "Cache Service" dropped 2026-04-23 — see Roadmap Summary note)
**Phase:** 33 (Reserved Chord Surface)
**Plan:** 33-01 complete (KEYS-04, KEYS-05); 33-02 pending (KEYS-06 README); 33-03 pending (E2E-17)
**Status:** Executing Phase 33
**Last activity:** 2026-04-23

Progress: [██████░░░░] 60% (1/5 phases complete; 3/5 plans complete)

## Roadmap Summary

| Phase | Name | REQ-IDs | Criteria |
|-------|------|---------|----------|
| 32 | NUB Dep Consolidation | DEP-01..05 | 5 ✓ Complete |
| 33 | Reserved Chord Surface + E2E-17 | KEYS-04..06, E2E-17 | 5 |
| 34 | `@kehto/nip66` Extract & Publish | NIP66-01..05 | 5 |
| 35 | WM Skeleton + README Cleanup | WM-01..03, DOCS-04..05 | 5 |
| 36 | PERF-01 + Milestone Close E2E-18 | PERF-01, E2E-18 | 5 |

**Scope change (2026-04-23):** Original Phase 33 (Cache Service + HostCacheBridge) dropped. Existing `createCacheService` in `packages/services/src/cache-service.ts` already provides the `hostBridge`-style injection hyprgate#1 asked for — the `CacheServiceOptions` object IS the bridge. Commented on kehto#1 with integration example; issue open for optional future polish (rename → `HostCacheBridge`, v1.7+). CACHE-01..05 moved to Future Requirements. Phases 34-37 renumbered → 33-36.

**Coverage:** 21/21 v1 requirements mapped, zero orphans.
**Execution order:** 32 → 33 → 34 → 35 → 36 (strict numeric; 33-35 are mutually independent once 32 lands).
**E2E target at close:** ≥ 54 passed / 0 failed / 0 skipped (53 baseline + E2E-17 new spec in Phase 33).

## Accumulated Context

Full decision log (v1.0 → v1.5) archived in `.planning/PROJECT.md` Key Decisions table (17 entries) and per-milestone archives at `.planning/milestones/v{1.0,1.1,1.2,1.3,1.4,1.5}-ROADMAP.md`.

### v1.6 scope origin

- **Downstream:** 8 open GitHub issues filed by dskvr during hyprgate v2.0 Kehto Migration gap analysis (kehto#1, #2, #3, #4, #5, #6, #8, #9).
  - v1.6 closes: #2 (Phase 34), #3 (Phase 35), #4 (Phase 32 ✓), #5 (Phase 35), #8 (Phase 33)
  - #1 (Cache hostBridge): **Dropped from v1.6** — existing code already meets the ask; commented on kehto#1 with integration example; kehto-side tracker for optional v1.7+ polish
  - #6: tracking-only
  - #9: upstream-first (cross-linked to napplet/napplet#3)
- **Carryover:** PERF-01 from v1.5 (chat boot storage.get storm).
- **Explicitly deferred to v1.7:** NIP-5D spec resync, NUB-CLASS, NUB-CONNECT, NUB-CONFIG, NUB-RESOURCE, CACHE polish (naming parity). v1.7 is the spec-alignment milestone for @napplet v0.29.0.

### Phase dependency structure

- **Phase 32 is the keystone** — DEP migration is lockfile-wide and every subsequent phase lands on the consolidated `@napplet/nub` subpath surface. Phases 33-35 can be planned concurrently post-32 (all three carry the `Depends on: Phase 32` constraint and nothing else beyond it).
- **Phase 36 is the milestone close** — depends on 32, 33, 34, 35. PERF-01 lands here alongside E2E-18 (milestone iteration loop) so the anti-term sweep runs against the full v1.6 delta in one pass.
- **Only new Playwright spec in v1.6 is E2E-17** (Phase 33, reserved-chord contract). Expected baseline delta: 53 → 54.

### Blockers/Concerns

- **PERF-01 measurement (Phase 36):** no baseline number yet; v1.5 audit described "18+ serial round-trips" but did not record wall-clock. Phase plan will need to define pass/fail threshold via pre-fix instrumentation recorded in `36-ITERATION-LOG.md`.
- **KEYS-04 design decision (Phase 33):** `reservedChords` service option vs `HostKeysBridge.reserveAbsolute()` extension is deferred to the plan phase — both shapes are acceptable contracts per the requirement; pick one and document the reasoning in the plan.
- **@kehto/nip66 relay-pool shape (Phase 34):** the injected relay-pool handle contract is not fully specified; reference patterns exist in hyprgate's `nip66-monitor.ts` and nadar — plan phase will pin the interface.

## Session Continuity

Last session: 2026-04-23T09:01:46.805Z
Resume: Phase 32 COMPLETE. All 5 DEP REQ-IDs satisfied. Commits: bb1061e (32-01 atomic migration), 5adeb52 (32-02 changesets), a4d0652 (32-02 iteration loop + Rule 1 subpath-variant fix). Canonical fresh-install iteration loop reports 53/0/0 (18.3s, baseline preserved from v1.5 close); zero dual-instance warnings in build+E2E logs; 4 @kehto/* changesets staged with minor bump and inline pnpm.overrides advisory. Original Phase 33 (Cache Service + HostCacheBridge) dropped mid-milestone — scoping found existing `createCacheService` already supports the hostBridge-style injection; commented on kehto#1 with integration example. Phases 34-37 renumbered → 33-36. Next: plan Phase 33 (Reserved Chord Surface + E2E-17, KEYS-04..06 + E2E-17).

## Decisions

- **2026-04-23:** Added pnpm.overrides `@napplet/nub>@napplet/core: ^0.2.1` at workspace root. @napplet/nub@0.2.1 tarball shipped with unresolved `workspace:*` specifier — publish-time rewrite did not fire. Override pins transitive to published core ^0.2.1. Extends Decision #11 (pnpm.overrides for @napplet/core dedup, v1.3) one hop deeper. Remove when upstream re-publishes.
- **2026-04-23:** CHANGELOG.md scope exclusion for anti-term sweep. 4 CHANGELOG.md files carry 5 `@napplet/nub-*` substring occurrences in historical release-note entries. Preserved unchanged — rewriting would falsify package history. Mirrors plan's @napplet/sdk transitive-residue exclusion. Plan 32-02 anti-term verification sweeps use `| grep -v CHANGELOG.md` filter.
- **2026-04-23:** Comment-prose scope extension for Plan 32-01. Plan Parts C+D enumerated 4 files; pre-flight surfaced 13 more source/test/doc files carrying `@napplet/nub-<domain>` substrings in JSDoc, comments, inline prose, and 2 regex test patterns. All rewritten in the same atomic commit (bb1061e) per plan's own pre-flight instruction ("append to file list and Part D rewrite list before proceeding"). Scope-aligned, not scope-expanded.
- **2026-04-23:** Changeset prose for Phase 32 (4 files) includes the `pnpm.overrides @napplet/nub>@napplet/core: ^0.2.1` workaround inline as a downstream consumer advisory, not just as a TODO. Shells pulling the next @kehto/*@0.3.0 releases will hit the same upstream @napplet/nub@0.2.1 workspace:* publish bug Plan 32-01 hit; documenting the workaround inline avoids forcing downstream to rediscover it. Remove when upstream re-publishes.
- **2026-04-23:** Subpath-variant selection rule (Plan 32-02 Rule 1 auto-fix). For non-type imports from `@napplet/nub/<domain>` when `@napplet/shim` is loaded: use the `/<domain>/sdk` subpath (no side effects — pure re-exports). The root `/<domain>` subpath calls `registerNub(DOMAIN, ...)` at module-init time, which collides with `@napplet/shim`'s own `registerNub` and throws "NUB domain X is already registered". Standalone SDK consumers (no shim) can use the root subpath. `/types` is type-only and never a concern. This rule applied to `apps/demo/napplets/media-controller/src/main.ts`; captured in 32-02 SUMMARY `patterns-established` for future migrations.
- **2026-04-23:** Turbo-cache purge before evidenced builds (Plan 32-02 pattern). Fresh-install iteration loops now explicitly `rm -rf .turbo packages/*/.turbo apps/demo/.turbo apps/demo/napplets/*/.turbo tests/e2e/harness/.turbo` before `pnpm build` to force every task uncached. Guards against the failure mode where turbo replays a cached task and hides a new regression. Plan 32-02 showed `Cached: 0 cached, 22 total` — every task executed cold.
- [Phase 33]: Canonical reserved-chord key format: pipe-delimited <ctrl>|<alt>|<shift>|<meta>|<KEY>. Three helpers (chordSpecKey/forwardKey/eventKey) emit the same shape so wire/DOM/ChordSpec comparisons fold into one Set lookup. Chosen over JSON.stringify for deterministic cross-engine ordering (Plan 33-01).
- [Phase 33]: Two-pass keydown listener shape (Plan 33-01 Edit 5). Fires onForward ONCE per keydown when isReserved || anyMatch — correctly handles the WM-launcher case where a reserved chord has zero napplet registrations (onForward must still fire for WM dispatch). Zero regression on pre-existing 'fires onForward AND pushes keys.action envelope' test because a single registered action fires onForward exactly once under both shapes.
- [Phase 33]: Version-pin RED assertion (Plan 33-01 TDD). Each of the 6 new reserved-chord tests asserts service.descriptor.version === '1.2.0'. Gives 6 clean failing tests in RED (all fail on '1.1.0' !== '1.2.0') and couples version bump to feature landing. Reusable pattern for future service-level minor bumps.
