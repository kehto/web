# Kehto Runtime Protocol Reference

This document is an internal reference for Kehto's active NIP-5D runtime model.
It is not an independent protocol authority.

Authoritative source for NIP-5D conformance:
`https://raw.githubusercontent.com/dskvr/nips/d80d7b25f9c4331acbeb40dbeb3b077caa80e885/5D.md`

Repo-local working contract: `specs/NIP-5D.md`

Current-state delta inventory: `.planning/NIP-5D-DELTA-AUDIT.md`

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
- napplet identity is assigned by the shell at iframe creation from the NIP-5A
  `(dTag, aggregateHash)` tuple;
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
