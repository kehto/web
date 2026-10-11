---
status: verifying
trigger: "GHP workflow failed https://github.com/kehto/web/actions/runs/38101845765"
created: 2026-10-10
updated: 2026-10-10
---

## Current Focus

hypothesis: Confirmed stale audit assertion; the loader correctly calls prepareNappletSrcdoc instead of injectCspMeta.
next_action: Run the corrected executable audit and regression tests, then validate the complete Pages artifact and required checks.

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
verification: Pending full gates.
