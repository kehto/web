# Phase 100 Context: NAP-WEBRTC Runtime Parity

## Milestone

v1.28 NAP-WEBRTC Runtime Parity

## Scope

Implement exactly one missing recent `@napplet/nap` domain: `webrtc`.

Authoritative source inspected 2026-06-23:

- npm registry latest `@napplet/nap`: `0.20.0`
- local `napplet` checkout: `packages/nap/src/webrtc/types.ts`
- local `napplet` checkout: `packages/nap/src/webrtc/sdk.ts`
- local `napplet` checkout: `packages/core/src/types/webrtc.ts`

## Contract Summary

Outbound messages:

- `webrtc.open` with `request`
- `webrtc.send` with `sessionId` and opaque `payload`
- `webrtc.close` with `sessionId` and optional `reason`

Inbound result/event messages:

- `webrtc.open.result` with `session` or `error`
- `webrtc.send.result` with optional `error`
- `webrtc.close.result` with optional `error`
- `webrtc.event` with a host-pushed `state`, `peer`, `message`, or `closed` event

## Constraints

- One NAP per milestone. Do not include unrelated NAP work.
- No new dependencies.
- WebRTC handles stay shell-owned. Napplets receive JSON sessions, payloads, and events only.
- Reference services do not create real RTCPeerConnection instances.
- Paja remains minimal UI.
- Playground coverage must use the real shell/runtime path and stable DOM sentinels.

## Verification Targets

- Focused unit tests for runtime dispatch, shell advertisement, and `createWebrtcService`.
- Static guard updates for playground/NIP-5D raw result allowlist.
- Playwright coverage for `webrtc-demo`.
- Full gates before PR: build, type-check, unit, e2e, docs check if docs changed, AI-slop, diff check.
