# NIP-5D Conformance Policy

Status: active for current NIP-5D conformance guardrails.

Authoritative NIP-5D source:
`https://github.com/nostr-protocol/nips/pull/2303/`

Current injected-domain clarification:
`https://github.com/dskvr/nips/pull/4` (merged into the NIP-5D branch behind
PR #2303 on 2026-06-26)

Repo-local pointer: `specs/NIP-5D.md`

## Authority

Only the current upstream NIP-5D PR defines the core NIP-5D contract. Kehto's
repo-local spec file is intentionally a pointer so stale mirrors do not become
implementation authority. `RUNTIME-SPEC.md` is internal runtime guidance.

### Published convention authority

- **NAP-INTENT:** draft PR #106 `napplet/naps@fc121fc264615482143eda86125863d2e1f741a2` (the working authority for this implementation).
- **NAP-INC:** merged `napplet/naps` master
  `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`.
- **NAP-IDENTITY / NAP-THEME / NAP-SHELL:** merged `napplet/naps` master
  `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`.
- **NAP-RELAY:** open PR #2 at
  `0be8abce18beb46ca37bd4ddd042f58d30b4eedc`.
- **Published packages:** NAP-INTENT authority
  `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`; napplet/web#199 source
  `3037200c932488f14f7f369b8583c39c9c16510a`, merged as
  `b3f0007867eac109fa4917fac9c285d3b7cc6155`; and Version Packages #198 head
  `a79e7f4638f70f4557d4183faee9348847bb8cc7`, merged as release source
  `dc1d24153c759152b6ba31a6ec9bea967798f2df`. The current exact line is core
  `0.32.0`, nap `0.32.0`, shim `0.30.0`, SDK `0.28.0`, and Vite plugin `0.15.0`.

### Current event schema and retained compatibility

Checked NIP-5D `dskvr/nips@020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7/5D.md`
and NAP-INTENT/NAP-SHELL at
`napplet/naps@a040914b4bbd3a5cd8a14b0f316a723c968ebfb2`. Current writer source:
`napplet/web@831d3dd5056b84bc03982966279ed8b9167152f8` (Vite plugin 0.15.0).
Current `x` artifact hashes, `content`, `z`/`i`, and `R`/`O` are authoritative.
Legacy `path`/aggregate events remain a temporary compatibility extension,
isolated in `packages/nip/src/5d/legacy-manifest.ts`. Never retry malformed current
events through that adapter. Keep paired-schema tests until it is removed.
See [migration and removal policy](../migrations/NIP-5D-EVENT-SCHEMA.md).

### Shell CSP enforcement

CSP authority is [NIP-5D at
`24711d9c47bbdd07908bf1d52bf677d9cbc530f0`](https://github.com/dskvr/nips/blob/24711d9c47bbdd07908bf1d52bf677d9cbc530f0/5D.md).
The composition was also checked against [NAP-SHELL on master at
`a040914b4bbd3a5cd8a14b0f316a723c968ebfb2`](https://github.com/napplet/naps/blob/a040914b4bbd3a5cd8a14b0f316a723c968ebfb2/naps/NAP-SHELL.md).
CSP is a NIP-5D web-binding concern; it adds no NAP domain, message, or permission.

`@kehto/shell` owns the policy through `prepareNappletSrcdoc`. Paja runtime-pointer
and playground verified loading both consume this entry point. Host CSP changes
are structured source-list replacements, validated before rendering.

| Requirement | Shell treatment | Host choice |
| --- | --- | --- |
| CSP first in head before authored resources (SHOULD) | Enforced by preparation, without searching authored comments/scripts for insertion points | No opt-out on this path |
| Exact granted connection origins; avoid wildcard/scheme-wide sources (MAY/SHOULD) | Explicit HTTP(S)/WS(S) origins only; normalize, deduplicate, validate | Grant origins; narrow `connect-src`, including `'none'` |
| No broad `'unsafe-eval'` merely for WASM (MUST NOT) | Always rejected as Kehto policy | Keep or remove the default `'wasm-unsafe-eval'` |
| Verify artifacts before policy injection, exclude injection from hashes (MUST) | Reference hosts resolve and verify before preparing a rendered copy | Keep original verified bytes and identity; preparation does not authenticate raw HTML |
| Namespace before authored scripts (MUST) | CSP then mandatory bootstrap; reject script overrides that suppress its inline execution | Choose optional domains and compatible script directives |
| Conservative example source lists | Shared defaults; not promoted wholesale to protocol MUSTs | Override supported directives for styles, images, media and other resources |
| Meta cannot enforce `frame-ancestors`, `sandbox`, `report-uri` | Reject unsupported directive names; omit ineffective directives | Set appropriate HTTP response headers and the required iframe sandbox attribute |

Existing authored CSP is preserved as an additional restriction. An inherited
host response policy can also restrict `srcdoc`; the shell cannot relax it.
The inline bootstrap currently requires `'unsafe-inline'` in `script-src` and
any explicit `script-src-elem`, without overriding nonce/hash/`strict-dynamic`
expressions. `script-src-attr` may independently deny inline event handlers.

Low-level namespace render/injection utilities do not apply CSP. Paja's existing
target-URL development wrapper uses these utilities to retain local HMR; it is
not a verified runtime-pointer load. The verified production hosts must use
`prepareNappletSrcdoc`, with verification and source-binding guards intact.

### Active NAP-RELAY boundary

Kehto follows [NAP-RELAY PR #2 at
`0be8abce18beb46ca37bd4ddd042f58d30b4eedc`](https://github.com/napplet/naps/pull/2).
For `relay.publish`, a napplet supplies an unsigned `EventTemplate`; the shell
signs it, sends only the signed event to relay services, and returns
`relay.publish.result` with `ok`, the full signed `event`, and `eventId` on
success or `error` on failure. Runtime, `createRelayPoolService`,
`createCoordinatedRelay`, Paja, and the playground must consume the same signed
event and result contract. Failed publications are not delivered through the
runtime's successful-event buffer.

The released `@napplet/nap@0.32.0` SDK accepts `EventTemplate`, but the package's
`RelayPublishMessage.event` declaration still names `NostrEvent`. That is
recorded upstream drift, not authority to let a napplet bypass shell signing.

### Active NAP-INC boundary

NAP-INC is governed by merged
[`naps/NAP-INC.md`](https://github.com/napplet/naps/blob/5ac0490461ca6fec2f0d2e45b4835cf9bc08de24/naps/NAP-INC.md)
on `napplet/naps` master
`5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`. The document remains marked
draft, but the merged path supersedes the earlier stacked PR heads as protocol
authority.

The released package projection owns query-to-text-payload transposition in the
shared, runtime-provided INC binding. Kehto runtime routing then uses an exact
stable convention topic identity. It rejects query-bearing normalized wire or
discovery identities, while routing arbitrary opaque strings (including `?` and
`#`) by their complete exact text. It must not add prefix, wildcard, or
query-aware matching, service-over-INC prefix dispatch, synthetic senderless
events, or runtime payload-kind inference. The runtime attaches a
**runtime-attested dTag** to
delivered events, does not accept caller `sender`, keeps payloads and IDs
opaque, and excludes the source endpoint from topic fan-out.

Merged NAP-INC and released `@napplet/nap@0.32.0` both define
`on(topic, callback)` with one `IncEvent`.

INC channel authorization is open-only: ACL and target liveness are evaluated
at open, with no per-message authorization. The merged spec requires equivalent handles
for opener and target, target `inc.channel.opened` before the opener result,
`channel.onOpened`, per-handle `onClosed`, retained inbound/early/terminal
lifecycle data in order, bounded overflow closure, and deterministic teardown.
`channel.list` is informational only. The downstream tracker remains
[`kehto/web#203`](https://github.com/kehto/web/issues/203), including [the
upstream-resolution reply](https://github.com/kehto/web/issues/203#issuecomment-5060904495);
the superseded opener-only view must not be restored.

### Intent delivery and invocation boundary

Checked NAP-INTENT PR #106 at `napplet/naps@fc121fc264615482143eda86125863d2e1f741a2` and NIP-5D PR #2303 at `dskvr/nips@020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7`. Paja and playground use verified manifest contracts, opaque publisher-safe catalog IDs, parent-attested sender identity, exact convention matching, and one `intent.deliver` after source-bound readiness. A success result records retained delivery responsibility only; no completion result is sent to the source.

`@napplet/nap@0.32.0` is behind the checked NAP. `packages/services/src/intent-types.ts` is the bounded local contract until upstream exports the exact candidate IDs/contracts, accepted result, and delivery shapes. It is not a second transport: remove it only when that release lands and the service, shell, Paja, and playground regressions pass against the upstream export. `sourceWindowId` is internal host correlation and never wire data. Legacy INC fallback remains separately tracked as `KEHTO_COMPAT_INTENT_INC`; legacy object invoke is tracked as `KEHTO_COMPAT_INTENT_OBJECT_INVOKE`.

NIP-5D bytes are verified before `srcdoc` execution; injected bootstraps are deliberately outside the signed artifact hash and unknown `MessageEvent.source` values are dropped. Paja's external URL uses a signed ephemeral launcher to provide an authenticated source. A native external host source has no verified iframe endpoint and remains a deferred upstream spec gap.

### Active NAP-IDENTITY and NAP-THEME boundary

Kehto checks NAP-IDENTITY and NAP-THEME at `napplet/naps` master
`5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`. Kehto documents its projection
and policy rather than extending the wire contract.

- `identity.getPublicKey` always settles with one correlated
  `identity.getPublicKey.result`; `pubkey: ""` is the no-signer/failure
  sentinel. Other supported readonly identity reads retain their matching safe
  primary field. Unknown identity actions are silent. `identity.changed` is
  automatic for actual connect/sign-out transitions only, including `pubkey:
  ""`; it is neither an INC event nor an intent delivery.
- `theme.get` always returns a complete theme with `colors.background`,
  `colors.text`, and `colors.primary`. Kehto deliberately reconciles the draft
  error-only example by returning one fixed non-sensitive complete normal
  `theme.get.result` without `error` for ACL-denied, firewall-denied, or
  unavailable reads. This is a Kehto policy/spec-gap reconciliation, not a
  mixed `theme` + `error` extension or a separate theme error message.
- `theme.changed` is an automatic change push. The injected surface is
  `theme.get()` and `theme.onChanged()` only; no theme subscribe/unsubscribe
  wire protocol exists.
- Host changes target only authenticated live `shell.ready` sessions whose
  frozen environment includes the matching domain and whose recipient
  capability is currently granted. The protected injected identity/theme
  objects are readonly and accept results or changes only from `window.parent`.
  A theme update stores complete state before its single eligible-recipient
  push.

Phase 105 completed published Napplet package adoption. This policy records the
selected released line without turning Kehto-local policy into protocol authority.

## Runtime Availability Policy

Current NIP-5D runtime availability is injected
`window.napplet.<domain>` presence before authored napplet scripts run.

- Injection must happen outside the signed napplet artifact bytes.
- Injection must be limited to `window.napplet`.
- Domain object presence is availability only; operation semantics, versions,
  errors, and diagnostics belong to the matching NAP spec.
- Optional-domain presence and mandatory NAP-SHELL are separate requirements.
  Every Kehto-hosted iframe receives `window.napplet.shell` before authored code,
  regardless of manifest `requires` or capability toggles.
- NAP-SHELL owns `ready()`, local `supports(domain, protocol?)`, read-only
  `services`, `onReady()`, and the `shell.ready` / `shell.init` lifecycle. The
  runtime prelude installs its parent-bound receiver before emitting readiness;
  napplet artifacts are not required to bundle their own handshake.
- Published core `0.32.0` and shim `0.30.0` omit a generic mandatory shell
  implementation. Kehto retains the host-owned NAP-SHELL prelude under
  `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24` until a corrected upstream release
  is reviewed; the shim is never documented as supplying shell.

### Paja local development targets

Manifest requirement admission applies only to verified pointer targets. Local
files have no signed manifest; embedded `napplet-requires` publishing metadata
neither blocks local loading nor grants capabilities. Both paths retain host
environment filtering and identity registration before `srcdoc` execution.
This boundary was rechecked against NIP-5D `020cb8b` and NAP-SHELL at
`napplet/naps@e5308ac92cfd49e4fb026812c60886571515e219` for the PR #278 merge fix;
local unsigned loading remains the intentional spec gap described below.

Paja runtime-pointer mode can open a local single-file `index.html` (file picker
or drag and drop). Checked on 2026-10-07 against NIP-5D PR #2303 head
`dskvr/nips@020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7` (`5D.md`) and NAP-SHELL
at `napplet/naps` master `a040914b4bbd3a5cd8a14b0f316a723c968ebfb2`, which is
byte-identical to the recorded `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`.

- **Conformant:** the identity is computed from the file's own bytes, never
  accepted from the host. It is registered against the frame `Window` before any
  code runs. The bytes load only through `srcdoc` under `sandbox="allow-scripts"`.
  The CSP meta and the `window.napplet` prelude (including mandatory `shell` and
  the unchanged `shell.ready` / `shell.init` handshake) are injected outside the
  hashed bytes.
- **Intentional spec-gap decision:** NIP-5D Identity steps 1-3 (resolve and
  verify a signed manifest, then fetch and verify its Blossom artifact) cannot
  apply to an unsigned local file. Local files are a Paja development-host
  affordance outside the NIP-5D resolution path, in the same category as
  target-URL authoring mode. They never enter Paja's verified installed catalog
  and are never intent delivery targets. The `dTag` comes from the NIP-5D
  `<meta name="napplet-id">` publishing metadata when present, otherwise
  `local-<file-stem>`. That metadata only labels an unverified development
  target. It is not a manifest claim.
- **Recorded drift, not changed here:** the current NIP-5D draft defines the
  artifact hash as the manifest's single `x` tag over `/index.html`. Kehto's
  `@kehto/nip/5d` resolver still verifies NIP-5A `path` tags plus an aggregate
  `x` tag. Local targets use the same NIP-5A single-path aggregate as that
  resolver, so a local file and its published single-file build share one
  identity.

## Extension Classification

| Surface | Classification | Contract |
|---------|----------------|----------|
| `connect` | Official Kehto NAP extension | Advertise as `nap:connect` only when the shell enforces the connect-origin policy and response/header behavior for the hosted napplet. |
| `class` | Official Kehto NAP extension | Advertise as `nap:class` only when the shell assigns the napplet class and applies class-specific policy before iframe use. |
| `nostrdb` | Out of scope for active playground NIP-5D conformance | Do not count as a required playground NAP until a Kehto NAP contract and shell capability advertisement exist. |
| `relay.publishEncrypted` | Official relay NAP operation | Allowed only when the shell performs encryption/signing policy. Napplets may submit cleartext intent; the shell must not sign or broadcast ciphertext supplied by a napplet. |

## Raw Envelope Policy

Raw envelopes are not automatically non-conformant. They are allowed only when
they are either:

- a documented NAP domain envelope whose SDK helper surface is incomplete; or
- a demo/test-only envelope listed in the milestone raw-envelope allowlist.

NAP-RESOURCE host projections follow exact draft ref
`9511232f69313aa7953d110e35d32cc28d506f66` and package contract
merged in `napplet/web#206` at `19e0029b228127769a0ebdcf0b6b2f30293bd284`
and released by `b007587afbefb0ce5592825d6ec1fc5b026c7b08`:
single requests carry optional `servers`, while bulk requests carry
`requests: [{ url, servers? }]`. The playground resource demo uses the published
shim and resource SDK over that injected API and needs no raw-envelope exception.

### Phase 58 Raw-Envelope Allowlist

| Envelope | Location | Classification | Boundary |
|----------|----------|----------------|----------|
| `common.*.result` | `apps/playground/napplets/common-demo/src/main.ts` | Disabled source / NAP helper-surface gap | The retained common-demo source is not hosted by the playground. Until it is replaced with a real demo or deleted, raw result listeners stay confined to common-demo, parent-source-bound, and correlation-id/type narrowed. |
| `cvm.discover` | `apps/playground/napplets/cvm-relatr/src/main.ts` | NAP-CVM helper-surface gap | The `cvm` ContextVM domain has no `@napplet/shim` helper at this SDK version, so the Relatr demo posts `cvm.discover` directly. Raw use is confined to cvm-relatr and the listener is parent-source-bound. |
| `cvm.request` | `apps/playground/napplets/cvm-relatr/src/main.ts` | NAP-CVM helper-surface gap | Same cvm-relatr-only gap as `cvm.discover`; the shell owns all ContextVM transport, signing, and relay access. |
| `link.open.result` | `apps/playground/napplets/link-demo/src/main.ts` | Disabled source / NAP helper-surface gap | The retained link-demo source is not hosted by the playground. Until it is replaced with a real demo or deleted, raw result listeners stay confined to link-demo, parent-source-bound, and correlation-id/type narrowed. |
| `lists.*.result` | `apps/playground/napplets/lists-demo/src/main.ts` | Disabled source / NAP helper-surface gap | The retained lists-demo source is not hosted by the playground. Until it is replaced with a real demo or deleted, raw result listeners stay confined to lists-demo, parent-source-bound, and correlation-id/type narrowed. |
| `ble.*.result` | `apps/playground/napplets/ble-demo/src/main.ts` | Disabled source / NAP helper-surface gap | The retained BLE demo source is not hosted by the playground. Until it is replaced with a real demo or deleted, raw result listeners stay confined to ble-demo, parent-source-bound, and correlation-id/type narrowed. |
| `serial.*.result` | `apps/playground/napplets/serial-demo/src/main.ts` | Disabled source / NAP helper-surface gap | The retained serial-demo source is not hosted by the playground. Until it is replaced with a real demo or deleted, raw result listeners stay confined to serial-demo, parent-source-bound, and correlation-id/type narrowed. |
| `webrtc.*.result` / `webrtc.event` | `apps/playground/napplets/webrtc-demo/src/main.ts` | Disabled source / NAP helper-surface gap | The retained WebRTC demo source is not hosted by the playground. Until it is replaced with a real demo or deleted, raw result/event listeners stay confined to webrtc-demo, parent-source-bound, and correlation-id/type narrowed. |
| `notify.create` | `apps/playground/napplets/toaster/src/main.ts` | NAP helper-surface gap | Notify service supports create/list, but `@napplet/nap/notify/sdk` lacks create/list helpers. Raw use must stay source-bound and confined to toaster. |
| `notify.list` | `apps/playground/napplets/toaster/src/main.ts` | NAP helper-surface gap | Same toaster-only helper gap as `notify.create`; raw replies are accepted only from `window.parent`. |
| `theme.changed` | `apps/playground/src/theme.ts` | NAP helper-surface gap | Theme change is an automatic shell-to-napplet envelope; the raw listener is parent-source-bound and type-narrowed. No subscribe/unsubscribe wire action exists. |

New raw `window.parent.postMessage()` protocol envelopes in playground napplets
must fail static checks unless they are added to that allowlist with a concrete
classification.

## Naming Policy

Use "ready", "identity-bound", "registered", "connected", or "signer
authenticated" according to the actual state being described.

Do not use `AUTH`, `REGISTER`, `IDENTITY`, or "authenticated" to describe
NIP-5D protocol identity. Those words are allowed only when discussing
historical drift, NIP-42 relay behavior, or user/signer authentication outside
the napplet protocol identity path.
