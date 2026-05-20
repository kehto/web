---
'@kehto/playground': patch
---

Add `tests/e2e/topology-lines.spec.ts` — Layer-B regression spec for BUG-02. Phase 42 / Plan 42-01.

BUG-01 (topology connector lines absent in `pnpm preview`) was fixed in commit `4f02c1e` by vendoring `leader-line.min.js` to `apps/playground/public/vendor/` and updating the script tag in `apps/playground/index.html`. This spec asserts the UMD remains loadable in the built preview and at least one `svg.leader-line` element renders, preventing silent regressions if the vendor file or script tag is touched again.

E2E baseline: 72 → 73.
