---
'@kehto/paja': patch
---

Signer connect, switch and disconnect no longer reload the napplet frame. Paja pushes NAP-IDENTITY `identity.changed` to loaded napplets (`pubkey: ""` when the identity is cleared), once per real pubkey change. A frame is reloaded only when the signer change adds a domain it declared (for example `webrtc`) or removes one it was admitted, since NIP-5D needs a fresh injection for that.
