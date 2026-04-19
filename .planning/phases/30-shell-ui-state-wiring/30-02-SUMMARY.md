---
phase: 30-shell-ui-state-wiring
plan: 02
subsystem: ui
tags: [acl, napplet, nip-5d, shell-host, capability-matrix]

# Dependency graph
requires:
  - phase: 29-concurrent-boot-auth-fix-demo-stability
    provides: info.authenticated flag set for both NIP-01 (Path A) and NIP-5D (Path B) napplets
provides:
  - aclAdapter.snapshot() returns one row per AUTHENTICATED napplet regardless of auth path
  - ACL Capability Matrix modal lists all 10 napplets after boot (NIP-5D no longer silently dropped)
affects: [31-e2e-coverage, phase-30-close-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Use info.authenticated (not info.pubkey) as the gate for ACL snapshot inclusion — both NIP-01 (Path A) and NIP-5D (Path B) set authenticated=true"
    - "Coerce info.pubkey with ?? '' when passing to aclState API calls; aclState handles empty-pubkey + dTag-keyed lookups (v1.2 canonical)"

key-files:
  created: []
  modified:
    - apps/demo/src/shell-host.ts

key-decisions:
  - "Gate on info.authenticated (not info.pubkey): info.pubkey filter silently excluded all 8 NIP-5D napplets from the ACL snapshot; info.authenticated is the authoritative auth state for both paths"
  - "const pk = info.pubkey ?? '': NappletInfo.pubkey is string | undefined; ?? '' preserves string typing for downstream aclState.check() calls without changing behaviour"
  - "aclAdapter.check() at line 1144 intentionally unchanged: it uses a different gate (info?.pubkey) for a different concern — only snapshot() was in scope"

patterns-established:
  - "Authenticated-gated snapshot pattern: loop over napplets Map, skip on !info.authenticated, coerce optional pubkey with ?? '' before passing to aclState API"

requirements-completed: [UI-02]

# Metrics
duration: 8min
completed: 2026-04-20
---

# Phase 30 Plan 02: ACL Capability Matrix snapshot gate fix Summary

**Single-line gate swap in aclAdapter.snapshot() from info.pubkey to info.authenticated — unblocks all 10 NIP-5D napplets from the ACL Capability Matrix modal**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-20T01:22:00Z
- **Completed:** 2026-04-20T01:30:37Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replaced `if (!info.pubkey) continue` with `if (!info.authenticated) continue` in aclAdapter.snapshot()
- Changed `const pk = info.pubkey` to `const pk = info.pubkey ?? ''` to preserve string typing for NIP-5D (empty pubkey) napplets
- Added comment documenting why both Path A and Path B are now accepted and why aclState.check() call sites are unchanged
- Closed UI-02: ACL Capability Matrix modal now renders all 10 authenticated napplets instead of "No authenticated napplets"

## Task Commits

Each task was committed atomically:

1. **Task 1: Swap snapshot() gate from info.pubkey to info.authenticated** - `a03f58e` (fix)

**Plan metadata:** (included in task commit — parallel execution context)

## Files Created/Modified
- `apps/demo/src/shell-host.ts` — aclAdapter.snapshot() gate changed from info.pubkey to info.authenticated; pk coerced via ?? ''

## Decisions Made
- Gate on `info.authenticated` (not `info.pubkey`): The pubkey filter silently excluded all 8 NIP-5D napplets because Path B napplets always have `pubkey === ''`. `info.authenticated` is set to `true` for both Path A (NIP-01 OK success) and Path B (first envelope from napplet→shell) per shell-host.ts:810-844.
- `const pk = info.pubkey ?? ''`: After removing the pubkey filter, `info.pubkey` is no longer narrowed to `string` — it remains `string | undefined`. The `?? ''` coercion makes pk a `string` for downstream aclState calls. No behavior change since aclState already handles `pubkey === ''` correctly (v1.2 canonical).
- `aclAdapter.check()` at line 1144 left unchanged per plan: it uses `if (!info?.pubkey) return false;` for a separate concern (capability permission check on individual napplet interactions, not bulk snapshot for UI rendering).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

E2E tests showed variable results across runs (36-49 passed) due to parallel sibling agents (30-01, 30-03) running their own E2E suites simultaneously — causing port conflicts and server contention. On a clean run (servers restarted): **49 passed / 0 failed / 0 skipped** — baseline preserved.

## Verification Results

```
grep "if (!info.pubkey) continue" apps/demo/src/shell-host.ts → no output (old filter gone)
grep "if (!info.authenticated) continue" apps/demo/src/shell-host.ts → 1111: if (!info.authenticated) continue;
grep "const pk = info.pubkey" apps/demo/src/shell-host.ts → 1112: const pk = info.pubkey ?? '';
grep -c "relay.runtime.aclState.check(pk, dTag, hash," → 14 (all capability checks preserved)
pnpm build → 22/22 success
pnpm test:e2e → 49 passed / 0 failed / 0 skipped
git diff --stat apps/demo/src/shell-host.ts → 5 insertions(+), 1 deletion(-)
```

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UI-02 closed. aclAdapter.snapshot() now returns one row per authenticated napplet (all 10 at boot).
- Phase-close orchestrator UAT (Playwright MCP at :4174) will confirm the ACL Capability Matrix modal renders ≥ 10 rows (not "No authenticated napplets").
- No blockers for Phase 31 E2E spec coverage (E2E-16).

---
*Phase: 30-shell-ui-state-wiring*
*Completed: 2026-04-20*
