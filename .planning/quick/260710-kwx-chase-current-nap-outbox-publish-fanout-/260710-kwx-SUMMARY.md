# Quick Task 260710-kwx Summary

## Status

Complete.

## Scope

Chased current NAP-OUTBOX publish fanout from `napplet/naps` and the published
`napplet/web` 0.28 package line.

## Changes

- Replaced retired `outbox.publish` `targetAuthors` handling with `relays`,
  `toOutbox`, and `toInboxes` in the service and router.
- Made `toOutbox` default to `true` and strict: missing or blocked own write
  relays fail before publish.
- Made `toInboxes` required fanout: missing or blocked recipient read relays
  fail before publish.
- Made required relays determine publish success while explicit relay
  candidates may fail if every required relay succeeds.
- Bumped Kehto peer, JSR, docs, demo, fixture, and lockfile surfaces to
  `@napplet/core`/`@napplet/nap` 0.28.0, `@napplet/sdk` 0.24.4,
  `@napplet/shim` 0.26.8, and `@napplet/vite-plugin` 0.11.2.
- Fixed a Paja target reload race surfaced by CI: stale messages from the old
  iframe can no longer mark the runtime ready before the reloaded target
  receives signer-backed identity.
- Updated static conformance guards and the Playwright manifest parity
  assertion for non-normative `requires` order.

## Verification

- `pnpm install --lockfile-only`
- `pnpm install`
- `pnpm exec vitest run packages/services/src/outbox-service.test.ts packages/services/src/relay-pool-outbox-router.test.ts tests/unit/nip5d-conformance-guard.test.ts tests/unit/sdk-migration-guard.test.ts`
- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check`
- `pnpm test:e2e`
- `npx playwright test tests/e2e/paja-single-window.spec.ts --repeat-each=3`
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main --json`
- `git diff --check`

## Notes

This branch is based on `main` after PR #178 and the later Version Packages
merge.
