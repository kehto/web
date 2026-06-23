# NIP-5D Conformance Policy

Status: active for the v1.12 NIP-5D Contract Conformance milestone.

Authoritative NIP-5D source:
`https://raw.githubusercontent.com/dskvr/nips/d80d7b25f9c4331acbeb40dbeb3b077caa80e885/5D.md`

Repo-local contract: `specs/NIP-5D.md`

## Authority

Only the pinned NIP-5D source defines the core NIP-5D contract. Kehto's
repo-local contract is a derived working copy for implementation and tests.
`RUNTIME-SPEC.md` is internal runtime guidance. `napplet/specs/NIP-5D.md` is a
nested submodule reference file and is not an authority for this milestone.

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
| `common.*.result` | `apps/playground/napplets/common-demo/src/main.ts` | NAP helper-surface gap | The common demo exercises multiple shell-owned `common.*` request/result pairs before a stable SDK helper is available in the installed playground shim. Raw result listeners are confined to common-demo, parent-source-bound, and correlation-id/type narrowed. |
| `cvm.discover` | `apps/playground/napplets/cvm-relatr/src/main.ts` | NAP-CVM helper-surface gap | The `cvm` ContextVM domain has no `@napplet/shim` helper at this SDK version, so the Relatr demo posts `cvm.discover` directly. Raw use is confined to cvm-relatr and the listener is parent-source-bound. |
| `cvm.request` | `apps/playground/napplets/cvm-relatr/src/main.ts` | NAP-CVM helper-surface gap | Same cvm-relatr-only gap as `cvm.discover`; the shell owns all ContextVM transport, signing, and relay access. |
| `link.open.result` | `apps/playground/napplets/link-demo/src/main.ts` | NAP helper-surface gap | The link demo exercises the shell-owned `link.open` request/result pair directly until the installed playground shim exposes a helper. Raw result listeners are confined to link-demo, parent-source-bound, and correlation-id/type narrowed. |
| `lists.*.result` | `apps/playground/napplets/lists-demo/src/main.ts` | NAP helper-surface gap | The lists demo exercises shell-owned `lists.supported`, `lists.add`, and `lists.remove` request/result pairs directly until the installed playground shim exposes a helper. Raw result listeners are confined to lists-demo, parent-source-bound, and correlation-id/type narrowed. |
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
