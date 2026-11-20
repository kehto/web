# @kehto/conformance

## 0.1.0

### Minor Changes

- 6d21cda: Cover every supported NAP domain: an operation inventory pinned from the installed `@napplet/nap` types and the pinned NAP wire tables (with a drift guard), per-domain fixtures and deterministic in-memory backends for the full profile, `<domain>/correlation`, `<domain>/semantics` and `<domain>/push` checks, multi-endpoint NAP-INC semantics, and the `catalog/*` checks for coverage, package drift, capability truthfulness, ACL denial, endpoint isolation and required broadcasts. Probe plans gain binary payloads, field fills from earlier replies and mark-anchored waits.
- 6bdcd78: Add `catalog/package-field-drift`: the conformance catalog now compares every payload field a pinned NAP wire table names, with its optionality, against the installed `@napplet/nap` message declarations, so a renamed or re-optionalised field (such as `requests` for `urls` on `resource.bytesMany`) fails even when every operation name matches. Differences a pinned NAP sentence settles are listed with the quote; table-versus-prose contradictions report `spec-gap`. Against `@napplet/nap@0.43.0` the full profile fails it on `cvm.discover.result`, `upload.*.result` and `intent.available/handlers.result`.
- cbb0bb7: Add mutation self-tests: `@kehto/conformance/mutations` exports named mutations of the first-party Kehto target (`MUTATIONS`, `createMutation`), each declaring the stable checks it must fail, and the browser bundle adds `runKehtoMutation`. `shell/local-supports` now also proves that a first `shell.init` claiming an absent domain cannot make it supported.
- 6ff7938: Add `@kehto/conformance`, a runtime conformance suite that runs a reference probe napplet against the real Kehto runtime and shell, and route `kehto conformance` to it. This first slice covers NIP-5D core (sandbox, provenance, injection order and scope, `window.nostr`, port privacy and binding, source binding, manifest declarations, unknown and malformed envelopes, readiness independence), Kehto's strict required-domain preflight, and optional NAP-SHELL, across shell-present and shell-absent variants of the `minimal` and `full` profiles, with `pretty`, `json` and `junit` reporters. `kehto conformance` exits `0`, `1` or `2` and needs the optional `@playwright/test` peer.
- 06e841c: Add the conformance web UI and `kehto conformance --ui`: a live page (verdict, counts, advertised-versus-tested domain matrix, scope-grouped checks with authority links, transcript, deep links, JSON download) served on loopback, with `--exec`, `--port` and `--no-open`, and one debounced re-run per rebuild of the served bundle over server-sent events. The browser bundle exports `mountKehtoConformanceUi`; `@kehto/conformance/cli` exports `startLiveUi` and `renderUiPage`.
- 985b474: Answer legacy Firewall drops in the domains ACL does not gate on their own NAP
  wires instead of an invented `<type>.error` (kehto/web#494).

  - `common.*` → `.result` with `ok: false` and `error`; `getProfile` adds
    `pubkey` (the target when it is lowercase hex, otherwise `''`) and `follows`
    adds `pubkeys: []` (NAP-COMMON napplet/naps#67 at `8cd0eae8`).
  - `lists.add`/`lists.remove` → `.result` with `ok: false`,
    `error: "policy-denied"` and the runtime's `reason`; `lists.supported` →
    `.result` with `error: "policy-denied"` (NAP-LISTS #68 at `7cf00cdb`).
  - `serial.*`, `ble.*`, `webrtc.*` → `.result` with `error` (NAP-SERIAL #61 at
    `0c6e88ab`, NAP-BLE #62 at `b46b8691`, NAP-WEBRTC #59 at `fb4dd6f0`).
  - `link.open` → `link.open.result` with `status: "denied"` and `error`
    (NAP-LINK #53 at `100e5c93`).
  - `gamepad.subscribe` → the `gamepad.state` `"blocked"` snapshot;
    `gamepad.unsubscribe` stays silent (NAP-GAMEPAD #130 at `0b28f77e`).

  `@kehto/conformance` adds `catalog/firewall-denial`, the Firewall sibling of
  `catalog/acl-denial`, and the optional `TargetSession.openLegacyFirewall()` it
  needs. The first-party Kehto target implements it with a scoped legacy-Firewall
  session and the `firewall.block` / `firewall.rejections` controls.

### Patch Changes

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

- 412aeb8: `relay.publishEncrypted` now fails closed when the signer can't encrypt
  (kehto/web#482). NAP-RELAY napplet/naps#2 at `9f30b350` says the shell MUST
  encrypt. Before, a signer with no `nip44`/`nip04` method got an event with empty
  `content` signed and published, plus `ok: true`. Now nothing is signed or
  published. The reply is `ok: false` with `error: "encryption unavailable:
<scheme>"`, or `"encryption failed"` when `encrypt` returns no ciphertext.

  The `@kehto/conformance` first-party fixture signer now really encrypts (NIP-44
  v2 and NIP-04), so `relay/semantics` covers the `publishEncrypted` success path.

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

- 8d8c27c: Carry NAP-WEBRTC byte payloads. `createWebrtcService` gains a `sendBytes` hook that receives the decoded bytes; the service rejects non-canonical base64 with `invalid request`, answers `payload too large` above the session's `maxPayloadBytes` (now enforced for `webrtc.send` too, on the serialized payload), drops non-canonical peer `bytes` events, and still answers `unsupported` without the hook. `encodeWebrtcBytes` / `decodeWebrtcBytes` are exported. Paja's default WebRTC controller sends `sendBytes` as one binary data-channel message, delivers incoming binary as `bytes` events, and reports `maxPayloadBytes`; the `soy-rtc/1` multiplayer profile stays JSON-only. The conformance Kehto target now supports `sendBytes`, and the WebRTC fixture checks that non-canonical bytes are rejected.
- Updated dependencies [99353c6]
- Updated dependencies [63d0254]
- Updated dependencies [639f193]
- Updated dependencies [d9e4118]
- Updated dependencies [55f6633]
- Updated dependencies [707904c]
- Updated dependencies [5a5aefb]
- Updated dependencies [477f51d]
- Updated dependencies [b68a4bd]
- Updated dependencies [affae5e]
- Updated dependencies [ac84db4]
- Updated dependencies [985b474]
- Updated dependencies [63d0254]
- Updated dependencies [8b72f3b]
- Updated dependencies [54035cf]
- Updated dependencies [dccda68]
- Updated dependencies [91ca6af]
- Updated dependencies [73207d1]
- Updated dependencies [c45f223]
- Updated dependencies [7ab22de]
- Updated dependencies [0c5f6f8]
- Updated dependencies [8023fbe]
- Updated dependencies [5146f60]
- Updated dependencies [7d3f35d]
- Updated dependencies [c1a0f12]
- Updated dependencies [c182b29]
- Updated dependencies [acdb7c5]
- Updated dependencies [2d646ed]
- Updated dependencies [412aeb8]
- Updated dependencies [261eacf]
- Updated dependencies [76c4ae2]
- Updated dependencies [9033fe8]
- Updated dependencies [5999f03]
- Updated dependencies [4d8e1a8]
- Updated dependencies [1233911]
- Updated dependencies [8d8c27c]
  - @kehto/runtime@0.31.0
  - @kehto/services@0.35.0
  - @kehto/shell@0.36.0
  - @kehto/nip@0.8.1
