---
status: resolved
trigger: "Validate and resolve kehto/web#266 without regressions or NIP-5D violations"
created: 2026-09-07
---

# Debug: initialization budget registration lifecycle

## Symptoms

- Expected: each fresh trusted registration gets a new initialization budget; repeated live-source messages do not reset it.
- Actual: two 15-request boots sharing a window ID within three seconds dispatch only 15 then 5 requests.
- Reproduction: issue #266 provides a deterministic public-runtime theme service reproduction; rejection is observable through service dispatch and firewall events.

## Current Focus

- Root cause: runtime observation initKey is scoped to the logical window without retiring its prior lifecycle budget.
- Fix: trusted registry registration invokes startup-counter retirement; ordinary messages and window cleanup alone cannot reset budgets. Keep stable keys to avoid retaining another counter on every same-ID reload.
- Next action: open the verified fix PR; stop at PR creation without merging.

## Specification check

- Checked napplet/naps master a040914b4bbd3a5cd8a14b0f316a723c968ebfb2, naps/NAP-SHELL.md. Sessions bind creation-time identity on first readiness; duplicate readiness must not replace a session. Burst quota values and counter keys are host policy, not new wire semantics.
- Also checked NAP-THEME at the same ref and NIP-5D PR #2303 head dskvr/nips@24711d9c47bbdd07908bf1d52bf677d9cbc530f0/5D.md. No wire or theme denial behavior changes. Result: conformant host lifecycle policy.

## Evidence

- Red: four runtime teardown/replacement cases dispatched 20 instead of 30 theme requests. Both shell replacement-source and stable-WindowProxy cases dispatched 20 instead of 40.
- Green: 67 focused tests across registration, firewall dispatch/state, and shell bridge passed. Includes repeated readiness, forged request fields, stale/unknown sources, 21st-op rejection, preserved dTag rate limits, immutable retirement, and bounded same-ID counter count.
- Independent review approved with no blocking findings.
- Initial full validation exposed primary-checkout environment contamination: nested historical .claude/worktrees are scanned by package guards, installed Napplet metadata does not match the frozen 0.32 package matrix, and package declaration builds report missing upstream exports. Preserve those worktrees and dependencies; validate in isolation.
- Initial pinned AI-slop scan: 100/100. pnpm lint exits successfully but defines no package lint tasks; pinned scan provides actual lint/static analysis.
- Clean frozen install resolved @napplet/core and @napplet/nap 0.32.0. Build: 32/32 tasks; type-check: 17/17 tasks; unit tests: 148 files, 1,734 tests; docs: strict TypeDoc, VitePress, all nine public package docs passed.
- Type checking caught an undeclared firewall import in the new shell test. The test now reads the configured burst limit through the existing runtime API, with no new dependency. Type-check, docs, and full units passed after this correction.
- The issue's exact standalone reproduction against built runtime output passes with only its immediateReload expectation changed to 15 dispatched / 0 rejected. The other controls remain 15/0, 15/0, 15/0, and 20/1.
- Full browser verification: 84/84 Playwright tests passed, including Paja reload, playground source registration, NAP-SHELL, theme, identity, and INC coverage. An initial run had one preview-server 404 during a concurrent type-check-triggered playground rebuild; the isolated two-test rerun and full sequential rerun passed. Do not rebuild served output during browser verification.
- Final pinned AI-slop scan: 100/100 with no findings; whitespace check clean. No production code changed after the successful build/type/unit/docs verification.

## Related issue 267 assessment

- Confirmed same-action-ID binding loss through the public createKeysService API in both document and hostBridge backends, without creating a runtime or firewall.
- Root cause is independent: action-ID-only registries replace another window's action, and unregister ignores the caller window. The initialization-counter change neither fixes nor worsens it.
- Checked NAP-KEYS PR #9 at cecb64257e0ac29926bb746832a477c553ab307c. Duplicate-action errors and per-napplet binding delivery are specified; action-ID uniqueness scope is implicit and requires an explicit implementation policy in a separate change. Draft status does not block implementation against that ref.
- Issue 267 remains out of this PR's implementation scope; user requested relationship assessment.

## Validation plan

- Prove same-ID replacement isolation, 21st-operation denial, repeated-message non-reset, and retained per-napplet rate limits.
- Verify shell trusted-source lifecycle integration and existing host consumer coverage.
- Run build, type-check, unit tests, relevant browser coverage, docs, lint and pinned AI-slop scan; commit and open PR.
