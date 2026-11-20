# @kehto/firewall

## 0.11.0

### Minor Changes

- d9e4118: Make the Firewall's requirement and grant caps host policy (kehto/web#514).

  - `PermissionPolicyOptions` gains `maxRequirements` (default
    `MAX_PERMISSION_REQUIREMENTS`, 128) and `maxGrants` (default
    `MAX_PERMISSION_GRANTS`, 2048). `permissionLimits()` validates them against
    `MAX_PERMISSION_REQUIREMENTS_CEILING` (1024) and
    `MAX_PERMISSION_GRANTS_CEILING` (16384) and throws a `RangeError` otherwise.
  - `PermissionAdapter` accepts both; the approval coordinator validates them when
    it is built, and services see the first as
    `ServiceRuntimeContext.maxPermissionRequirements`.
  - `ApprovalFailure` gains `capacity`: a full grant table is reported as host
    capacity, not a denial. OUTBOX and runtime `relay.*` answer it with
    `approval capacity reached` (kehto/web#513).
  - OUTBOX plans and COUNT size themselves to the configured `maxRequirements`;
    `createRelayPoolOutboxRouter` takes `maxRelayOrigins` for its coverage selection.
  - Paja exposes `firewall.maxRequirements` (2–1024) and `firewall.maxGrants`
    (64–16384) in its Firewall settings group; they apply on reload.

- 63d0254: Keep the Firewall grant table bounded and fair (kehto/web#513). A default-rule `allow` no longer writes a session grant: the rule is consulted on every check, `RuntimePermissions.rulesChanged()` closes live work admitted under old rules, and `DEFAULT_RULE_GRANT_PREFIX` / `isRuleGrant` are deprecated. Each napplet holds at most `maxGrantsPerPrincipal` grants (default 512, new Paja setting `firewall.maxGrantsPerNapplet`), and `admitPermissionGrants` makes room by evicting the oldest session grants before refusing; persistent and once grants are never evicted.
- 2d646ed: Keep large relay plans approvable within one Firewall request (kehto/web#455).
  An `outbox.subscribe` for a 709-follow timeline used to close with
  `policy denied` even under a default allow, because its plan named more relay
  origins than a request may carry.

  - `@kehto/firewall` exports `MAX_PERMISSION_REQUIREMENTS` (128), re-exported by
    `@kehto/runtime`. The cap itself is unchanged.
  - OUTBOX read plans contact at most 127 relay origins. The reference router
    picks a larger plan's relays by author coverage, deterministically and with
    napplet hints last, and the service bounds any router's plan before approval.
    Approval names each origin once. Unusable relay URLs are skipped instead of
    failing the plan, and a read that left an author without relays is
    `incomplete: true` (NAP-OUTBOX napplet/naps#32 at `8865f73d`).
  - An OUTBOX publish keeps every required own/inbox relay. When those cannot fit
    one approval it fails before signing with `too many relays`, never a denial;
    only explicit `options.relays` extras are trimmed.
  - Runtime `relay.*` approval names each origin once, and a host plan over the
    cap fails with `too many relays` instead of a denial. COUNT does the same with
    `too-expensive` (NAP-COUNT napplet/naps#69 at `9353a0c6`).
  - The browser approval prompt shows the origins of one mediated operation as a
    single "contact N origins" row listing the exact origins. Groups up to
    `openOriginLimit` (a new `createBrowserApprovalUi` option, default
    `DEFAULT_PROMPT_OPEN_ORIGINS` = 5) start open; Paja exposes it as the
    `firewall.promptOpenOrigins` setting.

### Patch Changes

- affae5e: Take the NAP-CVM registry types from `@napplet/core` 0.42.0 and retire Kehto's local copies (kehto/web#441). Checked against NAP-CVM PR #31 at `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f`.

  - `@kehto/services` re-exports `CvmRegistrySelector`, `CvmRegistryEntry`, `CvmRegistryTool` and `CvmRegistryCallOptions` from core under the same names, and adds `CvmRegistryOptions` and `CvmRegistryQuery`. `CvmRegistrySelector` is now core's union, so an empty `{}` selector no longer type-checks (the runtime already rejected it). `CvmRegistryFamily` stays Kehto's host configuration type.
  - `@kehto/mocks`: `MockCvmRegistryEntry` extends core's `CvmRegistryEntry`.
  - Breaking peer change: `@kehto/services`, `@kehto/mocks`, `@kehto/paja` and `@kehto/cli` now need `@napplet/core` `>=0.42.0 <0.43.0`. Install `@napplet/core@^0.42.0` (and `@napplet/nap@^0.41.0` if you want the matching bindings) when upgrading.
  - All host packages admit `@napplet/core` 0.42.x and `@napplet/nap` 0.41.x; `@kehto/acl`, `@kehto/firewall`, `@kehto/runtime` and `@kehto/shell` keep their existing floors.
  - The injected string-family adapter and its `KEHTO_CVM_FAMILY_SELECTOR` warning are unchanged. `@napplet/nap` 0.41.0 does not translate string-family calls, so napplets built against older bindings still rely on it.

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

## 0.10.0

### Minor Changes

- e989352: Add explicit multiplayer provider settings, isolated shared CVM/WebRTC transport keys, soy-rtc/1 signaling, and separately approved STUN/TURN endpoint scopes.

## 0.9.0

### Minor Changes

- b573414: Stop the Paja Firewall from asking about every exact scope, and make its decisions readable.

  - **Paja** allows every interface and operation by default and asks before each `link.open`. The Firewall panel edits those default rules: change the default, or add an exception per interface or operation, for every napplet or one. Rules persist in the browser. An approved link opens from the approving click instead of raising a second confirmation, and a revoked single-target napplet starts again through admission instead of leaving an empty stage.
  - **Shell** rebuilds `createBrowserApprovalUi`. The prompt asks a plain-language question, lists each exact scope, preselects the narrowest lifetime so one click answers, counts queued requests, and can turn an answer into a standing rule. Grants are a compact tree of single-line rows (napplet, interface, grant) with status dots and icon buttons, expanding for identity and the full scope; scopes allowed by a rule collapse to one counted row. The prompt no longer has a Cancel button or a lifetime select; Escape still cancels. New `rules` and `onAnswer` options, `BrowserApprovalRules` type and `BROWSER_APPROVAL_UI_STYLES` stylesheet.
  - **Runtime** adds `PermissionAdapter.defaultDecision`, consulted before the prompt budget and the prompt. `allow` commits session grants whose ids start with `DEFAULT_RULE_GRANT_PREFIX`. Hosts that set no hook still ask for every scope.
  - **Firewall** adds the pure rule model: `createPermissionRules`, `resolvePermissionRule`, `setPermissionRule`, `permissionRuleSubject`, `serializePermissionRules`, `deserializePermissionRules`.

- e291825: Restore voluntary temporal protection with the independent `@kehto/rate-limit` package.
  Runtime no longer constructs operation or prompt limiters implicitly. Hosts opt in
  with `permissions.rateLimiter` and `permissions.promptRateLimiter`; Paja explicitly
  installs both. Limiter configuration is managed on the host-owned instance.

  Move the old behavioral Firewall APIs and runtime `createFirewallState` into the
  explicit `@kehto/rate-limit/legacy` migration subpath. Legacy hosts supply the
  constructed state through `legacyFirewall`; runtime `firewallState` and
  `firewallPersistence` are removed. Legacy allow policies no longer bypass installed
  temporal controls. Firewall now exports only scoped approval/access policy.

## 0.8.2

### Patch Changes

- 11ae71c: Adopt @napplet/core 0.41.x and @napplet/nap 0.40.x, which export the current NAP-INTENT no-ID, string-sender delivery. `@kehto/services` now re-exports its intent types from `@napplet/core` instead of keeping a local copy. Because core releases before 0.41.0 carry the withdrawn delivery ID and nullable sender, `@kehto/services`, `@kehto/paja` and `@kehto/cli` now require `@napplet/core` >=0.41.0. Other packages widen their peer windows to core <0.42.0 and nap <0.41.0 and move development builds and JSR maps to the new line. The shell's injected intent receiver now drops deliveries with an empty sender, matching the nap 0.40 binding.

## 0.8.1

### Patch Changes

- f4e7e8a: Accept @napplet/core 0.40.x and @napplet/nap 0.39.x throughout the Paja host dependency graph and update host development dependencies and JSR maps to that line. Keep existing peer floors. Account for the newly packaged blossom, catalog, navigation, soulseek and torrent domains without advertising unimplemented host backends.

## 0.8.0

### Minor Changes

- 249fe8c: Add pure approval policy for NAP interfaces, resources, network origins and registered extensions. Grants bind to verified manifest and artifact identities, compose with interface access, and support explicit denial, one-request, session and persistent lifetimes.

## 0.7.0

### Minor Changes

- 6eb1ea4: Hosts can now change firewall budgets after creation. `@kehto/firewall` adds `setUnfocusedMultiplier` and `setBurstGuard`, and `FirewallStateContainer` adds methods with the same names, reachable through `runtime.firewallState`. Both throw `RangeError` on out-of-range values. A multiplier of zero is refused, because focus alone must never empty a budget. Custom `FirewallStateContainer` implementations must add both methods.

## 0.6.4

### Patch Changes

- 66beed4: Widen the `@napplet/core` and `@napplet/nap` peer ranges to admit core 0.38.x and nap 0.37.x while keeping the 0.32.0 floor.

## 0.6.3

### Patch Changes

- 902c1d0: Admit the NIP-5D port-bound napplet release lines in published peers:
  `@napplet/core >=0.32.0 <0.38.0` and `@napplet/nap >=0.32.0 <0.37.0`
  (core 0.37.0 / nap 0.36.0, napplet/web#302). Development stays on the 0.32.0
  baseline.

## 0.6.2

### Patch Changes

- f5c3ee8: Widen the `@napplet/*` peer ranges so the `llm` domain installs without peer conflicts: `@napplet/core` now accepts `>=0.32.0 <0.37.0` and `@napplet/nap` accepts `>=0.32.0 <0.36.0`. The `llm` subpath first ships in `@napplet/nap@0.35.0`, and `@napplet/nap@0.35.1` requires `@napplet/core@^0.36.0`. The old `<0.35.0` cap made npm fail with ERESOLVE and made pnpm print unmet-peer warnings (kehto/web#364).

## 0.6.1

### Patch Changes

- b89015f: Add host-owned NAP-GAMEPAD snapshots and browser focus/visibility hooks, deny native controller paths in Paja/playground frames, and expose the cached injected API. Bind trusted iframe sessions independently of optional SHELL readiness. Preserve the empty handshake-domain compatibility export and report unavailable native readers using the proposed NAP reasons. The optional native Gamepad API replacement awaits clarification of NIP-5D's namespace-only injection restriction. Publish CLI 0.5.5 before the coordinated napplet CLI release selects it as the private Paja runner.

  Accept both the maintained core/NAP 0.32 baseline and the coordinated 0.34 GAMEPAD package set. Existing package API behavior remains covered against both versions.

## 0.6.0

### Minor Changes

- 3231957: Adopt the NAP-RESOURCE Blossom server-hint contract across the injected shell API, reference service, and Paja runtime. Single requests now carry optional advisory servers, bulk requests use per-resource request objects, and Paja validates, caps, and tries accepted hints before host defaults.

## 0.5.0

### Minor Changes

- 9390eca: Move the public Kehto compatibility line to the current Napplet packages and
  align the host implementation with the merged NAP-INC and NAP-INTENT contracts.

## 0.4.0

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

## 0.3.10

### Patch Changes

- 418d22b: Reset expired init-burst counters so reloaded or reopened napplets receive a fresh startup operation budget.

## 0.3.9

### Patch Changes

- 708176b: Chase the published `@napplet/core` and `@napplet/nap` 0.28 line. Kehto package
  peer and JSR metadata now admit the current NAP contract, local demo napplets
  build against the refreshed Napplet toolchain, and `@kehto/services` implements
  the current NAP-OUTBOX publish fanout fields: `relays`, `toOutbox`, and required
  `toInboxes`. `@kehto/paja` also clears stale iframe ownership during target
  reloads so late messages from an old frame cannot mark the runtime ready before
  the reloaded target receives signer-backed identity.

## 0.3.8

### Patch Changes

- 0dbdfe2: Raise the supported `@napplet/core` and `@napplet/nap` peer range through the
  published `0.27.x` line and refresh local demo/fixture napplet package pins.

## 0.3.7

### Patch Changes

- 89f4c11: Express peer and development dependency upper bounds with inclusive maximum ranges for clearer supported-version metadata, including the current Napplet 0.26 line.

## 0.3.6

### Patch Changes

- Accept the released NAP-COUNT-capable `@napplet/core` and `@napplet/nap`
  `0.25.x` line in published package metadata.

  The NAP-COUNT implementation was versioned before the matching napplet package
  release landed, so this patch updates peer/dev ranges and local package graph
  guards without changing Kehto runtime behavior.

## 0.3.5

### Patch Changes

- 91a2c01: Accept `@napplet/core` and `@napplet/nap` 0.24.x peer dependencies across compatible Kehto packages.

## 0.3.4

### Patch Changes

- a07f3cd: Add a NIP-5D injected-domain namespace prelude helper for srcdoc hosts and
  align napplet package peer ranges with the inject-compatible release line.

## 0.3.3

### Patch Changes

- 2dfdebb: Align Napplet dependency ranges with the `resource.bytesMany` package release.

## 0.3.2

### Patch Changes

- 4e0f4b9: Add NAP-LINK runtime parity for the current `@napplet/nap` contract.

  The runtime now dispatches the `link` domain, `@kehto/services` exports a reference `link.open` service, shell capabilities can advertise NAP-LINK, and Paja/playground hosts register link support. Package peer ranges now track the current `@napplet` 0.20 line.

## 0.3.1

### Patch Changes

- fix(deps): widen @napplet peer range to admit 0.13 (kehto/web#48)

  On a `0.x` line a caret pins the minor, so `@napplet/{core,nap}` peers of `^0.12.0`
  resolved to `>=0.12.0 <0.13.0` and excluded the current `@napplet` 0.13 line —
  consumers installing `@napplet 0.13` (e.g. hyprgate's shell) hit a peer mismatch.

  The `@napplet/core` and `@napplet/nap` peer ranges on `@kehto/{acl,runtime,shell,services}`
  (and `@napplet/core` on `@kehto/firewall`) are widened to `>=0.12.0 <0.14.0`, which keeps
  0.12 working while admitting 0.13. kehto's dev deps are bumped to the 0.13 line so its own
  build, type-check, and full unit suite validate against it (all green). No source change —
  kehto consumes `@napplet` for protocol types + the wire format, which is stable across
  0.12 → 0.13.

## 0.3.0

### Minor Changes

- d37ef25: chore: modernize to @napplet 0.12/0.13 (peer dep + core API rename)

  All runtime packages move off the legacy `@napplet/nap` toolchain onto the
  current `@napplet` line:

  - **Peer dependency** `@napplet/core ^0.5` → `^0.12`, and `@napplet/nap ^0.5`
    → `@napplet/nap ^0.12` (the package was renamed upstream; `@napplet/firewall`
    consumers only need `@napplet/core ^0.12`).
  - **Core dispatch API** `registerNap` → `registerNap` and the `NapHandler` type
    → `NapHandler`. The runtime's domain dispatcher now calls `registerNap(...)`
    for every domain.

  **Migration for consumers:** install `@napplet/core@^0.12` and `@napplet/nap`
  (replacing `@napplet/nap`). The kehto wire protocol is unchanged — the legacy
  `inc`/`naps` envelopes are still dual-emitted for the installed 0.5.0 shim
  (removal is tracked as CLEANUP-01) — so no napplet-side code change is required;
  this is a host-side dependency and core-API modernization only.

  Internal kehto identifiers that still carry "nap"/"inc" vocabulary
  (`createNapEnvelopeDispatcher`, `IncDomain`, `inc-handler.ts`, …) are unchanged:
  they are private and the runtime dual-routes `inc`+`inc`.

## 0.2.0

### Minor Changes

- f5148a3: Add `@kehto/firewall` — a behavioral anti-abuse gate, and integrate it into `@kehto/runtime`.

  **New package `@kehto/firewall`** (pure, zero-dependency, WASM-ready, mirrors `@kehto/acl`): a normalized `Observation` plus a pure `evaluate(config, state, observation)` decision engine implementing per-`(napplet, opClass)` token-bucket rate limiting, an init-burst guard, declarative content matchers (event kind / payload size / focus conditions), a soft `unfocusedMultiplier`, and first-match-wins rule precedence (per-napplet policy → init-burst → content matchers → op-class rate → global rate → defaults). Includes pure config mutations with serialize/deserialize (defensive, falls back to defaults on malformed input) and conservative built-in defaults (exceed-action `flag`, init-burst `block`, `0.25×` unfocused).

  **`@kehto/runtime` integration:** every napplet message that passes the ACL check is now evaluated by the firewall before dispatch. Adds a `firewall-state` container, three new **optional** `RuntimeAdapter` hooks (`firewallPersistence`, `onFirewallEvent`, `getFocusContext`), and an allow/deny/ask per-napplet policy that reuses the consent handler ("reject now, prompt async, remember choice"). Config persists; counters are ephemeral. Focus is sourced shell-side (forge-proof), never self-reported by napplets.

  **Note (`@kehto/runtime` public API):** the `ConsentRequest` type gains a `'firewall-policy'` variant and its `event` field is now optional (a firewall consent prompt carries no Nostr event). Existing consent handlers continue to work; handlers that exhaustively switch on `ConsentRequest.type` should add the new variant.
