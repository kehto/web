# Quick Task: Show Profile Images and Names in Playground Feed

## Goal

Feed entries should render recognizable author identity instead of only a short hex pubkey. Follow Hyprgate's approach: subscribe to kind 0 profile metadata for pubkeys that appear in the timeline, parse display name/name/picture, and render avatar plus author name with a pubkey fallback.

## Acceptance

- Timeline events trigger real kind 0 profile subscriptions through the shell relay service.
- Profile metadata is parsed defensively and newest metadata wins.
- Feed rows render avatar images when `picture` exists, fallback initials otherwise, and display name/name before pubkey fallback.
- Existing no-seed and Hyprgate-style following feed behavior stays intact.
- Unit/static/E2E coverage is updated for profile metadata subscriptions and rendering.

## Verification

- `pnpm vitest run tests/unit/playground-feed-store.test.ts tests/unit/playground-gateway-guard.test.ts tests/unit/playground-feed-identity-controller.test.ts`
- `pnpm --filter @kehto/playground build`
- `pnpm type-check`
- `pnpm test:e2e -- relay-subscribe.spec.ts`
- `git diff --check`
