---
gsd_state_version: 1.0
milestone: v1.15
milestone_name: Address AI Slop
status: complete
last_updated: "2026-05-24T11:19:48.700Z"
last_activity: 2026-05-24
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 4
  completed_plans: 4
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-24, v1.15 started)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** v1.15 Address AI Slop quality-gate repair complete

## Current Position

Phase: —
Plan: —
Status: v1.15 complete; ready for next milestone selection
Last activity: 2026-05-24 — Phase 71 completed and v1.15 audited

## Accumulated Context

Full decision log (v1.0 → v1.13) lives in `.planning/PROJECT.md` Key Decisions table and per-milestone archives under `.planning/milestones/`.

### v1.8 Phase Sequence

- **Phase 42** (ungated): BUG-01/02 + POLISH-01 + RENAME-01/02 — 5 reqs
- **Phase 43** (ungated): VALIDATE-01 — 1 req
- **Phase 44** (completed 2026-05-21): DEP-01..07 + VALIDATOR-01/02 — 9 reqs
- **Phase 45** (completed 2026-05-21): DECRYPT-01..07 — 7 reqs
- **Phase 46** (completed 2026-05-21): DECRYPT-08..10 + E2E-27/28 — 5 reqs

### Blockers/Concerns

- No active blockers. v1.15 starts from the `aislop 0.9.3` report: 38 errors, 607 warnings, 461 fixable findings across 123 scanned TypeScript files.
- v1.15 roadmap phases are 68-71: gate baseline/mechanical cleanup, safe DOM rendering/security scanner cleanup, type/dependency/maintainability triage, then quality-gate verification and closeout.
- Phase 68 completed 2026-05-24: supplied `aislop 0.9.3` baseline recorded, local `aislop` binary absence documented, the fatal undeclared `@napplet/services` reference corrected, report-flagged duplicate imports and mechanical lint/slop findings cleaned in touched files, and verification passed with `pnpm build`, `pnpm type-check`, and `git diff --check`.
- Phase 69 completed 2026-05-24: direct `.innerHTML =` assignment sinks were removed from playground source and napplet source, a DOM safety guard was added, the NIP-46 hardcoded-token-looking example was reworded, and verification passed with focused render tests, `pnpm type-check`, `pnpm build`, `pnpm test:unit` (563 tests), and `git diff --check`.
- Phase 70 completed 2026-05-24: runtime/services message-boundary casts were narrowed, runtime double assertions were reduced, private thin wrappers were inlined, napplet `supports()` double casts were removed, safe dependency audit paths were upgraded, and remaining VitePress Vite/esbuild advisories were explicitly deferred with rationale.
- Phase 71 completed 2026-05-24: final fatal-category source guards passed, build/type/unit/static/docs/Pages gates passed, `gsd-sdk query audit-open` reported zero open items, and v1.15 milestone audit passed at 20/20 requirements across 4/4 phases.
- v1.14 started 2026-05-23: public GitHub Pages deployment target is `kehto.github.io/web/`, with a portal slash page at `/web/`, playground at `/web/playground/`, and docs at `/web/docs/`. Current workflow only packs `.pages/playground`, so v1.14 must replace playground-only upload with a unified Pages artifact.
- v1.14 roadmap phases are 65-67: Pages portal entry point, playground Pages path relocation, then docs Pages publication and deploy gate.
- Phase 65 completed 2026-05-23: `web/index.html` is the static portal source, `pnpm build:pages` writes `.pages/web/index.html`, and the generated portal links to `/web/playground/` and `/web/docs/`.
- Phase 66 completed 2026-05-23: `scripts/build-playground-pages.mjs` writes `.pages/web/playground`, defaults to `/web/playground/`, and generated gateway manifest `htmlUrl` values now point under `/web/playground/napplet-gateway/`.
- Phase 67 completed 2026-05-23: docs publish under `.pages/web/docs`, generated TypeDoc output is copied to `.pages/web/docs/api`, the Pages workflow uploads `.pages`, and `pnpm audit:pages` verifies the `/web/` route contract before deploy.
- v1.14 archived 2026-05-23: public `/web/` portal, playground `/web/playground/`, docs `/web/docs/`, unified Pages artifact, and `pnpm audit:pages` deploy gate are shipped. Final verification passed: docs check, playground build, Pages artifact build/audit, focused route guard, full build/type/unit, gateway artifact audit, diff check, and open-artifact audit.
- v1.10 shipped: removed the stale `auth:identity-changed` compatibility branch, migrated `decrypt-demo` to `identityDecrypt`, and retired the remaining old demo package graph.
- Published package check: `@napplet/sdk@0.3.0`, `@napplet/shim@0.3.0`, and `@napplet/vite-plugin@0.3.0` are all available on npm as of 2026-05-22.
- Scope boundary: keep v1.10 as a v1 cleanup/continuity milestone; do not promote the compatibility removal to a v2 boundary.
- Phase 47 completed 2026-05-22: all 18 target manifests now declare exact `@napplet/sdk`, `@napplet/shim`, `@napplet/vite-plugin`, and explicit `@napplet/nub` at `0.3.0`; IFC/storage call sites use direct helper imports; six affected napplet builds pass.
- Phase 48 completed 2026-05-22: active demo/fixture source has no `@napplet/sdk` imports; relay, identity, keys, notify, config, and media use direct helpers; toaster/resource retained raw exceptions documented as `NOTIFY-SDK-GAP` and `RESOURCE-SDK-GAP`.
- Phase 49 completed 2026-05-22: migration guard added to `pnpm test:unit`; active lockfile graph has 18 clean importers and zero old SDK graph offenders; `pnpm type-check`, `pnpm test:unit`, and `pnpm test:e2e` pass with Playwright at 86/86.
- v1.9 archived 2026-05-22: roadmap, requirements, phase artifacts, and milestone audit are stored under `.planning/milestones/v1.9-*`.
- v1.10 archived 2026-05-22: identity topic compatibility removed, decrypt-demo uses `identityDecrypt`, guard coverage closes the old helper graph, and verification closes at 548 unit tests plus 86/86 Playwright.
- v1.11 started 2026-05-22: local playground and E2E loading must match the production NIP-5D/NIP-5A gateway path. The milestone aligns single-file artifact generation, aggregate-hash semantics, playground loading, static guards, and Playwright proof around that continuity invariant.
- v1.11 completed 2026-05-22: `@napplet/vite-plugin` supports explicit single-file artifact mode, playground napplets load through `/napplet-gateway/<dTag>/<aggregateHash>/index.html`, and drift is guarded by unit, audit, and Playwright coverage. Final verification: `pnpm build`, `pnpm type-check`, `pnpm test:unit` (551 tests), `pnpm audit:csp`, `pnpm audit:gateway-artifacts`, and `pnpm test:e2e` (87/87).
- v1.12 started 2026-05-22: authoritative NIP-5D source is the pinned raw `dskvr/nips` commit `d80d7b25f9c4331acbeb40dbeb3b077caa80e885`; `.planning/NIP-5D-DELTA-AUDIT.md` is the delta inventory; `RUNTIME-SPEC.md` and `napplet/specs/NIP-5D.md` are drift sources to repair or replace.
- v1.12 roadmap phases are 56-59: contract/package source baseline, shell capability/requires enforcement, 13-napplet conformance, then guards/full verification.
- Phase 58 completed 2026-05-22: all 13 playground napplets now declare manifest `requires`, preflight required NUBs with shell-derived `supports()`, stale protocol auth wording is renamed, and raw demo envelopes are documented in the Phase 58 allowlist.
- Phase 59 completed 2026-05-22: static/unit/E2E guards now cover sandbox policy, source validation, no napplet `window.nostr`, requires coverage, hosted `supports()` behavior, raw-envelope exceptions, unsupported-requires rejection, and all 13 gateway-hosted napplet contracts. Final verification passed: `pnpm build`, `pnpm type-check`, `pnpm test:unit` (560 tests), `pnpm audit:csp`, `pnpm audit:gateway-artifacts`, and `pnpm test:e2e` (89/89).
- v1.13 completed 2026-05-23: docs strategy, package docs, tutorials/how-tos, VitePress site, generated API integration, and strict docs quality gates are shipped. Final verification passed: `pnpm docs:check`, `pnpm build`, `pnpm type-check`, `pnpm test:unit` (562 tests), `pnpm audit:csp`, `pnpm audit:gateway-artifacts`, and `git diff --check`.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260522-kvd | Remove old inter-frame terminology | 2026-05-22 | b844b25 | [260522-kvd-replace-old-interframe-terminology](./quick/260522-kvd-replace-old-interframe-terminology/) |
| 260522-lb0 | Determine vite-single-file playground napplet validity | 2026-05-22 | 8d763b5 | [260522-lb0-determine-validity-of-building-napplets-](./quick/260522-lb0-determine-validity-of-building-napplets-/) |
| 260523-h64 | Use published @napplet packages and remove submodules | 2026-05-23 | 32cc987, 791a2f9 | [260523-h64-use-published-napplet-packages-and-remov](./quick/260523-h64-use-published-napplet-packages-and-remov/) |
| 260523-ikp | Separate runtime demo surfaces from napplet cards | 2026-05-23 | 24af3d4, 91f8fb3 | [260523-ikp-runtime-helper-panes-should-not-be-label](./quick/260523-ikp-runtime-helper-panes-should-not-be-label/) |
| 260523-jev | Publish playground to GitHub Pages | 2026-05-23 | c89e746 | [260523-jev-create-a-workflow-that-publishes-the-pla](./quick/260523-jev-create-a-workflow-that-publishes-the-pla/) |
| 260523-alpha | Clarify alpha runtime positioning | 2026-05-23 | b0de00d | README/docs/splash |

## Session Continuity

Last session: 2026-05-23T16:10:00Z
Resume: v1.15 Address AI Slop is complete and audited.
Current milestone: none active.

## Operator Next Steps

- Start the next milestone with `$gsd-new-milestone` when ready.
