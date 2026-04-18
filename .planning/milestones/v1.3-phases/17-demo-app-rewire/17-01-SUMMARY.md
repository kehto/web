---
phase: 17-demo-app-rewire
plan: 01
subsystem: ui
tags: [typescript, napplet, BusKind, demo, anti-term, NIP-5D]

# Dependency graph
requires:
  - phase: 16-harness-triage-playwright-infrastructure
    provides: Playwright helpers and ACL spec infrastructure in place
provides:
  - BusKind/AUTH_KIND anti-term clearance in apps/demo/src — zero functional references remain
  - DemoProtocolPath union updated to canonical names (identity-request, relay-publish-signed)
  - notification-demo.ts uses canonical ifc.emit NappletMessage envelopes (not NIP-01 BusKind arrays)
affects: [17-02, 17-03, 17-04, 17-05, 17-06, 17-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Explanatory comments allowed to reference removed anti-terms — must explicitly call out canonical replacement"
    - "Canonical envelope dispatch uses NappletMessage { type: 'ifc.emit', topic, payload } — no NIP-01 arrays"
    - "DemoProtocolPath uses domain-prefixed names (identity-request, relay-publish-signed) matching NIP-5D envelope domains"

key-files:
  created: []
  modified:
    - apps/demo/src/debugger.ts
    - apps/demo/src/flow-animator.ts
    - apps/demo/src/sequence-diagram.ts
    - apps/demo/src/demo-config.ts
    - apps/demo/src/signer-connection.ts
    - apps/demo/src/signer-demo.ts
    - apps/demo/src/shell-host.ts
    - apps/demo/src/notification-demo.ts
    - apps/demo/src/node-details.ts

key-decisions:
  - "Explanatory comments referencing removed anti-terms are permitted as documentation (grep pattern excludes them per DEMO-01 spec)"
  - "Removed 'sign:event' capability (deleted in v1.2 ACL) from identity-request/relay-publish-signed DEMO_PROTOCOL_PATHS entries; replaced with 'identity:read' and 'relay:write' respectively"
  - "notification-demo.ts dispatchNotificationAction now sends canonical NappletMessage ifc.emit envelopes instead of NIP-01 kind 29003 arrays"

patterns-established:
  - "Pattern 1: Anti-term removal pass — imports deleted first, then classifier branches replaced with literal-kind fallback, DemoProtocolPath renamed last"
  - "Pattern 2: ServiceHandler.handleMessage receives NappletMessage (type field required) not NIP-01 arrays"

requirements-completed:
  - DEMO-01

# Metrics
duration: 20min
completed: 2026-04-17
---

# Phase 17 Plan 01: Demo App Rewire — Anti-Term Clearance Summary

**Purged all BusKind/AUTH_KIND/window.nostr/signer-service/kind===29001 references from 9 apps/demo/src files; renamed DemoProtocolPath union to canonical identity-request/relay-publish-signed; wired notification-demo to ifc.emit envelopes**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-17T23:38:00Z
- **Completed:** 2026-04-17T23:58:55Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Removed BusKind/TOPICS imports and classifier branches from debugger.ts, flow-animator.ts, sequence-diagram.ts; replaced with literal kind 29003 fallback (Task 1)
- Removed 8 AUTH_KIND/BusKind.* entries from demo-config.ts CONSTANT_DEFS; updated signer-connection.ts JSDoc; rewrote signer-demo.ts header; renamed DemoProtocolPath union values and DEMO_PROTOCOL_PATHS entries in shell-host.ts; replaced BusKind.IPC_PEER dispatch in notification-demo.ts with canonical ifc.emit envelopes (Task 2)
- Baseline anti-term grep (`window.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]`) returns zero functional matches — all remaining matches are in explanatory comments explicitly calling out canonical replacements
- Demo builds cleanly with `pnpm --filter @kehto/demo build` (254 kB JS, 0 build errors)

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove BusKind/TOPICS imports and classifier logic from debugger.ts, flow-animator.ts, sequence-diagram.ts** - `202889d` (feat)
2. **Task 2: Remove BusKind entries from demo-config, update signer files, rename DemoProtocolPath union** - `5a894d8` (feat)

## Files Created/Modified

- `apps/demo/src/debugger.ts` — Removed `import { BusKind, TOPICS }` line; replaced SIGNER_REQUEST/SIGNER_RESPONSE/IPC_PEER branches with kind 29003 literal fallback; updated DEBUGGER_PATH_LABELS and pathFromReason to use renamed DemoProtocolPath values
- `apps/demo/src/flow-animator.ts` — Removed `import { BusKind }` line; deleted signer service detection branch from detectServiceTarget (signer-service deleted in v1.2)
- `apps/demo/src/sequence-diagram.ts` — Removed `import { BusKind, TOPICS }` line; replaced IPC_PEER/SIGNER_REQUEST/SIGNER_RESPONSE label branches with kind 29003 literal
- `apps/demo/src/demo-config.ts` — Removed 8 CONSTANT_DEFS entries (core.AUTH_KIND, core.BusKind.REGISTRATION, SIGNER_REQUEST, SIGNER_RESPONSE, IPC_PEER, HOTKEY_FORWARD, METADATA, SERVICE_DISCOVERY); added explanatory comment
- `apps/demo/src/signer-connection.ts` — Updated Nip07Signer JSDoc; updated buildNip07Adapter comment; renamed local `nostr` variable to `extensionSigner` in connectNip07; added D-01/D-02 framing comment
- `apps/demo/src/signer-demo.ts` — Replaced JSDoc header with canonical v1.2 framing (no kind 29001/29002 references)
- `apps/demo/src/shell-host.ts` — Renamed DemoProtocolPath union: 'signer-request' → 'identity-request', 'signer-response' → 'relay-publish-signed'; updated DEMO_PROTOCOL_PATHS entries with canonical explanations and corrected Capability values
- `apps/demo/src/notification-demo.ts` — Removed `import { BusKind }` line; replaced NIP-01 kind 29003 array dispatch in dispatchNotificationAction and requestList with canonical NappletMessage { type: 'ifc.emit', topic, payload } envelopes
- `apps/demo/src/node-details.ts` — Updated service node path check from 'signer-request'/'signer-response' to 'identity-request'/'relay-publish-signed'

## Decisions Made

- Explanatory comments that reference removed anti-terms are permitted — the plan explicitly allows "excluding explanatory comments that reference canonical replacements"
- `sign:event` capability was deleted in v1.2 ACL (capabilities.ts confirms it); replaced with `identity:read` for the identity-request path and `relay:write` for the relay-publish-signed path (Rule 1 bug fix)
- notification-demo.ts now dispatches via `NappletMessage { type: 'ifc.emit', topic: 'notifications:*', payload }` matching what notification-service.ts actually handles (type: 'ifc.emit' → action routing)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invalid 'sign:event' capability in DEMO_PROTOCOL_PATHS**
- **Found during:** Task 2 (shell-host.ts DemoProtocolPath rename)
- **Issue:** Plan specified `capability: 'sign:event'` for the renamed identity-request/relay-publish-signed entries, but 'sign:event' was removed from the Capability union in v1.2 (packages/acl/src/capabilities.ts explicitly states "The v1.1 `sign:event`, `sign:nip04`, `sign:nip44` strings were intentionally removed"). This caused TS2322 errors.
- **Fix:** Replaced `'sign:event'` with `'identity:read'` for identity-request (identity NUB reads) and `'relay:write'` for relay-publish-signed (relay write path)
- **Files modified:** apps/demo/src/shell-host.ts
- **Verification:** `grep -n "sign:event" apps/demo/src/shell-host.ts` returns zero matches; tsc reports no errors for shell-host.ts on the capability fields
- **Committed in:** 5a894d8 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** Essential fix — stale capability string from v1.1 would cause TS errors and mislead downstream plans about what capability governs identity reads. No scope creep.

## Known Stubs

None — this plan performs anti-term removal (comment and import cleanup) only. No data wiring or UI rendering was added that could be stubbed.

## Issues Encountered

- Pre-existing TypeScript errors in files outside the plan scope (acl-modal.ts, acl-panel.ts, main.ts, node-details.ts:147, shell-host.ts:376/663) were present before this plan executed. These errors are out-of-scope for 17-01 and are not introduced by our changes.

## Next Phase Readiness

- All 9 files are clean of functional BusKind/AUTH_KIND/window.nostr/signer-service references
- DemoProtocolPath union uses canonical names — downstream plans (17-02..17-07) can safely import from these files
- notification-demo.ts uses canonical envelope dispatch compatible with createNotificationService's ifc.emit handler
- Callsite count of renamed DemoProtocolPath values: 4 files updated (debugger.ts, shell-host.ts, node-details.ts, flow-animator.ts had no signer literals)

---
*Phase: 17-demo-app-rewire*
*Completed: 2026-04-17*
