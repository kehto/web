---
quick_id: 260608-izc
slug: iterate-the-kehto-static-site-landing-pa
status: in-progress
created: 2026-06-08
---

# Quick Task 260608-izc: Iterate the Kehto static site landing page

## Goal

Respond to the latest visual feedback on the `/web/` landing page without changing the Pages route contract or adding dependencies.

## Plan

1. Refine hierarchy and copy
   - Files: `web/index.html`, `web/assets/landing.css`
   - Action: move the NIP-5D notice to the top, make it generic, and rewrite the hero support copy to be less technical.
   - Verify: portal still exposes the playground/docs links and the top notice is visible in browser proof.
   - Done: [x]

2. Improve typography, card rhythm, and chips
   - Files: `web/assets/landing.css`
   - Action: use a less awkward display font stack, reduce the oversized logo treatment, remove the bracket-like underline, and rebalance destination card/chip spacing.
   - Verify: screenshot review shows a styled page with less awkward logo/card spacing.
   - Done: [x]

3. Dampen liquid motion
   - Files: `web/assets/landing.js`, `tests/unit/playground-gateway-guard.test.ts`
   - Action: replace direct eased pointer tracking with lower-pressure inertial pointer state and update the guard expectations.
   - Verify: focused unit guard, Pages build/audit, and browser computed-style/screenshot checks pass.
   - Done: [x]
