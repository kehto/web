---
status: resolved
trigger: "GHP workflow failed https://github.com/kehto/web/actions/runs/38101845765"
created: 2026-10-10
updated: 2026-10-10
---

## Current Focus

hypothesis: Confirmed stale audit assertion; the loader correctly calls prepareNappletSrcdoc instead of injectCspMeta.
next_action: Push the verified Pages audit correction and open a PR; monitor its CI. Pages deployment follows merge.

## Symptoms

expected: Main Pages workflow builds, audits, and deploys the web artifact.
actual: Run 38101845765 at b4627875c7fc758fae8f983eab5cde505c709d9f failed its gateway audit after build, type-check, and docs passed.
error: playground-frame-loader.ts does not inject verified bytes via iframe.srcdoc
reproduction: pnpm build followed by pnpm audit:gateway-artifacts

## Evidence

- Primary checkout has unrelated package.json workspace edits; preserved. A clean fix/pages-gateway-audit worktree branches from origin/main at the failed SHA.
- Failed audit requires both the literal iframe.srcdoc assignment and injectCspMeta call in the loader.
- Code graph traced loadPlaygroundNapplet to prepareNappletSrcdoc. The loader passes resolved.indexHtml; the helper renders CSP and inserts it plus the namespace prelude before authored content.
- Protocol check before edits: NIP-5D PR 2303 at 020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7, Identity and Security, requires verified srcdoc, opaque sandbox, and runtime/CSP injection outside hashed bytes. Checked NAP-SHELL master e5308ac92cfd49e4fb026812c60886571515e219 and Kehto's documented legacy pin 5ac0490461ca6fec2f0d2e45b4835cf9bc08de24; handshake policy remains unchanged by this audit repair. Loading/CSP guard is conformant; optional-shell upstream drift is outside this fix.
- Reproduction: Pages-base build passed, then the real artifact audit failed with the same CI error. New executable regression also failed on the valid current loader before the patch (1 failed, 4 rejection cases passed).

## Resolution

root_cause: The executable Pages audit retained an obsolete injectCspMeta literal after loader CSP ownership moved to the shared srcdoc preparation helper.
fix: Check the verified loader-to-helper assignment and helper CSP/namespace insertion together; preserve identity, sandbox, gateway, and artifact guards.
verification: Build, type-check, 2,090 unit tests, docs check, gateway audit (15 built napplets), Pages packing, and Pages audit passed with the workflow's base paths. AI-slop passed at 95/100 with zero errors and the same five pre-existing size warnings. Executable regression tests passed all five cases; the adjacent gateway suite also passed (24 tests total).
browser_limitation: Local zero-retry browser runs hit the pre-existing Share dialog timeout (119/120, then 118/120). The exact saved-handler test passed five focused repetitions, but a later traced 30-case repetition reproduced eight failures before Create intent link opened. Main CI at this same source baseline b4627875 passed all jobs (run 38101845735). No browser implementation or test was changed for this Pages repair. Follow-up evidence is preserved in ../paja-share-dialog-click.md.
