# @kehto/shell

## Relay approval boundary

The shell relay adapter executes approved destination snapshots through
`subscribeToRelays()` and `publishToRelays()`. Its selector is used only while
planning and never re-runs after approval.

Browser adapter over `@kehto/runtime` for iframe/session hosting.

`ShellAdapter.permissions` connects host approval adapters to runtime. Trusted
`OriginIdentity.permissionPrincipal` is carried into the source session; app
messages cannot override it. The reference LINK service uses this shared path.
See [scoped approvals](/firewall-approvals) for lifetimes, persistence, and
host migration status.

The bridge exposes runtime admission through `bridge.runtime.permissions`.
`admitBrowserDocument` performs provisional registration, `admit`, CSP/namespace
preparation, and the final currentness check before a synchronous frame commit.
Paja's verified, local-file, and live development frames use this transaction
before scripts execute.

`createBrowserApprovalUi` presents the runtime prompt as a plain-language
question with the host's label for the napplet, every exact scope, and the
offered lifetimes with the narrowest preselected, so one click answers. The
full technical identity is one disclosure away. Network origins sharing one
mediated operation, such as an outbox plan's relays, are one "contact N
origins" row listing the exact origins (collapsed beyond `openOriginLimit`, default 5); each is still granted
on its own. It returns explicit allow,
deny, or cancel decisions; Deny has initial focus, and Escape, close, and abort
cancel. Its grant view is a tree of single-line rows (napplet, interface,
grant) with a status dot, a count or lifetime, and an icon button per row;
identity and the full scope appear on expand. A default allow writes no grant
(kehto/web#513), so rule-allowed access isn't listed; the deprecated counted
row only shows `rule:` grants an older runtime made. It and delegates single and group revoke, clear, and persistence
retry to the runtime. Given `rules`, it also renders an editor for the host's
default rules, offers to turn a prompt answer into a standing rule for that
napplet, and on a tightening rule change (anything but moving rules toward
allow) calls `RuntimePermissions.rulesChanged()` so live work admitted under
the old rules closes; its napplet list includes `RuntimePermissions.principals`.
`onAnswer(answer, userGesture)` reports each answer and whether a real click
made it, for hosts that run a gesture-gated browser action from that click. The UI
ships unstyled; add `BROWSER_APPROVAL_UI_STYLES` to a `<style>` element or
style the `kehto-approval-*` and `kehto-fw-*` classes yourself. Storage failures remain visible and
block new grants. A host retirement callback must remove live direct-network
frames when a relevant grant changes; the parent cannot meter direct iframe
traffic.

For collapsible grant-management panels, set `promptMount: document.body` on
`createBrowserApprovalUi` so a hidden panel cannot hide a modal and block the
page. Without `promptMount`, prompts share `mount`. `destroy()` removes both
surfaces and cancels outstanding prompts.

> **Alpha status:** Kehto is an early runtime toolkit for a draft NIP-5D
> protocol. Injected-domain behavior and NAP contracts are not final.

Browser source grants follow CSP scheme/port matching, including HTTP to HTTPS
upgrades; the approval UI discloses this when relevant. Mediated network scopes
continue to require exact canonical origins.

## Install

```bash
pnpm add @kehto/shell @kehto/runtime @kehto/acl @napplet/core @napplet/nap nostr-tools
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/shell/package.json`, `packages/shell/src/index.ts` |
| Version | `0.36.0` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Dependencies | `@kehto/acl`, `@kehto/runtime` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `@napplet/core` | `>=0.32.0 <0.46.0` |
| `@napplet/nap` | `>=0.32.0 <0.46.0` |
| `nostr-tools` | `>=2.23.3 <=2.x` |

## Primary APIs

| Area | Exports |
|------|---------|
| Factory | `createShellBridge`, `ShellBridge`, `NAPPLET_HELLO` |
| Hooks | `adaptHooks`, `randomUUID`, `BrowserDeps`, `ShellAdapter`, `ShellCapabilities`, `UploadHooks`, `IntentHooks`, `LinkHooks`, `CommonHooks`, `ListsHooks`, `SerialHooks`, `BleHooks`, `WebrtcHooks`, `DmHooks`, `UnroutedMessageInfo`, `NappletRevocation`, `NappletRevocationReason`, `NappletMessageDecision`, `MAX_DEFERRED_MESSAGES`, `NappletMessageTarget` |
| Protocol and capability types | `NostrEvent`, `NostrFilter`, `NappletMessage`, `Capability`, `ALL_CAPABILITIES` |
| Shell init and bootstrap | `buildShellCapabilities`, `injectNappletNamespacePrelude`, `renderNappletNamespacePrelude`, `NappletNamespacePreludeOptions` |
| Verified documents and CSP | `prepareNappletSrcdoc`, `NappletSrcdocOptions`, `buildNappletCsp`, `renderNappletCspMeta`, `injectNappletCsp`, `NappletCspOptions`, `NappletCspDirectives`, `NappletCspDirective` |
| Browser admission and approval | `admitBrowserDocument`, `BrowserAdmissionRequest`, `BrowserAdmissionResult`, `BrowserAdmissionCommit`, `BrowserAdmissionOmission`, `BrowserLaunchMode`, `BrowserRemoteSource`, `createBrowserApprovalUi`, `BrowserApprovalUi`, `BrowserApprovalUiOptions`, `BrowserApprovalRules`, `BROWSER_APPROVAL_UI_STYLES` |
| Registries and caches | `sessionRegistry`, `nappKeyRegistry`, `originRegistry`, `manifestCache`, `audioManager`, `PendingUpdate`, `ManifestCacheEntry`, `AudioSource` |
| Enforcement re-exports | `FirewallEvent`, `FirewallPersistence`, `createEnforceGate`, `createNapEnforceGate`, `formatDenialReason`, `EnforceResult`, `EnforceConfig`, `NapEnforceConfig`, `IdentityResolver`, `AclChecker`, `NapMessage` |
| Proxies | `createIdentityProxy`, `createThemeProxy`, `createKeysProxy`, `createMediaProxy`, `createNotifyProxy` |
| Shell-owned internal models | resource request/result/error types |
| Topics | `TOPICS`, `TopicKey`, `TopicValue` |

## Scope Boundaries

- Implements NIP-5D port-bound identity ([nips#2303 at `51ef0cd`](https://github.com/nostr-protocol/nips/blob/51ef0cd33a5694784306f3260d90b1872545fdee/5D.md)): the prelude sends one window-level `napplet.hello` with a private `MessagePort`; the bridge binds the registered identity to that port, sends NAP only over it (`originRegistry.postToNapplet`), and revokes on a second hello, any other window-level message, an invalid hello, a second load (`ShellBridge.observeFrame`) or the port closing. Hosts remove revoked frames in `ShellAdapter.onNappletRevoked`, observe port traffic with `onNappletMessage`, and create a fresh iframe per navigation; `originRegistry.register()` refuses a spent `Window`. See `NIP5D_WINDOW_TRANSPORT_RETIRED` in the [compatibility register](https://github.com/kehto/web/blob/main/docs/compatibility.md).
- Lets a host decide what happens to port traffic with `ShellAdapter.filterNappletMessage` (`'dispatch' | 'drop' | 'defer'`) and `ShellBridge.releaseDeferred`. `shell.ready` skips the filter, deferred envelopes keep their order and meet approvals and budgets at release rather than arrival, and a window holding more than `MAX_DEFERRED_MESSAGES` is revoked with `deferred-overflow`. NAP docs don't define a request a host holds or drops, so a dropped request gets no reply. Checked against NAP-SHELL at `napplet/naps@43cb3a4`.
- Owns browser integration: `window`, `postMessage`, iframe session identity, verified document preparation, shell capabilities, origin/session registries, and browser-specific adapters.
- Forwards an asynchronous `RelayPoolLike.publish()` promise through its
  runtime adapter so `relay.publish.result` reflects transport settlement.
- Forwards the originating runtime window to `AuthHooks.getSigner(windowId?)`
  when available. The optional context lets a host implement caller-aware
  signer consent without making that policy part of Kehto's shell adapter.
- Preserves an asynchronous `RelayPoolHooks.publishToScopedRelay()` result so
  scoped publication does not report success before transport acceptance.
- Provides `prepareNappletSrcdoc()` outside verified bytes and exposes only host-selected domains before authored scripts. Optional SHELL provides environment information; source-bound routing does not depend on readiness. See [NAP-SHELL](https://github.com/napplet/naps/blob/master/naps/NAP-SHELL.md).
- Its injected resource projection follows [NAP-RESOURCE at `ae5b9c6`](https://github.com/napplet/naps/blob/ae5b9c64ab8a4d8909f288829a01e99d6bd713bc/naps/NAP-RESOURCE.md): wire requests carry `id` plus `url` or ordered `urls`. Responses carry canonical padded base64; the web binding validates and converts it into `Blob` values. Legacy object payloads and noncanonical base64 are rejected. Blossom discovery hints belong in the URI or trusted resolver configuration, not a wire `servers` field.
- Forwards `ShellAdapter.aclDefaultPolicy` to the runtime, so a host can start unknown identities with nothing granted. With `permissions` set it's a ceiling approvals can't exceed.
- Advertises `count` in shell capabilities and the injected `window.napplet` namespace only when `ShellAdapter.services.count` is wired, so `shell.supports("count")` tracks an actual NAP-COUNT backend.
- Forwards optional `permissions.rateLimiter`, `permissions.promptRateLimiter`, `legacyFirewall`, `getFocusContext` and diagnostics without constructing temporal defaults. Hosts retain their limiter instance for configuration changes.
- Surfaces unroutable inbound messages via the optional `ShellAdapter.onUnroutedMessage` hook (`UnroutedMessageInfo`) — observe-only; the bridge still drops messages from unidentified or unregistered windows, but hosts can now log them instead of debugging a silent vanish.
- Advertises and injects `dm` or `fs` only when the matching runtime service is registered and host domain policy permits it.
- Treats `keys.forward` as napplet-to-shell only; shell-initiated key actions are emitted as `keys.action` through the keys proxy/runtime service path.
- Keeps identity/theme proxy delivery fail-closed. Hosts publish automatic changes only through `ShellBridge.publishIdentityChanged()` / `publishTheme()`, which filter by live session, granted domain, and current ACL. The session and its frozen grants exist from the window's first valid `napplet.hello`, so a napplet that only listens receives these pushes (and service broadcasts such as `theme.changed` from `@kehto/services`) without sending a message or `shell.ready` first; revoking or replacing the binding removes it as a target.
- Lets `bridge.runtime.aclState.persist()` and `clear()` report a browser
  `localStorage` write failure as `false`. The mutation remains live, while a
  fresh bridge continues to load the previous durable ACL until a retry
  succeeds. This host adapter behavior changes no NAP wire message or field;
  unrelated persistence adapters remain best-effort.
- Must not expose `window.nostr` to napplets.
- Does not implement service behavior itself; register reference services from `@kehto/services` on the underlying runtime.

## API Reference

### Advertisement follows routing

While a bridge is live for an adapter, `buildShellCapabilities`,
`resolveShellEnvironment` and `getShellDomainState` count a declared service as
live only if `bridge.runtime.hasService(name)` is true. A handler added to
`ShellAdapter.services` after `createShellBridge()` is left out of `shell.init`
and domain injection, and logs `[KEHTO_SERVICE_NOT_REGISTERED]` once per service
per bridge, until the host calls `bridge.runtime.registerService(name, handler)`.
Unregistering stops advertisement for new frames. An adapter with no live bridge
keeps the plain declared-services reading. See
[Services that arrive late](/how-tos/register-service#services-that-arrive-late).

### Source environment lifetime

Retire a window with `bridge.runtime.destroyWindow(windowId)`,
`bridge.runtime.sessionRegistry.unregister(windowId)`, and
`originRegistry.unregister(windowId)`. Services get `onWindowDestroyed` once per
session registration, however many of these teardown calls run. A replacement `originRegistry.register()`
gets its own environment, even if it reuses the logical window ID. It must use a
fresh iframe: a `Window` that handed over its NIP-5D port cannot be registered again. Set its snapshot with `originRegistry.setEnvironment()` before dispatch;
otherwise the bridge resolves current host defaults. Retired cached domains and
service names cannot carry into the replacement's `shell.init` or domain admission.
Other domains remain usable before optional readiness, and duplicate readiness
messages do not replace a live session or send another snapshot.

This host lifecycle policy follows
[NAP-SHELL at `19de5ce`](https://github.com/napplet/naps/blob/19de5ce1cea40cd4c76089cdd8126e9f87648049/naps/NAP-SHELL.md)
and changes no wire messages.

For host CSP examples and validation rules, see
[Host CSP overrides](https://github.com/kehto/web/blob/main/packages/shell/README.md#host-csp-overrides) and the
[CSP enforcement contract](https://github.com/kehto/web/blob/main/docs/policies/NIP-5D-CONFORMANCE.md#shell-csp-enforcement).
The preparation API accepts already-verified HTML; it does not replace artifact
verification, iframe sandboxing, identity registration or message-source checks.

- Generated module: <a href="../api/modules/_kehto_shell.html" target="_self"><code>docs/api/modules/_kehto_shell.html</code></a>

## NIP-5D event compatibility

Current manifests use a direct artifact `x` hash, plain-text `content`, role-matched
`z`/`i` intent declarations, and required `R` / optional `O` domains. Kehto also
accepts legacy aggregate events through an isolated compatibility adapter.
Existing `aggregateHash` host/cache/ACL fields carry the verified artifact hash
for current events; legacy identities keep their original aggregate. Both paths
verify signatures and bytes before runtime injection and `srcdoc` execution.
For the schema and removal boundary, see [event migration](https://kehto.github.io/web/docs/migrations/NIP-5D-EVENT-SCHEMA.html).

### Intent delivery

The injected `window.napplet.intent.onDelivery(handler)` returns a closeable
subscription and drains buffered parent deliveries in order. Register it to
receive `{ sender, archetype, action, convention, payload? }`; INC is not required.
Its receiver is installed before `shell.ready` and survives namespace reassignment.
A throwing listener does not prevent delivery to other listeners.

When no canonical listener is registered, matching legacy INC listeners can
consume the delivery locally. This emits `KEHTO_COMPAT_INTENT_INC` once per
iframe; a delivery is never replayed to both APIs. See [compatibility tracking](https://github.com/kehto/web/blob/main/docs/compatibility.md).
Delivery and URI invocation follow NAP-INTENT PR #106 at
`fc121fc264615482143eda86125863d2e1f741a2`; the packaged SDK still trails that
contract, as documented in the conformance policy.

## URI invocation

Kehto follows [NAP-INTENT PR #106](https://github.com/napplet/naps/blob/fc121fc264615482143eda86125863d2e1f741a2/naps/NAP-INTENT.md) at `fc121fc264615482143eda86125863d2e1f741a2`. The protected binding supports
`window.napplet.intent.invoke('napplet:profile/open?pubkey=abc%2B123')` and
`invoke(uri, { payload, handler, handlerHint, behavior })`. Query fields decode
once into text; `+` remains literal. An explicit payload cannot accompany an
inner query, and a `#naddr` recommendation cannot accompany `handlerHint`.
Unsupported options and caller-supplied sender data are rejected. Only a
parent-originated correlated result can settle the call.

Successful results identify retained delivery responsibility with `ok`,
`archetype`, `action`, `convention`, and an opaque `handler`. A target receives
one parent-attested `intent.deliver`, buffered by `onDelivery` until registration.
Acceptance is separate from later target completion.

Legacy object-form `invoke(request)` and `open(archetype, payload?, opts?)`
remain bounded compatibility adapters and warn once per iframe with
`KEHTO_COMPAT_INTENT_OBJECT_INVOKE`. Their removal conditions are tracked in
[compatibility](https://github.com/kehto/web/blob/main/docs/compatibility.md).

## Embedding URL and realm locks

A verified napplet is an `about:srcdoc` document and inherits the host page's
referrer and base URL. Keep the shell URL out of it with
`denyNappletReferrer(frame)` before assigning `srcdoc`, plus
`renderNappletReferrerPolicyMeta()` and `renderNappletHostBase()` in the host
page `<head>` (WebKit ignores the iframe attribute for `srcdoc`; only a host-page
`<base>` reaches `document.baseURI`). `hasNappletReferrerPolicy(frame)` and
`hasNappletReferrerPolicyMeta(document)` report the two controls, and
`ShellBridge.observeFrame` warns once when either is missing.

The experimental namespace adds `resourceHintLock` next to `nestedContextLock`.
It rejects `<link rel="dns-prefetch" | "preconnect" | "prerender">`, which
browsers act on outside the napplet CSP, on every string sink and attribute
writer; scan the bytes first with `assertNappletHasNoResourceHint` (or
`nappletMarkupHasResourceHint`). Both locks remove `XSLTProcessor`, reject
namespace-prefixed frame and link tags, and inspect `DOMParser` results, which
otherwise mint frames past the nested-context lock through XSLT or XML parsing
(prefixes, DTD entities). Under the nested-context
lock the bridge revokes a napplet whose Window holds a child frame
(`nested-context`); hosts that prepare the `srcdoc` themselves opt in with
`observeFrame(frame, windowId, { nestedContextLock: true })`
(`NappletFrameObservation`). See the
[NIP-5D conformance policy](https://github.com/kehto/web/blob/main/docs/policies/NIP-5D-CONFORMANCE.md#resource-hints).

## GAMEPAD integration

This non-normative guidance defers to the living [NAP-GAMEPAD](https://github.com/napplet/naps/pull/108). Services export `createGamepadService` and `browserGamepadOptions`; shell exports `denyNappletControllerAccess`. Paja registers one host reader and deny native gamepad/HID/USB paths before frame execution. Source-bound subscriptions receive immediate full snapshots; only the visible host's input owner gets live controls. Focus loss supplies neutral controls and timestamp zero; unsubscribe, window destruction, and service removal release polling. Non-browser or denied native readers report the proposal's unavailable reasons. See [Controller input](https://github.com/kehto/web/blob/main/docs/gamepad.md).

## LLM integration

This non-normative guidance defers to the living [NAP-LLM](https://github.com/napplet/naps/pull/134) (checked at `5e93bdf`). Services export `createLlmService`, `LlmServiceError`, the provider mappers (OpenAI Chat Completions, OpenAI Responses, Anthropic Messages and Gemini `generateContent` dialects) and `LLM_PROVIDER_PRESETS`; shell exports `getShellDomainState` and the `LlmHooks` adapter field; acl exports `llm:generate`. The runtime routes `llm.*` to one registered service and answers every sanctioned request with exactly one `llm.<op>.result`, shaping missing-service and ACL failures as `{ code: 'unsupported' }`. Hosts implement `LlmConnectionHost`; the service enforces schema, handle ownership, a per-window live-handle bound (`maxHandlesPerWindow`), consent before submission, duplicate ids, cancellation and deadline races, ordered deltas and safe errors, and passes `select`/`authorize` a `{ signal }` that withdraws stale prompts. `createHttpLlmProvider({ stream: true })` streams provider output into `llm.delta` as block start/delta/end events. Results carry `content` parts (text, thinking and tool calls); tool calls and results are validated and relayed, and Kehto never executes one. Advertisement stays binary on the wire while hosts report a third `unconfigured` state until the user adds a connection. See [Language models](https://github.com/kehto/web/blob/main/docs/llm.md).

## UUID support on HTTP origins

Host identifiers that must be unguessable come from `randomUUID`, exported by
`@kehto/shell`. It calls native `crypto.randomUUID()` on its `Crypto` receiver
when available. On browsers that omit it (including non-localhost plain HTTP
origins), it builds a UUID v4 from 16 `crypto.getRandomValues()` bytes. If both
methods are unavailable it throws an explicit capability error; it never falls
back to weak randomness. `@kehto/services` has no dependency on the shell, so
it keeps a private twin of the same function; `tests/unit/random-uuid-sync.test.ts`
fails when the two bodies drift.

Each identifier has one of three contracts:

| Contract | Identifiers | Without `crypto.randomUUID` |
|----------|-------------|-----------------------------|
| Secure, fails explicitly | Shell event-injection subscription ids, cache-query ids, and the `RuntimeAdapter` `crypto.randomUUID` hook (injected event ids, relay query ids, NAP-INC channel ids, approval request ids); source-session `instanceId` in the shell and in Paja frame admission; Paja intent-launcher window ids and launch correlations; Paja NIP-46 request ids; default upload ids (`createUploadService`); the browser media backend's `media-resource-*` read ids, which share a window's resource-request id space with the napplet; registry JSON-RPC ids in `createCvmService` | UUID v4 from `crypto.getRandomValues()`, or a thrown capability error when that is missing too |
| Correlation only, uniqueness from a counter or timestamp | Injected napplet-namespace request ids (the napplet realm pairing its own requests on its private port); default LLM connection handles and synthesized tool-call ids (window- and conversation-scoped); notification ids; Paja filesystem mount ids and LLM panel connection ids | Feature-detected; a counter or timestamp keeps ids unique. These ids are never credentials |
| Behind `crypto.subtle` | Paja WebRTC session, nonce, and peer ids (`browser-webrtc.ts`, `browser-webrtc-profile.ts`) | Unavailable. Both paths need `crypto.subtle` before they mint an id, and every browser context that has `crypto.subtle` also has `crypto.randomUUID` |

A UUID fallback does not provide secure-context APIs. `crypto.subtle` stays
unavailable on non-localhost HTTP, so SHA-256 digest paths still fail there:
approval-scoped uploads and the default `createHttpUploader` digest, CVM
schema-hash verification and progress tokens, Paja development-target and
filesystem hashing, and the Paja LLM vault. This section does not establish
HTTP support for uploads, CVM, or any other domain.

This is a supported platform capability choice, not a deprecated caller API.
Both standard Web Crypto paths remain quiet. Identifier generation is host
implementation policy: no NAP wire message, source-trust rule, or readiness
rule changes. Source-bound identity and optional shell readiness are unchanged
(NAP-SHELL at `napplet/naps` `377bf939c6c906817084b43dd21d424de646dbc2`).

## Media sessions

See [Media playback](https://github.com/kehto/web/blob/main/docs/media.md) for NAP-MEDIA draft authority, shell-owned audio/video,
shared host controls, endpoint cleanup, and command API migration.
