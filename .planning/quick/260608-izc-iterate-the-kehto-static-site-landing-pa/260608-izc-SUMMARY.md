---
status: complete
---

# Quick Task 260608-izc Summary

## Goal

Iterate the public `/web/` landing page from screenshot feedback: calmer liquid motion, less awkward logo typography, better destination card spacing, a top-level generic NIP-5D notice, and less technical hero copy.

## Result

- Added the `site:*` root command surface:
  - `site:dev` for HMR at `/web/`
  - `site:build` for docs, playground, and portal artifact generation
  - `site:preview` for build-plus-preview
  - `site:serve` for serving an existing `.pages` artifact
- Added `scripts/serve-pages.mjs` to preview `.pages` under the same `/web/` route shape used by GitHub Pages.
- Converted portal asset and nav URLs to route-relative paths, fixing the Vite dev doubled-prefix CSS issue while preserving the public `/web/` route contract.
- Moved the NIP-5D notice to the top and changed it to: "NIP-5D is under development and may be subject to change."
- Rewrote the hero summary to be less technical and more user-facing.
- Adjusted the Kehto wordmark font stack, scale, underline treatment, and spacing.
- Rebalanced destination cards and proof chips to reduce awkward vertical padding.
- Replaced direct eased pointer tracking in the liquid field with lower-pressure inertial pointer state and softer node response.

## Simplifications

- Kept the implementation dependency-free.
- Kept the public route contract unchanged: `/web/`, `/web/playground/`, and `/web/docs/`.
- Reused the existing Pages build/audit path instead of adding a separate app framework for the static portal.

## Verification

- `node --check scripts/serve-pages.mjs` passed.
- `node --check scripts/audit-pages-artifact.mjs` passed.
- `node --check web/assets/landing.js` passed.
- `pnpm test:unit tests/unit/playground-gateway-guard.test.ts` passed: 5 tests.
- `pnpm test:unit` passed: 35 files, 570 tests.
- `pnpm type-check` passed.
- `pnpm lint` completed; Turbo reported no package lint tasks.
- `pnpm site:build && pnpm audit:pages` passed.
- `pnpm build` passed: 27 successful tasks.
- `npx --yes aislop scan -d` passed with `100 / 100 Healthy`, no issues.
- `git diff --check` passed.
- Playwright confirmed the live dev page at `http://127.0.0.1:5175/web/` loaded one stylesheet, rendered the top notice, used the updated wordmark stack, and produced a styled screenshot.

## Implementation Commits

- `0a97b90` - Refine the static site iteration loop

## Remaining Risks

- The liquid motion was verified visually through screenshot and code-level damping, but final mouse-feel judgment still depends on manual interaction on the target display.
