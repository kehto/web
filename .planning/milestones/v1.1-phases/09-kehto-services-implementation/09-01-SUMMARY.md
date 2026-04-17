---
phase: 09-kehto-services-implementation
plan: "01"
subsystem: services
tags: [typescript, nip-5d, napplet, services, signer, envelope]

# Dependency graph
requires:
  - phase: 08-kehto-shell-implementation
    provides: NappletMessage type usage in SendToNapplet, shell bridge envelope handling
  - phase: 07-kehto-runtime-implementation
    provides: runtime.ts dispatch structure, ServiceHandler interface in types.ts
provides:
  - ServiceHandler interface typed for NappletMessage (breaking change from unknown[])
  - routeServiceMessage rewritten to route by message.type domain prefix and IFC topic prefix
  - signer-service.ts fully envelope-based with all 7 signer operations
  - Runtime signer and relay delegation sites unwrapped (no legacy array wrapping)
affects: [09-02, relay-pool-service, audio-service, notification-service, coordinated-relay, cache-service]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NappletMessage envelope routing: domain = message.type.split('.')[0], handler = services[domain]"
    - "Signer service: switch on message.type, respond with {type: 'signer.X.result'} or {type: 'signer.X.error'}"
    - "Consent gating: consentKinds.has(eventToSign.kind) && options.onConsentNeeded before signEvent"
    - "Error envelope: {type: '${message.type}.error', id: corrId, error: 'reason'}"

key-files:
  created: []
  modified:
    - packages/runtime/src/types.ts
    - packages/runtime/src/service-dispatch.ts
    - packages/runtime/src/runtime.ts
    - packages/services/src/signer-service.ts
    - packages/services/src/signer-service.test.ts

key-decisions:
  - "ServiceHandler.handleMessage is now NappletMessage-only — unknown[] removed, compile errors catch all missed migrations"
  - "routeServiceMessage routes NUB-domain by message.type prefix; IFC services by message.topic prefix on ifc.emit"
  - "Runtime signer delegation passes NappletMessage directly — legacy ['EVENT', {kind:29001,...}] wrapping removed"
  - "signer-service.ts switches on message.type for 7 operations, responds with typed .result/.error envelopes"
  - "Other service handlers (relay-pool, audio, notifications, cache, coordinated-relay) deferred to Plan 09-02"

patterns-established:
  - "Envelope routing: split message.type on '.', take [0] as domain key into services registry"
  - "Service error response: always {type: msg.type + '.error', id: corrId, error: 'reason'} — never NIP-01 arrays"
  - "Signer operation result fields: getPublicKey.result.pubkey, signEvent.result.event, getRelays.result.relays, nip04.encrypt.result.ciphertext, nip04.decrypt.result.plaintext"

requirements-completed: [SVC-I01, SVC-I02, SVC-I05]

# Metrics
duration: 8min
completed: 2026-04-07
---

# Phase 09 Plan 01: ServiceHandler Interface + Signer Migration Summary

**ServiceHandler retyped from unknown[] to NappletMessage; signer service migrated to 7-operation envelope format with consent gating and typed result/error responses**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-07T23:00:00Z
- **Completed:** 2026-04-07T23:03:35Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- ServiceHandler.handleMessage now accepts `NappletMessage` and `send: (msg: NappletMessage) => void` — TypeScript compile errors now catch any service handler still using `unknown[]`
- `routeServiceMessage` rewritten to route NUB-domain services by `message.type.split('.')[0]` and IFC-routed services by `message.topic` prefix on `ifc.emit` messages
- Runtime signer and relay delegation sites updated to pass `NappletMessage` directly, removing all legacy `['EVENT', {kind:29001,...}]` array wrapping
- signer-service.ts fully migrated: 7 operations via `switch (message.type)`, typed envelopes in/out, consent gating preserved, BusKind removed
- 17 signer tests rewritten for envelope format — all pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Update ServiceHandler interface + service-dispatch + runtime delegation sites** - `4a1bbc9` (feat)
2. **Task 2: Migrate signer-service.ts to envelope format + rewrite tests** - `455e5ee` (feat)

## Files Created/Modified

- `packages/runtime/src/types.ts` - ServiceHandler.handleMessage signature changed to NappletMessage; JSDoc updated
- `packages/runtime/src/service-dispatch.ts` - routeServiceMessage rewritten for NIP-5D envelope routing
- `packages/runtime/src/runtime.ts` - Signer and relay delegation sites pass NappletMessage directly
- `packages/services/src/signer-service.ts` - Full rewrite: NappletMessage envelope format, 7 operations, no BusKind
- `packages/services/src/signer-service.test.ts` - Tests rewritten for envelope format assertions (17 tests)

## Decisions Made

- ServiceHandler.handleMessage changed to NappletMessage (clean break) — compile errors from other service handlers are intentional; they will be fixed in Plan 09-02
- Runtime delegation sites pass `msg` directly to service handlers — no intermediate transformation at the runtime level
- signer-service unknown type switched to `default:` case returning `${message.type}.error` — handles any future unrecognized signer subtypes

## Deviations from Plan

None — plan executed exactly as written. The remaining TypeScript errors in `notification-service.ts`, `relay-pool-service.ts`, `audio-service.ts`, `cache-service.ts`, and `coordinated-relay.ts` are expected — these are scoped to Plan 09-02 per the `files_modified` frontmatter of this plan.

## Issues Encountered

None. The `pnpm type-check` command confirms errors only in service handlers not in scope for this plan, while `packages/runtime` and the signer service compile cleanly.

## Known Stubs

None — all signer operations are fully implemented, not stubbed.

## Next Phase Readiness

- Plan 09-02 can proceed: migrate relay-pool, audio, notification, cache, and coordinated-relay services to envelope format
- The ServiceHandler contract is established — all future service handlers must implement NappletMessage
- `routeServiceMessage` is ready for IFC service routing once audio/notification services are migrated

## Self-Check: PASSED

- FOUND: packages/runtime/src/types.ts
- FOUND: packages/runtime/src/service-dispatch.ts
- FOUND: packages/runtime/src/runtime.ts
- FOUND: packages/services/src/signer-service.ts
- FOUND: packages/services/src/signer-service.test.ts
- FOUND: .planning/phases/09-kehto-services-implementation/09-01-SUMMARY.md
- FOUND commit: 4a1bbc9
- FOUND commit: 455e5ee

---
*Phase: 09-kehto-services-implementation*
*Completed: 2026-04-07*
