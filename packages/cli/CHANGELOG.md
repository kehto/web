# @kehto/cli

## 0.8.2

### Patch Changes

- Updated dependencies [3181ac1]
- Updated dependencies [3181ac1]
  - @kehto/paja@0.40.0

## 0.8.1

### Patch Changes

- Updated dependencies [8095c0b]
  - @kehto/paja@0.39.0
  - @kehto/conformance@0.1.1

## 0.8.0

### Minor Changes

- 6ff7938: Add `@kehto/conformance`, a runtime conformance suite that runs a reference probe napplet against the real Kehto runtime and shell, and route `kehto conformance` to it. This first slice covers NIP-5D core (sandbox, provenance, injection order and scope, `window.nostr`, port privacy and binding, source binding, manifest declarations, unknown and malformed envelopes, readiness independence), Kehto's strict required-domain preflight, and optional NAP-SHELL, across shell-present and shell-absent variants of the `minimal` and `full` profiles, with `pretty`, `json` and `junit` reporters. `kehto conformance` exits `0`, `1` or `2` and needs the optional `@playwright/test` peer.
- affae5e: Take the NAP-CVM registry types from `@napplet/core` 0.42.0 and retire Kehto's local copies (kehto/web#441). Checked against NAP-CVM PR #31 at `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f`.

  - `@kehto/services` re-exports `CvmRegistrySelector`, `CvmRegistryEntry`, `CvmRegistryTool` and `CvmRegistryCallOptions` from core under the same names, and adds `CvmRegistryOptions` and `CvmRegistryQuery`. `CvmRegistrySelector` is now core's union, so an empty `{}` selector no longer type-checks (the runtime already rejected it). `CvmRegistryFamily` stays Kehto's host configuration type.
  - `@kehto/mocks`: `MockCvmRegistryEntry` extends core's `CvmRegistryEntry`.
  - Breaking peer change: `@kehto/services`, `@kehto/mocks`, `@kehto/paja` and `@kehto/cli` now need `@napplet/core` `>=0.42.0 <0.43.0`. Install `@napplet/core@^0.42.0` (and `@napplet/nap@^0.41.0` if you want the matching bindings) when upgrading.
  - All host packages admit `@napplet/core` 0.42.x and `@napplet/nap` 0.41.x; `@kehto/acl`, `@kehto/firewall`, `@kehto/runtime` and `@kehto/shell` keep their existing floors.
  - The injected string-family adapter and its `KEHTO_CVM_FAMILY_SELECTOR` warning are unchanged. `@napplet/nap` 0.41.0 does not translate string-family calls, so napplets built against older bindings still rely on it.

### Patch Changes

- 5146f60: Move the host line to `@napplet/core` 0.44.0 / `@napplet/nap` 0.43.0 (kehto/web#496). Checked NAP-MEDIA PR #10 at `7806f438530251fce5129f8e6239d6b642278759`, NAP-WEBRTC PR #59 at `fb4dd6f0e6294e1837733d2af61931e3e114bd97` and NAP-RESOURCE PR #80 at `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`.

  - All host packages admit `@napplet/core` up to 0.44.x and `@napplet/nap` up to 0.43.x, and develop and build on that line. Other peer floors are unchanged.
  - Breaking peer change for `@kehto/mocks`: it now needs `@napplet/core` `>=0.44.0 <0.45.0` and `@napplet/nap` `>=0.43.0 <0.44.0`. The NAP-WEBRTC mock uses the packaged `WebrtcSession` (delivery fields, `maxPayloadBytes`) and `WebrtcEvent` (`bytes`, `stats`) directly, and `MockMediaPlaybackState` is now the packaged `MediaState`, which carries `reason`.
  - `@kehto/shell`: the injected `window.napplet.webrtc` gains `sendBytes(sessionId, bytes)`, which sends `webrtc.sendBytes` and settles on `webrtc.sendBytes.result` (rejecting with the shell's error, such as `unsupported`). Before this, `@napplet/nap` 0.43's `webrtcSendBytes` hit a missing method. The deprecated positional `media.sendCommand(id, action, value, reason)` and `media.onCommand(id, (action, value, reason) => ...)` now carry `reason`, as nap 0.43 passes it; their `KEHTO-MEDIA-*` warnings are unchanged.
  - `@kehto/services`: the media and WebRTC handlers type `media.session.ended` and `webrtc.sendBytes` with the packaged messages. Wire behavior is unchanged; `webrtc.sendBytes` still answers `unsupported`.
  - `@kehto/conformance`: the operation inventory is regenerated from `@napplet/nap` 0.43.0, so `catalog/package-drift` passes for the pinned media and WebRTC drafts.

- 7d3f35d: Move the host line to `@napplet/core` 0.45.0 / `@napplet/nap` 0.45.0 (kehto/web#518). Checked NAP-CVM PR #31 at `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f`, NAP-INTENT at master `377bf939c6c906817084b43dd21d424de646dbc2`, NAP-RESOURCE PR #80 at `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc` and NAP-UPLOAD PR #33 at `f5cc981e527e2cc1572793a7a6e5082e5271ac49`.

  - All host packages admit `@napplet/core` and `@napplet/nap` up to 0.45.x, and develop and build on that line. No peer floor moves.
  - Breaking type change for `@kehto/services`: `CvmDiscoverResultMessage` is now a union of `CvmDiscoverSuccessResultMessage` (`servers` required) and `CvmDiscoverErrorResultMessage` (`error` only), both exported, matching NAP-CVM's Error Handling and nap 0.45. A value with both `servers` and `error` no longer type-checks. The wire is unchanged.
  - `@kehto/services`, `@kehto/runtime`, `@kehto/mocks`: `intent.available.result` and `intent.handlers.result` failures (invalid archetype, catalog unavailable, policy denial) now carry an empty `availability` (`available: false`, no candidates) or `handlers: []` beside `error`, as the NAP-INTENT wire table requires.
  - `@kehto/shell`: the injected `cvm.discover` rejects a success reply without a `servers` list (`cvm.discover.result missing servers`) instead of resolving `[]`.
  - `@kehto/conformance`: the inventory is regenerated from nap 0.45.0, which clears the CVM and INTENT rows of `catalog/package-field-drift`. `upload.upload.result` `result` is recorded as a NAP-UPLOAD table-versus-Error-Handling contradiction (napplet/naps#33) and reports `spec-gap`. `upload.info.result` / `upload.status.result` still fail as package drift.

- Updated dependencies [d9e4118]
- Updated dependencies [6d21cda]
- Updated dependencies [6bdcd78]
- Updated dependencies [cbb0bb7]
- Updated dependencies [6ff7938]
- Updated dependencies [06e841c]
- Updated dependencies [707904c]
- Updated dependencies [5a5aefb]
- Updated dependencies [affae5e]
- Updated dependencies [ac84db4]
- Updated dependencies [985b474]
- Updated dependencies [63d0254]
- Updated dependencies [8b72f3b]
- Updated dependencies [5146f60]
- Updated dependencies [7d3f35d]
- Updated dependencies [c1a0f12]
- Updated dependencies [c182b29]
- Updated dependencies [acdb7c5]
- Updated dependencies [2d646ed]
- Updated dependencies [b796f2f]
- Updated dependencies [dee1aeb]
- Updated dependencies [30a019c]
- Updated dependencies [93fcaa4]
- Updated dependencies [412aeb8]
- Updated dependencies [261eacf]
- Updated dependencies [9033fe8]
- Updated dependencies [ffa9726]
- Updated dependencies [1233911]
- Updated dependencies [8d8c27c]
  - @kehto/paja@0.38.0
  - @kehto/conformance@0.1.0

## 0.7.3

### Patch Changes

- Updated dependencies [cc8fcd7]
  - @kehto/paja@0.37.0

## 0.7.2

### Patch Changes

- Updated dependencies [e989352]
- Updated dependencies [e989352]
  - @kehto/paja@0.36.0

## 0.7.1

### Patch Changes

- Updated dependencies [b573414]
- Updated dependencies [e291825]
- Updated dependencies [25311db]
  - @kehto/paja@0.35.0

## 0.7.0

### Minor Changes

- 11ae71c: Adopt @napplet/core 0.41.x and @napplet/nap 0.40.x, which export the current NAP-INTENT no-ID, string-sender delivery. `@kehto/services` now re-exports its intent types from `@napplet/core` instead of keeping a local copy. Because core releases before 0.41.0 carry the withdrawn delivery ID and nullable sender, `@kehto/services`, `@kehto/paja` and `@kehto/cli` now require `@napplet/core` >=0.41.0. Other packages widen their peer windows to core <0.42.0 and nap <0.41.0 and move development builds and JSR maps to the new line. The shell's injected intent receiver now drops deliveries with an empty sender, matching the nap 0.40 binding.

### Patch Changes

- Updated dependencies [11ae71c]
  - @kehto/paja@0.34.0

## 0.6.2

### Patch Changes

- f4e7e8a: Accept @napplet/core 0.40.x and @napplet/nap 0.39.x throughout the Paja host dependency graph and update host development dependencies and JSR maps to that line. Keep existing peer floors. Account for the newly packaged blossom, catalog, navigation, soulseek and torrent domains without advertising unimplemented host backends.
- Updated dependencies [f4e7e8a]
  - @kehto/paja@0.33.1

## 0.6.1

### Patch Changes

- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
- Updated dependencies [249fe8c]
  - @kehto/paja@0.33.0

## 0.6.0

### Minor Changes

- 66beed4: Track NAP-LLM (napplet/naps PR #134 at `5e93bdfce0e84c0de728234cb7b3feed498f8635`) end to end. This is a breaking host API on the 0.x draft contract, with no compatibility path for the removed shapes.

  - Tool calls and results, `thinking` parts, `maxTokens`, `temperature`, `tools`, `toolChoice`, `Model.tools`, `Model.toolChoiceModes`, `Requirements.tools` and extended `Usage` are supported. Kehto validates and relays tool calls and never executes one.
  - `Generation.text` is replaced by `Generation.content` parts and text-only deltas by `start`/`delta`/`end` block events. The shell prelude forwards the full structured delta, and only for the next sequence with valid fields.
  - `@kehto/services`: `LlmConnection` gains required `tools` and `toolChoiceModes`; `LlmGenerateHooks.onDelta` and the `createHttpLlmProvider` callback take a block event while the service assigns `sequence` and `requestId`; `llm-types` re-exports the packaged `@napplet/nap/llm/types`. Provider endpoints accept `requiresOpaqueReasoning` (Gemini 3+ defaults it on), and the dialects map tools, reasoning and usage extras.
  - `@kehto/paja`: connections can opt into tool calling (rows saved earlier load as tools off under the same storage key), consent discloses tool definitions and tool results, and a dialect restriction answers `unsupported` before any prompt.
  - Host packages now build on `@napplet/core` 0.38.0 and `@napplet/nap` 0.37.0; `@kehto/services`, `@kehto/paja` and `@kehto/cli` (through its Paja dependency) require them.

### Patch Changes

- Updated dependencies [66beed4]
  - @kehto/paja@0.32.0

## 0.5.16

### Patch Changes

- Updated dependencies [4d8a569]
  - @kehto/paja@0.31.0

## 0.5.15

### Patch Changes

- Updated dependencies [37457ce]
  - @kehto/paja@0.30.0

## 0.5.14

### Patch Changes

- Updated dependencies [bfe51a1]
  - @kehto/paja@0.29.0

## 0.5.13

### Patch Changes

- 902c1d0: Admit the NIP-5D port-bound napplet release lines in published peers:
  `@napplet/core >=0.32.0 <0.38.0` and `@napplet/nap >=0.32.0 <0.37.0`
  (core 0.37.0 / nap 0.36.0, napplet/web#302). Development stays on the 0.32.0
  baseline.
- Updated dependencies [902c1d0]
  - @kehto/paja@0.28.0

## 0.5.12

### Patch Changes

- Updated dependencies [3089c5e]
  - @kehto/paja@0.27.0

## 0.5.11

### Patch Changes

- f5c3ee8: Widen the `@napplet/*` peer ranges so the `llm` domain installs without peer conflicts: `@napplet/core` now accepts `>=0.32.0 <0.37.0` and `@napplet/nap` accepts `>=0.32.0 <0.36.0`. The `llm` subpath first ships in `@napplet/nap@0.35.0`, and `@napplet/nap@0.35.1` requires `@napplet/core@^0.36.0`. The old `<0.35.0` cap made npm fail with ERESOLVE and made pnpm print unmet-peer warnings (kehto/web#364).
- Updated dependencies [f5c3ee8]
  - @kehto/paja@0.26.1

## 0.5.10

### Patch Changes

- Updated dependencies [fcb5bc9]
  - @kehto/paja@0.26.0

## 0.5.9

### Patch Changes

- Updated dependencies [d49b1bf]
  - @kehto/paja@0.25.0

## 0.5.8

### Patch Changes

- Updated dependencies [bd95181]
  - @kehto/paja@0.24.0

## 0.5.7

### Patch Changes

- Updated dependencies [c04cb11]
- Updated dependencies [ea5c039]
  - @kehto/paja@0.23.0

## 0.5.6

### Patch Changes

- Updated dependencies [0958a8b]
- Updated dependencies [0958a8b]
- Updated dependencies [6693f5a]
- Updated dependencies [0958a8b]
  - @kehto/paja@0.22.0

## 0.5.5

### Patch Changes

- b89015f: Add host-owned NAP-GAMEPAD snapshots and browser focus/visibility hooks, deny native controller paths in Paja/playground frames, and expose the cached injected API. Bind trusted iframe sessions independently of optional SHELL readiness. Preserve the empty handshake-domain compatibility export and report unavailable native readers using the proposed NAP reasons. The optional native Gamepad API replacement awaits clarification of NIP-5D's namespace-only injection restriction. Publish CLI 0.5.5 before the coordinated napplet CLI release selects it as the private Paja runner.

  Accept both the maintained core/NAP 0.32 baseline and the coordinated 0.34 GAMEPAD package set. Existing package API behavior remains covered against both versions.

- Updated dependencies [b89015f]
  - @kehto/paja@0.21.0

## 0.5.4

### Patch Changes

- Updated dependencies [b462787]
  - @kehto/paja@0.20.0

## 0.5.3

### Patch Changes

- Updated dependencies [066524c]
  - @kehto/paja@0.19.0

## 0.5.2

### Patch Changes

- Updated dependencies [ece45ca]
- Updated dependencies [ece45ca]
  - @kehto/paja@0.18.0

## 0.5.1

### Patch Changes

- Updated dependencies [bbbca64]
  - @kehto/paja@0.17.0

## 0.5.0

### Minor Changes

- 3231957: Adopt the NAP-RESOURCE Blossom server-hint contract across the injected shell API, reference service, and Paja runtime. Single requests now carry optional advisory servers, bulk requests use per-resource request objects, and Paja validates, caps, and tries accepted hints before host defaults.

### Patch Changes

- Updated dependencies [3231957]
  - @kehto/paja@0.16.0

## 0.4.5

### Patch Changes

- Updated dependencies [c8264c6]
- Updated dependencies [b2449e4]
  - @kehto/paja@0.15.0

## 0.4.4

### Patch Changes

- Updated dependencies [8e09918]
  - @kehto/paja@0.14.0

## 0.4.3

### Patch Changes

- Updated dependencies [65c53be]
  - @kehto/paja@0.13.0

## 0.4.2

### Patch Changes

- Updated dependencies [d237979]
  - @kehto/paja@0.12.0

## 0.4.1

### Patch Changes

- Updated dependencies [a8cc3cf]
  - @kehto/paja@0.11.0

## 0.4.0

### Minor Changes

- 9390eca: Move the public Kehto compatibility line to the current Napplet packages and
  align the host implementation with the merged NAP-INC and NAP-INTENT contracts.

### Patch Changes

- Updated dependencies [9390eca]
  - @kehto/paja@0.10.0

## 0.3.0

### Minor Changes

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

- Updated dependencies [a1fa730]
- Updated dependencies [d8a57e2]
  - @kehto/paja@0.9.0

## 0.2.16

### Patch Changes

- Updated dependencies [d4c7da3]
  - @kehto/paja@0.8.0

## 0.2.15

### Patch Changes

- Updated dependencies [96130bc]
  - @kehto/paja@0.7.0

## 0.2.14

### Patch Changes

- 708176b: Chase the published `@napplet/core` and `@napplet/nap` 0.28 line. Kehto package
  peer and JSR metadata now admit the current NAP contract, local demo napplets
  build against the refreshed Napplet toolchain, and `@kehto/services` implements
  the current NAP-OUTBOX publish fanout fields: `relays`, `toOutbox`, and required
  `toInboxes`. `@kehto/paja` also clears stale iframe ownership during target
  reloads so late messages from an old frame cannot mark the runtime ready before
  the reloaded target receives signer-backed identity.
- Updated dependencies [708176b]
- Updated dependencies [784687c]
  - @kehto/paja@0.6.8

## 0.2.13

### Patch Changes

- 3d14dd7: Improve JSR package scoring metadata by adding entrypoint module docs, public API docs, and explicit public export types without changing runtime behavior.
- Updated dependencies [3d14dd7]
  - @kehto/paja@0.6.5

## 0.2.12

### Patch Changes

- 484630b: Render Paja target-url documents as injected srcdoc so local napplet previews receive runtime-owned window.napplet domains before app bootstrap.
- Updated dependencies [484630b]
  - @kehto/paja@0.6.4

## 0.2.11

### Patch Changes

- 0dbdfe2: Raise the supported `@napplet/core` and `@napplet/nap` peer range through the
  published `0.27.x` line and refresh local demo/fixture napplet package pins.
- Updated dependencies [0dbdfe2]
  - @kehto/paja@0.6.3

## 0.2.10

### Patch Changes

- 89f4c11: Express peer and development dependency upper bounds with inclusive maximum ranges for clearer supported-version metadata, including the current Napplet 0.26 line.
- Updated dependencies [89f4c11]
  - @kehto/paja@0.6.1

## 0.2.9

### Patch Changes

- Updated dependencies [8aa2123]
  - @kehto/paja@0.6.0

## 0.2.8

### Patch Changes

- Accept the released NAP-COUNT-capable `@napplet/core` and `@napplet/nap`
  `0.25.x` line in published package metadata.

  The NAP-COUNT implementation was versioned before the matching napplet package
  release landed, so this patch updates peer/dev ranges and local package graph
  guards without changing Kehto runtime behavior.

- Updated dependencies
  - @kehto/paja@0.5.1

## 0.2.7

### Patch Changes

- Updated dependencies [7293d4d]
  - @kehto/paja@0.5.0

## 0.2.6

### Patch Changes

- Updated dependencies [feb3176]
  - @kehto/paja@0.4.0

## 0.2.5

### Patch Changes

- 91a2c01: Accept `@napplet/core` and `@napplet/nap` 0.24.x peer dependencies across compatible Kehto packages.
- Updated dependencies [91a2c01]
  - @kehto/paja@0.3.5

## 0.2.4

### Patch Changes

- 968b286: Run global binary symlinks as CLIs and print the Paja runtime URL before managed target readiness waits.
- Updated dependencies [968b286]
  - @kehto/paja@0.3.4

## 0.2.3

### Patch Changes

- a07f3cd: Add a NIP-5D injected-domain namespace prelude helper for srcdoc hosts and
  align napplet package peer ranges with the inject-compatible release line.
- Updated dependencies [a07f3cd]
  - @kehto/paja@0.3.3

## 0.2.2

### Patch Changes

- 2dfdebb: Align Napplet dependency ranges with the `resource.bytesMany` package release.
- Updated dependencies [2dfdebb]
  - @kehto/paja@0.3.1

## 0.2.1

### Patch Changes

- 4e0f4b9: Add NAP-LINK runtime parity for the current `@napplet/nap` contract.

  The runtime now dispatches the `link` domain, `@kehto/services` exports a reference `link.open` service, shell capabilities can advertise NAP-LINK, and Paja/playground hosts register link support. Package peer ranges now track the current `@napplet` 0.20 line.

- cacab69: Pin internal `@kehto/*` dependencies to explicit caret version ranges instead of
  the `workspace:*` protocol, so published packages (npm and JSR) carry correct,
  resolvable dependency versions. The ranges mirror the existing `jsr.json` imports.
- Updated dependencies [7dbbdf8]
- Updated dependencies [7c7b019]
- Updated dependencies [4e0f4b9]
- Updated dependencies [4fd5e37]
- Updated dependencies [b37337b]
- Updated dependencies [272277a]
- Updated dependencies [cacab69]
  - @kehto/paja@0.3.0

## 0.2.0

### Minor Changes

- 07a4733: Add the initial Paja single-window development runtime package and the top-level `kehto paja` CLI command with a typed option model, framework-agnostic target URL contract, real Kehto shell/service wiring, and configurable development environment simulation.

### Patch Changes

- Updated dependencies [07a4733]
  - @kehto/paja@0.2.0
