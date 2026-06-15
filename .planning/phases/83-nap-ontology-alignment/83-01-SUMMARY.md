---
phase: 83-nap-ontology-alignment
plan: "01"
subsystem: acl
tags: [acl, inc, ifc, capability-resolution, security, ALIGN-06]
dependency_graph:
  requires: []
  provides: [inc-domain-acl-gate]
  affects: [packages/acl/src/resolve.ts, packages/acl/src/resolve.test.ts]
tech_stack:
  added: []
  patterns: [case-fall-through alias for domain aliasing]
key_files:
  created: []
  modified:
    - packages/acl/src/resolve.ts
    - packages/acl/src/resolve.test.ts
decisions:
  - "inc aliased to ifc via fall-through case in resolveCapabilitiesNub switch — no incMap to prevent drift (D5)"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-15"
requirements: [ALIGN-06]
---

# Phase 83 Plan 01: ACL inc Domain Alias Summary

**One-liner:** Aliased `inc` domain to `ifcMap` in `resolveCapabilitiesNub` switch via fall-through `case 'inc':`, closing the `inc.emit` relay:write ACL bypass (D5 / ALIGN-06).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Alias inc to ifc in ACL resolver + add inc.* parallel tests | 49970eb | packages/acl/src/resolve.ts, packages/acl/src/resolve.test.ts |

## What Was Built

### resolve.ts changes

- Updated the `ifc.*` JSDoc function comment to include `inc.*` and note that `inc` is the NAP rename of `ifc` (D5 / ALIGN-06).
- Updated the `resolveCapabilitiesNub` JSDoc domain mapping table: the two `ifc` rows now read `ifc`/`inc` to document that both domains share the same mapping.
- Added `case 'inc':` as a fall-through above `case 'ifc':` in the domain switch, so both route to `ifcMap(action)`. No separate `incMap` function was introduced — this is the canonical anti-drift mechanism specified by D5.

### resolve.test.ts changes

- Added `inc domain (NAP rename of ifc, D5 / ALIGN-06)` describe block immediately after the existing `ifc domain` block, containing 8 parallel assertions:
  - `inc.emit` → `{ senderCap: 'relay:write', recipientCap: 'relay:read' }`
  - `inc.channel.emit` → `{ senderCap: 'relay:write', recipientCap: 'relay:read' }`
  - `inc.channel.broadcast` → `{ senderCap: 'relay:write', recipientCap: 'relay:read' }`
  - `inc.subscribe` → `{ senderCap: 'relay:read', recipientCap: null }`
  - `inc.unsubscribe` → `{ senderCap: 'relay:read', recipientCap: null }`
  - `inc.channel.open` → `{ senderCap: 'relay:read', recipientCap: null }`
  - `inc.channel.list` → `{ senderCap: 'relay:read', recipientCap: null }`
  - `inc.channel.close` → `{ senderCap: 'relay:read', recipientCap: null }`
- All pre-existing `ifc.*` tests left byte-for-byte unchanged.

## Verification Results

| Command | Result |
|---------|--------|
| `npx vitest run packages/acl/src/resolve.test.ts` | PASS — 117 tests passed (1 test file) |
| `npx vitest run packages/acl` | PASS — 168 tests passed (4 test files) |
| `pnpm --filter @kehto/acl run type-check` | PASS — 0 TypeScript errors |

## Acceptance Criteria Verification

- [x] `resolveCapabilitiesNub` switch contains `case 'inc':` in code (not JSDoc): `grep -v '^ \*' ... | grep -c "case 'inc':"` = 1
- [x] No function named `incMap` exists in resolve.ts: `grep -c "incMap" ...` = 0
- [x] resolve.test.ts contains `inc domain` describe block with all 8 inc.* assertions
- [x] `pnpm vitest run` passes with new inc.* assertions AND all pre-existing ifc.* assertions
- [x] JSDoc mapping table lists `ifc`/`inc` (combined rows)

## Deviations from Plan

None — plan executed exactly as written. The fall-through `case 'ifc': case 'inc': return ifcMap(action)` approach specified in D5 was implemented with `case 'inc':` placed above `case 'ifc':` for identical effect.

## Known Stubs

None.

## Threat Flags

None — this change only narrows the ACL attack surface by closing the `inc.emit` null/null bypass. No new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- packages/acl/src/resolve.ts — FOUND (modified)
- packages/acl/src/resolve.test.ts — FOUND (modified)
- Commit 49970eb — FOUND in git log
- 168 acl unit tests — PASS
- type-check — PASS
