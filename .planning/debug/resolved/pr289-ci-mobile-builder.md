---
status: resolved
trigger: "full CI-mode local E2E after the warm-selector repair fails the mobile builder test"
created: 2026-10-10
updated: 2026-10-10
---

## Current Focus

bug_class: heisenbug-mandelbug (one full-suite occurrence; focused CI repetitions did not reproduce it)
hypothesis: No confirmed root cause. The first mobile builder failure is not shown to be a deterministic menu activation, builder-layout, or target-versus-launcher selector defect.
test: Completed the prescribed focused CI-mode repetition and traced the Share-to-builder callback and temporary-launcher lifecycle.
expecting: No test-only correction is evidence-backed; preserve the test and let the parent rerun the full suite in its normal gate.
next_action: Session complete without a code or test change; the parent full-suite rerun passed all 120 tests with zero retries.

## Symptoms

expected: Full CI-mode E2E passes after the committed warm-selector correction 3fdb9edd.
actual: `paja-intent-links.spec.ts:39` fails while opening the mobile intent builder: the dialog is missing at `openIntentBuilder` line 436.
errors: Full CI-mode local run reported 119 passed and 1 failed. Error log: `/tmp/kehto-pr289-fix-e2e.log`; Playwright context: `test-results/paja-intent-links-Paja-int-dcec5-link-after-fresh-navigation-chromium/error-context.md`.
timeline: The failure appeared after the warm-handler strict-locator correction was committed; it is a different test path.
reproduction: Run only the first mobile builder test repeatedly with `CI=true`, one worker, and zero retries after identifying its exact title.

## Evidence

- timestamp: 2026-10-10; source: parent full CI-mode local E2E; result: 119 passed, 1 failed at `tests/e2e/paja-intent-links.spec.ts:39`, `openIntentBuilder` line 436 reports dialog missing.
- timestamp: 2026-10-10; source: git log; result: warm-selector repair is committed as `3fdb9edd` and must be preserved.
- timestamp: 2026-10-10; checked: error context and `openIntentBuilder` source; found: the failure is the 5s absence of the builder dialog immediately after the helper clicks the Share dialog's `Create intent link` button. The share implementation closes its dialog and synchronously calls `state.createIntentLink?.(tab)`; the builder implementation opens synchronously for a verified tab with advertised archetypes.
  implication: no evidence yet supports a NAP-INTENT lifecycle/layout defect; focused interaction reproduction is required before a test-only change.
- timestamp: 2026-10-10; checked: first test's iframe assertions; found: its only generic `frameLocator('iframe')` assertions occur after fresh-navigation launch and assert target delivery. They do not select the Share control or builder dialog at the observed failure point.
  implication: the committed warm-test target-versus-temporary-launcher selector defect is not yet demonstrated in this test.
- timestamp: 2026-10-10; checked: NAP authority and history; found: the authority is the pinned `NAP-INTENT` draft at `/tmp/kehto-pr289-NAP-INTENT.md` (SHA-256 `5a332e926726f3a34c65878bfc0e0c059a518828c9e38145abe244f9f592f017`). It permits target startup/delivery after accepted invocation, but does not prescribe host builder UI timing. MemPalace and `.planning/debug/knowledge-base.md` are unavailable.
  implication: the UI test must assert user-visible builder readiness without treating delivery timing as a builder-menu contract.
- timestamp: 2026-10-10; checked: SBFL applicability; found: no per-test coverage spectrum is available for this Playwright failure.
  implication: SBFL skipped; stability testing is the bug-class route.
- timestamp: 2026-10-10; checked: focused CI reproduction; found: `CI=true npx playwright test tests/e2e/paja-intent-links.spec.ts --grep "builds a link from a verified tab and delivers its copied JSON link after fresh navigation" --repeat-each=5 --retries=0 --workers=1` completed with 5/5 Chromium passes in 11.1s.
  implication: a deterministic failure in the first test's Share menu or builder layout is eliminated; do not mask the unreproduced full-suite event with retries, sleeps, or a longer timeout.
- timestamp: 2026-10-10; checked: complete Share-to-builder and launcher lifecycle; found: the Share control closes its dialog then synchronously invokes `state.createIntentLink(tab)`, and the builder calls `showModal()` synchronously for the already verified advertised tab. The transient launcher iframe is created only after a later Review dialog's explicit `Launch`, with teardown in its `finally` block.
  implication: the failure at `openIntentBuilder` precedes launcher creation. It cannot be the exact target-versus-temporary-launcher ambiguity fixed by `3fdb9edd`.
- timestamp: 2026-10-10; checked: selector comparison with `3fdb9edd`; found: the warm test had a pre-existing verified target frame and used a generic iframe selector during launch, which the commit scoped to the target frame. The first test's generic iframe selectors occur only after fresh-navigation launch, and all five focused runs delivered the expected payload through them.
  implication: no observed two-frame ambiguity warrants a speculative refactor of the first test's selectors.

## Eliminated

- No cause eliminated yet.
- hypothesis: The visible Share menu deterministically fails to activate its builder callback for the verified tab.
  evidence: Exact CI-mode one-worker reproduction passed five times, including the complete copied-link delivery and teardown flow.
  timestamp: 2026-10-10
- hypothesis: The first test's failure at the builder dialog is caused by the same target-versus-temporary-launcher iframe ambiguity as the warm test.
  evidence: The temporary launcher does not exist until the later Review Launch action; the reported failure happens before that action, and the focused run completed all later generic iframe assertions five times.
  timestamp: 2026-10-10

## Resolution

root_cause: No root cause confirmed. The isolated first mobile-builder test passed five CI-mode zero-retry repetitions; the one full-suite occurrence has no DOM/frame diagnostic that would distinguish a transient environment event from an unobserved product defect.
fix: No change applied. A timeout/retry/selector change would be speculative and could hide a product regression.
verification: `CI=true npx playwright test tests/e2e/paja-intent-links.spec.ts --grep "builds a link from a verified tab and delivers its copied JSON link after fresh navigation" --repeat-each=5 --retries=0 --workers=1` — 5 passed, 0 failed, 11.1s. The source trace also confirms the failure predates transient launcher creation.
authority: NAP-INTENT PR 106 at `fc121fc264615482143eda86125863d2e1f741a2`; conformant. It permits asynchronous target startup/delivery but does not prescribe host builder UI timing.
selector_assessment: The exact observed failure cannot be the warm test's two-frame target/temporary-launcher ambiguity. The first test's generic iframe delivery assertions run only after Review Launch; no ambiguity reproduced in five focused runs, so they were intentionally left unchanged.
full_suite: `CI=true pnpm test:e2e --workers=1 --retries=0` — 120 passed, 0 failed, 2.0m. No mobile-builder patch was needed for the passing rerun; the intermittent event's root cause remains unconfirmed.
files_changed: [.planning/debug/resolved/pr289-ci-mobile-builder.md]
