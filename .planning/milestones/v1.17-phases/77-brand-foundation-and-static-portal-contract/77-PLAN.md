---
phase: 77
status: planned
---

# Phase 77 Plan: Brand Foundation and Static Portal Contract

## Goal

Establish the static Kehto landing-page identity and artifact asset contract before animation work.

## Requirements

- BRAND-01
- BRAND-02
- BRAND-03
- UX-01
- UX-02
- UX-03
- PAGES-02
- PAGES-03

## Tasks

1. Refactor `web/index.html` into semantic static markup with a clear Kehto hero, alpha notice, and preserved `/web/playground/` plus `/web/docs/` links.
2. Add `web/assets/landing.css` for the dark/muted-yellow brand system, custom wordmark treatment, responsive layout, focus states, and static cradle-inspired visual details.
3. Add `web/assets/landing.js` as the future progressive-enhancement entrypoint without requiring JavaScript for navigation.
4. Update `scripts/build-pages.mjs` to copy `web/assets` into `.pages/assets`.
5. Update `scripts/audit-pages-artifact.mjs` and unit/static guards to verify required portal asset files and `/web/assets/...` references.
6. Verify with focused unit/static tests, `pnpm build:pages`, `pnpm audit:pages`, and `git diff --check`.

## Verification

- `pnpm test:unit -- tests/unit/playground-gateway-guard.test.ts`
- `pnpm build:pages`
- `pnpm audit:pages`
- `git diff --check`

## Non-Goals

- Do not install or vendor GSAP in this phase.
- Do not implement entrance/exit transition choreography in this phase.
- Do not implement the liquid simulation in this phase.
- Do not change public route paths.
