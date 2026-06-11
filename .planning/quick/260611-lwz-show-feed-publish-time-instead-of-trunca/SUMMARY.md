# Summary

## Result

Feed rows now show the note's relative publish time next to the author name instead of showing the author's truncated pubkey twice.

## Changed

- Replaced the secondary feed row metadata field with a semantic `time.feed-item-time` element.
- Added compact relative publish-time formatting from Nostr `created_at` values.
- Added an absolute local timestamp tooltip via the `time` element title.
- Refreshed relative times once per minute while the feed remains open.
- Updated the feed static guard to prevent reintroducing the truncated-pubkey metadata field.

## Verification

- `pnpm vitest run tests/unit/playground-gateway-guard.test.ts tests/unit/playground-feed-store.test.ts tests/unit/playground-feed-identity-controller.test.ts` - 3 files, 15 tests passed.
- `pnpm --filter @kehto/playground build` - passed.
- `pnpm type-check` - passed.
- `pnpm test:e2e -- relay-subscribe.spec.ts` - full build plus 2 Chromium tests passed.
- `pnpm lint` - command passed, but Turbo reported no lint tasks executed.
- `git diff --check` - passed.

## Remaining Risk

- Relative publish time is protected by static/build/browser checks rather than a deterministic rendered feed-row browser assertion, because the live outbox feed content is not fixed.
- `pnpm lint` is currently a no-op because no package lint tasks ran, so lint-specific coverage is not meaningful for this quick task.
