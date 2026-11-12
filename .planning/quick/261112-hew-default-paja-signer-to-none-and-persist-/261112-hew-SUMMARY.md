---
phase: quick-261112-hew
plan: "01"
status: complete
subsystem: paja
tags: [signer, preferences, identity, race-safety]
requires: []
provides: [explicit None default, origin-local signer preference, stale-connection suppression]
affects: [paja]
tech-stack:
  added: []
  patterns: [allowlisted localStorage preference, connection generation ownership]
key-files:
  created: [.changeset/paja-explicit-signer-choice.md]
  modified:
    - packages/paja/src/browser-signers.ts
    - packages/paja/src/browser-signers.test.ts
    - packages/paja/src/browser-host.ts
    - packages/paja/src/browser-host.test.ts
    - packages/paja/src/browser-devtools.ts
    - packages/paja/src/browser-devtools.test.ts
    - packages/paja/src/host-page.ts
    - packages/paja/README.md
    - docs/packages/paja.md
    - tests/e2e/paja-identity.spec.ts
    - tests/e2e/paja-relay.spec.ts
    - tests/e2e/paja-single-window.spec.ts
    - tests/e2e/paja-version-consent.spec.ts
key-decisions:
  - Persist only the selected method; Bunker restores disconnected and requires its URI again.
  - Extension availability is not consent; absent or invalid preferences resolve to None.
  - Preserve existing loaded-frame identity.changed gap and unrelated popup failure explicitly.
duration: approximately 20 minutes
completed: 2026-11-12
plan_head_before: 65148ac116627fc3926b6b792609014a99bc8885
actuals:
  tokens: 6949
  tasks: 3
  commits: 7
---

# Quick Task 261112-hew: Explicit Paja signer preference

Paja now starts with None, restores explicit signer methods without storing credentials, and discards stale asynchronous connection results.

## Delivered

- Accessible None control clears the signer and identity through existing listeners, cancelling pending signer confirmations.
- Every selection invalidates previous connection work. Pending Bunker clients are owned before awaiting connection and closed on replacement; late success/failure cannot reclaim state or close the replacement.
- `kehto:paja:signer-method:v1` accepts only none/dev/nip07/nip46. Storage errors remain nonfatal. NIP-07 and Dev restore through existing activation paths; Bunker restores visibly selected/disconnected with empty URI.
- Two-row signer controls preserve usable Bunker input width. Screenshots inspected at 390×900 and 1280×900; None active styling and all controls are visible. Input widths were 242px and approximately 235px. Layout-only probe deliberately used an unavailable target; real hosted-iframe behavior is covered by browser tests.
- Updated both Paja docs and added a patch changeset. No relay discovery implementation or PR #433 changes were imported.

## Commits

| Commit | Work |
|---|---|
| 26f143bf | RED: startup must not call the extension |
| 2cb39abe | Explicit None and generation-safe disconnect |
| 53fbe674 | RED: explicit NIP-07 must reconnect after reload |
| 8c000b73 | Method persistence, restore, unit race/storage coverage |
| 974d3c46 | Replace obsolete presence-driven startup source guard |
| f846450a | Responsive controls, documentation and changeset |
| 19aa2973 | Explicit extension selection in demonstrated dependent browser fixtures |

## Verification

| Gate | Result |
|---|---|
| `pnpm build` | PASS, 18 tasks; full E2E also rebuilt successfully |
| `pnpm type-check` | PASS, 20 tasks; rerun after final fixture changes |
| `NODE_OPTIONS=--no-webstorage pnpm test:unit` | PASS, 268 files / 3,439 tests |
| `pnpm docs:check` | PASS, 11 package docs plus routes/TypeDoc; rerun after README gap note |
| Focused signer/devtools Vitest | PASS, 22 tests, including 18 signer tests |
| Focused identity Playwright | 4 passed, 1 pre-existing fixme skipped |
| Migrated fixture + intent-links Playwright | 45 passed |
| Full `pnpm test:e2e` final run | **133 passed, 1 failed, 1 skipped** (135 total, 2.0m) |
| Pinned AI-slop 0.12.0 | PASS, 100/100, zero errors; existing unrelated browser-llm-panel function-length warning remains |
| `git diff --check` | PASS |

Browser runs used `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/home/robert/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome` and `KEHTO_HARNESS_PORT=43873` (focused runs also used 43874). No dependency installation was needed.

Final logs: `/tmp/opencode/hew-final-build.log`, `hew-types-final3.log`, `hew-final-unit2.log`, `hew-docs-final-readme.log`, `hew-quality-final3.log`, `hew-final-e2e2.log`, `hew-identity-final.log`, and `hew-migrated-fixtures.log`. Layout images: `hew-layout-390.png`, `hew-layout-1280.png` in the same directory.

### Full-suite failures and scope

The initial unit run had one obsolete source assertion requiring automatic extension connection. Updated it to require preference restoration and prohibit that old condition; all 3,439 units then passed.

The initial full browser run had 119 passes, 8 failures, 1 skip and 7 serial tests not run. Six failures were explicit auto-connect assumptions in relay, single-window and version-consent fixtures. Those exact files were inspected and setup now clicks NIP-07 without weakening authority assertions or globally seeding preferences. All affected suites passed afterward.

An initial intent-links missing-clipboard case observed one unexpected iframe click. No intent code or test was changed. It passed in the 45-test focused run and final full run; cause was not proven, so this is recorded as a transient observation rather than a fixed bug.

The final sole failure is the supplied pre-existing `tests/e2e/paja-firewall-rules.spec.ts:121` immediate popup URL assertion: expected `example.com/docs`, received empty string. Reproduced independently in a focused run. The baseline contains the same assertion, this test installs no signer, and no link implementation or test was changed. This matches the parent's reported baseline failure; no independent baseline checkout run was performed. It remains out of scope. **The complete browser suite is not green.**

## TDD Gate Compliance

- Startup RED: real browser observed 1 extension call where 0 was required.
- Restoration RED: explicit NIP-07 became disconnected after reload.
- Both records passed `gsd-tools check tdd-red-evidence` with `RED_EVIDENCE_OK` before implementation. The checker only parses TAP; the first normal Playwright output was rejected as zero discovered tests. A temporary TAP reporter reran the actual tests and supplied compatible evidence, without manufacturing results.
- Evidence: `/tmp/opencode/hew-red1.json`, `/tmp/opencode/hew-red2.json`; GREEN focused browser runs passed. No separate refactor was necessary.

## Deviations

- [Rule 3] Added `useNoSigner` mocks to two devtools test-state objects required by the new interface; used an ES2022-compatible deferred promise test helper.
- [Rule 1] Updated the stale browser-host source guard identified by the full unit gate.
- Plan-authorized evidence-driven fixture migration added three browser test files after the full suite demonstrated their automatic-connection assumptions.
- Parent owns planning state and push/PR closeout. SUMMARY and STATE were not committed; ROADMAP was not changed. No shipment or full-green claim is made.

## Specification and Threat Review

Checked `napplet/naps/naps/NAP-IDENTITY.md` at exact commit `43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab` through GitHub before edits. Empty no-signer query semantics are conformant and browser-proven; shell-user identity remains distinct from napplet identity and fixed simulation identity. No wire contract or signing permission was changed.

All four planned threats have corresponding boundaries/tests: preference allowlist and storage denial, stale success/error generation checks and client closure, method-only writes (including secret-bearing URI input), and existing confirmation cancellation/Firewall flows retained. Full relay and version-consent tests passed. No new endpoint, auth scheme, or additional trust-boundary surface was introduced.

## Known Stubs / Deferred Issues

No new implementation stubs. Existing `tests/e2e/paja-identity.spec.ts:143` fixme remains: signer changes reinitialize the iframe instead of delivering identity.changed to the existing frame. Both docs disclose this; complete NAP-IDENTITY conformance is **not** claimed. The unrelated popup failure and existing LLM panel complexity warning are also deferred, not silently repaired.

## Self-Check: PASSED

All 14 changed source/test/doc/changeset paths exist, all seven listed commits exist on `fix/paja-default-no-signer`, and no tracked deletions occurred. Working tree was clean before writing this uncommitted summary. Metrics use realized diff characters/4 and measured commit count from the persisted plan-base ledger, excluding this summary and the parent's prior planning commit.
