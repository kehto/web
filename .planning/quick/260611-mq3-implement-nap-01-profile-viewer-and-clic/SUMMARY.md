# Summary

## Result

The playground profile viewer is now a real NAP-01 consumer. Feed author names and avatars emit `profile:open` through IFC, and the profile viewer listens for that topic, validates the requested pubkey, and fetches kind 0 profile metadata through the shell relay service.

## Changed

- Added `ifc:NAP-01` to the shell-advertised IFC protocol capabilities.
- Made feed author names and avatars clickable while preserving profile image, display name, and relative publish-time rendering.
- Added feed IFC requirements and `profile:open` emission with normalized hex pubkey payloads.
- Replaced the old `identity.getProfile` profile-viewer demo with a NAP-01 listener backed by `relay.subscribe` kind 0 metadata lookup.
- Added a bounded profile metadata timeout so unknown profiles settle to `not found` instead of staying on `loading`.
- Updated static guards, manifest parity checks, identity-flow E2E, and added profile-open E2E coverage.

## Verification

- `pnpm type-check` - passed.
- `pnpm vitest run tests/unit/playground-gateway-guard.test.ts tests/unit/nip5d-conformance-guard.test.ts packages/shell/tests/no-window-nostr.test.ts` - 3 files, 19 tests passed.
- `pnpm build` - passed; feed/profile-viewer manifests regenerated with updated requires.
- `pnpm test:unit` - 40 files, 599 tests passed.
- `npx playwright test tests/e2e/gateway-artifact-parity.spec.ts tests/e2e/identity-flow.spec.ts tests/e2e/relay-subscribe.spec.ts tests/e2e/profile-open.spec.ts` - 6 Chromium tests passed.
- `pnpm lint` - command passed, but Turbo reported no lint tasks executed.

## Remaining Risk

- The browser proof emits NAP-01 from the feed frame directly rather than relying on live outbox feed content, because the live feed rows are identity and network dependent.
- Unknown-profile metadata depends on relay EOSE timing, so the profile viewer uses an 8-second UI timeout to avoid an indefinite loading state.
- `pnpm lint` is currently a no-op because no package lint tasks ran, so lint-specific coverage is not meaningful for this quick task.
