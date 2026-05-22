---
phase: 58-playground-napplet-contract-conformance
plan: 01
status: completed
completed: 2026-05-22
requirements:
  - REQUIRES-02
  - REQUIRES-03
  - RAW-01
  - RAW-02
  - NAPPLET-01
  - NAPPLET-02
  - NAPPLET-03
  - NAPPLET-04
---

# Phase 58 Summary: Playground Napplet Contract Conformance

## Completed

- Added explicit short-name `requires` declarations to all 13 playground napplet `vite.config.ts` files.
- Added per-napplet source preflight checks using hosted `window.napplet.shell.supports()` before each napplet exercises its declared NUB surface.
- Removed identity-only readiness probes from composer, theme-switcher, and toaster.
- Renamed active protocol identity/readiness wording from auth/authenticated to `identity-bound`, `ready`, `unavailable`, or domain-specific states.
- Documented the remaining raw demo envelopes in the Phase 58 policy allowlist:
  - `demo.publishTheme`
  - `demo.decrypt.fixtures`
  - `notify.create`
  - `notify.list`
  - `resource.bytes`
  - `theme.changed`
- Updated playground shell/debugger path labels so NIP-5D shell binding is classified as `identity-bind`, while literal NIP-01 `AUTH` remains only a legacy relay/debugger verb.
- Updated Layer-A fixture wording that used `authenticated` as a readiness sentinel.

## Capability Matrix

| Napplet | Requires |
|---------|----------|
| `bot` | `ifc`, `storage` |
| `chat` | `ifc`, `storage`, `relay` |
| `composer` | `relay` |
| `config-demo` | `config` |
| `decrypt-demo` | `identity` |
| `feed` | `relay` |
| `hotkey-chord` | `keys` |
| `media-controller` | `media` |
| `preferences` | `storage`, `theme` |
| `profile-viewer` | `identity` |
| `resource-demo` | `resource`, `connect` |
| `theme-switcher` | `theme` |
| `toaster` | `notify` |

## Notes

- `connect` remains an official Kehto NUB extension for `resource-demo`.
- Raw demo envelopes are intentionally retained only where SDK/helper parity is not yet available or where the demo itself is the surface under test.
- Full drift guards and complete build/CSP/artifact/E2E verification are Phase 59 work.
