---
status: resolved
trigger: "ci on https://github.com/kehto/web/pull/289 is failing"
created: 2026-10-10
updated: 2026-10-10
---

## Current Focus

hypothesis: Confirmed — the generic iframe selector matched the target and a valid temporary launcher.
test: Focused CI-mode test passed five zero-retry repetitions; diff inspection was clean.
expecting: The handler-scoped locator reads only the verified warm-target tab during the temporary launcher lifecycle.
next_action: Parent owns broader CI and remote verification.
bug_class: Bohrbug (the CI strict-locator violation reproduced deterministically on all three attempts)
reasoning_checkpoint:
  hypothesis: "The test fails because its page-wide iframe locator matches both the verified target tab and the protocol-valid transient launcher while the launch is in progress."
  confirming_evidence:
    - "CI run 38049803254 reported the exact generic locator resolving to the tab-panel iframe titled 'Napplet runtime target: warm-target' and a separate hidden aria-hidden launcher on all three attempts."
    - "The test's two failing assertions use page.frameLocator('iframe'), while its target is named 'warm-target' and other test cases scope frame locators by title."
    - "Pinned NAP-INTENT PR 106 fc121fc264615482143eda86125863d2e1f741a2 permits accepted delivery before startup and requires delivery retention through target handler registration."
  falsification_test: "If the title-and-tab-panel locator is also strict-ambiguous or cannot observe counts 1 then 2 across five CI-mode repetitions, this selector explanation is false."
  fix_rationale: "Selecting the verified target tab removes only the test's accidental inclusion of the transient launcher; it preserves assertions for target reuse, payload, exactly-once delivery, single target tab, and launcher teardown."
  blind_spots: "The focused local run cannot prove the hosted CI browser image itself, but it uses CI=true, zero retries, one worker, and bounded repetition."
  candidate_causes:
    - "code: the warm test uses an unqualified iframe locator for target-frame assertions."
    - "environment/lifecycle: CI's deterministic launcher lifetime overlaps those assertions; it exposes the selector bug but does not violate the protocol."
  and_gate: "yes: the failure requires the generic selector plus a valid launcher overlap; correcting the selector directly handles this interaction without changing runtime behavior."

## Symptoms

expected: PR 289 CI succeeds with the verified intent-link browser flows.
actual: Playwright fails one test in every attempt; 119 other browser tests, Build & Type-Check, Vitest and scope/changeset guards pass.
errors: strict mode violation at paja-intent-links.spec.ts:132; frameLocator('iframe') resolves to the warm-target tab plus the hidden launcher.
timeline: First completed PR CI on head 799a052212d0f0ccde0fb156a8f8c6b152d47e10; local full runs passed with different launcher timing.
reproduction: CI run 38049803254, job 114206813504; warm reuse test line 112, initial and two retry attempts.

## Evidence

- CI log: /tmp/kehto-pr289-ci-failed.log. Actual matched frames are iframe.tab-panel title "Napplet runtime target: warm-target" and iframe[hidden][aria-hidden=true] signed launcher.
- Local and origin feature heads agree at 799a0522; feature worktree is clean before this debug record. Primary main checkout has unrelated package.json edits and is preserved.
- NAP-INTENT working authority is PR 106 fc121fc264615482143eda86125863d2e1f741a2, remote head rechecked unchanged. Full pinned text fetched to /tmp/kehto-pr289-NAP-INTENT.md for the protocol/lifecycle comparison before editing tests.
- Protocol comparison: NAP-INTENT permits `intent.invoke.result` after the runtime accepts responsibility before target startup, permits delivery to an existing or newly-started target, and requires the target binding to retain a delivery until `onDelivery` registers. A hidden signed launcher during the warm-target assertion is therefore conformant and must not be suppressed by a product change.
- Codebase graph check: project `kehto-paja-intent-links` returned no node for the new E2E spec’s warm-target query, consistent with the known stale graph; text search is the permitted fallback for this unindexed test.
- CI trace confirmation: all three failed attempts resolved the generic locator to the target `iframe.tab-panel[title="Napplet runtime target: warm-target"]` and one hidden `aria-hidden` launcher; the target had delivery count `0` before strict-mode rejected the two-frame locator.
- Focused validation: `CI=true pnpm exec playwright test tests/e2e/paja-intent-links.spec.ts --grep 'reuses a warm verified handler without replaying or opening a second target tab' --repeat-each=5 --retries=0 --workers=1` exited 0; all 5 Chromium repetitions passed in 10.0s, with no retries.
- Diff inspection: `git diff --check` passed. The only test change adds the exact warm-target `iframe.tab-panel` locator and routes the two target-content assertions through it; the one-iframe teardown, status, payload, and exactly-two delivery assertions remain.

## Eliminated

- Build/type or Vitest failure: these jobs are green on the failed CI SHA.

## Resolution

root_cause: The warm-reuse E2E test asserted inside a generic `iframe` locator while the conformant transient signed launcher was mounted, so Playwright strict mode rejected the two-frame match before it could observe delivery.
fix: Scoped the warm-handler delivery count and payload assertions to `iframe.tab-panel[title="Napplet runtime target: warm-target"]`; launcher teardown, single-iframe, payload, and exactly-once assertions remain intact.
verification:
  target_test:
    result: pass
    command: "CI=true pnpm exec playwright test tests/e2e/paja-intent-links.spec.ts --grep 'reuses a warm verified handler without replaying or opening a second target tab' --repeat-each=5 --retries=0 --workers=1"
    result_detail: "5/5 Chromium repetitions passed in 10.0s with zero retries."
  mutation_check:
    result: skipped
    reason_if_skipped: "Task scope limited validation to the focused Playwright repetition; parent owns broader gates."
  no_op_deletion:
    result: pass
    deletion_justified_by_rca: false
    result_detail: "git diff --check passed; the diff adds a verified target selector and preserves all existing lifecycle assertions."
  adjacent_tests:
    result: skipped
    reason_if_skipped: "Task scope directed the exact focused test only; parent owns broader gates."
  revert_and_reconfirm:
    result: skipped
    reason_if_skipped: "Task scope prohibited further test runs after the focused five-repetition validation."
  guardrail_verdict: focused_validation_accepted_by_parent_scope
  protocol_authority: "NAP-INTENT PR 106 at fc121fc264615482143eda86125863d2e1f741a2; conformant lifecycle, no protocol change."
files_changed:
  - tests/e2e/paja-intent-links.spec.ts
  - .planning/debug/resolved/pr289-ci-warm-iframe.md
