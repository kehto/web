# Summary

## Result

Kehto now treats NIP-5D napplet session identity and NAP-IDENTITY shell-user identity as separate handshakes. Napplet session identity remains source-bound at iframe creation; shell-user identity now uses one `identity.getPublicKey` snapshot plus shell-pushed `identity.changed` events instead of feed polling.

## Changed

- Added `ShellBridge.publishIdentityChanged(pubkey)` to broadcast `{ type: 'identity.changed', pubkey }` to loaded napplet iframes.
- Published `identity.changed` from playground signer state changes, using an empty pubkey for signed-out state.
- Replaced the feed polling controller with an event controller that takes one initial `identity.getPublicKey` snapshot and then reacts to parent-sourced `identity.changed` messages.
- Aligned the runtime fallback `identity.getPublicKey` path with NAP-IDENTITY semantics: no signer returns `identity.getPublicKey.result` with `pubkey: ""`, not an error.
- Documented `identity.changed` in the NIP-5D raw-envelope policy as a NAP helper-surface gap.
- Posted the upstream proposal comment on `napplet/naps#12`: https://github.com/napplet/naps/pull/12#issuecomment-4682796269

## Verification

- `pnpm vitest run packages/runtime/src/dispatch.test.ts packages/shell/src/shell-bridge.test.ts tests/unit/playground-feed-identity-events.test.ts tests/unit/playground-gateway-guard.test.ts tests/unit/nip5d-conformance-guard.test.ts` - 5 files, 91 tests passed.
- `pnpm --filter @kehto/demo-feed build` - passed.
- `pnpm --filter @kehto/playground build` - passed.
- `pnpm type-check` - passed.
- `pnpm test:e2e -- relay-subscribe.spec.ts signer-persistence.spec.ts` - 3 Chromium tests passed, including post-load signer connect feed subscription.
- `gh pr view 12 --repo napplet/naps --json comments` - verified the posted comment URL/body.
- `pnpm lint` - command passed, but Turbo reported no lint tasks executed.
- `git diff --check` - passed.

## Remaining Risk

- The upstream NAP-IDENTITY comment is a proposal comment, not an accepted spec change yet.
- `identity.changed` is currently consumed through a local parent-sourced message listener because the published `@napplet/nap` identity SDK does not expose a subscribe helper yet.
- `pnpm lint` remains a no-op because no package lint tasks are configured.
