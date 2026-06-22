# Requirements: v1.28 NAP-WEBRTC Runtime Parity

## Goal

Implement `NAP-WEBRTC` parity with current `@napplet/nap` without bundling unrelated changes into this milestone.

## Scope

Authoritative source inspected 2026-06-23:

- npm registry reports latest `@napplet/nap` as `0.20.0`
- local `napplet` checkout: `packages/nap/src/webrtc/types.ts`
- local `napplet` checkout: `packages/nap/src/webrtc/sdk.ts`
- local `napplet` checkout: `packages/core/src/types/webrtc.ts`

Missing domains still out of scope for this milestone:

- none known in current `@napplet/nap@0.20.0` after WebRTC closes

## Functional Requirements

### WEBRTC-01: Shell Capability Advertisement

Kehto advertises the `webrtc` domain in `shell.init` `domains` and `naps` only when the host wires a WebRTC backend. Disabled-domain simulation removes it from both fields.

### WEBRTC-02: Runtime Dispatch

The runtime dispatches `webrtc.*` envelopes through the same NAP-domain path as other service-backed domains. Unknown `webrtc.*` messages do not crash the runtime.

### WEBRTC-03: Reference Service

`@kehto/services` exports `createWebrtcService`. It handles every upstream `webrtc.*` request: `open`, `send`, and `close`. Host hooks return opened sessions, send/close acknowledgements, structured errors for unavailable actions, and can push `webrtc.event` messages to the requesting napplet.

### WEBRTC-04: Paja Wiring

`@kehto/paja` wires deterministic in-memory WebRTC behavior, advertises `webrtc`, removes it from deferred parity metadata, and exposes it through the single-window runtime without adding UI chrome.

### WEBRTC-05: Playground Demo

The playground includes a `webrtc-demo` napplet that exercises representative `webrtc.*` requests and a host-pushed `webrtc.event` through the real shell path, with stable DOM sentinels for Playwright.

### WEBRTC-06: Verification And Release Readiness

Focused unit/static tests and focused Playwright coverage pass. Full build, type-check, unit, e2e, docs check where affected, AI-slop gate, and diff check run before PR.

## Non-Goals

- Implementing real RTCPeerConnection / signaling servers in the reference service.
- Exposing SDP, ICE candidates, browser `RTCPeerConnection` objects, signing keys, relay sockets, browser NIP-07, or direct networking handles to napplets.
- Adding new package dependencies.
- Changing Paja's minimal two-bar chrome.
