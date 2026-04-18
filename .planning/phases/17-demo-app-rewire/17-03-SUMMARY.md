---
phase: 17-demo-app-rewire
plan: 03
subsystem: ui
tags: [demo, signer, identity, nip-46, nip-07, nip-5d, typescript]

# Dependency graph
requires:
  - phase: 17-demo-app-rewire-01
    provides: anti-term clearance (BusKind/AUTH_KIND/window.nostr purge from demo src)
  - phase: 17-demo-app-rewire-02
    provides: shell-host service registration seam (themeServiceBundle, notificationServiceHandler pattern)
provides:
  - getIdentityServiceHandler() export from shell-host.ts for host-side probe flows
  - runIdentityProbe() in signer-modal.ts: post-connect identity.getPublicKey round-trip via real service
  - Test-sign button on signer topology node; host-internal signEvent flow with debugger feedback
  - recordSignerRequest integration for both identity.getPublicKey probe and signEvent test
affects:
  - 17-06-demo-boot spec (verifies identity.getPublicKey probe fires on NIP-07 connect)
  - 17-04 (signer-demo.ts JSDoc + any remaining signer node wiring)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getIdentityServiceHandler accessor pattern (matches _notificationServiceHandler pattern from 17-02)"
    - "Host-side diagnostic probe: dispatch NappletMessage directly to ServiceHandler.handleMessage with synthetic windowId"
    - "NappletMessage imported from @kehto/shell (re-export from @napplet/core) to avoid direct @napplet/core dep in apps/demo"

key-files:
  created: []
  modified:
    - apps/demo/src/shell-host.ts
    - apps/demo/src/signer-modal.ts
    - apps/demo/src/main.ts
    - apps/demo/src/topology.ts

key-decisions:
  - "Import NappletMessage from @kehto/shell (not @napplet/core directly) — @napplet/core is not a dep of apps/demo per D-08 anti-feature"
  - "runIdentityProbe placed in signer-modal.ts (not main.ts) — modal owns the connect UX and is the natural probe trigger site"
  - "Test-sign button added to both topology.ts renderSignerNodeContent (initial render) and main.ts updateSignerNodeDisplay (dynamic re-render after state change)"
  - "Probe runs before modal close delay (await runIdentityProbe before setTimeout closeSignerModal) so identity result is visible in topology before modal dismisses"

patterns-established:
  - "DEMO_HOST_PROBE_WINDOW_ID sentinel for host-side ServiceHandler probes (not a real napplet windowId)"

requirements-completed:
  - DEMO-02

# Metrics
duration: 15min
completed: 2026-04-18
---

# Phase 17 Plan 03: Signer UX Canonical Path Rewire Summary

**Post-connect identity.getPublicKey diagnostic probe routed through real identity ServiceHandler; test-sign button calls signer.signEvent host-internally — zero window.nostr surface in demo**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-17T23:49:00Z
- **Completed:** 2026-04-18T00:04:02Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `getIdentityServiceHandler()` export to shell-host.ts following the established `_notificationServiceHandler` accessor pattern; captured in `createDemoHooks()` after services map is built
- Added `runIdentityProbe(expectedPubkey)` in signer-modal.ts: dispatches `identity.getPublicKey` NappletMessage directly to `ServiceHandler.handleMessage`, receives result via callback, asserts pubkey match, records via `recordSignerRequest`; probe fires on both NIP-07 and NIP-46 successful connect
- Added `signer-test-sign` button to signer topology node (both initial render in topology.ts and dynamic re-render in main.ts); click handler calls `signer.signEvent(kind:1 template)` on the connected `getSigner()` signer directly (host-internal path) and logs result to debugger + `recordSignerRequest`

## Task Commits

1. **Task 1: getIdentityServiceHandler + runIdentityProbe post-connect probe** - `8d81887` (feat)
2. **Task 2: test-sign button + host-internal signEvent flow** - `fc00783` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/demo/src/shell-host.ts` — Added `_identityServiceHandler` module ref, `getIdentityServiceHandler()` export, and capture in `createDemoHooks()`
- `apps/demo/src/signer-modal.ts` — Added `recordSignerRequest` import, `getIdentityServiceHandler` import (from `./shell-host.js`), `NappletMessage` type import (from `@kehto/shell`), `DEMO_HOST_PROBE_WINDOW_ID` constant, `runIdentityProbe()` async function, and `await runIdentityProbe(state.pubkey)` calls in NIP-07 and NIP-46 connect success paths
- `apps/demo/src/main.ts` — Added `getSigner as getSignerFromConnection` import, `signer-test-sign` button in `updateSignerNodeDisplay` connected state HTML, click handler dispatching `signer.signEvent`
- `apps/demo/src/topology.ts` — Added `signer-test-sign` button in `renderSignerNodeContent` connected state HTML

## Decisions Made

- Used `NappletMessage` from `@kehto/shell` (which re-exports from `@napplet/core`) — avoids adding `@napplet/core` as a direct dep on apps/demo, per D-08 anti-feature constraint
- `runIdentityProbe` placed in signer-modal.ts (not main.ts) so the modal owns the full connect UX lifecycle
- Probe fires before the `setTimeout(() => closeSignerModal(), 1500)` delay — result is visible in topology signer node before modal dismisses
- Test-sign button added to both `renderSignerNodeContent` (initial topology render) and `updateSignerNodeDisplay` (subsequent state-driven re-renders) to ensure the button persists across signer state updates

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Import NappletMessage from @kehto/shell instead of @napplet/core**
- **Found during:** Task 1 (TypeScript type-check)
- **Issue:** `apps/demo/package.json` has no `@napplet/core` dependency — `import type { NappletMessage } from '@napplet/core'` produced TS2307 module not found error
- **Fix:** Changed import to `from '@kehto/shell'` which re-exports `NappletMessage` from `@napplet/core` (confirmed via packages/shell/src/types.ts line 20)
- **Files modified:** apps/demo/src/signer-modal.ts
- **Verification:** TypeScript type-check passes with zero signer-modal errors after fix
- **Committed in:** 8d81887 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — wrong import path)
**Impact on plan:** Trivial path fix; no scope change; D-08 constraint respected (no direct @napplet/core dep in demo).

## Issues Encountered

- Linter auto-added `type NappletMessage` to shell-host.ts imports from `@kehto/shell` (likely auto-import on save). This is benign — NappletMessage is correctly re-exported there and the import is unused in shell-host.ts itself but does no harm.

## Anti-term Verification

`grep -rnE "window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]" apps/demo/src/` — **zero functional matches**. All 8 hits are comment/JSDoc text explaining what was removed or what is NOT done.

## NIP-46 QR Connect Regression Guard

`grep -n "'bunker://'" apps/demo/src/nip46-client.ts` — bunker URI parser present at line 55. NIP-46 connect flow (QR code, bunker URI parsing, handshake) is completely unchanged by this plan.

## Stub Audit

No stubs introduced in this plan. The `runIdentityProbe` function requires an active signer (`getSigner()` returns non-null) to produce a meaningful result — this is by design (diagnostic only, fires post-connect). The handler correctly returns `identity.getPublicKey.error` if no signer is set, and the probe records this as `success: false`.

## Next Phase Readiness

- Signer UX canonical path is fully rewired for DEMO-02
- `identity.getPublicKey` probe fires on NIP-07/NIP-46 connect and records in `recentRequests` — visible in topology signer node
- Test-sign button demonstrates host-internal `signEvent` without signer-service indirection
- 17-04 can proceed to update signer-demo.ts JSDoc and confirm the fallback signer shape matches `ShellAdapter.auth.getSigner`

---
*Phase: 17-demo-app-rewire*
*Completed: 2026-04-18*
