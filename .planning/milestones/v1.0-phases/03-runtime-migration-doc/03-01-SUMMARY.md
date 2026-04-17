---
phase: 03-runtime-migration-doc
plan: 01
subsystem: documentation
tags: [runtime, nip-5d, dispatch, auth, nub, migration]

requires:
  - phase: 01-gap-analysis
    provides: GAP-ANALYSIS.md section 5.2 runtime boundary contract and AUTH removal scope
  - phase: 02-acl-migration-doc
    provides: ACL-MIGRATION.md section 2 resolveCapabilitiesNub pseudocode and capability mapping

provides:
  - docs/RUNTIME-MIGRATION.md sections 1-2 with NUB dispatch design and AUTH removal scope

affects:
  - 03-runtime-migration-doc-02 (handler rewrites and session identity anchor)
  - 04-shell-migration-doc (depends on runtime dispatch contract)
  - 05-services-migration-doc (depends on ServiceHandler interface changes from dispatch migration)

tech-stack:
  added: []
  patterns:
    - "Domain-prefix NUB dispatch: msg.type.split('.')[0] → domain handler switch"
    - "Dual-mode dispatch: NUB envelope path first, legacy array path fallback"
    - "resolveCapabilitiesNub: maps NUB msg.type strings to capability strings instead of NIP-01 verbs"

key-files:
  created:
    - docs/RUNTIME-MIGRATION.md
  modified: []

key-decisions:
  - "Dual-mode dispatch is the correct transition strategy: NUB path checked first, legacy array path as fallback — NIP-5D napplets bypass AUTH queue entirely"
  - "AUTH removal is phased: Phase 1 adds NUB path (no AUTH touch), Phase 2 makes AUTH optional for legacy napplets, Phase 3 removes AUTH entirely"
  - "Source-based identity (MessageEvent.source) replaces AUTH as security boundary; originRegistry.register() must be called synchronously at iframe creation"
  - "resolveCapabilitiesNub() reuses relay:write/relay:read for ifc.emit/subscribe — consistent with ACL-MIGRATION.md section 2 IFC capability note"

requirements-completed: [RT-01, RT-02]

duration: 15min
completed: 2026-04-07
---

# Phase 3 Plan 1: Runtime Migration Doc (Sections 1-2) Summary

**NUB domain-prefix dispatch design and complete AUTH removal inventory documented with exact line numbers from runtime.ts, phased removal strategy, and security implications of source-based identity**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-07T18:00:00Z
- **Completed:** 2026-04-07T18:13:03Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Section 1: NUB dispatch design with before/after verb-switch vs domain-prefix comparison, dual-mode transition pattern, and complete `msg.type` → capability mapping table for all 19 NUB message types
- Section 2: AUTH removal inventory with exact line numbers for every AUTH-related symbol in runtime.ts (22 entries), plus supporting modules; code volume estimated at ~269 of 1119 lines (~24%)
- Section 2: phased removal strategy (3 phases) with explicit connection to PITFALLS.md Pitfall 2 avoidance, and security implications of source-based identity replacement
- Placeholder sections 3 and 4 for Plan 02 continuity

## Task Commits

1. **Task 1: Write RUNTIME-MIGRATION.md sections 1-2** - `a32b073` (feat)

**Plan metadata:** *(pending final metadata commit)*

## Files Created/Modified

- `docs/RUNTIME-MIGRATION.md` — Runtime migration doc with sections 1-2 (NUB dispatch design, AUTH removal scope) and placeholder sections 3-4

## Decisions Made

- Dual-mode dispatch is the correct transition strategy: NUB path checked first, legacy array path as fallback — NIP-5D napplets bypass AUTH queue entirely without touching AUTH infrastructure in Phase 1
- AUTH removal is phased (3 phases) to avoid breaking `@napplet/shim` v0.1.x users while fixing NIP-5D napplets immediately
- Source-based identity (`MessageEvent.source`) replaces AUTH as the security boundary; `originRegistry.register()` must be synchronous before iframe load
- `resolveCapabilitiesNub()` reuses `relay:write`/`relay:read` for `ifc.emit`/`ifc.subscribe` — consistent with ACL-MIGRATION.md section 2 IFC capability note (no new capability bits needed)
- AUTH code volume: ~24% of runtime.ts (269 of 1119 lines), not 40% as GAP-ANALYSIS estimated — the 40% figure was a broader estimate including ancillary usage patterns

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (handler rewrites for envelope format + SessionEntry identity anchor) has clear inputs from Section 1's dispatch design and Section 2's removal inventory
- The capability mapping table in Section 1.4 serves as the authoritative reference for `resolveCapabilitiesNub()` implementation in Plan 02
- The phased removal strategy in Section 2.4 defines the exact scope boundary for Plan 02 (Phase 1 of removal strategy = Plan 02's NUB handler additions)

---
*Phase: 03-runtime-migration-doc*
*Completed: 2026-04-07*
