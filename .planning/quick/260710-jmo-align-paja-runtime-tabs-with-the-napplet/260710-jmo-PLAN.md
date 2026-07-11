---
quick_id: 260710-jmo
slug: align-paja-runtime-tabs-with-the-napplet
status: complete
created: 2026-07-10
completed: 2026-07-10
---

# Quick Task 260710-jmo: Align Paja Runtime Tabs With the Napplet Frame Body Edge

## Scope

The first runtime tab in static Paja pointer mode should align with the left edge
of the napplet frame/body, so the tab reads visually as attached to the hosted
napplet frame instead of floating in the top bar after the target label.

## Plan

1. Adjust Paja host-page layout so runtime tabs occupy the stage column and align
   to the same left boundary as the iframe/body.
2. Keep existing pointer controls, theme/reload controls, and tab behavior intact.
3. Verify with focused unit/e2e coverage and a DOM/screenshot alignment check.
