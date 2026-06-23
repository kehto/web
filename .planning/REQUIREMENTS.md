# Requirements: v1.27 NAP-BLE Runtime Parity

## Goal

Implement `NAP-BLE` parity with current `@napplet/nap` without bundling other missing NAP domains into this milestone.

## Scope

Authoritative source inspected 2026-06-22:

- packed npm tarball `@napplet/nap@0.20.0`, `dist/ble/types.d.ts`
- packed npm tarball `@napplet/nap@0.20.0`, `dist/ble/sdk.d.ts`
- packed npm tarball `@napplet/core@0.20.0`, BLE core exports

Missing domains still out of scope for this milestone:

- `webrtc`

## Functional Requirements

### BLE-01: Shell Capability Advertisement

Kehto advertises the `ble` domain in `shell.init` `domains` and `naps` only when the host wires a BLE backend. Disabled-domain simulation removes it from both fields.

### BLE-02: Runtime Dispatch

The runtime dispatches `ble.*` envelopes through the same NAP-domain path as other service-backed domains. Unknown `ble.*` messages do not crash the runtime.

### BLE-03: Reference Service

`@kehto/services` exports `createBleService`. It handles every upstream `ble.*` request: `open`, `services`, `read`, `write`, `subscribe`, `unsubscribe`, and `close`. Host hooks return opened sessions, service lists, byte reads, write/subscription/close acknowledgements, and structured errors for unavailable actions.

### BLE-04: Paja Wiring

`@kehto/paja` wires deterministic in-memory BLE behavior, advertises `ble`, includes it in parity metadata, and exposes it through the single-window runtime without adding UI chrome.

### BLE-05: Playground Demo

The playground includes a `ble-demo` napplet that exercises representative `ble.*` requests through the real shell path and displays stable DOM sentinels for Playwright.

### BLE-06: Verification And Release Readiness

Focused unit/static tests and focused Playwright coverage pass. Full build, type-check, unit, e2e, docs check where affected, AI-slop gate, and diff check run before PR.

## Non-Goals

- Implementing `NAP-WEBRTC`.
- Exposing browser `BluetoothDevice` objects, OS device paths, raw native handles, signing keys, relay sockets, browser NIP-07, or direct hardware handles to napplets.
- Adding new package dependencies.
- Changing Paja's minimal two-bar chrome.
