# Requirements: Kehto Runtime - v1.17 Beautify the SPA Landing Page

**Defined:** 2026-06-06
**Core Value:** Modular, framework-agnostic runtime for hosting napplet applications.

**Milestone goal:** Rework the public `/web/` SPA landing page into a branded Kehto experience that preserves the current destination links while adding a dark, muted-yellow, Scandinavian-inspired visual identity with subtle liquid motion and GSAP-powered transitions.

**Baseline entering v1.17:** `web/index.html` is a static portal copied to `.pages/index.html` by `scripts/build-pages.mjs`. It currently presents a plain dark page with a system-font "Kehto Runtime" heading, alpha notice, and two destination cards linking to `/web/playground/` and `/web/docs/`. The Pages audit verifies those destination links and the playground/docs artifact routes.

**Scope boundary:** This milestone is landing-page brand, UX, motion, and static Pages artifact work. It must not change Kehto runtime protocol behavior, public package APIs, playground app internals, docs content architecture, or the public `/web/`, `/web/playground/`, and `/web/docs/` route contract.

## v1.17 Requirements

### Brand Identity

- [ ] **BRAND-01**: Visitor can immediately recognize the page as Kehto through a custom readable wordmark/text treatment, not a plain system-font heading.
- [ ] **BRAND-02**: Visitor sees an almost-black visual system with muted yellow as the primary accent.
- [ ] **BRAND-03**: The design evokes Kehto's Finnish "cradle" origin through subtle shape/motion language without literal cradle, baby, rune, aurora, or folk motifs.

### Landing UX

- [ ] **UX-01**: Visitor can still navigate to `/web/playground/` and `/web/docs/` from the landing page.
- [ ] **UX-02**: Visitor understands Kehto as a shell-side runtime for sandboxed napplets before choosing a destination.
- [ ] **UX-03**: The alpha/reference-implementation caveat remains visible and accurate.

### Motion

- [ ] **MOTION-01**: Page entrance uses GSAP for restrained staged reveal of background, wordmark, copy, notice, links, and footer.
- [ ] **MOTION-02**: Ordinary clicks to Playground or Docs use a short GSAP exit transition before navigation, while preserving normal link behavior.
- [ ] **MOTION-03**: Background includes a subtle low-contrast liquid accent that never obscures content.
- [ ] **MOTION-04**: Reduced-motion users get immediate final states, no delayed navigation, and static or minimal background motion.

### Static Pages Contract

- [ ] **PAGES-01**: GSAP is added explicitly and vendored into the Pages artifact instead of loaded only from a CDN.
- [ ] **PAGES-02**: Portal CSS/JS assets are copied into `.pages/assets` and referenced with `/web/`-safe paths.
- [ ] **PAGES-03**: `audit:pages` verifies portal links and required landing assets.

### Verification

- [ ] **VERIFY-01**: `pnpm build:pages`, `pnpm audit:pages`, focused portal tests/static guards, and `git diff --check` pass.
- [ ] **VERIFY-02**: Desktop, mobile, reduced-motion, and liquid-accent visual checks are captured before the milestone is considered done.

## Future Requirements

Deferred to later milestones.

### Broader Web Presence

- **WEB-01**: Apply the v1.17 brand system to the VitePress docs theme after the landing page proves the identity direction.
- **WEB-02**: Apply matching visual polish to the playground shell without disrupting its integration-demo verification role.
- **WEB-03**: Add live deployed-browser smoke coverage for `https://kehto.github.io/web/` after the Pages artifact is pushed.

### Advanced Motion and Media

- **MOTION-ADV-01**: Evaluate a more advanced shader or WebGL liquid field only if the lightweight accent proves insufficient and performance budgets are explicitly approved.
- **MOTION-ADV-02**: Consider route-aware shared transitions across the portal, playground, and docs only if those apps adopt a shared navigation shell.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Public route changes | The existing `/web/`, `/web/playground/`, and `/web/docs/` contract is already deployed and audited. |
| Runtime protocol changes | This milestone is visual/UX work and must not change NIP-5D behavior. |
| Public package API changes | Landing-page branding should not affect package consumers. |
| Playground app redesign | The playground remains a linked proof surface; visual changes there are future work. |
| Docs theme redesign | Docs remain a linked proof surface; broad docs branding is future work. |
| Full fluid-simulation dependency | User requested subtle liquid accent; research recommends lightweight canvas/SVG first. |
| GSAP plugin adoption | Core GSAP is enough unless an implementation phase proves a plugin is necessary. |
| CDN-only GSAP delivery | Public first impression should not depend on a third-party runtime script request. |
| Literal cradle/Nordic imagery | The requested origin reference should be subtle and modern, not cliche. |
| Decrypt-demo fixture repair | Backlog 999.1 remains valid but is unrelated to landing-page branding. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRAND-01 | Phase 77 | Planned |
| BRAND-02 | Phase 77 | Planned |
| BRAND-03 | Phase 77 | Planned |
| UX-01 | Phase 77 | Planned |
| UX-02 | Phase 77 | Planned |
| UX-03 | Phase 77 | Planned |
| MOTION-01 | Phase 78 | Planned |
| MOTION-02 | Phase 78 | Planned |
| MOTION-03 | Phase 79 | Planned |
| MOTION-04 | Phase 78 | Planned |
| PAGES-01 | Phase 78 | Planned |
| PAGES-02 | Phase 77 | Planned |
| PAGES-03 | Phase 77 | Planned |
| VERIFY-01 | Phase 79 | Planned |
| VERIFY-02 | Phase 79 | Planned |

**Coverage:**
- v1.17 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-06-06*
*Last updated: 2026-06-06 after roadmap traceability mapping*
