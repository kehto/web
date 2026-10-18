---
status: complete
---
# Paja controller indicators

Connected native controllers now appear immediately to the right of the console arrow, with stable slot numbers, distinct colors, model tooltips and per-slot motion. The first four slots bounce, rock, pulse and nudge; timings vary per slot. Button, trigger and stick activity holds the highlight briefly for quick taps. Small stick drift is ignored. Reduced motion preserves a static highlight. Polling pauses while hidden and is disposed on pagehide. Host diagnostics work without napplet subscriptions.

Verified napplet/naps@19de5ce1cea40cd4c76089cdd8126e9f87648049, naps/NAP-GAMEPAD.md on merged master. Conformant host-only diagnostics; wire delivery, focus isolation, iframe Permissions-Policy and capability semantics are unchanged.

Validation:
- pnpm build: 32 tasks passed.
- pnpm type-check: 17 tasks passed.
- pnpm test:unit: 176 files, 2,233 tests passed.
- pnpm test:e2e --config .controller-playwright.config.ts: 132 tests passed. Temporary config retained normal test selection and browser settings, disabled server startup, and used separately started worktree IPv6 previews because unrelated local processes occupy IPv4 port 4173.
- Final controller-only Chromium rerun after motion refinement: 4 tests passed, including independent sparse slots, polling, brief taps, drift, triggers, focus/visibility, reduced motion, disconnect, disposal, unavailable and blocked access.
- pnpm docs:check: passed.
- aislop@0.12.0: passing 95/100. Five pre-existing file/function-size warnings remain in browser-host, browser-intent-builder, cvm-nostr-transport and intent-uri; no new findings and no configuration changes.
- Browser screenshot inspected with four controllers, one active.

Paja minor changeset included. Other checkout changes were preserved by working in ~/.worktrees/kehto/paja-controller-indicators from origin/main.
