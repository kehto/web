---
status: investigating
trigger: "Intermittent local browser failures observed while validating the Pages audit repair"
created: 2026-10-10
updated: 2026-10-10
---

## Current Focus

hypothesis: Undetermined. Playwright reports a click on the Share dialog's Create intent link button, but the Share dialog remains open.
next_action: Capture pointer and focus events during a failing interaction before choosing a UI or test correction. This is outside the Pages audit repair.

## Evidence

- No browser source or E2E test changed in fix/pages-gateway-audit.
- Full zero-retry suite: one failure (saved-handler test), then two failures (copied-link and warm-handler tests). Each failed waiting for the builder dialog after openIntentBuilder clicked Create intent link.
- Saved-handler focused repetition: 5/5 passed in 12.9s, one worker, zero retries.
- Traced repetition of the three tests: 22 passed and 8 failed, 1.3m, one worker, zero retries. Command: CI=true pnpm exec playwright test tests/e2e/paja-intent-links.spec.ts --grep 'builds a link from a verified tab|reuses a warm verified handler|hydrates saved handler facts' --repeat-each=10 --retries=0 --workers=1 --trace=on.
- Log: /tmp/kehto-pages-intent-trace.log. Failed saved-handler trace under test-results/paja-intent-links-Paja-int-7a397-fault-beat-a-recommendation-chromium/trace.zip.
- Trace call@266 resolves the correct button, reports visible/enabled/stable, sends pointer input at x798.9/y378.18, and reports click action done. The after-click screenshot still shows Share, not the builder. No page exception appears; only an unrelated favicon 404 is logged. Launcher creation has not begun.
- Main CI run 38101845735 passed on b4627875c7fc758fae8f983eab5cde505c709d9f, the baseline of this repair. Prior investigation pr289-ci-mobile-builder.md also recorded an unconfirmed Share-to-builder timeout.
- NAP-INTENT PR106 fc121fc264615482143eda86125863d2e1f741a2 is the feature's working contract; host Share dialog timing is outside its wire protocol. No protocol behavior changed here.

## Resolution

No speculative timeout, retry, or selector patch applied. Preserve the trace evidence for a separate Share interaction investigation.
