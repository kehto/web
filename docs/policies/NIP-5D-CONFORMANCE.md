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

### Active NAP-INC boundary

NAP-INC is governed by the living [PR #89 at
`4593ce9e301ce098fd3dad64206fcd6f144fa7af`](https://github.com/napplet/naps/pull/89),
the web projection [PR #90 at
`896c32c92deee68dc4d10fc1132b62df20cccb6f`](https://github.com/napplet/naps/pull/90),
and the stacked symmetric-channel clarification [PR #92 at
`c5cd06f7be6d4690b303949abb26e87ff62f4729`](https://github.com/napplet/naps/pull/92).
Those PRs are draft authority, not merged text; link to them rather than copying
their specification into this repository.

The projection owns query-to-text-payload transposition in the shared,
runtime-provided INC binding. Kehto runtime routing uses an exact queryless
topic identity after that conversion. It rejects query-bearing normalized wire
or discovery identities and must not add prefix, wildcard, or query-aware
matching, service-over-INC prefix dispatch, synthetic senderless events, or
runtime payload-kind inference. The runtime attaches a **runtime-attested dTag**
to delivered events, does not accept caller `sender`, keeps payloads and IDs
opaque, and excludes the source endpoint from topic fan-out.

INC channel authorization is open-only: ACL and target liveness are evaluated
at open, with no per-message authorization. PR #92 requires equivalent handles
for opener and target, target `inc.channel.opened` before the opener result,
`channel.onOpened`, per-handle `onClosed`, retained inbound/early/terminal
lifecycle data in order, bounded overflow closure, and deterministic teardown.
`channel.list` is informational only. The downstream tracker remains
[`kehto/web#203`](https://github.com/kehto/web/issues/203), including [the
upstream-resolution reply](https://github.com/kehto/web/issues/203#issuecomment-5060904495);
the superseded opener-only view must not be restored.

Phase boundaries are intentional: **Phase 104** owns all public #91 NAP-INTENT
binding, resolution, and delivery lifecycle work; **Phase 105** owns published
package adoption. Do not claim released package conformance before Phase 105.
Changelogs and archived `.planning` records are preserved history, not active
implementation drift.

### Active NAP-IDENTITY and NAP-THEME boundary

Kehto checked [NAP-IDENTITY](https://github.com/napplet/naps/blob/896c32c92deee68dc4d10fc1132b62df20cccb6f/naps/NAP-IDENTITY.md),
[NAP-THEME](https://github.com/napplet/naps/blob/896c32c92deee68dc4d10fc1132b62df20cccb6f/naps/NAP-THEME.md),
and their draft web projection at
`napplet/naps@896c32c92deee68dc4d10fc1132b62df20cccb6f`. These remain draft
authority; Kehto documents its projection and policy rather than extending the
wire contract.

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

Published Napplet package adoption remains Phase 105; this policy does not
claim that deferred package boundary has been completed.

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
| `resource.bytesMany` | `apps/playground/napplets/resource-demo/src/main.ts` | Draft NAP-RESOURCE helper gap | Updated NAP-RESOURCE adds bulk byte fetches before `@napplet/nap` ships a web helper. Raw use is confined to resource-demo, parent-source-bound, and type-narrowed. |
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
