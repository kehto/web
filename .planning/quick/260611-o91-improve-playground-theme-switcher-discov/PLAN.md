# Quick Task: Improve Playground Theme Switcher Discovery

## Goal

The playground theme switcher should discover real theme events instead of only exposing hardcoded presets, while keeping the existing theme broadcast path intact.

## Acceptance

- Theme switcher requires and preflights `identity`, `relay`, and `theme`.
- User themes are discovered from the signed-in pubkey using the shell relay service.
- WoT themes are discovered from the signed-in user's kind 3 follows using the shell relay service.
- Global themes are discovered from relay theme definition events without seeded fixtures.
- WoT and global theme groups can be shown or hidden with UI toggles.
- Refresh, WoT, and Global controls remain visible in the top clipped slice of the theme-switcher iframe when the napplet card is low in the playground viewport.
- Existing Light/Dark/Custom broadcast controls remain functional.
- Static conformance guards and focused discovery tests pass.

## Verification

- `pnpm vitest run tests/unit/playground-theme-switcher-discovery.test.ts tests/unit/nip5d-conformance-guard.test.ts tests/unit/playground-gateway-guard.test.ts`
- `pnpm --filter @kehto/demo-theme-switcher build`
- `pnpm --filter @kehto/playground build`
- `pnpm type-check`
- Browser proof against the playground preview.
- Browser measurement that discovery controls are visible within the first 70px of the theme-switcher iframe.
- `git diff --check`
