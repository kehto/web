# Plan Check: 99-01 NAP-BLE Runtime Parity

## Verdict

Approved.

## Checks

- Scope is one NAP only: `ble`.
- Contract source is current packed `@napplet/nap@0.20.0` and `@napplet/core@0.20.0`.
- No new dependencies required.
- Shell-owned BLE session boundary preserves host control over device handles.
- Verification covers unit, static, playground Playwright, docs, changeset, and full repo gates.

## Risk Notes

- BLE event push is part of the upstream contract, but this milestone can prove request/result paths and keep host-pushed `ble.event` available through normal service send behavior without adding a browser BLE stack.
- Raw postMessage listener in `ble-demo` must be explicitly allowlisted in the NIP-5D conformance policy, matching prior shell-owned result demo patterns.
