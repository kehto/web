---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: — Downstream Unblock & Shell Service Surface
status: planning
last_updated: "2026-04-23T10:08:17.879Z"
last_activity: 2026-04-23
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 8
  completed_plans: 8
  percent: 60
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-23, v1.6 started)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** Phase 35 — WM Skeleton + README Cleanup (next, post Phase 34 close)

## Current Position

Phase: 34 (@kehto/nip66 Extract & Publish) — **COMPLETE** (3/3 plans, all NIP66-01..05 closed, artifact-complete at 54/0/0 E2E preserved)
Plan: 3 of 3 complete (34-01 ✓, 34-02 ✓, 34-03 ✓)
**Milestone:** v1.6 Downstream Unblock & Shell Service Surface
**Phase numbering:** 32 → 36 (continues from v1.5 close at Phase 31; original Phase 33 "Cache Service" dropped 2026-04-23 — see Roadmap Summary note)
**Phase:** 34 (complete); Phase 35 next
**Plan:** — (Phase 34 complete; Phase 35 plans not yet drafted)
**Next Phase:** 35 (`WM Skeleton + README Cleanup` — WM-01..03, DOCS-04..05)
**Status:** Phase 34 complete; ready for Phase 35 planning
**Last activity:** 2026-04-23

Progress: [██████░░░░] 60% (3/5 phases complete; 8/8 plans-through-Phase-34 complete — Phases 35+36 add plan count as those phases are drafted)

## Roadmap Summary

| Phase | Name | REQ-IDs | Criteria |
|-------|------|---------|----------|
| 32 | NUB Dep Consolidation | DEP-01..05 | 5 ✓ Complete |
| 33 | Reserved Chord Surface + E2E-17 | KEYS-04..06, E2E-17 | 4 ✓ Complete |
| 34 | `@kehto/nip66` Extract & Publish | NIP66-01..05 | 5 ✓ Complete |
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

Last session: 2026-04-23T10:07:10.056Z
Resume: **Phase 34 COMPLETE — @kehto/nip66@0.1.0 shipped publish-shape at 54/0/0.** Plan 34-03 landed two docs commits: b97a3cf (README + changeset — 194-line consumer doc with H1 + 7 H2 sections; .changeset/v1-6-nip66.md frontmatter 'minor' cites NIP66-01..05 + kehto#2) + f2b68c7 (248-line iteration log recording fresh-install loop: 24 workspace projects, 23/23 turbo tasks, 495/495 unit tests, 54 passed Playwright at 17.8s — delta 0 from Phase 33 close, exactly per NIP66-05 publish-only contract). NIP66-04 + NIP66-05 closed; Phase 34 artifact-complete at 5/5 REQ-IDs. Framework-agnostic discipline enforced via periphrasis — README + changeset describe the property without literal '@napplet/core' or '@napplet/nub' strings; first-draft verify caught 3 occurrences and reworded pre-commit to 'napplet protocol packages' / 'protocol-package peer deps'. Iteration log explicitly captures the pnpm --filter @kehto/nip66 test quirk (exit-non-zero due to vitest include-glob cwd semantics) as a footnote not a failure; records equivalent root-cwd invocation at 9/9 green. Anti-term sweep 6/6 clean on packages/nip66/. Demo-wiring guard 0/0 clean (NIP66-05 explicitly defers demo wiring to v1.7+). Publish to npm is deferred to Phase 36 (milestone close) alongside the other v1.6 @kehto/* minor bumps via `changeset version` + `changeset publish`. v1.6 progress: 13/21 reqs (3/5 phases) complete; next is Phase 35 (WM-01..03 + DOCS-04..05).

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
- [Phase 33]: README sub-section placement inside Keys H2 scope (Plan 33-02). `### Reserved Chords` inserted BEFORE `## Media Service` H2 so reserved-chord docs live adjacent to the rest of the keys surface (Factory, KeysServiceOptions, HostKeysBridge, Usage, When to plug a custom bridge). Rejected placement after Media Service (would orphan keys-scope content) and new top-level H2 (would break the established `## X Service` rhythm per NUB domain). Reusable pattern for future option additions within existing H2 scopes.
- [Phase 33]: Shell-side DOM sentinel pattern for E2E observation (Plan 33-02). Parent-frame element (document.body, not iframe) with id + data-testid attributes, `pointer-events: none`, updated inside service callback. Playwright reads via `page.locator()` without `frameLocator()` round-trip. Canonical chord-string format (Ctrl/Alt/Shift/Meta + uppercased single-char key, plus-delimited) matches exactly what parseChord → chordSpecKey reconstructs — load-bearing for spec's toHaveText assertion. Reusable for future service surfaces needing shell-side observation (reserved-intent on media/theme, e.g.).
- [Phase 33]: Ctrl+Shift+R chosen as demo-reserved chord (Plan 33-02). Non-colliding with hotkey-chord's Ctrl+Shift+K registration (preserves E2E-12), disjoint from every existing demo-source occurrence (grep -rn returns only the new declaration). Noted browser-default-hotkey consideration: Ctrl+Shift+R is "hard refresh" in most browsers, but Playwright's page.keyboard.press dispatches to document listener before browser chrome consumes it, and the reservation gate short-circuits before any napplet or browser default action. 33-03 spec writer should be aware but no action needed.
- [Phase 33]: Spec isolation run BEFORE full-suite iteration (Plan 33-03) — 971ms per-test confidence check proves 8-step spec executes cleanly without retry pressure before committing to the 6-phase fresh-install loop. Mirror of Plan 26-04's spec-isolation discipline. Gives early signal on structural issues.
- [Phase 33]: 8-step precedence+regression spec shape (Plan 33-03) — Steps 4+5 (shell sentinel fires AND napplet sentinels unchanged) prove the precedence gate; Steps 6+7 (non-reserved press increments napplet counter AND shell sentinel overwrites) prove the regression gate. Single spec asserts both positive and negative outcomes of the reserved > registered contract without scope-creep. Reusable pattern for future reserved-intent surfaces on media/theme/notify.
- [Phase 33]: Anti-term enforcement-prose distinction (Plan 33-03) — napplet source grep returns 5 apparent matches, all in JSDoc prose asserting ABSENCE of anti-terms ('no BusKind, no window.nostr'). Stricter sweep with '*'-leading comment-line exclusion returns 0. Iteration log documents both counts explicitly. Matches Phase 32 baseline behavior where the same comments were treated as clean. Not a regression.
- [Phase 34]: [Phase 34]: Stub-first scaffolding discipline (Plan 34-01) — new @kehto/nip66 package ships locked 5-symbol public API (Nip66RelayPool, Nip66Filter, Nip66AggregatorOptions, Nip66Aggregator, createNip66Aggregator) with factory throwing 'not implemented — see Plan 34-02'. Decouples workspace scaffolding risk (tsconfig, tsup, turbo pickup) from code-port risk (processEvent/parseNipSupport/closure state). Build floor stays green through Plan 34-02 impl. Reusable pattern for future new-workspace extractions.
- [Phase 34]: [Phase 34]: Framework-agnostic util manifest (Plan 34-01) — @kehto/nip66 is the first kehto package with nostr-tools as sole peer dep and zero @napplet/* footprint. Encodes CONTEXT.md Decision §NIP66-03 ('not a NUB, framework-agnostic util') in package.json. Both 'test' and 'test:unit' script aliases route to root vitest.config.ts so quality-gate invocation 'pnpm --filter @kehto/nip66 test' resolves without a second install. Precedent for future kehto framework-agnostic utils.
- [Phase 34]: [Phase 34]: Type-only NostrEvent import under verbatimModuleSyntax (Plan 34-01) — 'import type { NostrEvent } from nostr-tools' is load-bearing: without 'type' keyword tsup emits runtime import that breaks when consumers don't ship nostr-tools at runtime. Type-only imports are fully erased, keeping dist/index.js at 213B (stub body only). Reusable pattern for any kehto package with type-only peer-dep imports.
- [Phase 34]: parseNipSupport inlined into processEvent in closure-scoped port (Plan 34-02). Hyprgate split them because each helper mutates a separate module-scope Map; in the closure form both Sets/Maps share the factory scope, so a single combined helper is clearer + marginally faster (one tag.find for d-tag instead of two). CONTEXT.md Claude's Discretion authorizes inline. Public API unchanged.
- [Phase 34]: Closure-scoped factory state pattern locked (Plan 34-02). Multi-instance isolation test (Test 9) proves relaySet + relaySupportedNips + unsubscribe handle all live inside factory scope. Zero module-level state (grep -c ^const nip66RelaySet == 0). Reusable pattern for future framework-agnostic kehto factory utils.
- [Phase 34]: TDD RED → GREEN commit discipline for Plan 34-02: two separate commits (56b5d47 test RED, e52ab5a feat GREEN) instead of one consolidated. Bisect-clean history + reviewable RED→GREEN transition via git log --oneline. Applicable to any future TDD plan with tdd=true tasks.
- [Phase 34-kehto-nip66-extract-publish]: Framework-agnostic discipline enforced on docs via periphrasis (Plan 34-03). README + changeset describe @kehto/nip66's framework-agnostic property without using literal '@napplet/core' or '@napplet/nub' strings — phrased as 'napplet protocol packages' / 'protocol-package peer deps'. Satisfies plan's grep-guard acceptance criterion while preserving semantic content. Reusable pattern for future kehto docs asserting absence of napplet deps.
- [Phase 34-kehto-nip66-extract-publish]: Publish-only phase closure discipline (Plan 34-03 iteration log). Log explicitly records 'delta 0 from Phase 33 close' and ties it to NIP66-05's publish-only contract. Distinguishes 'no regression' from 'no work done' — phase ships workspace + impl + docs + changeset, but E2E dimension is deliberately unchanged. Reusable pattern for future publish-only phases (changeset-only milestone-close work).
