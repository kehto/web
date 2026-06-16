---
task: 260616-8iv
title: Move playground theme-switcher to host context
type: quick
completed: 2026-06-16
duration: "~45m"
commits:
  - ee0be45: "feat(quick-260616-8iv-01): port theme-discovery module host-side and expose relay handle"
  - 91448fd: "feat(260616-8iv): host-side theme-switcher UI on theme service card"
  - cb32719: "feat(260616-8iv): delete theme-switcher napplet and deregister all references"
  - 6e76d5a: "test(260616-8iv): update test + policy regression surface for host theme switcher"
key-files:
  created:
    - apps/playground/src/theme-discovery.ts
    - apps/playground/src/theme-switcher-host.ts
  modified:
    - apps/playground/src/demo-hooks.ts
    - apps/playground/src/shell-host.ts
    - apps/playground/src/main.ts
    - apps/playground/src/main-preferences.ts
    - apps/playground/src/acl-panel.ts
    - apps/playground/src/demo-definitions.ts
    - tests/unit/playground-theme-switcher-discovery.test.ts
    - tests/unit/nip5d-conformance-guard.test.ts
    - tests/unit/playground-gateway-guard.test.ts
    - tests/unit/sdk-migration-guard.test.ts
    - tests/e2e/demo-concurrent-boot.spec.ts
    - tests/e2e/gateway-artifact-parity.spec.ts
    - tests/e2e/class-invariant.spec.ts
    - tests/e2e/theme-broadcast.spec.ts
    - tests/e2e/playground-usability-controls.spec.ts
    - docs/policies/NIP-5D-CONFORMANCE.md
  deleted:
    - apps/playground/napplets/theme-switcher/ (6 files)
key-decisions:
  - "Use ServiceHandler.handleMessage with NappletMessage casts for host relay subscription — avoids introducing new wire verbs while reusing the existing relay service protocol"
  - "buildHostRelaySubscribe uses a lazy getter (getHandler) so the adapter can be constructed before demo hooks run"
  - "Add getCurrentTheme() to PlaygroundPreferences to sync button active state on mount after reload"
  - "Retarget class-invariant e2e spec from theme-switcher to composer (same relay:write gate test, different target napplet)"
---

# Quick Task 260616-8iv Summary

## One-liner

Host-side theme-switcher UI with full parity (Light/Dark/Custom presets, catalog discovery, WoT/Global filters) mounted on the topology theme card, replacing the deleted sandboxed napplet and eliminating the un-ACL'd `theme.set` postMessage seam.

## What Was Done

### Task 1: Port theme-discovery module host-side

- Created `apps/playground/src/theme-discovery.ts` — verbatim port from the napplet with `subscribe` promoted to a required option (dropped the `?? relaySubscribe` fallback that only made sense in the SDK context)
- Added `relayServiceHandler` module-level variable and `getRelayServiceHandler()` export to `demo-hooks.ts`
- Re-exported `getRelayServiceHandler` from `shell-host.ts`
- Fixed 4 pre-existing type errors from commit `756a22e` (missing `outbox:*`, `upload:*`, `intent:*` capabilities in `acl-panel.ts`, `shell-host.ts`, `demo-hooks.ts`)

### Task 2: Build host theme-switcher UI

- Created `apps/playground/src/theme-switcher-host.ts` with `initThemeSwitcherHost()` and `buildHostRelaySubscribe()`
- `initThemeSwitcherHost` mounts on `topology-node-service-theme .topology-node-content`, renders Light/Dark/Custom buttons, color picker, Refresh/WoT/Global row, and dynamic catalog list
- `buildHostRelaySubscribe` wraps a `ServiceHandler` into a `ThemeRelaySubscribe` using the `relay.subscribe / relay.event / relay.eose / relay.close` protocol over `handleMessage`
- Added `applyTheme(theme: PlaygroundTheme): void` and `getCurrentTheme(): PlaygroundTheme` to `PlaygroundPreferences` interface and implementation
- Removed the `theme.set` branch from `window.addEventListener('message', ...)` in `main.ts`
- Added `initThemeSwitcherHost(...)` call with `initialTheme: preferences.getCurrentTheme()` for post-reload sync
- Updated debugger message to `theme service registered -- host theme switcher active`

### Task 3: Delete napplet and deregister

- Deleted `apps/playground/napplets/theme-switcher/` (6 files: index.html, package.json, src/main.ts, src/theme-discovery.ts, tsconfig.json, vite.config.ts)
- Removed from `DEMO_NAPPLETS` array and `CLASS_BY_DTAG` map in `demo-definitions.ts`
- Removed `theme-switcher` ACL panel branch from `acl-panel.ts`

### Task 4: Test and policy regression surface

- Unit tests: updated nip5d-conformance-guard, playground-gateway-guard, sdk-migration-guard to remove theme-switcher; repointed theme-discovery test import to host path; added host-switcher invariant assertions
- E2E: removed theme-switcher from napplet lists in demo-concurrent-boot (10→9) and gateway-artifact-parity; retargeted class-invariant from theme-switcher to composer; rewrote theme-broadcast to click host `#theme-dark-btn`; updated usability-controls theme persistence test to use host buttons
- Policy: removed `theme.set` row from NIP-5D-CONFORMANCE.md allowlist

## Verification

- Type-check: `npx tsc -p apps/playground/tsconfig.json --noEmit` passes (0 errors)
- Build: `vite build apps/playground` completes successfully (536 modules, no errors)
- Unit tests: 199/199 pass (18 test files)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing type errors from commit 756a22e**
- Found during: Task 1
- Issue: 4 TypeScript errors introduced by `756a22e` (new `naps` field, new outbox/upload/intent capability keys) were blocking a clean build baseline
- Fix: Added `naps`, `outbox:read`, `outbox:write`, `upload:write`, `intent:read`, `intent:write` to all required type locations
- Files: `acl-panel.ts`, `demo-hooks.ts`, `shell-host.ts`
- Commits: ee0be45

**2. [Rule 2 - Missing functionality] getCurrentTheme() for post-reload sync**
- Found during: Task 4 — reviewing the theme persistence e2e test
- Issue: Without knowing the persisted theme, `initThemeSwitcherHost` would always initialize button active state to Dark, making the post-reload assertion on the correct active button fail
- Fix: Added `getCurrentTheme()` to `PlaygroundPreferences` interface and implementation; passed as `initialTheme` to `initThemeSwitcherHost`
- Files: `main-preferences.ts`, `theme-switcher-host.ts`, `main.ts`
- Commits: 6e76d5a

**3. [Rule 1 - Bug] ServiceHandlerLike type did not exist**
- Found during: Task 2
- Issue: First version of `theme-switcher-host.ts` referenced non-existent `ServiceHandlerLike` type from `demo-hooks.ts`
- Fix: Rewrote the file to import `NappletMessage` and `ServiceHandler` from `@kehto/shell` and use proper casts
- Files: `theme-switcher-host.ts`
- Commits: 91448fd

## Known Stubs

None. All theme discovery, preset switching, and catalog rendering are fully wired. Discovery uses the live relay service handle via `buildHostRelaySubscribe`.

## Threat Flags

None. The change reduces the threat surface by removing the un-ACL'd `theme.set` outbound postMessage seam that bypassed the napplet sandbox enforcement gate.

## Self-Check: PASSED

- `apps/playground/src/theme-discovery.ts` — FOUND
- `apps/playground/src/theme-switcher-host.ts` — FOUND
- `apps/playground/napplets/theme-switcher/` — DELETED (expected)
- Commits ee0be45, 91448fd, cb32719, 6e76d5a — FOUND in git log
- Unit tests 199/199 — PASS
- Build — PASS (0 errors)
