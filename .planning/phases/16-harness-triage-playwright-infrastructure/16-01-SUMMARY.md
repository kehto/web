---
phase: 16-harness-triage-playwright-infrastructure
plan: 01
subsystem: testing
tags: [playwright, e2e, spec-deletion, legacy-cleanup, BusKind, signer-service]

# Dependency graph
requires: []
provides:
  - "Seven legacy v1.1 spec files deleted from tests/e2e/"
  - "Zero surviving specs reference window.nostr, signer-service, BusKind, kind 29001, or kind 29002"
  - "Trustworthy red/green E2E baseline with 11 canonical v1.2-aligned surviving specs"
  - "E2E-01 closed"
affects: [16-02, 16-03, 16-04, 17, 18, 19, 20, 21]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Legacy spec deletion with explicit replacement mapping (spec → future phase → REQ-ID) documented in commit body"

key-files:
  created: []
  modified:
    - "tests/e2e/ (7 files deleted)"

key-decisions:
  - "All seven legacy specs deleted without content migration — replacement coverage is explicitly mapped to future phases"
  - "BusKind-referencing specs (kind 29003/29004) deleted in addition to the explicit E2E-01 list because any spec referencing the BusKind string is disqualified by the anti-term constraint"

patterns-established:
  - "Deletion-with-mapping pattern: every deleted spec has a documented replacement in a named future phase + REQ-ID"

requirements-completed:
  - E2E-01

# Metrics
duration: 8min
completed: 2026-04-17
---

# Phase 16 Plan 01: Legacy Spec Triage Summary

**Seven obsolete v1.1 signer/AUTH/BusKind spec files deleted from tests/e2e/, leaving an 11-spec v1.2-aligned baseline with zero anti-term hits**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-17T23:01:00Z
- **Completed:** 2026-04-17T23:09:43Z
- **Tasks:** 2
- **Files modified:** 7 deleted

## Accomplishments

- Deleted all four explicitly named legacy specs: auth-handshake, auth, signer-delegation, acl-matrix-signer
- Deleted three additional BusKind-referencing specs: acl-matrix-hotkey, inter-pane, state-isolation
- Anti-term grep (`window\.nostr|signer-service|BusKind|kind === 2900[12]`) returns zero hits across all remaining specs
- 11 surviving specs match the plan's expected inventory exactly

## Task Commits

1. **Task 1: Delete four explicitly named legacy specs** — `dd5677b` (chore)
2. **Task 2: Delete remaining BusKind-referencing specs** — `d2beec6` (parallel agent capture — files already staged by this agent, committed as part of 16-02 parallel execution)

## Files Created/Modified

All changes are deletions:

| Deleted file | Reason | Future replacement |
|---|---|---|
| `tests/e2e/auth-handshake.spec.ts` | NIP-42 AUTH handshake — obsolete; v1.2 removed this flow | `demo-signer-flow.spec.ts` — Phase 17 (E2E-06) |
| `tests/e2e/auth.spec.ts` | Legacy AUTH flow + window.nostr references | `napplet-auth.spec.ts` — Phase 18 (E2E-07) |
| `tests/e2e/signer-delegation.spec.ts` | kind 29001/29002 signer-service traffic | No direct replacement — Phase 19 `relay-publish-encrypted.spec.ts` (E2E-07) |
| `tests/e2e/acl-matrix-signer.spec.ts` | Signer-service ACL matrix (sign:event via kind 29001) | No direct replacement — Phase 19 acl-revoke-relay-write / acl-revoke-storage-write (E2E-08) |
| `tests/e2e/acl-matrix-hotkey.spec.ts` | BusKind.HOTKEY_FORWARD / kind 29004 | No direct replacement — deferred to v1.4+ when real hotkey backend ships |
| `tests/e2e/inter-pane.spec.ts` | BusKind.INTER_PANE / kind 29003 | `ifc-roundtrip.spec.ts` — Phase 18 (E2E-07) |
| `tests/e2e/state-isolation.spec.ts` | BusKind.INTER_PANE / kind 29003 for storage | `nub-storage.spec.ts` — Phase 21 (E2E-09) |

## Surviving Spec Inventory (11 specs)

```
tests/e2e/acl-enforcement.spec.ts
tests/e2e/acl-lifecycle.spec.ts
tests/e2e/acl-matrix-relay.spec.ts
tests/e2e/acl-matrix-state.spec.ts
tests/e2e/demo-audit-correctness.spec.ts
tests/e2e/demo-node-inspector.spec.ts
tests/e2e/demo-notification-service.spec.ts
tests/e2e/harness-smoke.spec.ts
tests/e2e/lifecycle.spec.ts
tests/e2e/replay.spec.ts
tests/e2e/routing.spec.ts
```

## Anti-term Verification

```
grep -rn "window\.nostr\|signer-service\|BusKind\|kind === 29001\|kind === 29002" tests/e2e/ --include="*.spec.ts"
(no output — zero hits)
```

## Decisions Made

- BusKind-referencing specs (kind 29003 inter-pane, kind 29004 hotkey) treated as anti-term violations because the `BusKind` string itself appears in comments/jsdoc within those files. This extends the original E2E-01 hit list from 4 to 7 deletions, as specified in the plan's context block.
- No content migration performed — this plan is deletion-only per spec. Replacements are the responsibility of future phases.

## Deviations from Plan

None — plan executed exactly as written. The three additional spec files (acl-matrix-hotkey, inter-pane, state-isolation) were pre-identified in the plan's `<interfaces>` block and confirmed by grep during Task 2.

Note: Task 2 files were staged by this agent via `git rm` but the commit landed in the parallel 16-02 agent commit `d2beec6` due to concurrent execution. The deletions are fully captured in git history.

## Issues Encountered

None — all spec files existed at expected paths. Parallel agent execution (16-02) captured the Task 2 staged deletions in its own commit. The end state is identical to the planned outcome.

## Next Phase Readiness

- E2E-01 is closed: seven legacy specs gone, zero anti-term hits, 11 canonical survivors remain
- Suite is ready for the harness driver extension (Plan 16-03) and survivor migration (Plan 16-04)
- No blockers

---
*Phase: 16-harness-triage-playwright-infrastructure*
*Completed: 2026-04-17*
