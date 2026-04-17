---
phase: 07-kehto-runtime-implementation
plan: "02"
subsystem: "@kehto/runtime"
tags: [nip-5d, nub-dispatch, auth-removal, handleMessage, envelope-guard]
dependency_graph:
  requires:
    - phase: 07-01
      provides: [createNubEnforceGate, resolveCapabilitiesNub, getEntryByWindowId, NappletMessage]
  provides:
    - handleMessage accepts NappletMessage envelopes only (no legacy NIP-01 arrays)
    - 4 NUB domain handler stubs (relay/signer/storage/ifc)
    - AUTH machinery fully removed from runtime.ts
    - createNip5dSessionEntry and findEnvelopeResponse test helpers
  affects:
    - packages/runtime/src/runtime.ts
    - packages/runtime/src/test-utils.ts
    - packages/runtime/src/dispatch.test.ts
    - packages/runtime/src/discovery.test.ts
tech_stack:
  added: []
  patterns: [NUB-domain-dispatch, envelope-guard, clean-break-no-dual-mode]
key_files:
  created: []
  modified:
    - packages/runtime/src/runtime.ts
    - packages/runtime/src/test-utils.ts
    - packages/runtime/src/dispatch.test.ts
    - packages/runtime/src/discovery.test.ts
key_decisions:
  - "NUB handler stubs respond with .error type suffix — Plan 03 will fill in the full implementations"
  - "Legacy NIP-01 test files replaced with NUB dispatch tests — old tests tested removed code"
  - "discoverySubscriptions Map removed — it was only populated by handleReq (deleted)"
  - "handleShellCommand and handleHotkeyForward kept — will be migrated in Phase 8 (shell)"
patterns-established:
  - "NUB envelope guard: typeof msg !== 'object' || !('type' in msg) — silent drop for non-envelopes"
  - "NUB domain dispatch: type.slice(0, dotIdx) extracts domain, switch routes to handler"
  - "Error response pattern: { type: originalType + '.error', id, error: reason } as NappletMessage"
requirements-completed: [RT-I01, RT-I02]

duration: ~5min
completed: "2026-04-07"
---

# Phase 07 Plan 02: NUB Dispatch Rewrite Summary

**AUTH machinery fully removed from runtime.ts (~269 lines deleted), handleMessage rewritten for NIP-5D envelope-only NUB domain dispatch with 4 stub handlers**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-07T22:12:20Z
- **Completed:** 2026-04-07T22:17:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Removed all AUTH code: pendingChallenges, pendingAuthQueue, authInFlight, handleRegister, handleAuth, sendChallenge, deriveKeypair, getOrCreateShellSecret, dispatchVerb
- Removed NIP-01 verb handlers: handleEvent, handleReq, handleClose, handleCount, handleSignerRequest, discoverySubscriptions
- Added createNubEnforceGate for windowId-based ACL enforcement in handleMessage
- Rewrote handleMessage for clean envelope-only NIP-5D dispatch (no dual-mode, no array fallback)
- Added 4 NUB domain handler stubs with .error response (Plan 03 implements full logic)
- Updated test-utils with NappletMessage support, createNip5dSessionEntry, findEnvelopeResponse helpers
- Replaced 2 legacy NIP-01 test files with NUB dispatch tests (32 tests passing)

## Task Commits

1. **Task 1: Remove AUTH machinery and rewrite handleMessage for NUB-only dispatch** - `d22cb0a` (feat)
2. **Task 2: Update test-utils.ts for NIP-5D envelope format** - `5a2bd22` (feat)

## Files Created/Modified

- `packages/runtime/src/runtime.ts` — Auth removed, handleMessage rewritten for envelope-only NUB dispatch, 4 handler stubs added
- `packages/runtime/src/test-utils.ts` — NappletMessage added, SentMessage widened, createNip5dSessionEntry/findEnvelopeResponse helpers added
- `packages/runtime/src/dispatch.test.ts` — Replaced legacy NIP-01 tests with NUB envelope guard and domain routing tests
- `packages/runtime/src/discovery.test.ts` — Replaced legacy discovery tests with service registry lifecycle tests

## Decisions Made

- NUB handler stubs respond with `type + '.error'` — consistent error pattern, easily replaced in Plan 03
- Legacy NIP-01 test files replaced — they tested removed code (AUTH handshake, REQ/COUNT/EVENT verbs) and would not compile
- `discoverySubscriptions` Map removed — was exclusively populated by `handleReq` which was deleted; keeping it would be dead code
- `handleShellCommand` and `handleHotkeyForward` kept — these are not NUB domains and will be migrated in Phase 8 (shell package)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript errors in test files calling removed sendChallenge**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** Both `dispatch.test.ts` and `discovery.test.ts` called `runtime.sendChallenge()` which was removed from the Runtime interface. All their tests used NIP-01 AUTH handshake patterns.
- **Fix:** Replaced both test files with NUB dispatch tests covering the new envelope guard and domain routing. Old tests were testing deleted code — keeping them was impossible.
- **Files modified:** `packages/runtime/src/dispatch.test.ts`, `packages/runtime/src/discovery.test.ts`
- **Verification:** 32 tests pass (3 test files)
- **Committed in:** d22cb0a (Task 1 commit)

**2. [Rule 1 - Bug] TypeScript error sending NappletMessage-shaped objects via sendToNapplet**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** `hooks.sendToNapplet` types `msg` as `unknown[] | NappletMessage` but TypeScript couldn't narrow `{ type: '...', id: '...', error: '...' }` to satisfy the union without explicit cast
- **Fix:** Added `as NappletMessage` cast on response objects in handler stubs and ACL denial path
- **Files modified:** `packages/runtime/src/runtime.ts`
- **Verification:** TypeScript compiles clean (exit 0)
- **Committed in:** d22cb0a (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — compilation bugs)
**Impact on plan:** Both auto-fixes necessary for compilation. Test file replacement was required — old tests only tested removed code and couldn't be adapted. No scope creep.

## Issues Encountered

None — all compilation issues resolved inline during Task 1.

## Known Stubs

| Stub | File | Description |
|------|------|-------------|
| `handleRelayMessage` | `packages/runtime/src/runtime.ts` | Returns `type.error` with 'not implemented'. Plan 03 implements full relay handler. |
| `handleSignerMessage` | `packages/runtime/src/runtime.ts` | Returns `type.error` with 'not implemented'. Plan 03 implements full signer handler. |
| `handleStorageMessage` | `packages/runtime/src/runtime.ts` | Returns `type.error` with 'not implemented'. Plan 03 implements full storage handler. |
| `handleIfcMessage` | `packages/runtime/src/runtime.ts` | Silent drop (IFC emit has no response). Plan 03 implements full IFC handler. |

These stubs are intentional — Plan 03 will implement the full handler logic. The stubs are not blocking the plan's goal (NUB dispatch routing works correctly; handlers just need implementation).

## Next Phase Readiness

- Plan 03 can implement full relay/signer/storage/ifc handlers — domain dispatch routing is complete
- All 4 handler entry points exist with correct signatures
- NUB enforce gate is wired and operational (ACL checks happen before handler dispatch)
- test-utils helpers ready for Plan 03 tests (createNip5dSessionEntry, findEnvelopeResponse)

## Self-Check: PASSED

- FOUND: packages/runtime/src/runtime.ts
- FOUND: packages/runtime/src/test-utils.ts
- FOUND: packages/runtime/src/dispatch.test.ts
- FOUND: packages/runtime/src/discovery.test.ts
- FOUND: .planning/phases/07-kehto-runtime-implementation/07-02-SUMMARY.md
- FOUND commit: d22cb0a (Task 1 - AUTH removal and NUB dispatch)
- FOUND commit: 5a2bd22 (Task 2 - test-utils update)

---
*Phase: 07-kehto-runtime-implementation*
*Completed: 2026-04-07*
