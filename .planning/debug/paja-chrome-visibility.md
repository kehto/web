---
status: verifying
trigger: "Paja chrome appears briefly then disappears, leaving only the empty-runtime message"
created: 2026-10-20
updated: 2026-10-20
---

## Symptoms

Expected: Paja's load controls and console toggle remain reachable after startup.
Actual: the deployed /web/paja/ restores a collapsed preference and hides its whole toolbar.
Reproduction: save kehto:paja:console:v1=collapsed, reload at a desktop viewport, move the pointer into the stage.

## Evidence

- Reproduced on live Pages in Chromium at 2520x1470. Toolbar y=-32; expand button y=-25.5/bottom=-1.5, parent opacity=0. Only the empty-runtime message remains.
- Fresh storage starts expanded. JavaScript restores the saved preference after the initially expanded HTML paints, explaining the flash.
- Desktop hover CSS translates the entire toolbar offscreen and disables its children. Keyboard focus/Playwright clicks reveal it, masking the problem in existing tests.
- Package docs promise the toggle stays visible in both states. Restore that contract while keeping console preference, full-width stage, iframe identity, and source lifecycle unchanged.
- This is host presentation only; no NAP message, injection, loader, permissions, or sandbox behavior changes. GSD debug runs inline; symptoms are supplied by the report and deployed reproduction.
- Primary checkout's package.json WIP and other worktrees remain untouched. Branch cut from current origin/main 4a322412.
- New saved-preference browser regression failed before the fix at 1280px and 2520px (viewport intersection ratio 0); the narrow 640px case passed.
- Removed only the desktop toolbar translation/opacity rules and unused reveal variable. Retained stored collapse semantics, console/footer hiding, and the 38px toolbar row.
- Focused browser verification passed 5/5: saved-preference recovery at 640/1280/2520px and live-target collapse/restore at desktop/mobile widths, including preserved iframe load ID/generation.
- Unit suite passed 177 files / 2,250 tests.

## Current Focus

hypothesis: Desktop auto-hide CSS conceals the recovery control after restoring the stored collapsed preference.
next_action: Complete full gates and Firefox visual verification, then push and open the fix PR.

## Resolution

Pending.
