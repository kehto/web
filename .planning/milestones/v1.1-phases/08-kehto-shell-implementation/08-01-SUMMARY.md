---
phase: 08-kehto-shell-implementation
plan: "01"
subsystem: shell
tags: [typescript, nip-5d, acl, origin-registry, hooks-adapter, shell-types]

requires:
  - phase: 07-kehto-runtime-implementation
    provides: SessionEntry with identitySource discriminant, SendToNapplet accepting NappletMessage | unknown[], AclCheckEvent with widened message type
  - phase: 06-kehto-acl-implementation
    provides: migrateAclState() pure function, AclState interface, 2-segment key format

provides:
  - Shell SessionEntry mirroring runtime's version (identitySource field)
  - ShellCapabilities interface for synchronous capability queries
  - AclCheckEvent accepting NappletMessage | unknown[]
  - onNip5dIframeCreate optional hook on ShellAdapter
  - originRegistry.register() with optional NIP-5D identity metadata
  - originRegistry.getIdentity() for identity lookup by Window reference
  - aclStore.load() with 3-segment to 2-segment key migration via migrateAclState
  - Widened sendToNapplet closure via SendToNapplet type inference

affects:
  - 08-02-shell-bridge-nostr-injection (builds on these type contracts)

tech-stack:
  added: ["@kehto/acl workspace:* (new dependency in @kehto/shell)"]
  patterns:
    - "OriginEntry struct holds windowId + optional dTag/aggregateHash for NIP-5D identity"
    - "ACL migration at load() boundary — detect 3-segment keys, migrate via AclState, re-persist immediately"
    - "Bitfield conversion helpers (capArrayToBitfield/bitfieldToCapArray) bridge shell's Set<Capability> and acl's bitfield AclEntry"

key-files:
  created: []
  modified:
    - packages/shell/src/types.ts
    - packages/shell/src/origin-registry.ts
    - packages/shell/src/acl-store.ts
    - packages/shell/src/hooks-adapter.ts
    - packages/shell/src/shell-bridge.ts
    - packages/shell/package.json

key-decisions:
  - "identitySource discriminant on shell's SessionEntry mirrors runtime's version exactly — same field name, same values"
  - "OriginEntry interface stores optional dTag/aggregateHash alongside windowId — nullable for legacy non-NIP-5D iframes"
  - "ACL migration uses bitfield conversion bridge: shell's Capability[] set <-> acl's bitfield int — CAP_BITS mapping hardcoded in acl-store to avoid importing bit constants"
  - "sendToNapplet parameter types inferred from SendToNapplet type annotation (remove explicit msg: unknown[]) — simpler and correctly widened"
  - "[Rule 1] sendChallenge on Runtime was removed in Phase 07 but shell-bridge still called it — replaced with no-op + @deprecated annotation"

patterns-established:
  - "Shell type interfaces shadow runtime types with identical field sets — enables type narrowing at the shell boundary without re-exporting all runtime types"
  - "Migration at deserialization boundary — check for old format on load, migrate, re-persist, continue — single path, no dual-mode"

requirements-completed: [SH-I01, SH-I04]

duration: 4min
completed: 2026-04-07
---

# Phase 08 Plan 01: Shell Type Contracts and ACL Migration Summary

**NIP-5D type contracts established: SessionEntry with identitySource, ShellCapabilities, widened AclCheckEvent, origin registry NIP-5D identity storage, and ACL 3-to-2-segment key migration on load**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-07T22:38:12Z
- **Completed:** 2026-04-07T22:41:46Z
- **Tasks:** 3 (+ 1 Rule 1 deviation)
- **Files modified:** 6

## Accomplishments

- Shell type contracts (types.ts) now mirror runtime's Phase 07 updates: SessionEntry has identitySource, AclCheckEvent accepts NappletMessage, ShellCapabilities and onNip5dIframeCreate added
- origin-registry enhanced with OriginEntry struct storing optional NIP-5D identity metadata; register() accepts optional identity param; getIdentity() added
- acl-store.load() detects old 3-segment pubkey:dTag:hash keys and migrates them to 2-segment dTag:hash format via migrateAclState() from @kehto/acl, re-persisting immediately
- sendToNapplet closure correctly typed via SendToNapplet type inference (accepts NappletMessage | unknown[])

## Task Commits

Each task was committed atomically:

1. **Task 1: Update types.ts** - `000e969` (feat)
2. **Task 2: Enhance origin-registry + integrate migrateAclState** - `ddfe155` (feat)
3. **Task 3: Update hooks-adapter sendToNapplet + deprecations** - `e6bd5a6` (feat)
4. **Rule 1 deviation: Fix shell-bridge sendChallenge** - `bbb6f1a` (fix)

## Files Created/Modified

- `packages/shell/src/types.ts` — identitySource on SessionEntry, widened AclCheckEvent.message, ShellCapabilities interface, onNip5dIframeCreate on ShellAdapter, NappletMessage re-export
- `packages/shell/src/origin-registry.ts` — OriginEntry struct, register() with optional identity, getIdentity(), all lookups updated to OriginEntry shape
- `packages/shell/src/acl-store.ts` — migrateAclState import from @kehto/acl, bitfield helpers, 3-segment migration in load()
- `packages/shell/src/hooks-adapter.ts` — sendToNapplet parameter type inference, @deprecated on shellSecretPersistence and guidPersistence
- `packages/shell/src/shell-bridge.ts` — [Rule 1] sendChallenge no-op replacing removed runtime.sendChallenge() call
- `packages/shell/package.json` — added @kehto/acl workspace:* dependency

## Decisions Made

- identitySource discriminant on shell's SessionEntry mirrors runtime's version exactly
- OriginEntry stores optional dTag/aggregateHash alongside windowId — nullable for legacy non-NIP-5D iframes
- ACL migration uses hardcoded CAP_BITS mapping in acl-store to bridge Capability[] set to bitfield int without importing individual bit constants from @kehto/acl
- sendToNapplet closure parameter types inferred from SendToNapplet type (remove explicit msg: unknown[]) — simpler and correctly widened

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing build break: runtime.sendChallenge() no longer exists**
- **Found during:** Post-task `pnpm build` verification
- **Issue:** `shell-bridge.ts` line 161 called `runtime.sendChallenge(windowId)` but `sendChallenge` was removed from the `Runtime` interface in Phase 07. The DTS build was failing before our changes were applied.
- **Fix:** Replaced implementation with no-op + `@deprecated NIP-5D` annotation. `sendChallenge` is retained on the `ShellBridge` interface for API compatibility (Plan 02 will complete the shell-bridge rewrite).
- **Files modified:** `packages/shell/src/shell-bridge.ts`
- **Verification:** `npx tsc --noEmit` passes with zero errors; `pnpm build` succeeds (11/11 tasks)
- **Committed in:** `bbb6f1a`

---

**Total deviations:** 1 auto-fixed (1 pre-existing bug)
**Impact on plan:** Pre-existing build break unblocked — no scope creep. Plan 02 will complete the shell-bridge rewrite.

## Issues Encountered

- `pnpm install --reporter=silent` produced no output (silent worked correctly; verified with `pnpm install` non-silent)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (shell-bridge rewrite + nostr injection) can build on these type contracts
- shell-bridge.ts still has the old array-only message guard at line 155 — Plan 02 will replace it with envelope-first guard
- All compilation errors in shell package are resolved (zero errors from our files; shell-bridge.ts sendChallenge fixed)

---
*Phase: 08-kehto-shell-implementation*
*Completed: 2026-04-07*
