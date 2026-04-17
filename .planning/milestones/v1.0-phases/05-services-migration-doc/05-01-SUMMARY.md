---
phase: 05-services-migration-doc
plan: 01
subsystem: documentation
tags: [migration, services, nip-5d, servicehandler, signer, audio, notifications, relay-pool, cache, coordinated-relay]

requires:
  - phase: 03-runtime-migration-doc
    provides: ServiceHandler interface change in RUNTIME-MIGRATION.md section 3.7 (Pitfall 5 reference)
  - phase: 01-gap-analysis
    provides: GAP-ANALYSIS.md section 5.4 (@kehto/services boundary contract, per-service migration table)

provides:
  - docs/SERVICES-MIGRATION.md with ServiceHandler interface change (SVC-01)
  - docs/SERVICES-MIGRATION.md with per-handler migration paths for all six services (SVC-02)
  - service-dispatch.ts routing rewrite documented (topic-prefix to message.type domain)
  - dual-mode transition strategy for services package

affects:
  - packages/services implementation phase
  - packages/runtime service-dispatch.ts migration
  - test files signer-service.test.ts, notification-service.test.ts

tech-stack:
  added: []
  patterns:
    - "NappletMessage envelope dispatch: services receive typed objects not NIP-01 arrays"
    - "IFC-routed services receive ifc.emit with topic prefix, not raw IPC_PEER events"
    - "Relay NUB services receive relay.* envelopes replacing REQ/CLOSE/EVENT verbs"

key-files:
  created:
    - docs/SERVICES-MIGRATION.md
  modified: []

key-decisions:
  - "IFC-routed services (audio, notifications) receive ifc.emit with topic prefix not a dedicated NUB domain — routing still uses topic prefix but from message.topic flat field"
  - "Coordinated relay registered as 'relay' domain so NUB prefix routing matches — Pattern A preferred over Pattern B"
  - "Three audio/notification helpers (parseContent, extractTopic, createResponseEvent) are eliminated entirely in NIP-5D — payload is already parsed"

patterns-established:
  - "IFC-routed service pattern: check message.type === 'ifc.emit', read message.topic, strip prefix, read message.payload"
  - "Relay NUB service pattern: switch on message.type (relay.subscribe/close/publish), read flat fields (subId, filters, event)"
  - "Error responses use typed envelopes: { type: 'operation.error', id, error } not ['OK', id, false, reason]"

requirements-completed: [SVC-01, SVC-02]

duration: 6min
completed: 2026-04-07
---

# Phase 05 Plan 01: Services Migration Doc Summary

**ServiceHandler interface change and per-handler migration paths for all six @kehto/services implementations (signer, audio, notifications, relay-pool, cache, coordinated-relay) from NIP-01 arrays to NIP-5D NappletMessage envelopes**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-07T18:10:09Z
- **Completed:** 2026-04-07T18:16:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Section 1 documents ServiceHandler interface change with old/new signatures, Pitfall 5 explanation (silent failure mechanism), service-dispatch.ts routing rewrite from topic-prefix to message.type domain, SendToNapplet widening, and dual-mode transition strategy
- Section 2.1 (signer) documents all seven operations with old kind-29001 tag-extraction path vs new signer.* envelope switch, consent gating preservation, and error format change
- Sections 2.2-2.6 document per-handler migration for audio (IFC-routed), notifications (IFC-routed), relay-pool (relay NUB), cache (relay NUB), and coordinated-relay (composite)
- Section 3 provides file impact matrix for all eight affected files, recommended migration order, and test update strategy

## Task Commits

Each task was committed atomically:

1. **Task 1: ServiceHandler interface change and signer migration** - `bab3063` (feat)
2. **Task 2: Sections 2.2-2.6 and migration summary** - `458bb9f` (feat)

**Plan metadata:** (pending final metadata commit)

## Files Created/Modified

- `docs/SERVICES-MIGRATION.md` — Complete services migration guide: ServiceHandler interface change (SVC-01) + per-handler migration paths for all six services (SVC-02)

## Decisions Made

- IFC-routed services (audio, notifications) receive `ifc.emit` envelopes with `topic` prefix matching, not a dedicated NUB domain — routing is still by topic prefix but from `message.topic` flat field, not `event.tags`
- Coordinated relay should be registered as `'relay'` domain key to match NUB prefix routing
- Three shared helpers in audio/notifications (`parseContent`, `extractTopic`, `createResponseEvent`) are fully eliminated — `message.payload` is already parsed, `message.topic` is a flat field, responses are plain objects

## Deviations from Plan

None — plan executed exactly as written. Source files were read and verified before writing; all line references and code structure accurately reflect the actual implementations.

One pre-execution deviation: the worktree was behind `main` and lacked `RUNTIME-MIGRATION.md` and `SHELL-MIGRATION.md`. A fast-forward merge from `main` was performed before starting Task 1. This was a setup step, not a plan deviation.

## Issues Encountered

None — all source files readable, all cross-references accurate, GAP-ANALYSIS.md section 5.4 and RUNTIME-MIGRATION.md sections 3.2/3.3/3.5/3.7 provided complete context.

## User Setup Required

None — documentation-only plan, no external services or configuration required.

## Next Phase Readiness

- `docs/SERVICES-MIGRATION.md` is complete and cross-references GAP-ANALYSIS.md section 5.4 and RUNTIME-MIGRATION.md sections 3 and Pitfall 5
- Phase 05 is complete — all five migration documents (ACL, runtime, shell, services) and gap analysis are now produced
- Implementation phases (migrating actual packages) can begin with the migration docs as specifications

---
*Phase: 05-services-migration-doc*
*Completed: 2026-04-07*
