---
phase: 30-shell-ui-state-wiring
plan: 03
subsystem: ui
tags: [svg, sequence-diagram, dynamic-lanes, typescript, napplet-protocol]

# Dependency graph
requires:
  - phase: 26-real-keys-backend
    provides: NappletInfo interface and getNapplets() accessor in shell-host.ts
provides:
  - Dynamic lane derivation in renderSequenceDiagram (UI-03 fix)
  - deriveLanes() helper resolving windowId → napplet name
  - renderSequenceDiagram(messages, nappletInfos) signature propagated to debugger
affects:
  - 30-phase-close (UAT: sequence diagram surface now shows N lanes for N napplets)
  - 31-e2e-coverage (E2E-16 spec will assert ≥ 4 lanes post-boot)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pass nappletInfos map explicitly to renderSequenceDiagram for purity/testability (not calling getNapplets inside the renderer)"
    - "deriveLanes: alphabetical napplet split at midpoint with Shell always centred"
    - "laneX(i, count, vbWidth) = (i+1)/(count+1)*vbWidth for even edge-clear spacing"

key-files:
  created: []
  modified:
    - apps/demo/src/sequence-diagram.ts
    - apps/demo/src/debugger.ts

key-decisions:
  - "Explicit nappletInfos parameter (not getNapplets() import inside sequence-diagram.ts) keeps the renderer pure and testable"
  - "laneX spacing formula (i+1)/(count+1)*vbWidth preserves the 15/50/85% character for 3-lane fallback and extends cleanly to N lanes"
  - "Defensive fallback effectiveLanes=['Shell'] when no napplet names observed yet (empty message list)"

patterns-established:
  - "SVG lane diagram: drive lane count from runtime nappletInfos map, not compile-time constants"

requirements-completed: [UI-03]

# Metrics
duration: 12min
completed: 2026-04-19
---

# Phase 30 Plan 03: Dynamic Sequence-Diagram Lanes (UI-03) Summary

**Replaced hardcoded `LANE_NAMES=['Chat','Shell','Bot']` with `deriveLanes()` helper that resolves observed `msg.windowId` → napplet name via the `nappletInfos` map, producing alphabetically-ordered lanes with Shell always centred**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-19T23:30:00Z
- **Completed:** 2026-04-19T23:42:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Hardcoded `LANE_NAMES` and `LANE_PCTS` constants deleted; sequence-diagram.ts is now fully dynamic
- `deriveLanes(messages, nappletInfos)` helper added: scans messages for `windowId`, resolves to napplet names, alphabetical-sorts, splits at midpoint, always places Shell at centre
- `laneX(i, count, vbWidth)` and `laneIndexOf(lanes, name)` helpers added for coordinate computation
- `getLanePct()` replaced by `getLaneEndpoints(msg, lanes, nappletInfos, vbWidth)` returning absolute viewBox X-coords
- `renderSequenceDiagram()` signature updated to `(messages, nappletInfos)` — uses nappletInfos for dynamic lane derivation; SVG scales to any lane count
- `debugger.ts` updated: `getNapplets` imported from `shell-host.js`; call site passes `getNapplets()` as second argument
- Docblock rewritten to describe dynamic derivation (stale "Left: Chat / Center: Shell / Right: Bot" language removed)
- 49/0/0 Playwright baseline preserved; `pnpm build` and `pnpm type-check` exit 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Dynamic lane derivation in sequence-diagram.ts** - `b894786` (feat)

## Files Created/Modified

- `apps/demo/src/sequence-diagram.ts` — Major rewrite of lane layer: removed LANE_NAMES/LANE_PCTS, added deriveLanes/laneX/laneIndexOf/getLaneEndpoints helpers, updated renderSequenceDiagram signature, rewrote docblock
- `apps/demo/src/debugger.ts` — Added `getNapplets` import from shell-host.js; updated `renderSequenceDiagram(this.allMessages)` call to pass `getNapplets()`

## Decisions Made

- Explicit `nappletInfos` parameter preferred over calling `getNapplets()` inside sequence-diagram.ts: keeps the SVG renderer a pure function, easier to test in isolation.
- Lane X formula `(i+1)/(count+1)*vbWidth` chosen: produces the same 15/50/85% spacing for a 3-lane diagram and extends evenly for N lanes without edge crowding.
- Defensive fallback `effectiveLanes = ['Shell']` when `deriveLanes` returns empty (no messages or no windowId on any message), preventing a zero-lane SVG render.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The pre-existing TypeScript errors in `apps/demo/src/main.ts` and `apps/demo/src/shell-host.ts` (unrelated to this plan's files) are out of scope and were not introduced by this change. `pnpm type-check` at the root covers only the library packages (acl, runtime, shell, services), all of which pass. No type errors were introduced in `sequence-diagram.ts` or `debugger.ts`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UI-03 root cause addressed: `renderSequenceDiagram` now accepts and uses `nappletInfos` for dynamic lane derivation
- Phase-close orchestrator UAT (Playwright MCP) will confirm ≥ 4 lanes rendered after 10-napplet boot-storm
- Phase 31 E2E-16 spec can now assert lane count against the dynamic derivation

## Known Stubs

None - the dynamic lane derivation is fully wired. `deriveLanes()` produces real napplet names from the live `nappletInfos` map passed at call time.

---
*Phase: 30-shell-ui-state-wiring*
*Completed: 2026-04-19*
