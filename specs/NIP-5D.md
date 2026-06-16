# Kehto NIP-5D Contract

Status: active repo-local contract for v1.12 conformance work.

Authoritative source: branch-HEAD `dskvr/nips` `nip/5d` `5D.md` (`dskvr/nips#3`),
with the NIP-5A "Aggregate Hash" from `nostr-protocol/nips` PR #2287 (`5A.md`).

This document is a repo-local working contract derived from the branch-HEAD
NIP-5D source above. If this file and the source conflict, the source wins.
`RUNTIME-SPEC.md` and `napplet/specs/NIP-5D.md` are not independent authorities
for NIP-5D.

## Core Model

NIP-5D defines iframe-hosted web applets ("napplets") communicating with a
hosting shell through `postMessage`. Protocol messages are JSON object
envelopes. NUB specs define the domain-specific message types, payload shapes,
and shell behavior.

Napplets are single-purpose untrusted applications. The shell composes them and
mediates storage, relay, signing, encryption, and other privileged operations.

## Transport

Communication uses `postMessage` in both directions:

```ts
window.parent.postMessage(message, '*');
iframeWindow.postMessage(message, '*');
```

The `'*'` target origin is required because napplets run with opaque origins.
Sender trust is never derived from `event.origin`; it is derived from
`MessageEvent.source`.

## Sandbox

NIP-5D napplet iframes must use:

```html
<iframe sandbox="allow-scripts">
```

`allow-same-origin` must never be present. Shells may add `allow-forms`,
`allow-modals`, `allow-downloads`, or `allow-popups` by explicit shell policy.

Because napplets run with an opaque origin and no privileged shell globals, they
must not directly use:

- `localStorage`
- `sessionStorage`
- `IndexedDB`
- direct `WebSocket` relay connections
- direct signing keys
- direct encryption keys or primitives
- `window.nostr`

Storage, signing, encryption, relay access, and similar privileged behavior are
shell-mediated through NUB contracts.

## Wire Envelope

All napplet-shell protocol messages are JSON objects with a string `type`
discriminant:

```json
{ "type": "<domain>.<action>" }
```

The `type` format is `domain.action`. Domains correspond to NUB capability
names. A NUB owns every `type` string for its domain, such as `relay.*`,
`identity.*`, or `storage.*`.

Messages with an unrecognized `type` must be silently ignored. NUB-specific
error envelopes are allowed only where the relevant NUB contract defines them
for recognized messages.

NIP-01 array verbs such as `REGISTER`, `AUTH`, `IDENTITY`, `EVENT`, `REQ`, and
`CLOSE` are not the active NIP-5D wire model.

## Identity

A napplet's identity is the `(dTag, aggregateHash)` tuple. The runtime
**computes** it from the napplet's own verified bytes; it MUST NOT accept it from
a host or gateway.

The runtime resolves a napplet from a signed manifest event (kinds `35129` named,
`15129` root, `5129` snapshot): verify the manifest signature, fetch each `path`
blob from Blossom by sha256 and verify it, recompute the NIP-5A aggregate from the
`path` tags and assert it equals the `["x","<hex>","aggregate"]` tag, then inject
the verified `/index.html` via `iframe.srcdoc`. Any failure rejects the load.

When the shell creates the napplet iframe, it binds the iframe `Window` reference
to that computed `(dTag, aggregateHash)` tuple — the napplet's session identity.
No napplet-side identity negotiation is required. Internal representation is an
implementation detail as long as every inbound message resolves from
`MessageEvent.source` to the same identity before dispatch.

Messages from unknown `Window` references must be silently dropped.

## Manifest Requires

NIP-5A manifests declare required capabilities with short NUB names:

```json
["requires", "relay"]
```

`requires` values must use short NUB/domain names such as `identity`, `relay`,
or `storage`. They must not use spec identifiers such as `NUB-IDENTITY`.

At napplet load time, the shell checks `requires` tags against shell
capabilities. If a required capability is absent, the shell should reject the
napplet or show a compatibility warning before treating the napplet as usable.
If a manifest has no `requires` tags, the shell may load the napplet with the
capabilities it provides.

## Runtime Capability Query

Hosted napplets query capabilities through:

```ts
window.napplet.shell.supports('relay');
window.napplet.shell.supports('nub:identity');
window.napplet.shell.supports('perm:popups');
```

The shell must implement this query for hosted napplets. The result must reflect
actual shell-provided capabilities and policy, not only the static domain list
known to a shim package.

Accepted names:

| Form | Meaning |
|------|---------|
| `relay` | shorthand for `nub:relay` |
| `nub:identity` | shell implements the identity NUB |
| `perm:popups` | shell grants the named sandbox/policy permission |

Unknown capabilities return `false`. Napplets must gracefully degrade when a
capability is absent.

## NUB Extension Boundary

NIP-5D defines transport, sandboxing, identity binding, manifest negotiation,
and capability query. NUBs define valid protocol domains and message payloads.

A Kehto NUB extension is conformant only when it:

- has an explicit capability name;
- owns the relevant `domain.*` envelope types;
- documents payload shape and shell behavior;
- is advertised through shell capabilities only when the shell implements it;
- preserves the NIP-5D sandbox, source-binding, and `window.nostr` invariants.

Napplets may produce cleartext requests for mediated operations. Shells must not
sign or broadcast ciphertext supplied by napplets as if it were shell-produced
ciphertext.

## Security Rationale

The load-bearing security properties are:

1. `allow-scripts` without `allow-same-origin` keeps the napplet origin opaque.
2. `postMessage(..., '*')` is paired with `MessageEvent.source` validation.
3. Identity is bound at iframe creation from the NIP-5A `(dTag, aggregateHash)`.
4. Unknown sources and unrecognized types are silently ignored.
5. Napplets never receive `window.nostr` or raw signing/encryption primitives.

The protocol does not protect against a compromised browser, malicious shell,
side channels, or social engineering.
