---
"@kehto/paja": patch
---

Resolve the NIP-46 user pubkey with `get_public_key` after a spec-compliant
`connect` reply of `"ack"`. Paja previously stored that acknowledgement as the
connected account, so `identity.getPublicKey` returned `"ack"` and napplets saw
a signed-in user without a valid 64-hex pubkey. Ownership-gated UI such as the
View Problem editor's **Edit problem** button therefore stayed disabled even
though the bunker could sign. Signers that return a pubkey inline still work,
and an invalid `get_public_key` response now fails the connection instead of
being exposed as identity.
