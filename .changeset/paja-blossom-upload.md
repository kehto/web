---
'@kehto/paja': minor
'@kehto/services': patch
---

Add an opt-in real Blossom upload mode to Paja with shell-owned server policy,
signer identity checks, upload consent, cache-only BUD-03 discovery, and browser
proof that the disclosed bytes reached the server. Harden the shared HTTP
uploader so progress and cancellation are observable and Blossom completion
requires exact server-confirmed hash and size metadata.
