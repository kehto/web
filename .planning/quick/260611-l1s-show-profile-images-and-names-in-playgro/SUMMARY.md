# Summary

## Result

Feed rows now show author profile names and avatars when profile metadata is available. The feed still uses the Hyprgate-style following/outbox sequence and does not use seeded data.

## Changed

- Added kind 0 profile metadata subscriptions for timeline authors through the shell relay service.
- Parsed `display_name`, `name`, and `picture` defensively, with newest metadata winning.
- Rendered feed rows with avatar image, initials fallback, author name, short pubkey, and note content.
- Updated feed static and unit guards to prevent regressing to hex-only rows or self-authored feed filters.

## Verification

- `pnpm vitest run tests/unit/playground-feed-store.test.ts tests/unit/playground-gateway-guard.test.ts tests/unit/playground-feed-identity-controller.test.ts` — 3 files, 14 tests passed.
- `pnpm --filter @kehto/playground build` — passed.
- `pnpm type-check` — passed.
- `pnpm test:e2e -- relay-subscribe.spec.ts` — full build plus 2 Chromium tests passed.
- `pnpm lint` — command passed, but Turbo reported no lint tasks executed.
- `git diff --check` — passed.

## Remaining Risk

- `pnpm lint` is currently a no-op because no package lint tasks ran, so lint-specific coverage is not meaningful for this quick task.
