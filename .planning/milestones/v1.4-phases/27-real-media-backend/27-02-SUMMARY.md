---
phase: 27-real-media-backend
plan: 02
subsystem: services
tags: [HostMediaBridge, createBrowserMediaBridge, host-bridge, navigator.mediaSession, media-service, MEDIA-02]

requires:
  - phase: 27-real-media-backend
    plan: 01
    provides: Real navigator.mediaSession integration in createMediaService (the impl now factored into createBrowserMediaBridge)
  - phase: 26-real-keys-backend
    plan: 02
    provides: HostKeysBridge pattern — structural twin used for HostMediaBridge shape + factory extraction

provides:
  - HostMediaBridge interface exported from @kehto/services (5 fields: setMetadata, setPlaybackState, onAction, setActiveSession?, destroySession?)
  - createBrowserMediaBridge() factory — navigator.mediaSession reference impl extracted from Plan 27-01 inline logic
  - createMediaService hostBridge? option — delegates metadata/state mirroring + action routing to provided bridge; default path uses createBrowserMediaBridge (zero behavior change)
  - MediaAction + HostMediaBridge + createBrowserMediaBridge barrel re-exports from @kehto/services
  - 9 new bridge-path tests (HostMediaBridge integration describe block) covering all bridge delegation behaviors

affects:
  - 27-03 (media-controller demo napplet — may use createMediaService with default bridge or explicit createBrowserMediaBridge)
  - 27-04 (E2E-13 Layer-B spec — service wired via default bridge; interface contract locks the pluggable backend seam)

tech-stack:
  added: []
  patterns:
    - HostMediaBridge interface pattern mirrors HostKeysBridge from Phase 26-02 — 5 fields (3 required + 2 optional)
    - createBrowserMediaBridge factory extraction — navigator.mediaSession logic moved from inline createMediaService to standalone exported factory
    - Bridge actions? param to setActiveSession — enables capabilities narrowing without extending HostMediaBridge with a separate setCapabilities method
    - sessionsActive counter in createBrowserMediaBridge — tracks when to prime/teardown silent-audio across session lifecycle

key-files:
  created: []
  modified:
    - packages/services/src/media-service.ts
    - packages/services/src/media-service.test.ts
    - packages/services/src/index.ts

key-decisions:
  - "setActiveSession? accepts optional actions?: readonly MediaAction[] so the service can pass capabilities-narrowing info without adding a separate setCapabilities field to HostMediaBridge — backward-compatible (optional param), satisfies zero-regression requirement for Plan 27-01's capabilities-narrowing test"
  - "Silent-audio priming moved to setActiveSession (not setMetadata) so sessions without initial metadata still prime the audio element on first activation — preserves Plan 27-01 test: primes silent-audio element on session.create even with no metadata"
  - "setMetadata called via setActive() only (not separately in session.create case) — prevents double-call; setActive mirrors metadata + state via bridge after setActiveSession so bridge has the correct activeSessionId before metadata is written"

patterns-established:
  - "Bridge-resolution pattern in createMediaService: const bridge = options.hostBridge ?? createBrowserMediaBridge({...options...}) — same as Phase 26-02's keys-service Branch A/B resolution but using a factory instead of an early-return branch"

requirements-completed:
  - MEDIA-02

duration: 17min
completed: 2026-04-19
---

# Phase 27 Plan 02: HostMediaBridge Interface + createBrowserMediaBridge Factory Summary

**HostMediaBridge 5-field interface + createBrowserMediaBridge navigator.mediaSession reference impl + hostBridge? option branch in createMediaService; barrel re-exports; 9 new bridge-path tests**

## Performance

- **Duration:** ~17 min
- **Completed:** 2026-04-19
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Exported `HostMediaBridge` interface with exact 5-field shape from CONTEXT.md Area 2 (3 required: setMetadata/setPlaybackState/onAction; 2 optional: setActiveSession?/destroySession?)
- Exported `createBrowserMediaBridge()` factory — navigator.mediaSession reference impl extracted from Plan 27-01's inline `createMediaService` logic; satisfies HostMediaBridge with all 5 methods including capabilities narrowing via optional `actions` param to setActiveSession
- Added `hostBridge?: HostMediaBridge` to MediaServiceOptions; `createMediaService` now branches: provided bridge used as-is; default path instantiates `createBrowserMediaBridge` with same mediaSessionTarget/documentTarget options (Plan 27-01 backward-compat preserved)
- Updated `@kehto/services` barrel: scrubbed stub comment, added `createBrowserMediaBridge` factory re-export, `HostMediaBridge` type re-export, `MediaAction` convenience re-export from `@napplet/nub-media`
- Added 9-test `describe('HostMediaBridge integration')` block covering all bridge delegation behaviors; suite: 480/480 green (471 plan-01 + 9 new)

## Task Commits

1. **Task 1: HostMediaBridge interface + createBrowserMediaBridge factory + hostBridge option** — `d3c8cb4` (feat)
2. **Task 2: barrel re-exports + bridge-path tests** — `3ea371c` (test)

## Files Created/Modified

- `packages/services/src/media-service.ts` — Added: HostMediaBridge interface (exported), createBrowserMediaBridge() factory (exported), hostBridge? option in MediaServiceOptions, bridge-resolution in createMediaService (options.hostBridge ?? createBrowserMediaBridge), unsubscribeAction via bridge.onAction, setActive helper passes actions for narrowing, promoteNextActiveOrClear passes entry.actions
- `packages/services/src/media-service.test.ts` — Added: createBrowserMediaBridge + HostMediaBridge imports; describe('HostMediaBridge integration') block with createFakeBridge helper + 9 tests
- `packages/services/src/index.ts` — Updated media section: stub comment scrubbed, createBrowserMediaBridge added to factory re-export, HostMediaBridge type export added, MediaAction re-export from @napplet/nub-media added

## Decisions Made

- `setActiveSession?` signature extended with optional `actions?: readonly MediaAction[]` parameter — enables capabilities narrowing via bridge without adding a separate `setCapabilities` method. Backward-compatible (optional), satisfies zero-regression requirement.
- Silent-audio priming triggered in `setActiveSession` (first non-null call) rather than `setMetadata` — preserves Plan 27-01 test behavior where a session with no metadata still primes the audio element on creation.
- `setMetadata` called only through `setActive()` in session.create handler — prevents double-call race that caused a test failure when the service called `bridge.setMetadata` directly AND setActive() also called it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed double setMetadata call on session.create**
- **Found during:** Task 2 (new bridge-path test: `bridge.setMetadata is called with the initial metadata on media.session.create` expected exactly 1 call but got 2)
- **Issue:** `handleMessage` for `session.create` called `bridge.setMetadata(m.sessionId, m.metadata)` directly AND then `setActive()` which also calls `bridge.setMetadata` when entry.metadata is present — two calls total.
- **Fix:** Removed the direct `bridge.setMetadata` call in the session.create case; `setActive()` already mirrors metadata via `bridge.setMetadata` after `bridge.setActiveSession` has registered the sessionId.
- **Files modified:** `packages/services/src/media-service.ts`
- **Committed in:** `d3c8cb4` (fix applied before committing Task 1 after re-running tests post-Task-2)

**2. [Rule 1 - Bug] Fixed Plan 27-01 regression: capabilities narrowing no longer narrowed**
- **Found during:** Task 1 initial test run (3 failures: silent-audio, capabilities-narrowing, destroy)
- **Issue:** `createBrowserMediaBridge`'s initial `applyActionHandlers` applied all 5 handlers regardless of capabilities; also silent-audio was primed in `setMetadata` (missed sessions with no metadata)
- **Fix 1:** `setActiveSession(sessionId, actions?)` accepts optional actions param; `applyActionHandlers(actions)` narrows handlers to the declared set.
- **Fix 2:** Silent-audio priming moved to `setActiveSession` (first non-null call, checked via `sessionsActive === 0`).
- **Fix 3:** `setActiveSession?.(sessionId, entry.actions)` in capabilities handler re-invokes bridge with updated actions so narrowing takes effect.
- **Files modified:** `packages/services/src/media-service.ts`
- **Committed in:** `d3c8cb4`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — behavioral regressions corrected before commit)
**Impact on plan:** Both fixes were required for zero-regression. No scope creep; no architectural changes.

## Known Stubs

None — all HostMediaBridge methods are fully implemented in createBrowserMediaBridge; the hostBridge option is wired and tested; barrel exports are live. No placeholder values, hardcoded empties, or TODOs on any public surface.

## Self-Check

- `packages/services/src/media-service.ts` — FOUND (modified)
- `packages/services/src/media-service.test.ts` — FOUND (modified)
- `packages/services/src/index.ts` — FOUND (modified)
- Commit d3c8cb4 — FOUND
- Commit 3ea371c — FOUND

## Self-Check: PASSED
