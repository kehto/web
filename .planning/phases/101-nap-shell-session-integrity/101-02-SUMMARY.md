---
phase: 101-nap-shell-session-integrity
plan: 02
subsystem: runtime-shell-session-security
tags: [nap-shell, capabilities, origin-identity, immutable-snapshots, nip-5d]
requires:
  - phase: 101-01
    provides: "Source-bound NAP-SHELL session establishment and registration-id lifecycle guards"
provides:
  - "A domain-only, immutable ShellCapabilities contract without legacy negotiation payload fields"
  - "A host-integrator environment resolver that intersects per-identity grants with live, non-disabled wiring"
  - "First-ready environments that are immutable, source-scoped, and rebuilt only for explicit registration lifecycles"
affects: [101-03, shell-bridge, napplet-namespace, runtime-dispatch]
tech-stack:
  added: []
  patterns: ["Freeze fresh environment snapshots at every host-to-frame boundary", "Intersect host grants against exact live domains and services", "Track ready/session state by source registration identity"]
key-files:
  created: []
  modified: [packages/shell/src/types.ts, packages/shell/src/shell-init.ts, packages/shell/src/shell-ready.ts, packages/shell/src/napplet-namespace.ts, packages/shell/src/shell-bridge.test.ts]
key-decisions:
  - "ShellCapabilities carries only readonly bare domains; numbered protocols, flat naps, and sandbox data are no longer emitted or consumed."
  - "resolveShellEnvironment is a documented @kehto/shell host API, never an injected window.napplet capability."
  - "Identity grants only narrow exact live wiring, and every ready lifecycle receives a fresh frozen snapshot."
patterns-established:
  - "Host grant callbacks receive frozen availability inputs and cannot introduce aliases, duplicates, disabled names, or unwired domains/services."
  - "A new source registration replaces an executor-created session for the same windowId; duplicate ready for the same registration is inert."
requirements-completed: [SHELL-01, SHELL-02, SHELL-05, SHELL-06]
coverage:
  - id: D1
    description: "Domain-only live capability snapshots and bounded host grants"
    requirement: SHELL-01
    verification:
      - kind: unit
        ref: "packages/shell/src/shell-init.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Source-bound immutable first-ready environments with two-frame and reload isolation"
    requirement: SHELL-05
    verification:
      - kind: unit
        ref: "packages/shell/src/shell-bridge.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Legacy capability payload removal across public and injected shell contract guards"
    requirement: SHELL-02
    verification:
      - kind: unit
        ref: "pnpm test:unit"
        status: pass
    human_judgment: false
duration: 8min
completed: 2026-07-23
status: complete
---

# Phase 101 Plan 02: Domain-Only Shell Environments Summary

**A frozen, domain-only NAP-SHELL environment that safely narrows live runtime wiring per trusted creation identity.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-23T14:50:00Z
- **Completed:** 2026-07-23T14:58:00Z
- **Tasks:** 2/2
- **Files modified:** 11

## Accomplishments

- Replaced compatibility capability payloads with immutable, ordered `domains` snapshots derived from real runtime and service wiring.
- Added the host-only `resolveShellEnvironment(hooks, identity)` grant seam, which exact-intersects callback output with live and non-disabled domains/services.
- Bound first-ready session registration and environment delivery to the same trusted identity, with two-frame mutation isolation and explicit reload lifecycle coverage.

## Task Commits

1. **Task 1: Define the domain-only live/granted environment contract** — `fdc9a04` (feat)
2. **Task 2: Deliver immutable identity-scoped environments on first ready** — `ba93c0b` (feat)
3. **Regression guard alignment** — `5d40356` (test)

## Files Created/Modified

- `packages/shell/src/types.ts` — Public readonly domain-only capability and identity-aware grant hook types.
- `packages/shell/src/shell-init.ts` — Live wiring discovery plus frozen host-integrator environment resolution.
- `packages/shell/src/shell-ready.ts` — Single trusted identity handoff into session and init snapshot construction.
- `packages/shell/src/napplet-namespace.ts` — Domain-only cached shell receiver without numbered negotiation fallback.
- `packages/shell/src/shell-init.test.ts` and `packages/shell/src/shell-bridge.test.ts` — Grant, mutation, two-frame, duplicate-ready, and reload regression coverage.

## Decisions Made

- `ShellCapabilities` now exposes only readonly bare domains, matching the pinned `napplet/naps@6461e4b` NAP-SHELL example wire environment.
- Host policy may only subtract from real wiring; ACL operation rules are never used to infer grants.
- `resolveShellEnvironment` remains an `@kehto/shell` host adapter export and is deliberately absent from injected napplet APIs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated the injected shell receiver to consume only domain-only environments**
- **Found during:** Task 1
- **Issue:** The receiver still interpreted removed `protocols` and `naps` fields, which would preserve an obsolete capability surface after the producer changed.
- **Fix:** Sanitized cached `shell.init` capabilities to frozen bare domains and made protocol-form `supports()` queries return false.
- **Files modified:** `packages/shell/src/napplet-namespace.ts`, `packages/shell/src/napplet-namespace.test.ts`, `packages/shell/src/shell-supports-conformance.test.ts`
- **Verification:** Focused namespace and shell-init suites passed.
- **Committed in:** `fdc9a04`

**2. [Rule 1 - Bug] Realigned repository guard tests with the removed public fields**
- **Found during:** Plan-level `pnpm test:unit`
- **Issue:** Two guard suites still read `naps`, `protocols`, and `sandbox`, causing four failures after the deliberate public contract change.
- **Fix:** Replaced those assertions with exact domain-only contract guards.
- **Files modified:** `packages/shell/tests/no-window-nostr.test.ts`, `packages/shell/tests/perm-namespace.test.ts`
- **Verification:** `pnpm test:unit` passed with 104 files and 1,311 tests.
- **Committed in:** `5d40356`

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 1).

## Issues Encountered

- The initial full unit suite surfaced stale tests for fields this plan intentionally removes; the tests were updated in the same plan and the suite is green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 101-03 can rely on a single domain-only NAP-SHELL wire shape and immutable source-scoped environments.
- The pinned NAP-SHELL source checked was `napplet/naps@6461e4b37c29dc09a20dff35d9515889c4433874:naps/NAP-SHELL.md`; implementation is conformant with its domain-only example and source-assigned identity requirements.

## Self-Check: PASSED

- All key source and test files exist.
- Task commits `fdc9a04`, `ba93c0b`, and `5d40356` exist in git history.
