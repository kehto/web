# Quick Task: Sync NAP-IDENTITY to Loaded Napplets

## Goal

Fix the playground feed case where the signer is connected or restored but the feed napplet still sees the empty `identity.getPublicKey` sentinel and stays at `not logged in`.

## Acceptance

- Keep NIP-5D napplet session identity source-bound at iframe registration.
- Push current shell-user identity as NAP-IDENTITY `identity.changed` to loaded napplets after registration/load.
- Refresh the current user identity when a napplet asks `identity.getPublicKey`, so late-loaded frames recover without polling.
- Do not introduce feed fixtures, seeded feed cache, or a napplet-local relay pool.
- Add browser coverage that restored signer identity reaches the feed after reload.

## Verification

- `pnpm vitest run packages/shell/src/shell-bridge.test.ts tests/unit/playground-feed-identity-events.test.ts tests/unit/playground-gateway-guard.test.ts`
- `pnpm test:e2e -- relay-subscribe.spec.ts signer-persistence.spec.ts`
- `pnpm --filter @kehto/playground build`
- `pnpm type-check`
- `git diff --check`
