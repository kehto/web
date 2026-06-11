# Quick Task: Show Feed Publish Time Instead Of Truncated Pubkey

## Goal

Feed rows should show when the note was published instead of repeating the author's truncated pubkey next to the display name.

## Acceptance

- Feed row metadata renders author name plus relative publish time.
- Truncated pubkey is no longer rendered as the secondary metadata field.
- Publish time is derived from the Nostr event `created_at` timestamp.
- Relative time refreshes while the feed remains open.
- Static/unit and browser-visible relay feed checks still pass.

## Verification

- `pnpm vitest run tests/unit/playground-gateway-guard.test.ts tests/unit/playground-feed-store.test.ts tests/unit/playground-feed-identity-controller.test.ts`
- `pnpm --filter @kehto/playground build`
- `pnpm type-check`
- `pnpm test:e2e -- relay-subscribe.spec.ts`
- `pnpm lint`
- `git diff --check`
