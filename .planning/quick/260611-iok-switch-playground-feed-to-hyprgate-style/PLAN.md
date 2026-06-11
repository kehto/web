# Quick Task: Switch Playground Feed to Hyprgate-Style Following Outbox Feed

## Goal

The playground feed napplet should match Hyprgate's default feed behavior: read the active identity, fetch that identity's latest kind 3 contact list through the shell relay service, and subscribe to kind 1 notes authored by followed pubkeys.

## Acceptance

- No seeded or fake feed data is used.
- The feed does not subscribe to the logged-in pubkey as the author of the timeline.
- The feed requests kind 3 contacts for the logged-in pubkey, then kind 1 timeline/live events for contact pubkeys.
- Empty contact lists produce an empty loaded feed rather than fake fallback content.
- Unit/static/E2E coverage is updated to guard the Hyprgate-style filter sequence.

## Verification

- `pnpm vitest run tests/unit/playground-feed-store.test.ts tests/unit/playground-gateway-guard.test.ts tests/unit/playground-feed-identity-controller.test.ts`
- `pnpm --filter @kehto/playground build`
- `pnpm test:e2e -- relay-subscribe.spec.ts`
