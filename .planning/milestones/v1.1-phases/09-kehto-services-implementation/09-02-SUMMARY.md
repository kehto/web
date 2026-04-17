---
phase: 09-kehto-services-implementation
plan: "02"
subsystem: services
tags: [typescript, nip-5d, napplet, services, ifc, relay, envelope]

# Dependency graph
requires:
  - phase: 09-kehto-services-implementation
    plan: "01"
    provides: ServiceHandler interface typed for NappletMessage; routeServiceMessage rewritten; signer-service migrated
provides:
  - audio-service.ts fully IFC-envelope-routed with ifc.emit/ifc.event format
  - notification-service.ts fully IFC-envelope-routed with ifc.emit/ifc.event format
  - relay-pool-service.ts fully relay-NUB-envelope-routed with relay.subscribe/close/publish
  - cache-service.ts fully relay-NUB-envelope-routed with one-shot relay.subscribe pattern
  - coordinated-relay.ts fully relay-NUB-envelope-routed with dual-source dedup and unified EOSE
  - notification-service.test.ts updated to envelope-format assertions
  - Zero unknown[] references in all service handler files
  - Zero BusKind imports across all @kehto/services
affects: [shell-integration, demo-app, runtime-service-dispatch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IFC-routed service: check message.type === 'ifc.emit', route by topic.slice(prefix.length) action"
    - "Relay NUB service: switch on message.type (relay.subscribe/close/publish), read subId/filters/event as flat fields"
    - "Relay response: send({type: 'relay.event', subId, event}) and send({type: 'relay.eose', subId})"
    - "IFC response: send({type: 'ifc.event', topic: 'namespace:action', payload: {...}})"

key-files:
  created: []
  modified:
    - packages/services/src/audio-service.ts
    - packages/services/src/notification-service.ts
    - packages/services/src/notification-service.test.ts
    - packages/services/src/relay-pool-service.ts
    - packages/services/src/cache-service.ts
    - packages/services/src/coordinated-relay.ts

key-decisions:
  - "IFC-routed services (audio, notifications) read action from topic.slice(prefix.length) on ifc.emit messages"
  - "Relay NUB services (relay-pool, cache, coordinated-relay) switch on message.type for routing"
  - "Legacy helpers parseContent/extractTopic/createResponseEvent deleted — payload is already parsed in envelope format"
  - "Test file uses changes: unknown[] for onChange callback collection — valid test assertion, not wire format"

patterns-established:
  - "Audio/notifications: receive {type:'ifc.emit', topic:'domain:action', payload:{...}}, respond {type:'ifc.event', topic:'...', payload:{...}}"
  - "Relay services: receive {type:'relay.subscribe', subId, filters}, {type:'relay.close', subId}, {type:'relay.publish', event}"
  - "Relay services: respond {type:'relay.event', subId, event} and {type:'relay.eose', subId}"
  - "Coordinated relay: maybySendEose sends envelope when both cacheEose and relayEose flags set"

requirements-completed: [SVC-I03, SVC-I04]

# Metrics
duration: 3min
completed: 2026-04-07
---

# Phase 09 Plan 02: Remaining 5 Service Handlers Migration Summary

**All 5 remaining service handlers (audio, notifications, relay-pool, cache, coordinated-relay) migrated from NIP-01 arrays to NappletMessage envelope format; legacy helpers deleted; 17 notification tests updated and passing**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-07T23:05:53Z
- **Completed:** 2026-04-07T23:08:48Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- audio-service.ts: IFC-routed with `ifc.emit`/`ifc.event` envelopes; 3 legacy helpers deleted (parseContent, extractTopic, createResponseEvent); BusKind + NostrEvent imports removed
- notification-service.ts: same structural rewrite as audio; notification CRUD logic unchanged; 3 legacy helpers deleted
- notification-service.test.ts: all 17 tests rewritten from NIP-01 array format to envelope assertions; makeInterPaneEvent replaced with makeIfcEmit; BusKind/NostrEvent imports removed
- relay-pool-service.ts: NUB-domain relay service with type-based routing (relay.subscribe/close/publish); EOSE fallback timer preserved; relay.event/relay.eose responses
- cache-service.ts: one-shot query pattern preserved; relay.subscribe triggers query + EOSE; relay.publish stores best-effort
- coordinated-relay.ts: maybySendEose updated to send relay.eose envelope; deliver() sends relay.event; full dual-source dedup and cacheEose/relayEose coordination logic unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate audio + notification services (IFC-routed) and notification tests** - `d86a744` (feat)
2. **Task 2: Migrate relay-pool, cache, and coordinated-relay services** - `7d3e6dd` (feat)

## Files Created/Modified

- `packages/services/src/audio-service.ts` - IFC-routed; handleMessage reads ifc.emit envelopes; 3 helpers deleted; no BusKind
- `packages/services/src/notification-service.ts` - IFC-routed; handleMessage reads ifc.emit envelopes; 3 helpers deleted; no BusKind
- `packages/services/src/notification-service.test.ts` - 17 tests rewritten for envelope-format assertions
- `packages/services/src/relay-pool-service.ts` - relay.subscribe/close/publish routing; relay.event/relay.eose responses
- `packages/services/src/cache-service.ts` - one-shot relay.subscribe; relay.publish best-effort store
- `packages/services/src/coordinated-relay.ts` - maybySendEose envelope; deliver() envelope; dual-source logic intact

## Decisions Made

- `changes: unknown[]` in test onChange callbacks retained — these collect onChange invocation results, not wire-format arrays; they don't violate the "no unknown[] in service handler files" criterion
- No dual-mode path added — plan specifies clean break; audio/notification/relay services receive envelope-only

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. All TypeScript compilation errors from Plan 09-01 (expected, intentional) resolved by this plan.

## Known Stubs

None — all service operations are fully implemented.

## Next Phase Readiness

- @kehto/services is fully migrated to NappletMessage envelope format
- All 6 service handlers (signer from Plan 01, plus audio, notifications, relay-pool, cache, coordinated-relay from this plan) use envelope format
- pnpm build passes: 11/11 tasks successful
- Zero BusKind, zero unknown[], zero legacy helpers in any service file
- Ready for integration testing and shell usage

## Self-Check: PASSED

- FOUND: packages/services/src/audio-service.ts
- FOUND: packages/services/src/notification-service.ts
- FOUND: packages/services/src/notification-service.test.ts
- FOUND: packages/services/src/relay-pool-service.ts
- FOUND: packages/services/src/cache-service.ts
- FOUND: packages/services/src/coordinated-relay.ts
- FOUND commit: d86a744
- FOUND commit: 7d3e6dd

---
*Phase: 09-kehto-services-implementation*
*Completed: 2026-04-07*
