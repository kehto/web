---
phase: 105
fixed_at: 2026-07-27T14:41:01Z
review_path: /Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/.planning/phases/105-published-convention-adoption-and-host-flows/105-REVIEW.md
iteration: 9
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 105: Code Review Fix Report

**Fixed at:** 2026-07-27T14:41:01Z
**Source review:** `/Users/sandwich/.worktrees/kehto/napplet-scheme-conformance/.planning/phases/105-published-convention-adoption-and-host-flows/105-REVIEW.md`  
**Iteration:** 9 (consolidated final blocker cycles)

**Summary:**

- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Catalog replacement leaves retained delivery waiting indefinitely on a stale unready target

**Files modified:** `apps/playground/src/shell-host.ts`, `packages/paja/src/browser-host.ts`, `tests/unit/playground-intent-controller.test.ts`, `packages/paja/src/browser-host.test.ts`  
**Commit:** `b9d5f07`  
**Applied fix:** Both hosts now subscribe their active readiness-wait registry to installed-catalog changes. A changed or removed selected record synchronously rejects and clears the stale readiness wait, allowing the bounded controller to retry the current catalog record. Paja unsubscribes on `pagehide`; Playground installs one listener per shell lifecycle and removes it on `pagehide`. Real-host regressions keep A permanently unready, cover an equal-record object replacement followed by B, and verify that only ready B receives one `intent.deliver`.

### CR-02–CR-04: Relay publication succeeded or consumed replay state before transport acceptance

**Files modified:** `apps/playground/src/playground-relay-service.ts`, `packages/runtime/src/relay-handler.ts`, `packages/runtime/src/replay.ts`, `packages/services/src/relay-pool-service.ts`, `packages/shell/src/hooks-adapter.ts`, and matching tests/docs
**Commit:** `ec2e61b`
**Applied fix:** Playground caches only accepted publications and emits canonical result envelopes. Runtime and shell preserve asynchronous relay settlement before success, while the replay detector now reserves pending events, commits accepted events, and releases failed events for deterministic retry without allowing concurrent duplicates.

### CR-05: Paja retained and acknowledged denied or rejected publications

**Files modified:** `packages/paja/src/browser-relay-runtime.ts`, `packages/paja/src/browser-relay-runtime.test.ts`, Paja docs, changeset, and conformance guard
**Commit:** `8a87455`
**Applied fix:** Paja uses one awaited publication attempt for service and outbox flows. Denial or all-relay rejection produces a canonical failure and retains nothing; only an accepted publication reaches the in-memory view and subscribers.

### WR-01: Paja scoped relay publication discarded the asynchronous result

**Files modified:** `packages/paja/src/browser-adapter.ts`, runtime/shell relay hook types and adapter, Paja relay regression, docs, changeset, and conformance guard
**Commit:** `644c2d1`
**Applied fix:** `publishToScopedRelay()` now preserves `boolean | Promise<boolean>` through Paja, shell, and runtime. Paja awaits its backend and reports denial or transport failure as `false`, eliminating the unhandled rejection and premature success.

## Verification Reliability Follow-up

The final browser sweep reached every cold-target assertion but once stalled
while closing the local pointer HTTP server. Commit `c7e0cbf` closes idle and
active fixture sockets during teardown. The targeted case passed five repeated
runs, and the complete final suite passed 79 applicable tests with the one
documented opt-in live-network case skipped.

---

_Fixed: 2026-07-27T14:41:01Z_
_Fixer: the agent (gsd-code-fixer)_  
_Iteration: 9_
