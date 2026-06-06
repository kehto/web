---
phase: 79
status: planned
---

# Phase 79 Plan: Liquid Accent and Visual Verification

## Goal

Add the subtle liquid background accent and complete final visual/build verification for the public portal.

## Requirements

- MOTION-03
- VERIFY-01
- VERIFY-02

## Tasks

1. Add an inert canvas layer to the landing-page ambient background.
2. Style the canvas so it sits behind content, never intercepts pointer/focus, and stays low contrast.
3. Implement lightweight canvas rendering in `landing.js` with clamped DPR, static reduced-motion rendering, and GSAP ticker animation for normal motion.
4. Extend static guards/audit coverage for the liquid accent contract.
5. Build and audit the Pages artifact.
6. Serve `.pages` under `/web/` locally and capture desktop, mobile, and reduced-motion screenshots.
7. Record verification evidence and mark the phase complete.

## Verification

- `pnpm test:unit -- tests/unit/playground-gateway-guard.test.ts`
- `pnpm build:pages`
- `pnpm audit:pages`
- `node --check web/assets/landing.js`
- Browser screenshots: desktop, mobile, reduced motion
- Canvas nonblank check
- `git diff --check`

## Non-Goals

- Do not add rendering dependencies.
- Do not add GSAP plugins.
- Do not change public routes.
