# @kehto/paja

## 0.6.0

### Minor Changes

- 8aa2123: Align read-style NAP event surfaces with `RelayEventResult`.

  Relay and outbox read results now carry raw events as `{ event, sidecar? }`,
  with observed relay URLs in `sidecar.relayHints`. Outbox subscriptions no
  longer expose `outbox.eose`; streams continue until `outbox.close` or
  `outbox.closed`.

### Patch Changes

- Updated dependencies [8aa2123]
  - @kehto/runtime@0.18.0
  - @kehto/services@0.15.0
  - @kehto/shell@0.16.2

## 0.5.1

### Patch Changes

- Accept the released NAP-COUNT-capable `@napplet/core` and `@napplet/nap`
  `0.25.x` line in published package metadata.

  The NAP-COUNT implementation was versioned before the matching napplet package
  release landed, so this patch updates peer/dev ranges and local package graph
  guards without changing Kehto runtime behavior.

- Updated dependencies
  - @kehto/acl@0.15.1
  - @kehto/firewall@0.3.6
  - @kehto/runtime@0.17.1
  - @kehto/services@0.14.1
  - @kehto/shell@0.16.1

## 0.5.0

### Minor Changes

- 7293d4d: Add NAP-COUNT support for the draft `count.query` domain.

  Kehto now routes `count.query` through a registered runtime count service,
  advertises `window.napplet.count` only when that service is wired, exposes a
  reference `createCountService()` helper, and lets Paja answer exact counts from
  its memory relay fixture store without returning event payloads.

### Patch Changes

- Updated dependencies [7293d4d]
  - @kehto/acl@0.15.0
  - @kehto/runtime@0.17.0
  - @kehto/shell@0.16.0
  - @kehto/services@0.14.0

## 0.4.0

### Minor Changes

- feb3176: Add a static Paja Runtime build for browser testing napplets from naddr or nevent pointers without dev-server HMR.

## 0.3.7

### Patch Changes

- c777d32: Show Paja message error details inline and add NIP-07 plus bunker signer controls for local authoring.

## 0.3.6

### Patch Changes

- f3b2cb5: Update managed-command mode to follow local dev servers that bind a different port than the configured target URL.
- c27d886: Add Paja's development console with supported-interface toggles, ACL controls, signer status, filterable message logs, and confirmation-gated signing/publishing.

## 0.3.5

### Patch Changes

- 91a2c01: Accept `@napplet/core` and `@napplet/nap` 0.24.x peer dependencies across compatible Kehto packages.
- Updated dependencies [91a2c01]
  - @kehto/acl@0.14.2
  - @kehto/runtime@0.16.1
  - @kehto/shell@0.15.2
  - @kehto/services@0.13.2
  - @kehto/firewall@0.3.5

## 0.3.4

### Patch Changes

- 968b286: Run global binary symlinks as CLIs and print the Paja runtime URL before managed target readiness waits.

## 0.3.3

### Patch Changes

- a07f3cd: Add a NIP-5D injected-domain namespace prelude helper for srcdoc hosts and
  align napplet package peer ranges with the inject-compatible release line.
- Updated dependencies [cd6e971]
- Updated dependencies [a07f3cd]
  - @kehto/acl@0.14.0
  - @kehto/runtime@0.16.0
  - @kehto/shell@0.15.0
  - @kehto/services@0.13.0
  - @kehto/firewall@0.3.4

## 0.3.2

### Patch Changes

- Updated dependencies [4ab6f12]
  - @kehto/runtime@0.15.0
  - @kehto/services@0.12.3
  - @kehto/shell@0.14.2

## 0.3.1

### Patch Changes

- 2dfdebb: Align Napplet dependency ranges with the `resource.bytesMany` package release.
- Updated dependencies [2dfdebb]
  - @kehto/acl@0.13.1
  - @kehto/firewall@0.3.3
  - @kehto/runtime@0.14.1
  - @kehto/services@0.12.1
  - @kehto/shell@0.14.1

## 0.3.0

### Minor Changes

- 272277a: Add NAP-WEBRTC runtime parity.

  The runtime now dispatches the `webrtc` domain, `@kehto/services` exports a reference service for shell-mediated WebRTC open/send/close sessions and host-pushed events, shell capabilities can advertise NAP-WEBRTC, and Paja/playground hosts register deterministic WebRTC support.

### Patch Changes

- 7dbbdf8: Add NAP-BLE runtime parity.

  The runtime now dispatches the `ble` domain, `@kehto/services` exports a reference service for shell-mediated BLE/GATT sessions, shell capabilities can advertise NAP-BLE, and Paja/playground hosts register deterministic BLE support.

- 7c7b019: Add NAP-COMMON runtime parity for the current `@napplet/nap` contract.

  The runtime now dispatches the `common` domain, `@kehto/services` exports a reference service for public NIP-19 helpers and shell-mediated common social actions, shell capabilities can advertise NAP-COMMON, and Paja/playground hosts register deterministic common support.

- 4e0f4b9: Add NAP-LINK runtime parity for the current `@napplet/nap` contract.

  The runtime now dispatches the `link` domain, `@kehto/services` exports a reference `link.open` service, shell capabilities can advertise NAP-LINK, and Paja/playground hosts register link support. Package peer ranges now track the current `@napplet` 0.20 line.

- 4fd5e37: Add NAP-LISTS runtime parity for the current `@napplet/nap` contract.

  The runtime now dispatches the `lists` domain, `@kehto/services` exports a reference service for supported list metadata and shell-mediated add/remove mutations, shell capabilities can advertise NAP-LISTS, and Paja/playground hosts register deterministic list support.

- b37337b: Add NAP-SERIAL runtime parity.

  The runtime now dispatches the `serial` domain, `@kehto/services` exports a reference service for shell-mediated serial open/write/close sessions, shell capabilities can advertise NAP-SERIAL, and Paja/playground hosts register deterministic serial support.

- cacab69: Pin internal `@kehto/*` dependencies to explicit caret version ranges instead of
  the `workspace:*` protocol, so published packages (npm and JSR) carry correct,
  resolvable dependency versions. The ranges mirror the existing `jsr.json` imports.
- Updated dependencies [7dbbdf8]
- Updated dependencies [7c7b019]
- Updated dependencies [4e0f4b9]
- Updated dependencies [4fd5e37]
- Updated dependencies [e1030d8]
- Updated dependencies [b37337b]
- Updated dependencies [272277a]
- Updated dependencies [cacab69]
  - @kehto/runtime@0.14.0
  - @kehto/services@0.12.0
  - @kehto/shell@0.14.0
  - @kehto/acl@0.13.0
  - @kehto/firewall@0.3.2

## 0.2.0

### Minor Changes

- 07a4733: Add the initial Paja single-window development runtime package and the top-level `kehto paja` CLI command with a typed option model, framework-agnostic target URL contract, real Kehto shell/service wiring, and configurable development environment simulation.

### Patch Changes

- Updated dependencies [0090b64]
- Updated dependencies [bdb15b6]
- Updated dependencies [07a4733]
  - @kehto/services@0.11.1
  - @kehto/nip@0.4.0
  - @kehto/shell@0.13.0
