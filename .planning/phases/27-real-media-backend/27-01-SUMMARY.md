---
phase: 27-real-media-backend
plan: 01
subsystem: services
tags: [navigator.mediaSession, media-service, nub-media, multi-session, silent-audio, setActionHandler, media.command]

requires:
  - phase: 26-real-keys-backend
    provides: Three-registry + per-window send-capture + destroy() pattern (structural twin for media-service)

provides:
  - Real navigator.mediaSession integration in @kehto/services media-service with metadata/playbackState mirroring
  - setActionHandler installation for 5 OS transport actions with media.command emission to owning napplet
  - Multi-session registry with last-active-wins semantics and silent-audio prime
  - MockMediaSession + MockDocument test helpers for Node-safe unit testing
  - Comprehensive unit suite covering all real-backend behaviors (25 tests, 471 total)

affects:
  - 27-02 (HostMediaBridge interface — media-service.ts is the browser reference impl)
  - 27-03 (media-controller demo napplet exercises this service via demo shell-host.ts)
  - 27-04 (E2E-13 Layer-B spec asserts navigator.mediaSession integration end-to-end)

tech-stack:
  added: []
  patterns:
    - MediaSessionTarget injection pattern (mirrors listenerTarget from keys-service.ts) for Node/test-safe navigator.mediaSession access
    - Three-registry pattern: sessionRegistry (sessionId->entry) + windowSessions (windowId->Set<sessionId>) + sendHandles (windowId->send) — exact parallel to keys-service.ts
    - Last-active-wins with monotonic touchCounter for deterministic session promotion on destroy
    - MockMediaSession + createMockDocument() test helpers for DOM-free unit testing of MediaSession API usage
    - Action mapping matrix ReadonlyArray<[domAction, nubAction]> for O(1) setActionHandler→media.command routing

key-files:
  created: []
  modified:
    - packages/services/src/media-service.ts
    - packages/services/src/media-service.test.ts

key-decisions:
  - "MediaSessionTarget uses optional details? parameter to satisfy both real DOM MediaSession (always passes object) and test mocks (may omit) — fixes TypeScript structural incompatibility without unsafe casting"
  - "Stub-language scrubbed from docblock and descriptor: 'stub-level' and 'stub)' references eliminated; file now documents the real navigator.mediaSession mirror semantics"
  - "MEDIA_SERVICE_VERSION bumped 1.0.0 -> 1.1.0 to signal real-backend transition (non-breaking on-the-wire but semantically significant)"

patterns-established:
  - "Media-service three-registry pattern mirrors keys-service.ts exactly: sessionRegistry/windowSessions/sendHandles; onWindowDestroyed cleanup path is identical in structure"
  - "documentTarget: null suppresses silent-audio prime in unit tests; mediaSessionTarget: mockObj enables mock-driven action-handler testing without DOM or navigator"

requirements-completed:
  - MEDIA-01

duration: 6min
completed: 2026-04-19
---

# Phase 27 Plan 01: Real Media Backend — media-service.ts Summary

**navigator.mediaSession mirror with 5-action setActionHandler matrix, media.command push via per-window send capture, silent-audio prime, and last-active-wins multi-session registry**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-19T17:09:08Z
- **Completed:** 2026-04-19T17:15:04Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced stub `createMediaService()` body with real navigator.mediaSession integration (three-registry pattern, per-window send capture, action-handler matrix, media.command emission)
- Implemented last-active-wins multi-session semantics: any session.create or media.state report promotes the reporting session to active; destroy of active promotes next-most-recent by lastTouched monotonic counter
- Augmented test suite with 15 new passing tests (MockMediaSession + MockDocument helpers) covering all real-backend behaviors; 25 media-service tests total, 471 suite total

## Task Commits

1. **Task 1: Real media-service implementation** — `50c2589` (feat)
2. **Task 2: Augmented test suite with MockMediaSession coverage** — `fb267cd` (test)

## Files Created/Modified

- `packages/services/src/media-service.ts` — Rewritten: stub->real navigator.mediaSession mirror; SessionEntry type; sessionRegistry/windowSessions/sendHandles Maps; activeSessionId + touchCounter; silentAudioEl prime; setActionHandler install for play/pause/nexttrack/previoustrack/seekto; media.command envelope push; onWindowDestroyed cleanup; destroy() teardown; MediaSessionTarget/documentTarget injection; MEDIA_SERVICE_VERSION 1.1.0
- `packages/services/src/media-service.test.ts` — Augmented: createMockMediaSession() and createMockDocument() helpers added; 8 new describe blocks (navigator.mediaSession integration, media.command emission, action mapping matrix, last-active-wins, status mirroring, capabilities narrowing, destroy promotion, onWindowDestroyed, destroy() teardown); all 10 original stub-era tests preserved

## Decisions Made

- `MediaSessionTarget.setActionHandler` uses `details?` (optional) to satisfy TypeScript structural compatibility between the real DOM MediaSession (which always passes a details object) and test mocks (which may omit it). This avoids unsafe `as` casting.
- Version bumped 1.0.0 → 1.1.0 to signal stub→real transition. The on-wire envelope shape (`media.session.create.result`) is preserved bit-for-bit; no downstream SDK change required.
- Docblock and descriptor scrubbed of "stub-level" language per acceptance criteria anti-grep.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed MediaSessionTarget type incompatibility**
- **Found during:** Task 1 (after writing implementation, running type-check)
- **Issue:** `MediaSessionTarget.setActionHandler` handler parameter used `details` (required) but the MockMediaSession in the test used `details?` (optional). TypeScript rejected the structural assignment at every `createMediaService({ mediaSessionTarget: mock.target })` call (12+ errors).
- **Fix:** Changed `MediaSessionTarget.setActionHandler` handler parameter from `(details: {...})` to `(details?: {...})` — optional. The real DOM impl always passes an object; `details?.seekTime` optional chaining was already in place so the behavior change is zero.
- **Files modified:** `packages/services/src/media-service.ts`
- **Verification:** `pnpm --filter @kehto/services type-check` exits 0
- **Committed in:** `50c2589` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed `service.onWindowDestroyed` call in test (TS2722)**
- **Found during:** Task 2 type-check pass
- **Issue:** `ServiceHandler.onWindowDestroyed` is defined as optional (`?`) in the runtime types. TypeScript emitted TS2722 ("Cannot invoke an object which is possibly 'undefined'") at the direct call `service.onWindowDestroyed('win-A')`.
- **Fix:** Changed to optional-chaining call `service.onWindowDestroyed?.('win-A')`. The service always implements it, so runtime behavior is identical.
- **Files modified:** `packages/services/src/media-service.test.ts`
- **Verification:** Type-check exits 0; test passes.
- **Committed in:** `fb267cd` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — type errors)
**Impact on plan:** Both fixes were necessary for type-check correctness. Zero behavior change. No scope creep.

## Issues Encountered

- `pnpm --filter @kehto/services test` runs the turbo `test` task, which requires `build` first and services has no `test` script (returns exit 0 silently). Tests actually run via `pnpm test:unit` (root vitest). Plan verification commands were adapted accordingly; behavior matches the v1.4-23-02 canonical test-invocation decision.

## Known Stubs

None — the plan's goal (real navigator.mediaSession integration) is fully achieved. No placeholder values, hardcoded empties, or TODOs flow to any runtime surface.

## Next Phase Readiness

- `createMediaService()` now returns `ServiceHandler & { destroy(): void }` — the real browser implementation is ready for `shell-host.ts` wiring (Plan 27-02/27-03)
- `HostMediaBridge` interface extraction (Plan 27-02) can now extract the internal browser logic from this real implementation as `createBrowserMediaBridge()`
- media-controller demo napplet (Plan 27-03) can exercise this service via the existing `createMediaService()` factory call in shell-host.ts
- E2E-13 (Plan 27-04) can assert `navigator.mediaSession.metadata.title` and `.playbackState` against the real implementation

---
*Phase: 27-real-media-backend*
*Completed: 2026-04-19*
