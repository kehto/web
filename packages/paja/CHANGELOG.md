# @kehto/paja

## 0.15.2

### Patch Changes

- e5ff746: Permit verified WebAssembly napplets to compile under Paja's runtime-pointer CSP while keeping JavaScript string evaluation blocked.

## 0.15.1

### Patch Changes

- d6a1ecd: Keep Paja ACL controls synchronized with the active resolver-verified napplet identity, and return denied outbox queries through the canonical `outbox.query.result` error shape.
- Updated dependencies [d6a1ecd]
  - @kehto/runtime@0.22.2

## 0.15.0

### Minor Changes

- c8264c6: Forward optional signer caller context through the policy-neutral runtime and
  shell hooks. Add Paja's signer-, napplet-, and target-scoped remembered signing
  choices: one event, one event kind, or warned napplet trust, with explicit
  revocation. Relay publication and host-internal signing confirmations remain
  independent.

### Patch Changes

- b2449e4: Keep NAP resource resolution runtime-owned: the service kernel delegates valid
  URLs by default while retaining optional origin-grant hooks, and Paja permits
  browser-readable HTTP(S) resources alongside data and configured Blossom URLs.
- Updated dependencies [c8264c6]
- Updated dependencies [b2449e4]
  - @kehto/runtime@0.22.1
  - @kehto/shell@0.20.1
  - @kehto/services@0.20.1

## 0.14.0

### Minor Changes

- 8e09918: Allow the static GitHub Pages Paja runtime to be built with explicit live relay and Blossom upload backends. `build-paja-pages.mjs` now honors comma-separated `PAJA_RELAY_URLS` and `PAJA_UPLOAD_SERVERS` environment variables, and `createPajaRuntimeHostConfig` accepts a `simulation` override. When neither env var is set, the static build keeps its previous defaults.

## 0.13.0

### Minor Changes

- 65c53be: Support canonical `blossom:sha256:<hex>` NAP-RESOURCE requests through Paja's host-configured Blossom servers with response caps, MIME sniffing, redirect refusal, and SHA-256 verification.

## 0.12.0

### Minor Changes

- d237979: Complete Paja's advertised NAP adapters with real host backends, including
  NIP-17 direct messages over live relays and an identity-scoped OPFS filesystem.
  Replace native confirmation prompts with serialized in-page consent and make
  notification, device, DM, and filesystem services fail closed when their host
  boundary is unavailable. NAP-DM error results now use the draft's exclusive
  error branch and no longer include legacy success fields such as empty page
  arrays or `ok: false`.

### Patch Changes

- Updated dependencies [d237979]
  - @kehto/services@0.20.0
  - @kehto/acl@0.18.0
  - @kehto/runtime@0.22.0
  - @kehto/shell@0.20.0

## 0.11.0

### Minor Changes

- a8cc3cf: Add Paja's incrementally warmed, active-account-scoped social cache behind standard identity and OUTBOX services, with request-scoped capability checks that prevent OUTBOX-only callers from observing private follow-derived cache entries.

### Patch Changes

- Updated dependencies [a8cc3cf]
  - @kehto/runtime@0.21.0
  - @kehto/services@0.19.0
  - @kehto/shell@0.19.2

## 0.10.0

### Minor Changes

- 9390eca: Move the public Kehto compatibility line to the current Napplet packages and
  align the host implementation with the merged NAP-INC and NAP-INTENT contracts.

### Patch Changes

- Updated dependencies [9390eca]
  - @kehto/acl@0.17.0
  - @kehto/firewall@0.5.0
  - @kehto/nip@0.5.0
  - @kehto/runtime@0.20.0
  - @kehto/services@0.18.0
  - @kehto/shell@0.19.0

## 0.9.0

### Minor Changes

- a1fa730: Route Paja theme updates through ThemeService state-before-single-push integration, preserving the protected recipient-authorized NAP-THEME change path defined by web draft `896c32c92deee68dc4d10fc1132b62df20cccb6f`.
- d8a57e2: Raise the published Napplet compatibility floor to core/nap 0.29.0. This is a
  breaking 0.x change: all affected packages now require the verified
  `>=0.29.0 <0.30.0` peer line. Services publish canonical intent ownership and
  retained acceptance-before-delivery behavior; Paja publishes the corresponding
  host flow. Shell is included because its published peer manifest changed while
  Kehto retains the host-owned mandatory NAP-SHELL prelude for the released
  core/shim omission; this changeset does not publish packages locally.
  Runtime and services also complete the NAP-RELAY publish boundary: the shell
  signs event templates, relay backends receive the signed event, and successful
  results return the full event through canonical `ok` / `event` / `eventId`
  fields. Async relay settlement now precedes success, rejected publishes never
  enter host caches, and failed pending replay reservations are released for
  deterministic retry while concurrent duplicates remain blocked. Paja likewise
  retains and fans out an event only after user authorization and, in live mode,
  at least one relay acknowledgement; its scoped-relay hook also preserves the
  asynchronous result and reports denial or transport failure as false.
  Shell keeps the merged NAP-INC `IncEvent` callback contract; package-based demo
  consumers bridge the released 0.29.0 `(payload, NostrEvent)` projection as
  documented upstream drift.

### Patch Changes

- Updated dependencies [7712950]
- Updated dependencies [7712950]
- Updated dependencies [7712950]
- Updated dependencies [7712950]
- Updated dependencies [a1fa730]
- Updated dependencies [a1fa730]
- Updated dependencies [a1fa730]
- Updated dependencies [a1fa730]
- Updated dependencies [d8a57e2]
  - @kehto/acl@0.16.0
  - @kehto/runtime@0.19.0
  - @kehto/services@0.17.0
  - @kehto/shell@0.18.0
  - @kehto/firewall@0.4.0

## 0.8.2

### Patch Changes

- d3d966a: Harden verified runtime-pointer `srcdoc` documents with Kehto's complete
  Class-1 CSP before the host-owned NIP-5D namespace prelude.
- 19e532a: Diagnose dev servers that block the sandboxed napplet frame. The target iframe is sandboxed without `allow-same-origin`, so the napplet requests its own module scripts with `Origin: null`, which Vite's default `server.cors` allowlist rejects — the frame rendered blank with no signal from Paja. Paja now probes the target through `GET /__kehto/target-cors.json` and reports a `paja.target.cors.error` message-log entry plus a console warning naming the fix. Adds `probeTargetCors`, `classifyTargetCors`, and `PAJA_TARGET_CORS_HINT` exports.
- Updated dependencies [418d22b]
  - @kehto/firewall@0.3.10

## 0.8.1

### Patch Changes

- 8ba8e30: Resolve runtime pointers against Paja's enabled configured live relays after embedded pointer hints, with one bounded deadline and distinct relay failure diagnostics.

## 0.8.0

### Minor Changes

- d4c7da3: Add an opt-in real Blossom upload mode to Paja with shell-owned server policy,
  signer identity checks, upload consent, cache-only BUD-03 discovery, and browser
  proof that the disclosed bytes reached the server. Harden the shared HTTP
  uploader so progress and cancellation are observable and Blossom completion
  requires exact server-confirmed hash and size metadata.

### Patch Changes

- Updated dependencies [bc53f2d]
- Updated dependencies [d4c7da3]
  - @kehto/services@0.16.5

## 0.7.1

### Patch Changes

- fd5faac: Inject mandatory NAP-SHELL across hosted iframe paths, complete its local handshake API, and require Paja readiness to come from `shell.ready`.
- Updated dependencies [fd5faac]
  - @kehto/shell@0.17.2

## 0.7.0

### Minor Changes

- 96130bc: Add static Paja runtime tab share links and restore pointer-loaded tabs across browser sessions.

## 0.6.8

### Patch Changes

- 708176b: Chase the published `@napplet/core` and `@napplet/nap` 0.28 line. Kehto package
  peer and JSR metadata now admit the current NAP contract, local demo napplets
  build against the refreshed Napplet toolchain, and `@kehto/services` implements
  the current NAP-OUTBOX publish fanout fields: `relays`, `toOutbox`, and required
  `toInboxes`. `@kehto/paja` also clears stale iframe ownership during target
  reloads so late messages from an old frame cannot mark the runtime ready before
  the reloaded target receives signer-backed identity.
- 784687c: Ignore stale single-frame iframe messages during reloads and make local server shutdown deterministic for browser tests.
- Updated dependencies [708176b]
  - @kehto/acl@0.15.6
  - @kehto/firewall@0.3.9
  - @kehto/runtime@0.18.5
  - @kehto/services@0.16.4
  - @kehto/shell@0.17.1

## 0.6.7

### Patch Changes

- 7118c31: Make the static Paja Runtime useful for loading multiple pointer-resolved
  napplets by adding closeable runtime tabs and a duplicate-load choice dialog.
  Paja now defaults to a real live relay/outbox backend, bootstraps NIP-65 relay
  lists and kind 3 contact lists for account-backed napplet tests, and only uses
  the generated development signer when explicitly selected.

## 0.6.6

### Patch Changes

- Updated dependencies [a6a0821]
  - @kehto/runtime@0.18.4
  - @kehto/services@0.16.3
  - @kehto/shell@0.17.0

## 0.6.5

### Patch Changes

- 3d14dd7: Improve JSR package scoring metadata by adding entrypoint module docs, public API docs, and explicit public export types without changing runtime behavior.
- Updated dependencies [3d14dd7]
  - @kehto/acl@0.15.5
  - @kehto/nip@0.4.2
  - @kehto/services@0.16.2
  - @kehto/shell@0.16.8
  - @kehto/wm@0.0.2

## 0.6.4

### Patch Changes

- 484630b: Render Paja target-url documents as injected srcdoc so local napplet previews receive runtime-owned window.napplet domains before app bootstrap.

## 0.6.3

### Patch Changes

- 0dbdfe2: Raise the supported `@napplet/core` and `@napplet/nap` peer range through the
  published `0.27.x` line and refresh local demo/fixture napplet package pins.
- Updated dependencies [0dbdfe2]
  - @kehto/acl@0.15.4
  - @kehto/firewall@0.3.8
  - @kehto/runtime@0.18.2
  - @kehto/services@0.16.1
  - @kehto/shell@0.16.4

## 0.6.2

### Patch Changes

- e8cedd0: Resolve Paja runtime pointers against the NIP-5D napplet manifest kinds `5129`, `15129`, and `35129` instead of accepting only the named/addressable manifest kind.
- Updated dependencies [449bede]
  - @kehto/services@0.16.0
  - @kehto/acl@0.15.3

## 0.6.1

### Patch Changes

- 89f4c11: Express peer and development dependency upper bounds with inclusive maximum ranges for clearer supported-version metadata, including the current Napplet 0.26 line.
- Updated dependencies [89f4c11]
  - @kehto/acl@0.15.2
  - @kehto/firewall@0.3.7
  - @kehto/nip@0.4.1
  - @kehto/runtime@0.18.1
  - @kehto/services@0.15.1
  - @kehto/shell@0.16.3

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
