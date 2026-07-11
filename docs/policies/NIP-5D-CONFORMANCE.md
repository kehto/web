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
| `theme.changed` | `apps/playground/src/theme.ts` | NAP helper-surface gap | Theme push exists as a shell-to-napplet NAP envelope, but no `theme.subscribe` helper exists. Raw listener must be parent-source-bound and type-narrowed. |

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
