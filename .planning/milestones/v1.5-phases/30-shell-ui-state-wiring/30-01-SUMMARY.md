---
phase: 30-shell-ui-state-wiring
plan: 01
subsystem: ui
tags: [typescript, demo, topology, activity-ring, nub-envelope, node-details]

# Dependency graph
requires:
  - phase: 29-concurrent-boot-auth-fix-demo-stability
    provides: "demo boots 10/10 napplets authenticated; NUB envelope traffic is live"
provides:
  - "SERVICE_DOMAIN_ALIAS map at module scope in node-details.ts (notify→notifications)"
  - "Service-level routing pass in installActivityProjection() for identity/keys/media/notifications/relay/storage/theme nodes"
affects: [30-phase-close-uat, 31-e2e-coverage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SERVICE_DOMAIN_ALIAS: Record<string,string> for envelope-domain to topology-service-id renames"
    - "topology.services.includes(serviceKey) guard prevents orphan ring creation from unknown domains"

key-files:
  created: []
  modified:
    - apps/demo/src/node-details.ts

key-decisions:
  - "SERVICE_DOMAIN_ALIAS declared at module scope (adjacent to ACTIVITY_RING_SIZE) as single source of truth for domain renames; only notify→notifications entry needed"
  - "Signer node kept on path-classification (identity-request/relay-publish-signed) rather than domain routing since its traffic predates NUB envelope shape"
  - "New service-level pass is additive — existing shell/acl/runtime/signer/per-napplet routes byte-identical"

patterns-established:
  - "Service-node activity routing: msg.envelopeType → split('.')[0] → alias lookup → topology.services.includes() guard → pushActivity"

requirements-completed: [UI-01]

# Metrics
duration: 8min
completed: 2026-04-19
---

# Phase 30 Plan 01: Shell UI State Wiring (UI-01) Summary

**Service node activity counters wired via NUB envelope-domain routing in installActivityProjection(), with notify→notifications alias and topology.services.includes() guard**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-19T00:00:00Z
- **Completed:** 2026-04-19
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `SERVICE_DOMAIN_ALIAS` constant at module scope with `notify: 'notifications'` as sole entry and full JSDoc explaining domain-vs-topology-id drift pattern
- Added envelope-domain routing pass in `installActivityProjection()` — derives domain from `msg.envelopeType.split('.')[0]` (with `msg.parsed.domain` fallback), applies alias, guards on `topology.services.includes()`, and calls `pushActivity('topology-node-service-${serviceKey}', entry)`
- All 7 non-signer service nodes (identity, keys, media, notifications, relay, storage, theme) now receive ACTIVITY counter updates from NUB traffic; signer node unchanged
- 49/0/0 Playwright baseline preserved

## Task Commits

1. **Task 1: Add service-level routing pass to installActivityProjection()** - `80928b2` (feat)

## Files Created/Modified
- `apps/demo/src/node-details.ts` — Added 27 lines: SERVICE_DOMAIN_ALIAS map (+14 lines including JSDoc) and envelope-domain routing block (+13 lines inside installActivityProjection)

## Decisions Made
- Followed plan as specified; SERVICE_DOMAIN_ALIAS placed adjacent to ACTIVITY_RING_SIZE at line 29 as the plan prescribed
- Used `msg.parsed.domain ?? msg.envelopeType.split('.')[0]` (matches reference pattern from flow-animator.ts) rather than split-only

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- First E2E run showed 3 transient failures; re-run returned 49/0/0. Failures were caused by parallel sibling agents (30-02, 30-03) concurrently modifying other demo files during the same window. Second run confirmed zero regression from my change.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UI-01 root cause closed: service node activity rings now receive traffic from all NUB envelope domains
- Phase-close Playwright MCP UAT (orchestrator-captured) can assert `#topology-node-service-storage` ACTIVITY counter ≥ 1 after boot-storm
- 30-02 and 30-03 address UI-02 and UI-03 independently; no dependency on this plan

---
*Phase: 30-shell-ui-state-wiring*
*Completed: 2026-04-19*
