# Phase 74 Plan 01 Summary: Playground Shell Decomposition

**Completed:** 2026-05-24
**Status:** Complete

## Result

Phase 74 removed the playground shell structural warnings from the local `aislop` gate without changing scanner policy or playground protocol behavior.

## Changes

- Split `apps/playground/src/shell-host.ts` into focused playground-local modules:
  - `demo-decrypt.ts` for decrypt fixture construction and bridge call tracking.
  - `demo-definitions.ts` for static demo napplet definitions, protocol path metadata, and host audit summary data.
  - `message-tap.ts` for tap message parsing, inbound/outbound recording, and tap listeners.
  - `demo-hooks.ts` for demo service hooks, shell capabilities, service bundles, ACL checks, and demo service accessors.
- Reduced `shell-host.ts` to shell orchestration, compatibility re-exports, napplet loading, tap installation, identity binding, grant hooks, and demo control APIs.
- Split `apps/playground/src/main.ts` by extracting:
  - `main-notifications.ts` for notification node controls, toast/list rendering, notification inspector actions, and NIP-66 suggestion polling.
  - `main-signer.ts` for signer topology rendering, signer modal initialization, connect/disconnect/test-sign click handling, and signer state display.
- Preserved `main.ts` as the Vite entrypoint that wires boot, topology, debugger, color mode, connect grants, napplet loading, node summaries, ACL panels, and test hooks.

## Scanner Outcome

`npx --no-install aislop scan -d` now reports:

- `86 / 100 Healthy`
- 0 errors
- 6 warnings
- 0 fixable
- AI Slop, Linting, Security, and Formatting all clean

The remaining warnings are Phase 75 scope:

- `apps/playground/src/acl-modal.ts` `openPolicyModal`
- `apps/playground/src/nip46-client.ts` `createNip46Client`
- `packages/services/src/media-service.ts` `createMediaService`
- `packages/services/src/notification-service.ts` `createNotificationService`
- `packages/services/src/resource-service.ts` `createResourceService`
- `packages/shell/src/hooks-adapter.ts` `adaptHooks`

## Requirements Closed

- PLAY-01: `apps/playground/src/main.ts` no longer triggers the file-size warning.
- PLAY-02: `apps/playground/src/shell-host.ts` no longer triggers the file-size warning.
- PLAY-03: `createDemoHooks` no longer triggers the function-length warning.
- PLAY-04: `bootShell` no longer triggers function-length or deep-nesting warnings.

## Verification

- `pnpm type-check`
- `pnpm --filter @kehto/playground build`
- `npx --no-install aislop scan -d`
- `git diff --check`

