---
phase: 03-runtime-migration-doc
plan: 02
subsystem: documentation
tags: [runtime, nip-5d, handlers, nub, session-entry, identity, migration]

requires:
  - phase: 03-runtime-migration-doc
    plan: 01
    provides: docs/RUNTIME-MIGRATION.md sections 1-2 with placeholder sections 3-4

provides:
  - docs/RUNTIME-MIGRATION.md sections 3-4 — handler rewrites and SessionEntry identity anchor

affects:
  - 04-shell-migration-doc (handler shapes and session creation flow documented here)
  - 05-services-migration-doc (ServiceHandler interface change documented in section 3.3)

tech-stack:
  added: []
  patterns:
    - "NUB domain handler pattern: one function per domain (relay/signer/storage/ifc), accepts flat NUB envelope, dispatches by msg.type action suffix"
    - "identitySource discriminant: 'auth' | 'source' replaces implicit pubkey-truthy auth signal"
    - "Storage scoping unchanged: napplet-state:dTag:hash:key prefix preserved across transport rewrite"

key-files:
  created: []
  modified:
    - docs/RUNTIME-MIGRATION.md

key-decisions:
  - "Option B chosen for SessionEntry.pubkey: empty string for NIP-5D sessions, not windowId or field removal — aligns with ACL-MIGRATION.md optional pubkey, preserves legacy compat"
  - "identitySource: 'auth' | 'source' discriminant added to SessionEntry — explicit session type signal replaces implicit pubkey-truthy gate"
  - "IFC explicit subscription lifecycle is net-new: ifc.subscribe/unsubscribe replace implicit REQ-filter matching; old runtime had no IFC subscribe primitive"
  - "service-discovery.ts becomes dead code: kind 29010 replaced by window.napplet.services.has() synchronous API; kept during dual-mode transition for legacy napplets"
  - "Storage scoping and quota logic unchanged: only transport layer (tag extraction vs flat field access) changes in state-handler.ts rewrite"

requirements-completed: [RT-03, RT-04]

duration: 6min
completed: 2026-04-07
---

# Phase 3 Plan 2: Runtime Migration Doc (Sections 3-4) Summary

**All four NUB domain handler rewrites documented with old/new message shapes and capability mappings; SessionEntry identity anchor resolved with Option B (empty string + identitySource discriminant) and full session creation flow for NIP-5D and legacy modes**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-07T18:16:01Z
- **Completed:** 2026-04-07T18:21:33Z
- **Tasks:** 2 (executed as one commit — both tasks target same file)
- **Files modified:** 1

## Accomplishments

- Section 3: four NUB domain handler subsections (relay, signer, storage, ifc) each with old code path, new message shapes table (inbound + outbound), capability mapping, and affected file inventory
- Section 3.6: service discovery replacement — kind 29010 becomes dead code; synchronous `window.napplet.services.has()` API replaces message round-trip
- Section 3.7: file impact matrix — all 7 runtime source files mapped to change type and NUB domain driver
- Section 4: SessionEntry identity anchor — three design options (windowId / empty string / remove field) with pros/cons; Option B chosen; new schema with `identitySource` discriminant; NIP-5D vs legacy session creation flows side-by-side; downstream impact on acl/shell/services/runtime
- Pitfall cross-references: Pitfalls 5, 6, 7, 8 referenced in appropriate handler subsections
- All source file references (line numbers, function names) verified against live source before writing

## Task Commits

1. **Task 1+2: Write RUNTIME-MIGRATION.md sections 3-4** - `5dd375b` (feat)

## Files Created/Modified

- `docs/RUNTIME-MIGRATION.md` — Sections 3-4 populated (518 lines added, 4 placeholder lines removed); document now complete with all four sections

## Decisions Made

- Option B (empty string) chosen for `SessionEntry.pubkey` in NIP-5D sessions — aligns with ACL-MIGRATION.md deprecation of `Identity.pubkey`, preserves `byPubkey` registry for legacy sessions, allows gradual removal in Phase 3 of AUTH removal
- `identitySource: 'auth' | 'source'` discriminant added to `SessionEntry` — replaces the implicit "non-empty pubkey = authenticated" signal with an explicit field, avoids `if (!pubkey)` guard breakage for NIP-5D sessions
- IFC subscription lifecycle is net-new behavior: old runtime had no explicit IFC subscribe primitive; new model requires `ifc.subscribe` before receiving `ifc.event` deliveries — this is documented as NET NEW in section 3.5
- `service-discovery.ts` becomes dead code under NIP-5D but must be kept during dual-mode transition for legacy napplets still sending kind 29010 REQs
- Storage scoping (`napplet-state:dTag:hash:key`) and quota enforcement are transport-agnostic — they survive the state-handler.ts rewrite unchanged

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 4 (shell migration doc) has clear inputs: NUB handler message shapes from Section 3, session creation flow from Section 4.6, `identitySource` discriminant from Section 4.5
- Phase 5 (services migration doc) has clear inputs: ServiceHandler interface change documented in Section 3.3 (Pitfall 5 reference), capability mappings for all four domains

---
*Phase: 03-runtime-migration-doc*
*Completed: 2026-04-07*
