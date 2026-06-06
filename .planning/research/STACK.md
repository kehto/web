# Technology Stack - v1.17 Landing Page Branding

**Project:** Kehto Runtime - v1.17 Beautify the SPA Landing Page
**Researched:** 2026-06-06
**Scope:** Stack additions and delivery constraints for the public `/web/` portal only. Runtime packages, playground internals, docs content, and protocol behavior are not part of this milestone.

---

## 1. Current Portal Baseline

The landing page is a static HTML portal at `web/index.html`. `scripts/build-pages.mjs` copies that file to `.pages/index.html`, then adds the playground and docs roots beside it. `scripts/audit-pages-artifact.mjs` currently verifies that the built portal contains links to `/web/playground/` and `/web/docs/`.

Implications:

- The portal has no existing bundler entrypoint.
- Any new CSS, JS, font, or media asset needs an explicit static asset copy path in `scripts/build-pages.mjs`.
- Public asset paths must resolve under the GitHub Pages project base `/web/`.
- The page must remain useful without JavaScript because it is the top-level route to the playground and docs.

## 2. GSAP Status

Official GSAP docs describe GSAP as framework-agnostic JavaScript that can be loaded through npm, yarn, or a simple script tag. The docs also state that GSAP and its plugins are available on npm as of GSAP 3.13+.

`npm view gsap version license dist.unpackedSize --json` on 2026-06-06 reports:

```json
{
  "version": "3.15.0",
  "license": "Standard 'no charge' license: https://gsap.com/standard-license.",
  "dist.unpackedSize": 6258071
}
```

Recommended use for this repo:

- Add `gsap` as an explicit root package dependency for this user-requested milestone.
- Keep implementation to GSAP core unless a phase proves a plugin is needed.
- Copy `node_modules/gsap/dist/gsap.min.js` into the Pages artifact during `build:pages` so the public portal does not depend on a CDN at runtime.
- Load a local versioned GSAP script before the portal animation script.

Rejected stack paths:

- CDN-only GSAP: simpler, but makes the portal's first impression depend on a third-party request.
- Adding a web framework or full portal bundler: unnecessary for one static page and contrary to Kehto's small static Pages artifact.
- Adding a full fluid-simulation library: too much weight for a low-contrast background accent.

## 3. GSAP Motion Primitives

Use GSAP timelines for page-level choreography. Official docs show timeline defaults cascading duration/ease into child tweens, which fits a restrained system where entrance, card reveal, liquid accent, and exit transitions share one motion language.

Use `gsap.matchMedia()` for responsive and reduced-motion behavior. Official docs describe it as a media-query wrapper that automatically reverts animations when conditions stop matching and explicitly call out `prefers-reduced-motion` support.

Recommended motion constraints:

- One master entrance timeline with shared defaults.
- One short exit timeline for `/web/playground/` and `/web/docs/` clicks before navigation.
- Reduced-motion mode must skip choreography, render final states immediately, and either freeze or greatly simplify the liquid accent.
- Use transform/opacity/filter-friendly properties for DOM animation; avoid layout-thrashing dimensions.

## 4. Liquid Accent Strategy

The requested "subtle but complex liquid simulation" should be implemented as a lightweight page accent, not a full physics feature.

Preferred implementation:

- A fixed background `<canvas>` or SVG layer behind content.
- Low-contrast muted-yellow and near-black values with alpha below the content layer.
- A small particle/metaball/noise field animated by `requestAnimationFrame` or `gsap.ticker`.
- Pointer influence can be minimal and optional; the page should still feel alive without interaction.
- Reduced-motion mode renders a static composition.

Fallback implementation if canvas cost or verification is poor:

- Layered CSS/SVG radial gradients and filter turbulence animated slowly with GSAP.

Do not add Three.js, Pixi, WebGL fluid packages, or shader libraries for this milestone unless the user explicitly widens scope.

## 5. Verification Stack

Minimum verification expected for implementation phases:

- `pnpm build:pages`
- `pnpm audit:pages`
- Focused unit/static guard for portal asset copying and required `/web/` links.
- `git diff --check`

Visual verification should be added during execution:

- Browser screenshot of `.pages/index.html` served under `/web/`.
- Reduced-motion browser check.
- Mobile-width screenshot.
- Basic canvas/nonblank check if the liquid accent uses canvas.

## Sources

- GSAP Installation: https://gsap.com/docs/v3/Installation/
- GSAP Core: https://gsap.com/docs/v3/GSAP/
- GSAP Timeline: https://gsap.com/docs/v3/GSAP/Timeline/
- GSAP matchMedia: https://gsap.com/docs/v3/GSAP/gsap.matchMedia%28%29/
- Local portal source: `web/index.html`
- Local Pages builder/audit: `scripts/build-pages.mjs`, `scripts/audit-pages-artifact.mjs`
