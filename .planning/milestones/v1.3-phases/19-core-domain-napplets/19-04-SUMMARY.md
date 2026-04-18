---
phase: 19-core-domain-napplets
plan: 04
subsystem: demo
tags: [napplets, acl, notification-service, shell-host, demo-wiring]

# Dependency graph
requires:
  - phase: 19-01
    provides: composer napplet package with @kehto/demo-composer buildable
  - phase: 19-02
    provides: preferences napplet package with @kehto/demo-preferences buildable
  - phase: 19-03
    provides: toaster napplet package with @kehto/demo-toaster buildable
provides:
  - DEMO_NAPPLETS extended to 5 entries (chat, bot, composer, preferences, toaster)
  - notification-service dual-registered as 'notifications' + 'notify' in services map
  - DEMO_CAPABILITIES extended to 6 entries (added notify:send)
  - renderAclPanels handles 5 napplet name branches (added composer/preferences/toaster)
affects: [19-05, 19-06, 19-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - dual-registration pattern for service handlers to satisfy both topology display ('notifications') and runtime routing ('notify') without renaming
    - outer topology placeholder stays 'loading...' for D-04 napplets — inner #*-status set by iframe itself

key-files:
  created: []
  modified:
    - apps/demo/src/shell-host.ts
    - apps/demo/src/acl-panel.ts

key-decisions:
  - "Dual-register notification-service under both 'notifications' (topology display + host-originated wiring) and 'notify' (runtime serviceRegistry['notify'] routing for toaster notify.* envelopes) — same handler instance, two registry keys"
  - "Outer topology statusId placeholder stays at 'loading...' for composer/preferences/toaster — these napplets set their own inner #*-status via D-04 init pattern; Layer-B specs assert inner iframe status via frameLocator not the outer placeholder"
  - "renderAclPanels uses hard-coded name branches (not data-driven from DEMO_NAPPLETS) to avoid circular import between acl-panel.ts and shell-host.ts — consistent with Phase 17 pattern"

patterns-established:
  - "DEMO_NAPPLETS entry shape: { name, label, statusId, aclId, frameContainerId } where IDs follow '<name>-status' / '<name>-acl' / '<name>-frame-container' convention"

requirements-completed: [NAP-03, NAP-04, NAP-05]

# Metrics
duration: 3min
completed: 2026-04-18
---

# Phase 19 Plan 04: Demo Wiring Summary

**DEMO_NAPPLETS extended to 5 napplets + notify-service dual-registered so toaster's notify.* envelopes route to the same notification handler via serviceRegistry['notify']**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-18T01:27:17Z
- **Completed:** 2026-04-18T01:29:48Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extended DEMO_NAPPLETS from 2 to 5 entries: added composer, preferences, toaster — each with canonical statusId/aclId/frameContainerId IDs — so topology renders 5 napplet cards and loadNapplet bootstraps all 3 new iframes
- Dual-registered notification-service as both 'notifications' (topology display + notification-demo.ts host wiring) and 'notify' (runtime serviceRegistry['notify'] lookup at runtime.ts:1000 for toaster's notify.create/list/dismiss envelopes) — same handler instance, no protocol changes
- Extended DEMO_CAPABILITIES from 5 to 6 entries (added notify:send) so the toaster's ACL panel exposes the "Notify Send" toggle; extended renderAclPanels with 3 new name branches (composer/preferences/toaster) calling renderNappletAcl with correct aclId slots
- Pre-Phase-19 baseline: all 20 tests green after changes (Phase 17 x5 specs + Phase 18 x2 specs = 7 spec files, 20 tests — zero regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend DEMO_NAPPLETS + dual-register notify service** - `37978bf` (feat)
2. **Task 2: Extend DEMO_CAPABILITIES + renderAclPanels for composer/preferences/toaster** - `e3c54ce` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/demo/src/shell-host.ts` — DEMO_NAPPLETS now 5 entries (was 2); services map now has `notify: notificationService` alongside `notifications: notificationService`
- `apps/demo/src/acl-panel.ts` — DEMO_CAPABILITIES now 6 entries (was 5; added notify:send); renderAclPanels now handles 5 name branches (was 2; added composer/preferences/toaster)

## Decisions Made

- Dual-registration pattern chosen over renaming 'notifications' to 'notify' to preserve: (a) topology display via DEMO_TOPOLOGY_SERVICE_NAMES, (b) host-originated wiring in notification-demo.ts, (c) Phase 17 contract (8 service nodes, no new card for 'notify')
- Outer topology statusId placeholder stays 'loading...' for the 3 new napplets — they self-set their inner #*-status via D-04 init pattern. Layer-B specs (Plans 19-05/06) assert inner iframe status via frameLocator. The existing chat-status/bot-status host-side setter in main.ts:721-734 is left untouched (intentional back-compat).
- renderAclPanels uses explicit name branches (not data-driven from DEMO_NAPPLETS) to avoid circular import — consistent with Phase 17 pattern and explicitly documented in comment

## Deviations from Plan

None — plan executed exactly as written. Both edits were straightforward additive changes with no structural complications.

## Issues Encountered

Pre-existing TypeScript errors in shell-host.ts (lines 461 and 773 — unrelated to Plan 19-04 edits: `randomBytes` not in CryptoHooks type, `sendChallenge` not on ShellBridge type). These were present before this plan and are out of scope per the deviation scope boundary rule.

## Known Stubs

None introduced in this plan. The outer topology statusId placeholder staying at 'loading...' for composer/preferences/toaster is intentional (documented in comment and D-04 init pattern), not a stub — the inner iframe statuses are set by the napplets themselves.

## Next Phase Readiness

- Plans 19-05 (relay-publish + storage-persist specs) and 19-06 (acl-revoke specs) can now drive end-to-end Playwright specs against the fully wired demo
- Topology at :4174 renders 5 napplet nodes + 8 service nodes
- Toaster can notify.create/list/dismiss via runtime serviceRegistry['notify'] routing
- ACL panel exposes notify:send toggle per napplet for Plan 19-06 revoke scenarios

## Self-Check

Will be verified after state updates.

---
*Phase: 19-core-domain-napplets*
*Completed: 2026-04-18*
