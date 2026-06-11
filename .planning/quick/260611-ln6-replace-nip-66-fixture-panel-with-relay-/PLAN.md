# Quick Task: Replace NIP-66 Fixture Panel With Relay Activity Stats

## Goal

The lower playground relay panel should explain the relays actually being used by the shell relay runtime, not show synthetic NIP-66 fixture suggestions.

## Acceptance

- Relay runtime tracks relay URL activity ordered by latest access.
- Panel shows the latest five active relays with event, subscription, request, and publish counters.
- Empty state says no relay activity yet.
- NIP-66 fixture suggestion wording is removed from the visible panel.
- Unit/static/E2E coverage protects the activity panel and no longer expects fixture relay URLs as the visible contract.

## Verification

- `pnpm vitest run tests/unit/playground-relay-service.test.ts tests/unit/playground-gateway-guard.test.ts`
- `pnpm --filter @kehto/playground build`
- `pnpm type-check`
- `pnpm test:e2e -- relay-activity.spec.ts relay-subscribe.spec.ts`
- `git diff --check`
