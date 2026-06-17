# Kehto NIP-5D Contract

Status: active repo-local contract for v1.21 NIP-5D (#2303) + NAP-SHELL/INTENT
conformance work.

Authoritative source: [`nostr-protocol/nips` PR **#2303**](https://github.com/nostr-protocol/nips/pull/2303)
(`5D.md`), with the NIP-5A "Aggregate Hash" from
[`nostr-protocol/nips`](https://github.com/nostr-protocol/nips/blob/master/5A.md)
(`5A.md`).

This document is a repo-local working contract derived from the NIP-5D source
above. If this file and the source conflict, **the source wins**.
`RUNTIME-SPEC.md` and the `napplet/naps` registry mirrors are not independent
authorities for NIP-5D.

Protocol messages for each capability domain are defined by **NAP** (Nostr Applet
Protocol) extension specs in the [`napplet/naps`](https://github.com/napplet/naps)
registry. Two NAPs are mandatory or core to this contract and are mirrored
locally:

- [`specs/NAP-SHELL.md`](./NAP-SHELL.md) — the mandatory bootstrap handshake
  (`shell.ready` / `shell.init`) and capability query (`shell.supports`).
- [`specs/NAP-INTENT.md`](./NAP-INTENT.md) — archetype intent dispatch
  (`intent.*`).

> **Terminology note.** Earlier drafts of this contract used "NUB" for the
> extension specs and the `nub:` capability prefix. The current term is **NAP**,
> and the capability prefix is `nap:`. `nub:` is retained only as an accepted
> back-compat alias (see [Runtime Capability Query](#runtime-capability-query)).
> The `@napplet/nub` npm package was renamed to `@napplet/nap`; no current code
> depends on `@napplet/nub`.

## Core Model

NIP-5D defines iframe-hosted web applets ("napplets") communicating with a
hosting application ("shell") through `postMessage` using a generic JSON
envelope. NAP specs define the domain-specific message types, payload shapes, and
shell behavior.

A napplet is a Nostr applet — a small, focused application that does one thing
well. Napplets SHOULD be single-purpose rather than monolithic; the shell
composes napplets, napplets do not compose themselves. Napplets are untrusted;
the shell mediates storage, relay, signing, encryption, and other privileged
operations.

## Transport

Communication uses `postMessage` in both directions:

```ts
window.parent.postMessage(message, '*');   // napplet → shell
iframeWindow.postMessage(message, '*');    // shell → napplet
```

The `'*'` target origin is required because napplets run with opaque origins.
Sender trust is never derived from `event.origin`; it is derived from
`MessageEvent.source` (an unforgeable `Window` reference).

## Sandbox

NIP-5D napplet iframes are loaded via `srcdoc` (see [Identity](#identity)) and
MUST use:

```html
<iframe sandbox="allow-scripts">
```

`allow-same-origin` MUST NOT be present. Shells MAY add `allow-forms`,
`allow-modals`, `allow-downloads`, or `allow-popups` by explicit shell policy.

Because napplets run with an opaque origin and no privileged shell globals, they
have no access to:

- `localStorage`
- `sessionStorage`
- `IndexedDB`
- direct `WebSocket` relay connections
- direct signing keys
- direct encryption keys or primitives
- `window.nostr`

Storage, signing, encryption, relay access, and similar privileged behavior are
shell-mediated through NAP contracts.

## Wire Envelope

All napplet-shell protocol messages are JSON objects with a string `type`
discriminant:

```json
{ "type": "<domain>.<action>" }
```

The `type` format is `domain.action`. Domains correspond to NAP capability names
(e.g. a NAP named `foo` owns every `foo.*` type). A NAP owns every `type` string
for its domain, such as `relay.*`, `identity.*`, `storage.*`, `shell.*`, or
`intent.*`. This NIP does not enumerate message types.

Example — a request/response pattern:

```json
{ "type": "foo.bar", "id": "abc", "data": {} }
{ "type": "foo.bar.result", "id": "abc", "result": {} }
```

Messages with an unrecognized `type` MUST be silently ignored. This allows
forward compatibility as new NAPs are defined. NAP-specific error envelopes are
allowed only where the relevant NAP contract defines them for recognized
messages — for example, NAP-INTENT sanctions `intent.*.result` envelopes
carrying a structured `error` field, and the storage domain replies with
`storage.*.result` envelopes whose optional `error` field signals failure (see
[`RUNTIME-SPEC.md` → Unknown-`type` handling](../RUNTIME-SPEC.md)).

NIP-01 array verbs such as `REGISTER`, `AUTH`, `IDENTITY`, `EVENT`, `REQ`, and
`CLOSE` are not the active NIP-5D wire model.

## Identity

A napplet's identity is the `(dTag, aggregateHash)` tuple. The runtime
**computes** it from the napplet's own verified bytes; it MUST NOT accept it from
a host or gateway.

Before creating the iframe, the runtime MUST:

1. Resolve the napplet manifest event (kind `5129`, `15129`, or `35129`, see
   [Manifest](#manifest)) from relays and verify its signature.
2. Fetch each `path` blob from Blossom by its sha256 and verify `sha256(blob)`
   matches the `path` hash.
3. Recompute the NIP-5A aggregate hash from the `path` tags; if the manifest
   carries an `["x","<hex>","aggregate"]` tag it MUST match. This is
   `aggregateHash`.
4. Inject the verified `/index.html` via `iframe.srcdoc` (never a navigated
   `src`) and bind the iframe's `Window` reference to `(dTag, aggregateHash)` —
   the napplet's session identity.

A gateway MAY serve the bytes as an accelerator or fallback, but the runtime MUST
verify its output against the signed manifest — the gateway is never trusted. Any
verification failure rejects the load; no iframe is rendered with unverified
bytes.

Identity is fixed before any code runs and bound to the exact bytes that run. No
napplet-side identity negotiation is required. The shell MUST verify
`MessageEvent.source` on every inbound message; messages from `Window` references
not mapped to a napplet MUST be silently dropped.

## Manifest

A napplet is published as a **napplet manifest** event. Its tag schema is adopted
from NIP-5A — `path`, the `x` aggregate tag, `server`, and optional `title` /
`description` / `source` — under NIP-5D's own kinds:

| Kind    | Type                     | `d` tag    |
| ------- | ------------------------ | ---------- |
| `5129`  | snapshot (regular)       | none       |
| `15129` | root napplet (replaceable) | none     |
| `35129` | named napplet (addressable) | identifier |

Distinct kinds keep napplets out of nsite gateway resolution: a napplet is
resolved and verified by the runtime ([Identity](#identity)), never served as an
nsite.

A napplet is a single self-contained `/index.html`. The manifest MUST include a
`path` tag per file — `["path", "/index.html", "<sha256>"]` — and `server` tags
SHOULD hint the Blossom servers holding those blobs. The `["x","<sha256-hex>","aggregate"]`
tag carries the NIP-5A aggregate hash of the `path` tags. A `5129` snapshot pins a
specific napplet version per NIP-5A.

### `requires` tag

The manifest declares required capabilities with `requires` tags:

```json
["requires", "<nap-name>"]
```

Each value is a bare NAP domain (e.g. `relay`, `identity`, `storage` — never
`NAP-RELAY`). At load the shell checks `requires` against its capabilities; if one
is absent it SHOULD reject the napplet or warn. With no `requires` tags it loads
with whatever the shell provides.

### `archetype` tag (NAAT — NAP-INTENT)

A napplet declares the archetype roles it fulfills with `archetype` tags:

```json
["archetype", "<slug>", "<NAP-N>"]
```

`<slug>` is the role name (e.g. `note`, `profile`, `emoji-list`); the optional
third element `<NAP-N>` is the recommended default wire protocol for that role.
A manifest MAY carry multiple `archetype` tags. The shell sources its NAP-INTENT
catalog (`available()` / `handlers()`) from these signed manifest tags — see
[`specs/NAP-INTENT.md`](./NAP-INTENT.md). In kehto, `@kehto/nip/5d` parses these
into a structured `archetypes: { slug, nap? }[]` field on `NappletManifest`.

### `source` tag

The optional `source` tag, adopted from NIP-5A, records the upstream source URL
for the napplet build:

```json
["source", "<url>"]
```

`@kehto/nip/5d` parses it into an optional `source` field on `NappletManifest`.

## Runtime Capability Query

Hosted napplets query capabilities through `window.napplet.shell.supports()`,
answered **synchronously and locally** from the `shell.init` environment cached
during the NAP-SHELL handshake (see [`specs/NAP-SHELL.md`](./NAP-SHELL.md)):

```ts
window.napplet.shell.supports('relay');             // bare → nap:relay
window.napplet.shell.supports('nap:identity');      // explicit NAP capability
window.napplet.shell.supports('inc', 'NAP-01');     // domain narrowed to a numbered protocol
window.napplet.shell.supports('perm:popups');       // sandbox/policy permission
```

The shell MUST implement this query. The result MUST reflect actual
shell-provided capabilities and policy, not only the static domain list known to
a shim package. Napplets MUST gracefully degrade when a capability is absent.

Accepted forms:

| Form           | Meaning                                                  |
| -------------- | -------------------------------------------------------- |
| `relay` (bare) | shorthand for `nap:relay`                                |
| `nap:identity` | shell implements the identity NAP                        |
| `nub:identity` | **accepted alias** for `nap:identity` (back-compat only) |
| `perm:popups`  | shell grants the named sandbox/policy permission         |

`nap:` is the primary, documented prefix. `nub:` is accepted only as a
back-compat alias and SHOULD NOT be used in new napplets. Unknown capabilities
return `false`.

### Capability wire shape

`shell.init` carries the runtime's capability environment. NAP-SHELL leaves the
internal byte layout non-normative — only that it can answer
`supports(domain, protocol?)`. The conformant shape kehto emits (and that
`@napplet/shim@0.13` reads) is:

```ts
capabilities: {
  domains: string[],                    // bare NAP domain names: ['relay','identity','inc',…]
  protocols: Record<string, string[]>,  // per-domain numbered protocols: { inc: ['NAP-01'…'NAP-06'] }
}
```

`supports('relay')` is true iff `'relay' ∈ capabilities.domains`;
`supports('inc','NAP-01')` is true iff `'NAP-01' ∈ capabilities.protocols['inc']`.

For back-compat with the installed 0.5.0 shim, kehto emits `domains`/`protocols`
as a **superset alongside** the legacy `naps` / `nubs` / `sandbox` fields (the
dual-emit; removal is tracked as CLEANUP-01). Host-extended `perm:`-prefixed
`sandbox` entries are folded into `domains` (the 0.13 shim has no separate
permission namespace).

## NAP Extension Boundary

NIP-5D defines transport, sandboxing, identity binding, manifest negotiation, and
capability query. NAPs define valid protocol domains and message payloads.

A Kehto NAP extension is conformant only when it:

- has an explicit capability name;
- owns the relevant `domain.*` envelope types;
- documents payload shape and shell behavior;
- defines all valid `type` strings for its domain;
- is independently implementable — a shell MAY support any subset of NAPs;
- is advertised through shell capabilities only when the shell implements it;
- preserves the NIP-5D sandbox, source-binding, and `window.nostr` invariants.

Napplets may produce cleartext requests for mediated operations. Shells MUST NOT
sign or broadcast ciphertext supplied by napplets as if it were shell-produced
ciphertext.

## Security Rationale

The load-bearing security properties are:

1. `allow-scripts` without `allow-same-origin` keeps the napplet origin opaque —
   the precondition for any browser-enforced isolation.
2. `postMessage(..., '*')` is paired with `MessageEvent.source` validation (never
   `event.origin`).
3. Identity is bound at iframe creation from the NIP-5A `(dTag, aggregateHash)`,
   computed from verified bytes.
4. Content-addressed loading verifies the manifest signature, each blob's sha256,
   and the recomputed aggregate against any `x` tag; gateways are untrusted.
5. Unknown sources and unrecognized types are silently ignored (preventing
   capability probing).
6. Napplets never receive `window.nostr` or raw signing/encryption primitives.

The protocol does not protect against a compromised browser, a malicious shell,
side channels, or social engineering.

## References

- [NIP-5D PR #2303](https://github.com/nostr-protocol/nips/pull/2303) — authoritative source
- [NIP-5A](https://github.com/nostr-protocol/nips/blob/master/5A.md) — manifest tag schema / aggregate hash
- [`napplet/naps`](https://github.com/napplet/naps) — NAP registry
- [`specs/NAP-SHELL.md`](./NAP-SHELL.md) — bootstrap handshake & capability query (mandatory)
- [`specs/NAP-INTENT.md`](./NAP-INTENT.md) — archetype intent dispatch
- [`RUNTIME-SPEC.md`](../RUNTIME-SPEC.md) — kehto runtime model & unknown-`type` handling
