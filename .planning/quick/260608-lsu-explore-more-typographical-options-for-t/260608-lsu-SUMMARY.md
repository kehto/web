---
status: complete
quick_id: 260608-lsu
date: 2026-06-08
commit: 288df7d
---

# Quick Task 260608-lsu Summary

## Goal

Explore and apply stronger typography for the Kehto web landing page, fitting:

- the target market of runtime/tooling builders,
- the Finnish meaning of Kehto as "cradle",
- the modernity of the offering.

The in-progress contour interaction feedback from the prior turn was also preserved and completed because it did not conflict with the typography work.

## Implemented

- Replaced the old serif display direction with explicit typography roles:
  - `--font-brand`: humanist sans stack for the Kehto wordmark and destination headings.
  - `--font-copy`: interface sans stack for body text and the `Web Runtime` role.
  - `--font-mono`: technical mono stack for paths, proof chips, and compact runtime labels.
- Removed viewport-scaled type from the edited landing typography and moved sizing to fixed values plus breakpoints.
- Kept `Web Runtime` in title case instead of the previous compressed uppercase treatment.
- Added stronger settled pointer wake after the entrance animation reaches `data-motion="ready"`.
- Added subtle passive transparency pulse bands to the contour fabric.
- Added active top-to-bottom contour pulses on playground/docs hover and focus.
- Updated the static guard test so future changes preserve the site script wrappers, typography roles, line-fabric renderer, pointer wake, and hover pulse hooks.

## Changed Files

- `web/assets/landing.css`
- `web/assets/landing.js`
- `tests/unit/playground-gateway-guard.test.ts`

## Verification

Passed:

- `node --check web/assets/landing.js`
- `pnpm test:unit tests/unit/playground-gateway-guard.test.ts`
- `pnpm test:unit`
- `pnpm type-check`
- `pnpm lint`
- `pnpm site:build && pnpm site:audit && pnpm build`
- `npx --yes aislop scan -d`
- `git diff --check`

Live browser proof:

- Desktop screenshot: `/tmp/kehto-site-type-final-desktop.png`
- Mobile screenshot: `/tmp/kehto-site-type-final-mobile.png`
- Computed wordmark stack: `Optima, Candara, "Avenir Next", "Segoe UI", FreeSans, sans-serif`
- Computed body stack: `"Avenir Next", "Segoe UI", FreeSans, sans-serif`
- Text overflow count: `0` on desktop and mobile
- Pointer movement changed canvas checksums after the page reached `data-motion="ready"`
- Hovering a destination changed canvas checksums across early/mid/late pulse samples
- No failed browser requests
- No browser console errors

## Remaining Risk

- Typography and mouse feel were verified in Chromium screenshots, but final subjective tuning still depends on the target physical display.
