---
phase: 20-expanded-domain-napplets
plan: "06"
subsystem: demo
tags: [demo, napplets, acl-panel, theme-broadcast, topology, nap-09]

# Dependency graph
requires:
  - phase: 20-05
    provides: preferences napplet theme observer + #preferences-theme-applied sentinel
  - phase: 20-04
    provides: theme-switcher napplet dispatching demo.publishTheme postMessage
  - phase: 20-03
    provides: profile-viewer napplet with identity.getPublicKey/getProfile
  - phase: 20-02
    provides: feed napplet with relay.subscribe + in-memory mock pool
  - phase: 19-core-domain-napplets
    provides: composer/preferences/toaster + ACL panel wiring patterns
provides:
  - DEMO_NAPPLETS extended to 8 entries (chat, bot, composer, preferences, toaster, feed, profile-viewer, theme-switcher)
  - DEMO_CAPABILITIES extended to 7 entries (relay:read/write, state:read/write, identity:read, notify:send, theme:read)
  - renderAclPanels() branches for all 8 napplets
  - demo.publishTheme window message listener bridges theme-switcher outbound to relay.publishTheme fan-out
  - NAP-09 COVERAGE GATE comment block in createDemoHooks() documenting 6 non-stub NUB domains
affects: [20-07, 20-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "demo.publishTheme host listener: narrowly-guarded window.addEventListener in main.ts (documented host-side SDK gap exemption)"
    - "Parameters<typeof relay.publishTheme>[0] cast: avoids direct @napplet/nub-theme import in demo app (transitive dep resolution)"
    - "aclRendered.size < N bail-out: updated from 5 to 8 as napplet count grew"

key-files:
  created: []
  modified:
    - apps/demo/src/shell-host.ts
    - apps/demo/src/acl-panel.ts
    - apps/demo/src/main.ts

key-decisions:
  - "inline @napplet/nub-theme import replaced with Parameters<typeof relay.publishTheme>[0] cast — tsc cannot resolve transitive nub-theme from demo's tsconfig; cast is structurally equivalent"
  - "demo.publishTheme is the SECOND window.addEventListener in the demo host (first is MessageTap in shell-host.ts); both are documented and necessary; Plan 20-07 anti-term grep must treat both as exemptions"
  - "theme:read added to DEMO_CAPABILITIES for surface visibility; in v1.3 theme.changed fan-out bypasses ACL (shell-initiated push), so disabling it has no functional effect"

patterns-established:
  - "Path B ACL detection: feedInfo/profileViewerInfo/themeSwitcherInfo added to refreshAclPanelsIfNeeded() matching composer/preferences/toaster pattern"
  - "aclRendered.size bail-out must be updated whenever DEMO_NAPPLETS grows"

requirements-completed: [NAP-06, NAP-07, NAP-08, NAP-09]

# Metrics
duration: 5min
completed: 2026-04-18
---

# Phase 20 Plan 06: Demo Wiring Summary

**DEMO_NAPPLETS extended to 8 entries, demo.publishTheme listener bridges theme-switcher postMessage to relay.publishTheme fan-out, completing the theme-broadcast round-trip and NAP-09 coverage gate**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-18T09:24:29Z
- **Completed:** 2026-04-18T09:28:40Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Extended DEMO_NAPPLETS from 5 to 8 entries with correct statusId/aclId/frameContainerId values matching Plans 20-02/03/04 DOM contracts
- Added NAP-09 COVERAGE GATE comment block in createDemoHooks() documenting 6 non-stub NUB domains and v1.4+ deferral for keys/media
- Extended DEMO_CAPABILITIES to 7 entries (added theme:read) and renderAclPanels() to cover all 8 napplets
- Installed demo.publishTheme window message listener that bridges theme-switcher's outbound postMessage to relay.publishTheme() fan-out
- Extended refreshAclPanelsIfNeeded() with Path B detection for feed/profileViewer/themeSwitcher; updated size bail-out from < 5 to < 8

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend DEMO_NAPPLETS + NAP-09 deferral doc block** - `09bb323` (feat)
2. **Task 2: Extend DEMO_CAPABILITIES + renderAclPanels branches** - `21de77c` (feat)
3. **Task 3: Install demo.publishTheme listener + wire new napplets in main.ts** - `071f1eb` (feat)

## Files Created/Modified

- `apps/demo/src/shell-host.ts` — DEMO_NAPPLETS extended to 8 entries; NAP-09 COVERAGE GATE comment block above services map
- `apps/demo/src/acl-panel.ts` — DEMO_CAPABILITIES extended to 7 entries; renderAclPanels branches for feed/profile-viewer/theme-switcher
- `apps/demo/src/main.ts` — feedInfo/profileViewerInfo/themeSwitcherInfo extracted; refreshAclPanelsIfNeeded extended; demo.publishTheme listener installed; aclRendered.size bail-out updated to < 8

## DEMO_NAPPLETS Final 8-Entry List (for Plan 20-07 spec reference)

| name | statusId | aclId | frameContainerId |
|------|----------|-------|-----------------|
| chat | chat-status | chat-acl | chat-frame-container |
| bot | bot-status | bot-acl | bot-frame-container |
| composer | composer-status | composer-acl | composer-frame-container |
| preferences | preferences-status | preferences-acl | preferences-frame-container |
| toaster | toaster-status | toaster-acl | toaster-frame-container |
| feed | feed-status | feed-acl | feed-frame-container |
| profile-viewer | profile-status | profile-viewer-acl | profile-viewer-frame-container |
| theme-switcher | theme-status | theme-switcher-acl | theme-switcher-frame-container |

Note: `profile-viewer` uses `profile-status` (not `profile-viewer-status`) matching Plan 20-03's DOM contract.

## demo.publishTheme Listener Contract

**Location:** `apps/demo/src/main.ts` (host-side, not a napplet file)

**Guards:**
1. `event.data` is a plain object (not null, not array)
2. `event.data.type === 'demo.publishTheme'`
3. `event.data.theme` is a non-null object
4. `event.data.theme.colors.background` is a string

**Call:** `relay.publishTheme(themeTyped as Parameters<typeof relay.publishTheme>[0])`

**Fan-out:** relay.publishTheme() (ShellBridge) broadcasts `theme.changed` envelope to every registered napplet via originRegistry.getIframeWindow

**Debugger:** `debuggerEl?.addSystemMessage('theme broadcast — bg: <hex>')`

## NAP-09 Coverage Gate Evidence

After Phase 20, the demo exercises these non-stub NUB domains end-to-end:

| Domain | Exercised by | Plan |
|--------|-------------|------|
| identity | profile-viewer (identity.getPublicKey + identity.getProfile) | 20-03 |
| ifc | chat + bot (ifc.emit round-trip) | Phase 18 |
| notify | toaster (notify.create/list/dismiss) | Phase 19 |
| relay-publish | composer (relay.publish signed event) | Phase 19 |
| relay-subscribe | feed (relay.subscribe + EOSE + events) | 20-02 |
| storage | preferences (storage.getItem/setItem) | Phase 19 |
| theme | theme-switcher → relay.publishTheme → preferences observer | 20-04/05/06 |

**Stub-only (v1.4+ deferred):** keys (createKeysService logs only; no real hotkey backend), media (createMediaService logs only; no real audio backend). Topology still renders keys + media nodes with stub-only badge.

## Anti-Term Grep Expectation (for Plan 20-07)

- `apps/demo/src/main.ts`: exactly **2** `window.addEventListener` occurrences
  - 1: MessageTap install in shell-host.ts (pre-existing, host-side)
  - 1: demo.publishTheme listener (this plan, documented host-side SDK gap exemption)
  - Both are in the **demo host** (`apps/demo/src/`), not in napplet src files
- `apps/demo/napplets/feed/src/main.ts`: **0** `window.addEventListener` (relay.subscribe via SDK)
- `apps/demo/napplets/profile-viewer/src/main.ts`: **0** `window.addEventListener`
- `apps/demo/napplets/theme-switcher/src/main.ts`: **0** `window.addEventListener` (OUTBOUND-ONLY, dispatchTheme uses window.parent.postMessage, no listener)

## Decisions Made

- **inline type cast via `Parameters<typeof relay.publishTheme>[0]`**: The plan originally called for `import('@napplet/nub-theme').Theme` inline dynamic type import. This resolved correctly in vite at runtime but caused a `TS2307: Cannot find module '@napplet/nub-theme'` error in tsc because demo's tsconfig cannot resolve transitive deps from @kehto/shell. Used `Parameters<typeof relay.publishTheme>[0]` instead — structurally identical type, no package.json change needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced inline @napplet/nub-theme dynamic import with structural Parameters<> cast**
- **Found during:** Task 3 (demo.publishTheme listener)
- **Issue:** `import('@napplet/nub-theme').Theme` inline type caused `TS2307: Cannot find module '@napplet/nub-theme'` in tsc — nub-theme is a dep of @kehto/shell, not @kehto/demo directly; demo's tsconfig cannot resolve it transitively
- **Fix:** `themeTyped as Parameters<typeof relay.publishTheme>[0]` — derives the same type from ShellBridge.publishTheme's parameter, which is available via the already-imported `relay` variable
- **Files modified:** `apps/demo/src/main.ts`
- **Verification:** tsc --noEmit produced 13 errors (same count as baseline, no new errors); build clean

---

**Total deviations:** 1 auto-fixed (Rule 1 - type resolution bug)
**Impact on plan:** Minimal — type cast is structurally equivalent, no functional difference. Plan goal fully achieved.

## Issues Encountered

None beyond the type resolution issue documented above.

## Next Phase Readiness

- Plan 20-07 (anti-term grep + Playwright spec assertions) can proceed — all 8 napplets wired
- Plan 20-08 (NAP-09 gate validation) can proceed — COVERAGE GATE comment block present in shell-host.ts
- Theme broadcast round-trip seam complete: theme-switcher button → main.ts listener → relay.publishTheme → preferences #preferences-theme-applied
- All 8 topology napplet nodes will render on demo boot (DEMO_NAPPLETS has 8 entries)
- ACL panels will render for all 8 napplets after authentication

---
*Phase: 20-expanded-domain-napplets*
*Completed: 2026-04-18*
