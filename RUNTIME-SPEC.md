# Kehto Runtime Protocol Reference

This document is an internal reference for Kehto's active NIP-5D runtime model.
It is not an independent protocol authority.

Authoritative source for NIP-5D conformance: branch-HEAD `dskvr/nips` `nip/5d`
`5D.md` (`dskvr/nips#3`), with the NIP-5A "Aggregate Hash" from `nostr-protocol/nips`
PR #2287 (`5A.md`). Content-addressed resolution adopted in milestone v1.20.

Repo-local working contract: `specs/NIP-5D.md`

Current-state delta inventory: `.planning/NIP-5D-DELTA-AUDIT.md`

## Content-Addressed Loading & Identity

Napplets are content-addressed. The runtime resolves and renders a napplet from
verified bytes — the gateway is never in the trust path:

1. Resolve the napplet's signed manifest event from relays via NIP-65 outbox
   relay selection (by kind + author, plus `d` for named napplets) and verify the
   event signature. Manifest kinds are `35129` (named/addressable, carries `d`),
   `15129` (root/replaceable), and `5129` (snapshot/regular).
2. Fetch each `path` blob from Blossom by sha256 and verify `sha256(blob)` equals
   the `path` tag hash.
3. Recompute the NIP-5A aggregate from the `path` tags and assert it equals the
   `["x","<hex>","aggregate"]` tag. This aggregate is the napplet's content
   address.
4. Assemble the verified `/index.html` and inject it via `iframe.srcdoc` (with the
   `connect-src` CSP as a `<meta http-equiv>` so the policy holds inside the
   opaque-origin iframe).

A napplet's identity is the `(dTag, aggregateHash)` tuple **computed** from these
verified bytes. The runtime MUST NOT accept identity from a host or gateway. Any
verification failure rejects the load — no iframe is rendered with unverified
bytes. A gateway MAY serve bytes as an accelerator, but its output is verified
against the signed manifest like any other source.

Resolution primitives live in `@kehto/nip/5a` (aggregate hash) and `@kehto/nip/5d`
(manifest parse, signature/aggregate/blob verification, `resolveNapplet`).

## Active Runtime Model

Kehto hosts napplets as sandboxed iframes and routes JSON object envelopes over
`postMessage`.

The active NIP-5D primitives are:

- iframe sandbox baseline is `allow-scripts`;
- `allow-same-origin` is forbidden;
- both directions use `postMessage(message, '*')`;
- shell trust is derived from `MessageEvent.source`, not `event.origin`;
- active wire messages are objects with a string `type` in `domain.action`
  form;
- unknown sources and unrecognized `type` values are silently ignored;
- napplet identity is the `(dTag, aggregateHash)` tuple computed by the runtime
  from the verified manifest bytes (NIP-5A aggregate), bound at iframe creation;
- manifest `requires` tags use short NUB names;
- hosted `window.napplet.shell.supports()` reflects shell-provided
  capabilities;
- napplets do not receive `window.nostr`, signing keys, encryption keys,
  direct browser storage, IndexedDB, or direct relay WebSockets.

## Retired Drift

Older drafts in this repo described an iframe protocol using NIP-01-like array
verbs and identity negotiation through `REGISTER`, `IDENTITY`, and `AUTH`.
Those terms do not describe active NIP-5D protocol identity.

NIP-5D identity is shell-assigned when the iframe is created. A napplet does not
negotiate protocol identity by sending `REGISTER`, answering `AUTH`, receiving
`IDENTITY`, or constructing a NIP-01 relay session.

Host-page user or signer authentication may still exist as shell-internal
product behavior. That must remain separate from NIP-5D protocol identity.

## Extension Decisions

Extension and demo-surface decisions for this milestone live in:

- `docs/policies/NIP-5D-CONFORMANCE.md`

Any remaining NIP-5D deviation must be recorded there as a deliberate NUB
extension or a demo/test-only exception.
