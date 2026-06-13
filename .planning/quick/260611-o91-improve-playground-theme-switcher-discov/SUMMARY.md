# Summary

## Result

The playground theme switcher now discovers real Hyprgate-compatible theme events through the Kehto shell relay service and shows them alongside the existing local presets.

## Changed

- Added a theme discovery module for kind `16767` active profile themes and kind `36767` theme definitions.
- Added user, WoT, and global discovery using NAP identity plus NAP relay subscriptions.
- Added Refresh, WoT, and Global controls to the theme switcher UI.
- Moved the discovery controls before the status text in the first visible row so a low/clipped theme-switcher card no longer appears to be the old Light/Dark/Custom-only UI.
- Kept Light, Dark, and Custom publish controls on the existing `demo.publishTheme` broadcast path.
- Updated the theme-switcher manifest requires to `identity`, `relay`, and `theme`.
- Added a playground relay `relayCache: 'skip'` private hint so live discovery does not read or write the optional worker cache.
- Filtered the optional worker-relay startup console noise while preserving all other console errors.
- Updated README/static/E2E manifest expectations for the new theme-switcher capability contract.

## Verification

- `pnpm vitest run tests/unit/playground-theme-switcher-discovery.test.ts tests/unit/playground-relay-service.test.ts tests/unit/nip5d-conformance-guard.test.ts tests/unit/playground-gateway-guard.test.ts` - 4 files, 26 tests passed.
- `pnpm --filter @kehto/demo-theme-switcher build` - passed; manifest requires `[identity, relay, theme]`.
- `pnpm --filter @kehto/playground build` - passed.
- `pnpm type-check` - passed.
- Browser proof against `http://localhost:5174/` and `http://localhost:4174/` - gateway manifests served the updated theme-switcher artifact with `requires: [identity, relay, theme]`.
- Follow-up browser measurement against `http://localhost:5174/` after the clipped-card screenshot: `theme-discover-btn`, `theme-show-wot`, `theme-show-global`, `theme-status`, `theme-light-btn`, `theme-dark-btn`, `theme-custom-btn`, and `theme-custom-color` all reported `inFirst70: true`; the first row order is Refresh, WoT, Global, status.
- Visual proof saved at `/tmp/kehto-theme-switcher-top-row-after.png`; the only captured browser warning was the existing worker-relay OPFS/COOP-COEP warning.
- `pnpm test:e2e -- theme-broadcast.spec.ts gateway-artifact-parity.spec.ts` - 3 Chromium tests passed.
- `pnpm lint` - command passed, but Turbo reported no lint tasks executed.
- `git diff --check` - passed.

## Remaining Risk

- Live global discovery results depend on reachable public relays, so the exact visible count is network-dependent.
- `pnpm lint` remains a no-op because no package lint tasks are configured.
