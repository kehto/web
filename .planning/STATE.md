---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: — Demo Functional & Playwright Parity
status: executing
stopped_at: "Completed 17-06-PLAN.md (Layer-B demo E2E specs: boot, node-inspector, debugger, service-toggle, notification-service)"
last_updated: "2026-04-18T00:14:26.615Z"
last_activity: 2026-04-18
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 11
  completed_plans: 10
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-18)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** Phase 17 — Demo App Rewire

## Current Position

Phase: 17 (Demo App Rewire) — EXECUTING
Plan: 7 of 7
Status: Ready to execute
Last activity: 2026-04-18

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
| Phase 17-demo-app-rewire P01 | 20min | 2 tasks | 9 files |
| Phase 17-demo-app-rewire P03 | 15min | 2 tasks | 4 files |
| Phase 17-demo-app-rewire P04 | 25 | 2 tasks | 4 files |
| Phase 17-demo-app-rewire P05 | 25min | 2 tasks | 8 files |
| Phase 17 P06 | 3min | 2 tasks | 6 files |

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
- [Phase 17-demo-app-rewire]: Explanatory comments referencing removed anti-terms are permitted — grep pattern excludes them per DEMO-01 spec
- [Phase 17-demo-app-rewire]: [Phase 17-01] 'sign:event' capability deleted in v1.2 ACL; identity-request uses 'identity:read', relay-publish-signed uses 'relay:write'
- [Phase 17-demo-app-rewire]: [Phase 17-01] notification-demo.ts dispatches via ifc.emit NappletMessage envelopes (not NIP-01 BusKind arrays) to match notification-service.ts handler
- [Phase 17-demo-app-rewire]: [Phase 17-03]: runIdentityProbe dispatches identity.getPublicKey through real ServiceHandler.handleMessage (DEMO_HOST_PROBE_WINDOW_ID sentinel) — same path napplets use; NappletMessage imported from @kehto/shell not @napplet/core to avoid adding direct dep to apps/demo
- [Phase 17-demo-app-rewire]: TappedMessage.raw widened to unknown[] | NappletMessage — downstream code must use Array.isArray() guard before numeric indexing; verb='ENVELOPE' used for plain-object messages for filter compatibility
- [Phase 17-demo-app-rewire]: DemoAclAdapter wraps toggleCapability/toggleBlock internally — single seam for UI grant/revoke/block/unblock; onCheck fan-out via _notifyAclCheckListeners
- [Phase 17-demo-app-rewire]: notification-demo.ts dispatches notify.create/list/read/dismiss envelopes; host-originated calls recorded via recordInboundEnvelope/recordOutboundEnvelope for debugger parity (source: 'demo-host')
- [Phase 17-demo-app-rewire]: renderForRole() in node-inspector.ts dispatches to 5 per-role renderers (acl/runtime/napplet/service/shell); role content injected above existing sections block
- [Phase 17]: demoBeforeEach waits for #topology-root (dynamically rendered) not static #topology-pane — topology DOM sentinel vs __SHELL_READY__ harness global
- [Phase 17]: demo-targeted specs use demoBeforeEach, harness-targeted specs use aclBeforeEach — parallel setup helpers from helpers/index.ts pick the right surface

### Blockers/Concerns

- `@napplet/core` not on npm — workspace `link:` overrides active; run `pnpm ls @napplet/core --depth 5` before each Playwright run.
- `feed` napplet delivery path (Phase 20) is undecided — must be resolved before Phase 20 executes.

## Session Continuity

Last session: 2026-04-18T00:14:26.612Z
Stopped at: Completed 17-06-PLAN.md (Layer-B demo E2E specs: boot, node-inspector, debugger, service-toggle, notification-service)
Resume: `/gsd:plan-phase 16`
