---
phase: quick-260724-czo
plan: 01
subsystem: sandbox-security
tags: [csp, nip-5d, srcdoc, paja, playground]
requires:
  - phase: NIP-5D PR #2303
    provides: verified srcdoc and allow-scripts-only sandbox requirements
provides:
  - Complete identical Class-1 CSP builders for verified playground and Paja srcdoc
  - Cross-loader CSP parity regression coverage
  - Paja patch release metadata and policy documentation
affects: [playground, paja, verified-artifact-loading]
tech-stack:
  added: []
  patterns: [inject host CSP after verification and before namespace prelude]
key-files:
  created: [tests/unit/srcdoc-csp-parity.test.ts, .changeset/full-srcdoc-csp.md]
  modified: [apps/playground/src/napplet-resolver.ts, packages/paja/src/runtime-resolver.ts]
key-decisions:
  - "Class-1 CSP is an explicit Kehto policy gap, not a NIP-5D or NAP requirement."
  - "Only caller-provided, deduplicated, sorted connect origins are emitted; target-URL mode remains out of scope."
patterns-established:
  - "Verified srcdoc transforms stay ordered: verified bytes → CSP meta → namespace prelude."
requirements-completed: [QUICK-260724-CZO]
coverage:
  - id: D1
    description: Complete Class-1 policy in both verified srcdoc loaders with byte-for-byte parity.
    requirement: QUICK-260724-CZO
    verification:
      - kind: unit
        ref: pnpm test:unit
        status: pass
      - kind: e2e
        ref: tests/e2e/gateway-artifact-parity.spec.ts and tests/e2e/paja-runtime-pointer.spec.ts
        status: pass
    human_judgment: false
    rationale: Full Playwright suite passed through an untracked local config using the installed macOS Chrome binary; the repository's /usr/bin/chromium default remained unchanged.
duration: 33min
completed: 2026-07-24
status: complete
---

# Quick Task 260724-czo: Full Class-1 CSP for verified srcdoc Summary

**Verified playground and Paja runtime-pointer documents now receive identical default-deny Class-1 CSP metadata before the host namespace prelude, with network egress restricted to caller grants.**

## Accomplishments

- Replaced connect-only metadata with the exact ordered Class-1 policy, ending in `frame-ancestors 'self'`.
- Kept CSP injection after artifact verification and before `injectNappletNamespacePrelude`; both iframe paths retain `sandbox="allow-scripts"` without `allow-same-origin`.
- Added direct cross-loader parity tests, browser assertions, policy documentation, and an `@kehto/paja` patch changeset.

## Task Commits

1. **Task 1: Enforce the complete policy in the verified playground path** — `434bba4` (`fix`)
2. **Task 2: Give Paja the identical policy and prove cross-loader parity** — `8c812ad` (`fix`)
3. **Task 3: Align docs and add release metadata** — `d3d966a` (`docs`)

## Verification

- Passed: focused playground and Paja/parity Vitest suites; `pnpm build`; `pnpm type-check`; `pnpm test:unit` (105 files, 1378 tests); `pnpm docs:check`; `pnpm audit:csp`; `pnpm dlx aislop@0.12.0 scan --changes --base origin/main` (100/100); `git diff --check`.
- Passed: full Playwright suite via an untracked local config using the installed macOS Chrome binary (73 passed, 1 existing network-dependent test skipped). The repository's `/usr/bin/chromium` default was not changed.

## Decisions Made

- NIP-5D PR #2303 at `78efc118278e3ed42201eba9b60530b65835d7ed` was checked: it requires verified `srcdoc` and `allow-scripts` without `allow-same-origin`, but no baseline CSP.
- `napplet/naps` master at `6461e4b` has no CSP contract. This implementation is documented as Kehto policy, not a protocol requirement.
- Paja target-URL mode deliberately retains its existing base/namespace path without the verified runtime-pointer CSP.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored the required Paja package-doc version row**
- **Found during:** Task 3
- **Issue:** `pnpm docs:check` rejected `docs/packages/paja.md` because it still listed `0.8.0` while the package is `0.8.1`.
- **Fix:** Updated the required version row alongside the policy documentation.
- **Files modified:** `docs/packages/paja.md`
- **Verification:** `pnpm docs:check` passed.
- **Committed in:** `d3d966a`

**Total deviations:** 1 auto-fixed (Rule 3).

## Issues Encountered

- The workspace initially lacked declared dependencies in `node_modules`; `pnpm install --frozen-lockfile` restored the lockfile-defined installation without changing repository files.
- The repository's Linux/CI browser path remained `/usr/bin/chromium`; local macOS proof used a temporary, untracked Playwright config that was deleted after the run.

## Known Stubs

None.

## Self-Check: PASSED

- All three task commits and all listed deliverables exist on `fix/full-srcdoc-csp`.
- The task left no tracked implementation changes; the plan and summary are ready for the orchestrator's final documentation commit.

## Next Steps

Review the Linux/CI Playwright result on the PR as the final environment-parity check.
