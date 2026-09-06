---
phase: 105-published-convention-adoption-and-host-flows
plan: 12
subsystem: documentation
tags: [paja, playground, nap-intent, nap-identity, nap-theme, nap-shell]
requires:
  - phase: 105-10
    provides: Published package and active host-flow implementation guidance
provides:
  - Paja guidance for persistent verified catalogs and retained intent delivery
  - Playground profile, resource Blob URL, theme, and shell-boundary guidance
affects: [paja, playground, published-napplet-conformance]
tech-stack:
  added: []
  patterns: [verified catalog separate from live frames, retained target delivery, host-owned mandatory shell]
key-files:
  created: []
  modified:
    - packages/paja/README.md
    - docs/packages/paja.md
    - apps/playground/README.md
    - docs/packages/playground.md
    - docs/how-tos/paja-getting-started.md
    - docs/how-tos/paja-local-authoring.md
key-decisions:
  - "Installed resolver-verified manifests remain distinct from live frames/controllers for availability and selection."
  - "Kehto retains its host-owned mandatory shell prelude because published shim 0.27.0 is non-shell."
  - "Profile media follows NAP-IDENTITY resource.bytes delegation without inferring standalone NAP-RESOURCE wire semantics."
patterns-established:
  - "Intent docs state retain → accepted result → start/reuse → registered-source ready → one target-only delivery."
  - "Profile media docs require resourceBytes-to-Blob URLs with stale, replacement, error, clear, and pagehide revocation."
requirements-completed: [PKG-02, IDENTITY-05, THEME-04, ARCH-03]
coverage:
  - id: D1
    description: Paja and playground documentation describes verified catalog selection and retained target delivery.
    requirement: ARCH-03
    verification:
      - kind: unit
        ref: pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts tests/unit/playground-gateway-guard.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Host guidance preserves the host-owned mandatory shell boundary and profile resource/theme behavior.
    requirement: PKG-02
    verification:
      - kind: other
        ref: pnpm docs:check
        status: pass
    human_judgment: false
metrics:
  duration: 10 min
  completed: 2026-07-27
status: complete
---

# Phase 105 Plan 12: Host Flow Documentation Summary

**Paja and playground guidance now documents verified handler catalogs, retained NAP-INTENT delivery, safe profile media, synchronized theme state, and Kehto-owned mandatory shell behavior.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-27T11:31:55Z
- **Completed:** 2026-07-27T11:41:20Z
- **Tasks:** 1/1
- **Files modified:** 6

## Accomplishments

- Distinguished resolver-verified installed catalogs from live tabs, frames, and controllers in Paja and playground guidance.
- Documented default, chooser, ambiguity, sender-aware explicit authorization, retained acceptance, current-source readiness, one target-only delivery, and controller-owned terminal policy without INC.
- Documented feed/profile convention use, early delivery registration, Blob URL media cleanup, and current-plus-one changed theme behavior.
- Recorded the pinned package/spec boundary: `@napplet/shim@0.27.0` is non-shell, so Kehto retains the mandatory host-owned shell prelude.

## Task Commits

1. **Task 1: Document the complete live Paja and playground host flows** — `c34ff4f` (docs)

## Files Created/Modified

- `packages/paja/README.md` — Paja catalog, target-delivery, and shell-boundary guide.
- `docs/packages/paja.md` — Published Paja peer line and complete host lifecycle reference.
- `apps/playground/README.md` — Current inventory plus profile intent, resource, theme, and shell behavior.
- `docs/packages/playground.md` — Private playground host-flow contract guidance.
- `docs/how-tos/paja-getting-started.md` — Local intent delivery and mandatory shell guidance.
- `docs/how-tos/paja-local-authoring.md` — Authoring shell boundary and retained delivery verification procedure.

## Authorities Checked

- `NAP-INTENT`: `/Users/sandwich/Develop/naps/naps/NAP-INTENT.md` at `a718915ddefa2f03a0126579601f59d8bd86f7c4` (draft PR #91 authority).
- `NAP-IDENTITY`, `NAP-THEME`, and `NAP-SHELL`: `/Users/sandwich/Develop/naps/naps/NAP-IDENTITY.md`, `NAP-THEME.md`, and `NAP-SHELL.md` at `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`.
- No `NAP-RESOURCE.md` exists at either checked tree; the documented resource behavior is limited to NAP-IDENTITY's `resource.bytes` delegation and Kehto policy.

## Decisions Made

- Documented accepted intent results as transferred delivery responsibility, never visible completion or INC delivery.
- Kept profile metadata queryless and used its URI query only as normalized invocation payload.
- Kept NAP-DM unadvertised because Paja has no deterministic development DM backend.

## Verification

- `pnpm docs:check` — passed.
- `pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts tests/unit/playground-gateway-guard.test.ts` — passed, 33 tests.
- `git diff --check` — passed.
- `npx --no-install aislop scan -d` — exited 0; reports 12 existing warnings in unrelated runtime/test files and no Plan 12 documentation finding.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The patch helper initially resolved relative paths against the primary checkout. The unintended primary-checkout edits were immediately restored before continuing with absolute paths rooted in the designated worktree; the primary checkout is clean and only the six planned documentation files changed in this worktree.

## Known Stubs

None.

## Next Phase Readiness

Host documentation is synchronized with the implemented published package and browser behavior. No user setup is required.

## Self-Check: PASSED

- Confirmed all six modified documentation files and this summary exist.
- Confirmed task commit `c34ff4f` exists and contains exactly the six planned documentation files.

---
*Phase: 105-published-convention-adoption-and-host-flows*
*Completed: 2026-07-27*
