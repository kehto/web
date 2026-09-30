---
phase: 107-ipc-transport-foundation
plan: 06
subsystem: ipc-documentation
tags: [documentation, nap-inc, ipc, security-boundaries]
requires:
  - phase: 107-01
    provides: host-bound experimental IPC transport boundary
  - phase: 107-05
    provides: public shell-IPC documentation surface
provides:
  - pinned NAP authority correction for public shell-IPC documentation
  - preserved experimental and local-peer security guidance
affects: [phase-107-verification, phase-108-runtime-composition]
tech-stack:
  added: []
  patterns: [pinned-upstream-authority, synchronized-package-documentation]
key-files:
  created: []
  modified: [packages/shell-ipc/README.md, docs/packages/shell-ipc.md]
key-decisions:
  - "The pinned napplet/naps object defines no IPC carrier; NAP-INC endpoint binding remains a carrier-neutral statement, not an IPC projection."
  - "Private socket paths and permissions remain explicitly non-authenticating and non-cryptographic against hostile same-UID processes."
patterns-established:
  - "Public carrier documentation cites the exact upstream object and distinguishes a specification gap from a normative protocol contract."
requirements-completed: [BIND-01]
coverage:
  - id: D1
    description: "Both public shell-IPC documents accurately describe the pinned NAP source as defining no IPC carrier."
    requirement: BIND-01
    verification:
      - kind: other
        ref: "107-06 pinned-object, stale-claim, and normalized wording assertions"
        status: pass
      - kind: other
        ref: "pnpm docs:check"
        status: pass
    human_judgment: false
duration: 6min
completed: 2026-08-18
status: complete
---

# Phase 107 Plan 06: Correct IPC Authority Guidance Summary

**Public shell-IPC documentation now accurately states that the pinned NAP source defines no IPC carrier while retaining the experimental local-peer threat boundary.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-18T17:12:00Z
- **Completed:** 2026-08-18T17:18:24Z
- **Tasks:** 1/1
- **Files modified:** 2

## Accomplishments

- Rechecked `napplet/naps@c0f7dd14460622fc3a9870ea57a538474cf776fa`: its `naps/` and `projections/` tree has no IPC, Unix-domain, POSIX, or native-process carrier definition.
- Replaced the stale native OS-process projection attribution in both public documents with the precise specification-gap statement.
- Clarified that NAP-INC's generic authenticated-endpoint binding sentence is carrier-neutral, not an IPC projection.
- Preserved experimental/non-normative, non-authentication, non-cryptographic-identity, and hostile same-UID disclaimers.

## Task Commits

1. **Task 1: Correct and synchronize the pinned IPC authority statement** - `021c58c` (docs)

## Files Created/Modified

- `packages/shell-ipc/README.md` - corrected pinned-authority and carrier-neutral NAP-INC wording.
- `docs/packages/shell-ipc.md` - synchronized documentation-site authority and threat-boundary wording.

## Decisions Made

- Kehto IPC remains an experimental specification-gap implementation; the local NAP source offers no normative IPC carrier authority.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Verification compatibility] Made existing authentication disclaimers plain text for the required normalized wording assertion.**
- **Found during:** Task 1
- **Issue:** Markdown bold markers split the verifier's required `not peer authentication` / `not authenticate` phrases despite preserving the same visible meaning.
- **Fix:** Retained the warnings verbatim in meaning without Markdown emphasis so both documents satisfy the security-wording check.
- **Files modified:** `packages/shell-ipc/README.md`, `docs/packages/shell-ipc.md`
- **Verification:** Pinned-object, stale-claim, normalized-wording, and `pnpm docs:check` checks passed.
- **Committed in:** `021c58c`

---

**Total deviations:** 1 auto-fixed (verification compatibility).
**Impact on plan:** The adjustment preserved the security boundary while making it machine-verifiable.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 107's public authority wording now closes the recorded verification gap. Phase 108 can rely on explicit non-normative IPC carrier guidance.

## Self-Check: PASSED

- Confirmed both public documentation files and task commit `021c58c` exist.
- Confirmed the pinned-authority, NAP-INC distinction, stale-claim absence, and security-boundary assertions pass.
- Confirmed `pnpm docs:check` passes.
