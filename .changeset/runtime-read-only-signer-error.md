---
"@kehto/runtime": patch
---

Distinguish a read-only identity from a missing signer. `relay.publish` now
answers `signing unavailable (read-only identity)` when a connected signer
exposes no `signEvent`, and `relay.publishEncrypted` answers
`encryption unavailable (read-only identity)` or
`signer has no <scheme> encryption` instead of falling through to an empty
ciphertext. `no signer configured` is reserved for an absent signer.
