---
phase: 02-acl-migration-doc
plan: 01
subsystem: acl
tags: [acl, nip-5d, identity, migration, capability, documentation]

# Dependency graph
requires:
  - phase: 01-gap-analysis
    provides: "GAP-ANALYSIS.md section 5.1 defining ACL boundary contracts and identity key schema"
provides:
  - "Complete ACL migration document for @kehto/acl (docs/ACL-MIGRATION.md)"
  - "Old/new identity key schema side-by-side comparison with migration logic"
  - "All 10 CAP_* constants mapped to NUB domains with old enforce.ts trigger references"
  - "Persisted ACL data migration strategy with migrateAclState() utility pseudocode"
  - "Rollback procedure and idempotency guarantees for migration"
affects: [03-runtime-migration-doc, 04-shell-migration-doc, acl-store, enforce]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ACL key schema: dTag:hash (two segments, no pubkey) — canonical format under NIP-5D"
    - "Migration pattern: detect 3-segment keys, strip pubkey prefix, OR-merge caps, persist"
    - "IFC capability reuse: relay:write/relay:read for ifc NUB (no new bits required)"

key-files:
  created:
    - docs/ACL-MIGRATION.md
  modified: []

key-decisions:
  - "Identity.pubkey kept as optional (not removed) for backward compatibility — callers pass it, toKey() ignores it"
  - "migrateAclState() belongs in @kehto/shell acl-store.ts, not @kehto/acl (pure module has no I/O)"
  - "ACL merge strategy is security-conservative: OR caps, OR blocked, MAX quota — never reduces access"
  - "IFC NUB reuses relay:write/relay:read — no new capability bits for inter-napplet communication"

patterns-established:
  - "Single point of change: toKey() is the only function that computes the composite key; all mutations/checks delegate to it"
  - "Format-agnostic serialize/deserialize: neither function inspects key strings, enabling transparent format migration"

requirements-completed: [ACL-01, ACL-02, ACL-03]

# Metrics
duration: 2min
completed: 2026-04-07
---

# Phase 02 Plan 01: ACL Migration Doc Summary

**ACL identity key schema migrated from pubkey:dTag:hash to dTag:hash with NUB capability mapping and one-time localStorage migration utility**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-07T17:56:05Z
- **Completed:** 2026-04-07T17:58:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Created `docs/ACL-MIGRATION.md` — standalone migration reference for @kehto/acl covering identity key schema change, capability-to-NUB mapping, and persisted data migration
- Documented the single-point-of-change: `toKey()` in `check.ts` drives the entire key schema change across all 11 ACL functions
- Mapped all 10 `CAP_*` constants to NUB domains with `resolveCapabilitiesNub()` pseudocode for `enforce.ts` migration
- Provided `migrateAclState()` utility with conservative OR-merge strategy, rollback procedure, and idempotency guarantee

## Task Commits

Each task was committed atomically:

1. **Task 1: Write ACL-MIGRATION.md sections 1-2 (Identity schema + Capability mapping)** - `7f28cfc` (docs)
2. **Task 2: Write ACL-MIGRATION.md section 3 (Persisted data migration strategy)** - `a93d859` (docs)

**Plan metadata:** (docs commit — see final_commit step)

## Files Created/Modified

- `docs/ACL-MIGRATION.md` — Complete @kehto/acl migration document: identity key schema, capability NUB mapping, persisted data migration strategy with pseudocode

## Decisions Made

- **Identity.pubkey kept optional, not removed:** Allows phased migration — callers that still pass `pubkey` compile without errors; `toKey()` ignores the value. Runtime package update can follow in a later step.
- **Migration utility placed in @kehto/shell, not @kehto/acl:** @kehto/acl is a pure zero-dep module with no I/O. @kehto/shell's `acl-store.ts` owns localStorage access and is the natural migration host.
- **Security-conservative merge (OR caps, OR blocked, MAX quota):** In the rare case where two pubkeys had entries for the same `dTag:hash`, the merge never silently removes grants or unblocks — it biases toward granting more, which is safer than silently denying capabilities and surprising users.
- **IFC NUB reuses relay:write/relay:read:** Introducing `ifc:write`/`ifc:read` bits would require updating every existing ACL entry and duplicates semantics of existing bits. The reuse matches RUNTIME-SPEC v2.0.0 behavior.

## Deviations from Plan

None — plan executed exactly as written. All sections written with content matching the plan's action specification. The `enforce.ts` `resolveCapabilitiesNub()` pseudocode was included as specified despite not existing in the current codebase — it is documented as the target migration pattern.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. This plan creates documentation only.

## Next Phase Readiness

- `docs/ACL-MIGRATION.md` is complete and ready to serve as input for Phase 03 (runtime migration doc)
- The runtime migration doc will reference the `resolveCapabilitiesNub()` pseudocode from Section 2 when updating `enforce.ts`
- The shell migration doc will reference the `migrateAclState()` utility from Section 3 when updating `acl-store.ts`
- No blockers — `@kehto/acl` source files have not been modified; implementation changes are documented for a future implementation phase

---
*Phase: 02-acl-migration-doc*
*Completed: 2026-04-07*
