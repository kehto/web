# Architecture Research - v1.17 Landing Page Branding

**Project:** Kehto Runtime - v1.17 Beautify the SPA Landing Page
**Researched:** 2026-06-06
**Scope:** Integration architecture for the static `/web/` portal.

---

## Recommended Architecture

Keep the portal static and make the brand/motion layer an enhancement.

```text
web/
  index.html
  assets/
    landing.css
    landing.js

scripts/build-pages.mjs
  copy web/index.html -> .pages/index.html
  copy web/assets/* -> .pages/assets/*
  copy node_modules/gsap/dist/gsap.min.js -> .pages/assets/vendor/gsap.min.js
```

The public page references:

- `/web/assets/landing.css`
- `/web/assets/vendor/gsap.min.js`
- `/web/assets/landing.js`

This keeps the first page simple, reviewable, and compatible with the current GitHub Pages route contract.

## DOM Structure

Recommended `web/index.html` structure:

- Fixed background canvas/SVG with `aria-hidden="true"` and `pointer-events: none`.
- Semantic `main` with brand/hero region.
- Kehto wordmark as visible text, not image-only.
- Alpha notice as readable body content.
- `nav` with the same two destination anchors.
- Footer with restrained reference-implementation language.

No card-in-card layout. Destination blocks can be framed, but they should read as route choices in the same spatial system as the hero.

## Motion System

`web/assets/landing.js` owns the progressive enhancement:

- Detect `window.gsap`; if absent, leave the static page intact.
- Detect reduced motion with `window.matchMedia('(prefers-reduced-motion: reduce)')`.
- Use `gsap.matchMedia()` to split desktop/mobile/reduced-motion behavior.
- Build one entrance timeline with shared defaults.
- Add destination click handlers that preserve normal modifier-key behavior and only intercept ordinary same-window clicks.
- Run a short exit timeline, then set `window.location.href`.
- Clean up listeners if matchMedia reverts.

Suggested timeline order:

1. Liquid background fades from static composition to slow motion.
2. Wordmark mask/reveal.
3. Hero summary and alpha notice lift/fade in.
4. Destination routes reveal with a small stagger.
5. Footer settles.

## Liquid Accent

Preferred: canvas 2D layer.

- Small set of points moving in a bounded field.
- Render soft fields/metaballs/noise in muted yellow/black with very low alpha.
- Clamp device pixel ratio to avoid expensive high-DPR canvases.
- Pause or static-render under reduced motion.
- Keep frame loop independent from layout; update only canvas pixels.

Alternative: SVG filter/gradient layer.

- Use GSAP to animate filter attributes or gradient positions slowly.
- Lower risk than canvas if visual verification shows canvas artifacts.

## Build and Audit Changes

`scripts/build-pages.mjs` should copy `web/assets` into `.pages/assets` and vendor GSAP from `node_modules`.

`scripts/audit-pages-artifact.mjs` should add focused checks:

- `.pages/assets/landing.css` exists.
- `.pages/assets/landing.js` exists.
- `.pages/assets/vendor/gsap.min.js` exists.
- `.pages/index.html` references the expected `/web/assets/...` paths.
- Existing `/web/playground/` and `/web/docs/` link checks remain.

Existing `tests/unit/playground-gateway-guard.test.ts` already validates Pages scripts and route constants. A new focused test can cover the portal asset contract if the audit script alone is not enough.

## Integration Boundaries

In scope:

- `web/index.html`
- `web/assets/*`
- `scripts/build-pages.mjs`
- `scripts/audit-pages-artifact.mjs`
- Focused tests for portal artifact contract
- Root package manifest/lockfile for GSAP

Out of scope:

- Playground application UI.
- VitePress docs theme.
- Runtime package APIs.
- Protocol, NUB, ACL, or gateway identity behavior.
- Public route changes.

## Suggested Build Order

1. Establish static brand system and semantic markup while preserving current links.
2. Add asset-copy and audit support for portal CSS/JS and vendored GSAP.
3. Add GSAP entrance/exit transitions with reduced-motion behavior.
4. Add liquid accent and visual QA across desktop/mobile/reduced-motion.
