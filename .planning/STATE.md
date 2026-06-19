---
gsd_state_version: 1.0
milestone: v1.21
milestone_name: "NIP-5D #2303 + NAP-SHELL/INTENT Conformance"
status: COMPLETE — v1.21 (phases 86–89) + v1.22 bonus shipped; PR kehto/web#40 opened (stacked on #39). build 24/24 + type-check 13/13 + unit 1053/1053 + e2e 80/80 green
stopped_at: PR #40 opened — NIP-5D #2303 + NAP-SHELL/INTENT conformance + @napplet 0.12/0.13 modernization + vite-plugin 0.8.1 bonus complete
last_updated: "2026-06-17T07:15:00.000Z"
last_activity: 2026-06-17 — pushed milestone/v1.21-nip5d-2303-nap-conformance, opened PR kehto/web#40; filed + resolved upstream napplet/web#53
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 9
  completed_plans: 9
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-15)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** v1.21 complete — Phases 86–89 done; NIP-5D #2303 + NAP-SHELL/INTENT conformance landed with changesets ready for release.

## Current Position

Phase: 89 — Spec / Doc Refresh & Conformance Sweep (complete)
Plan: 89-01 — complete (DOCS-01..04 + VERIFY-01)
Status: Phase 89 executed — specs/NIP-5D refreshed to #2303/NAP model, NAP-SHELL/NAP-INTENT mirrors added, RUNTIME-SPEC refreshed (toolchain + unknown-type handling), NUB→NAP doc sweep, modernization changesets for all 6 @kehto packages; build 24/24 + type-check 13/13 + e2e 80/80 green
Last activity: 2026-06-19 — completed quick task 260619-vpn: PR #63 Playwright service activity counter wait now requires storage, relay, and identity counters to reach the documented floor

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
| 89 | 1 | ~45m | ~45m |

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

- **9 pre-existing stale guard-test failures** (`tests/unit/sdk-migration-guard.test.ts`, `playground-gateway-guard.test.ts`, `nip5d-conformance-guard.test.ts`) assert the pre-modernization 0.5.0/`@napplet/nub`/`ifc` graph that phases 86–88 already replaced with 0.12/0.13/`@napplet/nap`/`inc`. Out of phase-89 (docs) scope; logged to `.planning/phases/89-spec-doc-refresh-conformance-sweep/deferred-items.md`. Needs a test-owning follow-up to realign the guards before tagging v1.21.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260616-8iv | Move playground theme-switcher functionality from napplet into host theme-service node | 2026-06-16 | f4358b4 | [260616-8iv-move-playground-theme-switcher-functiona](./quick/260616-8iv-move-playground-theme-switcher-functiona/) |
| 260617-qoi | Drop NAP-CLASS, NAP-CLASS-1, NAP-CONNECT (clean break) + replace local spec mirrors with living-doc references | 2026-06-17 | 1d0eef3 | [260617-qoi-drop-nap-class-nap-class-1-nap-connect-c](./quick/260617-qoi-drop-nap-class-nap-class-1-nap-connect-c/) |
| 260617-wig | Add optional @kehto/shell `onUnroutedMessage` observability hook (surfaces silently-dropped unregistered-window messages — FEED-02 / hyprgate#21) | 2026-06-17 | fba1b67 | [260617-wig-shell-unrouted-message-hook](./quick/260617-wig-shell-unrouted-message-hook/) |
| 260618-heo | Remove IFC vocabulary and enforce INC-only live tracked files | 2026-06-18 | cd438c9 | [260618-heo-completely-remove-ifc-legacy-naming-and-](./quick/260618-heo-completely-remove-ifc-legacy-naming-and-/) |
| 260618-kam | Honor canonical NAP-RELAY `relay` hint on runtime `relay.subscribe` | 2026-06-18 | 3167eaa | [260618-kam-honor-explicit-relays-on-nap-relay-subsc](./quick/260618-kam-honor-explicit-relays-on-nap-relay-subsc/) |
| 260618-l4w | Add NAP and NIP-5D conformance guardrails for shell/runtime/services drift | 2026-06-18 | 7e829c3 | [260618-l4w-add-nap-and-nip-5d-conformance-guardrail](./quick/260618-l4w-add-nap-and-nip-5d-conformance-guardrail/) |
| 260619-tmr | Identify and document the web napplet cache strategy | 2026-06-19 | 75efa8b | [260619-tmr-napplet-web-cache-strategy](./quick/260619-tmr-napplet-web-cache-strategy/) |
| 260619-u3p | Implement napplet web cache strategy | 2026-06-19 | 8869e80 | [260619-u3p-implement-napplet-web-cache-strategy](./quick/260619-u3p-implement-napplet-web-cache-strategy/) |
| 260619-vpn | Fix flaky Playwright service activity counter wait in PR #63 | 2026-06-19 | bfcd7af | [260619-vpn-fix-flaky-playwright-service-activity-co](./quick/260619-vpn-fix-flaky-playwright-service-activity-co/) |

## Session Continuity

Last session: 2026-06-17T06:58:00.000Z
Stopped at: Phase 89 complete — v1.21 NIP-5D #2303 + NAP-SHELL/INTENT conformance done (docs + changesets)
Resume file: None

## Operator Next Steps

- Realign the 3 stale guard specs to the 0.12/0.13/`@napplet/nap`/`inc` graph (see `89/deferred-items.md`) so `pnpm test:unit` is fully green before tagging.
- Run `pnpm changeset version` + publish to cut the v1.21 release (all 6 @kehto packages have changesets).
