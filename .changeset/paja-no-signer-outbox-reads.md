---
"@kehto/paja": patch
---

Stop background social warming from running without a signer: Paja warmed the
active account's contact list and every followed author's kind-0 profile through
the outbox router, and with a fixed simulation identity configured that happened
with no signer connected at all. The Events panel then filled `outbox relays
(NIP-65)` with other authors' relays, one kind-0 event each, as if outbox
activity had been requested.

Warming now follows `getConnectedAccountPubkey`, so it needs a connected
NIP-07/NIP-46 pubkey or the Dev signer. A fixed simulation identity stays a
read-only stand-in: it still answers `identity.getPublicKey`, and
`identity.getFollows` still loads follows on demand. A signer dropping out also
ends warming instead of falling back to the simulated identity.

The Events panel now names the authors each box was routed for as short pubkey
chips (full pubkey and read count in the tooltip), so an author-routed relay is
attributable — the fixed identity's own relays and a followed author's relays no
longer look the same.
