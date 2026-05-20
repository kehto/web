---
'@kehto/playground': patch
---

Fix stale port label `:5174` → `:4174` in `apps/playground/napplets/resource-demo/index.html:61` h2 (POLISH-01). The actual `GRANTED_URL` constant in the same file correctly points at `:4174` (the playground preview port); only the visible h2 label was stale. Cosmetic only; no behavioral change.
