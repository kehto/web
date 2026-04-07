---
phase: 06-kehto-acl-implementation
plan: 02
subsystem: acl
tags: [typescript, acl, nip-5d, capability-resolution, nub, zero-deps]

requires:
  - phase: 06-kehto-acl-implementation
    plan: 01
    provides: "Updated Identity/toKey schema and migrateAclState utility"

provides:
  - resolveCapabilitiesNub() function mapping NUB message types to capability strings
  - CapabilityResolution interface (senderCap/recipientCap)
  - NubMessage minimal interface (zero-dep compatible)
  - 24-test suite covering all NUB domains

affects:
  - 07-kehto-runtime-migration (enforce.ts will consume resolveCapabilitiesNub)

tech-stack:
  added: []
  patterns:
    - "Zero-dep capability resolution: split msg.type on '.' to get [domain, action], switch on domain"
    - "ifc domain reuses relay:read/relay:write — IFC is semantically relay traffic"
    - "Null caps for signer.getPublicKey/getRelays — read-only ops need no ACL gate"

key-files:
  created:
    - packages/acl/src/resolve.ts
    - packages/acl/src/resolve.test.ts
  modified:
    - packages/acl/src/index.ts

key-decisions:
  - "resolveCapabilitiesNub defined in @kehto/acl (not runtime) — canonical capability mapping belongs with capability constants"
  - "NubMessage defined locally — avoids @napplet/core import, preserving zero-dep constraint"
  - "theme domain returns null/null — read-only display data, no user ACL gate needed"

patterns-established:
  - "Capability resolution pattern: split type on dot, switch domain, return { senderCap, recipientCap }"
  - "Unknown domains default to null/null — safe ignore, no runtime errors"

requirements-completed: [ACL-I02]

duration: 2min
completed: 2026-04-07
---

# Phase 06 Plan 02: NUB Domain Capability Resolution Summary

**`resolveCapabilitiesNub()` maps NUB message types (relay/signer/storage/ifc/theme) to ACL capability strings with zero external dependencies and 24 passing tests.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-07T21:47:12Z
- **Completed:** 2026-04-07T21:48:51Z
- **Tasks:** 2 (TDD: test file + implementation, single commit)
- **Files modified:** 3

## Accomplishments

- Implemented `resolveCapabilitiesNub()` following ACL-MIGRATION.md section 2 pseudocode exactly
- Defined `CapabilityResolution` and `NubMessage` types locally (zero-dep — no @napplet/core import)
- Exported all three symbols from @kehto/acl public index
- 24 tests covering every NUB domain (relay, signer, storage, ifc, theme, unknown) and edge cases (no-dot type, unknown domain)

## Task Commits

1. **Task 1+2: resolveCapabilitiesNub() + test suite** - `b2502c0` (feat)

_Note: TDD tasks combined into single commit — test + implementation written in one session._

## Files Created/Modified

- `packages/acl/src/resolve.ts` — `resolveCapabilitiesNub()`, `CapabilityResolution`, `NubMessage`
- `packages/acl/src/resolve.test.ts` — 24 tests across 6 describe blocks
- `packages/acl/src/index.ts` — Added NUB domain resolution exports section

## Decisions Made

- `resolveCapabilitiesNub` lives in `@kehto/acl` (not `@kehto/runtime`) because the capability string mapping belongs alongside the CAP_* constants that define those strings.
- `NubMessage` is defined locally as `{ readonly type: string }` — importing from `@napplet/core` would violate the zero-dep constraint; the local definition is structurally compatible.
- `theme` domain returns `null/null` — theme data is read-only display configuration with no user data, so no ACL gate is appropriate.
- `signer.getPublicKey` and `signer.getRelays` return `null/null` per user decision: read-only identity operations need no explicit ACL grant.

## Deviations from Plan

None — plan executed exactly as written. Implementation matches the pseudocode from ACL-MIGRATION.md section 2 verbatim.

## Issues Encountered

None. The root vitest config already included `packages/*/src/**/*.test.ts` so no test infrastructure setup was needed.

## Known Stubs

None — `resolveCapabilitiesNub()` is fully implemented with all domain cases handled.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `resolveCapabilitiesNub` is ready for consumption by `@kehto/runtime` in Phase 07
- The function signature matches what `enforce.ts` will need: accepts `{ type: string }`, returns `{ senderCap, recipientCap }`
- No blockers

---
*Phase: 06-kehto-acl-implementation*
*Completed: 2026-04-07*
