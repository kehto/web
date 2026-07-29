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

- **NAP-INTENT:** merged `napplet/naps` master
  `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`.
- **NAP-INC:** merged `napplet/naps` master
  `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`.
- **NAP-IDENTITY / NAP-THEME / NAP-SHELL:** merged `napplet/naps` master
  `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`.
- **NAP-RELAY:** open PR #2 at
  `0be8abce18beb46ca37bd4ddd042f58d30b4eedc`.
- **Published packages:** canonical INTENT/INC source
  `7b675622e13870628ce174833d7b2a33cf32a0ab`; release
  `03ad65b66413e5798536ef48695ffc4c2508f2c3`; core/nap `0.31.0`, shim
  `0.29.0`, SDK `0.27.0`, and Vite plugin `0.14.0`.

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

The released `@napplet/nap@0.31.0` SDK accepts `EventTemplate`, but the package's
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

Merged NAP-INC and released `@napplet/nap@0.31.0` both define
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

NAP-INTENT uses the merged structured `IntentRequest` and final `IntentResult`
contract. The host resolves a verified manifest candidate, completes target
creation/readiness and convention dispatch, then returns `handled`, `handler`,
`windowId`, and `convention`. There is no `intent.deliver` or `onDelivery`
surface. Kehto carries the selected convention to the target through the
ordinary runtime-attested `inc.event` path; eligible intent targets therefore
declare `inc`.

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
- Published core `0.31.0` and shim `0.29.0` omit a generic mandatory shell
  implementation. Kehto retains the host-owned NAP-SHELL prelude under
  `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24` until a corrected upstream release
  is reviewed; the shim is never documented as supplying shell.

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
| `resource.bytesMany` | `apps/playground/napplets/resource-demo/src/main.ts` | Kehto-local compatibility surface | No standalone NAP-RESOURCE document exists at the pinned master ref. Raw use is confined to resource-demo, parent-source-bound, and type-narrowed; it does not infer a NAP wire extension. |
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
