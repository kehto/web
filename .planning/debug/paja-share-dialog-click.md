---
status: investigating
trigger: "Intermittent local browser failures observed while validating the Pages audit repair"
created: 2026-10-10
updated: 2026-10-20
---

## Current Focus

hypothesis: Confirmed native top-layer Share dialog input can be routed to the opaque iframe underneath it; pointer events never reach the host handler.
next_action: Complete the final full browser gates for the host-overlay replacement tracked in paja-share-button.md.

## Evidence

- No browser source or E2E test changed in fix/pages-gateway-audit.
- Full zero-retry suite: one failure (saved-handler test), then two failures (copied-link and warm-handler tests). Each failed waiting for the builder dialog after openIntentBuilder clicked Create intent link.
- Saved-handler focused repetition: 5/5 passed in 12.9s, one worker, zero retries.
- Traced repetition of the three tests: 22 passed and 8 failed, 1.3m, one worker, zero retries. Command: CI=true pnpm exec playwright test tests/e2e/paja-intent-links.spec.ts --grep 'builds a link from a verified tab|reuses a warm verified handler|hydrates saved handler facts' --repeat-each=10 --retries=0 --workers=1 --trace=on.
- Log: /tmp/kehto-pages-intent-trace.log. Failed saved-handler trace under test-results/paja-intent-links-Paja-int-7a397-fault-beat-a-recommendation-chromium/trace.zip.
- Trace call@266 resolves the correct button, reports visible/enabled/stable, sends pointer input at x798.9/y378.18, and reports click action done. The after-click screenshot still shows Share, not the builder. No page exception appears; only an unrelated favicon 404 is logged. Launcher creation has not begun.
- Main CI run 38101845735 passed on b4627875c7fc758fae8f983eab5cde505c709d9f, the baseline of this repair. Prior investigation pr289-ci-mobile-builder.md also recorded an unconfirmed Share-to-builder timeout.
- NAP-INTENT PR106 fc121fc264615482143eda86125863d2e1f741a2 is the feature's working contract; host Share dialog timing is outside its wire protocol. No protocol behavior changed here.
- 2026-10-20 Share app-link regression investigation captured trusted pointerdown, pointerup and click events inside the sandboxed iframe when Playwright clicked the visible native Share dialog's Copy button. The parent received focusout and refocused Copy, but received no pointer events. No copy handler executed. Local browser: Chrome 155.0.8059.85, Playwright 1.59.1.
- Untraced local Chrome repetitions: 22/30 passed. Native autofocus, iframe pointer-events suppression, dialog compositor promotion and iframe visibility suppression each retained failures; all experimental source/test changes were removed. Logs: /tmp/kehto-paja-share-clicks-untraced.log, /tmp/kehto-paja-share-autofocus.log, /tmp/kehto-paja-share-hit.log, /tmp/kehto-paja-share-layer.log, /tmp/kehto-paja-share-hidden.log.
- The same 20 app-link repetitions passed with Playwright's matching Chromium 147.0.7727.15, with no injected CSS or click retries. Firefox's six app-link cases also passed. This narrows the failure to browser/input routing; it does not establish an upstream root cause or resolve this session.
- The subsequent Chromium 147 full run missed two Copy clicks. Explicit iframe inertness, first-paint gating and iframe display suppression also retained failures in Chrome 155, so none was retained.
- Replacing only Share with the existing host overlay passed 55/55 repeated clipboard/manifest cases in Chrome 155. Real frame click counters stayed at zero during Share and incremented after closing it. The overlay keeps background siblings inert, wraps keyboard focus, and restores prior inert state on close. No app reload, sleep, retries or forced clicks are involved.

## Resolution

No speculative timeout, retry, or selector patch applied. Preserve the trace evidence for a separate Share interaction investigation.
