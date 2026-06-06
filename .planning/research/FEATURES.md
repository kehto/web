# Feature Research - v1.17 Landing Page Branding

**Project:** Kehto Runtime - v1.17 Beautify the SPA Landing Page
**Researched:** 2026-06-06
**Scope:** User-visible feature categories for the public `/web/` SPA landing page.

---

## 1. Brand System

**Table stakes**

- Almost-black background with restrained contrast.
- Muted yellow as the primary accent.
- Existing green/teal accent either removed from primary use or demoted to tiny functional status details.
- Kehto name receives a custom text treatment rather than plain system-font heading.
- Visual language references "Kehto" as Finnish for cradle through shape, rhythm, and softness, not literal baby/cradle imagery.

**Differentiators**

- Wordmark can suggest a held/suspended runtime through nested curves, protected negative space, or cradle-like baseline forms.
- Typography can pair a precise text face with one custom-drawn or CSS-shaped display treatment for "Kehto".
- Microcopy can connect "runtime", "shell", "sandbox", "napplets", "playground", and "docs" without generic SaaS hero language.

**Anti-features**

- No stock Nordic tropes, runes, folk motifs, snow, aurora, or baby/cradle illustration.
- No neon cyberpunk glow or high-saturation yellow.
- No oversized marketing cards that hide the actual routes.

## 2. Landing UX and Content Hierarchy

**Table stakes**

- Keep the two current routes: `/web/playground/` and `/web/docs/`.
- Keep the alpha notice visible and honest.
- Make the first viewport communicate Kehto's product value before the user reads paragraphs.
- Make playground and docs feel like intentional primary paths, not generic cards.

**Differentiators**

- Route choices can map to jobs:
  - Playground: "watch sandboxed napplets run through the shell."
  - Docs: "integrate the runtime into a host."
- Hero structure can show Kehto as a shell-side cradle for independent napplets: small orbiting/module labels around a central wordmark or restrained runtime diagram.
- Footer can preserve the reference-implementation caveat without undercutting the page's confidence.

**Anti-features**

- No landing-page claim that Kehto is the official runtime for the entire ecosystem.
- No new routes or content silos.
- No copy that suggests protocol stability beyond the current alpha state.

## 3. Liquid Background Accent

**Table stakes**

- Background accent is noticeable but low contrast.
- It never obscures text or reduces link contrast.
- It respects reduced-motion settings.
- It runs behind the content layer and cannot intercept pointer/focus.

**Differentiators**

- The motion can imply a slow suspended medium or cradle-like support instead of generic waves.
- Interaction can be very slight, such as a slow response to pointer position or focus movement.
- The accent can synchronize gently with entrance/exit transitions through a shared GSAP timeline.

**Anti-features**

- No lava-lamp blobs, orbs, bokeh, loud gradients, or decorative one-note purple/blue themes.
- No heavy simulation that dominates CPU/GPU for a static navigation page.

## 4. GSAP Transitions

**Table stakes**

- Entrance animation reveals the page in a coherent order: background, wordmark, summary, notice, destinations.
- Exit animation runs for destination clicks, then navigates to the existing URL.
- Keyboard activation and normal link semantics are preserved.
- Reduced-motion users get immediate navigation and final visual states.

**Differentiators**

- Link hover/focus can move subtle line, underline, or mask elements rather than scaling cards.
- Exit transition can contract the liquid field or dim the page toward the selected route.
- Animation durations should feel smooth and modern, not attention-seeking.

**Anti-features**

- No bounce, elastic, confetti, typewriter gimmick, scramble-text gimmick, or scroll-jacked behavior.
- No animation that delays route navigation by more than a short perceptible transition.

## 5. Quality and Deploy Contract

**Table stakes**

- Static Pages artifact still contains the portal at `.pages/index.html`.
- Portal audit still verifies `/web/playground/` and `/web/docs/` links.
- New static assets are copied into `.pages` and referenced with `/web/`-safe paths.
- Page remains usable if JavaScript fails.
- Text fits mobile and desktop without overlap.

**Differentiators**

- Add a static/unit guard for GSAP vendoring and landing assets so future changes cannot break the public portal silently.
- Implementation can keep visual code in separate `web/assets/*` files instead of expanding one large HTML file.

**Anti-features**

- No public-route change.
- No dependency or Pages workflow churn beyond what GSAP/static assets require.
