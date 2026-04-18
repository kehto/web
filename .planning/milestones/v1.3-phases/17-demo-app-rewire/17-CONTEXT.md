# Phase 17: Demo App Rewire - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous phase — context derived from REQUIREMENTS + research)

<domain>
## Phase Boundary

The demo application at `apps/demo/src/*` boots cleanly against the canonical v1.2 `@kehto/*` APIs — zero legacy references, all 8 service nodes visible in topology, signer/NIP-46/ACL/debugger surfaces wired and functional. This phase DOES NOT touch napplets (Phase 18+). It rewires the demo host only.

Surfaces in scope (all from DEMO-01..08):
- Shell host + topology + animators (`shell-host.ts`, `topology.ts`, `flow-animator.ts`, `sequence-diagram.ts`, `trace-animator.ts`, `node-details.ts`, `node-inspector.ts`)
- ACL panels (`acl-panel.ts`, `acl-modal.ts`, `acl-history.ts`)
- Signer UX (`signer-demo.ts`, `signer-modal.ts`, `signer-connection.ts`, `nip46-client.ts`)
- Notifications + kinds + constants panels (`notification-demo.ts`, `kinds-panel.ts`, `constants-panel.ts`)
- Demo config + debugger (`demo-config.ts`, `debugger.ts`, `main.ts`)

Layer-B Playwright specs (E2E-06) covering `demo-boot`, `demo-node-inspector`, `demo-debugger`, `demo-service-toggle`, `demo-notification-service` are closed in this phase.

</domain>

<decisions>
## Implementation Decisions

### Locked Directives (from requirements + research)

**D-01 — No `window.nostr` / signer-service / BusKind anywhere in demo source.**
Files currently referencing these (per baseline grep): `debugger.ts`, `demo-config.ts`, `flow-animator.ts`, `notification-demo.ts`, `sequence-diagram.ts`, `signer-connection.ts`. Every reference must be removed or replaced with canonical v1.2 equivalents. Reason: NIP-5D MUST NOT clause; demo must model the canonical contract.

**D-02 — Signer UX uses canonical identity + relay.publish/publishEncrypted only.**
`signer-modal.ts` + `signer-demo.ts` + `signer-connection.ts` + `nip46-client.ts` route through:
- `identity.getPublicKey` / `identity.getProfile` for reads
- `relay.publish` / `relay.publishEncrypted` (NIP-44 default, NIP-04 opt-in) for writes
- No `window.nostr` fallback path is reachable from any demo button.

**D-03 — `createDemoHooks()` registers real backends for `keys`, `media`, `theme`.**
Use `@kehto/services` factories: `createKeysService()`, `createMediaService()`, `createThemeService()` alongside existing `identity` + `notify`. Relay pool STAYS stubbed (intentional — IFC routes through runtime's internal `ifcSubscriptions` map, not the pool). Services for `storage`, `ifc`, `relay` are whatever the runtime default produces.

**D-04 — Topology renders all 8 service nodes on boot.**
`topology.ts` reads from `runtime.serviceRegistry` (or equivalent) and draws one node per NIP-5D domain. `keys` and `media` render with a "stub-only" visual marker but are NOT hidden. The topology must not hardcode the old 5-domain list.

**D-05 — Debugger shows NIP-5D envelope `type` strings.**
`debugger.ts` intercepts the NappletMessage envelope stream (via `window.__getNubMessage__` in tests and a demo-internal tap in prod) and displays the literal `type` field (e.g., `relay.publish`, `storage.getItem.result`). No BusKind enum lookups, no NIP-01 verb mapping. Legacy renderers that display `["OK", ...]` arrays are deleted.

**D-06 — ACL panel + modal + history wired via `ShellAdapter.acl` hooks only.**
Grant/revoke goes through the shell's ACL API (not direct `aclStore` mutation). `acl-history.ts` subscribes to the ACL audit event stream exposed by `ShellAdapter`. `acl-modal.ts` produces a visual prompt via the same hook used by the runtime's `onAclCheck`.

**D-07 — Node inspector opens per-role content.**
On topology-node click, `node-inspector.ts` dispatches to a per-role renderer:
- ACL node → grant/revoke table (from `aclStore.snapshot()`)
- Runtime node → registered NUB list (from `runtime.getRegisteredNubs()` or equivalent)
- Napplet node → capability state + recent envelopes

**D-08 — Kinds + constants panels read from `@napplet/core` exports.**
`kinds-panel.ts` renders the canonical NIP kind list. `constants-panel.ts` displays `PROTOCOL_VERSION`, `SHELL_BRIDGE_URI`, etc. If any constant is missing from `@napplet/core` at v0.2+, fall back to the kehto-side shim (`core-compat.ts` — DRIFT-CORE-06) with an explicit comment. **No NEW consumers of core-compat.ts beyond what already exists in the demo.**

**D-09 — Edge animators use envelope type, not BusKind.**
`flow-animator.ts`, `sequence-diagram.ts`, `trace-animator.ts` color/route edges by the envelope's domain prefix (`relay.*` → relay edge; `identity.*` → identity edge). Color modes (flash/rolling/decay/last/trace) are preserved.

**D-10 — E2E-06 specs use helpers from Phase 16.**
New specs `demo-boot.spec.ts`, `demo-node-inspector.spec.ts`, `demo-debugger.spec.ts`, `demo-service-toggle.spec.ts`, `demo-notification-service.spec.ts` import `aclBeforeEach` from `tests/e2e/helpers/index.js` and use `waitForNappletReady` when interacting with napplet frames. They target the demo at `:4174` (baseURL override per-spec, or via `project` config). `demo-notification-service.spec.ts` migrates the legacy `tests/e2e/demo-notification-service.spec.ts` to canonical APIs (do not delete — rewrite in place).

**D-11 — Iteration loop (E2E-11) gates phase close.**
Phase 17 does not close until a build → `pnpm preview` → Playwright MCP demo-boot pass is recorded. Per E2E-11, this is a new cross-cutting requirement from this phase forward.

### Claude's Discretion
- Specific DOM structures, class names, and panel layouts (demo uses UnoCSS; preserve existing visual vocabulary).
- Whether `signer-demo.ts` or `signer-modal.ts` owns the NIP-46 state machine (pick the one with less legacy baggage).
- Whether to consolidate `signer-demo.ts`/`signer-modal.ts`/`signer-connection.ts`/`nip46-client.ts` or keep the split.
- How to plumb the demo's internal envelope-tap for `debugger.ts` (likely via a `ShellAdapter.onMessage` hook; verify in code).
- Exact Playwright spec shapes for E2E-06 (beyond "uses helpers from Phase 16 + targets :4174 + asserts the must_haves").

### Anti-features (hard constraints)
- No `window.nostr`, no `signer-service`, no `BusKind`, no kind 29001/29002 injection.
- No new consumers of `packages/runtime/src/core-compat.ts` (DRIFT-CORE-06).
- No new `@napplet/core` direct dep on `apps/demo` (risks pnpm dedupe).
- No framework introduction (demo stays vanilla TypeScript + UnoCSS).
- No ESLint/Prettier churn in `apps/demo`.
- No CI/CD work.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@kehto/services` exports `createKeysService`, `createMediaService`, `createThemeService`, `createIdentityService`, `createNotifyService`.
- `@kehto/shell` `ShellAdapter.acl` + `ShellBridge.publishTheme()` are established host-facing APIs.
- `@kehto/runtime` `createDispatch()` + `registerNub()` + `registerService()` are the canonical wiring points; demo already uses them in `shell-host.ts`.
- `@napplet/core` exports `NappletMessage`, `PROTOCOL_VERSION`, `SHELL_BRIDGE_URI`, `TOPICS` (and others via `core-compat.ts` shim).
- `tests/e2e/helpers/{aclBeforeEach,waitForNappletReady,index}.ts` (Phase 16).
- `tests/e2e/harness-smoke.spec.ts` — reference spec shape.

### Established Patterns
- Demo structure: `main.ts` bootstraps a `shellBridge = createShellBridge(...)`, registers services via `createDemoHooks()` (in `shell-host.ts`), and mounts each panel as a function that reads/mutates DOM.
- Panels are function-based (no classes, no framework). Each panel owns its DOM slot and an update loop.
- Animators subscribe to a shared envelope stream exposed by the `ShellBridge` wrapper.
- Demo uses UnoCSS utility classes throughout (`class="flex gap-2 p-4 ..."`).

### Integration Points
- `apps/demo/src/main.ts` is the bootstrap seam — service registration happens here.
- `apps/demo/src/shell-host.ts` contains `createDemoHooks()` — extend it with `keys`/`media`/`theme` registrations.
- `apps/demo/src/debugger.ts` is the envelope-tap consumer — rewrite its event shape.
- `apps/demo/src/topology.ts` renders the service graph — update to 8 domains.
- `tests/e2e/helpers/index.ts` — new specs import from here.
- `playwright.config.ts` now has demo webServer at :4174 (Phase 16) — specs target this.

</code_context>

<specifics>
## Specific Ideas

- When deleting `window.nostr` / `BusKind` references, prefer surgical replacement over rewrites. Example: `debugger.ts` likely has a `switch (buskind) { case BusKind.SIGNER_REQUEST: ... }` → replace with `switch (envelope.type.split('.')[0]) { case 'relay': ... }`.
- `signer-connection.ts` is historically the `window.nostr` hand-off — rewire to call `shellBridge.identity.getPublicKey()` (or the demo's equivalent proxy).
- `notification-demo.ts` may have legacy references to kind 29003 — rewrite to use `shellBridge.notify.create({ title, body })` (or the internal demo-side hook).
- `constants-panel.ts` + `kinds-panel.ts` need a "what's canonical at v1.2" pass — ensure the displayed constants match what `@napplet/core` + NIP-5D currently export.
- For E2E-06 specs, follow the `harness-smoke.spec.ts` pattern but target baseURL `http://localhost:4174` (demo webServer). Each spec begins with `await aclBeforeEach(page)` per D-10.
- Phase 17 should avoid touching demo napplet sources (`apps/demo/napplets/bot/*`, `apps/demo/napplets/chat/*`) — those are Phase 18.

</specifics>

<deferred>
## Deferred Ideas

- Consolidating signer-* files into a single `signer/` subdirectory — architectural cleanup is out of scope; keep current file layout.
- Adding `@napplet/core` as a direct dep on `apps/demo` for cleaner imports — explicitly forbidden (pnpm dedupe risk per PITFALLS.md #3).
- ESLint rule enforcing the demo-side anti-term grep — doc comment / test-time grep only in v1.3.
- Replacing `ShellAdapter.acl` direct hook with an event-emitter pattern — not in scope; hook-based wiring is the v1.2 contract.

</deferred>
