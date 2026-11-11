---
quick_id: 261111-adq
status: complete
issue: kehto/web#418
---

# Summary

- Host graph on @napplet/core 0.41.0 / @napplet/nap 0.40.0 (napplet/web#329, released by #330).
- `packages/services/src/intent-types.ts` re-exports core's intent types; the local contract is gone.
  Core's types are mutable, so three frozen values gained type assertions (runtime freeze kept).
- services/paja/cli core peer floor raised to 0.41.0 (minor changeset); other packages widen upper bounds (patch).
- Shell intent receiver drops empty senders, matching nap 0.40's binding; regressions for empty/null sender and ID stripping.
- KEHTO_INTENT_TYPES_UPSTREAM_DRIFT marked retired in docs/compatibility.md; policy text and guards updated.
- Gates: build, type-check, test:unit (265 files / 3370 tests), docs:check, aislop 100/100, test:e2e 124 passed / 1 skipped.
- Spec: napplet/naps PR #128 @ 74f9bf85, PR #106 @ fc121fc2 — conformant.
