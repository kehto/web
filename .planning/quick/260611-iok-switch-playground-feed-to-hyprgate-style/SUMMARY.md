# Summary

## Result

The playground feed now follows Hyprgate's default feed sequence: it reads the active identity, subscribes to that identity's kind 3 contact list, and then subscribes to kind 1 timeline/live events authored by followed pubkeys through the shell relay service.

## Changed

- Replaced the self-authored kind 1 feed with a kind 3 contact-list bootstrap and following-author kind 1 subscriptions.
- Kept the napplet's existing identity retry behavior so the feed recovers when a signer connects after load.
- Preserved the no-seed/no-fake-data contract; an account with no contacts loads an empty real feed.
- Updated static, unit, and E2E expectations away from the earlier pubkey-authored feed.

## Verification

- `pnpm vitest run tests/unit/playground-feed-store.test.ts tests/unit/playground-gateway-guard.test.ts tests/unit/playground-feed-identity-controller.test.ts` — 3 files, 13 tests passed.
- `pnpm --filter @kehto/playground build` — passed.
- `pnpm type-check` — passed.
- `pnpm test:e2e -- relay-subscribe.spec.ts` — full build plus 2 Chromium tests passed.
- `pnpm lint` — command passed, but Turbo reported no lint tasks executed.
- `git diff --check` — passed.

## Remaining Risk

- `pnpm lint` is currently a no-op because no package lint tasks ran, so lint-specific coverage is not meaningful for this quick task.
