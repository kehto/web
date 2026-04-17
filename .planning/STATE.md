---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: — Demo Functional & Playwright Parity
status: executing
stopped_at: Completed 17-02-PLAN.md (register 8 service nodes + topology stub markers)
last_updated: "2026-04-17T23:56:54.974Z"
last_activity: 2026-04-17
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 11
  completed_plans: 5
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-18)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** Phase 17 — Demo App Rewire

## Current Position

Phase: 17 (Demo App Rewire) — EXECUTING
Plan: 2 of 7
Status: Ready to execute
Last activity: 2026-04-17

Progress: [░░░░░░░░░░] 0%

## v1.3 Phase List

| Phase | Name | Requirements |
|-------|------|--------------|
| 16 | Harness Triage & Playwright Infrastructure | E2E-01..05 |
| 17 | Demo App Rewire | DEMO-01..08, E2E-06, E2E-11 (gate) |
| 18 | Napplet SDK Migration | NAP-01..02, E2E-07 (ifc-roundtrip, napplet-auth) |
| 19 | Core-Domain Napplets | NAP-03..05, E2E-07 (relay/storage/notify specs), E2E-08 |
| 20 | Expanded-Domain Napplets | NAP-06..09, E2E-07 (identity/theme/relay-subscribe) |
| 21 | Fixture Napplets & Layer-A Specs | E2E-09 |
| 22 | Docs Refresh & Release Rehearsal | DOCS-01..03, REL-01..04, E2E-10, E2E-11 (closed) |

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v1.3)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*
| Phase 16-harness-triage-playwright-infrastructure P01 | 8 | 2 tasks | 7 files |
| Phase 16 P02 | 2min | 3 tasks | 4 files |
| Phase 16-harness-triage-playwright-infrastructure P03 | 3min | 3 tasks | 3 files |
| Phase 16-harness-triage-playwright-infrastructure P04 | 3min | 3 tasks | 4 files |
| Phase 17-demo-app-rewire P02 | 12min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

- [v1.2] Shell MUST NOT provide `window.nostr` — demo + napplets consume signing via `relay.publish`/`publishEncrypted`; identity reads via `identity.*`.
- [v1.2] `createDispatch()` + `registerNub()` is canonical dispatch; per-runtime instance required.
- [v1.2] `DRIFT-CORE-06` (`packages/runtime/src/core-compat.ts`) stays intact; no new consumers.
- [v1.3] `feed` napplet relay.subscribe delivery mechanism is an open decision — resolve at Phase 20 planning via `/gsd:discuss-phase 20`.
- [Phase 16-01]: All 7 legacy v1.1 signer/AUTH/BusKind specs deleted; BusKind-referencing specs (kind 29003/29004) treated as anti-term violations; each deletion has explicit replacement mapping to a named future phase + REQ-ID
- [Phase 16]: Use preview (not dev) for all E2E webServer commands — dev mode emits aggregateHash='' via @napplet/vite-plugin, poisoning ACL state; both harness and demo use preview for symmetry
- [Phase 16]: Array-form webServer in playwright.config.ts enables single pnpm test:e2e invocation to spin up both harness :4173 and demo :4174 preview servers
- [Phase 16-harness-triage-playwright-infrastructure]: globals.d.ts owns the Window interface — harness.ts uses triple-slash reference instead of inline declare global block
- [Phase 16-harness-triage-playwright-infrastructure]: __getNotifications__ returns [] until Phase 19 wires notification-service state propagation (intentional stub)
- [Phase 16-harness-triage-playwright-infrastructure]: serviceShadow Set is harness-local because runtime.serviceRegistry is not publicly enumerable via the Runtime type
- [Phase 16-04]: waitForNappletReady polls window.__nappletReady__(windowId) — not frameLocator, not DOM sentinel — because the flag encapsulates sessionRegistry acknowledgment (PITFALLS.md Pitfall 1)
- [Phase 16-04]: page.reload() banned in ACL specs; page.goto('/') is the only correct reset that recreates module-level singletons (PITFALLS.md Pitfall 5); ESLint rule enforcement deferred to v1.4
- [Phase 17-demo-app-rewire]: demoServiceNames seeded with 8 domains (including topology-only relay/storage/signer) so topology renders 8 nodes without requiring ServiceHandler registration for those 3 — consistent with D-03/D-04
- [Phase 17-demo-app-rewire]: STUB_ONLY_SERVICES in shell-host.ts drives topology badge rendering — single source of truth avoids duplication between shell-host and topology

### Blockers/Concerns

- `@napplet/core` not on npm — workspace `link:` overrides active; run `pnpm ls @napplet/core --depth 5` before each Playwright run.
- `feed` napplet delivery path (Phase 20) is undecided — must be resolved before Phase 20 executes.

## Session Continuity

Last session: 2026-04-17T23:56:54.971Z
Stopped at: Completed 17-02-PLAN.md (register 8 service nodes + topology stub markers)
Resume: `/gsd:plan-phase 16`
