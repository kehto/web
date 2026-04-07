---
phase: 06-kehto-acl-implementation
plan: 01
subsystem: acl
tags: [typescript, nip-5d, acl, identity, migration, vitest]

requires: []
provides:
  - "toKey() producing 2-segment 'dTag:hash' keys (Identity.pubkey removed from composite key)"
  - "Identity.pubkey optional and @deprecated — all callers compile without providing it"
  - "migrateAclState() pure function for converting old 3-segment ACL state to new 2-segment format"
  - "Comprehensive tests: check.test.ts, mutations.test.ts, migrate.test.ts (75 tests total)"
affects:
  - 06-kehto-acl-implementation/06-02
  - runtime (uses toKey indirectly via enforce.ts)
  - shell (uses migrateAclState in acl-store.ts)

tech-stack:
  added: [vitest]
  patterns:
    - "Pure function migration: migrateAclState() takes AclState, returns AclState — no side effects"
    - "Idempotent migrations: identity check (===) allows callers to detect no-op vs changed"
    - "Conservative merge: caps OR, blocked OR, quota MAX — never silently removes permissions"

key-files:
  created:
    - packages/acl/src/migrate.ts
    - packages/acl/src/check.test.ts
    - packages/acl/src/mutations.test.ts
    - packages/acl/src/migrate.test.ts
  modified:
    - packages/acl/src/types.ts
    - packages/acl/src/check.ts
    - packages/acl/src/index.ts
    - packages/acl/package.json

key-decisions:
  - "toKey() is the single point of change for the entire key schema — all mutations/checks delegate to it"
  - "migrateAclState() handles both orderings of mixed old/new format keys via merge in both code paths"
  - "Conservative merge semantics: OR caps, OR blocked, MAX quota — security-conservative tradeoff"

patterns-established:
  - "Identity objects no longer require pubkey: use { dTag, hash } throughout"
  - "Migration utilities are pure: no I/O, no side effects, returns original reference if no migration needed"

requirements-completed: [ACL-I01, ACL-I03]

duration: 4min
completed: 2026-04-07
---

# Phase 06 Plan 01: ACL Identity Key Schema Change Summary

**NIP-5D identity key schema migrated from 3-segment 'pubkey:dTag:hash' to 2-segment 'dTag:hash', with pure migrateAclState() utility and 75 green tests**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-07T21:47:09Z
- **Completed:** 2026-04-07T21:51:17Z
- **Tasks:** 2
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments
- Updated `toKey()` to produce 2-segment `dTag:hash` keys — all ACL mutations/checks automatically use new format
- Made `Identity.pubkey` optional with `@deprecated` JSDoc — backward-compatible, no callers break
- Created `migrateAclState()` — pure function that converts persisted ACL state from old to new key format, merges duplicates conservatively, is idempotent
- Wrote 75 tests covering all behavior: key format, check logic, all mutations, migration scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Update Identity key schema and create migrateAclState()** - `b600872` (feat)
2. **Task 2: Write tests for key schema change, mutations, and migration** - `eddcaca` (test)

**Plan metadata:** (docs commit below)

_Note: TDD tasks — implementation committed first (Task 1), then tests (Task 2)_

## Files Created/Modified
- `packages/acl/src/types.ts` — Identity.pubkey made optional with @deprecated; AclState.entries JSDoc updated to 'dTag:hash'
- `packages/acl/src/check.ts` — toKey() now returns `${dTag}:${hash}` (2-segment); JSDoc updated
- `packages/acl/src/migrate.ts` — New file: pure migrateAclState() function
- `packages/acl/src/index.ts` — Added export for migrateAclState; updated example (no pubkey)
- `packages/acl/src/check.test.ts` — New: 12 tests for toKey() and check() with new key format
- `packages/acl/src/mutations.test.ts` — New: 22 tests for all mutations with new key format
- `packages/acl/src/migrate.test.ts` — New: 22 tests for migrateAclState() (migration, merge, idempotency)
- `packages/acl/package.json` — Updated test:unit script to use vitest

## Decisions Made
- `toKey()` is the single point of change: updating it propagates the new key format to all 6 mutation functions automatically — no changes to mutations.ts
- `migrateAclState()` handles both orderings of mixed old/new format keys: when a new-format key appears after an old-format key maps to the same target, both code paths (old-format and new-format processing) perform merge logic
- Conservative merge semantics chosen: caps OR (never removes granted capability), blocked OR (never unblocks), quota MAX (keeps higher allocation) — security-conservative for migration

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed migrateAclState() merge for mixed-format ordering**
- **Found during:** Task 2 (writing migrate.test.ts)
- **Issue:** The spec pseudocode (ACL-MIGRATION.md) only merged when the old-format key was processed and a new-format entry already existed. If the new-format entry was inserted first and the old-format key was processed later, the old-format entry was added without merge — then the new-format entry could overwrite it.
- **Fix:** Added merge logic in the `else` branch (new-format key processing), so a collision from a previously-inserted old-format migration also triggers the conservative merge
- **Files modified:** `packages/acl/src/migrate.ts`
- **Verification:** `migrateAclState — mixed format > old key and new key for same dTag:hash are merged` test passes
- **Committed in:** `eddcaca` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix was required for correctness in mixed-format scenarios. No scope creep.

## Issues Encountered
- `resolve.test.ts` (plan 06-02 artifact) was already in the repo from a previous parallel agent commit (`b2502c0`). It referenced `resolve.ts` which was also already committed. The TypeScript compilation check initially appeared to fail but succeeded after confirming `resolve.ts` was already present. No action needed.

## Known Stubs
None — all functionality is fully implemented and tested.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Plan 06-01 complete: key schema changed, migration utility ready, all tests green
- Plan 06-02 (`resolveCapabilitiesNub`) was already committed by a parallel agent
- Phase 06 is fully complete — both plans executed
- Next phase: @kehto/runtime NIP-5D migration (uses updated @kehto/acl as dependency)

---
*Phase: 06-kehto-acl-implementation*
*Completed: 2026-04-07*
