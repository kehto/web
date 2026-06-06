# Roadmap: Kehto Runtime

## Milestones

- [x] **v1.0: NIP-5D Migration & Gap Analysis** - 5 phases, 7 plans, 17 requirements ([archive](milestones/v1.0-ROADMAP.md))
- [x] **v1.1: NIP-5D Migration Implementation** - 4 phases, 8 plans, 16 requirements ([archive](milestones/v1.1-ROADMAP.md))
- [x] **v1.2: NIP-5D Conformance & Full NUB Coverage** - 6 phases, 19 plans, 26 requirements, 449 tests ([archive](milestones/v1.2-ROADMAP.md) | [audit](milestones/v1.2-MILESTONE-AUDIT.md))
- [x] **v1.3: Demo Functional & Playwright Parity** - 7 phases (16-22), 43 plans, 37 requirements, 47 E2E specs green ([archive](milestones/v1.3-ROADMAP.md) | [audit](milestones/v1.3-MILESTONE-AUDIT.md))
- [x] **v1.4: Productionization & Upstream Unblock** - 6 phases (23-28), 17 plans, 20 requirements, 49 E2E specs green ([archive](milestones/v1.4-ROADMAP.md) | [audit](milestones/v1.4-MILESTONE-AUDIT.md))
- [x] **v1.5: Demo Stability & UAT Coverage** - 3 phases (29-31), 7 plans, 7 requirements, 53 E2E specs green ([archive](milestones/v1.5-ROADMAP.md) | [audit](milestones/v1.5-MILESTONE-AUDIT.md))
- [x] **v1.6: Downstream Unblock & Shell Service Surface** - 5 phases (32-36), 12 plans, 21 requirements, 54 E2E specs green ([archive](milestones/v1.6-ROADMAP.md) | [audit](milestones/v1.6-MILESTONE-AUDIT.md))
- [x] **v1.7: NIP-5D Spec Adoption & New NUB Domains** - 5 phases (37-41), 17 plans, 41/41 requirements, 72 E2E specs green ([archive](milestones/v1.7-ROADMAP.md) | [audit](milestones/v1.7-MILESTONE-AUDIT.md))
- [x] **v1.8: Upstream Alignment & NIP-44 Decrypt** - 5 phases (42-46), 9 plans, 27/27 requirements, 86 E2E specs green ([archive](milestones/v1.8-ROADMAP.md) | [audit](milestones/v1.8-MILESTONE-AUDIT.md))
- [x] **v1.9: Napplet SDK Migration** - 3 phases (47-49), 3 plans, 12/12 requirements, 86 E2E specs green ([archive](milestones/v1.9-ROADMAP.md) | [audit](milestones/v1.9-MILESTONE-AUDIT.md))
- [x] **v1.10: Compatibility Window Cleanup & Decrypt Demo Parity** - 3 phases (50-52), 3 plans, 10/10 requirements, 86 E2E specs green ([archive](milestones/v1.10-ROADMAP.md) | [audit](milestones/v1.10-MILESTONE-AUDIT.md))
- [x] **v1.11: NIP-5A Gateway Artifact Parity** - 3 phases (53-55), 16/16 requirements, production-equivalent opaque-origin gateway artifact loading, 551 unit tests, 87 E2E specs green ([archive](milestones/v1.11-ROADMAP.md) | [audit](milestones/v1.11-MILESTONE-AUDIT.md))
- [x] **v1.12: NIP-5D Contract Conformance** - 4 phases (56-59), 34/34 requirements, 560 unit tests, 89 E2E specs green, pinned-spec contract conformance across shell, shim/runtime, gateway load checks, and 13 playground napplets ([archive](milestones/v1.12-ROADMAP.md) | [requirements](milestones/v1.12-REQUIREMENTS.md) | [audit](milestones/v1.12-MILESTONE-AUDIT.md))
- [x] **v1.13: Documentation Strategy & Monorepo Docs Site** - 5 phases (60-64), 28/28 requirements, content strategy, package docs, tutorials/how-tos, VitePress site, and docs verification ([archive](milestones/v1.13-ROADMAP.md) | [requirements](milestones/v1.13-REQUIREMENTS.md) | [audit](milestones/v1.13-MILESTONE-AUDIT.md))
- [x] **v1.14: GitHub Pages Web Portal** - 3 phases (65-67), 13/13 requirements, public `/web/` portal, playground at `/web/playground/`, docs at `/web/docs/`, and unified Pages deploy gate ([archive](milestones/v1.14-ROADMAP.md) | [requirements](milestones/v1.14-REQUIREMENTS.md) | [audit](milestones/v1.14-MILESTONE-AUDIT.md))
- [x] **v1.15: Address AI Slop** - 5 phases (68-72), 20/20 original requirements complete, local `aislop` scan no longer Critical, 563 unit tests green ([archive](milestones/v1.15-ROADMAP.md) | [requirements](milestones/v1.15-REQUIREMENTS.md) | [audit](milestones/v1.15-MILESTONE-AUDIT.md))
- [x] **v1.16: Structural Code Quality Refactor** - 4 phases (73-76), 18/18 requirements, local `aislop` scan clean, 563 unit tests green ([archive](milestones/v1.16-ROADMAP.md) | [requirements](milestones/v1.16-REQUIREMENTS.md) | [audit](milestones/v1.16-MILESTONE-AUDIT.md))
- [ ] **v1.17: Beautify the SPA Landing Page** - 3 phases (77-79), 15 requirements, static `/web/` brand system, GSAP motion, and liquid accent

---

## Active Milestone

### v1.17: Beautify the SPA Landing Page

**Goal:** Rework the public `/web/` SPA landing page into a branded Kehto experience that preserves the current destination links while adding a dark, muted-yellow, Scandinavian-inspired visual identity with subtle liquid motion and GSAP-powered transitions.

**Baseline entering v1.17:** `web/index.html` is a static portal copied to `.pages/index.html` by `scripts/build-pages.mjs`. It has a plain dark style, an alpha notice, and links to `/web/playground/` and `/web/docs/`. The current Pages audit verifies those routes but not portal CSS/JS or animation assets.

**Coverage:** 15/15 requirements mapped.

**Critical invariant:** Preserve the public `/web/`, `/web/playground/`, and `/web/docs/` route contract; keep the landing page useful without JavaScript; do not change runtime protocol behavior, package APIs, playground internals, or docs architecture.

### Phases

- [ ] **Phase 77: Brand Foundation and Static Portal Contract** - Rebuild the static landing page structure, brand system, copy hierarchy, and asset-copy/audit contract while preserving destination links.
- [ ] **Phase 78: GSAP Transition System** - Add GSAP as an explicit dependency, vendor it into the Pages artifact, and implement restrained entrance/exit/focus motion with reduced-motion behavior.
- [ ] **Phase 79: Liquid Accent and Visual Verification** - Add the subtle liquid background accent, complete visual polish, and prove desktop/mobile/reduced-motion/Pages checks.

---

## Phase Details

### Phase 77: Brand Foundation and Static Portal Contract

**Goal**: Establish the static Kehto landing-page identity and artifact asset contract before animation work.

**Depends on**: v1.17 requirements accepted; v1.17 research complete.

**Requirements**: BRAND-01, BRAND-02, BRAND-03, UX-01, UX-02, UX-03, PAGES-02, PAGES-03

**Rationale**: The page should remain meaningful and navigable before JavaScript runs. Brand, hierarchy, destination links, and static asset delivery are the foundation for every later motion enhancement.

**Success Criteria** (what must be TRUE):
  1. `web/index.html` presents a readable custom Kehto wordmark/text treatment, almost-black background, muted-yellow primary accent, and cradle-inspired visual language without cliche imagery.
  2. `/web/playground/` and `/web/docs/` remain the primary destination links with accurate copy explaining the playground and docs jobs.
  3. The alpha/reference-implementation caveat remains visible and accurate.
  4. Portal CSS/JS asset references use `/web/`-safe paths, and `build:pages` copies static portal assets into `.pages/assets`.
  5. `audit:pages` verifies both the existing destination links and the required landing asset files/references.

**Status**: Not started

**Plans**: 0/1 complete

### Phase 78: GSAP Transition System

**Goal**: Add the requested GSAP motion system as progressive enhancement without compromising accessibility or navigation semantics.

**Depends on**: Phase 77

**Requirements**: MOTION-01, MOTION-02, MOTION-04, PAGES-01

**Rationale**: Motion should be implemented after the static page works so GSAP can enhance stable elements rather than carry content meaning. This phase isolates dependency and transition risks before adding the liquid accent.

**Success Criteria** (what must be TRUE):
  1. `gsap` is installed explicitly and `build:pages` vendors `gsap.min.js` into the Pages artifact.
  2. Page entrance uses a restrained GSAP timeline for background, wordmark, copy, notice, links, and footer.
  3. Ordinary same-window clicks to Playground or Docs run a short exit transition before navigation while modified/new-tab interactions keep normal link behavior.
  4. `prefers-reduced-motion: reduce` renders final states immediately, avoids delayed navigation, and avoids nonessential motion.
  5. Focus and hover states remain visible and usable with keyboard and pointer input.

**Status**: Not started

**Plans**: 0/1 complete

### Phase 79: Liquid Accent and Visual Verification

**Goal**: Add the subtle liquid background accent and complete final visual/build verification for the public portal.

**Depends on**: Phase 78

**Requirements**: MOTION-03, VERIFY-01, VERIFY-02

**Rationale**: The liquid accent is the highest taste/performance risk. It should land after the static brand and GSAP motion system are already controlled, then close with visual proof across viewport and motion-preference modes.

**Success Criteria** (what must be TRUE):
  1. The landing page includes a low-contrast liquid accent behind content that is noticeable but never obscures text or links.
  2. The liquid accent is static or minimal under reduced motion.
  3. `pnpm build:pages`, `pnpm audit:pages`, focused portal tests/static guards, and `git diff --check` pass.
  4. Desktop and mobile screenshots show no text overlap, broken route controls, or incoherent visual layering.
  5. Reduced-motion and liquid-accent visual checks are captured before closeout.

**Status**: Not started

**Plans**: 0/1 complete

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 77. Brand Foundation and Static Portal Contract | 0/1 | Not started | — |
| 78. GSAP Transition System | 0/1 | Not started | — |
| 79. Liquid Accent and Visual Verification | 0/1 | Not started | — |

## Backlog

### Backlog 999.1: Fix decrypt-demo fixture delivery pending state

**Goal:** Investigate and fix the playground `decrypt-demo` staying in `waiting for fixtures` / `[pending]` for NIP-04, NIP-44, NIP-17, and Class-2 probe rows.

**Captured:** 2026-05-23 via `$gsd-capture --backlog`

**Context:** `.planning/backlog/999.1-fix-decrypt-demo-fixture-pending/999.1-CONTEXT.md`

**Observed symptom:** User screenshot shows the decrypt demo panel stuck with:
- `waiting for fixtures`
- `NIP-04 [pending]`
- `NIP-44 [pending]`
- `NIP-17 [pending]`
- `Class-2 [pending]`

**Acceptance direction:**
- The playground decrypt demo receives fixtures reliably after boot.
- NIP-04, NIP-44, NIP-17, and Class-2 rows leave `[pending]` and settle to the expected terminal state.
- Regression coverage catches fixture-delivery stalls in the real playground path.

---

*ROADMAP.md last updated: 2026-06-06 - v1.17 roadmap created.*
