---
"@kehto/paja": patch
---

Add a view-only signer beside Dev, NIP-07, and Bunker. The new field accepts an
`npub1…`, `nprofile1…`, or 64-character hex pubkey and previews the napplet as
that account: identity reads work, while signing, encryption, publishing, DM,
WebRTC, and Blossom upload fail closed without a confirmation prompt. A pasted
`nsec` is refused without being echoed or logged, `nprofile` relay hints become
the identity's relay list, and the npub persists per browser origin — outranking
the implicit NIP-07 probe on reload — until **Log out** clears it.
