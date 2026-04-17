# Phase 13: Theme Nub Implementation - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Add the `theme` NUB end-to-end — the 8th and last domain to reach feature parity in v1.2.

Deliverables:
1. **Runtime dispatch** — `case 'theme':` added to runtime.ts switch; `handleThemeMessage` routes to the theme service (TH-01).
2. **Reference service** — `packages/services/src/theme-service.ts` handles `theme.get` (returning current theme) and emits `theme.changed` broadcasts (TH-02).
3. **Shell adapter API** — `bridge.publishTheme(theme)` method on the ShellBridge interface for host apps to push theme changes to all registered napplets (TH-03).
4. **ACL enforcement test** — Phase 12's ACL sweep already added `theme:read` and the `themeMap` function to `resolveCapabilitiesNub`. This phase adds a test that a napplet without `theme:read` capability is denied `theme.get` with the same error shape used by the other seven nubs (TH-04).

Out of scope: real CSS injection, theme persistence to storage, theme-change debouncing, dark/light mode detection. Host apps supply concrete behavior by overriding via `runtime.registerService('theme', customHandler)` or by consuming `theme.changed` in their own UI.

</domain>

<decisions>
## Implementation Decisions

### Plan Structure
- **2 plans:**
  - **13-01** — Runtime + reference service (TH-01, TH-02, plus TH-04 ACL enforcement test): single agent, deterministic. Wave 1.
  - **13-02** — Shell adapter API for host theme-change broadcasts (TH-03): depends on 13-01 for the `theme.changed` envelope shape. Wave 2.

### Default Theme Payload
- Minimal default values for the reference service's initial theme:
  - `colors: { background: '#0a0a0a', text: '#e0e0e0', primary: '#7aa2f7' }`
  - `fonts`, `background`, `title` — undefined (all optional in `@napplet/nub-theme` Theme interface)
- Host apps can override by passing `createThemeService({ initialTheme })` or by registering a custom handler via `runtime.registerService('theme', handler)`.

### Shell Adapter API Shape
- **`bridge.publishTheme(theme: Theme)` method** on the ShellBridge interface.
- Implementation emits a `theme.changed` envelope to every registered napplet via the existing fanout primitive used by `sendToNapplet`.
- Type-only import of `Theme` from `@napplet/nub-theme` preserves the types-only peer-dep rule.
- Does NOT use the Phase 12-11 `theme-proxy.ts` directly — `theme-proxy.ts` is napplet-facing (dispatch/emit for napplet→shell and one-shot shell→napplet send), whereas `publishTheme` is host-facing broadcast. Keeping these distinct avoids conflating the proxy role with a host-side publisher.

### TH-04 Test Coverage
- Add a focused test in `packages/acl/src/resolve.test.ts` or `packages/runtime/src/dispatch.test.ts` (planner's call):
  - Given a napplet without `theme:read` capability, sending `theme.get` produces a `theme.get.error` envelope with the same shape as other nubs' ACL-denied errors.
  - Given a napplet WITH `theme:read`, `theme.get` reaches the service and returns `theme.get.result`.
- Phase 12 already added `themeMap` to resolveCapabilitiesNub (confirmed in acl/resolve.ts:164-166). This test makes the enforcement explicit in Phase 13's artifact footprint.

### Relationship to Phase 14
- Phase 14 (Dispatch Refactor) replaces the hand-rolled switch with `createDispatch()`/`registerNub()`. Phase 13 adds `case 'theme':` to the existing switch; Phase 14 migrates all 8 cases (including theme) to the formal API. Phase 13 does not pre-empt Phase 14 by using `registerNub()` directly.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/runtime/src/runtime.ts` — dispatch switch (currently 7 cases: relay, identity, keys, media, notify, storage, ifc; theme is the missing 8th). Mirror the `handleIdentityMessage` pattern added by Plan 12-03.
- `packages/services/src/identity-service.ts` — closest structural template. Has real logic (reads shell state) rather than being a pure stub.
- `packages/shell/src/shell-bridge.ts` — has `sendToNapplet` fanout primitive. `publishTheme` wraps it.
- `packages/shell/src/theme-proxy.ts` — napplet-facing proxy (created Plan 12-11). Reuses for receive side but DOES NOT own broadcast.
- `packages/acl/src/resolve.ts:164` — `themeMap` function already present and correct; no ACL code changes needed.
- `/home/sandwich/Develop/napplet/packages/nubs/theme/src/types.ts` — 3 message types: `theme.get`, `theme.get.result`, `theme.changed`. Theme payload structure (colors/fonts/background/title).

### Established Patterns
- Service file: JSDoc + `createXxxService(runtime, options)` factory + ServiceHandler + handleMessage switch.
- `createXxxService` returns a ServiceHandler with `name`, `handleMessage(envelope)`, optional `destroy()`.
- Tests: co-located `*-service.test.ts` using vitest.
- Result envelopes: `{ type: 'theme.get.result', payload: { theme }, windowId, id }`.
- Broadcast envelopes: `{ type: 'theme.changed', payload: { theme }, windowId: <recipient> }` (no id because fire-and-forget).

### Integration Points
- `runtime.registerService('theme', createThemeService(runtime, options))` at shell init — add to shell setup path.
- `bridge.publishTheme(theme)` — new method on ShellBridge interface; iterates napplet window IDs and emits `theme.changed`.
- ACL check in runtime is already wired via the existing enforce-gate mechanism (no new plumbing needed).

</code_context>

<specifics>
## Specific Ideas

- Follow Plan 12-11's `theme-proxy.ts` file layout for naming/structure consistency.
- Default theme values kept centralized in theme-service.ts — not duplicated across tests.
- Tests assert the exact envelope shape including `type: 'theme.changed'` (not `'theme.change'`) and payload structure.

</specifics>

<deferred>
## Deferred Ideas

- Persisting theme choice to storage and restoring on shell init — host-app concern.
- Dark/light mode detection, CSS variable injection, animated transitions — host-app concern.
- `theme-service.test.ts` integration with real DOM — not needed; envelope-level testing suffices.
- Theme-change debouncing — host app can wrap publishTheme.

</deferred>
