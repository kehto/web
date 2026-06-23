# Requirements: v1.24 NAP-COMMON Runtime Parity

## Goal

Implement `NAP-COMMON` parity with current `@napplet/nap` without bundling other missing NAP domains into this milestone.

## Scope

Authoritative source inspected 2026-06-22:

- `/home/sandwich/Develop/napplet/packages/nap/src/common`
- `/home/sandwich/Develop/napplet/packages/nap/package.json` version `0.20.0`

Missing domains still out of scope for this milestone:

- `lists`
- `ble`
- `webrtc`
- `serial`

## Functional Requirements

### COMMON-01: Shell Capability Advertisement

Kehto advertises the `common` domain in `shell.init` `domains` and `naps` only when the host wires a common backend. Disabled-domain simulation removes it from both fields.

### COMMON-02: Runtime Dispatch

The runtime dispatches `common.*` envelopes through the same NAP-domain path as other service-backed domains. Unknown `common.*` messages do not crash the runtime.

### COMMON-03: Reference Service

`@kehto/services` exports `createCommonService`. It handles every upstream `common.*` request: `encodeNip19`, `decodeNip19`, `getProfile`, `follows`, `follow`, `unfollow`, `react`, and `report`. Public NIP-19 helpers are deterministic; profile/social actions delegate to host hooks or return structured `ok: false` results without throwing.

### COMMON-04: Paja Wiring

`@kehto/paja` wires deterministic common behavior, advertises `common`, includes it in parity metadata, and exposes it through the single-window runtime without adding UI chrome.

### COMMON-05: Playground Demo

The playground includes a `common-demo` napplet that exercises representative `common.*` requests through the real shell path and displays stable DOM sentinels for Playwright.

### COMMON-06: Verification And Release Readiness

Focused unit/static tests and focused Playwright coverage pass. Full build, type-check, unit, e2e, docs check where affected, AI-slop gate, and diff check run before PR.

## Non-Goals

- Implementing `NAP-LISTS`, `NAP-BLE`, `NAP-WEBRTC`, or `NAP-SERIAL`.
- Exposing signing keys, relay sockets, browser NIP-07, or direct publish access to napplets.
- Adding new package dependencies.
- Changing Paja's minimal two-bar chrome.
