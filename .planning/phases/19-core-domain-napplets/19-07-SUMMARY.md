---
phase: 19-core-domain-napplets
plan: "07"
subsystem: testing
tags: [playwright, e2e, nub-relay, acl, napplet, turbo-cache]

# Dependency graph
requires:
  - phase: 19-core-domain-napplets
    provides: "19-01..06 — composer, preferences, toaster napplets + demo wiring + 6 Phase 19 specs"
  - phase: 18-napplet-sdk-migration
    provides: "Layer-B base suite (napplet-auth, ifc-roundtrip) + 18-ITERATION-LOG.md format reference"
  - phase: 17-demo-app-rewire
    provides: "Phase 17 Layer-B specs (demo-boot, demo-node-inspector, demo-debugger, demo-service-toggle, demo-notification-service)"
provides:
  - "E2E-11 iteration-loop gate for Phase 19 — 27/27 tests passing across 3 consecutive runs"
  - "19-ITERATION-LOG.md with Phase Close Gate — all ✓"
  - "Fix: nub-relay publish() Promise now handles relay.publish.error (ACL denial path)"
  - "Fix: composer dist turbo cache busted — fresh cache with corrected napplet bundle"
  - "v1.3 Layer-B suite (13 specs, 27 tests) confirmed green and stable"
affects: [phase-20-expanded-domain-napplets, any phase consuming @napplet/nub-relay relay.publish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Turbo cache invalidation: fixes to external workspace packages (napplet/) require explicit cache bust + full rebuild to propagate into kehto's build artifacts"
    - "nub-relay publish() Promise must guard for BOTH relay.publish.result AND relay.publish.error to handle ACL denial cleanly"

key-files:
  created:
    - ".planning/phases/19-core-domain-napplets/19-ITERATION-LOG.md"
    - ".planning/phases/19-core-domain-napplets/19-07-SUMMARY.md"
  modified:
    - "apps/demo/src/main.ts"
    - "apps/demo/src/shell-host.ts"
    - "tests/e2e/acl-revoke-relay-write.spec.ts"
    - "tests/e2e/acl-revoke-storage-write.spec.ts"
    - "/home/sandwich/Develop/napplet/packages/nubs/relay/src/shim.ts"
    - "/home/sandwich/Develop/napplet/packages/nubs/relay/dist/index.js"
    - "apps/demo/napplets/composer/dist/assets/index-CIPzb-cY.js"

key-decisions:
  - "nub-relay publish() must handle relay.publish.error in addition to relay.publish.result — the runtime sends relay.publish.error (not relay.publish.result with error field) on ACL denial"
  - "Turbo cache busted explicitly (rm -rf .turbo/cache) when external workspace fix doesn't propagate through the turbo input hash"
  - "Composer napplet dist rebuilt with pnpm build in napplet/packages/nubs/relay dir, then shim rebuild, then clean composer napplet build, then full pnpm build to repopulate turbo cache"
  - "Three consecutive 27/27 Layer-B runs required to confirm fix stability (not just 2)"

requirements-completed: [E2E-11]

# Metrics
duration: 120min
completed: 2026-04-18
---

# Phase 19 Plan 07: E2E-11 Iteration Gate Summary

**v1.3 Layer-B suite (13 specs, 27 tests) fully green via 3-iteration loop that fixed nub-relay relay.publish.error handling and turbo cache poisoning from external workspace packages**

## Performance

- **Duration:** ~120 min (multi-session continuation)
- **Started:** 2026-04-17T22:00:00Z
- **Completed:** 2026-04-18T04:30:00Z
- **Tasks:** 1 (iteration loop task)
- **Files modified:** 8

## Accomplishments
- Full v1.3 Layer-B suite (13 spec files, 27 tests) passes across 3 consecutive runs — stable
- Identified and fixed root cause: `@napplet/nub-relay` `publish()` Promise only listened for `relay.publish.result`, ignoring `relay.publish.error` — ACL denial caused infinite hang
- Identified and fixed secondary root cause: turbo cache restored old pre-fix composer dist on each `pnpm build` because the fix was in external `/napplet/` workspace (not tracked by turbo's input hash)
- All Phase 17 (5 specs) and Phase 18 (2 specs) baselines confirmed regression-free
- Anti-term grep clean across all 5 napplets (composer/preferences zero, toaster exactly 1 documented exemption, bot/chat zero)
- Phase Close Gate all ✓ — E2E-11 closed for Phase 19

## Task Commits

1. **Task 1: Iteration loop + gate** - `7d572f0` (docs: 19-ITERATION-LOG.md initial)
2. **Task 1 continued: Iteration 3 update** - `f7b16ce` (docs: update log with turbo cache fix)
3. **Implementation fixes** - `c7230cf` (feat: relay.publish.error handling + ACL wiring)

## Files Created/Modified
- `.planning/phases/19-core-domain-napplets/19-ITERATION-LOG.md` — 3-iteration log with Phase Close Gate (all ✓)
- `apps/demo/src/main.ts` — Added Path B trigger for NIP-5D napplets + refreshAclPanelsIfNeeded() helper
- `apps/demo/src/shell-host.ts` — Fixed toggleCapability/toggleBlock for empty-pubkey NIP-5D napplets + ACL state refresh trigger
- `tests/e2e/acl-revoke-relay-write.spec.ts` — Fixed to use frame.evaluate() for sandboxed iframe button clicks
- `tests/e2e/acl-revoke-storage-write.spec.ts` — Same sandboxed iframe click fix
- `/home/sandwich/Develop/napplet/packages/nubs/relay/src/shim.ts` — Handle relay.publish.error in publish() Promise
- `/home/sandwich/Develop/napplet/packages/nubs/relay/dist/index.js` — Same fix in compiled dist
- `apps/demo/napplets/composer/dist/assets/index-CIPzb-cY.js` — Rebuilt with fixed nub-relay

## Decisions Made

1. **nub-relay must handle relay.publish.error**: The runtime ACL gate sends `relay.publish.error` (a distinct message type) when relay:write is denied — not `relay.publish.result` with an error field. The `publish()` Promise listener was ignoring this type, causing the Promise to hang indefinitely. Fix: guard both types.

2. **Turbo cache bust required for external workspace fixes**: Fixes to `/home/sandwich/Develop/napplet/` packages are not tracked by kehto's turbo input hash. After applying the nub-relay fix, turbo kept restoring the old pre-fix composer dist from cache. Solution: `rm -rf .turbo/cache` + rebuild all 14 tasks fresh to repopulate with correct artifacts.

3. **Three consecutive runs for stability**: After 2 passes, the test failed again (turbo cache restored old dist). Required 3 consecutive passes after the definitive fix to confirm stability.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] nub-relay publish() ignores relay.publish.error**
- **Found during:** Task 1 (iteration loop — acl-revoke-relay-write spec failure)
- **Issue:** `@napplet/nub-relay` `publish()` function only handled `relay.publish.result`. When ACL denied `relay:write`, runtime sent `relay.publish.error`. The Promise hung indefinitely; composer status never updated from Phase 1's `"published: unknown"`.
- **Fix:** Modified `nub-relay/src/shim.ts` and `dist/index.js` to check for both `relay.publish.result` AND `relay.publish.error`, rejecting the Promise on either `result.error` or `msg.type === 'relay.publish.error'`
- **Files modified:** `/home/sandwich/Develop/napplet/packages/nubs/relay/src/shim.ts`, `dist/index.js`
- **Verification:** acl-revoke-relay-write passes; debugger shows relay.publish.error; #composer-status shows `denied:`
- **Committed in:** `c7230cf`

**2. [Rule 1 - Bug] Turbo cache poisoning from external workspace**
- **Found during:** Task 1 (iteration 3 — test passing then failing on subsequent pnpm build)
- **Issue:** `pnpm build` (turbo) restored the old pre-fix composer dist from cache on each full build run. The turbo cache key excludes external workspace paths (`/napplet/`), so the fix wasn't detected as a change. Result: `index.html` was reset to reference the unfixed bundle after each full build.
- **Fix:** Cleared turbo cache (`rm -rf .turbo/cache`), cleaned composer dist, rebuilt composer napplet, then ran full `pnpm build` (14 tasks, 0 cached) to populate fresh cache with correct artifacts
- **Files modified:** `apps/demo/napplets/composer/dist/` (rebuilt)
- **Verification:** 3 consecutive 27/27 passes; turbo cache now stores correct bundle hash
- **Committed in:** `f7b16ce` (iteration log update documenting fix)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep. The nub-relay fix is a protocol-level correctness issue; the turbo cache fix is an infrastructure-level correctness issue.

## Issues Encountered

- **False positive stability check**: After the initial nub-relay fix, 2 consecutive test runs passed because Playwright's `reuseExistingServer: true` kept the preview server pointing to the clean-rebuilt dist. The next `pnpm build` invocation restored the turbo cache and clobbered the fix. Required identifying the turbo cache as the root cause and clearing it explicitly.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 19 is complete. E2E-11 closed. All 13 spec files in the v1.3 Layer-B suite are green and stable.
- Phase 20 (expanded-domain napplets: feed, profile-viewer, theme-switcher) can proceed from this baseline.
- NOTE: The nub-relay fix in `/home/sandwich/Develop/napplet/packages/nubs/relay/` is uncommitted in that repo. Phase 20 or a separate napplet maintenance task should commit and publish the fix.

---
*Phase: 19-core-domain-napplets*
*Completed: 2026-04-18*
