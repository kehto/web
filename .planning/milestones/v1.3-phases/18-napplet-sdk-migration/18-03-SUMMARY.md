---
phase: 18-napplet-sdk-migration
plan: 03
subsystem: testing
tags: [playwright, e2e, napplet, sdk, ifc, ipc, auth]

# Dependency graph
requires:
  - phase: 18-napplet-sdk-migration/18-01
    provides: bot napplet SDK migration with #status-text DOM hook and ipc.on('chat:message') handler
  - phase: 18-napplet-sdk-migration/18-02
    provides: chat napplet SDK migration with #chat-status DOM hook and ipc.emit('chat:message') + ipc.on('bot:response') handler
provides:
  - "tests/e2e/napplet-auth.spec.ts: E2E-07 napplet-auth Layer-B spec — both chat + bot reach 'authenticated'"
  - "tests/e2e/ifc-roundtrip.spec.ts: E2E-07 ifc-roundtrip Layer-B spec — chat→bot→chat envelope round trip via ipc API"
affects:
  - 18-napplet-sdk-migration/18-04
  - 19-core-domain-napplets

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Demo-targeted spec pattern: test.use({ baseURL: 'http://localhost:4174' }) + test.describe.configure({ mode: 'serial' }) + demoBeforeEach + in-iframe DOM sentinels"
    - "Dual-iframe auth gate: await both #chat-status and #status-text before triggering IFC round trip"
    - "Anti-term filter: ANTI_TERM_RE captures window.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]"

key-files:
  created:
    - tests/e2e/napplet-auth.spec.ts
    - tests/e2e/ifc-roundtrip.spec.ts
  modified: []

key-decisions:
  - "frameLocator(...).locator(...).toContainText(..., { timeout }) internal retry is sufficient — no manual expect.poll needed for in-iframe DOM sentinels"
  - "ifc-roundtrip gates on both napplets reaching 'authenticated' before triggering round trip — prevents race condition where bot hasn't subscribed yet"
  - "Match '[bot]' prefix only (not exact reply text) — keeps spec stable if future plans enrich bot response logic"

patterns-established:
  - "Layer-B spec dual-auth gate: await chatFrame + botFrame authenticated before triggering IFC traffic"
  - "All demo-targeted specs use demoBeforeEach (not aclBeforeEach or waitForNappletReady)"

requirements-completed: [E2E-07]

# Metrics
duration: 2min
completed: 2026-04-18
---

# Phase 18 Plan 03: Napplet Auth + IFC Round-Trip E2E Specs Summary

**Two Playwright Layer-B specs locking the @napplet/sdk migration: napplet-auth asserts both iframes reach 'authenticated', ifc-roundtrip proves the chat→bot→chat ipc envelope path end-to-end at :4174**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-18T00:44:35Z
- **Completed:** 2026-04-18T00:46:24Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `tests/e2e/napplet-auth.spec.ts` with 2 tests asserting #chat-status and #status-text reach 'authenticated' via iframe sentinels at :4174
- Created `tests/e2e/ifc-roundtrip.spec.ts` with 1 test proving the full chat→bot→chat ipc.emit/on envelope round trip via the demo shell bridge
- All 3 specs pass clean (2 passed in napplet-auth, 1 passed in ifc-roundtrip, 3 passed combined run)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create napplet-auth.spec.ts** - `aeb64c3` (test)
2. **Task 2: Create ifc-roundtrip.spec.ts** - `e3b23e9` (test)

## Files Created/Modified
- `tests/e2e/napplet-auth.spec.ts` — E2E-07 napplet-auth Layer-B spec; 2 tests checking #chat-status and #status-text in sandboxed iframes
- `tests/e2e/ifc-roundtrip.spec.ts` — E2E-07 ifc-roundtrip Layer-B spec; 1 test proving chat→bot→chat ipc round trip with [bot] reply in #messages

## Decisions Made

- `frameLocator(...).locator(...).toContainText(..., { timeout })` provides built-in Playwright retry — no `expect.poll` wrapper needed for in-iframe DOM sentinels.
- `ifc-roundtrip.spec.ts` gates on both napplets' authenticated state before triggering the round trip, preventing a race where bot hasn't subscribed via `ipc.on('chat:message')` yet.
- Match `[bot]` prefix only (not `"hey there!"`) — decouples the spec from bot response content, allowing Plan 18-04+ to enrich bot logic without breaking the regression gate.

## Deviations from Plan

None — plan executed exactly as written. File contents matched the plan's exact structure; both specs passed first run.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None — both specs assert live runtime behavior; no placeholder or stub data flows to the assertions.

## Next Phase Readiness

- E2E-07 napplet-auth + ifc-roundtrip subsets covered and passing against SDK-migrated napplets from Plans 18-01 + 18-02.
- Plan 18-04 (iteration loop gate) can incorporate these specs into the full `pnpm test:e2e` cycle without further changes.
- No blockers for Phase 19 (Core-Domain Napplets).

## Self-Check: PASSED

---
*Phase: 18-napplet-sdk-migration*
*Completed: 2026-04-18*
