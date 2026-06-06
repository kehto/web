# Pitfalls Research - v1.17 Landing Page Branding

**Project:** Kehto Runtime - v1.17 Beautify the SPA Landing Page
**Researched:** 2026-06-06
**Scope:** Risks when adding brand, GSAP motion, and a liquid background accent to the static public portal.

---

## P1. Motion Becomes Flashy Instead of Impactful

**Risk:** GSAP makes it easy to over-animate. Bounce, elastic, scramble-text, neon glow, and delayed navigation would violate the user's "impact without flashiness" direction.

**Mitigation:**

- Use one restrained timeline.
- Favor opacity, slight y movement, clipping/mask reveal, and subtle filter changes.
- Avoid bounce/elastic/scramble effects.
- Keep exit delay short.

## P2. The Liquid Accent Looks Like Generic Decoration

**Risk:** The background becomes lava-lamp blobs, orbs, bokeh, or a loud gradient. That would feel cliche rather than Kehto-specific.

**Mitigation:**

- Tie motion language to "cradle" and "runtime support": slow suspension, held modules, gentle pressure fields.
- Keep alpha low and palette near black plus muted yellow.
- Verify text contrast over the busiest frame.

## P3. Brand Work Overstates Product Maturity

**Risk:** A polished hero can accidentally imply Kehto is stable or official for the whole NIP-5D ecosystem.

**Mitigation:**

- Preserve the alpha notice.
- Keep wording scoped to "a runtime implementation" and "reference implementation" language.
- Preserve routes to docs and playground as the concrete proof surfaces.

## P4. Static Pages Asset Paths Break

**Risk:** GitHub Pages serves `.pages/index.html` at `/web/`. New assets can easily be referenced as `/assets/*`, `./assets/*`, or nested `/web/web/*` incorrectly.

**Mitigation:**

- Reference public assets under `/web/assets/...`.
- Copy `web/assets` to `.pages/assets`.
- Extend `audit:pages` to verify asset files and references.

## P5. External GSAP Delivery Regresses the First Impression

**Risk:** A CDN script can fail or lag, leaving inconsistent behavior.

**Mitigation:**

- Install GSAP from npm and vendor `gsap.min.js` into the Pages artifact.
- Keep the page useful when GSAP or JavaScript is unavailable.

## P6. Reduced-Motion and Keyboard Users Get a Worse Page

**Risk:** Entrance/exit transitions can trap focus, delay navigation, or ignore vestibular preferences.

**Mitigation:**

- Use `gsap.matchMedia()` with `prefers-reduced-motion`.
- Do not intercept modified clicks, new-tab clicks, downloads, or external links.
- In reduced-motion mode, skip exit delay and render the liquid accent static.
- Ensure focus styles remain visible.

## P7. Canvas Cost or Visual Bugs Hurt a Navigation Page

**Risk:** A full simulation can consume CPU/GPU or render blank on some devices.

**Mitigation:**

- Clamp DPR and particle count.
- Use a low-frequency loop.
- Fall back to static CSS/SVG composition when needed.
- Add browser screenshot and nonblank checks during execution.

## P8. Typography Becomes Illegible or Culturally Thin

**Risk:** "Non-standard text" can turn into hard-to-read decorative lettering or shallow Nordic references.

**Mitigation:**

- Keep "Kehto" readable as text.
- Use a custom wordmark treatment with careful spacing, curves, or mask work.
- Avoid runes, folk ornaments, snow, aurora, and literal cradle imagery.

## P9. Implementation Swells the Single HTML File

**Risk:** Inline CSS and JS can turn `web/index.html` into a hard-to-review asset blob.

**Mitigation:**

- Put CSS and JS in `web/assets/landing.css` and `web/assets/landing.js`.
- Keep HTML semantic and content-focused.
- Guard asset copying in the Pages audit.
