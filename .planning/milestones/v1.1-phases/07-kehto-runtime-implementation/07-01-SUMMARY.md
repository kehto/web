---
phase: 07-kehto-runtime-implementation
plan: "01"
subsystem: "@kehto/runtime"
tags: [types, enforcement, session-registry, nip-5d, tdd]
dependency_graph:
  requires: [06-02-SUMMARY.md]
  provides: [SessionEntry.identitySource, SendToNapplet NappletMessage, createNubEnforceGate, getEntryByWindowId]
  affects: [packages/runtime/src/types.ts, packages/runtime/src/enforce.ts, packages/runtime/src/session-registry.ts, packages/runtime/src/index.ts]
tech_stack:
  added: []
  patterns: [TDD-red-green, re-export-pattern, windowId-identity-resolution]
key_files:
  created: [packages/runtime/src/types.test.ts]
  modified:
    - packages/runtime/src/types.ts
    - packages/runtime/src/session-registry.ts
    - packages/runtime/src/enforce.ts
    - packages/runtime/src/index.ts
    - packages/runtime/src/runtime.ts
    - packages/runtime/src/test-utils.ts
decisions:
  - identitySource uses 'auth'|'source' discriminant per RT-I04 spec — discriminant field preferred over optional fields
  - createNubEnforceGate resolves identity by windowId (not pubkey) for NIP-5D sessions where pubkey is ''
  - re-export pattern chosen for resolveCapabilitiesNub (export from @kehto/acl) rather than re-implementing
  - byWindowIdEntry added as a parallel map in createSessionRegistry to avoid breaking pubkey-indexed lookup
metrics:
  duration: "~3 minutes"
  completed_date: "2026-04-07T22:10:04Z"
  tasks_completed: 2
  files_changed: 6
---

# Phase 07 Plan 01: NIP-5D Type Foundation Summary

NIP-5D type contracts established: SessionEntry identity discriminant, NUB enforcement gate via windowId, and NappletMessage envelope support throughout the runtime type layer.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Failing TDD tests for NIP-5D type contracts | 0f30a3a | packages/runtime/src/types.test.ts |
| 1 (GREEN) | Update type contracts for NIP-5D envelope format | bee90d6 | types.ts, session-registry.ts, runtime.ts, test-utils.ts |
| 2 | NUB enforcement gate and export new symbols | cf23b42 | enforce.ts, index.ts |

## What Was Built

### Task 1: Type Contract Updates (TDD)

**`packages/runtime/src/types.ts`**
- Added `NappletMessage` import from `@napplet/core`
- `SessionEntry.identitySource: 'auth' | 'source'` — discriminant field for NIP-5D vs legacy AUTH sessions
- `SendToNapplet` widened to `(windowId, msg: unknown[] | NappletMessage) => void`
- `AclCheckEvent.message` widened to `unknown[] | NappletMessage`
- `@deprecated` JSDoc added to `RuntimeAdapter.shellSecretPersistence`
- NIP-5D context note added to `RuntimeAdapter.auth` JSDoc
- `NappletMessage` re-exported at module bottom for consumer convenience

**`packages/runtime/src/session-registry.ts`**
- `getEntryByWindowId(windowId: string): SessionEntry | undefined` added to interface
- `byWindowIdEntry` map added to implementation (parallel to existing `byWindowId` which only stores pubkey string)
- `register()`, `unregister()`, `clear()` all updated to maintain `byWindowIdEntry`

### Task 2: NUB Enforcement Gate

**`packages/runtime/src/enforce.ts`**
- `NubMessage` imported from `@kehto/acl`
- `resolveCapabilitiesNub` and `NubMessage` re-exported from `@kehto/acl`
- `NubEnforceConfig` interface added for windowId-based enforcement
- `createNubEnforceGate()` factory added — resolves identity by windowId (not pubkey), enabling NIP-5D enforcement where `pubkey = ''`

**`packages/runtime/src/index.ts`**
- `createNubEnforceGate`, `resolveCapabilitiesNub`, `NubMessage` added to enforcement exports
- `NubEnforceConfig` added to type exports
- `NappletMessage` added to types re-export block

### Regression Fixes (Rule 1 — auto-fix)

- `runtime.ts:393` — `SessionEntry` literal missing `identitySource`: added `identitySource: 'auth'`
- `test-utils.ts:192` — `sendToNapplet` callback type narrowed to `unknown[]` incompatible with widened `SendToNapplet`: widened parameter type

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] runtime.ts SessionEntry literal missing identitySource**
- **Found during:** Task 1 GREEN — TypeScript compilation
- **Issue:** `SessionEntry` literal at `runtime.ts:393` was missing the now-required `identitySource` field
- **Fix:** Added `identitySource: 'auth'` (correct — this is the legacy AUTH path)
- **Files modified:** `packages/runtime/src/runtime.ts`
- **Commit:** bee90d6

**2. [Rule 1 - Bug] test-utils.ts sendToNapplet type incompatibility**
- **Found during:** Task 1 GREEN — TypeScript compilation
- **Issue:** `sendToNapplet` callback typed `(windowId, msg: unknown[]) => void` — not assignable to widened `SendToNapplet`
- **Fix:** Widened the parameter type to `unknown[] | NappletMessage` with internal cast
- **Files modified:** `packages/runtime/src/test-utils.ts`
- **Commit:** bee90d6

**3. [Rule 2 - Cleanup] Removed unnecessary local import of resolveCapabilitiesNub**
- **Found during:** Task 2 review
- **Issue:** Importing `resolveCapabilitiesNub` locally was redundant alongside the `export ... from '@kehto/acl'` re-export
- **Fix:** Removed the local import, keeping only `import type { NubMessage }` needed for function signatures
- **Commit:** cf23b42

## Known Stubs

None — all type contracts are complete and functional.

## Self-Check: PASSED

- FOUND: packages/runtime/src/types.ts
- FOUND: packages/runtime/src/session-registry.ts
- FOUND: packages/runtime/src/enforce.ts
- FOUND: packages/runtime/src/index.ts
- FOUND: packages/runtime/src/types.test.ts
- FOUND: .planning/phases/07-kehto-runtime-implementation/07-01-SUMMARY.md
- FOUND commit: 0f30a3a (TDD RED - failing tests)
- FOUND commit: bee90d6 (Task 1 implementation)
- FOUND commit: cf23b42 (Task 2 implementation)
