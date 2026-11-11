---
status: resolved
trigger: "Recent releases leave every napplet blank and Paja frozen; the same napplets work in other shells."
created: 2026-11-11
updated: 2026-11-11
---

# Paja hidden Firewall approval

## Current Focus

hypothesis: Confirmed. The new shared Firewall modal lives inside collapsible developer controls. A hidden modal still makes the page inert, while admission waits and the iframe stays blank.
next_action: Review and merge the verified fix PR, then release/deploy through the normal workflows.

## Evidence

- Investigated current main 22ce32cd in an isolated worktree; unrelated primary-checkout state was preserved.
- Hosted Paja reaches ready with a fresh browser, but pre-execution approval leaves an empty iframe until consent.
- Chromium: with either html[data-paja-console=collapsed] or the Firewall details closed, the approval dialog is open but invisible (no bounding box). The page is modal and blocked.
- Shared Firewall integration landed in 249fe8cb (#336), 2026-11-10, released in Paja 0.33.0; it mounted the prompt inside the collapsible Firewall management section.
- The generic E2E approval driver uses DOM .click() even for hidden prompts, masking this failure.
- Current npm Paja 0.34.0 installs with its published dependency graph. The latest Release failure concerns unrelated @kehto/mocks publication.

## Protocol Authority

Checked napplet/naps master 43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab, projections/web.md and naps/NAP-SHELL.md. The shell owns per-napplet policy and injects granted domains before execution. This fix changes host presentation only; admission, identity, wire messages and grants remain unchanged. The presentation fix conforms to the checked contracts; it does not assess unrelated NAP implementation behavior.
Also checked normative NIP-5D PR #2303, dskvr/nips nip/5d at c041f84667c1781c3c1d5bfbd970943131b38cc9: required/optional declarations remain policy inputs, verified bytes still use sandboxed srcdoc, and this change grants no new authority.

## Verification Plan

- Browser regression must use visible user interactions, never the automatic approval driver.
- Both collapsed console and collapsed Firewall section: prompt visible, lifetime required, allow proceeds, optional denial still removes the domain.
- Verified pointer and local-file loading must execute after visible consent.
- Shared UI unit tests cover separate mount and teardown, preserving default embedding.
- Build, type-check, unit, docs, lint, relevant Playwright, AI-slop and diff checks before commit and PR.

## Resolution

The shared browser approval UI accepts an optional `promptMount`; Paja uses the host document body while retaining grant management in the sidebar. Both owned roots are removed on teardown, and pending prompts still cancel. Default embedding stays unchanged.

The unit regression failed before the change and passes afterward. Both collapsed-preference browser regressions failed on invisible dialogs before the change and pass with actual visible user interactions afterward. The automatic approval driver is deliberately absent from these scenarios.

Verification: build 17/17, type-check 18/18, unit 3,371/3,371, strict docs, and Playwright 126 passed with one existing explicit identity.changed skip. `pnpm lint` has no configured package tasks; the AI-slop scan's lint engine reports no issues, and the overall score is 100/100 (one existing browser-llm-panel length warning). `git diff --check` passes. Independent review found no blockers.

Real Chromium proof used the hosted Paja page with only the browser-host bundle replaced by the locally built fix. With both console and Firewall section collapsed, visible approval clicks launched the live signed `good-morning` pointer to its anonymous-account UI and a local HTML file to its executed-script output; both reached ready/initSent with zero page errors. The production deployment itself was not modified.
