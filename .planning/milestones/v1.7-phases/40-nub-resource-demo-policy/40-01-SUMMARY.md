---
phase: 40-nub-resource-demo-policy
plan: "01"
subsystem: services/acl/runtime/shell
tags:
  - nub-resource
  - capability
  - resource-service
  - acl
  - runtime-dispatch
  - shell-barrel
  - tdd
dependency_graph:
  requires:
    - 39-01 (createConfigService pattern mirrored)
    - 39-02 (connectStore — getConnectGrants source)
    - 37-01 (provisional-resource.ts wire types)
  provides:
    - createResourceService factory (H-03 prevention)
    - resource:fetch capability in ALL_CAPABILITIES
    - nubDispatch.registerNub('resource', ...) in runtime.ts
    - CANONICAL_NUB_DOMAINS extended to 10 domains
    - provisional-resource types re-exported from @kehto/shell
  affects:
    - 40-02 (resource-demo napplet consumes this plan's factory)
    - 40-03 (SHELL-RESOURCE-POLICY.md references this plan's factory)
tech_stack:
  added:
    - createResourceService factory (packages/services/src/resource-service.ts, 368 lines)
    - resource:fetch capability bit (1 << 15, acl-state.ts)
    - resourceMap() per-domain resolver (resolve.ts)
    - handleResourceMessage() + resourceAdapter (runtime.ts)
  patterns:
    - options-as-bridge (v1.6 Decision 18)
    - H-03 construction-time guard (factory throws if any of 4 options missing)
    - in-flight AbortController map keyed by requestId
    - per-window requestId set for onWindowDestroyed cleanup
    - chunked arrayBufferToBase64 (0x8000-byte slices, stack-safe)
key_files:
  created:
    - packages/services/src/resource-service.ts (368 lines — factory + types)
    - packages/services/src/resource-service.test.ts (280 lines — 9 tests)
    - .changeset/phase-40-01-resource-service.md (4-package changeset)
  modified:
    - packages/acl/src/capabilities.ts (+2 lines: resource:fetch + CAP_RESOURCE_FETCH)
    - packages/acl/src/resolve.ts (+28 lines: resourceMap() + case 'resource' + table rows)
    - packages/acl/src/resolve.test.ts (+48 lines: 5 resource domain tests + 2 ALL_CAPS tests)
    - packages/runtime/src/acl-state.ts (+2 lines: CAP_RESOURCE_FETCH bit + CAP_MAP entry)
    - packages/runtime/src/runtime.ts (+17 lines: handleResourceMessage + resourceAdapter + registerNub)
    - packages/runtime/src/dispatch.test.ts (+50 lines: 2 resource dispatch-registration tests)
    - packages/shell/src/shell-init.ts (CANONICAL_NUB_DOMAINS 7→9 domains)
    - packages/shell/src/index.ts (+15 lines: provisional-resource type re-exports)
    - packages/shell/tests/no-window-nostr.test.ts (8-domain assertion → 10-domain)
    - packages/services/src/index.ts (+15 lines: createResourceService + type exports)
decisions:
  - "4th required option resolveIdentity added to ResourceServiceOptions (identity lookup is service-internal, not runtime-external)"
  - "In-flight AbortController left in inFlight map on cancel; untrackRequest called from finally block in handleBytes to avoid perWindow inconsistency"
  - "no-window-nostr.test.ts 8-domain assertion updated to 10-domain (Rule 1 auto-fix — test was testing a now-incorrect count)"
metrics:
  duration: "~9 minutes (511s)"
  completed_date: "2026-04-24"
  tasks_completed: 3
  files_modified: 10
  files_created: 3
---

# Phase 40 Plan 01: NUB-RESOURCE Wire-up + ACL + Runtime Dispatch Summary

**One-liner:** `createResourceService` factory with H-03 guard, `resource:fetch` ACL capability, `nubDispatch.registerNub('resource', ...)` runtime wiring, and provisional-resource wire types published via `@kehto/shell` barrel — 10th NUB domain fully wired.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Add `resource:fetch` capability + `resourceMap()` resolver | `8f6f86c` | Done |
| 2 | `createResourceService` factory + H-03 guard + changeset | `239fa70` | Done |
| 3 | Wire resource dispatch in runtime.ts + CANONICAL_NUB_DOMAINS + shell barrel re-exports | `be398fc` | Done |

## New / Modified Files with Line Counts

| File | Lines | Notes |
|------|-------|-------|
| `packages/services/src/resource-service.ts` | 368 | NEW — factory, H-03 guard, in-flight tracking, base64 encode |
| `packages/services/src/resource-service.test.ts` | 280 | NEW — 9 tests (a–i) |
| `.changeset/phase-40-01-resource-service.md` | 23 | NEW — 4-package changeset |
| `packages/acl/src/capabilities.ts` | 70 | +2 lines: `resource:fetch` + `CAP_RESOURCE_FETCH` |
| `packages/acl/src/resolve.ts` | 301 | +28 lines: `resourceMap()` + `case 'resource'` + JSDoc table rows |
| `packages/acl/src/resolve.test.ts` | 341 | +48 lines: 5+2 resource/ALL_CAPS tests |
| `packages/runtime/src/acl-state.ts` | 211 | +2 lines: `CAP_RESOURCE_FETCH` bit + CAP_MAP entry |
| `packages/runtime/src/runtime.ts` | 1270 | +17 lines: `handleResourceMessage` + `resourceAdapter` + `registerNub` |
| `packages/runtime/src/dispatch.test.ts` | ~990 | +50 lines: 2 resource dispatch-registration tests |
| `packages/shell/src/shell-init.ts` | 59 | CANONICAL_NUB_DOMAINS 7→9 + updated JSDoc |
| `packages/shell/src/index.ts` | 133 | +15 lines: provisional-resource type re-exports |
| `packages/shell/tests/no-window-nostr.test.ts` | ~150 | 8-domain assertion → 10-domain (Rule 1) |
| `packages/services/src/index.ts` | 119 | +15 lines: createResourceService + type exports |

## Test Counts Delta

| Package | Before | After | New Tests |
|---------|--------|-------|-----------|
| `@kehto/acl` (resolve.test.ts) | 61 | 67 | +5 resource domain + +1 resource:fetch in ALL_CAPS |
| `@kehto/services` | 0 resource | 9 | +9 (a–i, all pass) |
| `@kehto/runtime` (dispatch.test.ts) | 55 | 57 | +2 resource dispatch-registration |
| **Total workspace** | 510 | 517 | **+7** |

## Critical Acceptance Criteria Verified

- `nubDispatch.registerNub('resource', resourceAdapter)` present in `runtime.ts` (Phase 39 Dev 1 lesson held):
  ```
  grep -n "registerNub('resource'" packages/runtime/src/runtime.ts
  1147:  nubDispatch.registerNub('resource', resourceAdapter);  // Phase 40 (RESOURCE-02)
  ```

- Factory throws on missing `getConnectGrants` (H-03 prevention):
  - Test (a): `createResourceService({})` throws `/H-03/`
  - Test (b): `createResourceService({ fetch })` also throws `/H-03/`
  - All 9 resource-service tests pass

- `resource:fetch` in ALL_CAPABILITIES — length is now 16 (was 15):
  - `grep -c "resource:fetch" packages/acl/src/capabilities.ts` → 2 matches

- `resolveCapabilitiesNub` correct for all 4 wire types:
  - `resource.bytes` → `{ senderCap: 'resource:fetch', recipientCap: null }`
  - `resource.cancel` → `{ senderCap: 'resource:fetch', recipientCap: null }`
  - `resource.bytes.result` → `{ senderCap: null, recipientCap: 'resource:fetch' }`
  - `resource.bytes.error` → `{ senderCap: null, recipientCap: 'resource:fetch' }`

- `CANONICAL_NUB_DOMAINS` includes both `config` and `resource` (10 domains total)

- Shell barrel exports: `ResourceBytesRequest`, `ResourceCancelRequest`, `ResourceBytesResult`, `ResourceBytesError`, `ResourceErrorCode`, `ResourceRequestId`, `ResourceInbound`, `ResourceOutbound` — all verified in `packages/shell/src/index.ts`

- Changeset exists at `.changeset/phase-40-01-resource-service.md` with all 4 package entries

- `pnpm type-check` workspace-wide: **10/10 tasks successful**
- `pnpm build` workspace-wide: **25/25 tasks successful**
- `pnpm exec vitest run` workspace-wide: **517/517 tests pass**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 8-domain assertion in no-window-nostr.test.ts to 10-domain**
- **Found during:** Task 3 — full test suite run after CANONICAL_NUB_DOMAINS update
- **Issue:** `packages/shell/tests/no-window-nostr.test.ts` hardcoded `new Set(['relay','identity','storage','ifc','theme','keys','media','notify'])` — expected the exact 8 domains and failed after CANONICAL_NUB_DOMAINS expanded to include `config` and `resource`
- **Fix:** Updated the assertion set to include `config` and `resource`; updated the test name from "8-domain list" to "10-domain list"
- **Files modified:** `packages/shell/tests/no-window-nostr.test.ts`
- **Commit:** `be398fc`

### Implementation Note

The plan spec listed `resolveIdentity` as a "4th option" discovered during Task 2 design — the plan's `<interfaces>` section documented the `SessionRegistry.getEntryByWindowId` pattern, and the factory signature naturally required this 4th option for the service to look up napplet identity. The `H-03` construction-time guard covers all 4 required options (including `resolveIdentity`), matching the success criteria requirement: factory throws if ANY option is missing.

## Known Stubs

None. All exports are fully implemented:
- `createResourceService` is a complete factory (no hardcoded empty values or TODO paths)
- Wire types re-exported from provisional-resource.ts are production-complete shapes
- ACL capability is fully wired through CAP_MAP → resolveCapabilitiesNub → enforce.ts

## Self-Check: PASSED

| Item | Result |
|------|--------|
| `packages/services/src/resource-service.ts` | FOUND |
| `packages/services/src/resource-service.test.ts` | FOUND |
| `.changeset/phase-40-01-resource-service.md` | FOUND |
| `40-01-SUMMARY.md` | FOUND |
| Commit `8f6f86c` (Task 1) | FOUND |
| Commit `239fa70` (Task 2) | FOUND |
| Commit `be398fc` (Task 3) | FOUND |
| `pnpm exec vitest run` | 517/517 PASS |
| `pnpm type-check` | 10/10 PASS |
| `pnpm build` | 25/25 PASS |
