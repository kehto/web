---
phase: 103-identity-and-theme-wire-parity
plan: 07
subsystem: conformance-release
tags: [nap-identity, nap-theme, vitest, playwright, changesets, documentation]
requires:
  - phase: 103-identity-and-theme-wire-parity
    provides: canonical runtime/service results and protected Paja/playground delivery
provides:
  - active-source identity/theme conformance guard
  - pinned developer documentation and explicit Kehto theme fallback policy
  - minor release metadata for five changed public packages
affects: [phase-103-verification, phase-105-package-adoption, release]
tech-stack:
  added: []
  patterns: [file-scoped static contract guard, complete-theme-state-before-push, explicit spec-gap reconciliation]
key-files:
  created:
    - tests/unit/identity-theme-conformance-guard.test.ts
    - .changeset/phase-103-runtime-identity-theme.md
    - .changeset/phase-103-services-identity-theme.md
    - .changeset/phase-103-shell-identity-theme.md
    - .changeset/phase-103-acl-identity-theme.md
    - .changeset/phase-103-paja-identity-theme.md
  modified:
    - apps/playground/src/signer-modal.ts
    - docs/policies/NIP-5D-CONFORMANCE.md
    - packages/runtime/README.md
    - packages/services/README.md
    - packages/shell/README.md
    - apps/playground/README.md
key-decisions:
  - "Pinned NAP-IDENTITY, NAP-THEME, and web projection authority to napplet/naps@896c32c92deee68dc4d10fc1132b62df20cccb6f."
  - "Kehto denied/unavailable theme reads use one complete fixed normal result without error as an explicit upstream-spec-gap reconciliation."
  - "The unrelated Phase 102 Paja INC-after-reload failure remains out of scope; no protocol workaround was added."
patterns-established:
  - "Static guards assert positive implementation and documentation seams, scoped to active sources rather than historical records."
requirements-completed: [IDENTITY-01, IDENTITY-02, IDENTITY-03, IDENTITY-04, THEME-01, THEME-02, THEME-03, THEME-05]
coverage:
  - id: D1
    description: Canonical public-key diagnostic and runtime/service result shapes
    requirement: IDENTITY-01
    verification:
      - kind: unit
        ref: tests/unit/identity-theme-conformance-guard.test.ts and packages/runtime/src/dispatch.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Readonly protected identity/theme bindings and eligible-recipient automatic delivery
    requirement: IDENTITY-04
    verification:
      - kind: unit
        ref: packages/shell/src/shell-bridge.test.ts and packages/shell/src/napplet-namespace.test.ts
        status: pass
      - kind: e2e
        ref: tests/e2e/nap-identity.spec.ts and tests/e2e/nap-theme.spec.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Complete theme state before one automatic host push in playground and Paja
    requirement: THEME-03
    verification:
      - kind: unit
        ref: packages/services/src/theme-service.test.ts and packages/paja/src/browser-host.test.ts
        status: pass
      - kind: e2e
        ref: tests/e2e/theme-broadcast.spec.ts
        status: pass
    human_judgment: false
  - id: D4
    description: Current policy/package documentation and five public-package minor changesets
    requirement: THEME-02
    verification:
      - kind: other
        ref: pnpm docs:check and pnpm exec changeset status
        status: pass
    human_judgment: false
metrics:
  duration: 8m
  completed: 2026-07-23
status: complete
---

# Phase 103 Plan 07: Identity and Theme Conformance Closeout Summary

**Phase 103 now has a scoped identity/theme drift guard, pinned developer guidance, and five public-package minor changesets around canonical results and recipient-authorized state-before-push delivery.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-23T21:54:43Z
- **Completed:** 2026-07-23T22:01:56Z
- **Tasks:** 3/3
- **Files modified:** 12

## Accomplishments

- Removed the playground signer probe's obsolete public-key error-envelope branch. Timeout, malformed reply, and mismatch are now local diagnostic failures; the real probe accepts only the canonical correlated result, including the empty public-key sentinel.
- Added a file-scoped active-surface guard across runtime, services, ACL/shell, Paja, playground, and current developer guidance. It proves the fixed complete fallback, silent unsupported actions, parent-only protected bindings, eligible recipient checks, and the single ThemeService-to-bridge path.
- Documented NAP-IDENTITY, NAP-THEME, and web-projection authority at `napplet/naps@896c32c92deee68dc4d10fc1132b62df20cccb6f`, including Kehto's deliberate complete no-error fallback policy for denied/unavailable theme reads.
- Added separate 0.x minor changesets for `@kehto/runtime`, `@kehto/services`, `@kehto/shell`, `@kehto/acl`, and `@kehto/paja`; no private playground changeset, package version, package adoption, publication, Phase 102 change, or planning-config change was made.

## Task Commits

1. **Task 1: Retire the active public-key error branch and lock cross-layer conformance with a static guard** — `0fab849` (RED test), `b62a7f7` (fix), `953b01b` (current-guidance guard).
2. **Task 2: Synchronize active identity/theme documentation with the pinned contract and Kehto policy** — `f32abe6`.
3. **Task 3: Record package impact and run the complete Phase 103 gate** — `a1fa730`.

## Verification

- Focused cross-layer Vitest matrix — **9 files, 362 passed**.
- Full unit suite — **110 files, 1,407 passed**.
- Focused IPv6 browser proof (`http://[::1]:4174`) — `nap-identity`, `nap-theme`, and `theme-broadcast` passed; the combined four-file command completed **8/9** because `paja-single-window` also contains the preserved Phase 102 INC-after-reload test, which timed out at its post-reload delivery assertion (`tests/e2e/paja-single-window.spec.ts:488`). This is the previously observed cross-phase blocker, not a Phase 103 identity/theme regression; no workaround or Phase 102 edit was made.
- `pnpm build`, `pnpm type-check`, `pnpm docs:check`, and `git diff --check` — passed.
- `pnpm exec changeset status` reports exactly these five Phase 103 packages at minor; pre-existing unrelated changesets remain separate.
- AI-slop scan — unavailable (`aislop` is not installed locally or on PATH); this pre-existing tooling gap is already tracked in `.planning/WINDOWS.md` item 22. No package was installed.
- The preserved Phase 102 reload failure is additionally recorded in `.planning/WINDOWS.md` item 23 for ship-time visibility.

## Decisions Made

- Upstream contract check: draft NAP-IDENTITY, NAP-THEME, and `projections/web.md` at `896c32c92deee68dc4d10fc1132b62df20cccb6f`. Identity results and protected delivery conform; the complete no-error theme fallback is explicitly documented as Kehto's allowed policy/spec-gap reconciliation rather than a new wire type.
- Generic diagnostic behavior is not protocol authority. The signer probe reports local failure without recognizing an unsupported identity error envelope.
- Phase 105 retains published Napplet package adoption. Phase 102 retains its unresolved repeated-overflow and Paja reload concerns.

## Deviations from Plan

None - plan executed as specified. The current-doc assertions were added to the planned active-surface guard so it covers all current Phase 103 artifacts named by the plan.

## Known Stubs

None.

## Issues Encountered

- The aggregate Paja Playwright file includes an unrelated Phase 102 INC reload assertion. It failed after the three Phase 103 browser proofs and five other Paja tests passed. The failure is retained as evidence only and remains outside this plan's implementation boundary.
- AI-slop cannot run because no approved binary is available. The existing Phase 103 Windows ledger entry remains open; installation is prohibited by the plan.

## User Setup Required

None - no external setup or package publication was performed.

## Next Phase Readiness

Phase 103 implementation and release metadata are ready for formal verification. Phase 102's upstream protocol ambiguity and Phase 105's published-package adoption remain explicitly deferred.

## Self-Check: PASSED

- All twelve planned artifacts exist and the task commits `0fab849`, `b62a7f7`, `953b01b`, `f32abe6`, and `a1fa730` are present.
- No tracked file deletion, package manifest/lockfile change, Phase 102 artifact change, or `.planning/config.json` mutation was introduced by this plan.
