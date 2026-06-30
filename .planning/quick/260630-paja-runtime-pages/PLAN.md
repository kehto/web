---
status: complete
date: 2026-06-30
---

# Paja Runtime Pages Build

Goal: add non-dev Paja browser runtime support for testing napplets by `naddr` or `nevent` pointer with no HMR, deploy it with GitHub Pages, and link it from the SPA.

## Plan

1. Reuse existing Paja host/runtime code where possible.
2. Add runtime build flags and browser UI for `naddr`/`nevent` input.
3. Keep existing dev CLI behavior covered by regression tests.
4. Add tests for the new runtime pointer mode.
5. Update Pages deployment to publish Paja Runtime with docs/playground.
6. Update the SPA with a Paja Runtime link.
7. Verify locally, push, and open a PR.
