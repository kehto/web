---
phase: 78
status: planned
---

# Phase 78 Plan: GSAP Transition System

## Goal

Add the requested GSAP motion system as progressive enhancement without compromising accessibility or navigation semantics.

## Requirements

- MOTION-01
- MOTION-02
- MOTION-04
- PAGES-01

## Tasks

1. Add `gsap` to the workspace root dependency graph.
2. Update `web/index.html` to load `/web/assets/vendor/gsap.min.js` before `/web/assets/landing.js`.
3. Update `scripts/build-pages.mjs` to copy `node_modules/gsap/dist/gsap.min.js` to `.pages/assets/vendor/gsap.min.js`.
4. Extend `scripts/audit-pages-artifact.mjs` and unit/static guards to verify the GSAP vendor file and script reference.
5. Implement restrained GSAP entrance animation in `web/assets/landing.js`.
6. Implement ordinary-click exit transitions for Playground/Docs while preserving normal modified/new-tab link behavior.
7. Implement reduced-motion behavior via `gsap.matchMedia()` and `prefers-reduced-motion`.
8. Verify with unit/static tests, `pnpm build:pages`, `pnpm audit:pages`, and `git diff --check`.

## Verification

- `pnpm test:unit -- tests/unit/playground-gateway-guard.test.ts`
- `PLAYGROUND_BASE_PATH=/web/playground/ pnpm --filter @kehto/playground build`
- `VITEPRESS_BASE=/web/docs/ pnpm docs:site:build`
- `pnpm build:pages`
- `pnpm audit:pages`
- `git diff --check`

## Non-Goals

- Do not add GSAP plugins.
- Do not implement the liquid accent.
- Do not delay reduced-motion navigation.
