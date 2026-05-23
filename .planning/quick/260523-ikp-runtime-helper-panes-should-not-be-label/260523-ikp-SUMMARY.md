---
status: complete
---

# Quick Task 260523-ikp Summary

## Goal

Make runtime/demo helper panes visually distinct from real playground napplets and remove empty ACL-control space from cards that do not expose inline ACL controls.

## Result

- Added an explicit `runtime-demo` topology surface for `hotkey-chord`, `media-controller`, `config-demo`, and `decrypt-demo`.
- Rendered runtime demo cards in a separate `runtime demos` region after the real napplet region.
- Kept `resource-demo` as a napplet because the resource NUB is the request mediation surface for napplets; the runtime can perform host requests directly.
- Changed runtime demo card kickers and inspector role labels so they no longer display as `napplet`.
- Stopped rendering `.topology-acl-slot` for surfaces without inline ACL controls, removing the blank strip visible above those hosted frames.
- Kept the hosted iframe/session path unchanged so existing gateway, identity-bound, ACL matrix, and sequence-diagram tests still exercise all 13 hosted definitions.

## Implementation Commits

- `24af3d4` — Separate runtime demo surfaces from napplet cards
- `91f8fb3` — Keep resource demo in the napplet topology

## Verification

- `pnpm --filter @kehto/playground build`
- `pnpm type-check`
- `pnpm exec vitest run tests/unit/demo-topology-render.test.ts`
- `CI=1 npx playwright test tests/e2e/shell-ui-state-surfaces.spec.ts tests/e2e/demo-concurrent-boot.spec.ts`
- `pnpm test`
- `pnpm audit:csp`
- `pnpm audit:gateway-artifacts`
