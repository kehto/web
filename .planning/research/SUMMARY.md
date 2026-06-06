# Project Research Summary

**Project:** Kehto Runtime - v1.17 Beautify the SPA Landing Page
**Domain:** Static landing-page branding, GSAP motion, and GitHub Pages delivery
**Researched:** 2026-06-06
**Confidence:** High

---

## Executive Summary

v1.17 should keep the public `/web/` portal static, preserve the existing playground/docs destinations, and add brand/motion as progressive enhancement. The best implementation shape is a semantic `web/index.html`, separate `web/assets/landing.css` and `web/assets/landing.js`, a locally vendored GSAP core script copied from npm during `build:pages`, and an extended Pages audit that verifies the new asset contract.

GSAP 3.15.0 is current on npm as of 2026-06-06. Official docs position GSAP as framework-agnostic JavaScript loadable through npm or script tags, with timelines/defaults for coherent choreography and `gsap.matchMedia()` for responsive and reduced-motion animation setup. Core GSAP is enough for this milestone; plugins, frameworks, and full fluid-simulation dependencies are unnecessary.

The biggest product risk is taste, not technical feasibility. The page must feel dark, smooth, modern, and Kehto-specific without sliding into neon, generic liquid blobs, Nordic cliches, or overstated ecosystem claims. The design should use Kehto's actual value as the UX anchor: a shell-side cradle for sandboxed napplets, with the playground and docs as the two proof paths.

## Stack Additions

- Add `gsap` explicitly for the requested motion work.
- Vendor `gsap.min.js` into the Pages artifact instead of relying on a CDN.
- Add static portal CSS/JS under `web/assets`.
- Extend `build:pages` and `audit:pages` for these assets.

## Feature Table Stakes

- Preserve `/web/playground/` and `/web/docs/` as the primary routes.
- Keep alpha/reference-implementation caveats visible.
- Establish an almost-black plus muted-yellow visual identity.
- Add a readable custom Kehto wordmark/text treatment.
- Add a low-contrast liquid background accent behind content.
- Use GSAP entrance, exit, hover/focus, and background transitions.
- Respect reduced motion and no-JS fallback.

## Differentiators

- Express "Kehto" as a cradle-like runtime surface through shape and motion, not literal illustration.
- Let route choices map to real user jobs: inspect the playground or integrate via docs.
- Use subtle interactive pressure/motion in the liquid accent, if it remains performant and tasteful.
- Add static audit coverage so public portal branding cannot silently lose assets.

## Watch Outs

- Do not change public routes.
- Do not over-animate or delay navigation heavily.
- Do not add WebGL/fluid libraries unless scope changes.
- Do not use generic Nordic tropes, baby/cradle imagery, neon, or decorative blobs.
- Do not hide the alpha notice behind visual polish.
- Do not leave GSAP as a third-party runtime CDN dependency.

## Recommended Phase Shape

1. Brand foundation and static asset pipeline.
2. GSAP transition system and reduced-motion behavior.
3. Liquid accent, visual polish, and full Pages verification.

## Sources

- GSAP Installation: https://gsap.com/docs/v3/Installation/
- GSAP Core: https://gsap.com/docs/v3/GSAP/
- GSAP Timeline: https://gsap.com/docs/v3/GSAP/Timeline/
- GSAP matchMedia: https://gsap.com/docs/v3/GSAP/gsap.matchMedia%28%29/
- npm registry query: `npm view gsap version license dist.unpackedSize --json`
- Local portal/build/audit files: `web/index.html`, `scripts/build-pages.mjs`, `scripts/audit-pages-artifact.mjs`
