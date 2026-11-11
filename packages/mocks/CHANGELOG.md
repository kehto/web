# @kehto/mocks

## 0.1.3

### Patch Changes

- 11ae71c: Adopt @napplet/core 0.41.x and @napplet/nap 0.40.x, which export the current NAP-INTENT no-ID, string-sender delivery. `@kehto/services` now re-exports its intent types from `@napplet/core` instead of keeping a local copy. Because core releases before 0.41.0 carry the withdrawn delivery ID and nullable sender, `@kehto/services`, `@kehto/paja` and `@kehto/cli` now require `@napplet/core` >=0.41.0. Other packages widen their peer windows to core <0.42.0 and nap <0.41.0 and move development builds and JSR maps to the new line. The shell's injected intent receiver now drops deliveries with an empty sender, matching the nap 0.40 binding.
- Updated dependencies [11ae71c]
  - @kehto/acl@0.20.5
  - @kehto/runtime@0.29.2

## 0.1.2

### Patch Changes

- f4e7e8a: Accept @napplet/core 0.40.x and @napplet/nap 0.39.x throughout the Paja host dependency graph and update host development dependencies and JSR maps to that line. Keep existing peer floors. Account for the newly packaged blossom, catalog, navigation, soulseek and torrent domains without advertising unimplemented host backends.
- Updated dependencies [f4e7e8a]
  - @kehto/acl@0.20.4
  - @kehto/runtime@0.29.1

## 0.1.1

### Patch Changes

- 249fe8c: The relay mock now implements the runtime's planned-execution relay contract (`planRelayOperation` / `executeRelayOperation`) with local-only plans, so the Firewall approval runtime routes relay traffic to it instead of denying it as a legacy relay service.
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
  - @kehto/runtime@0.29.0

## 0.1.0

### Minor Changes

- 0379d16: Introduce `@kehto/mocks`: deterministic, in-memory mock services for every
  napplet NAP domain — merged (`identity`, `inc`, `intent`, `shell`, `theme`) and
  every open `napplet/naps` draft (relay, storage, keys, media, notify, config,
  connect, class, value, cvm, outbox, upload, pow, link, webrtc, serial, ble,
  system, common, lists, count, blossom, torrent, hashtree, dm, resource, fs,
  capture, catalog, display, worker, mesh, motion, location, navigation, gamepad,
  llm, soulseek, nzb, git).

  Each mock is a plain `ServiceHandler` built with `defineMockService`, exposing
  `service.mock` controls (`state()`, `reset()`, `sent`, `routes`) and
  domain-specific controls for pushes and progress. `createMockNapServices()`
  instantiates the whole registry for `ShellAdapter.services`;
  `MOCK_NAP_REGISTRY` records the exact `napplet/naps` ref each mock was written
  against, and `scripts/audit-naps.mjs` reports upstream drift. Transfer-oriented
  mocks (torrent, nzb, soulseek, resource, upload, fs, blossom, hashtree, git) use
  a Linux distribution image catalog as their subject.

  Mocks deliver through the real runtime: extension mocks declare their
  out-of-request pushes as `pushCapabilities` (`defineMockService({ pushes })`),
  `pushToWindow` returns the runtime's delivery verdict and records only delivered
  envelopes, and the relay mock owns fan-out through each subscription's own
  runtime `send` (publisher echo, relay scope) via `pushThrough`.

### Patch Changes

- 4dcd77c: Admit the host Napplet core 0.38 and nap 0.37 releases in peer dependencies
  and JSR imports, and use those releases for development and tests.
- Updated dependencies [0379d16]
  - @kehto/runtime@0.28.1
