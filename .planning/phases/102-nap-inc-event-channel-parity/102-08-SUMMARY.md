---
phase: 102-nap-inc-event-channel-parity
plan: 08
subsystem: release-metadata-and-conformance
tags: [changesets, nap-inc, runtime, shell, acl, services, playwright]
requires:
  - phase: 102-07
    provides: Active INC contract guidance pinned to the exact draft authorities
provides:
  - Four package-specific minor changesets for the shipped Phase 102 INC surface
  - Focused cross-host conformance evidence across runtime, ACL, shell, services, Paja, and playground
affects: [phase-104-nap-intent-convention-binding, phase-105-published-napplet-package-adoption, release]
tech-stack:
  added: []
  patterns:
    - Separate 0.x changesets for each publishable package with an observable contract change
    - Browser conformance uses a temporary IPv6-only Kehto preview when IPv4 port 4174 belongs to another process
key-files:
  created:
    - .changeset/phase-102-runtime-inc.md
    - .changeset/phase-102-shell-inc.md
    - .changeset/phase-102-acl-inc.md
    - .changeset/phase-102-services-inc.md
    - .planning/phases/102-nap-inc-event-channel-parity/102-08-SUMMARY.md
  modified:
    - .planning/WINDOWS.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
key-decisions:
  - "Release metadata covers runtime INC routing and lifecycle, shell binding, ACL channel-open authorization, and services compatibility retirement."
  - "NAP-INC #89, web projection #90, and symmetric-channel #92 remain draft authorities; no draft is represented as merged."
  - "Phase 104 owns NAP-INTENT lifecycle work and Phase 105 owns published Napplet package adoption."
requirements-completed: [BASE-04, BASE-05, INC-01, INC-02, INC-03, INC-04, INC-05, INC-06, INC-07, INC-08]
coverage:
  - id: D1
    description: Package-specific release metadata records the observable Phase 102 runtime, shell, ACL, and services contract changes.
    requirement: INC-01
    verification:
      - kind: unit
        ref: pnpm exec vitest run tests/unit/nap-inc-conformance.test.ts packages/runtime/src/types.test.ts packages/runtime/src/runtime.test.ts packages/runtime/src/acl-state.test.ts packages/runtime/src/dispatch.test.ts packages/runtime/src/service-dispatch.test.ts packages/acl/src/resolve.test.ts packages/shell/src/napplet-namespace.test.ts packages/services/src/notification-service.test.ts packages/paja/src/browser-host.test.ts tests/unit/playground-gateway-guard.test.ts tests/unit/nip5d-conformance-guard.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Complete browser conformance remains gated on published Napplet package adoption and the unavailable local AI-slop executable.
    requirement: INC-08
    verification:
      - kind: e2e
        ref: pnpm test:e2e
        status: fail
      - kind: other
        ref: npx --no-install aislop scan -d
        status: fail
    human_judgment: true
    rationale: The full suite reached the isolated Kehto preview and proved the Phase 102 channel flow, but seven legacy demo/fixture tests remain red at the Phase 105 package-adoption boundary; the unrelated IPv4 listener and unpublished dependencies were not changed.
metrics:
  duration: 6m 26s
  completed: 2026-07-23
  tasks_completed: 1
  files_changed: 8
status: complete
---

# Phase 102 Plan 08: Release Metadata and Cross-Host Conformance Summary

**Four minor changesets now describe the shipped NAP-INC runtime, shell, ACL, and services breaks, backed by green focused runtime-to-browser evidence without expanding into intent lifecycle or package adoption.**

## Performance

- **Duration:** 6m 26s
- **Started:** 2026-07-23T19:13:19Z
- **Completed:** 2026-07-23T19:19:45Z
- **Tasks:** 1/1
- **Files modified:** 8

## Accomplishments

- Added one minor 0.x changeset each for `@kehto/runtime`, `@kehto/shell`, `@kehto/acl`, and `@kehto/services`; no package version was applied.
- Kept the release notes scoped to the exact draft authorities: NAP-INC #89 `4593ce9e301ce098fd3dad64206fcd6f144fa7af`, web projection #90 `896c32c92deee68dc4d10fc1132b62df20cccb6f`, and symmetric channels #92 `c5cd06f7be6d4690b303949abb26e87ff62f4729`.
- Proved the focused cross-host chain with 309 unit assertions and 14 browser tests, including Paja and the IPv6-isolated playground INC proof.
- Rechecked the upstream reply on `kehto/web#203`: it points to draft #92 and confirms symmetric handles, target-open-before-result ordering, retained early/terminal lifecycle state, explicit close notifications, informational-only `channel.list()`, and the distinction between runtime open success and target application acceptance.

## NAP Authority Checked

- Draft NAP-INC PR #89 exact head `4593ce9e301ce098fd3dad64206fcd6f144fa7af` (`naps/NAP-INC.md`) records carrier-neutral sender attestation.
- Draft web projection PR #90 exact head `896c32c92deee68dc4d10fc1132b62df20cccb6f` (`projections/web.md`) defines queryless convention identity and pre-wire URI-query transposition.
- Draft symmetric-channel PR #92 exact head `c5cd06f7be6d4690b303949abb26e87ff62f4729` (`naps/NAP-INC.md`) records symmetric handle semantics.

The GitHub commit records were checked directly. These remain draft authorities; this plan does not claim they are merged. The changesets are conformant with their scoped INC requirements and deliberately do not claim NAP-INTENT lifecycle behavior (Phase 104) or published Napplet package adoption (Phase 105).

## Verification

- `pnpm exec vitest run …` focused Phase 102 suites — passed: 12 files, 309 tests.
- `pnpm build` — passed: 32 packages.
- `pnpm type-check` — passed: 17 packages.
- `pnpm test:unit` — passed: 108 files, 1,339 tests.
- `KEHTO_PLAYGROUND_BASE_URL='http://[::1]:4174' pnpm exec playwright test tests/e2e/demo-notification-service.spec.ts tests/e2e/notify-lifecycle.spec.ts tests/e2e/paja-single-window.spec.ts tests/e2e/nap-inc-playground.spec.ts --workers=1` — passed: 14 tests. The temporary IPv6 preview was stopped; the unrelated IPv4 `127.0.0.1:4174` Fipwave process was never modified.
- `pnpm docs:check` — passed.
- `git diff --check` — passed before staging the changesets and again in the staged task commit.
- `KEHTO_PLAYGROUND_BASE_URL='http://[::1]:4174' pnpm test:e2e -- --workers=1` — reached the correct Kehto preview and completed with 69 passed, 1 skipped, and 7 failed. The symmetric-channel test passed. The remaining failures are legacy demo/fixture package-adoption work owned by Phase 105 and are recorded in Windows entry 21.
- `npx --no-install aislop scan -d` — not run successfully: the pinned `aislop@0.13.1` executable is absent, and `--no-install` correctly declined installation. The existing open Phase 102 Windows ledger entries cover this environment limitation.

## Task Commit

1. **Task 1: Record package impact and run the complete phase gate** — `7712950` (`chore`)

## Files Created/Modified

- `.changeset/phase-102-runtime-inc.md` — runtime sender, channel, authorization, and exact dispatch break record.
- `.changeset/phase-102-shell-inc.md` — injected binding and symmetric-channel API break record, explicitly scoped away from intent lifecycle.
- `.changeset/phase-102-acl-inc.md` — channel-open authorization mapping break record.
- `.changeset/phase-102-services-inc.md` — legacy audio/notification INC compatibility retirement break record.
- `.planning/WINDOWS.md` — closes the IPv4 harness conflict and records the remaining published-package adoption boundary.

## Decisions Made

- Use minor changesets for all four changed publishable 0.x packages because each has an observable breaking contract change.
- Retain the shared convention helper as an INC release fact only; Phase 104 remains the only intent-lifecycle authority and Phase 105 remains the package-adoption authority.
- Keep the full E2E harness failure visible instead of changing a protected unrelated listener or rewriting its hardcoded IPv4 test.

## Deviations from Plan

None - implementation scope and package metadata followed the plan exactly. Two verification environment limitations are documented below and in the Windows ledger.

## Issues Encountered

- The initial IPv6 preview invocation passed script arguments through incorrectly and did not bind. Retrying `vite preview` directly with `--host ::1 --port 4174` established the required isolated preview; no source file changed.
- The audit spec's hardcoded IPv4 URL was made externally configurable in follow-up commit `b86c927`; a clean full run then reached Kehto over IPv6 while leaving the unrelated Fipwave listener untouched.
- Seven legacy demo/fixture tests remain red until the concurrent `napplet/web` chase publishes and Kehto adopts the convention-capable package set. Windows entry 21 tracks this Phase 105 boundary.
- The configured `aislop@0.13.1` executable is absent. Installation was intentionally not attempted, and the existing open Phase 102 Windows entries retain that unrun verification.

## Known Stubs

None.

## Threat Flags

None - this plan adds release metadata and planning records only; it introduces no new network endpoint, authentication path, file-access pattern, or trust-boundary schema change.

## Next Phase Readiness

- The four changesets are ready for the normal Version Packages workflow; no local versioning, publishing, push, or PR was performed.
- Phase 104 may reuse the binding helper only within its NAP-INTENT lifecycle scope, and Phase 105 remains responsible for published Napplet package conformance.
- Published Napplet package adoption and the missing AI-slop binary must be resolved before a fully green repository release gate can be claimed.

## Self-Check: PASSED

- Confirmed all four declared changesets and this summary exist.
- Confirmed task commit `7712950` exists in git history.

---
*Phase: 102-nap-inc-event-channel-parity*
*Completed: 2026-07-23*
