---
phase: 17-demo-app-rewire
plan: 02
subsystem: ui
tags: [napplet, nip-5d, demo, services, topology, theme, keys, media]

requires:
  - phase: 17-01
    provides: Legacy anti-terms removed from demo (window.nostr, signer-service, BusKind)
provides:
  - createDemoHooks() registers keys + media + theme services via @kehto/services factories
  - demoServiceNames seeded with 8 canonical topology domains
  - STUB_ONLY_SERVICES + DEMO_TOPOLOGY_SERVICE_NAMES constants exported from shell-host.ts
  - Topology renders stub-only markers (data-service-stub + .stub-badge) on keys/media nodes
  - getThemeServiceBundle() export for host-facing publishTheme seam
  - main.ts theme broadcast placeholder seam for 17-05
affects: [17-03, 17-04, 17-05, 17-06]

tech-stack:
  added: []
  patterns:
    - "STUB_ONLY_SERVICES const drives topology visual markers without hardcoding in topology.ts"
    - "ThemeService bundle stored at module scope; getThemeServiceBundle() exposes host-facing publishTheme"
    - "demoServiceNames initialized from DEMO_TOPOLOGY_SERVICE_NAMES; registerService wrapper adds runtime-registered services"

key-files:
  created: []
  modified:
    - apps/demo/src/shell-host.ts
    - apps/demo/src/topology.ts
    - apps/demo/src/main.ts

key-decisions:
  - "demoServiceNames seeded with all 8 domains (including topology-only relay/storage/signer) so topology renders 8 nodes without requiring ServiceHandler registration for those 3"
  - "STUB_ONLY_SERVICES drives topology badge rendering — single source of truth avoids duplication between shell-host and topology"
  - "Theme broadcast seam placed after debugger init in main.ts so debuggerEl is guaranteed non-null"

patterns-established:
  - "topology.ts imports STUB_ONLY_SERVICES from shell-host.js — service metadata flows from host to renderer, not hardcoded in renderer"

requirements-completed: [DEMO-04, DEMO-05]

duration: 12min
completed: 2026-04-17
---

# Phase 17 Plan 02: Register 8 Service Nodes & Topology Stub Markers Summary

**`createDemoHooks()` extended from 2 to 5 registered services (+ 3 topology-only); all 8 NIP-5D topology nodes visible on boot with stub-only visual markers on keys/media**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-17T15:15:00Z
- **Completed:** 2026-04-17T15:27:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Extended `@kehto/services` import in shell-host.ts with `createKeysService`, `createMediaService`, `createThemeService`
- Added `STUB_ONLY_SERVICES: readonly string[] = ['keys', 'media']` and `DEMO_TOPOLOGY_SERVICE_NAMES` (8 domains) constants
- Updated `createDemoHooks()` services map: 2 entries → 5 entries (identity, notifications, keys, media, theme)
- Stored `ThemeService` bundle in `_themeServiceBundle`; exported `getThemeServiceBundle()` for main.ts seam
- Updated `demoServiceNames = new Set<string>(DEMO_TOPOLOGY_SERVICE_NAMES)` — 8 domains on boot
- `topology.ts` imports `STUB_ONLY_SERVICES`; service card map computes `isStub`, adds `data-service-stub` attribute and `.stub-badge` span
- `main.ts` imports `getThemeServiceBundle`; theme broadcast placeholder block logs "publishTheme seam ready" to debugger
- Build succeeds clean (101 modules, 254 kB)

## createDemoHooks() Services Map Diff

Before (2 entries):
```
identity: createIdentityService({ getSigner })
notifications: notificationService
```

After (5 entries):
```
identity: createIdentityService({ getSigner })
notifications: notificationService
keys: keysService              // stub-only, logs to console
media: mediaService            // stub-only, logs to console
theme: themeServiceBundle.handler  // real ThemeService NUB
```

## demoServiceNames Seed Set

Before: `new Set(['identity', 'notifications'])` — 2 names

After: `new Set(DEMO_TOPOLOGY_SERVICE_NAMES)` — 8 names:
`['identity', 'keys', 'media', 'notifications', 'relay', 'signer', 'storage', 'theme']`

Note: `relay`, `storage`, `signer` are topology-only nodes (no ServiceHandler registered) — the wrapped `runtime.registerService` does not affect them.

## Topology Stub-Only DOM Contract

Service `<article>` elements now carry:
- `data-service-stub="true"` for `keys` and `media`
- `data-service-stub="false"` for all other services
- `<span class="stub-badge">stub-only</span>` inline in the title for stub-only services

## Task Commits

1. **Task 1: Register keys + media + theme services** — `1b7b8dd` (feat)
2. **Task 2: Extend topology.ts stub markers + main.ts theme seam** — `13a1691` (feat)

**Plan metadata:** committed with SUMMARY.md + state updates (docs)

## Files Created/Modified
- `apps/demo/src/shell-host.ts` — Added 3 service imports, STUB_ONLY_SERVICES + DEMO_TOPOLOGY_SERVICE_NAMES consts, extended createDemoHooks(), _themeServiceBundle + getThemeServiceBundle(), updated demoServiceNames seed
- `apps/demo/src/topology.ts` — Imported STUB_ONLY_SERVICES; added isStub/stubBadge computation in renderDemoTopology; added data-service-stub attribute
- `apps/demo/src/main.ts` — Imported getThemeServiceBundle; added theme broadcast placeholder block

## Decisions Made
- `demoServiceNames` seeded with all 8 domains including topology-only relay/storage/signer so topology renders 8 nodes without requiring ServiceHandler registration for those 3 — consistent with D-03/D-04 which explicitly calls these "topology-only nodes"
- `STUB_ONLY_SERVICES` in shell-host.ts drives topology rendering — single source of truth rather than duplicating in topology.ts
- Theme broadcast placeholder placed after debugger init to guarantee debuggerEl is non-null when logging

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in acl-modal.ts, acl-panel.ts, sequence-diagram.ts, notification-demo.ts were present before this plan and are unrelated to the changes made here. Build (vite) succeeds clean — these are tsc-only issues in other demo files.

## Next Phase Readiness
- 8 topology service nodes visible on boot — DEMO-05 satisfied
- Theme service registered with `getThemeServiceBundle()` seam ready — 17-05 can wire host toggle button
- `STUB_ONLY_SERVICES` exported for 17-06 Playwright specs to assert `data-service-stub="true"` on keys/media nodes
- `relay`, `storage`, `signer` topology-only nodes still need node-inspector content (17-04 / D-07)

---
*Phase: 17-demo-app-rewire*
*Completed: 2026-04-17*
