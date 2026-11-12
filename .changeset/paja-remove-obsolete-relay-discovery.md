---
"@kehto/paja": patch
---

Remove obsolete NIP-07 extension relay discovery and its signer-lifecycle cache.
Use host-configured bootstrap relays for contact, NIP-65 and Blossom discovery.
Keep NAP identity.getRelays available with an empty map for unsupported external-user metadata rather than forwarding the obsolete extension hook.
