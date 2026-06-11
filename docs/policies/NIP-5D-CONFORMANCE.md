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
| `connect` | Official Kehto NUB extension | Advertise as `nub:connect` only when the shell enforces the connect-origin policy and response/header behavior for the hosted napplet. |
| `class` | Official Kehto NUB extension | Advertise as `nub:class` only when the shell assigns the napplet class and applies class-specific policy before iframe use. |
| `nostrdb` | Out of scope for active playground NIP-5D conformance | Do not count as a required playground NUB until a Kehto NUB contract and shell capability advertisement exist. |
| `identity.decrypt` | Official identity NUB operation | Allowed only as a shell-mediated request. Napplets do not receive raw key material, raw NIP-07 primitives, or reusable encryption primitives. |
| `relay.publishEncrypted` | Official relay NUB operation | Allowed only when the shell performs encryption/signing policy. Napplets may submit cleartext intent; the shell must not sign or broadcast ciphertext supplied by a napplet. |

## Raw Envelope Policy

Raw envelopes are not automatically non-conformant. They are allowed only when
they are either:

- a documented NUB domain envelope whose SDK helper surface is incomplete; or
- a demo/test-only envelope listed in the milestone raw-envelope allowlist.

### Phase 58 Raw-Envelope Allowlist

| Envelope | Location | Classification | Boundary |
|----------|----------|----------------|----------|
| `theme.set` | `apps/playground/napplets/theme-switcher/src/main.ts` | Shell theme request | Not a NIP-5D or NAP contract. Allowed only in the playground theme broadcast demo as the host-side theme mutation request that resolves to `theme.changed`. |
| `demo.decrypt.fixtures` | `apps/playground/napplets/decrypt-demo/src/main.ts` | Test/demo fixture injection | Not a NIP-5D or NAP contract. Parent-source-bound fixture delivery for the decrypt demo only. |
| `notify.create` | `apps/playground/napplets/toaster/src/main.ts` | NAP helper-surface gap | Notify service supports create/list, but `@napplet/nap/notify/sdk` lacks create/list helpers. Raw use must stay source-bound and confined to toaster. |
| `notify.list` | `apps/playground/napplets/toaster/src/main.ts` | NAP helper-surface gap | Same toaster-only helper gap as `notify.create`; raw replies are accepted only from `window.parent`. |
| `resource.bytes` | `apps/playground/napplets/resource-demo/src/main.ts` | Kehto resource wire-shape gap | Resource SDK expects upstream `id`/`blob`/`mime`; playground service currently uses `requestId`/`bodyBase64`/`status`/`headers`. Raw use is confined to resource-demo. |
| `identity.changed` | `apps/playground/napplets/feed/src/feed-identity-events.ts` | NAP helper-surface gap | Identity push is proposed for NAP-IDENTITY so napplets can react to signer login/logout without polling. Raw listener must be parent-source-bound and type-narrowed until an identity subscribe/helper API exists. |
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
