---
"@kehto/runtime": patch
"@kehto/conformance": patch
---

`relay.publishEncrypted` now fails closed when the signer can't encrypt
(kehto/web#482). NAP-RELAY napplet/naps#2 at `9f30b350` says the shell MUST
encrypt. Before, a signer with no `nip44`/`nip04` method got an event with empty
`content` signed and published, plus `ok: true`. Now nothing is signed or
published. The reply is `ok: false` with `error: "encryption unavailable:
<scheme>"`, or `"encryption failed"` when `encrypt` returns no ciphertext.

The `@kehto/conformance` first-party fixture signer now really encrypts (NIP-44
v2 and NIP-04), so `relay/semantics` covers the `publishEncrypted` success path.
