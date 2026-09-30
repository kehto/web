---
phase: 105-published-convention-adoption-and-host-flows
plan: 11
subsystem: published package documentation and release metadata
tags: [changesets, nap-intent, nap-shell, nip-5d, package-compatibility]
requires:
  - phase: 105-10
    provides: "Classification-aware guards for published convention authorities and host shell drift."
provides:
  - "Active package documentation aligned to the core/nap 0.29.0 compatibility floor."
  - "Recorded mandatory host-owned NAP-SHELL exception for published core/shim omission."
  - "A seven-package minor changeset for every changed shipped manifest."
affects: [105-12, release-metadata, package-drift]
tech-stack:
  added: []
  patterns: [exact-authority-provenance, 0.x-breaking-minor-changeset, host-owned-shell-exception]
key-files:
  created:
    - .changeset/phase-105-published-package-line.md
  modified:
    - RUNTIME-SPEC.md
    - docs/policies/NIP-5D-CONFORMANCE.md
    - docs/policies/SHELL-RESOURCE-POLICY.md
    - docs/packages/acl.md
    - docs/packages/firewall.md
    - docs/packages/runtime.md
    - docs/packages/services.md
    - docs/packages/shell.md
    - packages/acl/README.md
    - packages/firewall/README.md
    - packages/runtime/README.md
    - packages/services/README.md
    - packages/shell/README.md
key-decisions:
  - "Treat the core/nap 0.29.0 peer-floor increase as breaking 0.x work and classify every affected published package as minor."
  - "Retain Kehto's host-owned NAP-SHELL prelude because published core 0.29.0 and shim 0.27.0 omit generic mandatory shell."
  - "Treat resource hardening as non-normative Kehto policy: no standalone NAP-RESOURCE.md exists at the pinned master authority."
requirements-completed: [PKG-01, PKG-02, PKG-03, PKG-04]
coverage:
  - id: D1
    description: "Active package and runtime documentation records the selected published convention line and exact authorities."
    requirement: PKG-01
    verification:
      - kind: other
        ref: pnpm docs:check
        status: pass
      - kind: unit
        ref: pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts tests/unit/sdk-migration-guard.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "One minor changeset covers every changed published manifest."
    requirement: PKG-04
    verification:
      - kind: other
        ref: pnpm changeset status
        status: pass
    human_judgment: false
metrics:
  duration: 20m
  completed: 2026-07-27
status: complete
---

# Phase 105 Plan 11: Published Package Documentation and Release Metadata Summary

**Active Kehto guidance now pins the published core/nap 0.29.0 line, preserves the mandatory host shell exception, and releases all seven changed manifests as 0.x minors.**

## Performance

- **Duration:** 20m
- **Started:** 2026-07-27T12:09:00Z
- **Completed:** 2026-07-27T12:29:00Z
- **Tasks:** 2/2
- **Files modified:** 14

## Accomplishments

- Replaced stale 0.28-era compatibility rows with the published `>=0.29.0 <0.30.0` core/nap peer range and documented exact package provenance.
- Recorded NAP-INTENT, NAP-IDENTITY/NAP-THEME/NAP-SHELL, published source, and release authorities in active guidance.
- Preserved Kehto's parent-bound mandatory shell prelude because released core 0.29.0 and shim 0.27.0 omit generic shell; never attributed shell implementation to the shim.
- Reframed resource hardening as non-normative Kehto policy: NAP-IDENTITY delegates profile-media `resource.bytes`, while the directly checked master ref has no standalone `NAP-RESOURCE.md` or inferred wire extension.
- Added one minor changeset with exactly `@kehto/acl`, `@kehto/cli`, `@kehto/firewall`, `@kehto/paja`, `@kehto/runtime`, `@kehto/services`, and `@kehto/shell`.

## NAP Authority Check

- **NAP-INTENT:** directly checked at `napplet/naps` PR #91 commit `a718915ddefa2f03a0126579601f59d8bd86f7c4` (`naps/NAP-INTENT.md`): an accepted result transfers retained delivery responsibility, target delivery follows readiness, and no second source result reports post-acceptance failure.
- **NAP-IDENTITY / NAP-THEME / NAP-SHELL:** fetched and directly checked at `napplet/naps` master commit `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`: `naps/NAP-IDENTITY.md`, `naps/NAP-THEME.md`, and `naps/NAP-SHELL.md` exist; `naps/NAP-RESOURCE.md` is absent. Identity delegates picture/banner bytes through `resource.bytes`; theme changed delivery is automatic; shell is foundational with one ready/init handshake and local supports/services/onReady semantics.
- **Published artifacts:** source `dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b`; release `60889f1c2476e063500c7ab6624af6abe0dbcbe5`.

## Verification

- `pnpm docs:check` — passed; 9 public package docs audited.
- `pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts tests/unit/sdk-migration-guard.test.ts` — passed; 2 files, 26 tests.
- `pnpm changeset status` — passed; all seven changed Kehto packages appear in the minor list. Existing unrelated pending changesets also report `@kehto/playground` and `@test/harness` at patch.
- `git diff --check` and `git diff --check HEAD~2..HEAD` — passed.
- `npx --no-install aislop scan -d` — completed with 0 errors and 12 pre-existing warnings in unrelated runtime/Paja/playground files; no Plan 11 file was reported.

## Task Commits

1. **Task 1: Clean active runtime and package guidance** — `c82e000` (docs)
2. **Task 2: Add one complete seven-package breaking/minor changeset** — `d8a57e2` (chore)

## Files Created/Modified

- `RUNTIME-SPEC.md` — selected package line, canonical intent ownership, and shell exception.
- `docs/policies/NIP-5D-CONFORMANCE.md` — exact authorities, completed adoption boundary, and no inferred resource extension.
- `docs/policies/SHELL-RESOURCE-POLICY.md` — Kehto-only hardening boundary and NAP-IDENTITY delegation source.
- `packages/{acl,firewall,runtime,services,shell}/README.md` and `docs/packages/{acl,firewall,runtime,services,shell}.md` — current peer ranges and package guidance.
- `.changeset/phase-105-published-package-line.md` — exactly seven minor release entries.

## Decisions Made

- Use the direct immutable NAP refs as authority, not a Kehto-local mirror or a package omission.
- Keep the resource documentation explicitly non-normative because the pinned master tree has no standalone NAP-RESOURCE document.
- Do not pre-version docs rows; they remain aligned with current package manifests until the Version Packages workflow consumes the changeset.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The existing local `napplet/naps` checkout did not initially contain `5ac049...`; fetching that exact immutable object from `origin` resolved it and enabled direct source verification.
- The slop scan reports 12 existing warnings outside this plan's files, but exits successfully with 0 errors. They were not changed under this documentation/release-metadata plan.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

Plan 12 can rely on active package, authority, resource-policy, and release-metadata guidance without resurrecting stale 0.28-era ranges or claiming a standalone NAP-RESOURCE specification.

## Self-Check: PASSED

- All 14 task artifacts and `105-11-SUMMARY.md` exist.
- Task commits `c82e000` and `d8a57e2` exist and contain parsed `Co-Authored-By: Codex <noreply@openai.com>` trailers.
- Stub scan found no placeholders, TODO/FIXME markers, or unwired empty rendering values in this documentation and changeset scope.
