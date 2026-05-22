# NIP-5D Delta Audit

Date: 2026-05-22

Reference: `https://raw.githubusercontent.com/dskvr/nips/d80d7b25f9c4331acbeb40dbeb3b077caa80e885/5D.md`

Repository snapshot:
- Root HEAD: `ccdb189`
- Nested `napplet` HEAD: `73d5ffc`
- Worktree note: `.omx/` is untracked; no source-file edits were made before this audit document.

Reader: future milestone planner or implementer.

Post-read action: turn the deltas below into a NIP-5D contract milestone without re-discovering current shell and napplet drift.

## Scope

This audit compares the current Kehto playground shell, shared shell/runtime packages, installed playground napplet packages, and every playground napplet against the pinned NIP-5D document above.

It does not audit NUB specs for domain-specific payload semantics. Where current behavior depends on a NUB, this document labels the behavior as "NUB extension / needs contract" rather than treating it as core NIP-5D compliance.

## Pinned NIP-5D Contract Points

The pinned NIP-5D document requires or defines:

1. Napplets are sandboxed iframe applications hosted by a shell.
2. Transport is `postMessage` in both directions with target origin `'*'`.
3. Napplet iframes must use `sandbox="allow-scripts"`; `allow-same-origin` must not be present. Shells may add `allow-forms`, `allow-modals`, `allow-downloads`, or `allow-popups` by policy.
4. Napplets have no access to `localStorage`, `sessionStorage`, `IndexedDB`, direct WebSocket connections, or signing keys. Storage, signing, encryption, and relay access are shell-mediated.
5. Shells identify senders with `MessageEvent.source`; unknown sources must be silently dropped.
6. Shells must not provide `window.nostr` or any signing/encryption primitive to napplet iframes.
7. Wire messages are JSON objects with a string `type` field in `domain.action` format.
8. Unrecognized `type` values must be silently ignored.
9. Napplet identity is assigned by the shell at iframe creation time. No negotiation is required.
10. Identity is the `(dTag, aggregateHash)` tuple from the NIP-5A manifest.
11. Manifest `requires` tags use short NUB names, not spec identifiers.
12. At napplet load time, the shell checks `requires` tags against shell capabilities and should reject or warn when required capability is absent.
13. Shells must implement `window.napplet.shell.supports()`.
14. `supports()` accepts bare NUB names, `nub:` names, and `perm:` permission names.
15. Napplets must gracefully degrade when a capability is absent.
16. NUB specs own valid `type` strings, payloads, and shell behavior for their domains.
17. Napplets produce cleartext only. Shells must not sign or broadcast ciphertext received from a napplet.

## Status Summary

The current implementation is close on iframe isolation, opaque-origin transport, and sender binding. It is not yet a precise NIP-5D contract implementation because capability negotiation is incomplete, manifest `requires` tags are not used by playground napplets, the installed shim provides a static `supports()` fallback instead of shell-derived support, several demo flows use demo-only or gap-filling raw envelopes, and many shell/UI comments still describe the old AUTH/REGISTER model.

## Shell Delta Register

### S-001 - iframe sandbox is aligned

Status: aligned.

Evidence:
- `apps/playground/src/shell-host.ts` creates each playground iframe and adds only `allow-scripts`.
- Grep found no active app/package `allow-same-origin` use outside docs/tests.
- `tests/e2e/gateway-artifact-parity.spec.ts` asserts each gateway-loaded frame contains `allow-scripts` and not `allow-same-origin`.

Contract implication: keep `allow-scripts` as the required baseline. Any future additional sandbox tokens must be explicit shell policy and must never include `allow-same-origin`.

### S-002 - postMessage target origin is aligned

Status: aligned.

Evidence:
- Shell-to-napplet sends use `win.postMessage(msg, '*')` in `packages/shell/src/hooks-adapter.ts`.
- `shell.init` and theme broadcast use `postMessage(..., '*')` in `packages/shell/src/shell-bridge.ts`.
- Napplet helper packages and raw demo envelopes use `window.parent.postMessage(..., '*')`.

Contract implication: this behavior matches NIP-5D because opaque-origin iframes require `'*'`; sender identity must stay based on `MessageEvent.source`.

### S-003 - sender validation is aligned, with split internal representation

Status: aligned with implementation detail.

Evidence:
- `packages/shell/src/shell-bridge.ts` gets `event.source`, looks up a `windowId` in `originRegistry`, and returns without response when the source is unknown.
- `apps/playground/src/shell-host.ts` registers the iframe `contentWindow` before navigation and again on load.
- `apps/playground/src/shell-host.ts` registers `(dTag, aggregateHash)` in `sessionRegistry` for the same `windowId`.

Delta:
- NIP-5D describes mapping the Window reference directly to `(dTag, aggregateHash)`.
- Kehto maps Window -> `windowId` in `originRegistry`, then `windowId` -> `(dTag, aggregateHash)` in `sessionRegistry`.
- `originRegistry.register()` supports optional identity metadata, but the playground path currently calls it without that metadata.

Contract implication: either bless the composed lookup as the official internal representation or require `originRegistry` identity metadata to be populated at iframe creation. The contract should state that every inbound message must resolve from `MessageEvent.source` to the same `(dTag, aggregateHash)` identity before dispatch.

### S-004 - identity is assigned at iframe creation

Status: aligned.

Evidence:
- `apps/playground/src/shell-host.ts` fetches `/napplet-gateway/<dTag>/manifest.json` before iframe navigation.
- It validates `metadata.dTag === name`, non-empty `aggregateHash`, and non-empty `htmlUrl`.
- It registers a `SessionEntry` with `provenance: 'nip-5d'`, `pubkey: ''`, `dTag`, and `aggregateHash` before setting `iframe.src`.

Contract implication: keep this as the canonical NIP-5D path. Identity is not negotiated by the napplet.

### S-005 - gateway metadata is aligned, but `requires` are absent from the gateway contract

Status: drift.

Evidence:
- `apps/playground/vite.config.ts` reads `.nip5a-manifest.json`, validates the `d` tag, and returns only `{ dTag, aggregateHash, htmlUrl }` from gateway metadata.
- It does not return manifest `requires` tags.
- `apps/playground/src/shell-host.ts` only validates `dTag`, `aggregateHash`, and `htmlUrl`.

Delta:
- NIP-5D says at napplet load time the shell checks manifest `requires` tags against shell capabilities.
- The current playground load contract has no `requires` field, so the shell cannot perform the NIP-5D load-time check.

Contract implication: gateway metadata should expose parsed NIP-5A `requires` tags, and the playground shell should check them before iframe navigation or before marking the napplet usable.

### S-006 - all current playground manifests omit `requires`

Status: drift at napplet contract level, visible from shell.

Evidence:
- All 13 built `.nip5a-manifest.json` files under `apps/playground/napplets/*/dist/` have no `requires` tags.
- `apps/playground/napplets/shared-vite-config.ts` calls `nip5aManifest({ nappletType, artifactMode: 'single-file' })` and does not pass `requires`.

Delta:
- The NIP allows no `requires` tags, but these napplets actively use NUB domains. The absence of `requires` means the shell has no declarative capability contract to validate.

Contract implication: each napplet should declare the short NUB names it requires, or the milestone must explicitly decide that playground demos intentionally omit requirements and rely only on runtime degradation.

### S-007 - `window.napplet.shell.supports()` is not shell-derived in current playground napplets

Status: drift.

Evidence:
- The installed `@napplet/shim@0.3.0` sets `window.napplet.shell.supports` to a static fallback based on `NUB_DOMAINS`.
- Grep found no `shell.ready` send in the installed shim.
- The shell implements a `shell.ready` -> `shell.init` response, but the current installed shim does not request or consume it.
- No playground napplet source calls `window.napplet.shell.supports()`.

Delta:
- NIP-5D says shells must implement `window.napplet.shell.supports()`.
- The current visible function is napplet-side static feature knowledge, not actual shell capabilities.
- It can return true for NUB domains that the particular shell did not advertise.

Contract implication: the milestone must define how the shell installs or feeds `supports()`. Options include a shell-init handshake consumed by the shim, an injected capability bootstrap in served HTML, or another source-bound mechanism. Static shim fallback should be limited to shell-less preview and must not be the contract for hosted napplets.

### S-008 - shell capability list is incomplete relative to installed shim domains

Status: drift / needs contract.

Evidence:
- `packages/shell/src/shell-init.ts` advertises `identity`, `storage`, `ifc`, `theme`, `keys`, `media`, `notify`, `config`, `resource`, and optionally `relay`.
- The installed/core NUB domain list also includes `connect` and `class`.
- The playground shell has class/connect behavior through CSP/meta/session class machinery, but `buildShellCapabilities()` does not advertise `connect` or `class`.

Delta:
- If `connect` and `class` are treated as NUB capabilities, `supports('nub:connect')` and `supports('nub:class')` should reflect shell support.
- The current contract is split between NIP-5D capability query, NUB-CONNECT meta/CSP behavior, and class payloads.

Contract implication: decide whether `connect` and `class` are NIP-5D-advertised NUBs in Kehto. If yes, add them to shell capabilities and make the shim consume shell capabilities.

### S-009 - JSON object envelope is aligned at the shell boundary

Status: aligned.

Evidence:
- `packages/shell/src/shell-bridge.ts` accepts only plain object messages with a string `type`.
- Legacy NIP-01 arrays and malformed shapes are silently dropped at the bridge.
- `packages/runtime/src/runtime.ts` also drops non-object messages and messages without `domain.action`.

Contract implication: keep NIP-5D object envelopes as the only active shell boundary. Do not reintroduce NIP-01 array verbs as a happy path.

### S-010 - unknown domain handling is aligned, but unknown known-domain actions are mixed

Status: partial drift.

Evidence:
- Runtime tests assert unknown NUB domains silently emit nothing.
- Runtime dispatch returns false for unknown domains.
- Some known-domain unknown actions emit `.error` envelopes, for example storage and notify tests.
- Other known-domain unknown actions are silently ignored, for example config and resource service comments.

Delta:
- NIP-5D says messages with an unrecognized `type` must be silently ignored.
- Current behavior is not uniform for unknown actions inside known NUB domains.

Contract implication: the future contract must decide whether NUB specs are allowed to define explicit errors for invalid actions. If not, storage/notify/media/identity service behavior should be normalized to silent ignore for unrecognized type strings.

### S-011 - no `window.nostr` exposure to napplets is aligned

Status: aligned for current playground.

Evidence:
- `packages/shell/src/shell-init.ts` explicitly does not expose a NIP-07 proxy.
- `packages/shell/tests/no-window-nostr.test.ts` enforces no `window.nostr` assignment or `_shellRequest` helper in shell init.
- `apps/playground/src/signer-connection.ts` uses host-page `window.nostr` only to connect an external signer to the shell; comments state napplets never see it.
- Grep found no active `window.nostr` access in playground napplet source, only anti-feature comments.

Contract implication: keep this invariant. Host signer access is allowed only in the trusted shell, never in napplet iframe globals.

### S-012 - signing/encryption mediation needs tighter NIP-5D wording

Status: NUB extension / needs contract.

Evidence:
- Napplets call relay and identity NUB helpers such as `relayPublish`, `relayPublishEncrypted`, and `identityDecrypt`.
- Shell/services mediate signer and crypto access.

Delta:
- NIP-5D core says shells must not provide `window.nostr` or any signing/encryption primitives.
- Current NUB surfaces include encryption/decryption operations mediated by the shell. This can be compliant only if the contract distinguishes "raw primitive exposed to napplet" from "NUB-mediated, policy-gated shell operation."

Contract implication: document the exact allowed NUB-mediated crypto surfaces, especially `relay.publishEncrypted` and `identity.decrypt`, and explicitly forbid raw key material or raw NIP-07-compatible primitives.

### S-013 - direct napplet storage/network/key access appears absent in source

Status: aligned in current source.

Evidence:
- Grep over playground napplet sources found no active `localStorage`, `sessionStorage`, `indexedDB`, `WebSocket`, direct signing, or direct `window.nostr` usage.
- The only `localStorage` hit is a comment in `preferences`.

Contract implication: keep grep/static guards for these anti-features. The future contract should separate napplet-forbidden APIs from shell-internal use of `localStorage` and WebSockets.

### S-014 - `window.nostrdb` is installed by the shim and is outside core NIP-5D

Status: extension / needs contract.

Evidence:
- `napplet/packages/shim/src/nipdb-shim.ts` installs `window.nostrdb`.
- Installed `@napplet/shim@0.3.0` includes that code.
- It sends `nostrdb.*` envelopes over `postMessage`.

Delta:
- NIP-5D forbids `window.nostr`, not `window.nostrdb`, but it also says NUB specs define protocol domains.
- `nostrdb` is not part of the pinned NIP-5D core.

Contract implication: either define `nostrdb` as a NUB-backed extension with capability advertisement, or remove it from the default hosted shim surface.

### S-015 - active playground uses installed `@napplet/*@0.3.0`, not local nested shim/core/nub source

Status: packaging delta.

Evidence:
- Root `package.json` only overrides `@napplet/vite-plugin` to `link:napplet/packages/vite-plugin`.
- Playground napplet package files depend on `@napplet/shim`, `@napplet/nub`, `@napplet/sdk`, and `@napplet/core` version `0.3.0`.
- Symlinks resolve `@napplet/shim` to `node_modules/.pnpm/@napplet+shim@0.3.0/...`, not `napplet/packages/shim`.

Delta:
- Changes in `napplet/packages/shim`, `napplet/packages/core`, or `napplet/packages/nub` do not automatically change playground behavior unless the workspace links or package versions are changed.

Contract implication: milestone work touching shim/NUB behavior must first decide whether playground consumes local package sources or published `0.3.0` packages.

### S-016 - stale AUTH/REGISTER/NIP-01 wording remains in shell UI/support code

Status: stale contract wording.

Evidence:
- `apps/playground/src/shell-host.ts`, `apps/playground/src/main.ts`, `apps/playground/src/debugger.ts`, `apps/playground/src/sequence-diagram.ts`, and related UI files still mention AUTH, REGISTER, NIP-01 verbs, and legacy auth paths.
- Runtime and shell type comments still mention legacy AUTH in several places even where active dispatch is NIP-5D envelope-only.

Delta:
- Pinned NIP-5D says identity is assigned at iframe creation and no negotiation is required.
- Stale wording makes it easy to design future work around the removed AUTH model.

Contract implication: a NIP-5D cleanup milestone should rename "authenticated" UI/state concepts to "registered", "ready", or "identity-bound" unless they refer to a separate user/signer authentication state.

## Shared Napplet Runtime Delta Register

### N-CORE-001 - all playground napplets import `@napplet/shim`

Status: aligned baseline.

Evidence:
- Each of the 13 `apps/playground/napplets/*/src/main.ts` files imports `@napplet/shim`.

Delta:
- This creates a common napplet runtime surface. Any shim drift affects every playground napplet.

Contract implication: fix shared transport/capability behavior in the shim first, then reduce per-napplet custom code.

### N-CORE-002 - shim inbound messages validate `event.source === window.parent`

Status: aligned.

Evidence:
- The installed and source shim central envelope handler drops messages not from `window.parent`.

Contract implication: keep this as the napplet-side mirror of shell `MessageEvent.source` validation.

### N-CORE-003 - shim static `supports()` fallback is not enough for hosted NIP-5D

Status: drift.

Evidence:
- The shim fallback answers from the package's known `NUB_DOMAINS`.
- It cannot know actual shell capabilities or sandbox permissions.

Contract implication: hosted napplets must receive shell capability state before relying on `supports()`. Fallback behavior should be explicitly documented as shell-less preview only.

### N-CORE-004 - shim exposes extension globals and domains

Status: extension / needs contract.

Evidence:
- The shim installs `window.napplet.connect`, `window.napplet.class`, and `window.nostrdb`.
- `connect` uses meta/CSP discovery, not a postMessage wire protocol.
- `class` is shell-assigned state.

Delta:
- Pinned NIP-5D allows NUB extension specs but does not define these domains.

Contract implication: the future milestone must either link the relevant NUB specs into the contract or separate them from NIP-5D core compliance.

## Per-Napplet Delta Register

Common facts for every playground napplet:
- Imports `@napplet/shim`.
- Uses NIP-5D object envelopes through shim/NUB helpers or narrowly scoped raw envelopes.
- Built manifest currently has no `requires` tags.
- Source has no active direct `window.nostr`, direct browser storage, direct IndexedDB, direct WebSocket, or direct signing-key use.
- Source does not call `window.napplet.shell.supports()`.

### P-001 - `bot`

Primary purpose: bot auto-responder.

Uses:
- `ifc` via `ifcEmit` and `ifcOn`.
- `storage` via `storageGetItem` and `storageSetItem`.
- Notification-like behavior through an IFC topic `notifications:create`.

Deltas:
- Missing manifest `requires` for `ifc` and `storage`; possibly also whatever NUB/service owns `notifications:create`.
- Does not call `shell.supports()` before using `ifc` or `storage`.
- Degrades through try/catch logging, not through NIP-5D capability query.
- Comments and UI state use `authenticated` / `auth failed` / "AUTH implicitly", which is stale relative to iframe-creation identity.

Milestone contract question: should IFC topics that route to host services be represented in `requires`, and if so as `ifc`, `notify`, or a service-specific NUB?

### P-002 - `chat`

Primary purpose: chat UI with bot round-trip and optional relay publish/subscribe.

Uses:
- `ifc` via `ifcEmit` and `ifcOn`.
- `storage` for history.
- `relay` for optional publish and subscribe.
- Notification-like behavior through an IFC topic `notifications:create`.

Deltas:
- Missing manifest `requires` for `ifc`, `storage`, and `relay`; possibly notification/service dependency.
- Does not call `shell.supports()` before using required/optional capabilities.
- Some relay failures degrade through try/catch; the main IFC/storage path does not use capability preflight.
- Comments and UI state still use "authenticated" and "auth failed".

Milestone contract question: optional showcase capabilities need a convention. Either declare all used NUBs in `requires`, or declare only hard requirements and gate optional features with `supports()`.

### P-003 - `composer`

Primary purpose: publish plaintext or encrypted relay events.

Uses:
- `identity` via `identityGetPublicKey` as an init probe.
- `relay` via `relayPublish` and `relayPublishEncrypted`.

Deltas:
- Missing manifest `requires` for `identity` and `relay`.
- Does not call `shell.supports()` before using identity/relay.
- `identityGetPublicKey` is used to trigger shell/demo readiness detection rather than as a true data dependency.
- `relayPublishEncrypted` is a NUB-mediated crypto/signing path that must be explicitly covered by the contract.
- Comments and UI state still refer to AUTH detection and `authenticated`.

Milestone contract question: replace readiness probes with a real NIP-5D shell capability/ready mechanism, then gate encrypted publishing under the NUB contract.

### P-004 - `config-demo`

Primary purpose: demonstrate config read/subscribe behavior.

Uses:
- `config` via config SDK helpers.

Deltas:
- Missing manifest `requires` for `config`.
- Does not call `shell.supports('config')` or `shell.supports('nub:config')`.
- Graceful degradation is mostly error-display based, not capability-query based.

Milestone contract question: decide whether config schema presence alone is enough or whether config must be declared in `requires`.

### P-005 - `decrypt-demo`

Primary purpose: demonstrate identity decrypt flows.

Uses:
- `identity` via `identityDecrypt`.
- A raw message listener for host-supplied `demo.decrypt.fixtures`.

Deltas:
- Missing manifest `requires` for `identity`.
- Does not call `shell.supports()` before using decrypt.
- Raw `demo.decrypt.fixtures` is a demo-only domain outside pinned NIP-5D unless a `demo` NUB is defined.
- `identityDecrypt` must be contractually classified as an allowed NUB-mediated operation, because NIP-5D core forbids exposing raw encryption primitives.

Milestone contract question: replace fixture injection with a declared demo/test NUB or keep it behind a test-only shell surface not counted as NIP-5D app behavior.

### P-006 - `feed`

Primary purpose: relay-backed feed viewer.

Uses:
- `relay` via `relaySubscribe`.

Deltas:
- Missing manifest `requires` for `relay`.
- Does not call `shell.supports()` before subscribing.
- Degrades on relay failure through status text/logging.
- Comments and UI state still use "authenticated" and "auth failed".

Milestone contract question: make relay required in the manifest, or support a no-relay empty-state mode gated by `supports('relay')`.

### P-007 - `hotkey-chord`

Primary purpose: register a keyboard action and react to forwarded chords.

Uses:
- `keys` via `keysRegisterAction` and `keysOnAction`.

Deltas:
- Missing manifest `requires` for `keys`.
- Does not call `shell.supports()` before registering key actions.
- Uses `authenticated` UI wording for readiness.

Milestone contract question: define whether keys are required for loading or optional with an unavailable-controls state.

### P-008 - `media-controller`

Primary purpose: create and control a media session.

Uses:
- `media` via media SDK helpers.

Deltas:
- Missing manifest `requires` for `media`.
- Does not call `shell.supports()` before creating/reporting media sessions.
- Uses `authenticated` UI wording for readiness.

Milestone contract question: define the fallback when the shell lacks media support. Current behavior is error/status based.

### P-009 - `preferences`

Primary purpose: persist user preferences and react to shell theme changes.

Uses:
- `storage` via storage SDK helpers.
- Raw `message` listener for `theme.changed`.

Deltas:
- Missing manifest `requires` for `storage` and likely `theme`.
- Does not call `shell.supports()` before using storage or accepting theme pushes.
- The raw listener is source-guarded and type-guarded, but it duplicates shim message handling for `theme.changed`.
- The source comment says no raw message listener, but the file now has one; the comment is stale.
- UI uses `auth failed` for init failure.

Milestone contract question: expose theme subscription through the shim/NUB SDK so this napplet no longer needs a raw listener, or define source-guarded raw listeners as acceptable for shell push domains.

### P-010 - `profile-viewer`

Primary purpose: show identity public key/profile.

Uses:
- `identity` via `identityGetPublicKey` and `identityGetProfile`.

Deltas:
- Missing manifest `requires` for `identity`.
- Does not call `shell.supports()` before identity access.
- Comments and UI state still use "authenticated" and "auth failed".

Milestone contract question: identity support should likely be a declared hard requirement, because this napplet has no meaningful no-identity mode.

### P-011 - `resource-demo`

Primary purpose: demonstrate resource byte fetch authorization.

Uses:
- `resource` through raw `resource.bytes` envelopes.
- Raw message listener for `resource.*` responses.

Deltas:
- Missing manifest `requires` for `resource`.
- Does not call `shell.supports()` before using resource fetch.
- Uses raw envelopes because the installed `@napplet/nub/resource` helper surface does not match the demo's expected shape.
- The raw listener is source-guarded and `resource.` type-guarded.
- Uses a localhost granted URL and an RFC-2606 denied URL as demo policy fixtures.

Milestone contract question: align the resource SDK and service wire shape, then replace raw envelope code with the canonical helper surface.

### P-012 - `theme-switcher`

Primary purpose: send theme changes to the shell.

Uses:
- `identity` via `identityGetPublicKey` as an init probe.
- Raw `demo.publishTheme` envelope to the shell.

Deltas:
- Missing manifest `requires` for `identity` and whatever domain owns theme publish.
- Does not call `shell.supports()` before identity or theme behavior.
- `demo.publishTheme` is not a NIP-5D core domain and is not a documented NUB domain in this audit.
- Uses identity call to trigger demo readiness detection.
- Comments and UI state still refer to AUTH and `authenticated`.

Milestone contract question: define a real `theme.publish` / `theme.set` NUB action or keep `demo.publishTheme` as a test-only host control outside NIP-5D conformance.

### P-013 - `toaster`

Primary purpose: create, list, and dismiss notifications.

Uses:
- `identity` via `identityGetPublicKey` as an init probe.
- Raw `notify.create` and `notify.list` envelopes.
- Notify SDK helper for dismiss.
- Raw message listener for `notify.*` responses.

Deltas:
- Missing manifest `requires` for `identity` and `notify`.
- Does not call `shell.supports()` before identity/notify behavior.
- Uses raw envelopes because the installed notify SDK lacks the create/list surface this demo needs.
- The raw listener is source-guarded and `notify.` type-guarded.
- Comments and UI state still refer to AUTH and `authenticated`.

Milestone contract question: extend/align the notify SDK with the shell service contract, then replace raw create/list/listener code with canonical helpers.

## Cross-Napplet Delta Themes

### C-001 - no napplet currently exercises runtime capability query

Every napplet imports the shim, but none calls `window.napplet.shell.supports()`. This means the playground does not validate the NIP-5D capability-query contract in app code.

Milestone direction: add capability preflight or feature gating to each napplet based on its required and optional NUBs.

### C-002 - `requires` tags are the largest declarative contract gap

Every napplet uses at least one NUB surface, but every built manifest currently omits `requires` tags. This prevents the shell from enforcing or warning at load time.

Milestone direction: add `requires` to `definePlaygroundNappletConfig()` calls or per-napplet configs, expose `requires` through gateway metadata, and add a shell load-time check.

### C-003 - readiness is still named like AUTH

Many napplets and shell UI surfaces use `authenticated` / `auth failed` sentinels. In pinned NIP-5D, identity is assigned at iframe creation and no AUTH negotiation is required.

Milestone direction: rename protocol readiness concepts to `identity-bound`, `registered`, `ready`, or another term that does not imply NIP-42 AUTH.

### C-004 - raw demo envelopes need a contract boundary

The following raw/domain-specific flows are not self-evidently covered by pinned NIP-5D core:
- `demo.publishTheme`
- `demo.decrypt.fixtures`
- raw `notify.create` / `notify.list`
- raw `resource.bytes`
- raw `theme.changed` listener in `preferences`

Milestone direction: either promote these to documented NUB specs/SDK helpers or classify them as demo/test-only surfaces excluded from NIP-5D conformance.

### C-005 - installed shim/package source mismatch can hide fixes

The repo contains `napplet/packages/shim`, `napplet/packages/core`, and `napplet/packages/nub`, but playground napplets consume installed `0.3.0` packages. Fixes in nested source will not affect playground behavior without package linking/version work.

Milestone direction: make playground consume local package sources for protocol work, or explicitly publish/bump package versions as part of each milestone.

## Proposed Future Milestone Work Items

1. Define the Kehto NIP-5D contract document from the pinned NIP-5D source.
2. Replace RUNTIME-SPEC AUTH/REGISTER/NIP-01 content with NIP-5D object-envelope identity-at-creation content.
3. Implement shell-derived `window.napplet.shell.supports()` for hosted napplets.
4. Add manifest `requires` declarations to every playground napplet.
5. Expose and check `requires` in the playground gateway load path.
6. Decide and document whether `connect`, `class`, `nostrdb`, `identity.decrypt`, and `relay.publishEncrypted` are official NUB extensions.
7. Normalize unknown `type` behavior across known domains or document NUB-level error exceptions.
8. Replace raw demo envelopes with NUB SDK helpers or mark them test/demo-only.
9. Rename stale AUTH/REGISTER/`authenticated` language in shell UI, comments, docs, and napplet sentinels.
10. Ensure playground consumes the package sources being changed during protocol work.
11. Add static tests for forbidden napplet APIs, missing `requires`, `supports()` use, sandbox policy, source validation, and raw demo-envelope exceptions.

## Verification Performed

Read-only checks performed while preparing this audit:
- Fetched the pinned NIP-5D document from the user-provided raw GitHub URL.
- Grepped shell and runtime sources for sandbox, `postMessage`, `MessageEvent.source`, `window.nostr`, AUTH/REGISTER, `supports`, and `requires`.
- Grepped every playground napplet source for `@napplet/shim`, raw `postMessage`, raw message listeners, `shell.supports`, forbidden storage/network/signing APIs, and stale AUTH wording.
- Checked every built playground napplet manifest for `requires` tags.
- Checked root workspace configuration and package resolution for `@napplet/*` package consumption.

No tests were run because this task produced an audit document only.
