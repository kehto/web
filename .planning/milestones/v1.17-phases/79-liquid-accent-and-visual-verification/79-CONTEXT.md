# Phase 79: Liquid Accent and Visual Verification - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning
**Mode:** Smart discuss, auto-accepted from approved milestone brief and research

<domain>
## Phase Boundary

Phase 79 completes the landing page by adding the subtle liquid background accent and running final visual/build verification. It can change the portal canvas/CSS/JS and verification artifacts, but it should not add new graphics dependencies, change public routes, or redesign docs/playground surfaces.

</domain>

<decisions>
## Implementation Decisions

### Liquid Accent
- Use a lightweight canvas 2D accent rather than WebGL or a simulation dependency.
- Keep the accent fixed behind content, low contrast, pointer-transparent, and nonessential.
- Use muted yellow and near-black colors with alpha low enough that text and route controls stay legible.
- Make the motion imply slow suspension/pressure around a cradle, not lava lamp blobs or decorative orbs.

### Motion Preference
- Use the existing reduced-motion branch to draw a static accent and avoid a continuous animation loop.
- Use GSAP's ticker for active animation when available so the accent shares the same motion system.
- Clamp device pixel ratio and particle count to keep the public portal cheap.

### Visual Verification
- Verify the artifact through `build:pages` and `audit:pages`.
- Serve `.pages` at a local `/web/` path so asset URLs match GitHub Pages.
- Capture desktop, mobile, and reduced-motion screenshots.
- Check that the liquid canvas is nonblank and route controls remain visible.

### the agent's Discretion
Exact canvas point count, alpha values, wave math, and screenshot dimensions are delegated to the agent as long as the final result remains subtle and verified.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/assets/landing.js` already initializes GSAP, reduced-motion handling, and route-exit transitions.
- `web/assets/landing.css` already positions static background lines behind content.
- `web/index.html` already has an `ambient-field` layer where the canvas can be added.

### Established Patterns
- Tests statically guard portal asset and motion contracts.
- Build/audit scripts validate `.pages` output.
- Visual verification can use Playwright because the repo already depends on `@playwright/test`.

### Integration Points
- Add a `<canvas>` inside `.ambient-field`.
- Add CSS for `.liquid-accent`.
- Add canvas setup/rendering in `landing.js`.
- Extend tests/audit to assert the canvas contract.

</code_context>

<specifics>
## Specific Ideas

- Use a small array of slowly moving points and radial gradients to create a soft pressure field.
- Under reduced motion, render a single stable frame.
- Save visual evidence under the Phase 79 directory.

</specifics>

<deferred>
## Deferred Ideas

- WebGL/shader-based liquid effects remain future work if explicitly requested.
- Cross-surface visual branding for docs/playground remains future milestone work.

</deferred>
