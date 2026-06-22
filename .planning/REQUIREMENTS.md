# Requirements: v1.23 NAP-LINK Runtime Parity

## Goal

Implement `NAP-LINK` parity with current `@napplet/nap` without bundling other missing NAP domains into this milestone.

## Scope

Authoritative source inspected 2026-06-22:

- `/home/sandwich/Develop/napplet/packages/nap/src/link`
- `/home/sandwich/Develop/napplet/packages/nap/package.json` version `0.20.0`

Missing domains still out of scope for this milestone:

- `common`
- `lists`
- `ble`
- `webrtc`
- `serial`

## Functional Requirements

### LINK-01: Shell Capability Advertisement

Kehto advertises the `link` domain in `shell.init` `domains` and `naps` only when the host wires a link backend. Disabled-domain simulation removes it from both fields.

### LINK-02: Runtime Dispatch

The runtime dispatches `link.*` envelopes through the same NAP-domain path as other service-backed domains. Unknown `link.*` messages do not crash the runtime.

### LINK-03: Reference Service

`@kehto/services` exports `createLinkService`. It handles `link.open` and returns `link.open.result` with `status: "opened"` or `status: "denied"`. URL validation is deterministic and rejects malformed URLs and unsafe schemes before host navigation.

### LINK-04: Paja Wiring

`@kehto/paja` wires a deterministic link backend, advertises `link`, includes it in parity metadata, and exposes it through the single-window runtime without adding UI chrome.

### LINK-05: Playground Demo

The playground includes a `link-demo` napplet that imports `@napplet/nap/link`, exercises an allowed URL and a denied URL, and displays stable DOM sentinels for Playwright.

### LINK-06: Verification And Release Readiness

Focused unit/static tests and focused Playwright coverage pass. Full build, type-check, unit, e2e, docs check where affected, AI-slop gate, and diff check run before PR.

## Non-Goals

- Implementing `NAP-COMMON`, `NAP-LISTS`, `NAP-BLE`, `NAP-WEBRTC`, or `NAP-SERIAL`.
- Opening links directly from napplet code or exposing opener access.
- Adding new package dependencies.
- Changing Paja's minimal two-bar chrome.
