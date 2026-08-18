---
phase: 102-nap-inc-event-channel-parity
reviewed: 2026-07-23T19:56:11Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - packages/runtime/src/inc-handler.ts
  - packages/runtime/src/runtime.ts
  - packages/runtime/src/runtime.test.ts
  - packages/runtime/src/dispatch.test.ts
  - packages/services/src/notification-service.ts
  - packages/services/src/notification-service.test.ts
  - packages/services/src/index.ts
  - packages/shell/README.md
  - apps/playground/src/flow-animator.ts
  - tests/unit/flow-animator-path.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 102: Fix Re-review Report

**Reviewed:** 2026-07-23T19:56:11Z  
**Depth:** standard  
**Files Reviewed:** 10  
**Status:** clean

## Summary

Re-reviewed commits `db2cf62`, `76ec39c`, and `14c4a5f` against all five findings in `102-REVIEW.md` plus the requested INC denial-envelope constraint. All findings are resolved.

The focused regression command passed: `pnpm exec vitest run packages/runtime/src/runtime.test.ts packages/runtime/src/dispatch.test.ts packages/services/src/notification-service.test.ts tests/unit/flow-animator-path.test.ts` — 4 files, 111 tests.

## Narrative Findings (AI reviewer)

No unresolved BLOCKER or WARNING findings.

## Validation

- **CR-01 resolved:** `channel.open` now authorizes the resolved target with `relay:read` before recording or notifying the channel, and covers both blocked and revoked target ACL state.
- **CR-02 resolved:** notification lookup, read, and dismissal are scoped to the calling window; the regression test proves a second window cannot mutate the owner's notification.
- **WR-01 resolved:** a failure to deliver the opener's success result tears down the channel and sends the peer's close notification without rethrowing.
- **WR-02 resolved:** the service descriptor and all reviewed registration examples now use the direct `notify` domain key.
- **WR-03 resolved:** host-originated notification messages are handled before the generic no-napplet early return; direct path tests cover both directions.
- **INC denial correction verified:** ACL and firewall denial both call `denialResponseType`. Only `inc.subscribe` and `inc.channel.open` receive their contract-defined `.result` errors; other INC actions are dropped without invented `.error` envelopes.

---

_Reviewed: 2026-07-23T19:56:11Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: standard_
