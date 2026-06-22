# Requirements: v1.26 NAP-SERIAL Runtime Parity

## Goal

Implement `NAP-SERIAL` parity with current `@napplet/nap` without bundling other missing NAP domains into this milestone.

## Scope

Authoritative source inspected 2026-06-22:

- packed npm tarball `@napplet/nap@0.20.0`, `dist/serial/types.d.ts`
- packed npm tarball `@napplet/nap@0.20.0`, `dist/serial/sdk.d.ts`
- packed npm tarball `@napplet/core@0.20.0`, serial core exports

Missing domains still out of scope for this milestone:

- `ble`
- `webrtc`

## Functional Requirements

### SERIAL-01: Shell Capability Advertisement

Kehto advertises the `serial` domain in `shell.init` `domains` and `naps` only when the host wires a serial backend. Disabled-domain simulation removes it from both fields.

### SERIAL-02: Runtime Dispatch

The runtime dispatches `serial.*` envelopes through the same NAP-domain path as other service-backed domains. Unknown `serial.*` messages do not crash the runtime.

### SERIAL-03: Reference Service

`@kehto/services` exports `createSerialService`. It handles every upstream `serial.*` request: `open`, `write`, and `close`. Host hooks return opened sessions, write acknowledgements, close acknowledgements, and optional pushed `serial.event` notifications; missing hooks return structured error results without throwing.

### SERIAL-04: Paja Wiring

`@kehto/paja` wires deterministic in-memory serial behavior, advertises `serial`, includes it in parity metadata, and exposes it through the single-window runtime without adding UI chrome.

### SERIAL-05: Playground Demo

The playground includes a `serial-demo` napplet that exercises representative `serial.*` requests through the real shell path and displays stable DOM sentinels for Playwright.

### SERIAL-06: Verification And Release Readiness

Focused unit/static tests and focused Playwright coverage pass. Full build, type-check, unit, e2e, docs check where affected, AI-slop gate, and diff check run before PR.

## Non-Goals

- Implementing `NAP-BLE` or `NAP-WEBRTC`.
- Exposing browser `SerialPort` objects, OS device paths, raw native handles, signing keys, relay sockets, browser NIP-07, or direct hardware handles to napplets.
- Adding new package dependencies.
- Changing Paja's minimal two-bar chrome.
