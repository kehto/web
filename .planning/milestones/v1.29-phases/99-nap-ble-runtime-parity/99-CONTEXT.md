# Phase 99 Context: NAP-BLE Runtime Parity

## Milestone

v1.27 NAP-BLE Runtime Parity

## Scope

Implement exactly one missing recent `@napplet/nap` domain: `ble`.

Authoritative source inspected 2026-06-22:

- `@napplet/nap@0.20.0` packed npm tarball: `dist/ble/types.d.ts`, `dist/ble/sdk.d.ts`
- `@napplet/core@0.20.0` packed npm tarball: BLE core exports

## Contract Summary

Outbound messages:

- `ble.open` with `request`
- `ble.services` with `sessionId`
- `ble.read` with `sessionId` and `target`
- `ble.write` with `sessionId`, `target`, `data`, optional `options`
- `ble.subscribe` with `sessionId` and `target`
- `ble.unsubscribe` with `sessionId` and `target`
- `ble.close` with `sessionId` and optional `reason`

Inbound result messages:

- `ble.open.result` with `session` or `error`
- `ble.services.result` with `services` or `error`
- `ble.read.result` with `data` or `error`
- `ble.write.result`, `ble.subscribe.result`, `ble.unsubscribe.result`, `ble.close.result` with optional `error`
- `ble.event` for host-pushed state/notification/closed events

## Constraints

- One NAP per milestone. Do not implement `webrtc`.
- No new dependencies.
- BLE handles stay shell-owned. Napplets receive JSON sessions, attributes, bytes, and events only.
- Paja remains minimal UI.
- Playground coverage must use the real shell/runtime path and stable DOM sentinels.

## Verification Targets

- Focused unit tests for runtime dispatch, shell advertisement, and `createBleService`.
- Static guard updates for playground/NIP-5D raw result allowlist.
- Playwright coverage for `ble-demo`.
- Full gates before PR: build, type-check, unit, e2e, docs check if docs changed, AI-slop, diff check.
