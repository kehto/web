---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: — Demo Functional & Playwright Parity
status: executing
stopped_at: Completed 22-03-PLAN.md (root README + docs/migrations/ archive)
last_updated: "2026-04-18T11:33:19.585Z"
last_activity: 2026-04-18
progress:
  total_phases: 7
  completed_phases: 6
  total_plans: 38
  completed_plans: 37
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-18)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** Phase 22 — docs-refresh-release-rehearsal

## Current Position

Phase: 22 (docs-refresh-release-rehearsal) — EXECUTING
Plan: 3 of 3
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
| Phase 17-demo-app-rewire P07 | 10min | 1 tasks | 4 files |
| Phase 18-napplet-sdk-migration P01 | 2 | 1 tasks | 1 files |
| Phase 18-napplet-sdk-migration P02 | 12min | 2 tasks | 2 files |
| Phase 18-napplet-sdk-migration P03 | 2min | 2 tasks | 2 files |
| Phase 18-napplet-sdk-migration P04 | 4 | 1 tasks | 1 files |
| Phase 19-core-domain-napplets P02 | 2min | 2 tasks | 5 files |
| Phase 19-core-domain-napplets P01 | 3min | 2 tasks | 6 files |
| Phase 19-core-domain-napplets P03 | 4 | 2 tasks | 5 files |
| Phase 19-core-domain-napplets P04 | 3 | 2 tasks | 2 files |
| Phase 19 P06 | 95s | 2 tasks | 2 files |
| Phase 19-core-domain-napplets P05 | 120 | 3 tasks | 6 files |
| Phase 19-core-domain-napplets P07 | 120 | 1 tasks | 8 files |
| Phase 20-expanded-domain-napplets P05 | 114s | 2 tasks | 2 files |
| Phase 20-expanded-domain-napplets P03 | 118 | 2 tasks | 5 files |
| Phase 20-expanded-domain-napplets P01 | 2 | 2 tasks | 2 files |
| Phase 20-expanded-domain-napplets P04 | 176 | 2 tasks | 5 files |
| Phase 20-expanded-domain-napplets P02 | 190 | 2 tasks | 5 files |
| Phase 20-expanded-domain-napplets P06 | 251s | 3 tasks | 3 files |
| Phase 20 P07 | 2min | 3 tasks | 3 files |
| Phase 20-expanded-domain-napplets P08 | 58min | 1 tasks | 14 files |
| Phase 21-fixture-napplets-layer-a-specs P01 | 1min | 1 tasks | 13 files |
| Phase 21-fixture-napplets-layer-a-specs P02 | 209s | 3 tasks | 31 files |
| Phase 21-fixture-napplets-layer-a-specs P04 | 703s | 1 tasks | 2 files |
| Phase 21 P03 | 90 | 2 tasks | 9 files |
| Phase 21-fixture-napplets-layer-a-specs P05 | 216s | 1 tasks | 1 files |
| Phase 22-docs-refresh-release-rehearsal P01 | 2min | 2 tasks | 4 files |
| Phase 22-docs-refresh-release-rehearsal P03 | 2min | 2 tasks | 8 files |

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
- [Phase 17-demo-app-rewire]: notification-service.ts handles both notify.* NIP-5D envelopes (canonical v1.2 per D-07) and legacy ifc.emit format; legacy path removed after Phase 18 napplet migration
- [Phase 17-demo-app-rewire]: E2E specs must not gate on napplet auth (#chat-status) until Phase 18; demo napplets use legacy NIP-01 arrays which the v1.2 shell bridge drops by design
- [Phase 17-demo-app-rewire]: Playwright shadow DOM: toContainText() pierces shadow roots; textContent() returns empty string; all future shadow-element assertions must use toContainText()
- [Phase 18-napplet-sdk-migration]: async init() gating on first storage.getItem() call is the canonical SDK AUTH detection pattern for Phase 18+ napplets (no manual handshake)
- [Phase 18-napplet-sdk-migration]: Anti-feature JSDoc comments must use neutral phrasing to avoid false-positive grep matches in acceptance criteria verification
- [Phase 18-napplet-sdk-migration]: Explanatory JSDoc comments referencing banned terms (window.addEventListener, window.nostr) are permitted per Phase 17 decision — grep patterns checking functional code must exclude comment lines
- [Phase 18-napplet-sdk-migration]: SDK-init-gates-auth pattern: async init() calls storage.getItem as first SDK call; shim AUTH completes before storage proxy resolves; status DOM set to 'authenticated' after await
- [Phase 18-napplet-sdk-migration]: frameLocator toContainText built-in retry is sufficient for in-iframe DOM sentinels — no expect.poll needed for demo-targeted specs
- [Phase 18-napplet-sdk-migration]: ifc-roundtrip gates on both napplets authenticated before triggering round trip to prevent race where bot hasn't subscribed via ipc.on yet
- [Phase 18-napplet-sdk-migration]: Match '[bot]' prefix only in ifc-roundtrip spec (not exact reply text) — decouples spec from bot response content for future plans
- [Phase Phase 18-04]: Empty napplet-aggregate-hash (VITE_DEV_PRIVKEY_HEX not set) is acceptable: ACL keys on dTag:'' consistently; E2E suite green confirms functional correctness
- [Phase Phase 18-04]: JSDoc anti-term comments in napplet src are clean per Phase 17 decision — grep pattern distinguishes live code from comment lines
- [Phase 19-core-domain-napplets]: Sequential storage.getItem calls (not Promise.all) for denial localization — matches bot pattern
- [Phase 19-core-domain-napplets]: Preferences status sentinel: 'connecting...' (HTML default) -> 'loaded' / 'saved' / 'denied: <reason>' from main.ts
- [Phase 19-01]: JSDoc anti-feature comments must use neutral phrasing to avoid false-positive anti-term grep matches (extends Phase 18 decision)
- [Phase 19-01]: Encrypted publish uses deterministic fallback pubkey (0000...0001) when recipient field is empty — allows spec-driven encrypted publish without real NIP-46 key exchange
- [Phase 19-01]: D-04 probe uses storage.getItem so state:read denial does not block auth sentinel (denial still signals AUTH completed)
- [Phase 19-core-domain-napplets]: Toaster dispatches raw notify.create/list/dismiss envelopes via window.parent.postMessage because @napplet/sdk does not expose these methods; single narrowly-guarded message handler receives notify.created/notify.listed results (Plan 19-03 explicit SDK gap deviation)
- [Phase 19-core-domain-napplets]: Plan 19-07 anti-term grep must assert exactly 1 window.addEventListener occurrence in apps/demo/napplets/toaster/src/main.ts (not 0, not >1) — toaster is exempt from the 0-listener rule
- [Phase 19-core-domain-napplets]: Dual-register notification-service under 'notifications' (topology) AND 'notify' (runtime routing) — same handler instance, two registry keys, no topology card added for 'notify'
- [Phase 19-core-domain-napplets]: Outer topology statusId placeholder stays 'loading...' for D-04 napplets (composer/preferences/toaster) — inner iframe #*-status set by napplet; Layer-B specs assert via frameLocator
- [Phase 19]: ACL panel button selector uses starts-with (title^=) not contains (title*=) to avoid matching superset cap names
- [Phase 19]: Phase 1 control for relay-write is permissive (published:|denied:); Phase 1 for storage-write is strict ('saved') — local storage always works when granted
- [Phase 19-core-domain-napplets]: frame.evaluate(() => btn.click()) is canonical for sandboxed napplet iframe button interactions — CDP Input does not reach cross-origin sandboxed iframe handlers
- [Phase 19-core-domain-napplets]: sessionRegistry.register() must be called in loadNapplet() for storage.*/notify.* NUB handlers to resolve napplet identity in demo shell-host
- [Phase 19-core-domain-napplets]: storage-persist spec uses page.reload() (not demoBeforeEach) to preserve localStorage — demoBeforeEach calls localStorage.clear() which defeats persistence assertion
- [Phase 19-core-domain-napplets]: nub-relay publish() must handle relay.publish.error — ACL denial sends relay.publish.error (distinct type), not relay.publish.result with error field; Promise must guard both types
- [Phase 19-core-domain-napplets]: Turbo cache must be busted when fixing packages in external workspace (napplet/); the turbo input hash excludes external paths and silently restores stale build artifacts
- [Phase 20-expanded-domain-napplets]: Preferences napplet has exactly 1 window.addEventListener occurrence (D-USER-02 SDK gap exemption, paralleling toaster Plan 19-03 precedent); Plan 20-07 anti-term grep must exempt both toaster and preferences
- [Phase 20-expanded-domain-napplets]: identity.getPublicKey + identity.getProfile called exactly once each (functional invocations); JSDoc comments and log strings also reference them but are not functional calls
- [Phase 20-expanded-domain-napplets]: truncatePubkey('') === 'no-pubkey' is the spec-assertable sentinel for no-signer case in identity-flow.spec.ts (Plan 20-07)
- [Phase 20-expanded-domain-napplets]: NostrEvent/NostrFilter imported from @kehto/shell re-export (not direct @napplet/core dep) in mock-relay-pool.ts — avoids dedupe risk (Pitfall 4)
- [Phase 20-expanded-domain-napplets]: queueMicrotask dispatch for onevent/oneose in mock relay pool — events delivered after subscribe() returns, matching real relay async behavior
- [Phase 20-expanded-domain-napplets]: theme-switcher is OUTBOUND-ONLY: no window message listener installed; dispatchTheme() is the single window.parent.postMessage call site; 0 window.addEventListener per Plan 20-07 anti-term rule
- [Phase 20-expanded-domain-napplets]: feed napplet has 0 window.addEventListener — relay.subscribe is a native SDK call, no postMessage exemption needed (unlike toaster/preferences); Plan 20-07 anti-term grep must assert exactly 0 for feed
- [Phase 20-expanded-domain-napplets]: inline @napplet/nub-theme dynamic import replaced with Parameters<typeof relay.publishTheme>[0] cast to avoid TS2307 in demo's tsconfig — structurally equivalent type, no package.json changes needed
- [Phase 20-expanded-domain-napplets]: demo.publishTheme is the second window.addEventListener in the demo host (first is MessageTap in shell-host.ts); Plan 20-07 anti-term grep must treat both as documented host-side exemptions (not napplet files)
- [Phase Phase 20]: relay-subscribe spec asserts #feed-list .feed-item count exactly 5 — deterministic because mock pool always emits all FIXTURE_EVENTS
- [Phase Phase 20]: identity-flow spec tolerates both 'loaded' and 'denied:' paths — no default signer in demo; both prove envelope dispatched to shell
- [Phase Phase 20]: theme-broadcast spec uses frame.evaluate for #theme-dark-btn click (sandboxed cross-origin iframe pattern, Phase 19-05 decision applied to Phase 20)
- [Phase 20-expanded-domain-napplets]: originRegistry.getAllWindowIds() for publishTheme fan-out (not sessionRegistry which maps by pubkey)
- [Phase 20-expanded-domain-napplets]: identity-service getPublicKey always returns result with empty pubkey when no signer (spec says 'Always succeeds')
- [Phase 20-expanded-domain-napplets]: Layer-A harness specs annotated test.describe.skip for Phase 21 (E2E-09 target; auth-napplet uses NIP-01)
- [Phase 21-fixture-napplets-layer-a-specs]: D-02 option (a): legacy fixtures auth-napplet/publish-napplet/pure-napplet deleted (not kept alongside nub-* fixtures) — cleanliness > backward compat for v1.3; NIP-01 protocol incompatible with v1.2 NIP-5D shell
- [Phase 21-fixture-napplets-layer-a-specs]: JSDoc anti-feature comments in fixture src must use neutral phrasing to avoid false-positive anti-term grep matches — extends Phase 18 decision to fixture files
- [Phase 21-fixture-napplets-layer-a-specs]: nub-theme fixture is OUTBOUND/AUTH-ONLY: @napplet/sdk has no theme namespace; storage.getItem probe for AUTH; Layer-A spec drives theme via __injectEnvelope__
- [Phase 21-fixture-napplets-layer-a-specs]: nub-ifc ipc.on() is synchronous (not async) — SDK subscribe is a side-effect registration; status set to authenticated synchronously, not inside .then()
- [Phase 21-fixture-napplets-layer-a-specs]: handler.descriptor required: runtime.registerService() accesses handler.descriptor.name at registration time (runtime.ts:1181) — handler objects passed to __registerService__ MUST include descriptor field
- [Phase 21-fixture-napplets-layer-a-specs]: Stub-scope Layer-A specs (nub-keys, nub-media) use __registerService__ capture pattern — Possibility A applies for both: runtime emits fallback result envelopes even without registered services (runtime.ts:939 media, runtime.ts:982 keys)
- [Phase 21]: NIP-5D harness registration: create->append->register->src order prevents first-message race
- [Phase 21]: identity.*.error routing added to napplet shim central handler for denial path propagation
- [Phase 21-fixture-napplets-layer-a-specs]: Full v1.3 suite green on first iteration — no code changes required during plan 21-05; all fixes were applied in plans 21-02/21-03/21-04
- [Phase 21-fixture-napplets-layer-a-specs]: 68 skipped tests are all legacy describe.skip blocks from 7 spec files — by design, v1.4 cleanup scope; no new skips introduced in Phase 21
- [Phase 22-docs-refresh-release-rehearsal]: typedoc installed at workspace root only (not per-package) with entryPointStrategy: packages covering all 4 @kehto/* packages; docs/api/ gitignored as build artifact
- [Phase 22-docs-refresh-release-rehearsal]: docs:api not added to turbo.json — manual dev-time tool per STACK.md §4c, not a pipeline step; readme: none in typedoc config so package READMEs handle human narrative via Plan 22-02 cross-links
- [Phase 22-docs-refresh-release-rehearsal]: Single typedoc warning flagged for Plan 22-02 follow-up: @kehto/shell/src/session-registry.ts PendingUpdate type referenced but not exported from package index (documentation-surface only, no runtime impact)
- [Phase 22-docs-refresh-release-rehearsal]: Adopted D-03 option (a) — legacy docs archived under docs/migrations/ with terminal-state headers rather than rewritten for v1.3; those docs describe historical transitions already shipped
- [Phase 22-docs-refresh-release-rehearsal]: Root README references apps/demo/src/shell-host.ts (contains createDemoHooks function) — plan's reference to apps/demo/src/createDemoHooks.ts adjusted to avoid broken link
- [Phase 22-docs-refresh-release-rehearsal]: All 6 legacy docs moved via git mv (not rm+add) so git log --follow preserves pre-plan authoring history — verified post-commit with similarity scores 98-99%

### Blockers/Concerns

- `@napplet/core` not on npm — workspace `link:` overrides active; run `pnpm ls @napplet/core --depth 5` before each Playwright run.
- `feed` napplet delivery path (Phase 20) is undecided — must be resolved before Phase 20 executes.

## Session Continuity

Last session: 2026-04-18T11:33:19.582Z
Stopped at: Completed 22-03-PLAN.md (root README + docs/migrations/ archive)
Resume: `/gsd:plan-phase 16`
