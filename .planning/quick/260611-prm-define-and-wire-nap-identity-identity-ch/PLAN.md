# Quick Task: Define and Wire NAP-IDENTITY Identity Change Handshake

## Goal

Identify the correct napplet identity handshake, align the playground feed with that handshake, and leave a concrete comment on the upstream `napplet/naps` NAP-IDENTITY proposal.

## Findings

- NIP-5D napplet session identity is shell-assigned from the iframe source and NIP-5A `(dTag, aggregateHash)` tuple at iframe creation. Napplets do not negotiate this identity.
- NAP-IDENTITY user identity is a separate shell-user state surface. The current upstream draft defines request/result queries but no change notification.
- The feed should take one initial `identity.getPublicKey` snapshot, then react to shell-pushed `identity.changed` envelopes instead of polling.

## Acceptance

- Shell bridge exposes a host-facing identity-change push method that broadcasts `{ type: 'identity.changed', pubkey }` to loaded napplet iframes.
- Playground signer state changes publish `identity.changed`; connected signers use their pubkey, and disconnected state publishes an empty pubkey.
- Feed napplet no longer imports or uses the polling `feed-identity-controller`.
- Feed initializes from one `identity.getPublicKey` call and then reacts to `identity.changed` messages from the parent shell.
- Tests cover the new shell broadcast and feed identity event controller.
- Upstream comment is posted on `napplet/naps#12` with the proposed NAP-IDENTITY change semantics.

## Verification

- `pnpm vitest run packages/shell/src/shell-bridge.test.ts tests/unit/playground-feed-identity-events.test.ts tests/unit/playground-gateway-guard.test.ts`
- `pnpm --filter @kehto/demo-feed build`
- `pnpm --filter @kehto/playground build`
- `pnpm type-check`
- `git diff --check`
- `gh pr view 12 --repo napplet/naps --json comments` shows the posted comment.
