---
status: resolved
trigger: "CI is red in https://github.com/kehto/web/pull/336"
created: 2026-10-19
updated: 2026-10-19
---

# PR 336 browser isolation timeout

## Symptoms

- Expected: PR CI passes and verified playground frames cannot contact direct network destinations.
- Actual: CI run 39079830632 passed build/type/docs/unit checks; Playwright passed 132 tests and timed out after 90 seconds on all three isolation-test attempts.
- Reproduction: run tests/e2e/playground-firewall-approvals.spec.ts with Chromium.
- Existing worktree is the pushed PR head bbb559c4. Its unrelated WINDOWS.md edit remains unstaged; primary checkout rebrand work is untouched.

## Current Focus

hypothesis: Chromium speculative sockets prevent Node 20 HTTP fixture shutdown after all assertions succeed.
next_action: Push the verified fix to PR 336 and confirm GitHub CI.

## Evidence

- CI timeout has no locator assertion failure; inspect evaluate and final server.close waits.
- Protocol checked before edits: NIP-5D draft 5560820fa4f37f45b8ab742a11aeb3001b17dc67, 5D.md; NAP-RESOURCE draft ae5b9c64ab8a4d8909f288829a01e99d6bd713bc, naps/NAP-RESOURCE.md. Direct-network denial is required for resource exposure; sandbox opacity alone is insufficient. Keep browser isolation assertions conformant.
- GSD debug runs inline under its Codex spawn restriction; symptoms obtained from CI logs without redundant user questions.
- Node 26 passed eight untraced repeats; tracing reproduced a teardown timeout.
- Node 20.20.2 (the CI version) reproduced the hang without tracing. DEBUG=pw:api showed browser evaluation and the final wait completed; no context-close operation began. lsof showed the test worker retaining an established socket to Chromium at its ephemeral destination port after the HTTP listener closed, with no request recorded.

## Resolution

Root cause: server.close waits for Chromium's speculative TCP connection even though CSP blocks all HTTP requests.

Fix: after stopping the fixture listener, explicitly close its connections with closeAllConnections. Keep direct-network assertions and CSP policy unchanged. This is test-only output; no package changeset is required.

Verification: Node 20.20.2 focused suite with tracing and three repeats passed 9/9; full pnpm test:e2e under Node 20.20.2 passed 133/133 in 2.5 minutes, harness port 43373. Build, type-check, unit suite (207 files / 2,625 tests), docs:check, diff check, and pinned aislop 0.12.0 scan all passed; quality 100/100. Fix committed as d2a86fe1. Both upstream draft heads rechecked unchanged on 2026-10-19. Result remains conformant to the checked refs; no new spec gap or protocol behavior change.
