---
"@kehto/paja": minor
---

Add modal approval for all signing and publishing from one napplet version,
bound to its manifest/artifact identity and signer account. Keep signing-only
and publishing-only choices separate, retain older signing approvals without
granting publication, and expose revocation. Development URL approvals now last
only for their loaded session instead of trusting mutable code across reloads.
Carry authenticated source context through Paja's publication backends and open
NAP-LINK destinations directly from the modal approval click.
