# Phase 78: GSAP Transition System - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning
**Mode:** Smart discuss, auto-accepted from approved milestone brief and research

<domain>
## Phase Boundary

Phase 78 adds GSAP as the public portal's progressive motion layer. It vendors GSAP into the Pages artifact, loads it before the landing script, choreographs restrained entrance and exit transitions, preserves normal link semantics, and honors reduced-motion preferences. It does not add the liquid simulation, which is Phase 79.

</domain>

<decisions>
## Implementation Decisions

### Dependency and Delivery
- Install `gsap` explicitly at the workspace root because the user requested GSAP.
- Vendor `node_modules/gsap/dist/gsap.min.js` into `.pages/assets/vendor/gsap.min.js` during `build:pages`.
- Load vendored GSAP from `/web/assets/vendor/gsap.min.js` before `landing.js`.
- Keep the portal useful if GSAP or JavaScript fails.

### Motion Choreography
- Use one restrained entrance timeline with shared defaults.
- Reveal background, wordmark, copy, proof items, notice, destination links, and footer in a calm order.
- Use opacity, small y movement, clip/mask, and subtle line movement rather than bounce, elastic, scramble, or flashy effects.
- Keep route exit transitions short.

### Link Semantics and Accessibility
- Intercept only ordinary same-window internal clicks to `/web/playground/` and `/web/docs/`.
- Preserve modifier-key, new-tab, download, external, and already-handled interactions.
- Under `prefers-reduced-motion: reduce`, render final states immediately and navigate without delay.
- Keep keyboard focus styles visible and avoid focus traps.

### the agent's Discretion
Exact GSAP durations, easing, and selectors are delegated to the agent as long as the motion remains restrained and measurable.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 77 added `web/assets/landing.css` and `web/assets/landing.js`.
- `scripts/build-pages.mjs` already copies `web/assets` into `.pages/assets`.
- `scripts/audit-pages-artifact.mjs` verifies landing CSS/JS existence and references.

### Established Patterns
- Build scripts use `ensureFile()` for explicit prerequisite failures.
- Tests statically assert script/audit behavior in `tests/unit/playground-gateway-guard.test.ts`.
- Public asset paths must include `/web/`.

### Integration Points
- `web/index.html` should load `/web/assets/vendor/gsap.min.js` before `/web/assets/landing.js`.
- `build:pages` should copy GSAP into `.pages/assets/vendor/`.
- `audit:pages` and the unit guard should verify GSAP vendoring and source references.
- `landing.js` owns the GSAP timeline and click interception.

</code_context>

<specifics>
## Specific Ideas

- Use a custom data attribute such as `data-motion="ready"` to expose motion setup for static checks.
- Use `gsap.matchMedia()` for reduced-motion behavior.
- The exit transition can dim/settle the shell briefly before navigating.

</specifics>

<deferred>
## Deferred Ideas

- Liquid simulation and canvas/nonblank checks are Phase 79.
- Cross-app route transitions into playground/docs are future work because those apps do not share a navigation shell.

</deferred>
