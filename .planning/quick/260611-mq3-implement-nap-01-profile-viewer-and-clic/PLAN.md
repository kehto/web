# Quick Task: Implement NAP-01 Profile Viewer And Clickable Feed Profiles

## Goal

Turn the profile viewer napplet into a real profile viewer that consumes NAP-01 `profile:open` events, and make feed author affordances emit those events when clicked.

## Acceptance

- The shell advertises the NAP-01 profile topic support through the existing IFC capability model.
- The feed napplet requires IFC and emits `profile:open` with `{ pubkey }` when an author name/avatar is clicked.
- The profile viewer requires IFC, relay, and theme; subscribes to `profile:open`; validates payload pubkeys; and renders arbitrary profile metadata fetched from kind 0 relay events.
- The profile viewer no longer depends on `identity.getProfile()` for its main content.
- Static/unit and browser checks prove the feed-to-profile viewer path and NAP-01 capability contract.

## Verification

- `pnpm vitest run tests/unit/playground-gateway-guard.test.ts packages/shell/tests/no-window-nostr.test.ts`
- `pnpm --filter @kehto/playground build`
- `pnpm type-check`
- `pnpm test:e2e -- profile-open.spec.ts identity-flow.spec.ts relay-subscribe.spec.ts`
- `pnpm lint`
- `git diff --check`
