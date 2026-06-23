# Requirements: v1.25 NAP-LISTS Runtime Parity

## Goal

Implement `NAP-LISTS` parity with current `@napplet/nap` without bundling other missing NAP domains into this milestone.

## Scope

Authoritative source inspected 2026-06-22:

- `/home/sandwich/Develop/napplet/packages/nap/src/lists`
- `/home/sandwich/Develop/napplet/packages/core/src/types/lists.ts`
- `/home/sandwich/Develop/napplet/packages/nap/package.json` version `0.20.0`

Missing domains still out of scope for this milestone:

- `ble`
- `webrtc`
- `serial`

## Functional Requirements

### LISTS-01: Shell Capability Advertisement

Kehto advertises the `lists` domain in `shell.init` `domains` and `naps` only when the host wires a lists backend. Disabled-domain simulation removes it from both fields.

### LISTS-02: Runtime Dispatch

The runtime dispatches `lists.*` envelopes through the same NAP-domain path as other service-backed domains. Unknown `lists.*` messages do not crash the runtime.

### LISTS-03: Reference Service

`@kehto/services` exports `createListsService`. It handles every upstream `lists.*` request: `supported`, `add`, and `remove`. Host hooks return `ListSupport[]` and `ListMutationResult`; missing hooks return structured `ok: false` / `unsupported` results without throwing.

### LISTS-04: Paja Wiring

`@kehto/paja` wires deterministic lists behavior, advertises `lists`, includes it in parity metadata, and exposes it through the single-window runtime without adding UI chrome.

### LISTS-05: Playground Demo

The playground includes a `lists-demo` napplet that exercises representative `lists.*` requests through the real shell path and displays stable DOM sentinels for Playwright.

### LISTS-06: Verification And Release Readiness

Focused unit/static tests and focused Playwright coverage pass. Full build, type-check, unit, e2e, docs check where affected, AI-slop gate, and diff check run before PR.

## Non-Goals

- Implementing `NAP-BLE`, `NAP-WEBRTC`, or `NAP-SERIAL`.
- Exposing signing keys, relay sockets, browser NIP-07, or direct publish access to napplets.
- Adding new package dependencies.
- Changing Paja's minimal two-bar chrome.
