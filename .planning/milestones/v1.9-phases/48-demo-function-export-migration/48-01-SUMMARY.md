---
phase: 48-demo-function-export-migration
plan: 01
status: completed
completed_at: 2026-05-22T09:52:20.080Z
requirements:
  - FUNC-03
  - FUNC-04
  - FUNC-05
---

# Phase 48 — Plan 01 Summary

## Result

Phase 48 removed the remaining active `@napplet/sdk` namespace imports from the 18 migrated demo/fixture source set and moved covered behavior to direct 0.3 helper functions.

## Changes Made

- Migrated relay helpers:
  - chat: `relayPublish`, `relaySubscribe`
  - composer: `relayPublish`, `relayPublishEncrypted`
  - feed: `relaySubscribe`
  - `nub-relay`: `relayPublish`, `relayPublishEncrypted`
- Migrated identity helpers:
  - composer, profile-viewer, theme-switcher, toaster, `nub-identity`: `identityGetPublicKey` / `identityGetProfile`
- Migrated keys/config/notify helpers:
  - hotkey-chord: `keysRegisterAction`, `keysOnAction`
  - config-demo: `configSubscribe`, `configGet` via aliased `@napplet/nub/config/sdk` imports
  - `nub-notify`: `notifySend`
  - toaster: `notifyDismiss` helper for dismiss; raw `notify.create` / `notify.list` retained for the documented demo service contract
- Added exact `@napplet/core: 0.3.0` to package manifests that now import core types directly.
- Cleaned media-controller comments so its helper surface is only `@napplet/nub/media/sdk`.
- Replaced resource-demo's stale unpublished-resource comments with a grepable `RESOURCE-SDK-GAP` note explaining the upstream `id`/`Blob` vs Kehto `requestId`/`bodyBase64` wire mismatch.

## Verification Evidence

- `rg "from '@napplet/sdk'|from \"@napplet/sdk\"" apps/playground/napplets tests/fixtures/napplets` → no matches.
- `rg "\b(relay|identity|keys|config|notify)\.(publish|publishEncrypted|subscribe|getPublicKey|getProfile|registerAction|onAction|send|get)\b" apps/playground/napplets tests/fixtures/napplets --glob 'src/**/*.ts'` → no matches.
- `rg "RESOURCE-SDK-GAP|NOTIFY-SDK-GAP" apps/playground/napplets/{resource-demo,toaster}/src/main.ts` → documents the two retained raw-envelope exceptions.
- `pnpm install` → exit 0; already up to date after direct `@napplet/core` manifest additions. Pre-existing optional `@emnapi/*` peer warning remains under `apps/playground -> unocss -> oxc-parser`.
- Targeted build command passed:
  `pnpm --filter @kehto/demo-chat --filter @kehto/demo-composer --filter @kehto/demo-config-demo --filter @kehto/demo-feed --filter @kehto/demo-hotkey-chord --filter @kehto/demo-media-controller --filter @kehto/demo-profile-viewer --filter @kehto/demo-resource-demo --filter @kehto/demo-theme-switcher --filter @kehto/demo-toaster --filter @kehto/fixture-nub-identity --filter @kehto/fixture-nub-notify --filter @kehto/fixture-nub-relay build`

## Requirement Status

- FUNC-03: complete
- FUNC-04: complete
- FUNC-05: complete

## Notes

Toaster create/list and resource-demo raw resource envelopes remain intentionally raw because the published helper surfaces do not cover the behavior under Kehto's current service contracts. Both exceptions are now grepable by `NOTIFY-SDK-GAP` / `RESOURCE-SDK-GAP`.
