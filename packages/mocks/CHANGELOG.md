# @kehto/mocks

## 0.2.0

### Minor Changes

- 707904c: NAP-CVM cancellation and server-request expiry (napplet/naps#31 at `28cf1bdb`):

  - A napplet's `notifications/cancelled` now names the request the transport
    actually sent. The service passes each napplet request's handle to
    `CvmTransport.request()` as `execution.handle` and hands a cancellation of an
    in-flight request to the new optional `CvmTransport.cancel()`.
    `createNostrCvmTransport` rewrites `params.requestId` to its correlation id,
    and publishes nothing once that request has settled. A transport without
    `cancel()` publishes the cancellation unchanged and warns once
    (`KEHTO_CVM_TRANSPORT_CANCEL`).
  - A cancellation of the napplet's own settled request is acknowledged without
    publication. One whose `requestId` names no request of that napplet in the
    session (or is missing) is now `invalid message` and never published.
  - Server requests delivered to a napplet expire after the new
    `serverRequestTimeoutMs` option (default 30000, an integer from 1 through
    300000, the NAP's Timeouts bounds); a later response is `invalid message`.
    Expired entries are pruned, so the correlation books stay bounded.
  - `@kehto/mocks`: the CVM mock applies the same cancellation check and the same
    server-request expiry (`serverRequestTimeoutMs`, on its scheduler). The
    `invalid message` for a cancellation naming another id is why this is minor.
  - `@kehto/conformance` adds `cvm/request-cancel-settled`, and its in-memory
    transport implements `cancel()`.

- affae5e: Take the NAP-CVM registry types from `@napplet/core` 0.42.0 and retire Kehto's local copies (kehto/web#441). Checked against NAP-CVM PR #31 at `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f`.

  - `@kehto/services` re-exports `CvmRegistrySelector`, `CvmRegistryEntry`, `CvmRegistryTool` and `CvmRegistryCallOptions` from core under the same names, and adds `CvmRegistryOptions` and `CvmRegistryQuery`. `CvmRegistrySelector` is now core's union, so an empty `{}` selector no longer type-checks (the runtime already rejected it). `CvmRegistryFamily` stays Kehto's host configuration type.
  - `@kehto/mocks`: `MockCvmRegistryEntry` extends core's `CvmRegistryEntry`.
  - Breaking peer change: `@kehto/services`, `@kehto/mocks`, `@kehto/paja` and `@kehto/cli` now need `@napplet/core` `>=0.42.0 <0.43.0`. Install `@napplet/core@^0.42.0` (and `@napplet/nap@^0.41.0` if you want the matching bindings) when upgrading.
  - All host packages admit `@napplet/core` 0.42.x and `@napplet/nap` 0.41.x; `@kehto/acl`, `@kehto/firewall`, `@kehto/runtime` and `@kehto/shell` keep their existing floors.
  - The injected string-family adapter and its `KEHTO_CVM_FAMILY_SELECTOR` warning are unchanged. `@napplet/nap` 0.41.0 does not translate string-family calls, so napplets built against older bindings still rely on it.

- 5e8206f: Bring the NAP mocks back in line with `napplet/naps` so `audit:naps --strict`
  passes again.

  - **Ref bumps:** NAP-IDENTITY, NAP-SHELL, NAP-THEME and NAP-INTENT move to
    master `377bf939` (unchanged documents; NAP-INTENT equals the PR #106 head the
    mock already implemented). NAP-LINK moves to PR #53 `100e5c93`.
  - **NAP-LLM (breaking):** follows PR #134 `5e93bdfc`, which absorbed PR #138.
    `LLM_TOOLS_SPEC_REF` is removed. Models carry `toolChoiceModes`; deltas use
    `start`/`delta`/`end` block events with a `toolCall` block kind; results are
    `{ content, finish, usage }` without the old `text` mirror; `samplingParams`,
    `maxTokens: 0`, duplicate or non-portable tool names, choices without tools,
    misplaced tool results and misplaced parts are `invalid-request`; unlisted
    tool-choice modes and tool history on a tools-less connection are
    `unsupported`; scripted turns that break the tool-choice mode or JSON format
    end in `provider-error`. `respondWith` no longer accepts `toolUse`.
    Validators now live in `llm-validate.ts` and are still exported, plus
    `mockToolChoiceMode`.
  - **NAP-WEBRTC:** follows PR #59 `fb4dd6f0`. Adds `webrtc.sendBytes` and `bytes`
    events (canonical base64), reports `ordered`/`maxRetransmits`/`maxPayloadBytes`,
    pairs only sessions with matching delivery semantics, counts payload limits in
    bytes, and adds `peerBytes` and `mockCanonicalBase64Length`.
  - **NAP-MESH (breaking):** removed. PR #122 was retracted in favour of
    NAP-NEIGHBOR (PR #146), which is a different contract.
  - **Audit:** `scripts/deferred-naps.json` pins new drafts without Kehto support
    (NAP-WEBMCP #150, NAP-NEIGHBOR #146, NAP-EMAIL #139) to their head; they are
    reported as `deferred` and do not fail `--strict` until the head moves or the
    PR closes.

  **Migration** (`KEHTO_MOCKS_NAP_DRIFT_RETIRED` in `docs/compatibility.md`):
  replace `LLM_TOOLS_SPEC_REF` with `LLM_SPEC_REF`; read LLM output from
  `result.content` instead of `result.text`; match delta `block: 'toolCall'` and
  the `start`/`delta`/`end` events; script only `stop`/`length`/`refusal` with
  `respondWith`; drop any use of the NAP-MESH mock (no replacement yet).

- 5146f60: Move the host line to `@napplet/core` 0.44.0 / `@napplet/nap` 0.43.0 (kehto/web#496). Checked NAP-MEDIA PR #10 at `7806f438530251fce5129f8e6239d6b642278759`, NAP-WEBRTC PR #59 at `fb4dd6f0e6294e1837733d2af61931e3e114bd97` and NAP-RESOURCE PR #80 at `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`.

  - All host packages admit `@napplet/core` up to 0.44.x and `@napplet/nap` up to 0.43.x, and develop and build on that line. Other peer floors are unchanged.
  - Breaking peer change for `@kehto/mocks`: it now needs `@napplet/core` `>=0.44.0 <0.45.0` and `@napplet/nap` `>=0.43.0 <0.44.0`. The NAP-WEBRTC mock uses the packaged `WebrtcSession` (delivery fields, `maxPayloadBytes`) and `WebrtcEvent` (`bytes`, `stats`) directly, and `MockMediaPlaybackState` is now the packaged `MediaState`, which carries `reason`.
  - `@kehto/shell`: the injected `window.napplet.webrtc` gains `sendBytes(sessionId, bytes)`, which sends `webrtc.sendBytes` and settles on `webrtc.sendBytes.result` (rejecting with the shell's error, such as `unsupported`). Before this, `@napplet/nap` 0.43's `webrtcSendBytes` hit a missing method. The deprecated positional `media.sendCommand(id, action, value, reason)` and `media.onCommand(id, (action, value, reason) => ...)` now carry `reason`, as nap 0.43 passes it; their `KEHTO-MEDIA-*` warnings are unchanged.
  - `@kehto/services`: the media and WebRTC handlers type `media.session.ended` and `webrtc.sendBytes` with the packaged messages. Wire behavior is unchanged; `webrtc.sendBytes` still answers `unsupported`.
  - `@kehto/conformance`: the operation inventory is regenerated from `@napplet/nap` 0.43.0, so `catalog/package-drift` passes for the pinned media and WebRTC drafts.

- 1233911: NAP-WEBRTC revocation and after-close answers (napplet/naps#59 at `fb4dd6f0`):

  - `createWebrtcService` now sends `closed` with reason `policy denied` for each
    live session when policy revokes WebRTC for a window (`onPermissionRevoked`,
    or an ACL block through `onCapabilityRevoked(windowId, null)`), then forgets
    the session. The draft lists "policy revokes the capability" among the
    `closed` triggers. Requests already in flight still get their result, and an
    open still waiting on approval gets `policy denied`. Window destroy stays
    silent.
  - `@kehto/mocks`: the WebRTC mock now answers `webrtc.send`, `webrtc.sendBytes`
    and `webrtc.close` on an ended session with `session not found`, like the
    service. Before, it answered `session closed` to a send and succeeded on a
    second close. This is a minor bump because tests asserting the old answers
    will need updating. The mock also handles `onPermissionRevoked`.
  - `@kehto/conformance` adds the `webrtc/event-closed-on-revoke` push and the
    `webrtc.revoke` host control.

### Patch Changes

- ac84db4: Close the remaining NAP-CVM `cvm.request` lifecycle gaps (napplet/naps#31 at
  `28cf1bdb`, Message handling and Errors):

  - Notifications and responses complete on publication with a result that has
    only `type` and `id`, and no MCP response is awaited. `CvmTransport` gains an
    optional `publish()` that sends the message as given, and
    `createNostrCvmTransport` implements it under the request deadline. A
    transport without `publish()` falls back to `request()` and warns once
    (`KEHTO_CVM_TRANSPORT_PUBLISH`).
  - A client request id already used in the session, and a response matching no
    server request delivered to that napplet, return `invalid message` before
    approval or publication.
  - A malformed `server` reference returns `invalid request` on `cvm.request` and
    `cvm.close`, instead of `server not found` and `session closed`.

  The injected `window.napplet.cvm.request()` in `@kehto/shell` resolves `null`
  for a notification or response instead of rejecting on the missing `message`.
  `@kehto/mocks` matches server-request ids by type as well as value, like the
  service. `@kehto/conformance` adds `cvm/semantics` cases for each rule,
  including a server-request push answered by a napplet response.

- dccda68: **Breaking (runtime):** NAP-INC peers are now runtime-assigned endpoint identifiers instead of manifest `d` tags, following NAP-INC at `napplet/naps@377bf939c6c906817084b43dd21d424de646dbc2`.

  - `inc.event.sender`, `inc.channel.event.sender`, and every channel `peer` are opaque identifiers: one per live registered endpoint, taken from the injected `crypto.randomUUID`, stable until that registration is replaced or unregistered, and never reused.
  - `inc.channel.open` only accepts such an identifier as `target`. A `d` tag target fails as `target not found` and logs `KEHTO_INC_DTAG_TARGET_RETIRED` once per runtime instance; there is no fallback.
  - Two live instances that share a `d` tag are distinct and addressable, and root or snapshot manifests without a `d` tag can emit, subscribe, and open or accept channels.
  - Replacing or unregistering a session now retires its INC endpoint: its channels close as `peer destroyed` and its topic subscriptions are dropped.
  - New host API `Runtime.getIncEndpointId(windowId)` for host peer selection.

  Migration: keep the `sender` (or channel `peer`) you received and pass that to `channel.open`. Do not hardcode a peer name or compare `sender` with one.

  `@kehto/shell` documents the injected `inc.channel.open(target)` argument as an endpoint identifier; `@kehto/mocks` records the checked NAP-INC ref.

- 7d3f35d: Move the host line to `@napplet/core` 0.45.0 / `@napplet/nap` 0.45.0 (kehto/web#518). Checked NAP-CVM PR #31 at `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f`, NAP-INTENT at master `377bf939c6c906817084b43dd21d424de646dbc2`, NAP-RESOURCE PR #80 at `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc` and NAP-UPLOAD PR #33 at `f5cc981e527e2cc1572793a7a6e5082e5271ac49`.

  - All host packages admit `@napplet/core` and `@napplet/nap` up to 0.45.x, and develop and build on that line. No peer floor moves.
  - Breaking type change for `@kehto/services`: `CvmDiscoverResultMessage` is now a union of `CvmDiscoverSuccessResultMessage` (`servers` required) and `CvmDiscoverErrorResultMessage` (`error` only), both exported, matching NAP-CVM's Error Handling and nap 0.45. A value with both `servers` and `error` no longer type-checks. The wire is unchanged.
  - `@kehto/services`, `@kehto/runtime`, `@kehto/mocks`: `intent.available.result` and `intent.handlers.result` failures (invalid archetype, catalog unavailable, policy denial) now carry an empty `availability` (`available: false`, no candidates) or `handlers: []` beside `error`, as the NAP-INTENT wire table requires.
  - `@kehto/shell`: the injected `cvm.discover` rejects a success reply without a `servers` list (`cvm.discover.result missing servers`) instead of resolving `[]`.
  - `@kehto/conformance`: the inventory is regenerated from nap 0.45.0, which clears the CVM and INTENT rows of `catalog/package-field-drift`. `upload.upload.result` `result` is recorded as a NAP-UPLOAD table-versus-Error-Handling contradiction (napplet/naps#33) and reports `spec-gap`. `upload.info.result` / `upload.status.result` still fail as package drift.

- Updated dependencies [99353c6]
- Updated dependencies [63d0254]
- Updated dependencies [639f193]
- Updated dependencies [d9e4118]
- Updated dependencies [affae5e]
- Updated dependencies [985b474]
- Updated dependencies [63d0254]
- Updated dependencies [54035cf]
- Updated dependencies [dccda68]
- Updated dependencies [c45f223]
- Updated dependencies [8023fbe]
- Updated dependencies [5146f60]
- Updated dependencies [7d3f35d]
- Updated dependencies [acdb7c5]
- Updated dependencies [2d646ed]
- Updated dependencies [412aeb8]
- Updated dependencies [261eacf]
- Updated dependencies [9033fe8]
  - @kehto/runtime@0.31.0
  - @kehto/acl@0.20.7

## 0.1.4

### Patch Changes

- Updated dependencies [b573414]
- Updated dependencies [e291825]
  - @kehto/runtime@0.30.0

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
