---
'@kehto/paja': minor
---

Add a collapsible Paja development console. The left development column starts
expanded and collapses to the left through one chevron button in the top bar;
the same button restores it, and the choice is remembered per browser origin.
Collapsing is CSS-only presentation, so the target iframe keeps its identity and
the running napplet keeps its shell state while the stage reclaims the full
width.
