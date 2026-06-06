# Phase 77: Brand Foundation and Static Portal Contract - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning
**Mode:** Smart discuss, auto-accepted from approved milestone brief and research

<domain>
## Phase Boundary

Phase 77 establishes the static landing-page foundation for the public `/web/` portal. It delivers semantic HTML, brand-forward static styling, copy hierarchy, preserved playground/docs routes, a visible alpha caveat, and static asset copy/audit support. It does not install GSAP, implement page transitions, or add the liquid simulation beyond static placeholders needed by later phases.

</domain>

<decisions>
## Implementation Decisions

### Brand Direction
- Use an almost-black page background and muted yellow as the primary accent.
- Treat "Kehto" as the main first-viewport signal with a custom readable wordmark-like text treatment.
- Reference the Finnish "cradle" origin through held/suspended geometry, curved support lines, and soft containment, not literal cradle imagery or Nordic cliches.
- Avoid neon, purple/blue gradients, bokeh/orb decoration, runes, aurora, snow, and baby/cradle illustration.

### Content Hierarchy
- Preserve the existing portal purpose: route visitors to Playground and Docs.
- Make Kehto's value visible before long copy: shell-side runtime, sandboxed napplets, package/runtime proof surfaces.
- Keep the alpha/reference-implementation notice visible and accurate.
- Keep the page useful with CSS only and without JavaScript.

### Static Asset Contract
- Move landing CSS into `web/assets/landing.css`.
- Add `web/assets/landing.js` as the progressive-enhancement entrypoint even if Phase 77 leaves it minimal.
- Reference assets with `/web/assets/...` public paths.
- Extend `scripts/build-pages.mjs` to copy `web/assets` into `.pages/assets`.
- Extend `scripts/audit-pages-artifact.mjs` and focused unit/static coverage so missing portal assets fail locally.

### the agent's Discretion
Implementation details such as exact CSS variables, layout grid, decorative line treatment, and route-card composition are delegated to the agent as long as the approved brand and Pages route constraints hold.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/index.html` is the only current portal source.
- `scripts/build-pages.mjs` already copies the portal, builds the playground artifact, and copies docs/API outputs.
- `scripts/audit-pages-artifact.mjs` already validates `.pages/index.html`, `/web/playground/`, `/web/docs/`, gateway routes, and docs routes.
- `tests/unit/playground-gateway-guard.test.ts` is the existing static guard for Pages scripts and route constants.

### Established Patterns
- Static artifact scripts prefer explicit `existsSync`/`statSync` checks and clear failure messages.
- Tests use `readFileSync(join(process.cwd(), path), 'utf8')` to assert source/audit script invariants.
- Public Pages paths include `/web/` even though the artifact root is `.pages/`.

### Integration Points
- `web/index.html` links to `/web/assets/landing.css` and `/web/assets/landing.js`.
- `scripts/build-pages.mjs` owns copying static portal assets into `.pages/assets`.
- `scripts/audit-pages-artifact.mjs` owns built-artifact checks.
- `tests/unit/playground-gateway-guard.test.ts` can be extended with portal asset assertions.

</code_context>

<specifics>
## Specific Ideas

- First viewport should feel like a quiet, precise product surface rather than a generic landing page.
- Route choices should read as "Open Playground" and "Read Docs" jobs, not generic cards.
- The alpha notice should remain visible but integrated into the visual system.

</specifics>

<deferred>
## Deferred Ideas

- GSAP entrance/exit transitions are Phase 78.
- Liquid animation/simulation is Phase 79.
- Docs theme and playground shell redesign are future milestones.

</deferred>
